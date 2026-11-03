"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { authorize } from "@/lib/access";
import { getDb } from "@/lib/db";
import { devices, projects, workspaceMembers } from "@/lib/schema";
import { renameProjectStatements } from "@/lib/projects";
import { PROJECT_STATUSES } from "@/lib/projectTypes";
import { idSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);
const dateOpt = z
  .union([z.iso.date("Use a valid date"), z.literal("")])
  .nullish()
  .transform((v) => v || null);

const projectSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(200, "Name: max 200 characters"),
    status: z.enum(PROJECT_STATUSES),
    city: opt(80),
    company: opt(200),
    address: opt(500),
    attnName: opt(120),
    attnPhone: opt(40),
    picUserId: opt(100),
    startDate: dateOpt,
    endDate: dateOpt,
    notes: opt(2000),
  })
  .refine((p) => !p.startDate || !p.endDate || p.endDate >= p.startDate, "End date can't be before the start date");

const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid input.";

/** The PIC must be a member of this workspace. */
async function checkPic(workspaceId: string, userId: string | null): Promise<boolean> {
  if (!userId) return true;
  const [m] = await getDb()
    .select({ u: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
  return !!m;
}

export async function createProject(workspaceId: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  const a = await authorize(workspaceId, "editor");
  if (!a.ok) return a;
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  if (!(await checkPic(a.workspaceId, parsed.data.picUserId))) return { ok: false, error: "The PIC must be a team member." };

  const [row] = await getDb()
    .insert(projects)
    .values({ ...parsed.data, workspaceId: a.workspaceId })
    .onConflictDoNothing({ target: [projects.workspaceId, projects.name] })
    .returning({ id: projects.id });
  if (!row) return { ok: false, error: "A project with that name already exists." };
  revalidatePath("/app", "layout");
  return { ok: true, id: row.id };
}

/** Edit details. A rename also renames the customer on every device and history entry. */
export async function updateProject(workspaceId: unknown, id: unknown, input: unknown): Promise<ActionResult> {
  const a = await authorize(workspaceId, "editor");
  if (!a.ok) return a;
  const pid = idSchema.safeParse(id);
  if (!pid.success) return { ok: false, error: "Invalid project." };
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  if (!(await checkPic(a.workspaceId, parsed.data.picUserId))) return { ok: false, error: "The PIC must be a team member." };

  const db = getDb();
  const where = and(eq(projects.id, pid.data), eq(projects.workspaceId, a.workspaceId));
  const [existing] = await db.select({ name: projects.name }).from(projects).where(where);
  if (!existing) return { ok: false, error: "Project not found." };

  const { name, ...details } = parsed.data;
  if (name === existing.name) {
    await db.update(projects).set(details).where(where);
  } else {
    const [clash] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.workspaceId, a.workspaceId), eq(projects.name, name)));
    if (clash) return { ok: false, error: "Another project already has that name. Use Data cleanup to merge them." };
    await db.batch([
      db.update(projects).set(details).where(where),
      ...(await renameProjectStatements(a.workspaceId, [existing.name], name)),
      db
        .update(devices)
        .set({ customer: name, updatedAt: new Date() })
        .where(and(eq(devices.workspaceId, a.workspaceId), eq(devices.customer, existing.name))),
    ]);
  }
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Only projects with nothing there now can be deleted; their history stays on the devices. */
export async function deleteProject(workspaceId: unknown, id: unknown): Promise<ActionResult> {
  const a = await authorize(workspaceId, "editor");
  if (!a.ok) return a;
  const pid = idSchema.safeParse(id);
  if (!pid.success) return { ok: false, error: "Invalid project." };
  const db = getDb();
  const where = and(eq(projects.id, pid.data), eq(projects.workspaceId, a.workspaceId));
  const [p] = await db.select({ name: projects.name }).from(projects).where(where);
  if (!p) return { ok: false, error: "Project not found." };
  const [busy] = await db
    .select({ id: devices.id })
    .from(devices)
    .where(and(eq(devices.workspaceId, a.workspaceId), eq(devices.customer, p.name)))
    .limit(1);
  if (busy) return { ok: false, error: "Devices are still assigned to this project. Return them first, or mark it Done." };
  await db.delete(projects).where(where);
  revalidatePath("/app", "layout");
  return { ok: true };
}
