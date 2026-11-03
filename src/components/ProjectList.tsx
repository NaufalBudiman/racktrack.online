"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "@/app/app/projects/actions";
import { PROJECT_STATUS_LABELS, type ProjectRow, type ProjectStatus } from "@/lib/projectTypes";
import { OverdueBadge } from "./DeviceCard";
import { ShareButton } from "./ShareDialog";

function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const FILTERS = { all: "All", active: "Active", done: "Done" } as const;
type Filter = keyof typeof FILTERS;

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={`rounded-md px-1.5 py-px font-mono text-[10px] font-semibold uppercase tracking-wider ${
        status === "active"
          ? "bg-green/15 text-[#A6EFCB] shadow-[inset_0_0_0_1px_rgba(79,209,153,.5)]"
          : "bg-white/10 text-[#C3CBD6]"
      }`}
    >
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}

export function ProjectList({
  projects,
  workspaceName,
  workspaceId,
  canEdit,
  canShare,
}: {
  projects: ProjectRow[];
  workspaceName: string;
  workspaceId: string;
  canEdit: boolean;
  canShare: boolean;
}) {
  const router = useRouter();
  const [today, setToday] = useState(""); // after mount, to avoid hydration mismatch
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCity, setNewCity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => setToday(localToday()), []);

  const overdueOf = (p: ProjectRow) => (today ? p.overdueCandidates.filter((d) => d.returnDate < today).length : 0);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return projects.filter(
      (p) =>
        (filter === "all" || p.status === filter) &&
        (!needle || [p.name, p.city, p.pic].some((v) => v?.toLowerCase().includes(needle))),
    );
  }, [projects, q, filter]);

  const active = projects.filter((p) => p.status === "active").length;
  const out = projects.reduce((n, p) => n + p.now, 0);
  const shareable = projects.filter((p) => p.now + p.missing > 0).map((p) => p.name).sort((a, b) => a.localeCompare(b));

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createProject(workspaceId, { name: newName, city: newCity, status: "active" });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/app/projects/${res.id}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow">Projects</div>
          <h1 className="mt-1.5 break-words font-mono text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{workspaceName}</h1>
          <p className="mt-2 font-mono text-xs text-[#AEB8C5]">
            {active} active · {projects.length - active} done · {out} devices out
          </p>
        </div>
        <div className="flex gap-2">
          {canShare && shareable.length > 0 && (
            <ShareButton workspaceId={workspaceId} customers={shareable} initial={{ kind: "customer", target: shareable[0] }} />
          )}
          {canEdit && (
            <button type="button" className="btn-primary" onClick={() => setAdding((v) => !v)}>
              + New project
            </button>
          )}
        </div>
      </div>

      {adding && (
        <form onSubmit={add} className="lg lg-dark flex flex-col gap-2 rounded-[22px] p-3 sm:flex-row">
          <label className="sr-only" htmlFor="np-name">Project name</label>
          <input id="np-name" className="input" placeholder="Project / customer, e.g. UT Palembang" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={200} required autoFocus />
          <label className="sr-only" htmlFor="np-city">City</label>
          <input id="np-city" className="input sm:w-48" placeholder="City (optional)" value={newCity} onChange={(e) => setNewCity(e.target.value)} maxLength={80} />
          <button type="submit" className="btn-primary shrink-0" disabled={pending}>
            {pending ? "Creating…" : "Create"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-red/15 px-3 py-2 text-sm text-[#FFB3A6] shadow-[inset_0_0_0_1px_rgba(240,102,76,.55)]">
          {error}
        </p>
      )}

      <div className="lg lg-dark flex flex-col gap-2.5 rounded-[22px] p-2.5 sm:flex-row sm:items-center">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search project, city or PIC…"
          aria-label="Search projects"
          className="input flex-1"
        />
        <div className="flex gap-1.5" role="group" aria-label="Status">
          {(Object.keys(FILTERS) as Filter[]).map((f) => (
            <button key={f} type="button" className={`chip ${filter === f ? "chip-on" : ""}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {FILTERS[f]}
            </button>
          ))}
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="lg lg-dark p-10 text-center">
          <h2 className="font-mono text-lg font-semibold">No projects yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#BAC3CF]">
            Create one above, or open a device in stock and use “Send to project”. Projects show up here automatically.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-10 text-center text-sm text-[#AEB8C5]">No projects match.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => {
            const overdue = overdueOf(p);
            return (
              <li key={p.id}>
                <Link
                  href={`/app/projects/${p.id}`}
                  className={`lg lg-dark group block h-full rounded-[20px] p-4 transition hover:-translate-y-0.5 hover:bg-white/[.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber ${
                    overdue ? "outline outline-1 outline-red/50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold text-ink transition group-hover:text-[#FFC27A]">
                        <span className="line-clamp-2 break-words">{p.name}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={p.status} />
                        {overdue > 0 && <OverdueBadge />}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-2xl font-semibold leading-none text-[#FFE1B8]">{p.now}</div>
                      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-[#97A3B3]">on site</div>
                    </div>
                  </div>
                  <dl className="mt-3 space-y-1 rounded-xl bg-black/20 px-3 py-2 text-xs text-[#AEB8C5]">
                    {(p.city || p.pic) && (
                      <div className="flex gap-2">
                        <dt className="w-14 shrink-0 font-mono text-[10px] uppercase leading-4 tracking-wider">Where</dt>
                        <dd className="text-ink/85">{[p.city, p.pic && `PIC ${p.pic}`].filter(Boolean).join(" · ")}</dd>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <dt className="w-14 shrink-0 font-mono text-[10px] uppercase leading-4 tracking-wider">Used</dt>
                      <dd className="text-ink/85">
                        {p.used} device{p.used === 1 ? "" : "s"} in total
                        {p.missing > 0 && <span className="text-[#FFB3A6]"> · {p.missing} missing</span>}
                      </dd>
                    </div>
                    {p.lastActivity && (
                      <div className="flex gap-2">
                        <dt className="w-14 shrink-0 font-mono text-[10px] uppercase leading-4 tracking-wider">Latest</dt>
                        <dd className="text-ink/85">{p.lastActivity.slice(0, 10)}</dd>
                      </div>
                    )}
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
