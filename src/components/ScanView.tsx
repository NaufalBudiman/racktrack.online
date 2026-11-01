"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CATEGORY_GROUPS,
  GROUPS,
  MAX_DEVICES_PER_WORKSPACE,
  categoryLabel,
  groupLabel,
  statusLabel,
  type Category,
} from "@/lib/categories";
import { parseScan, serialKey } from "@/lib/scan";
import { isOverdue } from "@/lib/stats";
import type { DeviceRow } from "@/lib/types";
import { receiveDevices } from "@/app/app/actions";
import { DeviceDrawer, type Suggestions } from "./DeviceDrawer";
import { Scanner } from "./Scanner";
import { StatusLed } from "./StatusLed";

function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type Mode = "lookup" | "receive";
type Flash = { tone: "ok" | "warn" | "bad"; text: string } | null;
type Open = { id: string } | { newSerial: string } | null;

const FLASH_STYLES = {
  ok: "bg-green/15 text-[#A6EFCB] shadow-[inset_0_0_0_1px_rgba(79,209,153,.5)]",
  warn: "bg-amber/15 text-[#FFE1B8] shadow-[inset_0_0_0_1px_rgba(239,155,62,.5)]",
  bad: "bg-red/15 text-[#FFB3A6] shadow-[inset_0_0_0_1px_rgba(240,102,76,.55)]",
};

function rank(values: (string | null)[]): string[] {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
}

export function ScanView({
  devices,
  workspaceId,
  canEdit,
}: {
  devices: DeviceRow[];
  workspaceId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const ids = useId();
  const [mode, setMode] = useState<Mode>("lookup");
  const [flash, setFlash] = useState<Flash>(null);
  const [manual, setManual] = useState("");
  const [open, setOpen] = useState<Open>(null);
  const [matches, setMatches] = useState<DeviceRow[]>([]);
  const [today, setToday] = useState("");
  useEffect(() => setToday(localToday()), []);

  // receive mode
  const [model, setModel] = useState("");
  const [category, setCategory] = useState<Category>("Wireless");
  const [location, setLocation] = useState("");
  const [batch, setBatch] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const bySerial = useMemo(() => {
    const m = new Map<string, DeviceRow[]>();
    for (const d of devices) if (d.serial) m.set(serialKey(d.serial), [...(m.get(serialKey(d.serial)) ?? []), d]);
    return m;
  }, [devices]);

  const suggestions: Suggestions = useMemo(() => {
    const cat = new Map(devices.map((d) => [d.name, d.category]));
    return {
      customers: rank(devices.map((d) => d.customer)),
      locations: rank(devices.map((d) => d.location)),
      models: rank(devices.map((d) => d.name)).map((name) => ({ name, category: cat.get(name) ?? "Lainnya" })),
    };
  }, [devices]);

  useEffect(() => {
    if (!location && suggestions.locations[0]) setLocation(suggestions.locations[0]);
  }, [suggestions.locations, location]);

  const slotsLeft = MAX_DEVICES_PER_WORKSPACE - devices.length - batch.length;
  const openDevice = open && "id" in open ? devices.find((d) => d.id === open.id) ?? null : null;

  function lookup(raw: string) {
    const r = parseScan(raw);
    setMatches([]);
    if (r.kind === "empty") return;
    if (r.kind === "device") {
      if (devices.some((d) => d.id === r.id)) setOpen({ id: r.id });
      else setFlash({ tone: "bad", text: "That label belongs to a device outside this workspace." });
      return;
    }
    const hits = bySerial.get(serialKey(r.serial)) ?? [];
    if (hits.length === 1) {
      setFlash({ tone: "ok", text: `Found ${hits[0].name} · ${r.serial}` });
      setOpen({ id: hits[0].id });
    } else if (hits.length > 1) {
      setFlash({ tone: "warn", text: `${hits.length} devices share serial ${r.serial}. Pick one.` });
      setMatches(hits);
    } else {
      setFlash({ tone: "warn", text: `${r.serial} is not in this workspace yet.` });
      if (canEdit) setOpen({ newSerial: r.serial });
    }
  }

  function receive(raw: string) {
    const r = parseScan(raw);
    if (r.kind === "empty") return;
    if (r.kind === "device") {
      setFlash({ tone: "warn", text: "That's a RackTrack label, so the device is already in stock." });
      return;
    }
    const key = serialKey(r.serial);
    const existing = bySerial.get(key)?.[0];
    if (existing) {
      setFlash({ tone: "bad", text: `${r.serial} already exists: ${existing.name} (${statusLabel(existing.status)}).` });
      return;
    }
    if (batch.some((s) => serialKey(s) === key)) {
      setFlash({ tone: "warn", text: `${r.serial} is already in this list.` });
      return;
    }
    if (slotsLeft <= 0) {
      setFlash({ tone: "bad", text: `Device limit reached (${MAX_DEVICES_PER_WORKSPACE} per workspace).` });
      return;
    }
    setBatch((b) => [r.serial, ...b]);
    setFlash({ tone: "ok", text: `Added ${r.serial}` });
  }

  const onScan = (text: string) => (mode === "lookup" ? lookup(text) : receive(text));

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    onScan(manual);
    setManual("");
  }

  function saveBatch() {
    setFlash(null);
    startTransition(async () => {
      const res = await receiveDevices(workspaceId, { name: model, category, location, serials: batch });
      if (!res.ok) {
        setFlash({ tone: "bad", text: res.error });
        return;
      }
      setFlash({ tone: "ok", text: `${res.added} × ${model.trim()} added to stock.` });
      setBatch([]);
      router.refresh();
    });
  }

  function pickModel(name: string) {
    setModel(name);
    const known = suggestions.models?.find((m) => m.name.toLowerCase() === name.trim().toLowerCase());
    if (known) setCategory(known.category as Category);
  }

  const receiveReady = model.trim() !== "";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="mb-2">
        <div className="eyebrow">Scan</div>
        <h1 className="mt-1.5 font-mono text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
          {mode === "lookup" ? "Find a device" : "Receive stock"}
        </h1>
      </div>

      {canEdit && (
        <div className="flex gap-1" role="group" aria-label="Scan mode">
          {(["lookup", "receive"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m);
                setFlash(null);
                setMatches([]);
              }}
              className={`chip ${mode === m ? "chip-on" : ""}`}
            >
              {m === "lookup" ? "Look up" : "Receive stock"}
            </button>
          ))}
        </div>
      )}
      <p className="text-sm text-[#AEB8C5]">
        {mode === "lookup"
          ? "Scan a box, device label or RackTrack QR. Found devices open with their actions; unknown serials open Add device with the serial filled in."
          : "Pick the model once, then scan every box. Each serial is checked for duplicates. Save adds them all as In Stock."}
      </p>

      {mode === "receive" && (
        <section className="lg lg-dark grid grid-cols-2 gap-3 rounded-[22px] p-4">
          <label className="col-span-2 block">
            <span className="label">Model *</span>
            <input
              className="input"
              list={`${ids}-models`}
              value={model}
              onChange={(e) => pickModel(e.target.value)}
              placeholder="e.g. H3C WA6636"
              maxLength={120}
              disabled={batch.length > 0}
            />
            <datalist id={`${ids}-models`}>
              {suggestions.models?.map((m) => (
                <option key={m.name} value={m.name} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="label">Type</span>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value as Category)} disabled={batch.length > 0}>
              {GROUPS.map((g) => (
                <optgroup key={g} label={groupLabel(g)}>
                  {CATEGORY_GROUPS[g].map((c) => (
                    <option key={c} value={c}>{categoryLabel(c)}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Stored at</span>
            <input
              className="input"
              list={`${ids}-locations`}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={200}
            />
            <datalist id={`${ids}-locations`}>
              {suggestions.locations.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </label>
          {batch.length > 0 && (
            <p className="col-span-2 text-xs text-[#97A3B3]">Model and type are locked while the list has serials.</p>
          )}
        </section>
      )}

      {(mode === "lookup" || receiveReady) && (
        <>
          <Scanner onScan={onScan} paused={open !== null || pending} />

          <form onSubmit={submitManual} className="flex gap-2">
            <label className="sr-only" htmlFor={`${ids}-manual`}>Serial or code</label>
            <input
              id={`${ids}-manual`}
              className="input font-mono"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Type, paste or use a USB scanner…"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
            <button type="submit" className="btn-ghost shrink-0" disabled={!manual.trim()}>
              {mode === "lookup" ? "Find" : "Add"}
            </button>
          </form>
        </>
      )}
      {mode === "receive" && !receiveReady && (
        <p className="rounded-xl bg-black/25 px-4 py-6 text-center text-sm text-[#AEB8C5]">Pick or type the model first.</p>
      )}

      {flash && (
        <p role="status" aria-live="polite" className={`rounded-xl px-3 py-2 text-sm ${FLASH_STYLES[flash.tone]}`}>
          {flash.text}
        </p>
      )}

      {matches.length > 0 && (
        <ul className="lg lg-dark divide-y divide-white/10 rounded-[22px] px-4">
          {matches.map((d) => (
            <li key={d.id}>
              <button type="button" onClick={() => setOpen({ id: d.id })} className="flex w-full items-center gap-3 py-3 text-left">
                <StatusLed status={d.status} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-sm normal-case text-ink">{d.name}</span>
                  <span className="block truncate text-xs text-[#97A3B3]">
                    {statusLabel(d.status)} · {d.customer ?? d.location ?? "—"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {mode === "receive" && batch.length > 0 && (
        <section className="lg lg-dark rounded-[22px] p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-mono text-sm font-semibold tracking-wider">
              {batch.length} × <span className="normal-case">{model.trim()}</span>
            </h2>
            <span className="font-mono text-xs text-[#97A3B3]">{slotsLeft} slots left</span>
          </div>
          <ol className="mt-3 max-h-64 divide-y divide-white/10 overflow-y-auto">
            {batch.map((s, i) => (
              <li key={s} className="flex items-center gap-3 py-2">
                <span className="w-7 font-mono text-xs text-[#8B97A8]">{batch.length - i}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{s}</span>
                <button
                  type="button"
                  className="px-2 text-[#AEB8C5] hover:text-[#FFB3A6]"
                  aria-label={`Remove ${s}`}
                  onClick={() => setBatch((b) => b.filter((x) => x !== s))}
                  disabled={pending}
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setBatch([])} disabled={pending}>
              Clear
            </button>
            <button type="button" className="btn-primary" onClick={saveBatch} disabled={pending}>
              {pending ? "Saving…" : `Add ${batch.length} to stock`}
            </button>
          </div>
        </section>
      )}

      {open && (openDevice || "newSerial" in open) && (
        <DeviceDrawer
          key={"id" in open ? open.id : `new-${open.newSerial}`}
          device={openDevice}
          workspaceId={workspaceId}
          canEdit={canEdit}
          overdue={openDevice ? isOverdue(openDevice, today) : false}
          suggestions={suggestions}
          initial={"newSerial" in open ? { serial: open.newSerial, location: suggestions.locations[0] } : undefined}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
