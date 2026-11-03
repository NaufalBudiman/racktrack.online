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
import { ROLE_LABELS, canManageMembers, type Role } from "@/lib/roles";
import { shareableCustomers } from "@/lib/share";
import { deviceStats } from "@/lib/stats";
import { placeAndChildren, type Place } from "@/lib/places";
import type { DeviceRow } from "@/lib/types";
import { DeviceCard, OverdueBadge, isOverdue } from "./DeviceCard";
import { DeviceDrawer } from "./DeviceDrawer";
import { ModelList, modelKey } from "./ModelList";
import { ImportDialog } from "./ImportDialog";
import { StatusTiles } from "./StatTile";
import { PlaceSelect } from "./PlaceSelect";
import { StatusLed } from "./StatusLed";
import { ShareButton } from "./ShareDialog";
import { BulkMoveDialog, canReturn, canSend, type BulkKind } from "./BulkMoveDialog";

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
  places,
  minimums,
  workspaceId,
  workspaceName,
  role,
  canEdit,
}: {
  devices: DeviceRow[];
  places: Place[];
  minimums: Record<string, number>;
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
  const customer = params.get("customer"); // exact match, set from the dashboard
  const placeParam = params.get("location");
  const place = places.some((p) => p.id === placeParam) ? (placeParam as string) : "";
  const inPlace = useMemo(() => (place ? placeAndChildren(places, place) : null), [places, place]);
  const viewParam = params.get("view");
  const view = viewParam === "table" || viewParam === "grid" ? viewParam : "model"; // by model is the default

  const [q, setQ] = useState(params.get("q") ?? "");
  const [selected, setSelected] = useState<Selected>(null);
  const [importOpen, setImportOpen] = useState(false);
  // Select mode: pick many devices, then Send / Return them together.
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<BulkKind | null>(null);
  const toggle = (ids: string[], on: boolean) =>
    setPicked((s) => {
      const n = new Set(s);
      ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
      return n;
    });
  const stopSelecting = () => {
    setSelecting(false);
    setPicked(new Set());
  };
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
      if (customer && d.customer !== customer) return false;
      if (inPlace && !(d.locationId && inPlace.has(d.locationId))) return false;
      if (needle) {
        const hay = [d.name, d.serial, d.customer, d.location];
        if (!hay.some((v) => v?.toLowerCase().includes(needle))) return false;
      }
      return true;
    });
  }, [devices, q, group, type, status, customer, inPlace]);

  const typeOptions: readonly string[] =
    group === "All" ? GROUPS.flatMap((g) => CATEGORY_GROUPS[g]) : CATEGORY_GROUPS[group];

  // Most used first, for the action forms' autocomplete.
  const suggestions = useMemo(() => {
    const rank = (values: (string | null)[]) => {
      const counts = new Map<string, number>();
      for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
      return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
    };
    const category = new Map(devices.map((d) => [d.name, d.category]));
    return {
      customers: rank(devices.map((d) => d.customer)),
      places,
      models: rank(devices.map((d) => d.name)).map((name) => ({ name, category: category.get(name) ?? "Lainnya" })),
    };
  }, [devices, places]);

  const atLimit = devices.length >= MAX_DEVICES_PER_WORKSPACE;
  const pickedDevices = useMemo(() => devices.filter((d) => picked.has(d.id)), [devices, picked]);
  const selectedDevice = selected && selected !== "new" ? devices.find((d) => d.id === selected.id) ?? null : null;
  const filtersActive = q !== "" || group !== "All" || type !== "All" || status !== "All" || !!customer || !!place;

  function resetFilters() {
    setQ("");
    setParams({ q: null, group: null, type: null, status: null, customer: null, location: null });
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
            {canManageMembers(role) && (
              <ShareButton
                workspaceId={workspaceId}
                customers={shareableCustomers(devices)}
                places={places}
                initial={
                  customer && shareableCustomers(devices).includes(customer)
                    ? { kind: "customer", target: customer }
                    : place
                      ? { kind: "location", target: place }
                      : { kind: "all", target: null }
                }
              />
            )}
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
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
          <PlaceSelect
            places={places}
            value={place}
            onChange={(id) => setParams({ location: id || null })}
            noneLabel="All locations"
            className="input lg:w-44"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 font-mono text-xs text-[#AEB8C5]">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {view === "model"
            ? `${new Set(filtered.map((d) => modelKey(d.name))).size} models · ${filtered.length} units`
            : `Showing ${filtered.length} of ${devices.length}`}
          {customer && (
            <button
              type="button"
              onClick={() => setParams({ customer: null })}
              className="chip chip-on normal-case"
              aria-label={`Remove customer filter ${customer}`}
            >
              {customer} ✕
            </button>
          )}
          {filtersActive && (
            <button type="button" onClick={resetFilters} className="text-[#FFC27A] hover:underline">
              Clear filters
            </button>
          )}
          {selecting && filtered.length > 0 && (
            <button
              type="button"
              className="text-[#FFC27A] hover:underline"
              onClick={() => {
                const ids = filtered.map((d) => d.id);
                toggle(ids, !ids.every((id) => picked.has(id)));
              }}
            >
              {filtered.every((d) => picked.has(d.id)) ? "Unselect shown" : `Select all ${filtered.length} shown`}
            </button>
          )}
        </span>
        <span className="flex gap-1" role="group" aria-label="View">
          {canEdit && devices.length > 0 && (
            <button
              type="button"
              aria-pressed={selecting}
              onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
              className={`chip mr-1.5 ${selecting ? "chip-on" : ""}`}
            >
              {selecting ? "Done" : "Select"}
            </button>
          )}
          {(["model", "grid", "table"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setParams({ view: v === "model" ? null : v })}
              className={`chip ${view === v ? "chip-on" : ""}`}
            >
              {v === "model" ? "By model" : v === "grid" ? "Grid" : "Table"}
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
      ) : view === "model" ? (
        <ModelList
          devices={devices}
          filtered={filtered}
          today={today}
          onOpen={(id) => setSelected({ id })}
          minimums={minimums}
          workspaceId={workspaceId}
          canEdit={canEdit}
          selection={selecting ? { picked, toggle } : undefined}
        />
      ) : view === "table" ? (
        <div className="lg lg-dark mt-4 overflow-x-auto rounded-[22px]">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="font-mono text-[10.5px] uppercase tracking-wider text-[#AEB8C5]">
              <tr className="border-b border-white/10">
                {selecting && (
                  <th scope="col" className="w-10 px-4 py-3">
                    <span className="sr-only">Selected</span>
                  </th>
                )}
                {["Name", "Type", "Status", "Location", "Project", "Due"].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[.06]">
              {filtered.map((d) => {
                const overdue = isOverdue(d, today);
                return (
                  <tr key={d.id} className={`transition hover:bg-white/[.04] ${picked.has(d.id) && selecting ? "bg-amber/10" : ""}`}>
                    {selecting && (
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[#F7A23A]"
                          checked={picked.has(d.id)}
                          onChange={(e) => toggle([d.id], e.target.checked)}
                          aria-label={`Select ${d.name} ${d.serial ?? ""}`}
                        />
                      </td>
                    )}
                    <td className="max-w-[16rem] px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => (selecting ? toggle([d.id], !picked.has(d.id)) : setSelected({ id: d.id }))}
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
              onOpen={() => (selecting ? toggle([d.id], !picked.has(d.id)) : setSelected({ id: d.id }))}
              checked={selecting ? picked.has(d.id) : undefined}
            />
          ))}
        </div>
      )}

      {selecting && (
        <div className="fixed inset-x-3 bottom-[calc(max(.75rem,env(safe-area-inset-bottom))+4.75rem)] z-40 lg:inset-x-auto lg:bottom-6 lg:left-[calc(17.5rem+2rem)] lg:right-8">
          <div className="lg lg-solid mx-auto flex max-w-3xl items-center gap-2 rounded-[22px] px-4 py-3">
            <span className="mr-auto min-w-0 font-mono text-sm text-ink">
              {picked.size} selected
              {picked.size > 0 && (
                <button type="button" className="ml-3 text-xs text-[#FFC27A] hover:underline" onClick={() => setPicked(new Set())}>
                  Clear
                </button>
              )}
            </span>
            <button type="button" className="btn-ghost shrink-0 px-3" disabled={!pickedDevices.some(canReturn)} onClick={() => setBulk("return")}>
              Return
            </button>
            <button type="button" className="btn-primary shrink-0 px-3" disabled={!pickedDevices.some(canSend)} onClick={() => setBulk("send")}>
              Send<span className="hidden sm:inline">&nbsp;to project</span>
            </button>
          </div>
        </div>
      )}
      {bulk && (
        <BulkMoveDialog
          kind={bulk}
          devices={pickedDevices}
          workspaceId={workspaceId}
          customers={suggestions.customers}
          places={places}
          onClose={() => setBulk(null)}
          onDone={() => {
            setBulk(null);
            stopSelecting();
          }}
        />
      )}

      {selected && (selected === "new" || selectedDevice) && (
        <DeviceDrawer
          key={selected === "new" ? "new" : selected.id}
          device={selectedDevice}
          workspaceId={workspaceId}
          canEdit={canEdit}
          suggestions={suggestions}
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
