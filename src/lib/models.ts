// Model helpers shared by the client and server (client-safe).
import type { DeviceRow } from "./types";

// Same model = same name ignoring case and spacing ("H3C  WA6636" = "h3c wa6636").
export const modelKey = (name: string) => name.toLowerCase().replace(/\s+/g, " ").trim();

export type LowStock = { key: string; name: string; inStock: number; min: number };

/** Models whose in-stock count is below their minimum, lowest first. */
export function lowStock(devices: DeviceRow[], minimums: Record<string, number>): LowStock[] {
  const stock = new Map<string, { name: string; n: number }>();
  for (const d of devices) {
    const k = modelKey(d.name);
    const s = stock.get(k) ?? { name: d.name, n: 0 };
    if (d.status === "Available") s.n++;
    stock.set(k, s);
  }
  return Object.entries(minimums)
    .map(([key, min]) => ({ key, min, name: stock.get(key)?.name ?? key, inStock: stock.get(key)?.n ?? 0 }))
    .filter((m) => m.inStock < m.min)
    .sort((a, b) => a.inStock / a.min - b.inStock / b.min);
}
