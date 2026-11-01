"use client";

import { useMemo, useState } from "react";
import { GROUP_COLORS, STATUSES, categoryLabel, groupOf, statusLabel, type Status } from "@/lib/categories";
import { isOverdue } from "@/lib/stats";
import type { DeviceRow } from "@/lib/types";
import { OverdueBadge } from "./DeviceCard";
import { StatusLed } from "./StatusLed";

// Same model = same name ignoring case and spacing ("H3C  WA6636" = "h3c wa6636").
export const modelKey = (name: string) => name.toLowerCase().replace(/\s+/g, " ").trim();

type Model = {
  key: string;
  name: string; // most common spelling
  category: string;
  counts: Record<Status, number>; // all units of the model, not just the filtered ones
  total: number;
  units: DeviceRow[]; // units matching the current filters
};

// Shown next to the two big numbers when non-zero.
const MINOR: Status[] = ["Internal", "Faulty", "Hilang", "Retired"];

/** Devices grouped by model name, with stock counts. Click a model to see its units. */
export function ModelList({
  devices,
  filtered,
  today,
  onOpen,
}: {
  devices: DeviceRow[];
  filtered: DeviceRow[];
  today: string;
  onOpen: (id: string) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  const models = useMemo(() => {
    const shown = new Map<string, DeviceRow[]>();
    for (const d of filtered) {
      const k = modelKey(d.name);
      shown.set(k, [...(shown.get(k) ?? []), d]);
    }
    const all = new Map<string, DeviceRow[]>();
    for (const d of devices) {
      const k = modelKey(d.name);
      if (shown.has(k)) all.set(k, [...(all.get(k) ?? []), d]);
    }
    const list: Model[] = [...shown.entries()].map(([key, units]) => {
      const every = all.get(key) ?? units;
      const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
      const names = new Map<string, number>();
      for (const d of every) {
        counts[d.status]++;
        names.set(d.name, (names.get(d.name) ?? 0) + 1);
      }
      const name = [...names.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return { key, name, category: every[0].category, counts, total: every.length, units };
    });
    return list.sort(
      (a, b) => b.counts.Available - a.counts.Available || b.total - a.total || a.name.localeCompare(b.name),
    );
  }, [devices, filtered]);

  function toggle(key: string) {
    const next = new Set(open);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOpen(next);
  }

  return (
    <ul className="lg lg-dark mt-4 divide-y divide-white/[.07] overflow-hidden rounded-[22px]">
      {models.map((m) => {
        const expanded = open.has(m.key);
        const color = GROUP_COLORS[groupOf(m.category)];
        const panelId = `model-${m.key.replace(/[^a-z0-9]/g, "-")}`;
        return (
          <li key={m.key}>
            <button
              type="button"
              onClick={() => toggle(m.key)}
              aria-expanded={expanded}
              aria-controls={panelId}
              className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 text-left transition hover:bg-white/[.04] focus:outline-none focus-visible:bg-white/[.06] sm:flex-nowrap"
            >
              <span className="flex w-full min-w-0 items-center gap-3 sm:w-auto sm:flex-1">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className={`shrink-0 text-[#8E99A8] transition-transform ${expanded ? "rotate-90" : ""}`}
                  aria-hidden
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
                <span className="min-w-0">
                  <span className="block truncate font-mono text-[15px] font-semibold normal-case text-ink">{m.name}</span>
                  <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest" style={{ color }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                    {categoryLabel(m.category)}
                  </span>
                </span>
              </span>

              <span className="flex w-full items-center gap-4 pl-6 sm:w-auto sm:pl-0">
                <span className="mr-auto flex items-center gap-3 sm:mr-0">
                {MINOR.filter((s) => m.counts[s]).map((s) => (
                  <span key={s} className="flex items-center gap-1.5 font-mono text-[11px] text-[#AEB8C5]" title={statusLabel(s)}>
                    <StatusLed status={s} size={6} />
                    {m.counts[s]}
                    <span className="hidden md:inline">{statusLabel(s).toLowerCase()}</span>
                  </span>
                ))}
                </span>
                <span className="w-16 text-right">
                  <span className="block font-mono text-lg font-semibold leading-none text-[#FFE1B8]">{m.counts["In Use"]}</span>
                  <span className="font-mono text-[9.5px] uppercase tracking-wider text-[#97A3B3]">at cust.</span>
                </span>
                <span className="w-16 text-right">
                  <span
                    className={`block font-mono text-2xl font-semibold leading-none ${
                      m.counts.Available ? "text-[#6BE3B0]" : "text-[#8B97A8]"
                    }`}
                  >
                    {m.counts.Available}
                  </span>
                  <span className="font-mono text-[9.5px] uppercase tracking-wider text-[#97A3B3]">in stock</span>
                </span>
                <span className="w-10 text-right font-mono text-xs text-[#97A3B3]">/{m.total}</span>
              </span>
            </button>

            {expanded && (
              <div id={panelId} className="border-t border-white/[.06] bg-black/20 px-4 py-2">
                {m.units.length < m.total && (
                  <p className="py-1.5 font-mono text-[11px] text-[#97A3B3]">
                    Showing {m.units.length} of {m.total} units (filtered)
                  </p>
                )}
                <ul className="divide-y divide-white/[.06]">
                  {[...m.units]
                    .sort((a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) || (a.serial ?? "").localeCompare(b.serial ?? ""))
                    .map((d) => (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => onOpen(d.id)}
                          className="flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg py-2 pl-6 pr-1 text-left text-sm transition hover:bg-white/[.04]"
                        >
                          <span className="min-w-[9rem] font-mono text-[13px] text-ink">{d.serial ?? "no serial"}</span>
                          <span className="flex items-center gap-1.5 text-xs text-[#C3CBD6]">
                            <StatusLed status={d.status} size={6} />
                            {statusLabel(d.status)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs text-[#97A3B3]">
                            {d.status === "In Use" || d.status === "Hilang" ? d.customer : d.location}
                            {d.rackPosition ? ` · ${d.rackPosition}` : ""}
                          </span>
                          {isOverdue(d, today) && <OverdueBadge />}
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
