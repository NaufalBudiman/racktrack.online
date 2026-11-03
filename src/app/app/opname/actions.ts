"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { authorize } from "@/lib/access";
import { getDb } from "@/lib/db";
import { listPlaces } from "@/lib/devices";
import { devices, stockCountScans, stockCounts } from "@/lib/schema";
import { SHELF_STATUSES, inArea, type CountExpected, type CountStatus } from "@/lib/countTypes";
import { serialKey } from "@/lib/scan";
import { idSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid input.";

const startSchema = z.object({
  locationId: z.union([z.string().uuid(), z.literal("")]).nullish().transform((v) => v || null),
  note: z.string().trim().max(200).nullish().transform((v) => v || null),
});

/** Starts a count: freezes the list of devices that should be on the shelf in that area. */
export async function startCount(workspaceId: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  const a = await authorize(workspaceId, "editor");
  if (!a.ok) return a;
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { locationId, note } = parsed.data;

  const db = getDb();
  const places = await listPlaces(a.workspaceId);
  const place = locationId ? places.find((p) => p.id === locationId) : null;
  if (locationId && !place) return { ok: false, error: "That location no longer exists." };

  // One running count per area: join it instead of starting a second one.
  const running = await db
    .select({ id: stockCounts.id, locationId: stockCounts.locationId })
    .from(stockCounts)
    .where(and(eq(stockCounts.workspaceId, a.workspaceId), eq(stockCounts.status, "open")));
  const same = running.find((r) => r.locationId === locationId);
  if (same) return { ok: true, id: same.id };

  const inside = inArea(places, locationId);
  const rows = await db
    .select({ id: devices.id, name: devices.name, serial: devices.serial, status: devices.status, locationId: devices.locationId, location: devices.location })
    .from(devices)
    .where(and(eq(devices.workspaceId, a.workspaceId), inArray(devices.status, [...SHELF_STATUSES])));
  const expected: CountExpected[] = rows
    .filter((d) => inside(d.locationId))
    .map(({ id, name, serial, status, location }) => ({ id, name, serial, status, location }));

  const [created] = await db
    .insert(stockCounts)
    .values({ workspaceId: a.workspaceId, locationId, scope: place?.label ?? "All locations", expected, note, startedBy: a.userId })
    .returning({ id: stockCounts.id });
  revalidatePath("/app", "layout");
  return { ok: true, id: created.id };
}

async function countIn(workspaceId: string, id: unknown) {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return null;
  const [row] = await getDb()
    .select({ id: stockCounts.id, status: stockCounts.status })
    .from(stockCounts)
    .where(and(eq(stockCounts.workspaceId, workspaceId), eq(stockCounts.id, parsed.data)));
  return row ?? null;
}

const scansSchema = z
  .array(
    z.object({
      serial: z.string().trim().max(120).nullish(),
      deviceId: z.string().uuid().nullish(), // RackTrack QR label
      model: z.string().trim().max(120).nullish(),
    }),
  )
  .min(1)
  .max(100);

/** Adds scanned serials (live camera, photo or typed). The same serial twice is ignored. */
export async function addScans(
  workspaceId: unknown,
  countId: unknown,
  items: unknown,
): Promise<ActionResult<{ added: number; repeats: number }>> {
  const a = await authorize(workspaceId, "editor");
  if (!a.ok) return a;
  const count = await countIn(a.workspaceId, countId);
  if (!count) return { ok: false, error: "Count not found." };
  if (count.status !== "open") return { ok: false, error: "This count is finished. Reopen it to scan more." };
  const parsed = scansSchema.safeParse(items);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const db = getDb();
  const all = await db
    .select({ id: devices.id, serial: devices.serial })
    .from(devices)
    .where(eq(devices.workspaceId, a.workspaceId));
  const byId = new Map(all.map((d) => [d.id, d]));
  const bySerial = new Map<string, string>();
  for (const d of all) if (d.serial && !bySerial.has(serialKey(d.serial))) bySerial.set(serialKey(d.serial), d.id);

  const rows = new Map<string, typeof stockCountScans.$inferInsert>();
  for (const it of parsed.data) {
    const device = it.deviceId ? byId.get(it.deviceId) : undefined;
    if (it.deviceId && !device) continue; // a label from another workspace
    const serial = device ? device.serial ?? device.id : it.serial;
    if (!serial) continue;
    const key = serialKey(serial);
    rows.set(key, {
      countId: count.id,
      serial,
      serialKey: key,
      deviceId: device?.id ?? bySerial.get(key) ?? null,
      model: device || bySerial.has(key) ? null : it.model || null,
      scannedBy: a.userId,
    });
  }
  if (!rows.size) return { ok: false, error: "Nothing to add." };
  const inserted = await db.insert(stockCountScans).values([...rows.values()]).onConflictDoNothing().returning({ id: stockCountScans.id });
  revalidatePath(`/app/opname/${count.id}`);
  return { ok: true, added: inserted.length, repeats: rows.size - inserted.length };
}

export async function removeScan(workspaceId: unknown, countId: unknown, scanId: unknown): Promise<ActionResult> {
  const a = await authorize(workspaceId, "editor");
  if (!a.ok) return a;
  const count = await countIn(a.workspaceId, countId);
  if (!count) return { ok: false, error: "Count not found." };
  if (count.status !== "open") return { ok: false, error: "This count is finished. Reopen it to change scans." };
  const sid = idSchema.safeParse(scanId);
  if (!sid.success) return { ok: false, error: "Invalid scan." };
  await getDb()
    .delete(stockCountScans)
    .where(and(eq(stockCountScans.id, sid.data), eq(stockCountScans.countId, count.id)));
  revalidatePath(`/app/opname/${count.id}`);
  return { ok: true };
}

const NEXT: Record<CountStatus, CountStatus[]> = { open: ["review"], review: ["open", "closed"], closed: ["review"] };

/** open → review (done scanning), review → open (scan more) or closed, closed → review (reopen). */
export async function setCountStatus(workspaceId: unknown, countId: unknown, status: unknown): Promise<ActionResult> {
  const a = await authorize(workspaceId, "editor");
  if (!a.ok) return a;
  const count = await countIn(a.workspaceId, countId);
  if (!count) return { ok: false, error: "Count not found." };
  const to = z.enum(["open", "review", "closed"]).safeParse(status);
  if (!to.success || !NEXT[count.status].includes(to.data)) return { ok: false, error: "Can't do that from here." };

  await getDb()
    .update(stockCounts)
    .set({
      status: to.data,
      ...(to.data === "review" && count.status === "open" ? { finishedAt: new Date() } : {}),
      closedAt: to.data === "closed" ? new Date() : null,
    })
    .where(and(eq(stockCounts.id, count.id), eq(stockCounts.workspaceId, a.workspaceId)));
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function deleteCount(workspaceId: unknown, countId: unknown): Promise<ActionResult> {
  const a = await authorize(workspaceId, "admin");
  if (!a.ok) return a;
  const count = await countIn(a.workspaceId, countId);
  if (!count) return { ok: false, error: "Count not found." };
  await getDb().delete(stockCounts).where(and(eq(stockCounts.id, count.id), eq(stockCounts.workspaceId, a.workspaceId)));
  revalidatePath("/app", "layout");
  return { ok: true };
}
