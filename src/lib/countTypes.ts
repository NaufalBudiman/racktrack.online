// Stock opname (client-safe): types and the comparison of what should be on the shelf vs what was scanned.
import { statusLabel, type Status } from "./categories";
import { placeAndChildren, type Place } from "./places";
import { serialKey } from "./scan";
import type { DeviceRow } from "./types";

export const COUNT_STATUSES = ["open", "review", "closed"] as const;
export type CountStatus = (typeof COUNT_STATUSES)[number];
export const COUNT_STATUS_LABELS: Record<CountStatus, string> = { open: "Scanning", review: "Review", closed: "Closed" };

// Statuses that mean "should be physically in the warehouse".
export const SHELF_STATUSES: readonly Status[] = ["Available", "Internal", "Faulty"];
export const onShelf = (status: string) => (SHELF_STATUSES as readonly string[]).includes(status);

// Snapshot of one expected device when the count started.
export type CountExpected = { id: string; name: string; serial: string | null; status: Status; location: string | null };

export type CountRow = {
  id: string;
  locationId: string | null;
  scope: string;
  status: CountStatus;
  note: string | null;
  startedBy: string | null;
  startedAt: string;
  finishedAt: string | null;
  closedAt: string | null;
  expected: number;
  scanned: number;
};

export type CountScan = {
  id: string;
  serial: string;
  deviceId: string | null;
  model: string | null;
  by: string | null;
  scannedAt: string;
};

export type CountDetail = Omit<CountRow, "expected" | "scanned"> & { expected: CountExpected[]; scans: CountScan[] };

/** Is this location inside the counted area? (null area = every location, including none) */
export function inArea(places: Place[], areaId: string | null) {
  const set = areaId ? placeAndChildren(places, areaId) : null;
  return (locationId: string | null) => !set || (locationId !== null && set.has(locationId));
}

export type Found = { scan: CountScan; device: DeviceRow };
export type Misplaced = { scan: CountScan; device: DeviceRow; why: string; fixed: boolean };
export type Missing = { exp: CountExpected; device: DeviceRow | null; fixed: boolean };
export type Unknown = { scan: CountScan; fixed: boolean; device: DeviceRow | null };

export type CountResult = { found: Found[]; misplaced: Misplaced[]; missing: Missing[]; unknown: Unknown[]; open: number };

/**
 * Compares the frozen expected list with the scans, using the devices as they are now:
 * found = expected and scanned; misplaced = scanned but recorded elsewhere (or not on the shelf);
 * missing = expected, never scanned; unknown = serial not in the workspace when it was scanned.
 * `fixed` marks rows that were sorted out afterwards (moved, marked missing, sent, added), and `open` counts the rest.
 */
export function compareCount(count: Pick<CountDetail, "locationId" | "expected" | "scans">, devices: DeviceRow[], places: Place[]): CountResult {
  const byId = new Map(devices.map((d) => [d.id, d]));
  const bySerial = new Map<string, DeviceRow>();
  for (const d of devices) if (d.serial && !bySerial.has(serialKey(d.serial))) bySerial.set(serialKey(d.serial), d);
  const expected = new Map(count.expected.map((e) => [e.id, e]));
  const inside = inArea(places, count.locationId);
  const placeLabel = (id: string | null) => places.find((p) => p.id === id)?.label ?? "no location";

  const result: CountResult = { found: [], misplaced: [], missing: [], unknown: [], open: 0 };
  const seen = new Set<string>();
  for (const scan of count.scans) {
    const device = (scan.deviceId && byId.get(scan.deviceId)) || bySerial.get(serialKey(scan.serial)) || null;
    if (!device) {
      result.unknown.push({ scan, device: null, fixed: false });
      continue;
    }
    seen.add(device.id);
    if (!scan.deviceId) {
      // Added to the workspace after it was scanned (from this count's "not in RackTrack" list).
      result.unknown.push({ scan, device, fixed: true });
      continue;
    }
    if (expected.has(device.id)) {
      result.found.push({ scan, device });
      continue;
    }
    const nowRight = onShelf(device.status) && inside(device.locationId);
    const why = onShelf(device.status)
      ? `Recorded at ${placeLabel(device.locationId)}`
      : device.status === "In Use"
        ? `Recorded at customer${device.customer ? `: ${device.customer}` : ""}`
        : `Recorded as ${statusLabel(device.status)}`;
    result.misplaced.push({ scan, device, why, fixed: nowRight && device.updatedAt > scan.scannedAt });
  }
  for (const exp of count.expected) {
    if (seen.has(exp.id)) continue;
    const device = byId.get(exp.id) ?? null;
    // Sorted out once its status changed (missing, sent, retired) or it was deleted.
    result.missing.push({ exp, device, fixed: !device || device.status !== exp.status });
  }
  result.open =
    result.missing.filter((m) => !m.fixed).length +
    result.misplaced.filter((m) => !m.fixed).length +
    result.unknown.filter((u) => !u.fixed).length;
  return result;
}
