// Pure checks for the Data cleanup page (client-safe).
import type { DeviceRow } from "./types";

export type NameGroup = { names: { name: string; count: number }[] };

export type CleanupIssues = {
  strayCustomer: DeviceRow[]; // not at a customer but still carrying customer details
  noOutDate: DeviceRow[]; // at a customer with no out date
  duplicateSerials: { serial: string; devices: DeviceRow[] }[];
  similarCustomers: NameGroup[];
  similarModels: NameGroup[];
};

const CUSTOMER_FIELDS = ["customer", "contact", "outDate", "returnDate", "assignment"] as const;

// "PT. ABC Indonesia" and "abc indonesia" compare equal.
const COMPANY_WORDS = /\b(pt|cv|tbk|ud|persero)\b/g;
export const normalizeName = (s: string) => s.toLowerCase().replace(COMPANY_WORDS, "").replace(/[^a-z0-9]/g, "");

// "H3C WA6636" and "wa-6636" compare equal. No typo matching for models: WA7320i and WA7330i are different products.
const VENDORS = /\b(h3c|cisco|aruba|ruijie|huawei|mikrotik|ubiquiti|unifi|tp-?link|fortinet|fortigate|juniper|hpe?|dell|lenovo)\b/g;
export const normalizeModel = (s: string) => s.toLowerCase().replace(VENDORS, "").replace(/[^a-z0-9]/g, "");

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Groups of differently spelled values that probably mean the same thing (same after normalizing, or a 1-letter typo). */
export function similarNames(
  values: (string | null)[],
  { normalize = normalizeName, typos = true }: { normalize?: (s: string) => string; typos?: boolean } = {},
): NameGroup[] {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  const names = [...counts.keys()];
  const keys = names.map(normalize);

  // union-find over names
  const parent = names.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++) {
      const same = keys[i] === keys[j] || (typos && keys[i].length >= 6 && editDistance(keys[i], keys[j]) <= 1);
      if (same && keys[i]) parent[find(j)] = find(i);
    }

  const groups = new Map<number, string[]>();
  names.forEach((n, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), n]));
  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => ({ names: g.map((name) => ({ name, count: counts.get(name) ?? 0 })).sort((a, b) => b.count - a.count) }));
}

export function findIssues(devices: DeviceRow[]): CleanupIssues {
  const bySerial = new Map<string, DeviceRow[]>();
  for (const d of devices) {
    const s = d.serial?.trim().toLowerCase();
    if (s) bySerial.set(s, [...(bySerial.get(s) ?? []), d]);
  }
  return {
    strayCustomer: devices.filter(
      (d) => d.status !== "In Use" && d.status !== "Hilang" && CUSTOMER_FIELDS.some((f) => d[f]),
    ),
    noOutDate: devices.filter((d) => d.status === "In Use" && !d.outDate),
    duplicateSerials: [...bySerial.values()]
      .filter((g) => g.length > 1)
      .map((g) => ({ serial: g[0].serial as string, devices: g })),
    similarCustomers: similarNames(devices.map((d) => d.customer)),
    similarModels: similarNames(
      devices.map((d) => d.name),
      { normalize: normalizeModel, typos: false },
    ),
  };
}

export function issueCount(i: CleanupIssues): number {
  return (
    i.strayCustomer.length +
    i.noOutDate.length +
    i.duplicateSerials.length +
    i.similarCustomers.length +
    i.similarModels.length
  );
}
