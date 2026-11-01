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
