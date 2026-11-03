"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { authorize } from "@/lib/access";
import { getDb } from "@/lib/db";
import { devices, projects, receipts, workspaces } from "@/lib/schema";
import { modelKey } from "@/lib/models";
import { getReceiptSettings, nextReceiptSeq } from "@/lib/receipts";
import { DEFAULT_RECEIPT_FORMAT, formatReceiptNumber, type ReceiptItem } from "@/lib/receiptTypes";
import { idSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);
const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid input.";

const receiptSchema = z.object({
  deviceIds: z.array(z.string().uuid()).min(1, "Pick at least one device").max(300),
  date: z.iso.date("Pick a date"),
  number: opt(80),
  city: opt(80),
  senderName: opt(120),
  company: z.string().trim().min(1, "Recipient company is required").max(200),
  address: opt(500),
  attnName: opt(120),
  attnPhone: opt(40),
});

/** Creates a tanda terima for devices of one project; also saves the recipient details on the project. */
export async function createReceipt(workspaceId: unknown, projectId: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  const a = await authorize(workspaceId, "editor");
  if (!a.ok) return a;
  const pid = idSchema.safeParse(projectId);
  if (!pid.success) return { ok: false, error: "Invalid project." };
  const parsed = receiptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { deviceIds, date, company, address, attnName, attnPhone, city, senderName } = parsed.data;

  const db = getDb();
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, pid.data), eq(projects.workspaceId, a.workspaceId)));
  if (!project) return { ok: false, error: "Project not found." };

  const rows = await db
    .select({ id: devices.id, name: devices.name, serial: devices.serial })
    .from(devices)
    .where(and(eq(devices.workspaceId, a.workspaceId), inArray(devices.id, deviceIds)))
    .orderBy(devices.name, devices.serial);
  if (rows.length !== new Set(deviceIds).size) return { ok: false, error: "Some devices no longer exist. Reload and try again." };

  // One line per model, in name order, like the paper form.
  const byModel = new Map<string, ReceiptItem>();
  for (const d of rows) {
    const k = modelKey(d.name);
    const item = byModel.get(k) ?? { name: d.name, serials: [], qty: 0, deviceIds: [] };
    if (d.serial) item.serials.push(d.serial);
    item.qty++;
    item.deviceIds.push(d.id);
    byModel.set(k, item);
  }

  const settings = await getReceiptSettings(a.workspaceId);
  const seq = await nextReceiptSeq(a.workspaceId, date);
  const number = parsed.data.number ?? formatReceiptNumber(settings.receiptFormat || DEFAULT_RECEIPT_FORMAT, date, seq);
  const [clash] = await db
    .select({ id: receipts.id })
    .from(receipts)
    .where(and(eq(receipts.workspaceId, a.workspaceId), eq(receipts.number, number)));
  if (clash) return { ok: false, error: `Number ${number} is already used. Change it and try again.` };

  const id = crypto.randomUUID();
  await db.batch([
    db.insert(receipts).values({
      id,
      workspaceId: a.workspaceId,
      projectId: project.id,
      number,
      seq,
      date,
      city,
      company,
      address,
      attnName,
      attnPhone,
      senderName,
      items: [...byModel.values()],
      createdBy: a.userId,
    }),
    db.update(projects).set({ company, address, attnName, attnPhone }).where(eq(projects.id, project.id)),
  ]);
  revalidatePath(`/app/projects/${project.id}`);
  return { ok: true, id };
}

/** Mark whether the signed photo came back. */
export async function setReceiptSigned(workspaceId: unknown, id: unknown, signed: unknown): Promise<ActionResult> {
  const a = await authorize(workspaceId, "editor");
  if (!a.ok) return a;
  const rid = idSchema.safeParse(id);
  if (!rid.success) return { ok: false, error: "Invalid receipt." };
  await getDb()
    .update(receipts)
    .set({ signedAt: signed === true ? new Date() : null })
    .where(and(eq(receipts.id, rid.data), eq(receipts.workspaceId, a.workspaceId)));
  revalidatePath("/app", "layout");
  revalidatePath(`/receipt/${rid.data}`);
  return { ok: true };
}

export async function deleteReceipt(workspaceId: unknown, id: unknown): Promise<ActionResult> {
  const a = await authorize(workspaceId, "editor");
  if (!a.ok) return a;
  const rid = idSchema.safeParse(id);
  if (!rid.success) return { ok: false, error: "Invalid receipt." };
  await getDb()
    .delete(receipts)
    .where(and(eq(receipts.id, rid.data), eq(receipts.workspaceId, a.workspaceId)));
  revalidatePath("/app", "layout");
  return { ok: true };
}

const MAX_LETTERHEAD = 400_000; // chars of data URL (~290 KB image)
const settingsSchema = z.object({
  companyName: opt(200),
  companyCity: opt(80),
  receiptWa: opt(40),
  receiptFormat: opt(80),
  letterhead: z
    .string()
    .max(MAX_LETTERHEAD, "Letterhead image is too big (max about 290 KB)")
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "Letterhead must be a PNG, JPEG or WebP image")
    .nullish()
    .transform((v) => v || null),
});

/** Admins: letterhead and receipt defaults for this workspace. */
export async function updateReceiptSettings(workspaceId: unknown, input: unknown): Promise<ActionResult> {
  const a = await authorize(workspaceId, "admin");
  if (!a.ok) return a;
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  if (parsed.data.receiptFormat && !/\{N+\}/.test(parsed.data.receiptFormat))
    return { ok: false, error: "The number format needs a running number, e.g. {NNN}." };
  await getDb().update(workspaces).set(parsed.data).where(eq(workspaces.id, a.workspaceId));
  revalidatePath("/app/team");
  return { ok: true };
}
