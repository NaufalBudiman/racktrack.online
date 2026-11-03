"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createReceipt } from "@/app/app/receipts/actions";
import { modelKey } from "@/lib/models";
import type { ProjectRow } from "@/lib/projectTypes";
import type { DeviceRow } from "@/lib/types";

export function ReceiptForm({
  workspaceId,
  project: p,
  devices,
  defaults,
  preselected,
  settingsMissing,
  canSetup,
}: {
  workspaceId: string;
  project: ProjectRow;
  devices: DeviceRow[];
  defaults: { date: string; city: string; senderName: string; suggestedNumber: string };
  preselected?: string[]; // device ids just sent here (bulk send); default = everything on site
  settingsMissing: boolean;
  canSetup: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(() => {
    const on = devices.map((d) => d.id);
    const pre = preselected && on.filter((id) => preselected.includes(id));
    return new Set(pre?.length ? pre : on);
  });
  const [f, setF] = useState({
    company: p.company ?? p.name,
    address: p.address ?? "",
    attnName: p.attnName ?? "",
    attnPhone: p.attnPhone ?? "",
    number: "",
    date: defaults.date,
    city: defaults.city,
    senderName: defaults.senderName,
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));

  const groups = useMemo(() => {
    const m = new Map<string, { name: string; units: DeviceRow[] }>();
    for (const d of devices) {
      const k = modelKey(d.name);
      const g = m.get(k) ?? { name: d.name, units: [] };
      g.units.push(d);
      m.set(k, g);
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [devices]);

  const toggle = (ids: string[], on: boolean) =>
    setPicked((s) => {
      const n = new Set(s);
      ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
      return n;
    });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createReceipt(workspaceId, p.id, { ...f, deviceIds: [...picked] });
      if (!res.ok) return setError(res.error);
      router.push(`/receipt/${res.id}`);
    });
  }

  const lab = "mb-1 block font-mono text-[10px] uppercase tracking-widest text-[#AEB8C5]";

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href={`/app/projects/${p.id}`} className="font-mono text-xs text-[#FFC27A] hover:underline">
          ← {p.name}
        </Link>
        <div className="eyebrow mt-4">Tanda terima</div>
        <h1 className="mt-1.5 break-words font-mono text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">New receipt</h1>
      </div>

      {settingsMissing && (
        <p className="rounded-xl bg-amber/10 px-3 py-2 text-sm text-[#FFE1B8] shadow-[inset_0_0_0_1px_rgba(239,155,62,.45)]">
          No letterhead set yet.{" "}
          {canSetup ? (
            <Link href="/app/team#receipts" className="underline">Set it up on the Team page</Link>
          ) : (
            "Ask an admin to set it up on the Team page"
          )}{" "}
          (company name, letterhead image, WhatsApp number for the signed photo).
        </p>
      )}

      <section className="lg lg-dark grid gap-3 rounded-[22px] p-5 sm:grid-cols-2">
        <h2 className="font-mono text-sm font-semibold tracking-wider sm:col-span-2">Kepada (recipient)</h2>
        <label className="sm:col-span-2">
          <span className={lab}>Company *</span>
          <input className="input" value={f.company} onChange={set("company")} maxLength={200} required />
        </label>
        <label className="sm:col-span-2">
          <span className={lab}>Address</span>
          <textarea className="input min-h-16" value={f.address} onChange={set("address")} maxLength={500} />
        </label>
        <label>
          <span className={lab}>U.p. (contact person)</span>
          <input className="input" value={f.attnName} onChange={set("attnName")} maxLength={120} />
        </label>
        <label>
          <span className={lab}>Contact phone</span>
          <input className="input" value={f.attnPhone} onChange={set("attnPhone")} maxLength={40} inputMode="tel" />
        </label>
        <p className="text-xs text-[#AEB8C5] sm:col-span-2">Saved on the project for next time.</p>
      </section>

      <section className="lg lg-dark rounded-[22px] p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-mono text-sm font-semibold tracking-wider">Items</h2>
          <span className="font-mono text-[11px] text-[#97A3B3]">
            {picked.size} of {devices.length} selected
          </span>
        </div>
        {devices.length === 0 ? (
          <p className="text-sm text-[#AEB8C5]">
            No devices on site. Send devices to this project first, then make the receipt.
          </p>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => {
              const ids = g.units.map((d) => d.id);
              const all = ids.every((id) => picked.has(id));
              return (
                <div key={g.name}>
                  <label className="flex items-center gap-2.5 border-b border-white/10 pb-1.5">
                    <input type="checkbox" className="h-4 w-4 accent-[#F7A23A]" checked={all} onChange={(e) => toggle(ids, e.target.checked)} />
                    <span className="flex-1 break-words font-medium normal-case text-ink">{g.name}</span>
                    <span className="font-mono text-sm text-[#FFE1B8]">{ids.filter((id) => picked.has(id)).length} unit</span>
                  </label>
                  <ul className="mt-1 grid gap-x-4 sm:grid-cols-2">
                    {g.units.map((d) => (
                      <li key={d.id}>
                        <label className="flex items-center gap-2.5 py-1 pl-6 text-sm">
                          <input type="checkbox" className="h-4 w-4 accent-[#F7A23A]" checked={picked.has(d.id)} onChange={(e) => toggle([d.id], e.target.checked)} />
                          <span className="break-all font-mono text-[#BAC3CF]">{d.serial ?? "no serial"}</span>
                          {d.outDate && <span className="ml-auto shrink-0 font-mono text-[10.5px] text-[#97A3B3]">{d.outDate}</span>}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="lg lg-dark grid gap-3 rounded-[22px] p-5 sm:grid-cols-2">
        <label>
          <span className={lab}>Number</span>
          <input className="input font-mono" value={f.number} onChange={set("number")} placeholder={defaults.suggestedNumber} maxLength={80} />
          <span className="mt-1 block text-xs text-[#AEB8C5]">Leave empty for {defaults.suggestedNumber}</span>
        </label>
        <label>
          <span className={lab}>Date</span>
          <input type="date" className="input" value={f.date} onChange={set("date")} required />
        </label>
        <label>
          <span className={lab}>City</span>
          <input className="input" value={f.city} onChange={set("city")} maxLength={80} placeholder="e.g. Bekasi" />
        </label>
        <label>
          <span className={lab}>Diserahkan (handed over by)</span>
          <input className="input" value={f.senderName} onChange={set("senderName")} maxLength={120} />
        </label>
      </section>

      {error && (
        <p role="alert" className="rounded-xl bg-red/15 px-3 py-2 text-sm text-[#FFB3A6] shadow-[inset_0_0_0_1px_rgba(240,102,76,.55)]">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Link href={`/app/projects/${p.id}`} className="btn-ghost">Cancel</Link>
        <button type="submit" className="btn-primary" disabled={pending || picked.size === 0}>
          {pending ? "Creating…" : "Create & print"}
        </button>
      </div>
    </form>
  );
}
