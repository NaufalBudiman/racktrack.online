"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProject, updateProject } from "@/app/app/projects/actions";
import { ASSIGNMENT_LABELS, statusLabel } from "@/lib/categories";
import { modelKey } from "@/lib/models";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, type ProjectDetailData, type ProjectStatus } from "@/lib/projectTypes";
import type { DeviceRow } from "@/lib/types";
import { OverdueBadge, isOverdue } from "./DeviceCard";
import { StatusBadge } from "./ProjectList";
import { ShareButton } from "./ShareDialog";
import { StatusLed } from "./StatusLed";
import { Timeline } from "./Timeline";

function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="lg lg-dark rounded-[22px] p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-sm font-semibold tracking-wider">{title}</h2>
        {hint && <span className="font-mono text-[11px] text-[#97A3B3]">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/** Units grouped by model name, biggest group first. */
function byModel(list: DeviceRow[]) {
  const map = new Map<string, { name: string; units: DeviceRow[] }>();
  for (const d of list) {
    const k = modelKey(d.name);
    const g = map.get(k) ?? { name: d.name, units: [] };
    g.units.push(d);
    map.set(k, g);
  }
  return [...map.values()].sort((a, b) => b.units.length - a.units.length || a.name.localeCompare(b.name));
}

function UnitLine({ d, today, extra }: { d: DeviceRow; today: string; extra: React.ReactNode }) {
  return (
    <li>
      <Link href={`/app/devices/${d.id}`} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-white/[.05]">
        <span className="mt-1.5">
          <StatusLed status={d.status} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="break-words font-mono text-sm normal-case text-ink">{d.serial ?? "no serial"}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#AEB8C5]">
            {extra}
            {isOverdue(d, today) && <OverdueBadge />}
          </div>
        </div>
      </Link>
    </li>
  );
}

export function ProjectDetail({
  data,
  members,
  workspaceId,
  canEdit,
  canShare,
}: {
  data: ProjectDetailData;
  members: { id: string; name: string }[];
  workspaceId: string;
  canEdit: boolean;
  canShare: boolean;
}) {
  const { project: p, current, returned, history, receipts } = data;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [today, setToday] = useState("");
  useEffect(() => setToday(localToday()), []);

  const [form, setForm] = useState({
    name: p.name,
    status: p.status,
    city: p.city ?? "",
    company: p.company ?? "",
    address: p.address ?? "",
    attnName: p.attnName ?? "",
    attnPhone: p.attnPhone ?? "",
    picUserId: p.picUserId ?? "",
    startDate: p.startDate ?? "",
    endDate: p.endDate ?? "",
    notes: p.notes ?? "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const groups = useMemo(() => byModel(current), [current]);
  const overdue = current.filter((d) => isOverdue(d, today)).length;
  const onSite = current.filter((d) => d.status === "In Use").length;

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      after?.();
      router.refresh();
    });
  }
  const save = (patch: Partial<typeof form> = {}) =>
    run(() => updateProject(workspaceId, p.id, { ...form, ...patch }), () => setEditing(false));

  const meta = [
    p.city,
    p.pic && `PIC ${p.pic}`,
    (p.startDate || p.endDate) && `${p.startDate ?? "?"} → ${p.endDate ?? "now"}`,
  ].filter(Boolean);
  const lab = "mb-1 block font-mono text-[10px] uppercase tracking-widest text-[#AEB8C5]";

  return (
    <div className="space-y-4">
      <div>
        <Link href="/app/projects" className="font-mono text-xs text-[#FFC27A] hover:underline">
          ← Projects
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="eyebrow">Project</span>
              <StatusBadge status={p.status} />
            </div>
            <h1 className="mt-1.5 break-words font-mono text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{p.name}</h1>
            {meta.length > 0 && <p className="mt-1 text-sm text-[#BAC3CF]">{meta.join(" · ")}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {canShare && current.length > 0 && (
              <ShareButton workspaceId={workspaceId} fixed={{ kind: "customer", target: p.name, title: p.name }} />
            )}
            {canEdit && onSite > 0 && (
              <Link href={`/app/projects/${p.id}/receipt`} className="btn-ghost">
                Tanda terima
              </Link>
            )}
            {canEdit && (
              <>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={pending}
                  onClick={() => save({ status: p.status === "active" ? "done" : "active" })}
                >
                  {p.status === "active" ? "Mark done" : "Reopen"}
                </button>
                <button type="button" className="btn-primary" onClick={() => setEditing((v) => !v)}>
                  Edit
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red/15 px-3 py-2 text-sm text-[#FFB3A6] shadow-[inset_0_0_0_1px_rgba(240,102,76,.55)]">
          {error}
        </p>
      )}

      {editing && (
        <form
          className="lg lg-dark grid gap-3 rounded-[22px] p-5 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label className="sm:col-span-2">
            <span className={lab}>Name (customer)</span>
            <input className="input" value={form.name} onChange={set("name")} maxLength={200} required />
            {form.name.trim() !== p.name && (
              <span className="mt-1 block text-xs text-[#FFE1B8]">Renaming also renames the customer on every device here.</span>
            )}
          </label>
          <label>
            <span className={lab}>Status</span>
            <select className="input" value={form.status} onChange={set("status")}>
              {PROJECT_STATUSES.map((s: ProjectStatus) => (
                <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </label>
          <label>
            <span className={lab}>PIC / technician</span>
            <select className="input" value={form.picUserId} onChange={set("picUserId")}>
              <option value="">No one</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span className={lab}>City</span>
            <input className="input" value={form.city} onChange={set("city")} maxLength={80} placeholder="e.g. Palembang" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className={lab}>Start</span>
              <input type="date" className="input" value={form.startDate} onChange={set("startDate")} />
            </label>
            <label>
              <span className={lab}>End</span>
              <input type="date" className="input" value={form.endDate} onChange={set("endDate")} />
            </label>
          </div>
          <label className="sm:col-span-2">
            <span className={lab}>Company (for tanda terima)</span>
            <input className="input" value={form.company} onChange={set("company")} maxLength={200} placeholder={form.name} />
          </label>
          <label className="sm:col-span-2">
            <span className={lab}>Address</span>
            <textarea className="input min-h-16" value={form.address} onChange={set("address")} maxLength={500} />
          </label>
          <label>
            <span className={lab}>U.p. (contact person)</span>
            <input className="input" value={form.attnName} onChange={set("attnName")} maxLength={120} />
          </label>
          <label>
            <span className={lab}>Contact phone</span>
            <input className="input" value={form.attnPhone} onChange={set("attnPhone")} maxLength={40} inputMode="tel" />
          </label>
          <label className="sm:col-span-2">
            <span className={lab}>Notes</span>
            <textarea className="input min-h-20" value={form.notes} onChange={set("notes")} maxLength={2000} />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
            <div>
              {current.length === 0 &&
                (confirmDelete ? (
                  <span className="flex items-center gap-2">
                    <span className="text-sm text-[#FFB3A6]">Delete project?</span>
                    <button
                      type="button"
                      className="btn-danger"
                      disabled={pending}
                      onClick={() => run(() => deleteProject(workspaceId, p.id), () => router.push("/app/projects"))}
                    >
                      Yes, delete
                    </button>
                  </span>
                ) : (
                  <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(true)}>
                    Delete
                  </button>
                ))}
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </form>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["On site now", onSite, "#FFE1B8"],
          ["Used in total", p.used, "#F1F4F8"],
          ["Returned", returned.length, "#A6EFCB"],
          ["Overdue", overdue, overdue ? "#FFB3A6" : "#F1F4F8"],
        ].map(([k, v, c]) => (
          <div key={k as string} className="lg lg-dark rounded-[20px] p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[#AEB8C5]">{k}</div>
            <div className="mt-1 font-mono text-2xl font-semibold" style={{ color: c as string }}>{v}</div>
          </div>
        ))}
      </div>

      {p.notes && !editing && (
        <Panel title="Notes">
          <p className="whitespace-pre-wrap text-sm text-[#BAC3CF]">{p.notes}</p>
        </Panel>
      )}

      <Panel title="On site now" hint={current.length ? `${current.length} unit${current.length === 1 ? "" : "s"}` : undefined}>
        {groups.length === 0 ? (
          <p className="text-sm text-[#AEB8C5]">
            Nothing here right now. Open a device in stock and use “Send to project”.
          </p>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.name}>
                <div className="flex items-baseline justify-between gap-2 border-b border-white/10 pb-1.5">
                  <span className="break-words font-medium normal-case text-ink">{g.name}</span>
                  <span className="shrink-0 font-mono text-sm text-[#FFE1B8]">×{g.units.length}</span>
                </div>
                <ul className="mt-1">
                  {g.units.map((d) => (
                    <UnitLine
                      key={d.id}
                      d={d}
                      today={today}
                      extra={
                        d.status === "Hilang" ? (
                          <span className="text-[#FFB3A6]">Missing here</span>
                        ) : (
                          <span>
                            {d.assignment ? ASSIGNMENT_LABELS[d.assignment] : "Out"}
                            {d.outDate && ` since ${d.outDate}`}
                            {d.assignment === "loan" && d.returnDate && ` · due ${d.returnDate}`}
                          </span>
                        )
                      }
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {returned.length > 0 && (
        <Panel title="Used here before" hint="now elsewhere">
          <ul>
            {returned.map((d) => (
              <UnitLine
                key={d.id}
                d={d}
                today={today}
                extra={
                  <>
                    <span className="normal-case text-ink/85">{d.name}</span>
                    <span>
                      now {statusLabel(d.status)}
                      {d.status === "In Use" && d.customer ? ` at ${d.customer}` : d.location ? ` · ${d.location}` : ""}
                    </span>
                  </>
                }
              />
            ))}
          </ul>
        </Panel>
      )}

      {receipts.length > 0 && (
        <Panel title="Tanda terima" hint={`${receipts.filter((r) => !r.signedAt).length} waiting for signed photo`}>
          <ul className="divide-y divide-white/10">
            {receipts.map((r) => (
              <li key={r.id}>
                <Link href={`/receipt/${r.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2.5 hover:bg-white/[.05]">
                  <span className="font-mono text-sm text-ink">{r.number}</span>
                  <span className="font-mono text-[11px] text-[#97A3B3]">
                    {r.date} · {r.units} unit
                  </span>
                  <span className="flex-1" />
                  {r.signedAt ? (
                    <span className="rounded-md bg-green/15 px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-[#A6EFCB]">Signed</span>
                  ) : (
                    <span className="rounded-md bg-amber/15 px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-[#FFE1B8]">Waiting photo</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Activity">
        <Timeline items={history} showDevice />
      </Panel>
    </div>
  );
}
