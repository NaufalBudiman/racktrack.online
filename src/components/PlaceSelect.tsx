import type { Place } from "@/lib/places";

/** Location dropdown: sites, with their spots indented under them. Value is a place id ("" = none). */
export function PlaceSelect({
  places,
  value,
  onChange,
  id,
  noneLabel = "— No location —",
  className = "input",
}: {
  places: Place[];
  value: string;
  onChange: (id: string) => void;
  id?: string;
  noneLabel?: string;
  className?: string;
}) {
  return (
    <select id={id} className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{noneLabel}</option>
      {places.map((p) => (
        <option key={p.id} value={p.id}>
          {p.parentId ? `   ↳ ${p.name}` : p.name}
        </option>
      ))}
    </select>
  );
}
