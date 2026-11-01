// Client-safe helpers for storage locations ("places" in code, to avoid clashing with window.location).

export type Place = { id: string; name: string; parentId: string | null; label: string };

export const placeLabel = (name: string, parentName?: string | null) => (parentName ? `${parentName} › ${name}` : name);

/** Sites first (by name), each followed by its spots, with labels filled in. */
export function sortPlaces(rows: { id: string; name: string; parentId: string | null }[]): Place[] {
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const sites = rows.filter((r) => !r.parentId).sort(byName);
  return sites.flatMap((s) => [
    { ...s, label: s.name },
    ...rows
      .filter((r) => r.parentId === s.id)
      .sort(byName)
      .map((r) => ({ ...r, label: placeLabel(r.name, s.name) })),
  ]);
}

/** The place itself plus its spots (filtering by a site includes everything inside it). */
export function placeAndChildren(places: Place[], id: string): Set<string> {
  return new Set([id, ...places.filter((p) => p.parentId === id).map((p) => p.id)]);
}
