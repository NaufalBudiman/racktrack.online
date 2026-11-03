"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { authorize } from "@/lib/access";
import { getDb } from "@/lib/db";
import { resolvePlace } from "@/lib/devices";
import { ensureProjects, renameProjectStatements } from "@/lib/projects";
import { deviceHistory, devices, stockMinimums } from "@/lib/schema";
import { modelKey } from "@/lib/models";
import { ASSIGNMENT_LABELS, CATEGORIES, MAX_DEVICES_PER_WORKSPACE, limitMessage, statusLabel } from "@/lib/categories";
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

// Server-computed location columns; the client's free-text label is never stored as-is.
const placeFields = (p: { locationId: string | null; location: string | null }) => ({
  locationId: p.locationId,
  location: p.location,
});

export async function createDevice(workspaceId: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize(workspaceId, "editor");
  if (!auth.ok) return auth;

  const parsed = deviceInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const n = await countDevices(auth.workspaceId);
  if (n >= MAX_DEVICES_PER_WORKSPACE) return { ok: false, error: limitMessage(n) };

  const place = await resolvePlace(auth.workspaceId, parsed.data);
  if (!place.ok) return place;

  const db = getDb();
  const id = crypto.randomUUID();
  await ensureProjects(auth.workspaceId, [parsed.data.customer]);
  await db.batch([
    db
      .insert(devices)
      .values({ ...parsed.data, ...placeFields(place), id, workspaceId: auth.workspaceId, userId: auth.userId }),
    db
      .insert(deviceHistory)
      .values({ deviceId: id, userId: auth.userId, text: "Device added.", project: parsed.data.customer ?? null }),
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

  const place = await resolvePlace(auth.workspaceId, parsed.data);
  if (!place.ok) return place;
  const next = { ...parsed.data, ...placeFields(place) };
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
    const project = next.customer ?? existing.customer ?? null;
    await ensureProjects(auth.workspaceId, [next.customer]);
    await db.batch([
      update,
      db
        .insert(deviceHistory)
        .values(changes.map((text) => ({ deviceId: idParsed.data, userId: auth.userId, text, project }))),
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

  // Each distinct location text resolves once (matching a place or creating a site), in sheet order.
  const placeByText = new Map<string, { locationId: string | null; location: string | null }>();
  for (const v of valid) {
    const key = v.location?.trim().toLowerCase() ?? "";
    if (placeByText.has(key)) continue;
    const place = await resolvePlace(auth.workspaceId, { location: v.location });
    if (!place.ok) return place;
    placeByText.set(key, placeFields(place));
  }

  const db = getDb();
  const withIds = valid.map((v) => ({
    ...v,
    ...placeByText.get(v.location?.trim().toLowerCase() ?? ""),
    id: crypto.randomUUID(),
    workspaceId: auth.workspaceId,
    userId: auth.userId,
  }));
  await ensureProjects(auth.workspaceId, withIds.map((d) => d.customer));
  // One batch = one transaction: all rows are imported or none.
  await db.batch([
    db.insert(devices).values(withIds),
    db
      .insert(deviceHistory)
      .values(
        withIds.map((d) => ({
          deviceId: d.id,
          userId: auth.userId,
          text: "Imported from spreadsheet.",
          project: d.customer ?? null,
        })),
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
      patch = { status: move_.result, ...(move_.locationId ? { locationId: move_.locationId } : {}) };
      const verb = existing.status === "Hilang" ? "Found" : existing.status === "Faulty" ? "Repaired" : "Returned";
      const from = existing.status === "In Use" && existing.customer ? ` from ${existing.customer}` : "";
      text = `${verb}${from} → ${statusLabel(move_.result)}`;
      break;
    }
    case "status": {
      if (existing.status === move_.status) return { ok: false, error: `Already ${statusLabel(move_.status)}.` };
      patch = { status: move_.status };
      text = `Marked ${statusLabel(move_.status).toLowerCase()}`;
      break;
    }
  }

  // Re-run the normal device rules on the merged result (e.g. leaving a customer clears customer fields).
  const { id: _i, workspaceId: _w, userId: _u, createdAt: _c, updatedAt: _up, ...current } = existing;
  const parsed = deviceInputSchema.safeParse({ ...current, ...patch });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const place = await resolvePlace(auth.workspaceId, parsed.data);
  if (!place.ok) return place;
  if (move_.type === "checkin" && place.location) text += ` (${place.location})`;
  if (move_.note) text += ` — ${move_.note}`;
  // Tag the project it went to, or the one it came back from.
  const project = (move_.type === "checkout" ? move_.customer : existing.customer) ?? null;
  if (move_.type === "checkout") await ensureProjects(auth.workspaceId, [move_.customer]);

  await db.batch([
    db
      .update(devices)
      .set({ ...parsed.data, ...placeFields(place), updatedAt: new Date() })
      .where(and(eq(devices.id, idParsed.data), eq(devices.workspaceId, auth.workspaceId))),
    db.insert(deviceHistory).values({ deviceId: idParsed.data, userId: auth.userId, text, project }),
  ]);

  revalidatePath("/app", "layout");
  return { ok: true };
}

const mergeSchema = z.object({
  field: z.enum(["customer", "name"]),
  from: z.array(z.string().min(1).max(200)).min(1).max(20),
  to: z.string().trim().min(1, "Pick the name to keep").max(200),
});

/** Data cleanup: rename every device's customer or model name in `from` to `to`, with a history row each. */
export async function mergeValues(workspaceId: unknown, input: unknown): Promise<ActionResult<{ changed: number }>> {
  const auth = await authorize(workspaceId, "editor");
  if (!auth.ok) return auth;
  const parsed = mergeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { field, to } = parsed.data;
  const from = parsed.data.from.filter((v) => v !== to);
  if (from.length === 0) return { ok: true, changed: 0 };

  const db = getDb();
  const column = { customer: devices.customer, name: devices.name }[field];
  const scope = and(eq(devices.workspaceId, auth.workspaceId), inArray(column, from));
  const rows = await db.select({ id: devices.id, value: column }).from(devices).where(scope);
  if (rows.length === 0) return { ok: true, changed: 0 };

  const label = { customer: "Customer", name: "Name" }[field];
  // Customers are projects: merging also merges the project rows, history tags and share links.
  const projectSteps = field === "customer" ? await renameProjectStatements(auth.workspaceId, from, to) : [];
  await db.batch([
    db.update(devices).set({ [field]: to, updatedAt: new Date() }).where(scope),
    db.insert(deviceHistory).values(
      rows.map((r) => ({
        deviceId: r.id,
        userId: auth.userId,
        text: `${label}: ${r.value} → ${to} (merged)`,
        project: field === "customer" ? to : null,
      })),
    ),
    ...projectSteps,
  ]);
  if (field === "customer") await ensureProjects(auth.workspaceId, [to]);

  revalidatePath("/app", "layout");
  return { ok: true, changed: rows.length };
}

const receiveSchema = z.object({
  name: z.string().trim().min(1, "Model name is required").max(120, "Name: max 120 characters"),
  category: z.enum(CATEGORIES, "Pick a valid type"),
  locationId: z.union([z.string().uuid(), z.literal("")]).nullish().transform((v) => v || null),
  serials: z
    .array(z.string().trim().min(1).max(120))
    .min(1, "Scan at least one serial")
    .max(MAX_DEVICES_PER_WORKSPACE),
});

/** Receive stock: one model, many scanned serials, all added In Stock in one go (all or nothing). */
export async function receiveDevices(
  workspaceId: unknown,
  input: unknown,
): Promise<ActionResult<{ added: number }>> {
  const auth = await authorize(workspaceId, "editor");
  if (!auth.ok) return auth;
  const parsed = receiveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { name, category, serials } = parsed.data;
  const place = await resolvePlace(auth.workspaceId, { locationId: parsed.data.locationId });
  if (!place.ok) return place;
  const { locationId, location } = place;

  const keys = serials.map((s) => s.toLowerCase());
  if (new Set(keys).size !== keys.length) return { ok: false, error: "The list has the same serial twice." };

  const db = getDb();
  const existing = await db
    .select({ serial: devices.serial })
    .from(devices)
    .where(and(eq(devices.workspaceId, auth.workspaceId), isNotNull(devices.serial)));
  const taken = new Set(existing.map((r) => (r.serial as string).trim().toLowerCase()));
  const dupes = serials.filter((s) => taken.has(s.toLowerCase()));
  if (dupes.length)
    return { ok: false, error: `Already in this workspace: ${dupes.slice(0, 5).join(", ")}${dupes.length > 5 ? "…" : ""}` };

  const n = await countDevices(auth.workspaceId);
  if (n + serials.length > MAX_DEVICES_PER_WORKSPACE)
    return {
      ok: false,
      error: `That would exceed the ${MAX_DEVICES_PER_WORKSPACE}-device limit: this workspace has ${n}, and only ${Math.max(MAX_DEVICES_PER_WORKSPACE - n, 0)} slot(s) are left.`,
    };

  const rows = serials.map((serial) => ({
    id: crypto.randomUUID(),
    workspaceId: auth.workspaceId,
    userId: auth.userId,
    name,
    serial,
    category,
    status: "Available" as const,
    locationId,
    location,
  }));
  await db.batch([
    db.insert(devices).values(rows),
    db
      .insert(deviceHistory)
      .values(rows.map((r) => ({ deviceId: r.id, userId: auth.userId, text: `Received into stock${location ? ` (${location})` : ""}` }))),
  ]);

  revalidatePath("/app", "layout");
  return { ok: true, added: rows.length };
}

/** Low-stock threshold for a model; null or 0 removes it. */
export async function setMinStock(workspaceId: unknown, name: unknown, min: unknown): Promise<ActionResult> {
  const auth = await authorize(workspaceId, "editor");
  if (!auth.ok) return auth;
  const n = z.string().trim().min(1).max(120).safeParse(name);
  if (!n.success) return { ok: false, error: "Invalid model." };
  const m = z.coerce.number().int("Whole numbers only").min(0).max(1000, "Max 1000").nullable().safeParse(min);
  if (!m.success) return { ok: false, error: m.error.issues[0]?.message ?? "Invalid number." };

  const db = getDb();
  const key = modelKey(n.data);
  if (!m.data) {
    await db
      .delete(stockMinimums)
      .where(and(eq(stockMinimums.workspaceId, auth.workspaceId), eq(stockMinimums.modelKey, key)));
  } else {
    await db
      .insert(stockMinimums)
      .values({ workspaceId: auth.workspaceId, modelKey: key, minStock: m.data })
      .onConflictDoUpdate({ target: [stockMinimums.workspaceId, stockMinimums.modelKey], set: { minStock: m.data } });
  }
  revalidatePath("/app", "layout");
  return { ok: true };
}
