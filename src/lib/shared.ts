// Server-only: share link reads. The public page trusts nothing but the token.
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "./db";
import { devices, shareLinks, users, workspaces } from "./schema";
import { listPlaces } from "./devices";
import { placeAndChildren, type Place } from "./places";
import type { PublicDevice, ShareKind, ShareLinkRow } from "./share";

type Target = { kind: ShareKind; target: string | null };

/** Readable title for a link, e.g. "PT Sayap Mas" or "Gudang Bekasi". Null if the target is gone. */
async function titleFor(workspaceId: string, { kind, target }: Target, places?: Place[]): Promise<string | null> {
  if (kind === "all") return "Whole inventory";
  if (!target) return null;
  if (kind === "customer") return target;
  if (kind === "location") return (places ?? (await listPlaces(workspaceId))).find((p) => p.id === target)?.label ?? null;
  const [d] = await getDb()
    .select({ name: devices.name })
    .from(devices)
    .where(and(eq(devices.workspaceId, workspaceId), eq(devices.id, target)));
  return d ? d.name : null;
}

export async function listShareLinks(workspaceId: string): Promise<ShareLinkRow[]> {
  const [rows, places] = await Promise.all([
    getDb()
      .select({ link: shareLinks, byName: users.name, byEmail: users.email })
      .from(shareLinks)
      .leftJoin(users, eq(users.id, shareLinks.createdBy))
      .where(eq(shareLinks.workspaceId, workspaceId))
      .orderBy(desc(shareLinks.createdAt)),
    listPlaces(workspaceId),
  ]);
  return Promise.all(
    rows.map(async ({ link: l, byName, byEmail }) => ({
      id: l.id,
      token: l.token,
      kind: l.kind,
      title: (await titleFor(workspaceId, l, places)) ?? "(deleted)",
      showCustomer: l.showCustomer,
      showSerial: l.showSerial,
      createdAt: l.createdAt.toISOString(),
      expiresAt: l.expiresAt?.toISOString() ?? null,
      views: l.views,
      lastViewedAt: l.lastViewedAt?.toISOString() ?? null,
      by: byName ?? byEmail ?? null,
    })),
  );
}

export type SharedView =
  | { state: "missing" | "expired" }
  | { state: "ok"; kind: ShareKind; title: string; workspace: string; showCustomer: boolean; showSerial: boolean; devices: PublicDevice[] };

/** Everything the public /s/<token> page shows, already stripped to PublicDevice. Counts the view. */
export async function loadShared(token: string): Promise<SharedView> {
  const db = getDb();
  const [row] = await db
    .select({ link: shareLinks, workspace: workspaces.name })
    .from(shareLinks)
    .innerJoin(workspaces, eq(workspaces.id, shareLinks.workspaceId))
    .where(eq(shareLinks.token, token));
  if (!row) return { state: "missing" };
  const { link, workspace } = row;
  if (link.expiresAt && link.expiresAt < new Date()) return { state: "expired" };

  const ws = link.workspaceId;
  const places = link.kind === "location" ? await listPlaces(ws) : undefined;
  const title = await titleFor(ws, link, places);
  if (!title) return { state: "missing" };

  const where =
    link.kind === "customer"
      ? and(eq(devices.workspaceId, ws), eq(devices.customer, link.target ?? ""), inArray(devices.status, ["In Use", "Hilang"]))
      : link.kind === "location"
        ? and(eq(devices.workspaceId, ws), inArray(devices.locationId, [...placeAndChildren(places!, link.target ?? "")]))
        : link.kind === "device"
          ? and(eq(devices.workspaceId, ws), eq(devices.id, link.target ?? ""))
          : eq(devices.workspaceId, ws);

  const [rows] = await Promise.all([
    db.select().from(devices).where(where).orderBy(asc(devices.name), asc(devices.serial)),
    db
      .update(shareLinks)
      .set({ views: sql`${shareLinks.views} + 1`, lastViewedAt: new Date() })
      .where(eq(shareLinks.id, link.id)),
  ]);

  // A customer link always shows its own customer; other links follow the setting.
  const showCustomer = link.kind === "customer" || link.showCustomer;
  return {
    state: "ok",
    kind: link.kind,
    title,
    workspace,
    showCustomer,
    showSerial: link.showSerial,
    devices: rows.map((d) => ({
      id: d.id,
      name: d.name,
      serial: link.showSerial ? d.serial : null,
      category: d.category,
      status: d.status,
      location: d.location,
      rackPosition: d.rackPosition,
      customer: showCustomer ? d.customer : null,
      assignment: d.assignment,
      outDate: d.outDate,
      returnDate: d.returnDate,
    })),
  };
}
