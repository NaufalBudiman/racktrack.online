"use client";

import { useEffect, useMemo, useState } from "react";
import { ASSIGNMENT_LABELS, GROUP_COLORS, STATUSES, categoryLabel, groupOf, statusLabel, type Status } from "@/lib/categories";
import { modelKey } from "@/lib/models";
import type { PublicDevice } from "@/lib/share";
import type { SharedView as View } from "@/lib/shared";
import { OverdueBadge } from "./DeviceCard";
import { StatusLed } from "./StatusLed";

type Ok = Extract<View, { state: "ok" }>;

function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const overdue = (d: PublicDevice, today: string) =>
  d.status === "In Use" && d.assignment === "loan" && !!d.returnDate && !!today && d.returnDate < today;

/** "Gudang A" for stock, "PT X · loan until 2026-12-01" for devices out. */
function whereText(d: PublicDevice): string {
  if (d.status === "In Use") {
    const who = d.customer ?? "At a customer";
    if (d.assignment === "loan") return `${who} · loan${d.returnDate ? ` until ${d.returnDate}` : ""}`;
    return `${who} · ${ASSIGNMENT_LABELS.installed.toLowerCase()}`;
  }
  return [d.location, d.rackPosition].filter(Boolean).join(" · ") || "—";
}

function UnitRow({ d, today }: { d: PublicDevice; today: string }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className="mt-1.5">
        <StatusLed status={d.status} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="break-words font-medium normal-case text-ink">{d.name}</span>
          {d.serial && <span className="font-mono text-xs text-[#97A3B3]">{d.serial}</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#AEB8C5]">
          <span className="font-mono uppercase tracking-wider">{statusLabel(d.status)}</span>
          <span>{whereText(d)}</span>
          {overdue(d, today) && <OverdueBadge />}
        </div>
      </div>
    </li>
  );
}

export function SharedView({ view }: { view: Ok }) {
  const [today, setToday] = useState(""); // after mount, to avoid hydration mismatch
  const [now, setNow] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status | "All">("All");
  const [mode, setMode] = useState<"model" | "unit">("model");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    setToday(localToday());
    setNow(new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }));
  }, []);

  const all = view.devices;
  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
    for (const d of all) c[d.status]++;
    return c;
  }, [all]);
  const late = all.filter((d) => overdue(d, today)).length;

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(
      (d) =>
        (status === "All" || d.status === status) &&
        (!needle || [d.name, d.serial, d.customer, d.location].some((v) => v?.toLowerCase().includes(needle))),
    );
  }, [all, q, status]);

  const models = useMemo(() => {
    const map = new Map<string, { key: string; name: string; category: string; units: PublicDevice[] }>();
    for (const d of list) {
      const key = modelKey(d.name);
      const m = map.get(key) ?? { key, name: d.name, category: d.category, units: [] };
      m.units.push(d);
      map.set(key, m);
    }
    return [...map.values()].sort((a, b) => b.units.length - a.units.length || a.name.localeCompare(b.name));
  }, [list]);

  const eyebrow = { all: "Inventory", customer: "Devices at customer", location: "Location", device: "Device" }[view.kind];

  const header = (
    <div className="mb-5">
      <div className="eyebrow">{view.workspace} · {eyebrow}</div>
      <h1 className={`mt-1.5 break-words font-mono text-2xl font-semibold tracking-[-0.02em] sm:text-3xl ${view.kind === "device" ? "normal-case" : ""}`}>
        {view.title}
      </h1>
      <p className="mt-2 font-mono text-xs text-[#AEB8C5]">
        Live data{now && ` · viewed ${now}`}
      </p>
    </div>
  );

  if (view.kind === "device") {
    const d = all[0];
    const g = groupOf(d.category);
    const rows: [string, React.ReactNode][] = [
      ["Category", <span key="c" style={{ color: GROUP_COLORS[g] }}>{categoryLabel(d.category)}</span>],
      ["Serial", d.serial ? <span key="s" className="font-mono">{d.serial}</span> : null],
      ["Status", <span key="st" className="inline-flex items-center gap-2"><StatusLed status={d.status} />{statusLabel(d.status)}{overdue(d, today) && <OverdueBadge />}</span>],
      [d.status === "In Use" ? "Returns to" : "Location", [d.location, d.rackPosition].filter(Boolean).join(" · ") || null],
      ["Customer", d.status === "In Use" || d.status === "Hilang" ? d.customer : null],
      ["Type", d.status === "In Use" && d.assignment ? ASSIGNMENT_LABELS[d.assignment] : null],
      ["Out since", d.status === "In Use" ? d.outDate : null],
      ["Return by", d.status === "In Use" && d.assignment === "loan" ? d.returnDate : null],
    ];
    return (
      <>
        {header}
        <section className="lg lg-dark max-w-xl rounded-[22px] p-5">
          <dl className="divide-y divide-white/10">
            {rows
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex gap-4 py-2.5 text-sm">
                  <dt className="w-24 shrink-0 font-mono text-[11px] uppercase leading-5 tracking-wider text-[#AEB8C5]">{k}</dt>
                  <dd className="min-w-0 break-words text-ink">{v}</dd>
                </div>
              ))}
          </dl>
        </section>
      </>
    );
  }

  return (
    <>
      {header}

      <div className="mb-4 flex flex-wrap gap-1.5">
        <button type="button" className={`chip ${status === "All" ? "chip-on" : ""}`} aria-pressed={status === "All"} onClick={() => setStatus("All")}>
          All <span className="font-mono">{all.length}</span>
        </button>
        {STATUSES.filter((s) => counts[s] > 0).map((s) => (
          <button
            key={s}
            type="button"
            className={`chip ${status === s ? "chip-on" : ""}`}
            aria-pressed={status === s}
            onClick={() => setStatus(status === s ? "All" : s)}
          >
            <StatusLed status={s} size={6} />
            {statusLabel(s)} <span className="font-mono">{counts[s]}</span>
          </button>
        ))}
        {late > 0 && (
          <span className="chip text-[#FFB3A6]">{late} overdue</span>
        )}
      </div>

      <div className="lg lg-dark mb-4 flex flex-col gap-2.5 rounded-[22px] p-2.5 sm:flex-row sm:items-center">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={view.showSerial ? "Search name, serial, place…" : "Search name or place…"}
          aria-label="Search devices"
          className="input flex-1"
        />
        <div className="flex gap-1.5" role="group" aria-label="View">
          <button type="button" className={`chip ${mode === "model" ? "chip-on" : ""}`} aria-pressed={mode === "model"} onClick={() => setMode("model")}>
            By model
          </button>
          <button type="button" className={`chip ${mode === "unit" ? "chip-on" : ""}`} aria-pressed={mode === "unit"} onClick={() => setMode("unit")}>
            All units
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <p className="mt-10 text-center text-sm text-[#AEB8C5]">{all.length === 0 ? "Nothing here right now." : "No devices match."}</p>
      ) : mode === "unit" ? (
        <ul className="lg lg-dark divide-y divide-white/10 rounded-[22px] px-4">
          {list.map((d) => (
            <UnitRow key={d.id} d={d} today={today} />
          ))}
        </ul>
      ) : (
        <ul className="space-y-2">
          {models.map((m) => {
            const inStock = m.units.filter((d) => d.status === "Available").length;
            const out = m.units.filter((d) => d.status === "In Use").length;
            const isOpen = open === m.key;
            return (
              <li key={m.key} className="lg lg-dark rounded-[20px]">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : m.key)}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: GROUP_COLORS[groupOf(m.category)] }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="break-words font-medium normal-case text-ink">{m.name}</div>
                    <div className="font-mono text-[11px] text-[#97A3B3]">
                      {categoryLabel(m.category)} · {inStock} in stock{out > 0 && ` · ${out} at customer`}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-xl font-semibold leading-none text-[#FFE1B8]">{m.units.length}</div>
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-[#97A3B3]">units</div>
                  </div>
                  <span className={`shrink-0 text-[#97A3B3] transition ${isOpen ? "rotate-90" : ""}`} aria-hidden>›</span>
                </button>
                {isOpen && (
                  <ul className="divide-y divide-white/10 border-t border-white/10 px-4">
                    {m.units.map((d) => (
                      <UnitRow key={d.id} d={d} today={today} />
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-8 text-center font-mono text-[11px] text-[#97A3B3]">
        Shared from RackTrack · read-only view
      </p>
    </>
  );
}
