"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CATEGORY_GROUPS,
  GROUPS,
  MAX_DEVICES_PER_ACCOUNT,
  STATUSES,
  STATUS_COLORS,
  groupOf,
  type Group,
  type Status,
} from "@/lib/categories";
import type { DeviceRow } from "@/lib/types";
import { DeviceCard, isOverdue } from "./DeviceCard";
import { DeviceDrawer } from "./DeviceDrawer";
import { ImportDialog } from "./ImportDialog";
import { StatusLed } from "./StatusLed";

function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type Selected = { id: string } | "new" | null;

export function Inventory({ devices }: { devices: DeviceRow[] }) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<Group | "All">("All");
  const [type, setType] = useState<string>("All");
  const [status, setStatus] = useState<Status | "All">("All");
  const [selected, setSelected] = useState<Selected>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [today, setToday] = useState(""); // set after mount to avoid hydration mismatch

  useEffect(() => setToday(localToday()), []);

  const stats = useMemo(() => {
    const s = { total: devices.length, Available: 0, "In Use": 0, Hilang: 0, overdue: 0 };
    for (const d of devices) {
      s[d.status]++;
      if (isOverdue(d, today)) s.overdue++;
    }
    return s;
  }, [devices, today]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return devices.filter((d) => {
      if (group !== "All" && groupOf(d.category) !== group) return false;
      if (type !== "All" && d.category !== type) return false;
      if (status !== "All" && d.status !== status) return false;
      if (needle) {
        const hay = [d.name, d.serial, d.customer, d.location];
        if (!hay.some((v) => v?.toLowerCase().includes(needle))) return false;
      }
      return true;
    });
  }, [devices, q, group, type, status]);

  const typeOptions: readonly string[] =
    group === "All" ? GROUPS.flatMap((g) => CATEGORY_GROUPS[g]) : CATEGORY_GROUPS[group];

  const atLimit = devices.length >= MAX_DEVICES_PER_ACCOUNT;
  const selectedDevice = selected && selected !== "new" ? devices.find((d) => d.id === selected.id) ?? null : null;
  const filtersActive = q !== "" || group !== "All" || type !== "All" || status !== "All";

  function resetFilters() {
    setQ("");
    setGroup("All");
    setType("All");
    setStatus("All");
  }

  const cards: { key: "All" | Status; label: string; value: number; sub?: string }[] = [
    { key: "All", label: "Total", value: stats.total, sub: `of ${MAX_DEVICES_PER_ACCOUNT}` },
    { key: "Available", label: "Available", value: stats.Available },
    {
      key: "In Use",
      label: "In Use",
      value: stats["In Use"],
      sub: stats.overdue ? `${stats.overdue} overdue` : undefined,
    },
    { key: "Hilang", label: "Hilang", value: stats.Hilang },
  ];

  return (
    <div>
      {/* stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => {
          const active = status === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setStatus(c.key === "All" || active ? "All" : c.key)}
              aria-pressed={active}
              className={`relative rounded-md border bg-surface p-4 text-left transition hover:bg-surface2 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber ${
                active ? "border-amber" : "border-line"
              }`}
            >
              <span className="rivet left-1.5 top-1.5" />
              <span className="rivet right-1.5 top-1.5" />
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted">
                {c.key !== "All" && <StatusLed status={c.key} />}
                {c.label}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className="font-mono text-3xl font-semibold"
                  style={{ color: c.key === "All" ? undefined : STATUS_COLORS[c.key] }}
                >
                  {c.value}
                </span>
                {c.sub && (
                  <span className={`font-mono text-[11px] ${c.sub.includes("overdue") ? "text-red" : "text-muted"}`}>
                    {c.sub}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* toolbar */}
      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, serial, customer, location…"
          aria-label="Search devices"
          className="input lg:max-w-sm"
        />
        <div className="grid grid-cols-3 gap-2 lg:flex">
          <select
            aria-label="Group"
            className="input lg:w-40"
            value={group}
            onChange={(e) => {
              setGroup(e.target.value as Group | "All");
              setType("All");
            }}
          >
            <option value="All">All groups</option>
            {GROUPS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <select aria-label="Type" className="input lg:w-44" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="All">All types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            aria-label="Status"
            className="input lg:w-36"
            value={status}
            onChange={(e) => setStatus(e.target.value as Status | "All")}
          >
            <option value="All">All status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 lg:ml-auto">
          <button type="button" className="btn-ghost flex-1 lg:flex-none" onClick={() => setImportOpen(true)}>
            Import
          </button>
          <button
            type="button"
            className="btn-primary flex-1 lg:flex-none"
            onClick={() => setSelected("new")}
            disabled={atLimit}
            title={atLimit ? `Limit of ${MAX_DEVICES_PER_ACCOUNT} devices reached` : undefined}
          >
            + Add device
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between font-mono text-xs text-muted">
        <span>
          Showing {filtered.length} of {devices.length}
        </span>
        {filtersActive && (
          <button type="button" onClick={resetFilters} className="text-amber hover:underline">
            Clear filters
          </button>
        )}
      </div>
      {atLimit && (
        <p className="mt-3 rounded border border-amber/50 bg-amber/10 px-3 py-2 text-sm text-amber">
          You have reached the limit of {MAX_DEVICES_PER_ACCOUNT} devices. Delete some to add more.
        </p>
      )}

      {/* grid */}
      {devices.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed border-line p-10 text-center">
          <h2 className="font-mono text-lg font-semibold">Your rack is empty</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Add your first device, or import an existing .xlsx / .csv inventory.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button className="btn-primary" onClick={() => setSelected("new")}>+ Add device</button>
            <button className="btn-ghost" onClick={() => setImportOpen(true)}>Import</button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">No devices match your filters.</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((d) => (
            <DeviceCard
              key={d.id}
              device={d}
              overdue={isOverdue(d, today)}
              onOpen={() => setSelected({ id: d.id })}
            />
          ))}
        </div>
      )}

      {selected && (selected === "new" || selectedDevice) && (
        <DeviceDrawer
          key={selected === "new" ? "new" : selected.id}
          device={selectedDevice}
          overdue={selectedDevice ? isOverdue(selectedDevice, today) : false}
          onClose={() => setSelected(null)}
        />
      )}
      {importOpen && <ImportDialog currentCount={devices.length} onClose={() => setImportOpen(false)} />}
    </div>
  );
}
