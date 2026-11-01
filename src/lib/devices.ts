// Server-only reads shared by the dashboard pages. Callers pass a workspace id from getAppContext().
import { and, asc, count, desc, eq, isNotNull } from "drizzle-orm";
import { getDb } from "./db";
import { deviceHistory, devices, users } from "./schema";
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
  { deviceId, limit }: { deviceId?: string; limit: number },
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
    })
    .from(deviceHistory)
    .innerJoin(devices, eq(devices.id, deviceHistory.deviceId))
    .leftJoin(users, eq(users.id, deviceHistory.userId))
    .where(
      deviceId
        ? and(eq(devices.workspaceId, workspaceId), eq(devices.id, deviceId))
        : eq(devices.workspaceId, workspaceId),
    )
    .orderBy(desc(deviceHistory.createdAt))
    .limit(limit);

  return rows.map(({ userName, userEmail, createdAt, ...r }) => ({
    ...r,
    createdAt: createdAt.toISOString(),
    by: userName ?? userEmail ?? null,
  }));
}

/** Existing customers and storage locations, most used first, for form suggestions. */
export async function listSuggestions(workspaceId: string): Promise<{ customers: string[]; locations: string[] }> {
  const db = getDb();
  const [customers, locations] = await Promise.all([
    db
      .select({ v: devices.customer, n: count() })
      .from(devices)
      .where(and(eq(devices.workspaceId, workspaceId), isNotNull(devices.customer)))
      .groupBy(devices.customer)
      .orderBy(desc(count()))
      .limit(200),
    db
      .select({ v: devices.location, n: count() })
      .from(devices)
      .where(and(eq(devices.workspaceId, workspaceId), isNotNull(devices.location)))
      .groupBy(devices.location)
      .orderBy(desc(count()))
      .limit(200),
  ]);
  return {
    customers: customers.map((r) => r.v as string),
    locations: locations.map((r) => r.v as string),
  };
}
