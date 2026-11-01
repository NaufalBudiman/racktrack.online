"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Place } from "@/lib/places";
import type { DeviceRow } from "@/lib/types";
import { createPlace, deletePlace, renamePlace } from "@/app/app/locations/actions";

type Counts = { stock: number; out: number; other: number; total: number };
const EMPTY: Counts = { stock: 0, out: 0, other: 0, total: 0 };

function tally(devices: DeviceRow[]): Map<string, Counts> {
  const m = new Map<string, Counts>();
  for (const d of devices) {
    if (!d.locationId) continue;
    const c = { ...(m.get(d.locationId) ?? EMPTY) };
    c.total++;
    if (d.status === "Available") c.stock++;
    else if (d.status === "In Use") c.out++;
    else c.other++;
    m.set(d.locationId, c);
  }
  return m;
}

const sum = (a: Counts, b: Counts): Counts => ({
  stock: a.stock + b.stock,
  out: a.out + b.out,
  other: a.other + b.other,
  total: a.total + b.total,
});

function CountLine({ c }: { c: Counts }) {
  return (
    <span className="flex shrink-0 items-baseline gap-3 font-mono text-xs text-[#97A3B3]">
      <span>
        <span className={`text-base font-semibold ${c.stock ? "text-[#6BE3B0]" : "text-[#8B97A8]"}`}>{c.stock}</span> in stock
      </span>
      {c.out > 0 && <span title="Out at customers, returns here">{c.out} out</span>}
      <span>/{c.total}</span>
    </span>
  );
}

export function LocationsView({
  places,
  devices,
  workspaceId,
  canEdit,
}: {
  places: Place[];
  devices: DeviceRow[];
  workspaceId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newSite, setNewSite] = useState("");
  const [newSpot, setNewSpot] = useState<Record<string, string>>({});
  const [addingSpot, setAddingSpot] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const counts = useMemo(() => tally(devices), [devices]);
  const sites = places.filter((p) => !p.parentId);
  const spotsOf = (id: string) => places.filter((p) => p.parentId === id);
  const unplaced = devices.filter((d) => !d.locationId);
  const unplacedStock = unplaced.filter((d) => d.status === "Available").length;

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

  function nameRow(place: Place, c: Counts, site: boolean) {
    const isEditing = editing?.id === place.id;
    const empty = c.total === 0 && (!site || spotsOf(place.id).length === 0);
    return (
      <div key={place.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${site ? "" : "py-2.5 pl-4 pr-3"}`}>
        {isEditing ? (
          <form
            className="flex min-w-0 flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => renamePlace(workspaceId, place.id, editing.name), () => setEditing(null));
            }}
          >
            <input
              className="input py-1.5"
              value={editing.name}
              onChange={(e) => setEditing({ id: place.id, name: e.target.value })}
              maxLength={80}
              required
              autoFocus
              aria-label="New name"
            />
            <button type="submit" className="btn-primary px-3 py-1.5 text-xs" disabled={pending}>
              Save
            </button>
            <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </form>
        ) : (
          <Link
            href={`/app/devices?location=${place.id}`}
            className={`w-full min-w-0 truncate hover:text-[#FFC27A] sm:w-auto sm:flex-1 ${site ? "font-mono text-[15px] font-semibold text-ink" : "text-sm text-[#C3CBD6]"}`}
          >
            {!site && <span className="mr-1.5 text-[#8B97A8]" aria-hidden>↳</span>}
            {place.name}
          </Link>
        )}
        {!isEditing && (
          <span className="mr-auto sm:mr-0">
            <CountLine c={c} />
          </span>
        )}
        {canEdit && !isEditing && (
          <span className="flex gap-1.5">
            <button type="button" className="btn-ghost px-2.5 py-1 text-[11px]" onClick={() => setEditing({ id: place.id, name: place.name })}>
              Rename
            </button>
            {empty &&
              (confirmDelete === place.id ? (
                <button
                  type="button"
                  className="btn-danger px-2.5 py-1 text-[11px]"
                  disabled={pending}
                  onClick={() => run(() => deletePlace(workspaceId, place.id), () => setConfirmDelete(null))}
                >
                  Confirm delete
                </button>
              ) : (
                <button type="button" className="btn-ghost px-2.5 py-1 text-[11px]" onClick={() => setConfirmDelete(place.id)}>
                  Delete
                </button>
              ))}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="mb-2">
        <div className="eyebrow">Locations</div>
        <h1 className="mt-1.5 font-mono text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">Where stock is kept</h1>
        <p className="mt-2 text-sm text-[#BAC3CF]">
          Sites (an office or warehouse) with spots inside them (rack, shelf, cabinet). Devices out at a customer still count
          here as “out”, since this is where they return to.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red/15 px-3 py-2 text-sm text-[#FFB3A6] shadow-[inset_0_0_0_1px_rgba(240,102,76,.55)]">
          {error}
        </p>
      )}

      {canEdit && (
        <form
          className="lg lg-dark flex flex-col gap-2 rounded-[22px] p-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => createPlace(workspaceId, newSite, null), () => setNewSite(""));
          }}
        >
          <label className="sr-only" htmlFor="new-site">New site</label>
          <input
            id="new-site"
            className="input"
            placeholder="New site, e.g. Gudang Bekasi"
            value={newSite}
            onChange={(e) => setNewSite(e.target.value)}
            maxLength={80}
            required
          />
          <button type="submit" className="btn-primary shrink-0" disabled={pending}>
            + Add site
          </button>
        </form>
      )}

      {sites.length === 0 && (
        <div className="lg lg-dark p-10 text-center text-sm text-[#BAC3CF]">
          No locations yet. {canEdit ? "Add your first site above." : "Editors and admins can add them."}
        </div>
      )}

      <ul className="space-y-3">
        {sites.map((site) => {
          const spots = spotsOf(site.id);
          const own = counts.get(site.id) ?? EMPTY;
          const all = spots.reduce((acc, s) => sum(acc, counts.get(s.id) ?? EMPTY), own);
          return (
            <li key={site.id} className="lg lg-dark rounded-[22px] p-4">
              {nameRow(site, all, true)}
              {(spots.length > 0 || own.total > 0) && (
                <div className="mt-3 divide-y divide-white/[.07] rounded-xl bg-black/20">
                  {spots.map((s) => (
                    nameRow(s, counts.get(s.id) ?? EMPTY, false)
                  ))}
                  {spots.length > 0 && own.total > 0 && (
                    <div className="flex items-center gap-3 py-2.5 pl-4 pr-3 text-sm text-[#97A3B3]">
                      <span className="flex-1 italic">No spot set</span>
                      <CountLine c={own} />
                    </div>
                  )}
                </div>
              )}
              {canEdit &&
                (addingSpot === site.id ? (
                  <form
                    className="mt-3 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(
                        () => createPlace(workspaceId, newSpot[site.id] ?? "", site.id),
                        () => {
                          setNewSpot({ ...newSpot, [site.id]: "" });
                          setAddingSpot(null);
                        },
                      );
                    }}
                  >
                    <input
                      className="input py-1.5"
                      placeholder="Spot name, e.g. Rak A"
                      value={newSpot[site.id] ?? ""}
                      onChange={(e) => setNewSpot({ ...newSpot, [site.id]: e.target.value })}
                      maxLength={80}
                      required
                      autoFocus
                      aria-label={`New spot in ${site.name}`}
                    />
                    <button type="submit" className="btn-primary px-3 py-1.5 text-xs" disabled={pending}>
                      Add
                    </button>
                    <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setAddingSpot(null)}>
                      Cancel
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="mt-3 font-mono text-xs text-[#FFC27A] hover:underline"
                    onClick={() => setAddingSpot(site.id)}
                  >
                    + Add spot (rack, shelf…)
                  </button>
                ))}
            </li>
          );
        })}
      </ul>

      {unplaced.length > 0 && (
        <p className="text-sm text-[#97A3B3]">
          {unplaced.length} device{unplaced.length === 1 ? " has" : "s have"} no location
          {unplacedStock > 0 && <> ({unplacedStock} in stock)</>}. Set it in each device&apos;s Edit form, or when returning it.
        </p>
      )}
    </div>
  );
}
