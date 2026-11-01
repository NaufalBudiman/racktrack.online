"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { authorize } from "@/lib/access";
import { getDb } from "@/lib/db";
import { listPlaces } from "@/lib/devices";
import { placeLabel } from "@/lib/places";
import { devices, locations } from "@/lib/schema";
import { idSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

const nameSchema = z.string().trim().min(1, "Name is required").max(80, "Name: max 80 characters");
const err = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid input.";

function done() {
  revalidatePath("/app", "layout");
  return { ok: true } as const;
}

/** New site (no parent) or spot inside a site. Names are unique among siblings, ignoring case. */
export async function createPlace(workspaceId: unknown, name: unknown, parentId: unknown): Promise<ActionResult> {
  const a = await authorize(workspaceId, "editor");
  if (!a.ok) return a;
  const n = nameSchema.safeParse(name);
  if (!n.success) return { ok: false, error: err(n.error) };

  const places = await listPlaces(a.workspaceId);
  let parent: string | null = null;
  if (parentId) {
    const p = idSchema.safeParse(parentId);
    const site = p.success ? places.find((x) => x.id === p.data) : undefined;
    if (!site) return { ok: false, error: "That site no longer exists." };
    if (site.parentId) return { ok: false, error: "Spots can only go inside a site (two levels)." };
    parent = site.id;
  }
  if (places.some((x) => x.parentId === parent && x.name.toLowerCase() === n.data.toLowerCase()))
    return { ok: false, error: `“${n.data}” already exists here.` };

  await getDb().insert(locations).values({ workspaceId: a.workspaceId, parentId: parent, name: n.data });
  return done();
}

/** Rename, and refresh the stored labels of every device at this place (and inside it, for a site). */
export async function renamePlace(workspaceId: unknown, id: unknown, name: unknown): Promise<ActionResult> {
  const a = await authorize(workspaceId, "editor");
  if (!a.ok) return a;
  const n = nameSchema.safeParse(name);
  if (!n.success) return { ok: false, error: err(n.error) };

  const places = await listPlaces(a.workspaceId);
  const place = places.find((x) => x.id === id);
  if (!place) return { ok: false, error: "That location no longer exists." };
  if (places.some((x) => x.id !== place.id && x.parentId === place.parentId && x.name.toLowerCase() === n.data.toLowerCase()))
    return { ok: false, error: `“${n.data}” already exists here.` };

  const db = getDb();
  const parentName = place.parentId ? places.find((x) => x.id === place.parentId)?.name : null;
  const relabel = [
    { ids: [place.id], label: placeLabel(n.data, parentName) },
    // a renamed site changes its spots' labels too
    ...(place.parentId ? [] : places.filter((x) => x.parentId === place.id).map((c) => ({ ids: [c.id], label: placeLabel(c.name, n.data) }))),
  ];
  await db.batch([
    db.update(locations).set({ name: n.data }).where(and(eq(locations.id, place.id), eq(locations.workspaceId, a.workspaceId))),
    ...relabel.map((r) =>
      db
        .update(devices)
        .set({ location: r.label })
        .where(and(eq(devices.workspaceId, a.workspaceId), inArray(devices.locationId, r.ids))),
    ),
  ]);
  return done();
}

/** Only empty places can go: no devices (including ones out at customers that return here) and no spots. */
export async function deletePlace(workspaceId: unknown, id: unknown): Promise<ActionResult> {
  const a = await authorize(workspaceId, "editor");
  if (!a.ok) return a;
  const places = await listPlaces(a.workspaceId);
  const place = places.find((x) => x.id === id);
  if (!place) return { ok: false, error: "That location no longer exists." };
  if (places.some((x) => x.parentId === place.id)) return { ok: false, error: "Delete or move the spots inside it first." };

  const db = getDb();
  const [row] = await db
    .select({ n: count() })
    .from(devices)
    .where(and(eq(devices.workspaceId, a.workspaceId), eq(devices.locationId, place.id)));
  if ((row?.n ?? 0) > 0) return { ok: false, error: `${row.n} device(s) still belong here. Move them first.` };

  await db.delete(locations).where(and(eq(locations.id, place.id), eq(locations.workspaceId, a.workspaceId)));
  return done();
}
