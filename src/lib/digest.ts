// Server-only: builds the morning email digest for every member who wants one.
import { and, count, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "./db";
import { listDevices, listMinimums } from "./devices";
import { escapeHtml } from "./email";
import { lowStock, type LowStock } from "./models";
import { effectiveDigest, type Digest } from "./roles";
import { deviceHistory, devices, users, workspaceMembers, workspaces } from "./schema";
import { isOverdue } from "./stats";
import type { DeviceRow } from "./types";

const TZ = "Asia/Jakarta";
const DUE_SOON_DAYS = 3;
const LIST_LIMIT = 10;
const SITE = "https://racktrack.online";

export type DigestEmail = { to: string; subject: string; html: string; text: string; workspace: string };

/** YYYY-MM-DD in Jakarta, `offsetDays` from now. */
function jakartaDate(now: Date, offsetDays = 0): string {
  return new Date(now.getTime() + offsetDays * 86_400_000).toLocaleDateString("en-CA", { timeZone: TZ });
}

type Report = {
  overdue: DeviceRow[];
  dueSoon: DeviceRow[];
  low: LowStock[];
  missing: number;
  faulty: number;
  changes: number;
};

const worthSending = (r: Report) => r.overdue.length + r.dueSoon.length + r.low.length + r.changes > 0;

function render(workspace: string, period: Digest, r: Report): { subject: string; html: string; text: string } {
  const parts = [
    r.overdue.length && `${r.overdue.length} overdue`,
    r.dueSoon.length && `${r.dueSoon.length} due soon`,
    r.low.length && `${r.low.length} low stock`,
  ].filter(Boolean);
  const subject = `${workspace}: ${parts.length ? parts.join(", ") : "your RackTrack summary"}`;
  const since = period === "weekly" ? "last 7 days" : "last 24 hours";

  const deviceLine = (d: DeviceRow) => `${d.name}${d.serial ? ` (${d.serial})` : ""} · ${d.customer ?? "—"} · due ${d.returnDate}`;
  const sections: { title: string; items: string[]; more: number; color: string }[] = [
    { title: "Overdue loans", items: r.overdue.slice(0, LIST_LIMIT).map(deviceLine), more: r.overdue.length - LIST_LIMIT, color: "#C2410C" },
    { title: `Due in the next ${DUE_SOON_DAYS} days`, items: r.dueSoon.slice(0, LIST_LIMIT).map(deviceLine), more: r.dueSoon.length - LIST_LIMIT, color: "#B45309" },
    { title: "Low stock", items: r.low.map((m) => `${m.name}: ${m.inStock} in stock (min ${m.min})`), more: 0, color: "#B91C1C" },
  ].filter((s) => s.items.length);

  const facts = [
    `${r.changes} change${r.changes === 1 ? "" : "s"} in the ${since}`,
    r.missing && `${r.missing} missing`,
    r.faulty && `${r.faulty} faulty`,
  ].filter(Boolean) as string[];

  const text = [
    `RackTrack · ${workspace}`,
    "",
    ...sections.flatMap((s) => [s.title.toUpperCase(), ...s.items.map((i) => `- ${i}`), ...(s.more > 0 ? [`- and ${s.more} more`] : []), ""]),
    facts.join(" · "),
    "",
    `Open RackTrack: ${SITE}/app`,
    `Change how often you get this: ${SITE}/app/team`,
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111827">
<div style="max-width:560px;margin:0 auto;padding:24px">
  <div style="font:600 12px ui-monospace,Menlo,monospace;letter-spacing:.12em;color:#B45309;text-transform:uppercase">RackTrack · ${escapeHtml(workspace)}</div>
  <h1 style="font-size:20px;margin:8px 0 16px">${escapeHtml(parts.length ? parts.join(", ") : "Your summary")}</h1>
  ${sections
    .map(
      (s) => `<div style="background:#fff;border-radius:12px;padding:16px;margin-bottom:12px;border-left:4px solid ${s.color}">
    <div style="font-weight:600;margin-bottom:8px">${escapeHtml(s.title)}</div>
    <ul style="margin:0;padding-left:18px;line-height:1.6;font-size:14px">${s.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}${
      s.more > 0 ? `<li style="color:#6B7280">and ${s.more} more</li>` : ""
    }</ul></div>`,
    )
    .join("")}
  <p style="font-size:14px;color:#374151">${escapeHtml(facts.join(" · "))}</p>
  <p><a href="${SITE}/app" style="display:inline-block;background:#F7A23A;color:#1D1104;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:999px">Open RackTrack</a></p>
  <p style="font-size:12px;color:#6B7280">You get this because of your email settings in this workspace. <a href="${SITE}/app/team" style="color:#6B7280">Change or turn off</a>.</p>
</div></body></html>`;

  return { subject, html, text };
}

/** Everything to send right now. Daily members get mail every day, weekly members on Mondays (Jakarta time). */
export async function buildDigests(now = new Date()): Promise<DigestEmail[]> {
  const db = getDb();
  const today = jakartaDate(now);
  const soon = jakartaDate(now, DUE_SOON_DAYS);
  const isMonday = new Date(`${today}T12:00:00Z`).getUTCDay() === 1;

  const members = await db
    .select({
      workspaceId: workspaceMembers.workspaceId,
      workspace: workspaces.name,
      role: workspaceMembers.role,
      digest: workspaceMembers.digest,
      email: users.email,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId));

  const recipients = members
    .map((m) => ({ ...m, period: effectiveDigest(m.role, m.digest) }))
    .filter((m) => m.email && (m.period === "daily" || (m.period === "weekly" && isMonday)));
  const workspaceIds = [...new Set(recipients.map((r) => r.workspaceId))];
  if (workspaceIds.length === 0) return [];

  // History counts for the last day and week, per workspace, in one query each.
  const changesSince = async (since: Date) => {
    const rows = await db
      .select({ ws: devices.workspaceId, n: count() })
      .from(deviceHistory)
      .innerJoin(devices, eq(devices.id, deviceHistory.deviceId))
      .where(and(inArray(devices.workspaceId, workspaceIds), gte(deviceHistory.createdAt, since)))
      .groupBy(devices.workspaceId);
    return new Map(rows.map((r) => [r.ws, r.n]));
  };
  const [day, week] = await Promise.all([
    changesSince(new Date(now.getTime() - 86_400_000)),
    changesSince(new Date(now.getTime() - 7 * 86_400_000)),
  ]);

  const out: DigestEmail[] = [];
  for (const ws of workspaceIds) {
    const [list, minimums] = await Promise.all([listDevices(ws), listMinimums(ws)]);
    const loans = list.filter((d) => d.status === "In Use" && d.assignment === "loan" && d.returnDate);
    const base = {
      overdue: loans.filter((d) => isOverdue(d, today)).sort((a, b) => (a.returnDate! < b.returnDate! ? -1 : 1)),
      dueSoon: loans.filter((d) => d.returnDate! >= today && d.returnDate! <= soon).sort((a, b) => (a.returnDate! < b.returnDate! ? -1 : 1)),
      low: lowStock(list, minimums),
      missing: list.filter((d) => d.status === "Hilang").length,
      faulty: list.filter((d) => d.status === "Faulty").length,
    };
    for (const r of recipients.filter((x) => x.workspaceId === ws)) {
      const report = { ...base, changes: (r.period === "weekly" ? week : day).get(ws) ?? 0 };
      if (!worthSending(report)) continue;
      out.push({ to: r.email as string, workspace: r.workspace, ...render(r.workspace, r.period, report) });
    }
  }
  return out;
}
