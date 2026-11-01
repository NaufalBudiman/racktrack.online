// Server-only: who is signed in, which workspaces they belong to, and what they may do there.
import { cache } from "react";
import { cookies } from "next/headers";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "./db";
import { workspaceMembers, workspaces } from "./schema";
import { idSchema } from "./validation";
import { atLeast, ROLE_LABELS, type Role } from "./roles";

export const WORKSPACE_COOKIE = "rt_ws";

export type Membership = { workspaceId: string; name: string; role: Role };

export type AppContext = {
  userId: string;
  email: string | null;
  workspace: Membership; // the one being viewed
  workspaces: Membership[];
};

export function personalWorkspaceName(name: string | null | undefined): string {
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${first}'s workspace` : "My workspace";
}

async function listMemberships(userId: string): Promise<Membership[]> {
  return getDb()
    .select({ workspaceId: workspaces.id, name: workspaces.name, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(asc(workspaces.createdAt));
}

export async function createWorkspaceFor(userId: string, name: string): Promise<Membership> {
  const db = getDb();
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(workspaces).values({ id, name, createdBy: userId }),
    db.insert(workspaceMembers).values({ workspaceId: id, userId, role: "owner" }),
  ]);
  return { workspaceId: id, name, role: "owner" };
}

/** Signed-in user + active workspace (from the cookie, else the oldest). Creates a personal workspace on first visit. */
export const getAppContext = cache(async (): Promise<AppContext | null> => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  let list = await listMemberships(userId);
  if (list.length === 0) list = [await createWorkspaceFor(userId, personalWorkspaceName(session.user.name))];

  const wanted = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  const workspace = list.find((w) => w.workspaceId === wanted) ?? list[0];
  return { userId, email: session.user.email?.toLowerCase() ?? null, workspace, workspaces: list };
});

export type Authorized = { ok: true; userId: string; workspaceId: string; role: Role };
type Denied = { ok: false; error: string };

/**
 * For server actions: the workspace id comes from the browser, so check that the
 * signed-in user is a member with at least `min` role before touching anything.
 */
export async function authorize(workspaceId: unknown, min: Role): Promise<Authorized | Denied> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "You are signed out. Please sign in again." };

  const parsed = idSchema.safeParse(workspaceId);
  if (!parsed.success) return { ok: false, error: "Invalid workspace." };

  const [m] = await getDb()
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, parsed.data), eq(workspaceMembers.userId, userId)));
  if (!m) return { ok: false, error: "You are not a member of this workspace." };
  if (!atLeast(m.role, min))
    return { ok: false, error: `${ROLE_LABELS[m.role]}s can't do that in this workspace.` };

  return { ok: true, userId, workspaceId: parsed.data, role: m.role };
}

export async function setActiveWorkspace(workspaceId: string) {
  (await cookies()).set(WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
