"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_GROUPS, GROUPS, categoryLabel, groupLabel, type Category } from "@/lib/categories";
import { guessCategory } from "@/lib/labels";
import { modelKey } from "@/lib/models";
import type { Place } from "@/lib/places";
import { receiveDevices } from "@/app/app/actions";
import { PlaceSelect } from "./PlaceSelect";

export type NewSerial = { serial: string; model: string | null };

/**
 * Serials that aren't in RackTrack yet, grouped by their guessed model. Each group is added to stock in one go
 * (the model can be corrected first). Used by Scan → Send and by stock opname.
 */
export function NewSerials({
  items,
  workspaceId,
  places,
  locationId: initialLocation,
  models,
  note,
  onRemove,
  onAdded,
}: {
  items: NewSerial[];
  workspaceId: string;
  places: Place[];
  locationId: string | null;
  models: { name: string; category: string }[];
  note?: string;
  onRemove?: (serial: string) => void;
  onAdded?: (ids: string[]) => void;
}) {
  const router = useRouter();
  const ids = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [locationId, setLocationId] = useState(initialLocation ?? places.find((p) => !p.parentId)?.id ?? "");
  // Edits per guessed model ("" = no guess): what the user typed and picked.
  const [names, setNames] = useState<Record<string, string>>({});
  const [types, setTypes] = useState<Record<string, Category>>({});

  const groups = useMemo(() => {
    const map = new Map<string, NewSerial[]>();
    for (const it of items) {
      const k = it.model ?? "";
      map.set(k, [...(map.get(k) ?? []), it]);
    }
    return [...map].map(([guess, list]) => ({ guess, list }));
  }, [items]);

  const known = (name: string) => models.find((m) => modelKey(m.name) === modelKey(name));
  const nameFor = (guess: string) => names[guess] ?? guess;
  const typeFor = (guess: string) => {
    const n = nameFor(guess);
    return types[guess] ?? (known(n)?.category as Category | undefined) ?? guessCategory(n);
  };

  function add(guess: string, serials: string[]) {
    setError(null);
    startTransition(async () => {
      const res = await receiveDevices(workspaceId, { name: nameFor(guess), category: typeFor(guess), locationId, serials, note });
      if (!res.ok) return setError(res.error);
      onAdded?.(res.ids);
      router.refresh();
    });
  }

  if (!items.length) return null;
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="label">Add to stock at</span>
        <PlaceSelect places={places} value={locationId} onChange={setLocationId} />
      </label>
      {groups.map(({ guess, list }) => {
        const name = nameFor(guess);
        return (
          <div key={guess || "-"} className="rounded-xl bg-black/25 p-3">
            <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_10rem_auto]">
              <label className="block">
                <span className="label">{guess ? "Model (guessed from the label)" : "Model *"}</span>
                <input
                  className="input normal-case"
                  list={`${ids}-m`}
                  value={name}
                  onChange={(e) => setNames((n) => ({ ...n, [guess]: e.target.value }))}
                  placeholder="e.g. H3C WA6636"
                  maxLength={120}
                />
              </label>
              <label className="hidden sm:block">
                <span className="label">Type</span>
                <select className="input" value={typeFor(guess)} onChange={(e) => setTypes((t) => ({ ...t, [guess]: e.target.value as Category }))}>
                  {GROUPS.map((g) => (
                    <optgroup key={g} label={groupLabel(g)}>
                      {CATEGORY_GROUPS[g].map((c) => (
                        <option key={c} value={c}>{categoryLabel(c)}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn-primary self-end"
                disabled={pending || !name.trim()}
                onClick={() => add(guess, list.map((i) => i.serial))}
              >
                Add {list.length}
              </button>
            </div>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {list.map((i) => (
                <li key={i.serial} className="chip font-mono">
                  {i.serial}
                  {onRemove && (
                    <button type="button" className="text-[#AEB8C5] hover:text-[#FFB3A6]" aria-label={`Remove ${i.serial}`} onClick={() => onRemove(i.serial)}>
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <datalist id={`${ids}-m`}>
        {models.map((m) => (
          <option key={m.name} value={m.name} />
        ))}
      </datalist>
      {error && <p role="alert" className="text-sm text-[#FFB3A6]">{error}</p>}
    </div>
  );
}
