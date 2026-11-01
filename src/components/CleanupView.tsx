"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { findIssues, issueCount, type NameGroup } from "@/lib/cleanup";
import { statusLabel } from "@/lib/categories";
import type { DeviceRow } from "@/lib/types";
import { mergeValues, updateDevice } from "@/app/app/actions";
import { StatusLed } from "./StatusLed";

function Section({ title, hint, count, children }: { title: string; hint: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <section className="lg lg-dark rounded-[22px] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-sm font-semibold tracking-wider">{title}</h2>
        <span className="font-mono text-xs text-[#FFC27A]">{count}</span>
      </div>
      <p className="mt-1 text-sm text-[#AEB8C5]">{hint}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DeviceName({ d }: { d: DeviceRow }) {
  return (
    <div className="min-w-0 flex-1">
      <Link href={`/app/devices/${d.id}`} className="block truncate font-mono text-sm normal-case text-ink hover:text-[#FFC27A]">
        {d.name}
      </Link>
      <div className="flex items-center gap-1.5 truncate text-xs text-[#97A3B3]">
        <StatusLed status={d.status} size={6} />
        {statusLabel(d.status)}
        {d.serial && <span className="font-mono"> · {d.serial}</span>}
      </div>
    </div>
  );
}

// "Not the same" choices are remembered per browser only (a convenience, not shared data).
const DISMISS_KEY = (ws: string) => `rt-cleanup-dismissed:${ws}`;
const groupKey = (field: string, g: NameGroup) => `${field}:${g.names.map((n) => n.name).sort().join("|")}`;

export function readDismissed(workspaceId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY(workspaceId)) ?? "[]");
  } catch {
    return []; // storage unavailable: nothing remembered
  }
}

/** Issues worth a dashboard nudge: inconsistencies and undismissed look-alike names (missing out dates don't nag). */
export function nudgeCount(devices: DeviceRow[], dismissed: string[]): number {
  const i = findIssues(devices);
  const open = (field: string, groups: NameGroup[]) => groups.filter((g) => !dismissed.includes(groupKey(field, g))).length;
  return (
    i.strayCustomer.length +
    i.duplicateSerials.length +
    open("customer", i.similarCustomers) +
    open("location", i.similarLocations)
  );
}

export function CleanupView({ devices, workspaceId, canEdit }: { devices: DeviceRow[]; workspaceId: string; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [keep, setKeep] = useState<Record<string, string>>({});
  const [dates, setDates] = useState<Record<string, string>>({});

  useEffect(() => setDismissed(readDismissed(workspaceId)), [workspaceId]);

  const issues = useMemo(() => findIssues(devices), [devices]);
  const customerGroups = issues.similarCustomers.filter((g) => !dismissed.includes(groupKey("customer", g)));
  const locationGroups = issues.similarLocations.filter((g) => !dismissed.includes(groupKey("location", g)));
  const total = issueCount({ ...issues, similarCustomers: customerGroups, similarLocations: locationGroups });

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, done?: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (done) setNotice(done);
      router.refresh();
    });
  }

  function dismiss(key: string) {
    const next = [...dismissed, key];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISS_KEY(workspaceId), JSON.stringify(next));
    } catch {
      /* not remembered; fine */
    }
  }

  function mergeGroups(field: "customer" | "location", groups: NameGroup[]) {
    return (
      <ul className="space-y-3">
        {groups.map((g) => {
          const key = groupKey(field, g);
          const chosen = keep[key] ?? g.names[0].name;
          return (
            <li key={key} className="rounded-xl bg-black/20 p-3">
              <fieldset disabled={!canEdit || pending}>
                <legend className="sr-only">Pick the name to keep</legend>
                <div className="space-y-1.5">
                  {g.names.map((n) => (
                    <label key={n.name} className="flex cursor-pointer items-center gap-2.5 text-sm">
                      <input
                        type="radio"
                        name={key}
                        checked={chosen === n.name}
                        onChange={() => setKeep({ ...keep, [key]: n.name })}
                        className="accent-[#EF9B3E]"
                      />
                      <span className="min-w-0 flex-1 truncate text-ink">{n.name}</span>
                      <span className="font-mono text-xs text-[#97A3B3]">{n.count} device{n.count === 1 ? "" : "s"}</span>
                    </label>
                  ))}
                </div>
                {canEdit && (
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => dismiss(key)}>
                      Not the same
                    </button>
                    <button
                      type="button"
                      className="btn-primary px-3 py-1.5 text-xs"
                      onClick={() =>
                        run(
                          () => mergeValues(workspaceId, { field, from: g.names.map((n) => n.name), to: chosen }),
                          `Merged into “${chosen}”.`,
                        )
                      }
                    >
                      Merge into “{chosen.length > 24 ? `${chosen.slice(0, 24)}…` : chosen}”
                    </button>
                  </div>
                )}
              </fieldset>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-5">
        <div className="eyebrow">Data cleanup</div>
        <h1 className="mt-1.5 font-mono text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
          {total === 0 ? "All clean" : `${total} thing${total === 1 ? "" : "s"} to check`}
        </h1>
        <p className="mt-2 text-sm text-[#BAC3CF]">
          Inconsistent or incomplete records. Every fix is written to the device's history.
          {!canEdit && " Viewers can look, but only editors and admins can fix."}
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red/15 px-3 py-2 text-sm text-[#FFB3A6] shadow-[inset_0_0_0_1px_rgba(240,102,76,.55)]">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-green/15 px-3 py-2 text-sm text-[#A6EFCB] shadow-[inset_0_0_0_1px_rgba(79,209,153,.5)]">
          {notice}
        </p>
      )}

      {total === 0 && (
        <div className="lg lg-dark p-10 text-center">
          <p className="text-sm text-[#BAC3CF]">Nothing inconsistent found. Stock and customer records are separate and complete.</p>
          <Link href="/app" className="btn-ghost mt-5 inline-flex">
            Back to dashboard
          </Link>
        </div>
      )}

      <Section
        title="Similar customer names"
        hint="These look like the same customer spelled differently. Pick the name to keep and merge."
        count={customerGroups.length}
      >
        {mergeGroups("customer", customerGroups)}
      </Section>

      <Section
        title="Similar locations"
        hint="These look like the same place spelled differently."
        count={locationGroups.length}
      >
        {mergeGroups("location", locationGroups)}
      </Section>

      <Section
        title="Stock with leftover customer details"
        hint="Not at a customer, but customer, contact or dates are still filled in. Clearing them keeps stock and customers apart."
        count={issues.strayCustomer.length}
      >
        <ul className="divide-y divide-white/10">
          {issues.strayCustomer.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <DeviceName d={d} />
              <span className="max-w-[12rem] truncate text-xs text-[#BAC3CF]">
                {[d.customer, d.outDate && `out ${d.outDate}`, d.returnDate && `due ${d.returnDate}`].filter(Boolean).join(" · ")}
              </span>
              {canEdit && (
                <button
                  type="button"
                  className="btn-ghost px-3 py-1.5 text-xs"
                  disabled={pending}
                  onClick={() => run(() => updateDevice(workspaceId, d.id, d), `Cleared customer details on ${d.name}.`)}
                >
                  Clear details
                </button>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="At a customer, no out date"
        hint="Add when it went out, so “Since” on the Customers page is right. Leave it if you don't know."
        count={issues.noOutDate.length}
      >
        <ul className="divide-y divide-white/10">
          {issues.noOutDate.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <DeviceName d={d} />
              <span className="max-w-[10rem] truncate text-xs text-[#BAC3CF]">{d.customer}</span>
              {canEdit && (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() => updateDevice(workspaceId, d.id, { ...d, outDate: dates[d.id] }), `Out date saved for ${d.name}.`);
                  }}
                >
                  <input
                    type="date"
                    aria-label={`Out date for ${d.name}`}
                    className="input w-auto py-1.5 text-xs"
                    value={dates[d.id] ?? ""}
                    onChange={(e) => setDates({ ...dates, [d.id]: e.target.value })}
                    required
                  />
                  <button type="submit" className="btn-ghost px-3 py-1.5 text-xs" disabled={pending}>
                    Save
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Duplicate serial numbers"
        hint="More than one device with the same serial, often from importing the same sheet twice. Open them and delete the extra."
        count={issues.duplicateSerials.length}
      >
        <ul className="space-y-3">
          {issues.duplicateSerials.map((g) => (
            <li key={g.serial} className="rounded-xl bg-black/20 p-3">
              <div className="mb-2 font-mono text-xs text-[#FFC27A]">{g.serial}</div>
              <ul className="space-y-1.5">
                {g.devices.map((d) => (
                  <li key={d.id} className="flex">
                    <DeviceName d={d} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
