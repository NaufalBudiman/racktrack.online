"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveDevices } from "@/app/app/actions";
import { addScans, deleteCount, removeScan, setCountStatus } from "@/app/app/opname/actions";
import { statusLabel } from "@/lib/categories";
import { compareCount, onShelf, type CountDetail, type CountStatus } from "@/lib/countTypes";
import { guessModel, labelContext } from "@/lib/labels";
import type { Place } from "@/lib/places";
import { parseScan, serialKey } from "@/lib/scan";
import type { DeviceRow } from "@/lib/types";
import { BulkMoveDialog } from "./BulkMoveDialog";
import { CountBadge } from "./CountList";
import { LocalTime } from "./LocalTime";
import { NewSerials } from "./NewSerials";
import { PhotoScan, type PhotoResult } from "./PhotoScan";
import { Scanner } from "./Scanner";
import { StatusLed } from "./StatusLed";

type Tab = "missing" | "misplaced" | "unknown" | "found";
type Flash = { tone: "ok" | "warn" | "bad"; text: string } | null;
type ScanItem = { serial?: string; deviceId?: string; model?: string | null };

const FLASH_STYLES = {
  ok: "bg-green/15 text-[#A6EFCB] shadow-[inset_0_0_0_1px_rgba(79,209,153,.5)]",
  warn: "bg-amber/15 text-[#FFE1B8] shadow-[inset_0_0_0_1px_rgba(239,155,62,.5)]",
  bad: "bg-red/15 text-[#FFB3A6] shadow-[inset_0_0_0_1px_rgba(240,102,76,.55)]",
};

const REFRESH_MS = 6000; // others may be scanning the same count

function Row({ device, name, serial, sub, right }: { device?: DeviceRow | null; name: string; serial: string | null; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      {device ? <StatusLed status={device.status} /> : <span className="h-2 w-2 shrink-0 rounded-full bg-white/25" aria-hidden />}
      <span className="min-w-0 flex-1">
        {device ? (
          <Link href={`/app/devices/${device.id}`} className="block truncate font-mono text-sm normal-case text-ink hover:underline">{name}</Link>
        ) : (
          <span className="block truncate font-mono text-sm normal-case text-ink">{name}</span>
        )}
        <span className="block truncate text-xs text-[#97A3B3]">
          <span className="font-mono">{serial ?? "no serial"}</span>
          {sub ? <> · {sub}</> : null}
        </span>
      </span>
      {right}
    </div>
  );
}

/** One stock opname: scan while open, then fix what doesn't match in review. */
export function CountView({
  count,
  devices,
  places,
  workspaceId,
  canEdit,
  canDelete,
}: {
  count: CountDetail;
  devices: DeviceRow[];
  places: Place[];
  workspaceId: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const ids = useId();
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<Flash>(null);
  const [manual, setManual] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const scanning = count.status === "open";
  const fixing = canEdit && count.status !== "open" && count.status !== "closed";
  const result = useMemo(() => compareCount(count, devices, places), [count, devices, places]);
  const ctx = useMemo(() => labelContext(devices), [devices]);
  const [tab, setTab] = useState<Tab>(scanning ? "found" : "missing");

  useEffect(() => {
    if (!scanning) return;
    const t = setInterval(() => document.visibilityState === "visible" && router.refresh(), REFRESH_MS);
    return () => clearInterval(t);
  }, [scanning, router]);

  const expectedIds = useMemo(() => new Set(count.expected.map((e) => e.id)), [count.expected]);
  const bySerial = useMemo(() => {
    const m = new Map<string, DeviceRow>();
    for (const d of devices) if (d.serial && !m.has(serialKey(d.serial))) m.set(serialKey(d.serial), d);
    return m;
  }, [devices]);
  const scannedKeys = useMemo(() => new Set(count.scans.map((s) => serialKey(s.serial))), [count.scans]);

  function send(items: ScanItem[], label?: string) {
    if (!items.length) return;
    startTransition(async () => {
      const res = await addScans(workspaceId, count.id, items);
      if (!res.ok) return setFlash({ tone: "bad", text: res.error });
      if (label) setFlash({ tone: res.added ? "ok" : "warn", text: `${label}: ${res.added} added${res.repeats ? `, ${res.repeats} already scanned` : ""}.` });
      router.refresh();
    });
  }

  /** Instant feedback for one code, before the server answers. */
  function one(raw: string) {
    const r = parseScan(raw);
    if (r.kind === "empty") return;
    const device = r.kind === "device" ? devices.find((d) => d.id === r.id) : bySerial.get(serialKey(r.serial));
    const key = serialKey(device?.serial ?? (r.kind === "serial" ? r.serial : r.id));
    if (scannedKeys.has(key)) return setFlash({ tone: "warn", text: `${device?.name ?? raw} · already scanned.` });
    if (!device) {
      if (r.kind === "device") return setFlash({ tone: "bad", text: "That label belongs to another workspace." });
      const model = guessModel(r.serial, ctx, null);
      setFlash({ tone: "warn", text: `${r.serial} is not in RackTrack${model ? ` (looks like ${model})` : ""}. Listed under Not recorded.` });
      return send([{ serial: r.serial, model }]);
    }
    if (expectedIds.has(device.id)) setFlash({ tone: "ok", text: `✓ ${device.name} · ${device.serial ?? ""}` });
    else setFlash({ tone: "warn", text: `${device.name}: recorded as ${statusLabel(device.status)}${device.location ? ` at ${device.location}` : ""}. Listed under Wrong place.` });
    send(r.kind === "device" ? [{ deviceId: device.id }] : [{ serial: r.serial }]);
  }

  function onPhoto(r: PhotoResult) {
    const items: ScanItem[] = [...r.items.map((i) => ({ serial: i.serial, model: i.model })), ...r.deviceIds.map((deviceId) => ({ deviceId }))];
    if (items.length) send(items, `Photo: ${items.length} code${items.length === 1 ? "" : "s"} read`);
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const parts = manual.split(/[\n,;\t]+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 1) one(parts[0]);
    else
      send(
        parts.flatMap((p): ScanItem[] => {
          const r = parseScan(p);
          return r.kind === "serial" ? [{ serial: r.serial, model: guessModel(r.serial, ctx, null) }] : r.kind === "device" ? [{ deviceId: r.id }] : [];
        }),
        "Pasted list",
      );
    setManual("");
  }

  function status(to: CountStatus, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    startTransition(async () => {
      const res = await setCountStatus(workspaceId, count.id, to);
      if (!res.ok) return setFlash({ tone: "bad", text: res.error });
      setFlash(null);
      if (to === "review") setTab("missing");
      router.refresh();
    });
  }

  function move(deviceIds: string[], m: Parameters<typeof moveDevices>[2], done: string) {
    if (!deviceIds.length) return;
    startTransition(async () => {
      const res = await moveDevices(workspaceId, deviceIds, m);
      if (!res.ok) return setFlash({ tone: "bad", text: res.error });
      setFlash({ tone: "ok", text: `${res.moved} ${done}` });
      setPicked(new Set());
      router.refresh();
    });
  }

  const note = `Stock opname ${count.scope}`;
  const putHere = (list: DeviceRow[]) => {
    const shelf = list.filter((d) => onShelf(d.status)).map((d) => d.id);
    const back = list.filter((d) => !onShelf(d.status)).map((d) => d.id);
    if (shelf.length) move(shelf, { type: "relocate", locationId: count.locationId ?? "", note }, "moved here.");
    if (back.length) move(back, { type: "checkin", result: "Available", locationId: count.locationId ?? "", note }, "back in stock here.");
  };

  const openMissing = result.missing.filter((m) => !m.fixed && m.device);
  const pickedDevices = openMissing.filter((m) => picked.has(m.exp.id)).map((m) => m.device as DeviceRow);
  const openMisplaced = result.misplaced.filter((m) => !m.fixed);
  const openUnknown = result.unknown.filter((u) => !u.fixed);
  const pct = count.expected.length ? Math.round((result.found.length / count.expected.length) * 100) : 100;

  const tabs: { key: Tab; label: string; n: number; tone: string }[] = [
    { key: "missing", label: scanning ? "Not scanned yet" : "Not found", n: result.missing.length, tone: "text-[#FFB3A6]" },
    { key: "misplaced", label: "Wrong place", n: result.misplaced.length, tone: "text-[#FFE1B8]" },
    { key: "unknown", label: "Not recorded", n: result.unknown.length, tone: "text-[#BDEFF8]" },
    { key: "found", label: "Found", n: result.found.length, tone: "text-[#A6EFCB]" },
  ];
  const scanBy = (s: { by: string | null; scannedAt: string }) => (
    <>
      <LocalTime iso={s.scannedAt} />
      {s.by ? ` · ${s.by}` : ""}
    </>
  );
  const unscan = (scanId: string) =>
    scanning && canEdit ? (
      <button
        type="button"
        className="px-2 text-[#AEB8C5] hover:text-[#FFB3A6]"
        aria-label="Remove this scan"
        disabled={pending}
        onClick={() => startTransition(async () => {
          const res = await removeScan(workspaceId, count.id, scanId);
          if (!res.ok) setFlash({ tone: "bad", text: res.error });
          router.refresh();
        })}
      >
        ✕
      </button>
    ) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-28">
      <div>
        <Link href="/app/opname" className="eyebrow hover:underline">← Stock opname</Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{count.scope}</h1>
          <CountBadge status={count.status} />
        </div>
        <p className="mt-1 text-xs text-[#97A3B3]">
          Started <LocalTime iso={count.startedAt} />
          {count.startedBy ? ` by ${count.startedBy}` : ""}
          {count.note ? ` · ${count.note}` : ""}
        </p>
      </div>

      <section className="lg lg-dark rounded-[22px] p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="font-mono text-3xl font-semibold leading-none text-ink">
              {result.found.length}
              <span className="text-lg text-[#97A3B3]"> / {count.expected.length}</span>
            </div>
            <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-[#97A3B3]">expected devices found</div>
          </div>
          {!scanning && (
            <div className="text-right">
              <div className={`font-mono text-2xl font-semibold leading-none ${result.open ? "text-[#FFE1B8]" : "text-[#6BE3B0]"}`}>{result.open}</div>
              <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-[#97A3B3]">still unclear</div>
            </div>
          )}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-gradient-to-r from-[#F7A23A] to-[#4FD199] transition-all" style={{ width: `${pct}%` }} />
        </div>
      </section>

      {scanning && canEdit && (
        <section className="space-y-3">
          <Scanner onScan={one} paused={pending || sending} />
          <div className="flex flex-wrap items-start gap-2">
            <PhotoScan ctx={ctx} onResult={onPhoto} disabled={pending} />
          </div>
          <form onSubmit={submitManual} className="flex gap-2">
            <label className="sr-only" htmlFor={`${ids}-manual`}>Serial or code</label>
            <textarea
              id={`${ids}-manual`}
              className="input min-h-[42px] font-mono"
              rows={1}
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Type, USB scanner, or paste a list of serials…"
              autoCapitalize="characters"
              spellCheck={false}
            />
            <button type="submit" className="btn-ghost shrink-0" disabled={!manual.trim() || pending}>Add</button>
          </form>
        </section>
      )}

      {flash && (
        <p role="status" aria-live="polite" className={`rounded-xl px-3 py-2 text-sm ${FLASH_STYLES[flash.tone]}`}>
          {flash.text}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Results">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => {
              setTab(t.key);
              setPicked(new Set());
            }}
            className={`chip ${tab === t.key ? "chip-on" : ""}`}
          >
            {t.label}
            <span className={`font-mono ${t.tone}`}>{t.n}</span>
          </button>
        ))}
      </div>

      <section className="lg lg-dark rounded-[22px] px-4 py-2" role="tabpanel">
        {tab === "missing" && (
          <>
            <p className="py-2 text-xs text-[#97A3B3]">
              {scanning
                ? "Should be on the shelf but not scanned yet."
                : "Not found on the shelf. Maybe it went out without being recorded: send it to its project. If nobody knows, mark it missing, or leave it here while you check."}
            </p>
            {fixing && openMissing.length > 0 && (
              <label className="flex items-center gap-2.5 border-t border-white/10 py-2 text-xs text-[#BAC3CF]">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#F7A23A]"
                  checked={picked.size === openMissing.length}
                  onChange={(e) => setPicked(e.target.checked ? new Set(openMissing.map((m) => m.exp.id)) : new Set())}
                />
                Select all {openMissing.length} unclear
              </label>
            )}
            <ul className="divide-y divide-white/10 border-t border-white/10">
              {result.missing.map((m) => (
                <li key={m.exp.id} className="flex items-center gap-2">
                  {fixing && !m.fixed && m.device && (
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-[#F7A23A]"
                      aria-label={`Select ${m.exp.name} ${m.exp.serial ?? ""}`}
                      checked={picked.has(m.exp.id)}
                      onChange={(e) =>
                        setPicked((p) => {
                          const n = new Set(p);
                          if (e.target.checked) n.add(m.exp.id);
                          else n.delete(m.exp.id);
                          return n;
                        })
                      }
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <Row
                      device={m.device}
                      name={m.exp.name}
                      serial={m.exp.serial}
                      sub={
                        m.fixed ? (
                          <span className="text-[#A6EFCB]">
                            {m.device ? `now ${statusLabel(m.device.status)}${m.device.customer ? `: ${m.device.customer}` : ""}` : "deleted"}
                          </span>
                        ) : (
                          `${statusLabel(m.exp.status)}${m.exp.location ? ` · ${m.exp.location}` : ""}`
                        )
                      }
                    />
                  </div>
                </li>
              ))}
              {result.missing.length === 0 && <li className="py-6 text-center text-sm text-[#AEB8C5]">Everything expected was scanned.</li>}
            </ul>
          </>
        )}

        {tab === "misplaced" && (
          <>
            <p className="py-2 text-xs text-[#97A3B3]">Scanned here, but RackTrack has it somewhere else. &quot;Put here&quot; fixes the record.</p>
            {canEdit && openMisplaced.length > 1 && (
              <div className="border-t border-white/10 py-2">
                <button type="button" className="btn-ghost px-3 py-1.5 text-xs" disabled={pending} onClick={() => putHere(openMisplaced.map((m) => m.device))}>
                  Put all {openMisplaced.length} here
                </button>
              </div>
            )}
            <ul className="divide-y divide-white/10 border-t border-white/10">
              {result.misplaced.map((m) => (
                <li key={m.scan.id}>
                  <Row
                    device={m.device}
                    name={m.device.name}
                    serial={m.device.serial}
                    sub={m.fixed ? <span className="text-[#A6EFCB]">fixed</span> : m.why}
                    right={
                      <>
                        {canEdit && !m.fixed && (
                          <button type="button" className="btn-ghost shrink-0 px-3 py-1.5 text-xs" disabled={pending} onClick={() => putHere([m.device])}>
                            Put here
                          </button>
                        )}
                        {unscan(m.scan.id)}
                      </>
                    }
                  />
                </li>
              ))}
              {result.misplaced.length === 0 && <li className="py-6 text-center text-sm text-[#AEB8C5]">Nothing in the wrong place.</li>}
            </ul>
          </>
        )}

        {tab === "unknown" && (
          <>
            <p className="py-2 text-xs text-[#97A3B3]">On the shelf but not in RackTrack. Check the model, then add them to stock.</p>
            {canEdit && openUnknown.length > 0 && (
              <div className="border-t border-white/10 py-3">
                <NewSerials
                  items={openUnknown.map((u) => ({ serial: u.scan.serial, model: u.scan.model ?? guessModel(u.scan.serial, ctx, null) }))}
                  workspaceId={workspaceId}
                  places={places}
                  locationId={count.locationId}
                  models={ctx.models.map((name) => ({ name, category: devices.find((d) => d.name === name)?.category ?? "Lainnya" }))}
                  note={`found in ${note.toLowerCase()}`}
                />
              </div>
            )}
            <ul className="divide-y divide-white/10 border-t border-white/10">
              {result.unknown.map((u) => (
                <li key={u.scan.id}>
                  <Row
                    device={u.device}
                    name={u.device?.name ?? u.scan.model ?? "Unknown model"}
                    serial={u.scan.serial}
                    sub={u.fixed ? <span className="text-[#A6EFCB]">added</span> : scanBy(u.scan)}
                    right={unscan(u.scan.id)}
                  />
                </li>
              ))}
              {result.unknown.length === 0 && <li className="py-6 text-center text-sm text-[#AEB8C5]">Every scanned serial is in RackTrack.</li>}
            </ul>
          </>
        )}

        {tab === "found" && (
          <ul className="divide-y divide-white/10">
            {result.found.map((f) => (
              <li key={f.scan.id}>
                <Row device={f.device} name={f.device.name} serial={f.device.serial} sub={scanBy(f.scan)} right={unscan(f.scan.id)} />
              </li>
            ))}
            {result.found.length === 0 && <li className="py-6 text-center text-sm text-[#AEB8C5]">Nothing scanned yet.</li>}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <a href={`/opname-report/${count.id}`} target="_blank" rel="noopener" className="btn-ghost">Print report</a>
        {canDelete && (
          <button
            type="button"
            className="btn-danger"
            disabled={pending}
            onClick={() => {
              if (!confirm("Delete this count and its scans? Device records stay as they are.")) return;
              startTransition(async () => {
                const res = await deleteCount(workspaceId, count.id);
                if (!res.ok) return setFlash({ tone: "bad", text: res.error });
                router.push("/app/opname");
              });
            }}
          >
            Delete
          </button>
        )}
        {canEdit && count.status === "closed" && (
          <button type="button" className="btn-ghost" disabled={pending} onClick={() => status("review")}>Reopen</button>
        )}
      </div>

      {/* sticky actions: what to do next */}
      {canEdit && count.status !== "closed" && (
        <div className="fixed inset-x-3 bottom-[calc(max(.75rem,env(safe-area-inset-bottom))+4.75rem)] z-40 lg:inset-x-auto lg:bottom-6 lg:left-[calc(17.5rem+2rem)] lg:right-8">
          <div className="lg lg-solid mx-auto flex max-w-3xl items-center justify-end gap-2 rounded-[22px] px-3 py-2.5">
            {scanning ? (
              <>
                <span className="mr-auto font-mono text-xs text-[#BAC3CF]">{count.scans.length} scanned</span>
                <button
                  type="button"
                  className="btn-primary shrink-0"
                  disabled={pending}
                  onClick={() =>
                    status(
                      "review",
                      result.missing.length ? `${result.missing.length} expected device(s) were not scanned. Finish scanning anyway?` : undefined,
                    )
                  }
                >
                  Done scanning
                </button>
              </>
            ) : picked.size > 0 ? (
              <>
                <span className="mr-auto font-mono text-xs text-[#BAC3CF]">{picked.size} selected</span>
                <button
                  type="button"
                  className="btn-ghost shrink-0 px-3"
                  disabled={pending}
                  onClick={() => {
                    if (confirm(`Mark ${picked.size} device(s) as Missing?`)) move(pickedDevices.map((d) => d.id), { type: "status", status: "Hilang", note: `not found in ${note.toLowerCase()}` }, "marked missing.");
                  }}
                >
                  Missing
                </button>
                <button type="button" className="btn-primary shrink-0 px-3" disabled={pending} onClick={() => setSending(true)}>
                  Sent to project
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn-ghost mr-auto shrink-0 px-3" disabled={pending} onClick={() => status("open")}>
                  Scan more
                </button>
                <button
                  type="button"
                  className="btn-primary shrink-0"
                  disabled={pending}
                  onClick={() =>
                    status("closed", result.open ? `${result.open} item(s) are still unclear and will stay as they are. Close the count?` : undefined)
                  }
                >
                  Close count
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {sending && (
        <BulkMoveDialog
          kind="send"
          devices={pickedDevices}
          workspaceId={workspaceId}
          customers={[...new Set(devices.map((d) => d.customer).filter((c): c is string => !!c))].sort()}
          places={places}
          eligibleFor={(d) => onShelf(d.status)}
          defaultNote={`not recorded, found in ${note.toLowerCase()}`}
          offerReceipt={false}
          onDone={() => setPicked(new Set())}
          onClose={() => setSending(false)}
        />
      )}
    </div>
  );
}
