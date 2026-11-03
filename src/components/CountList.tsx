"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startCount } from "@/app/app/opname/actions";
import { COUNT_STATUS_LABELS, type CountRow, type CountStatus } from "@/lib/countTypes";
import type { Place } from "@/lib/places";
import { LocalTime } from "./LocalTime";
import { PlaceSelect } from "./PlaceSelect";

export function CountBadge({ status }: { status: CountStatus }) {
  const tone = {
    open: "bg-amber/15 text-[#FFE1B8] shadow-[inset_0_0_0_1px_rgba(239,155,62,.5)]",
    review: "bg-cyan/15 text-[#BDEFF8] shadow-[inset_0_0_0_1px_rgba(93,201,224,.5)]",
    closed: "bg-white/10 text-[#C3CBD6]",
  }[status];
  return (
    <span className={`rounded-md px-1.5 py-px font-mono text-[10px] font-semibold uppercase tracking-wider ${tone}`}>
      {COUNT_STATUS_LABELS[status]}
    </span>
  );
}

/** Stock opname list + "start a count". */
export function CountList({
  counts,
  places,
  workspaceId,
  canEdit,
}: {
  counts: CountRow[];
  places: Place[];
  workspaceId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [locationId, setLocationId] = useState(() => places.find((p) => !p.parentId)?.id ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await startCount(workspaceId, { locationId, note });
      if (!res.ok) return setError(res.error);
      router.push(`/app/opname/${res.id}`);
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <div className="eyebrow">Stock opname</div>
        <h1 className="mt-1.5 font-mono text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">Count the warehouse</h1>
        <p className="mt-2 max-w-xl text-sm text-[#AEB8C5]">
          Scan every serial on the shelf. RackTrack compares it with what should be there (In Stock, Internal Use and Faulty
          devices in that location) and shows what&apos;s missing, misplaced or not recorded yet, with one-tap fixes.
        </p>
      </div>

      {canEdit && (
        <form onSubmit={start} className="lg lg-dark grid gap-3 rounded-[22px] p-4 sm:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="label">Area to count</span>
            <PlaceSelect places={places} value={locationId} onChange={setLocationId} noneLabel="All locations" />
          </label>
          <label className="block">
            <span className="label">Note</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. Opname November" />
          </label>
          <button type="submit" className="btn-primary self-end" disabled={pending}>
            {pending ? "Starting…" : "Start count"}
          </button>
          {error && <p role="alert" className="text-sm text-[#FFB3A6] sm:col-span-3">{error}</p>}
        </form>
      )}

      {counts.length === 0 ? (
        <p className="rounded-xl bg-black/25 px-4 py-8 text-center text-sm text-[#AEB8C5]">No counts yet.</p>
      ) : (
        <ul className="lg lg-dark divide-y divide-white/10 rounded-[22px] px-4">
          {counts.map((c) => (
            <li key={c.id}>
              <Link href={`/app/opname/${c.id}`} className="flex items-center gap-3 py-3.5">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-mono text-sm text-ink">{c.scope}</span>
                    <CountBadge status={c.status} />
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-[#97A3B3]">
                    <LocalTime iso={c.startedAt} />
                    {c.startedBy ? ` · ${c.startedBy}` : ""}
                    {c.note ? ` · ${c.note}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right font-mono text-xs text-[#BAC3CF]">
                  {c.scanned} scanned
                  <span className="block text-[#97A3B3]">{c.expected} expected</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
