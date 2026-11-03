"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CATEGORIES,
  GROUP_COLORS,
  categoryLabel,
  groupOf,
  statusLabel,
} from "@/lib/categories";
import { ROLE_LABELS, canManageMembers, type Role } from "@/lib/roles";
import { customerRows, deviceStats } from "@/lib/stats";
import { lowStock } from "@/lib/models";
import type { CountStatus } from "@/lib/countTypes";
import type { DeviceRow, HistoryItem } from "@/lib/types";
import { OverdueBadge, isOverdue } from "./DeviceCard";
import { StatusTiles } from "./StatTile";
import { StatusLed } from "./StatusLed";
import { Timeline } from "./Timeline";
import { nudgeCount, readDismissed } from "./CleanupView";

function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="lg lg-dark rounded-[22px] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-mono text-sm font-semibold tracking-wider">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const ATTENTION_LIMIT = 8;
const CUSTOMER_LIMIT = 8;

const TONES = {
  green: { eyebrow: "text-[#6BE3B0]", count: "text-[#6BE3B0]", rim: "shadow-[inset_0_2px_0_rgba(79,209,153,.55)]" },
  amber: { eyebrow: "text-[#FFC27A]", count: "text-[#FFE1B8]", rim: "shadow-[inset_0_2px_0_rgba(239,155,62,.65)]" },
};

/** One of the two main dashboard panels: what's ready vs what's out. */
function BigPanel({
  tone,
  eyebrow,
  title,
  count,
  unit,
  href,
  children,
}: {
  tone: keyof typeof TONES;
  eyebrow: string;
  title: string;
  count: number;
  unit: string;
  href: string;
  children: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <section className={`lg lg-dark rounded-[22px] p-5 ${t.rim}`}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className={`eyebrow ${t.eyebrow}`}>{eyebrow}</div>
          <h2 className="mt-1 font-mono text-lg font-semibold">{title}</h2>
          <Link href={href} className="mt-1 inline-block font-mono text-xs text-[#AEB8C5] hover:text-ink hover:underline">
            View all →
          </Link>
        </div>
        <div className="text-right">
          <div className={`font-mono text-4xl font-semibold leading-none ${t.count}`}>{count}</div>
          <div className="mt-1 font-mono text-[11px] text-[#97A3B3]">{unit}</div>
        </div>
      </div>
      {children}
    </section>
  );
}

export function Dashboard({
  devices,
  history,
  minimums,
  counts = [],
  workspaceId,
  workspaceName,
  role,
  canEdit,
}: {
  devices: DeviceRow[];
  history: HistoryItem[];
  minimums: Record<string, number>;
  counts?: { id: string; scope: string; status: CountStatus; found: number; expected: number; open: number }[];
  workspaceId: string;
  workspaceName: string;
  role: Role;
  canEdit: boolean;
}) {
  const [today, setToday] = useState(""); // set after mount to avoid hydration mismatch
  useEffect(() => setToday(localToday()), []);

  const stats = useMemo(() => deviceStats(devices, today), [devices, today]);
  const [toClean, setToClean] = useState(0); // needs localStorage, so computed after mount
  useEffect(() => setToClean(nudgeCount(devices, readDismissed(workspaceId))), [devices, workspaceId]);

  // Overdue loans first (oldest due date first), then missing, then faulty devices.
  const attention = useMemo(() => {
    const overdue = devices
      .filter((d) => isOverdue(d, today))
      .sort((a, b) => (a.returnDate ?? "").localeCompare(b.returnDate ?? ""));
    const missing = devices.filter((d) => d.status === "Hilang");
    const faulty = devices.filter((d) => d.status === "Faulty");
    return [...overdue, ...missing, ...faulty];
  }, [devices, today]);

  // Ready to use = in stock. Internal/faulty devices are not available, so they're left out.
  const stock = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of devices) if (d.status === "Available") counts.set(d.category, (counts.get(d.category) ?? 0) + 1);
    return CATEGORIES.filter((c) => counts.get(c)).map((c) => ({ category: c, n: counts.get(c) ?? 0 }));
  }, [devices]);
  const maxStock = Math.max(1, ...stock.map((c) => c.n));
  const low = useMemo(() => lowStock(devices, minimums), [devices, minimums]);

  // Customers holding devices right now (missing-only customers live on the Customers page).
  const customers = useMemo(() => customerRows(devices, today).filter((c) => c.total > 0), [devices, today]);
  const [allCustomers, setAllCustomers] = useState(false);
  const shownCustomers = allCustomers ? customers : customers.slice(0, CUSTOMER_LIMIT);
  const notReady = [
    stats.Internal && `${stats.Internal} internal use`,
    stats.Faulty && `${stats.Faulty} faulty`,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Dashboard · {ROLE_LABELS[role]}</div>
          <h1 className="mt-1.5 break-words font-mono text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{workspaceName}</h1>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {/* phones have no sidebar entry for it */}
            <Link href="/app/opname" className="btn-ghost lg:hidden">
              Opname
            </Link>
            <Link href="/app/devices?import=1" className="btn-ghost">
              Import
            </Link>
            <Link href="/app/devices?new=1" className="btn-primary">
              + Add device
            </Link>
          </div>
        )}
      </div>

      {counts.map((c) => (
        <Link
          key={c.id}
          href={`/app/opname/${c.id}`}
          className="flex items-center justify-between gap-3 rounded-xl bg-cyan/10 px-4 py-2.5 text-sm text-[#BDEFF8] shadow-[inset_0_0_0_1px_rgba(93,201,224,.45)] transition hover:bg-cyan/15"
        >
          <span>
            {c.status === "open"
              ? `Stock opname at ${c.scope} in progress: ${c.found} of ${c.expected} found.`
              : c.open
                ? `Stock opname at ${c.scope}: ${c.open} item${c.open === 1 ? "" : "s"} still unclear.`
                : `Stock opname at ${c.scope} is sorted out. Close it.`}
          </span>
          <span className="shrink-0 font-mono text-xs text-[#8FE3F2]">{c.status === "open" ? "Continue →" : "Review →"}</span>
        </Link>
      ))}

      {toClean > 0 && (
        <Link
          href="/app/cleanup"
          className="flex items-center justify-between gap-3 rounded-xl bg-amber/10 px-4 py-2.5 text-sm text-[#FFE1B8] shadow-[inset_0_0_0_1px_rgba(239,155,62,.45)] transition hover:bg-amber/15"
        >
          <span>
            {toClean} record{toClean === 1 ? "" : "s"} look inconsistent (leftover customer details or look-alike names).
          </span>
          <span className="shrink-0 font-mono text-xs text-[#FFC27A]">Review →</span>
        </Link>
      )}

      <StatusTiles
        stats={stats}
        hrefFor={(k) => (k === "All" ? "/app/devices" : `/app/devices?status=${encodeURIComponent(k)}`)}
      />

      {devices.length === 0 ? (
        <Panel title="Get started">
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              ["Add devices", "One by one, or import your .xlsx / .csv sheet.", "/app/devices?new=1", canEdit],
              ["Invite your team", "Share this inventory as Admin, Editor or Viewer.", "/app/team", canManageMembers(role)],
              ["Track changes", "Status, location and customer changes show up in Activity.", "/app/activity", true],
            ].map(([t, b, href, show], i) =>
              show ? (
                <li key={t as string}>
                  <Link href={href as string} className="block h-full rounded-xl bg-black/20 p-4 transition hover:bg-white/[.06]">
                    <div className="font-mono text-xs text-[#FFC27A]">0{i + 1}</div>
                    <div className="mt-1 font-mono text-sm font-semibold">{t}</div>
                    <p className="mt-1 text-sm text-[#BAC3CF]">{b}</p>
                  </Link>
                </li>
              ) : null,
            )}
          </ol>
        </Panel>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <BigPanel
              tone="green"
              eyebrow="Ready to use"
              title="In stock"
              count={stats.Available}
              unit="devices ready"
              href="/app/devices?status=Available"
            >
              {low.length > 0 && (
                <ul className="mb-4 space-y-1.5 rounded-xl bg-red/10 p-3 shadow-[inset_0_0_0_1px_rgba(240,102,76,.4)]">
                  {low.map((m) => (
                    <li key={m.key}>
                      <Link
                        href={`/app/devices?q=${encodeURIComponent(m.name)}`}
                        className="flex items-center justify-between gap-3 text-sm hover:underline"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 rounded-md bg-red/25 px-1.5 py-px font-mono text-[10px] font-semibold uppercase tracking-wider text-[#FFB3A6]">
                            Low
                          </span>
                          <span className="truncate font-mono normal-case text-ink">{m.name}</span>
                        </span>
                        <span className="shrink-0 font-mono text-xs text-[#FFB3A6]">
                          {m.inStock} / min {m.min}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {stock.length === 0 ? (
                <p className="text-sm text-[#AEB8C5]">Nothing in stock right now.</p>
              ) : (
                <ul className="space-y-2.5">
                  {stock.map(({ category, n }) => (
                    <li key={category}>
                      <Link href={`/app/devices?status=Available&type=${encodeURIComponent(category)}`} className="group block">
                        <div className="flex justify-between text-sm">
                          <span className="text-[#BAC3CF] group-hover:text-ink">{categoryLabel(category)}</span>
                          <span className="font-mono text-xs text-[#6BE3B0]">{n} ready</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-white/[.06]">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${(n / maxStock) * 100}%`, background: GROUP_COLORS[groupOf(category)] }}
                          />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {notReady.length > 0 && (
                <p className="mt-4 border-t border-white/10 pt-3 text-xs text-[#97A3B3]">Not counted as ready: {notReady.join(" · ")}.</p>
              )}
            </BigPanel>

            <BigPanel
              tone="amber"
              eyebrow="Out in the field"
              title="At projects"
              count={stats["In Use"]}
              unit={`devices at ${customers.length} project${customers.length === 1 ? "" : "s"}`}
              href="/app/projects"
            >
              {customers.length === 0 ? (
                <p className="text-sm text-[#AEB8C5]">No devices at customers.</p>
              ) : (
                <>
                  <ul className="divide-y divide-white/10">
                    {shownCustomers.map((c) => (
                      <li key={c.name}>
                        <Link
                          href={`/app/devices?status=In+Use&customer=${encodeURIComponent(c.name)}`}
                          className="flex items-center gap-3 rounded-lg px-1 py-2.5 transition hover:bg-white/[.04]"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm text-ink">{c.name}</div>
                            <div className="truncate font-mono text-[11px] text-[#97A3B3]">
                              {c.loans ? `${c.loans} on loan` : "installed"}
                              {c.nextDue && !c.overdue ? ` · next due ${c.nextDue}` : ""}
                            </div>
                          </div>
                          {c.overdue > 0 && <OverdueBadge />}
                          <span className="w-8 shrink-0 text-right font-mono text-sm text-[#FFE1B8]">{c.total}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {customers.length > CUSTOMER_LIMIT && (
                    <button
                      type="button"
                      onClick={() => setAllCustomers((v) => !v)}
                      className="mt-3 font-mono text-xs text-[#FFC27A] hover:underline"
                    >
                      {allCustomers ? "Show fewer" : `Show all ${customers.length} customers`}
                    </button>
                  )}
                </>
              )}
            </BigPanel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="Needs attention"
              action={
                attention.length > ATTENTION_LIMIT ? (
                  <span className="font-mono text-xs text-[#97A3B3]">
                    {ATTENTION_LIMIT} of {attention.length}
                  </span>
                ) : undefined
              }
            >
              {attention.length === 0 ? (
                <p className="text-sm text-[#AEB8C5]">Nothing overdue, missing or faulty. Nice.</p>
              ) : (
                <ul className="divide-y divide-white/10">
                  {attention.slice(0, ATTENTION_LIMIT).map((d) => (
                    <li key={d.id}>
                      <Link href={`/app/devices/${d.id}`} className="flex items-center gap-3 rounded-lg px-1 py-2.5 transition hover:bg-white/[.04]">
                        <StatusLed status={d.status} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-mono text-sm normal-case text-ink">{d.name}</div>
                          <div className="truncate text-xs text-[#97A3B3]">
                            {d.status === "In Use" ? `${d.customer ?? "No customer"} · due ${d.returnDate}` : statusLabel(d.status)}
                          </div>
                        </div>
                        {d.status === "In Use" && <OverdueBadge />}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              title="Recent activity"
              action={
                <Link href="/app/activity" className="font-mono text-xs text-[#FFC27A] hover:underline">
                  See all →
                </Link>
              }
            >
              <Timeline items={history} showDevice showProject />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
