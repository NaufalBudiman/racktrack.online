"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { authorize } from "@/lib/access";
import { getDb } from "@/lib/db";
import { deviceHistory, devices } from "@/lib/schema";
import { ASSIGNMENT_LABELS, MAX_DEVICES_PER_WORKSPACE, limitMessage, statusLabel } from "@/lib/categories";
import { deviceInputSchema, idSchema, moveSchema, type DeviceInput } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

// Every query below filters by a workspace the session user is a member of (checked by
// `authorize`). Never trust ids from the client alone.

async function countDevices(workspaceId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(devices)
    .where(eq(devices.workspaceId, workspaceId));
  return row?.n ?? 0;
}

export async function createDevice(workspaceId: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize(workspaceId, "editor");
  if (!auth.ok) return auth;

  const parsed = deviceInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const n = await countDevices(auth.workspaceId);
  if (n >= MAX_DEVICES_PER_WORKSPACE) return { ok: false, error: limitMessage(n) };

  const db = getDb();
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(devices).values({ ...parsed.data, id, workspaceId: auth.workspaceId, userId: auth.userId }),
    db.insert(deviceHistory).values({ deviceId: id, userId: auth.userId, text: "Device added." }),
  ]);

  revalidatePath("/app", "layout");
  return { ok: true, id };
}

const show = (v: string | null) => v ?? "—";

export async function updateDevice(workspaceId: unknown, id: unknown, input: unknown): Promise<ActionResult> {
  const auth = await authorize(workspaceId, "editor");
  if (!auth.ok) return auth;

  const idParsed = idSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "Invalid device id." };
  const parsed = deviceInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const db = getDb();
  const [existing] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.id, idParsed.data), eq(devices.workspaceId, auth.workspaceId)));
  if (!existing) return { ok: false, error: "Device not found." };

  const next: DeviceInput = parsed.data;
  const changes: string[] = [];
  if (existing.status !== next.status) changes.push(`Status: ${existing.status} → ${next.status}`);
  if ((existing.location ?? null) !== next.location)
    changes.push(`Location: ${show(existing.location)} → ${show(next.location)}`);
  if ((existing.customer ?? null) !== next.customer)
    changes.push(`Customer: ${show(existing.customer)} → ${show(next.customer)}`);

  const update = db
    .update(devices)
    .set({ ...next, updatedAt: new Date() })
    .where(and(eq(devices.id, idParsed.data), eq(devices.workspaceId, auth.workspaceId)));

  if (changes.length > 0) {
    await db.batch([
      update,
      db.insert(deviceHistory).values(changes.map((text) => ({ deviceId: idParsed.data, userId: auth.userId, text }))),
    ]);
  } else {
    await update;
  }

  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function deleteDevice(workspaceId: unknown, id: unknown): Promise<ActionResult> {
  const auth = await authorize(workspaceId, "editor");
  if (!auth.ok) return auth;

  const idParsed = idSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "Invalid device id." };

  // History rows are removed by ON DELETE CASCADE.
  await getDb()
    .delete(devices)
    .where(and(eq(devices.id, idParsed.data), eq(devices.workspaceId, auth.workspaceId)));

  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function importDevices(
  workspaceId: unknown,
  rows: unknown,
): Promise<ActionResult<{ imported: number; skipped: number; skippedNote: string }>> {
  const auth = await authorize(workspaceId, "editor");
  if (!auth.ok) return auth;

  if (!Array.isArray(rows)) return { ok: false, error: "Invalid import data." };
  if (rows.length === 0) return { ok: false, error: "Nothing to import." };
  if (rows.length > MAX_DEVICES_PER_WORKSPACE)
    return {
      ok: false,
      error: `This file has ${rows.length} rows. You can import at most ${MAX_DEVICES_PER_WORKSPACE} devices per workspace.`,
    };

  const valid: DeviceInput[] = [];
  const problems: string[] = [];
  rows.forEach((row, i) => {
    const parsed = deviceInputSchema.safeParse(row);
    if (parsed.success) valid.push(parsed.data);
    else if (problems.length < 3)
      problems.push(`row ${i + 1}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
  });
  const skipped = rows.length - valid.length;
  if (valid.length === 0)
    return { ok: false, error: `No valid rows to import (${problems.join("; ")}).` };

  const n = await countDevices(auth.workspaceId);
  const remaining = MAX_DEVICES_PER_WORKSPACE - n;
  if (valid.length > remaining) {
    return {
      ok: false,
      error: `Import would exceed the ${MAX_DEVICES_PER_WORKSPACE}-device limit: this workspace has ${n}, this file adds ${valid.length}, and only ${Math.max(remaining, 0)} slot(s) are left. Nothing was imported.`,
    };
  }

  const db = getDb();
  const withIds = valid.map((v) => ({
    ...v,
    id: crypto.randomUUID(),
    workspaceId: auth.workspaceId,
    userId: auth.userId,
  }));
  // One batch = one transaction: all rows are imported or none.
  await db.batch([
    db.insert(devices).values(withIds),
    db
      .insert(deviceHistory)
      .values(
        withIds.map((d) => ({ deviceId: d.id, userId: auth.userId, text: "Imported from spreadsheet." })),
      ),
  ]);

  revalidatePath("/app", "layout");
  return {
    ok: true,
    imported: valid.length,
    skipped,
    skippedNote: problems.length ? `Examples: ${problems.join("; ")}` : "",
  };
}

/** Send to customer, return to stock, mark faulty/missing/retired, from the action buttons. */
export async function moveDevice(workspaceId: unknown, id: unknown, move: unknown): Promise<ActionResult> {
  const auth = await authorize(workspaceId, "editor");
  if (!auth.ok) return auth;

  const idParsed = idSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "Invalid device id." };
  const m = moveSchema.safeParse(move);
  if (!m.success) return { ok: false, error: m.error.issues[0]?.message ?? "Invalid input." };

  const db = getDb();
  const [existing] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.id, idParsed.data), eq(devices.workspaceId, auth.workspaceId)));
  if (!existing) return { ok: false, error: "Device not found." };

  const move_ = m.data;
  let patch: Record<string, unknown>;
  let text: string;
  switch (move_.type) {
    case "checkout": {
      if (existing.status === "In Use") return { ok: false, error: "This device is already at a customer. Return it first." };
      const { customer, contact, assignment, outDate, returnDate } = move_;
      patch = { status: "In Use", customer, contact, assignment, outDate, returnDate };
      text = `Sent to ${customer} (${ASSIGNMENT_LABELS[assignment].toLowerCase()}${returnDate ? `, due ${returnDate}` : ""})`;
      break;
    }
    case "checkin": {
      patch = { status: move_.result, location: move_.location ?? existing.location };
      const verb = existing.status === "Hilang" ? "Found" : existing.status === "Faulty" ? "Repaired" : "Returned";
      const from = existing.status === "In Use" && existing.customer ? ` from ${existing.customer}` : "";
      text = `${verb}${from} → ${statusLabel(move_.result)}${move_.location ? ` (${move_.location})` : ""}`;
      break;
    }
    case "status": {
      if (existing.status === move_.status) return { ok: false, error: `Already ${statusLabel(move_.status)}.` };
      patch = { status: move_.status };
      text = `Marked ${statusLabel(move_.status).toLowerCase()}`;
      break;
    }
  }
  if (move_.note) text += ` — ${move_.note}`;

  // Re-run the normal device rules on the merged result (e.g. leaving a customer clears customer fields).
  const { id: _i, workspaceId: _w, userId: _u, createdAt: _c, updatedAt: _up, ...current } = existing;
  const parsed = deviceInputSchema.safeParse({ ...current, ...patch });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await db.batch([
    db
      .update(devices)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(devices.id, idParsed.data), eq(devices.workspaceId, auth.workspaceId))),
    db.insert(deviceHistory).values({ deviceId: idParsed.data, userId: auth.userId, text }),
  ]);

  revalidatePath("/app", "layout");
  return { ok: true };
}

const mergeSchema = z.object({
  field: z.enum(["customer", "location"]),
  from: z.array(z.string().min(1).max(200)).min(1).max(20),
  to: z.string().trim().min(1, "Pick the name to keep").max(200),
});

/** Data cleanup: rename every device's customer/location in `from` to `to`, with a history row each. */
export async function mergeValues(workspaceId: unknown, input: unknown): Promise<ActionResult<{ changed: number }>> {
  const auth = await authorize(workspaceId, "editor");
  if (!auth.ok) return auth;
  const parsed = mergeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { field, to } = parsed.data;
  const from = parsed.data.from.filter((v) => v !== to);
  if (from.length === 0) return { ok: true, changed: 0 };

  const db = getDb();
  const column = field === "customer" ? devices.customer : devices.location;
  const scope = and(eq(devices.workspaceId, auth.workspaceId), inArray(column, from));
  const rows = await db.select({ id: devices.id, value: column }).from(devices).where(scope);
  if (rows.length === 0) return { ok: true, changed: 0 };

  const label = field === "customer" ? "Customer" : "Location";
  await db.batch([
    db.update(devices).set({ [field]: to, updatedAt: new Date() }).where(scope),
    db.insert(deviceHistory).values(
      rows.map((r) => ({ deviceId: r.id, userId: auth.userId, text: `${label}: ${r.value} → ${to} (merged)` })),
    ),
  ]);

  revalidatePath("/app", "layout");
  return { ok: true, changed: rows.length };
}
