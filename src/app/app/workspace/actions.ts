"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, count, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { authorize, createWorkspaceFor, setActiveWorkspace } from "@/lib/access";
import { getDb } from "@/lib/db";
import { users, workspaceInvites, workspaceMembers, workspaces } from "@/lib/schema";
import { idSchema } from "@/lib/validation";
import {
  ASSIGNABLE_ROLES,
  DIGESTS,
  INVITE_TTL_DAYS,
  MAX_MEMBERS_PER_WORKSPACE,
  MAX_OWNED_WORKSPACES,
  canGrant,
  outranks,
  type Role,
} from "@/lib/roles";
import type { ActionResult } from "@/lib/types";

const nameSchema = z.string().trim().min(1, "Name is required").max(60, "Name: max 60 characters");
const emailSchema = z.email("Enter a valid email").transform((v) => v.trim().toLowerCase());
const roleSchema = z.enum(ASSIGNABLE_ROLES, "Pick a valid role");

const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid input.";

function done() {
  revalidatePath("/app", "layout");
  return { ok: true } as const;
}

/* ---------- workspaces ---------- */

export async function switchWorkspace(workspaceId: unknown): Promise<ActionResult> {
  const a = await authorize(workspaceId, "viewer");
  if (!a.ok) return a;
  await setActiveWorkspace(a.workspaceId);
  return done();
}

export async function createWorkspace(name: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "You are signed out. Please sign in again." };

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const [row] = await getDb()
    .select({ n: count() })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.role, "owner")));
  if ((row?.n ?? 0) >= MAX_OWNED_WORKSPACES)
    return { ok: false, error: `You can own up to ${MAX_OWNED_WORKSPACES} workspaces.` };

  const ws = await createWorkspaceFor(userId, parsed.data);
  await setActiveWorkspace(ws.workspaceId);
  revalidatePath("/app", "layout");
  return { ok: true, id: ws.workspaceId };
}

export async function renameWorkspace(workspaceId: unknown, name: unknown): Promise<ActionResult> {
  const a = await authorize(workspaceId, "admin");
  if (!a.ok) return a;
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  await getDb().update(workspaces).set({ name: parsed.data }).where(eq(workspaces.id, a.workspaceId));
  return done();
}

export async function leaveWorkspace(workspaceId: unknown): Promise<ActionResult> {
  const a = await authorize(workspaceId, "viewer");
  if (!a.ok) return a;
  if (a.role === "owner") return { ok: false, error: "The owner can't leave their own workspace." };

  await getDb()
    .delete(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, a.workspaceId), eq(workspaceMembers.userId, a.userId)));
  redirect("/app"); // the active-workspace cookie now points nowhere; /app falls back to another one
}

/* ---------- members ---------- */

async function memberRole(workspaceId: string, userId: unknown): Promise<{ id: string; role: Role } | null> {
  if (typeof userId !== "string" || !userId) return null;
  const [m] = await getDb()
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
  return m ? { id: userId, role: m.role } : null;
}

export async function changeMemberRole(workspaceId: unknown, userId: unknown, role: unknown): Promise<ActionResult> {
  const a = await authorize(workspaceId, "admin");
  if (!a.ok) return a;
  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const target = await memberRole(a.workspaceId, userId);
  if (!target) return { ok: false, error: "Member not found." };
  if (target.id === a.userId) return { ok: false, error: "You can't change your own role." };
  if (!outranks(a.role, target.role) || !canGrant(a.role, parsed.data))
    return { ok: false, error: "You don't have permission to change this member's role." };

  await getDb()
    .update(workspaceMembers)
    .set({ role: parsed.data })
    .where(and(eq(workspaceMembers.workspaceId, a.workspaceId), eq(workspaceMembers.userId, target.id)));
  return done();
}

export async function removeMember(workspaceId: unknown, userId: unknown): Promise<ActionResult> {
  const a = await authorize(workspaceId, "admin");
  if (!a.ok) return a;

  const target = await memberRole(a.workspaceId, userId);
  if (!target) return { ok: false, error: "Member not found." };
  if (target.id === a.userId) return { ok: false, error: "Use “Leave workspace” to remove yourself." };
  if (!outranks(a.role, target.role))
    return { ok: false, error: "You don't have permission to remove this member." };

  await getDb()
    .delete(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, a.workspaceId), eq(workspaceMembers.userId, target.id)));
  return done();
}

/* ---------- invites ---------- */

export async function createInvite(
  workspaceId: unknown,
  email: unknown,
  role: unknown,
): Promise<ActionResult<{ token: string }>> {
  const a = await authorize(workspaceId, "admin");
  if (!a.ok) return a;
  const e = emailSchema.safeParse(email);
  if (!e.success) return { ok: false, error: firstError(e.error) };
  const r = roleSchema.safeParse(role);
  if (!r.success) return { ok: false, error: firstError(r.error) };
  if (!canGrant(a.role, r.data)) return { ok: false, error: "You can't invite someone with a higher role than yours." };

  const db = getDb();
  const [existing] = await db
    .select({ id: users.id })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(and(eq(workspaceMembers.workspaceId, a.workspaceId), eq(users.email, e.data)));
  if (existing) return { ok: false, error: `${e.data} is already a member.` };

  const [[members], [invites]] = await Promise.all([
    db.select({ n: count() }).from(workspaceMembers).where(eq(workspaceMembers.workspaceId, a.workspaceId)),
    db
      .select({ n: count() })
      .from(workspaceInvites)
      .where(and(eq(workspaceInvites.workspaceId, a.workspaceId), gt(workspaceInvites.expiresAt, new Date()))),
  ]);
  if (members.n + invites.n >= MAX_MEMBERS_PER_WORKSPACE)
    return { ok: false, error: `A workspace can have up to ${MAX_MEMBERS_PER_WORKSPACE} members and pending invites.` };

  // Re-inviting the same email replaces the old link.
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db
    .insert(workspaceInvites)
    .values({ workspaceId: a.workspaceId, email: e.data, role: r.data, token, invitedBy: a.userId, expiresAt })
    .onConflictDoUpdate({
      target: [workspaceInvites.workspaceId, workspaceInvites.email],
      set: { role: r.data, token, invitedBy: a.userId, expiresAt, createdAt: new Date() },
    });

  revalidatePath("/app/team");
  return { ok: true, token };
}

export async function revokeInvite(workspaceId: unknown, inviteId: unknown): Promise<ActionResult> {
  const a = await authorize(workspaceId, "admin");
  if (!a.ok) return a;
  const id = idSchema.safeParse(inviteId);
  if (!id.success) return { ok: false, error: "Invalid invite." };

  await getDb()
    .delete(workspaceInvites)
    .where(and(eq(workspaceInvites.id, id.data), eq(workspaceInvites.workspaceId, a.workspaceId)));
  revalidatePath("/app/team");
  return { ok: true };
}

/** Form action on /invite/[token]. Only the invited email can accept. */
export async function acceptInvite(token: string): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email?.toLowerCase();
  if (!userId || !email) redirect(`/invite/${encodeURIComponent(token)}`);

  const db = getDb();
  const [invite] = await db.select().from(workspaceInvites).where(eq(workspaceInvites.token, token));
  // The invite page shows the reason for each of these; just send the user back there.
  if (!invite || invite.expiresAt < new Date() || invite.email !== email)
    redirect(`/invite/${encodeURIComponent(token)}`);

  const [already] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, invite.workspaceId), eq(workspaceMembers.userId, userId)));

  const consume = db.delete(workspaceInvites).where(eq(workspaceInvites.id, invite.id));
  if (already) await consume;
  else
    await db.batch([
      db.insert(workspaceMembers).values({ workspaceId: invite.workspaceId, userId, role: invite.role }),
      consume,
    ]);

  await setActiveWorkspace(invite.workspaceId);
  revalidatePath("/app", "layout");
  redirect("/app");
}

/** Your own email digest setting for this workspace. */
export async function setDigest(workspaceId: unknown, digest: unknown): Promise<ActionResult> {
  const a = await authorize(workspaceId, "viewer");
  if (!a.ok) return a;
  const d = z.enum(DIGESTS, "Pick Daily, Weekly or Off").safeParse(digest);
  if (!d.success) return { ok: false, error: firstError(d.error) };

  await getDb()
    .update(workspaceMembers)
    .set({ digest: d.data })
    .where(and(eq(workspaceMembers.workspaceId, a.workspaceId), eq(workspaceMembers.userId, a.userId)));
  revalidatePath("/app/team");
  return { ok: true };
}
