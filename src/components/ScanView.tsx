"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
import Link from "next/link";
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
import { guessModel, labelContext } from "@/lib/labels";
import { isOverdue } from "@/lib/stats";
import type { Place } from "@/lib/places";
import type { DeviceRow } from "@/lib/types";
import { receiveDevices } from "@/app/app/actions";
import { DeviceDrawer, type Suggestions } from "./DeviceDrawer";
import { Scanner } from "./Scanner";
import { StatusLed } from "./StatusLed";
import { PlaceSelect } from "./PlaceSelect";
import { PhotoScan, type PhotoResult } from "./PhotoScan";
import { BulkMoveDialog, canSend } from "./BulkMoveDialog";
import { NewSerials } from "./NewSerials";

function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type Mode = "lookup" | "receive" | "send";
type ToSend = { key: string; serial: string; deviceId: string | null; model: string | null };
const MODE_LABELS: Record<Mode, string> = { lookup: "Look up", receive: "Receive stock", send: "Send out" };
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
  places,
  workspaceId,
  canEdit,
}: {
  devices: DeviceRow[];
  places: Place[];
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
  const [locationId, setLocationId] = useState(() => places.find((p) => !p.parentId)?.id ?? "");
  const [batch, setBatch] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  // send mode: scan everything going out, then send it all to one project
  const [toSend, setToSend] = useState<ToSend[]>([]);
  const [sending, setSending] = useState(false);
  const ctx = useMemo(() => labelContext(devices), [devices]);

  const bySerial = useMemo(() => {
    const m = new Map<string, DeviceRow[]>();
    for (const d of devices) if (d.serial) m.set(serialKey(d.serial), [...(m.get(serialKey(d.serial)) ?? []), d]);
    return m;
  }, [devices]);

  const suggestions: Suggestions = useMemo(() => {
    const cat = new Map(devices.map((d) => [d.name, d.category]));
    return {
      customers: rank(devices.map((d) => d.customer)),
      places,
      models: rank(devices.map((d) => d.name)).map((name) => ({ name, category: cat.get(name) ?? "Lainnya" })),
    };
  }, [devices, places]);

  const byId = useMemo(() => new Map(devices.map((d) => [d.id, d])), [devices]);
  const resolve = (t: ToSend) => (t.deviceId ? byId.get(t.deviceId) : bySerial.get(t.key)?.[0]) ?? null;
  const sendRows = toSend.map((t) => ({ t, device: resolve(t) }));
  const sendKnown = sendRows.flatMap((r) => (r.device ? [r.device] : []));
  const sendNew = sendRows.filter((r) => !r.device).map((r) => ({ serial: r.t.serial, model: r.t.model }));

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

  function queue(raw: string, model: string | null = null) {
    const r = parseScan(raw);
    if (r.kind === "empty") return;
    const device = r.kind === "device" ? byId.get(r.id) : bySerial.get(serialKey(r.serial))?.[0];
    if (r.kind === "device" && !device) return setFlash({ tone: "bad", text: "That label belongs to a device outside this workspace." });
    const serial = device?.serial ?? (r.kind === "serial" ? r.serial : r.id);
    const key = serialKey(serial);
    setToSend((list) => {
      if (list.some((t) => t.key === key)) return list;
      return [{ key, serial, deviceId: device?.id ?? null, model: device ? null : model ?? guessModel(serial, ctx, null) }, ...list];
    });
    if (!device) setFlash({ tone: "warn", text: `${serial} is not in RackTrack yet. Add it below, then send.` });
    else if (!canSend(device))
      setFlash({ tone: "bad", text: `${device.name} is ${statusLabel(device.status)}${device.customer ? ` (${device.customer})` : ""}, so it can't be sent.` });
    else setFlash({ tone: "ok", text: `✓ ${device.name} · ${serial}` });
  }

  const onScan = (text: string) => (mode === "lookup" ? lookup(text) : mode === "receive" ? receive(text) : queue(text));

  function onPhoto(r: PhotoResult) {
    const codes = [...r.items.map((i) => i.serial), ...r.deviceIds.map((id) => `/d/${id}`)];
    if (!codes.length) return;
    if (mode === "send") {
      r.items.forEach((i) => queue(i.serial, i.model));
      r.deviceIds.forEach((id) => queue(`/d/${id}`));
      setFlash({ tone: "ok", text: `Photo: ${codes.length} code${codes.length === 1 ? "" : "s"} read.` });
    } else if (mode === "receive") {
      const guess = r.items.find((i) => i.model)?.model;
      if (!model.trim() && guess) pickModel(guess);
      r.items.forEach((i) => receive(i.serial));
      if (r.items.length > 1) setFlash({ tone: "ok", text: `Photo: ${r.items.length} serials read${guess ? ` (${guess})` : ""}. Check the list.` });
    } else if (codes.length === 1) {
      lookup(codes[0]);
    } else {
      const hits = codes.flatMap((c) => {
        const p = parseScan(c);
        return p.kind === "device" ? (byId.get(p.id) ? [byId.get(p.id)!] : []) : p.kind === "serial" ? bySerial.get(serialKey(p.serial)) ?? [] : [];
      });
      setMatches(hits);
      setFlash({ tone: hits.length ? "ok" : "warn", text: `Photo: ${codes.length} codes, ${hits.length} in RackTrack.` });
    }
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    onScan(manual);
    setManual("");
  }

  function saveBatch() {
    setFlash(null);
    startTransition(async () => {
      const res = await receiveDevices(workspaceId, { name: model, category, locationId, serials: batch });
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
          {{ lookup: "Find a device", receive: "Receive stock", send: "Send out" }[mode]}
        </h1>
      </div>

      {canEdit && (
        <div className="flex gap-1" role="group" aria-label="Scan mode">
          {(["lookup", "receive", "send"] as const).map((m) => (
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
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      )}
      <Link href="/app/opname" className="flex items-center justify-between gap-3 rounded-xl bg-white/[.05] px-4 py-2.5 text-sm text-[#C3CBD6] shadow-[inset_0_0_0_1px_rgba(255,255,255,.1)] transition hover:bg-white/[.08] lg:hidden">
        <span>Counting the whole warehouse?</span>
        <span className="shrink-0 font-mono text-xs text-[#FFC27A]">Stock opname →</span>
      </Link>
      <p className="text-sm text-[#AEB8C5]">
        {mode === "lookup"
          ? "Scan a box, device label or RackTrack QR. Found devices open with their actions; unknown serials open Add device with the serial filled in."
          : mode === "receive"
            ? "Pick the model once (or take a photo of a label and it's filled in), then scan every box. Each serial is checked for duplicates. Save adds them all as In Stock."
            : "Scan or photograph everything going out, then send it all to one project. Serials not in RackTrack yet can be added first, so nothing leaves unrecorded."}
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
            <PlaceSelect places={places} value={locationId} onChange={setLocationId} />
          </label>
          {batch.length > 0 && (
            <p className="col-span-2 text-xs text-[#97A3B3]">Model and type are locked while the list has serials.</p>
          )}
        </section>
      )}

      {(mode !== "receive" || receiveReady) && (
        <>
          <Scanner onScan={onScan} paused={open !== null || pending || sending} />
          <PhotoScan ctx={ctx} onResult={onPhoto} disabled={pending} />

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
        <div className="space-y-3 rounded-xl bg-black/25 px-4 py-6 text-center text-sm text-[#AEB8C5]">
          <p>Pick or type the model first, or photograph a label to fill it in.</p>
          <div className="flex justify-center">
            <PhotoScan ctx={ctx} onResult={onPhoto} disabled={pending} />
          </div>
        </div>
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

      {mode === "send" && toSend.length > 0 && (
        <section className="lg lg-dark space-y-3 rounded-[22px] p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-mono text-sm font-semibold tracking-wider">Going out · {toSend.length}</h2>
            <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setToSend([])} disabled={pending}>
              Clear
            </button>
          </div>
          {sendKnown.length > 0 && (
            <ul className="max-h-72 divide-y divide-white/10 overflow-y-auto">
              {sendRows.filter((r) => r.device).map(({ t, device }) => (
                <li key={t.key} className="flex items-center gap-3 py-2">
                  <StatusLed status={device!.status} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-sm normal-case text-ink">{device!.name}</span>
                    <span className="block truncate text-xs text-[#97A3B3]">
                      <span className="font-mono">{t.serial}</span>
                      {!canSend(device!) && <span className="text-[#FFB3A6]"> · {statusLabel(device!.status)}, will be skipped</span>}
                    </span>
                  </span>
                  <button type="button" className="px-2 text-[#AEB8C5] hover:text-[#FFB3A6]" aria-label={`Remove ${t.serial}`} onClick={() => setToSend((l) => l.filter((x) => x.key !== t.key))}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          {sendNew.length > 0 && (
            <div className="rounded-xl bg-amber/10 p-3 shadow-[inset_0_0_0_1px_rgba(239,155,62,.45)]">
              <p className="mb-2 text-sm text-[#FFE1B8]">
                {sendNew.length} not in RackTrack yet. Add {sendNew.length === 1 ? "it" : "them"} to stock first, then {sendNew.length === 1 ? "it joins" : "they join"} the list above.
              </p>
              <NewSerials
                items={sendNew}
                workspaceId={workspaceId}
                places={places}
                locationId={locationId || null}
                models={suggestions.models ?? []}
                onRemove={(serial) => setToSend((l) => l.filter((x) => x.key !== serialKey(serial)))}
              />
            </div>
          )}
          <div className="flex justify-end">
            <button type="button" className="btn-primary" disabled={pending || !sendKnown.some(canSend)} onClick={() => setSending(true)}>
              Send {sendKnown.filter(canSend).length} to project
            </button>
          </div>
        </section>
      )}

      {sending && (
        <BulkMoveDialog
          kind="send"
          devices={sendKnown}
          workspaceId={workspaceId}
          customers={suggestions.customers ?? []}
          places={places}
          onDone={() => setToSend([])}
          onClose={() => setSending(false)}
        />
      )}

      {open && (openDevice || "newSerial" in open) && (
        <DeviceDrawer
          key={"id" in open ? open.id : `new-${open.newSerial}`}
          device={openDevice}
          workspaceId={workspaceId}
          canEdit={canEdit}
          overdue={openDevice ? isOverdue(openDevice, today) : false}
          suggestions={suggestions}
          initial={"newSerial" in open ? { serial: open.newSerial, locationId } : undefined}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
