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
import { deviceStats } from "@/lib/stats";
import type { DeviceRow, HistoryItem } from "@/lib/types";
import { OverdueBadge, isOverdue } from "./DeviceCard";
import { StatusTiles } from "./StatTile";
import { StatusLed } from "./StatusLed";
import { Timeline } from "./Timeline";

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

export function Dashboard({
  devices,
  history,
  workspaceName,
  role,
  canEdit,
}: {
  devices: DeviceRow[];
  history: HistoryItem[];
  workspaceName: string;
  role: Role;
  canEdit: boolean;
}) {
  const [today, setToday] = useState(""); // set after mount to avoid hydration mismatch
  useEffect(() => setToday(localToday()), []);

  const stats = useMemo(() => deviceStats(devices, today), [devices, today]);

  // Overdue loans first (oldest due date first), then missing, then faulty devices.
  const attention = useMemo(() => {
    const overdue = devices
      .filter((d) => isOverdue(d, today))
      .sort((a, b) => (a.returnDate ?? "").localeCompare(b.returnDate ?? ""));
    const missing = devices.filter((d) => d.status === "Hilang");
    const faulty = devices.filter((d) => d.status === "Faulty");
    return [...overdue, ...missing, ...faulty];
  }, [devices, today]);

  const byCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of devices) counts.set(d.category, (counts.get(d.category) ?? 0) + 1);
    return CATEGORIES.filter((c) => counts.get(c)).map((c) => ({ category: c, n: counts.get(c) ?? 0 }));
  }, [devices]);
  const maxCat = Math.max(1, ...byCategory.map((c) => c.n));

  return (
    <div className="space-y-4">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Dashboard · {ROLE_LABELS[role]}</div>
          <h1 className="mt-1.5 break-words font-mono text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{workspaceName}</h1>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Link href="/app/devices?import=1" className="btn-ghost">
              Import
            </Link>
            <Link href="/app/devices?new=1" className="btn-primary">
              + Add device
            </Link>
          </div>
        )}
      </div>

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

          <Panel title="By category">
            <ul className="space-y-2.5">
              {byCategory.map(({ category, n }) => {
                const color = GROUP_COLORS[groupOf(category)];
                return (
                  <li key={category}>
                    <Link href={`/app/devices?type=${encodeURIComponent(category)}`} className="group block">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#BAC3CF] group-hover:text-ink">{categoryLabel(category)}</span>
                        <span className="font-mono text-xs text-[#97A3B3]">{n}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-white/[.06]">
                        <div className="h-full rounded-full" style={{ width: `${(n / maxCat) * 100}%`, background: color }} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      )}

      <Panel
        title="Recent activity"
        action={
          <Link href="/app/activity" className="font-mono text-xs text-[#FFC27A] hover:underline">
            See all →
          </Link>
        }
      >
        <Timeline items={history} showDevice />
      </Panel>
    </div>
  );
}
