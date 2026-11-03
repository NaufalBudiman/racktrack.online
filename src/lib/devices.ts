// Server-only reads shared by the dashboard pages. Callers pass a workspace id from getAppContext().
import { and, asc, count, desc, eq, isNotNull } from "drizzle-orm";
import { getDb } from "./db";
import { deviceHistory, devices, locations, projects, stockMinimums, users } from "./schema";
import { sortPlaces, type Place } from "./places";
import type { DeviceRow, HistoryItem } from "./types";

type DbDevice = typeof devices.$inferSelect;

export function toDeviceRow({ userId: _u, workspaceId: _w, createdAt, updatedAt, ...rest }: DbDevice): DeviceRow {
  return { ...rest, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() };
}

export async function listDevices(workspaceId: string): Promise<DeviceRow[]> {
  const rows = await getDb()
    .select()
    .from(devices)
    .where(eq(devices.workspaceId, workspaceId))
    .orderBy(asc(devices.name), asc(devices.serial));
  return rows.map(toDeviceRow);
}

export async function getDevice(workspaceId: string, id: string): Promise<DeviceRow | null> {
  const [row] = await getDb()
    .select()
    .from(devices)
    .where(and(eq(devices.id, id), eq(devices.workspaceId, workspaceId)));
  return row ? toDeviceRow(row) : null;
}

export async function categoryCounts(workspaceId: string): Promise<Record<string, number>> {
  const rows = await getDb()
    .select({ category: devices.category, n: count() })
    .from(devices)
    .where(eq(devices.workspaceId, workspaceId))
    .groupBy(devices.category);
  return Object.fromEntries(rows.map((r) => [r.category, r.n]));
}

/** Newest first. Pass deviceId for one device's timeline. */
export async function listHistory(
  workspaceId: string,
  { deviceId, project, limit }: { deviceId?: string; project?: string; limit: number },
): Promise<HistoryItem[]> {
  const rows = await getDb()
    .select({
      id: deviceHistory.id,
      text: deviceHistory.text,
      createdAt: deviceHistory.createdAt,
      deviceId: devices.id,
      deviceName: devices.name,
      userName: users.name,
      userEmail: users.email,
      projectId: projects.id,
      projectName: projects.name,
    })
    .from(deviceHistory)
    .innerJoin(devices, eq(devices.id, deviceHistory.deviceId))
    .leftJoin(users, eq(users.id, deviceHistory.userId))
    .leftJoin(projects, and(eq(projects.workspaceId, workspaceId), eq(projects.name, deviceHistory.project)))
    .where(
      and(
        eq(devices.workspaceId, workspaceId),
        deviceId ? eq(devices.id, deviceId) : undefined,
        project ? eq(deviceHistory.project, project) : undefined,
      ),
    )
    .orderBy(desc(deviceHistory.createdAt))
    .limit(limit);

  return rows.map(({ userName, userEmail, createdAt, projectId, projectName, ...r }) => ({
    ...r,
    project: projectId && projectName ? { id: projectId, name: projectName } : null,
    createdAt: createdAt.toISOString(),
    by: userName ?? userEmail ?? null,
  }));
}

/** Existing customers/projects (most used first), model names and places, for form suggestions. */
export async function listSuggestions(
  workspaceId: string,
): Promise<{ customers: string[]; models: { name: string; category: string }[]; places: Place[] }> {
  const db = getDb();
  const [customers, models, places, active] = await Promise.all([
    db
      .select({ v: devices.customer, n: count() })
      .from(devices)
      .where(and(eq(devices.workspaceId, workspaceId), isNotNull(devices.customer)))
      .groupBy(devices.customer)
      .orderBy(desc(count()))
      .limit(200),
    db
      .select({ name: devices.name, category: devices.category, n: count() })
      .from(devices)
      .where(eq(devices.workspaceId, workspaceId))
      .groupBy(devices.name, devices.category)
      .orderBy(desc(count()))
      .limit(300),
    listPlaces(workspaceId),
    db
      .select({ name: projects.name })
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), eq(projects.status, "active"))),
  ]);
  // Customers already used (most first), then active projects that have no devices yet.
  const used = customers.map((r) => r.v as string);
  const seen = new Set(used);
  return {
    customers: [...used, ...active.map((p) => p.name).filter((n) => !seen.has(n)).sort((a, b) => a.localeCompare(b))],
    models: models.map(({ name, category }) => ({ name, category })),
    places,
  };
}

export async function listPlaces(workspaceId: string): Promise<Place[]> {
  const rows = await getDb()
    .select({ id: locations.id, name: locations.name, parentId: locations.parentId })
    .from(locations)
    .where(eq(locations.workspaceId, workspaceId));
  return sortPlaces(rows);
}

/**
 * Turns a device input's location into { locationId, location label } for this workspace.
 * A locationId (even null) wins; without one, free text (imports) matches a place by name or label,
 * or creates a new site.
 */
export async function resolvePlace(
  workspaceId: string,
  input: { locationId?: string | null; location?: string | null },
): Promise<{ ok: true; locationId: string | null; location: string | null } | { ok: false; error: string }> {
  if (input.locationId === null) return { ok: true, locationId: null, location: null };
  const places = await listPlaces(workspaceId);
  if (input.locationId) {
    const p = places.find((x) => x.id === input.locationId);
    return p ? { ok: true, locationId: p.id, location: p.label } : { ok: false, error: "That location no longer exists." };
  }
  const text = input.location?.trim();
  if (!text) return { ok: true, locationId: null, location: null };
  const hit = places.find((x) => x.label.toLowerCase() === text.toLowerCase() || (!x.parentId && x.name.toLowerCase() === text.toLowerCase()));
  if (hit) return { ok: true, locationId: hit.id, location: hit.label };
  const [created] = await getDb().insert(locations).values({ workspaceId, name: text }).returning({ id: locations.id });
  return { ok: true, locationId: created.id, location: text };
}

export async function listMinimums(workspaceId: string): Promise<Record<string, number>> {
  const rows = await getDb()
    .select({ key: stockMinimums.modelKey, min: stockMinimums.minStock })
    .from(stockMinimums)
    .where(eq(stockMinimums.workspaceId, workspaceId));
  return Object.fromEntries(rows.map((r) => [r.key, r.min]));
}
