// Server-only: stock opname reads. Callers pass a workspace id from getAppContext().
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "./db";
import { stockCountScans, stockCounts, users } from "./schema";
import type { CountDetail, CountRow, CountScan } from "./countTypes";

type DbCount = typeof stockCounts.$inferSelect;

const base = (c: DbCount, startedBy: string | null) => ({
  id: c.id,
  locationId: c.locationId,
  scope: c.scope,
  status: c.status,
  note: c.note,
  startedBy,
  startedAt: c.startedAt.toISOString(),
  finishedAt: c.finishedAt?.toISOString() ?? null,
  closedAt: c.closedAt?.toISOString() ?? null,
});

export async function listCounts(workspaceId: string): Promise<CountRow[]> {
  const db = getDb();
  const rows = await db
    .select({ c: stockCounts, by: users.name, scanned: sql<number>`(select count(*)::int from ${stockCountScans} where ${stockCountScans.countId} = ${stockCounts.id})` })
    .from(stockCounts)
    .leftJoin(users, eq(users.id, stockCounts.startedBy))
    .where(eq(stockCounts.workspaceId, workspaceId))
    .orderBy(desc(stockCounts.startedAt))
    .limit(100);
  return rows.map((r) => ({ ...base(r.c, r.by), expected: r.c.expected.length, scanned: r.scanned }));
}

async function scansFor(countIds: string[]): Promise<Map<string, CountScan[]>> {
  const out = new Map<string, CountScan[]>();
  if (!countIds.length) return out;
  const rows = await getDb()
    .select({ s: stockCountScans, by: users.name })
    .from(stockCountScans)
    .leftJoin(users, eq(users.id, stockCountScans.scannedBy))
    .where(inArray(stockCountScans.countId, countIds))
    .orderBy(desc(stockCountScans.scannedAt));
  for (const { s, by } of rows) {
    const list = out.get(s.countId) ?? [];
    list.push({ id: s.id, serial: s.serial, deviceId: s.deviceId, model: s.model, by, scannedAt: s.scannedAt.toISOString() });
    out.set(s.countId, list);
  }
  return out;
}

export async function getCount(workspaceId: string, id: string): Promise<CountDetail | null> {
  const [row] = await getDb()
    .select({ c: stockCounts, by: users.name })
    .from(stockCounts)
    .leftJoin(users, eq(users.id, stockCounts.startedBy))
    .where(and(eq(stockCounts.workspaceId, workspaceId), eq(stockCounts.id, id)));
  if (!row) return null;
  const scans = await scansFor([id]);
  return { ...base(row.c, row.by), expected: row.c.expected, scans: scans.get(id) ?? [] };
}

/** Counts still scanning or in review (for the dashboard nudge). */
export async function listActiveCounts(workspaceId: string): Promise<CountDetail[]> {
  const rows = await getDb()
    .select({ c: stockCounts, by: users.name })
    .from(stockCounts)
    .leftJoin(users, eq(users.id, stockCounts.startedBy))
    .where(and(eq(stockCounts.workspaceId, workspaceId), ne(stockCounts.status, "closed")))
    .orderBy(asc(stockCounts.startedAt));
  const scans = await scansFor(rows.map((r) => r.c.id));
  return rows.map((r) => ({ ...base(r.c, r.by), expected: r.c.expected, scans: scans.get(r.c.id) ?? [] }));
}
