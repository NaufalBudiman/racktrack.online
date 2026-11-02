"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { authorize } from "@/lib/access";
import { getDb } from "@/lib/db";
import { getDevice, listPlaces } from "@/lib/devices";
import { devices, shareLinks } from "@/lib/schema";
import { MAX_SHARE_LINKS, SHARE_EXPIRY, SHARE_KINDS, type ShareExpiry } from "@/lib/share";
import { idSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

const inputSchema = z.object({
  kind: z.enum(SHARE_KINDS, "Pick what to share"),
  target: z.string().trim().max(200).nullable(),
  showCustomer: z.boolean(),
  showSerial: z.boolean(),
  expiry: z.enum(Object.keys(SHARE_EXPIRY) as [ShareExpiry, ...ShareExpiry[]], "Pick when the link expires"),
});

/** Admins and owners only: anyone with the link can see what it covers. */
export async function createShareLink(workspaceId: unknown, input: unknown): Promise<ActionResult<{ token: string }>> {
  const a = await authorize(workspaceId, "admin");
  if (!a.ok) return a;
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { kind, showCustomer, showSerial, expiry } = parsed.data;
  const ws = a.workspaceId;
  const db = getDb();

  // The target must exist in this workspace.
  let target: string | null = null;
  if (kind !== "all") {
    const t = parsed.data.target ?? "";
    if (kind === "customer") {
      const [hit] = await db
        .select({ n: count() })
        .from(devices)
        .where(and(eq(devices.workspaceId, ws), eq(devices.customer, t)));
      if (!hit?.n) return { ok: false, error: "That customer has no devices." };
    } else {
      const id = idSchema.safeParse(t);
      const exists =
        id.success &&
        (kind === "location" ? (await listPlaces(ws)).some((p) => p.id === id.data) : !!(await getDevice(ws, id.data)));
      if (!exists) return { ok: false, error: `That ${kind} no longer exists.` };
    }
    target = t;
  }

  const [row] = await db.select({ n: count() }).from(shareLinks).where(eq(shareLinks.workspaceId, ws));
  if ((row?.n ?? 0) >= MAX_SHARE_LINKS)
    return { ok: false, error: `Up to ${MAX_SHARE_LINKS} share links per workspace. Revoke old ones on the Team page.` };

  const token = randomBytes(24).toString("base64url");
  await db.insert(shareLinks).values({
    workspaceId: ws,
    token,
    kind,
    target,
    showCustomer,
    showSerial,
    createdBy: a.userId,
    expiresAt: expiry === "never" ? null : new Date(Date.now() + Number(expiry) * 86_400_000),
  });
  revalidatePath("/app/team");
  return { ok: true, token };
}

export async function revokeShareLink(workspaceId: unknown, id: unknown): Promise<ActionResult> {
  const a = await authorize(workspaceId, "admin");
  if (!a.ok) return a;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid link." };
  await getDb()
    .delete(shareLinks)
    .where(and(eq(shareLinks.id, parsed.data), eq(shareLinks.workspaceId, a.workspaceId)));
  revalidatePath("/app/team");
  return { ok: true };
}
