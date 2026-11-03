// Server-only: project reads and the bookkeeping that keeps projects in step with devices.customer.
import { and, countDistinct, eq, inArray, isNotNull, max, or } from "drizzle-orm";
import { getDb } from "./db";
import { deviceHistory, devices, projects, shareLinks, users } from "./schema";
import { listHistory, toDeviceRow } from "./devices";
import type { ProjectDetailData, ProjectRow } from "./projectTypes";
import { listReceipts } from "./receipts";

/** Make sure a project row exists for each customer name (devices can be sent to a brand-new customer). */
export async function ensureProjects(workspaceId: string, names: (string | null | undefined)[]) {
  const unique = [...new Set(names.filter((n): n is string => !!n))];
  if (unique.length === 0) return;
  await getDb()
    .insert(projects)
    .values(unique.map((name) => ({ workspaceId, name })))
    .onConflictDoNothing({ target: [projects.workspaceId, projects.name] });
}

/**
 * Rename customer/project `from` names to `to` everywhere: devices, history tags, share links, and the project
 * rows (the `to` row is kept, or the first `from` row is renamed into it). Returns the statements for one batch.
 */
export async function renameProjectStatements(workspaceId: string, from: string[], to: string) {
  const db = getDb();
  const rows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), inArray(projects.name, [...from, to])));
  const keep = rows.find((r) => r.name === to) ?? rows.find((r) => from.includes(r.name));
  const drop = rows.filter((r) => r !== keep).map((r) => r.id);
  const deviceIds = db
    .select({ id: devices.id })
    .from(devices)
    .where(eq(devices.workspaceId, workspaceId));
  return [
    ...(drop.length ? [db.delete(projects).where(inArray(projects.id, drop))] : []),
    ...(keep && keep.name !== to ? [db.update(projects).set({ name: to }).where(eq(projects.id, keep.id))] : []),
    db
      .update(deviceHistory)
      .set({ project: to })
      .where(and(inArray(deviceHistory.project, from), inArray(deviceHistory.deviceId, deviceIds))),
    db
      .update(shareLinks)
      .set({ target: to })
      .where(and(eq(shareLinks.workspaceId, workspaceId), eq(shareLinks.kind, "customer"), inArray(shareLinks.target, from))),
  ] as const;
}

/** All projects with live counts, latest activity first. */
export async function listProjects(workspaceId: string): Promise<ProjectRow[]> {
  const db = getDb();
  const [rows, here, used, last] = await Promise.all([
    db
      .select({ p: projects, picName: users.name, picEmail: users.email })
      .from(projects)
      .leftJoin(users, eq(users.id, projects.picUserId))
      .where(eq(projects.workspaceId, workspaceId)),
    db
      .select({ customer: devices.customer, status: devices.status, assignment: devices.assignment, returnDate: devices.returnDate })
      .from(devices)
      .where(and(eq(devices.workspaceId, workspaceId), isNotNull(devices.customer), inArray(devices.status, ["In Use", "Hilang"]))),
    db
      .select({ project: deviceHistory.project, n: countDistinct(deviceHistory.deviceId) })
      .from(deviceHistory)
      .innerJoin(devices, eq(devices.id, deviceHistory.deviceId))
      .where(and(eq(devices.workspaceId, workspaceId), isNotNull(deviceHistory.project)))
      .groupBy(deviceHistory.project),
    db
      .select({ project: deviceHistory.project, at: max(deviceHistory.createdAt) })
      .from(deviceHistory)
      .innerJoin(devices, eq(devices.id, deviceHistory.deviceId))
      .where(and(eq(devices.workspaceId, workspaceId), isNotNull(deviceHistory.project)))
      .groupBy(deviceHistory.project),
  ]);
  const usedBy = new Map(used.map((r) => [r.project, r.n]));
  const lastBy = new Map(last.map((r) => [r.project, r.at]));

  return rows
    .map(({ p, picName, picEmail }) => {
      const mine = here.filter((d) => d.customer === p.name);
      const now = mine.filter((d) => d.status === "In Use");
      const at = lastBy.get(p.name) ?? null;
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        city: p.city,
        company: p.company,
        address: p.address,
        attnName: p.attnName,
        attnPhone: p.attnPhone,
        pic: picName ?? picEmail ?? null,
        picUserId: p.picUserId,
        startDate: p.startDate,
        endDate: p.endDate,
        notes: p.notes,
        now: now.length,
        missing: mine.length - now.length,
        // History may predate tagging; devices there now always count.
        used: Math.max(usedBy.get(p.name) ?? 0, mine.length),
        overdueCandidates: now
          .filter((d) => d.assignment === "loan" && d.returnDate)
          .map((d) => ({ returnDate: d.returnDate as string })),
        lastActivity: (at ?? p.createdAt).toISOString(),
      };
    })
    .sort((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""));
}

export async function getProject(workspaceId: string, id: string): Promise<ProjectDetailData | null> {
  const all = await listProjects(workspaceId);
  const project = all.find((p) => p.id === id);
  if (!project) return null;

  const db = getDb();
  const touched = db
    .selectDistinct({ id: deviceHistory.deviceId })
    .from(deviceHistory)
    .where(eq(deviceHistory.project, project.name));
  const [rows, history, receiptList] = await Promise.all([
    db
      .select()
      .from(devices)
      .where(
        and(
          eq(devices.workspaceId, workspaceId),
          or(eq(devices.customer, project.name), inArray(devices.id, touched)),
        ),
      )
      .orderBy(devices.name, devices.serial),
    listHistory(workspaceId, { project: project.name, limit: 300 }),
    listReceipts(workspaceId, project.id),
  ]);
  const list = rows.map(toDeviceRow);
  const isHere = (d: (typeof list)[number]) => d.customer === project.name && (d.status === "In Use" || d.status === "Hilang");
  return { project, current: list.filter(isHere), returned: list.filter((d) => !isHere(d)), history, receipts: receiptList };
}

/** Project id for a customer name (device page links). */
export async function projectIdByName(workspaceId: string, name: string | null): Promise<string | null> {
  if (!name) return null;
  const [row] = await getDb()
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.name, name)));
  return row?.id ?? null;
}
