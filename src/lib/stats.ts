import { STATUSES, type Status } from "./categories";
import type { DeviceRow } from "./types";

/** A loan past its return date. `today` is the viewer's local YYYY-MM-DD ("" before mount). */
export function isOverdue(d: DeviceRow, today: string): boolean {
  return d.status === "In Use" && d.assignment === "loan" && !!d.returnDate && !!today && d.returnDate < today;
}

export type DeviceStats = Record<Status, number> & { total: number; overdue: number };

export function deviceStats(devices: DeviceRow[], today: string): DeviceStats {
  const s = Object.fromEntries(STATUSES.map((k) => [k, 0])) as Record<Status, number>;
  let overdue = 0;
  for (const d of devices) {
    s[d.status]++;
    if (isOverdue(d, today)) overdue++;
  }
  return { ...s, total: devices.length, overdue };
}

export type CustomerRow = {
  name: string;
  total: number; // devices at this customer now
  loans: number;
  overdue: number;
  missing: number; // went missing while there
  since: string | null; // earliest out date
  nextDue: string | null; // earliest loan return date
};

/** One row per customer from current device data: overdue first, then most devices. */
export function customerRows(devices: DeviceRow[], today: string): CustomerRow[] {
  const map = new Map<string, CustomerRow>();
  for (const d of devices) {
    if (!d.customer || (d.status !== "In Use" && d.status !== "Hilang")) continue;
    const r = map.get(d.customer) ?? { name: d.customer, total: 0, loans: 0, overdue: 0, missing: 0, since: null, nextDue: null };
    if (d.status === "Hilang") r.missing++;
    else {
      r.total++;
      if (d.outDate && (!r.since || d.outDate < r.since)) r.since = d.outDate;
      if (d.assignment === "loan") {
        r.loans++;
        if (d.returnDate && (!r.nextDue || d.returnDate < r.nextDue)) r.nextDue = d.returnDate;
      }
      if (isOverdue(d, today)) r.overdue++;
    }
    map.set(d.customer, r);
  }
  return [...map.values()].sort((a, b) => b.overdue - a.overdue || b.total - a.total || a.name.localeCompare(b.name));
}
