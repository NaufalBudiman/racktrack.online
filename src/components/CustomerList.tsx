"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { customerRows } from "@/lib/stats";
import type { DeviceRow } from "@/lib/types";
import { OverdueBadge } from "./DeviceCard";

function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const SORTS = {
  attention: "Needs attention",
  devices: "Most devices",
  name: "Name",
} as const;
type Sort = keyof typeof SORTS;

export function CustomerList({ devices, workspaceName }: { devices: DeviceRow[]; workspaceName: string }) {
  const [today, setToday] = useState(""); // set after mount to avoid hydration mismatch
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("attention");
  useEffect(() => setToday(localToday()), []);

  const all = useMemo(() => customerRows(devices, today), [devices, today]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? all.filter((c) => c.name.toLowerCase().includes(needle)) : [...all];
    if (sort === "devices") list.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    return list; // "attention" is customerRows' own order
  }, [all, q, sort]);

  const atCustomers = all.reduce((n, c) => n + c.total, 0);
  const overdue = all.reduce((n, c) => n + c.overdue, 0);

  return (
    <div className="space-y-4">
      <div className="mb-5">
        <div className="eyebrow">Customers</div>
        <h1 className="mt-1.5 break-words font-mono text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{workspaceName}</h1>
        <p className="mt-2 font-mono text-xs text-[#AEB8C5]">
          {all.length} customers · {atCustomers} devices out
          {overdue > 0 && <span className="text-[#FFB3A6]"> · {overdue} overdue</span>}
        </p>
      </div>

      <div className="lg lg-dark flex flex-col gap-2.5 rounded-[22px] p-2.5 sm:flex-row sm:items-center">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search customers…"
          aria-label="Search customers"
          className="input flex-1"
        />
        <select aria-label="Sort" className="input sm:w-48" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          {Object.entries(SORTS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {all.length === 0 ? (
        <div className="lg lg-dark p-10 text-center">
          <h2 className="font-mono text-lg font-semibold">No devices at customers</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#BAC3CF]">
            Open a device in stock and use “Send to customer”. Customers show up here automatically.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-10 text-center text-sm text-[#AEB8C5]">No customers match “{q}”.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <li key={c.name}>
              <Link
                href={`/app/devices?customer=${encodeURIComponent(c.name)}`}
                className={`lg lg-dark group block h-full rounded-[20px] p-4 transition hover:-translate-y-0.5 hover:bg-white/[.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber ${
                  c.overdue ? "outline outline-1 outline-red/50" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 text-[15px] font-semibold text-ink transition group-hover:text-[#FFC27A]">
                    <span className="line-clamp-2 break-words">{c.name}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-2xl font-semibold leading-none text-[#FFE1B8]">{c.total}</div>
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-[#97A3B3]">devices</div>
                  </div>
                </div>
                <dl className="mt-3 space-y-1 rounded-xl bg-black/20 px-3 py-2 text-xs text-[#AEB8C5]">
                  <div className="flex gap-2">
                    <dt className="w-14 shrink-0 font-mono text-[10px] uppercase leading-4 tracking-wider">Type</dt>
                    <dd className="text-ink/85">
                      {c.loans === 0 ? "Installed" : c.loans === c.total ? "Loan" : `${c.loans} loan · ${c.total - c.loans} installed`}
                    </dd>
                  </div>
                  {c.since && (
                    <div className="flex gap-2">
                      <dt className="w-14 shrink-0 font-mono text-[10px] uppercase leading-4 tracking-wider">Since</dt>
                      <dd className="text-ink/85">{c.since}</dd>
                    </div>
                  )}
                  {c.nextDue && (
                    <div className="flex items-center gap-2">
                      <dt className="w-14 shrink-0 font-mono text-[10px] uppercase leading-4 tracking-wider">Due</dt>
                      <dd className="flex items-center gap-2 text-ink/85">
                        {c.nextDue}
                        {c.overdue > 0 && <OverdueBadge />}
                      </dd>
                    </div>
                  )}
                  {c.missing > 0 && (
                    <div className="flex gap-2">
                      <dt className="w-14 shrink-0 font-mono text-[10px] uppercase leading-4 tracking-wider">Lost</dt>
                      <dd className="text-[#FFB3A6]">{c.missing} missing here</dd>
                    </div>
                  )}
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
