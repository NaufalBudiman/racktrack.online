"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CATEGORIES,
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
import { deviceStats } from "@/lib/stats";
import type { DeviceRow } from "@/lib/types";
import { DeviceCard, OverdueBadge, isOverdue } from "./DeviceCard";
import { DeviceDrawer } from "./DeviceDrawer";
import { ImportDialog } from "./ImportDialog";
import { StatusTiles } from "./StatTile";
import { StatusLed } from "./StatusLed";

function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type Selected = { id: string } | "new" | null;

const pick = <T extends string>(v: string | null, allowed: readonly T[]): T | "All" =>
  v && (allowed as readonly string[]).includes(v) ? (v as T) : "All";

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
  // Filters live in the URL so sidebar links, the dashboard and shared links can set them.
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const group = pick<Group>(params.get("group"), GROUPS);
  const type = pick(params.get("type"), CATEGORIES);
  const status = pick<Status>(params.get("status"), STATUSES);
  const view = params.get("view") === "table" ? "table" : "grid";

  const [q, setQ] = useState(params.get("q") ?? "");
  const [selected, setSelected] = useState<Selected>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [today, setToday] = useState(""); // set after mount to avoid hydration mismatch

  function setParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "" || v === "All") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  useEffect(() => setToday(localToday()), []);
  useEffect(() => setQ(params.get("q") ?? ""), [params]);

  // ?new=1 / ?import=1 (from the dashboard) open the drawer or dialog once.
  useEffect(() => {
    const wantsNew = params.get("new") === "1";
    const wantsImport = params.get("import") === "1";
    if (!wantsNew && !wantsImport) return;
    if (canEdit && wantsNew) setSelected("new");
    if (canEdit && wantsImport) setImportOpen(true);
    setParams({ new: null, import: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const stats = useMemo(() => deviceStats(devices, today), [devices, today]);

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
    setParams({ q: null, group: null, type: null, status: null });
  }

  const toggleStatus = (key: "All" | Status) => setParams({ status: key === "All" || status === key ? null : key });

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Devices · {ROLE_LABELS[role]}</div>
          <h1 className="mt-1.5 break-words font-mono text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{workspaceName}</h1>
        </div>
        {canEdit && (
          <div className="flex gap-2">
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
          </div>
        )}
      </div>

      {/* stat cards (also status filters) */}
      <StatusTiles stats={stats} active={status} onSelect={toggleStatus} />

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
            onChange={(e) => {
              setQ(e.target.value);
              setParams({ q: e.target.value });
            }}
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
            onChange={(e) => setParams({ group: e.target.value, type: null })}
          >
            <option value="All">All groups</option>
            {GROUPS.map((g) => (
              <option key={g} value={g}>{groupLabel(g)}</option>
            ))}
          </select>
          <select aria-label="Type" className="input lg:w-48" value={type} onChange={(e) => setParams({ type: e.target.value })}>
            <option value="All">All types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>{categoryLabel(t)}</option>
            ))}
          </select>
          <select
            aria-label="Status"
            className="input lg:w-36"
            value={status}
            onChange={(e) => setParams({ status: e.target.value })}
          >
            <option value="All">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between px-1 font-mono text-xs text-[#AEB8C5]">
        <span className="flex items-center gap-3">
          Showing {filtered.length} of {devices.length}
          {filtersActive && (
            <button type="button" onClick={resetFilters} className="text-[#FFC27A] hover:underline">
              Clear filters
            </button>
          )}
        </span>
        <span className="flex gap-1" role="group" aria-label="View">
          {(["grid", "table"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setParams({ view: v === "grid" ? null : v })}
              className={`chip ${view === v ? "chip-on" : ""}`}
            >
              {v === "grid" ? "Grid" : "Table"}
            </button>
          ))}
        </span>
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
      ) : view === "table" ? (
        <div className="lg lg-dark mt-4 overflow-x-auto rounded-[22px]">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="font-mono text-[10.5px] uppercase tracking-wider text-[#AEB8C5]">
              <tr className="border-b border-white/10">
                {["Name", "Type", "Status", "Location", "Customer", "Due"].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[.06]">
              {filtered.map((d) => {
                const overdue = isOverdue(d, today);
                return (
                  <tr key={d.id} className="transition hover:bg-white/[.04]">
                    <td className="max-w-[16rem] px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => setSelected({ id: d.id })}
                        className="block max-w-full truncate text-left font-mono font-semibold normal-case text-ink hover:text-[#FFC27A] focus:outline-none focus-visible:underline"
                      >
                        {d.name}
                      </button>
                      <div className="truncate font-mono text-xs text-[#97A3B3]">{d.serial ?? "no serial"}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-[#BAC3CF]">{categoryLabel(d.category)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <span className="flex items-center gap-2 text-[#C3CBD6]">
                        <StatusLed status={d.status} />
                        {statusLabel(d.status)}
                      </span>
                    </td>
                    <td className="max-w-[12rem] truncate px-4 py-2.5 text-[#BAC3CF]">
                      {d.location ?? "—"}
                      {d.rackPosition ? ` · ${d.rackPosition}` : ""}
                    </td>
                    <td className="max-w-[12rem] truncate px-4 py-2.5 text-[#BAC3CF]">{d.customer ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-[#BAC3CF]">
                      {d.status === "In Use" && d.assignment === "loan" && d.returnDate ? (
                        <span className="flex items-center gap-2">
                          {d.returnDate}
                          {overdue && <OverdueBadge />}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
