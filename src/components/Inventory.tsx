"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CATEGORY_GROUPS,
  GROUPS,
  MAX_DEVICES_PER_WORKSPACE,
  STATUSES,
  categoryLabel,
  groupLabel,
  groupOf,
  statusLabel,
  type Group,
  type Status,
} from "@/lib/categories";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import type { DeviceRow } from "@/lib/types";
import { DeviceCard, isOverdue } from "./DeviceCard";
import { DeviceDrawer } from "./DeviceDrawer";
import { ImportDialog } from "./ImportDialog";
import { StatusLed } from "./StatusLed";
import { LiquidGlass } from "./ui/liquid-glass";

function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type Selected = { id: string } | "new" | null;

// Text colors for the big numbers, lighter than the LED colors so they stay readable on glass.
const NUMBER_COLORS: Record<Status, string> = {
  Available: "#6BE3B0",
  "In Use": "#FFE1B8",
  Hilang: "#FF9A86",
};

export function Inventory({
  devices,
  workspaceId,
  workspaceName,
  role,
  canEdit,
}: {
  devices: DeviceRow[];
  workspaceId: string;
  workspaceName: string;
  role: Role;
  canEdit: boolean;
}) {
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

  const atLimit = devices.length >= MAX_DEVICES_PER_WORKSPACE;
  const selectedDevice = selected && selected !== "new" ? devices.find((d) => d.id === selected.id) ?? null : null;
  const filtersActive = q !== "" || group !== "All" || type !== "All" || status !== "All";

  function resetFilters() {
    setQ("");
    setGroup("All");
    setType("All");
    setStatus("All");
  }

  const cards: { key: "All" | Status; label: string; value: number; sub?: string }[] = [
    { key: "All", label: "Total", value: stats.total, sub: `/${MAX_DEVICES_PER_WORKSPACE}` },
    { key: "Available", label: "Available", value: stats.Available },
    {
      key: "In Use",
      label: "In Use",
      value: stats["In Use"],
      sub: stats.overdue ? `· ${stats.overdue} overdue` : undefined,
    },
    { key: "Hilang", label: statusLabel("Hilang"), value: stats.Hilang },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Inventory · {ROLE_LABELS[role]}</div>
          <h1 className="mt-1.5 break-words font-mono text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{workspaceName}</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/app/workspace" className="btn-ghost">
            Team
          </Link>
          {canEdit && (
            <>
              <button type="button" className="btn-ghost" onClick={() => setImportOpen(true)}>
                Import
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setSelected("new")}
                disabled={atLimit}
                title={atLimit ? `Limit of ${MAX_DEVICES_PER_WORKSPACE} devices reached` : undefined}
              >
                + Add device
              </button>
            </>
          )}
        </div>
      </div>

      {/* stat cards (also status filters) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => {
          const active = status === c.key;
          const amber = c.key === "In Use";
          return (
            <LiquidGlass
              key={c.key}
              radius={20}
              scale={22}
              bevelDepth={10}
              aberration={2}
              tint={amber ? 0.02 : 0.07}
              className={`glass-rim ${active ? "outline outline-2 outline-offset-0 outline-amber" : ""}`}
              style={
                amber
                  ? {
                      backgroundColor: "rgba(30,16,4,.55)",
                      backgroundImage: "linear-gradient(160deg, rgba(255,200,120,.32), rgba(245,150,50,.1) 50%, rgba(120,50,0,.15))",
                    }
                  : { backgroundColor: "rgba(10,12,16,.55)" }
              }
            >
              <button
                type="button"
                onClick={() => setStatus(c.key === "All" || active ? "All" : c.key)}
                aria-pressed={active}
                className="block w-full rounded-[20px] px-4 py-3.5 text-left transition hover:bg-white/[.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber"
              >
                <div
                  className={`flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.12em] ${
                    amber ? "text-[#FFE6C6]" : "text-[#C3CBD6]"
                  }`}
                >
                  {c.key !== "All" && <StatusLed status={c.key} />}
                  {c.label}
                </div>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span
                    className="font-mono text-3xl font-semibold"
                    style={{ color: c.key === "All" ? undefined : NUMBER_COLORS[c.key] }}
                  >
                    {c.value}
                  </span>
                  {c.sub && (
                    <span className={`font-mono text-xs ${c.sub.includes("overdue") ? "text-[#FFB3A6]" : "text-[#97A3B3]"}`}>
                      {c.sub}
                    </span>
                  )}
                </div>
              </button>
            </LiquidGlass>
          );
        })}
      </div>

      {/* toolbar */}
      <div className="lg lg-dark mt-4 flex flex-col gap-2.5 rounded-[22px] p-2.5 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E99A8]"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, serial, customer, location…"
            aria-label="Search devices"
            className="input pl-10"
          />
        </div>
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
              <option key={g} value={g}>{groupLabel(g)}</option>
            ))}
          </select>
          <select aria-label="Type" className="input lg:w-48" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="All">All types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>{categoryLabel(t)}</option>
            ))}
          </select>
          <select
            aria-label="Status"
            className="input lg:w-36"
            value={status}
            onChange={(e) => setStatus(e.target.value as Status | "All")}
          >
            <option value="All">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between px-1 font-mono text-xs text-[#AEB8C5]">
        <span>
          Showing {filtered.length} of {devices.length}
        </span>
        {filtersActive && (
          <button type="button" onClick={resetFilters} className="text-[#FFC27A] hover:underline">
            Clear filters
          </button>
        )}
      </div>
      {atLimit && canEdit && (
        <p className="mt-3 rounded-xl bg-amber/15 px-3 py-2 text-sm text-[#FFD9A8] shadow-[inset_0_0_0_1px_rgba(239,155,62,.5)]">
          You have reached the limit of {MAX_DEVICES_PER_WORKSPACE} devices. Delete some to add more.
        </p>
      )}

      {/* grid */}
      {devices.length === 0 ? (
        <div className="lg lg-dark mt-6 p-10 text-center">
          <h2 className="font-mono text-lg font-semibold">This rack is empty</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#BAC3CF]">
            {canEdit
              ? "Add your first device, or import an existing .xlsx / .csv inventory."
              : "No devices yet. Editors and admins of this workspace can add them."}
          </p>
          {canEdit && (
            <div className="mt-5 flex justify-center gap-2">
              <button className="btn-primary" onClick={() => setSelected("new")}>+ Add device</button>
              <button className="btn-ghost" onClick={() => setImportOpen(true)}>Import</button>
            </div>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-10 text-center text-sm text-[#AEB8C5]">No devices match your filters.</p>
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
          workspaceId={workspaceId}
          canEdit={canEdit}
          overdue={selectedDevice ? isOverdue(selectedDevice, today) : false}
          onClose={() => setSelected(null)}
        />
      )}
      {importOpen && canEdit && (
        <ImportDialog workspaceId={workspaceId} currentCount={devices.length} onClose={() => setImportOpen(false)} />
      )}
    </div>
  );
}
