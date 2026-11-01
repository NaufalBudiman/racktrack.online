// Pure helpers for the import dialog (client-safe). The server re-validates everything.
import { CATEGORIES, STATUSES, type Category, type Status } from "./categories";

export type ImportFieldKey =
  | "name"
  | "serial"
  | "category"
  | "status"
  | "location"
  | "rackPosition"
  | "firmwareVersion"
  | "customer"
  | "contact"
  | "outDate"
  | "returnDate"
  | "condition"
  | "purchaseDate"
  | "warranty"
  | "notes"
  | "lat"
  | "lng";

export const IMPORT_FIELDS: {
  key: ImportFieldKey;
  label: string;
  aliases: string[];
}[] = [
  { key: "name", label: "Name *", aliases: ["name", "device", "device name", "nama", "model", "perangkat"] },
  { key: "serial", label: "Serial", aliases: ["serial", "serial number", "serial no", "sn", "s/n", "no seri"] },
  { key: "category", label: "Type", aliases: ["type", "category", "tipe", "kategori", "jenis"] },
  { key: "status", label: "Status", aliases: ["status"] },
  { key: "location", label: "Location", aliases: ["location", "lokasi", "site"] },
  { key: "rackPosition", label: "Rack / port", aliases: ["rack", "rack position", "rack/port", "port", "posisi rack"] },
  { key: "firmwareVersion", label: "Firmware", aliases: ["firmware", "firmware version", "version", "versi firmware"] },
  { key: "customer", label: "Customer", aliases: ["customer", "client", "pelanggan"] },
  { key: "contact", label: "Contact", aliases: ["contact", "kontak", "phone", "pic", "no hp"] },
  { key: "outDate", label: "Out date", aliases: ["out date", "date out", "tanggal keluar", "tgl keluar"] },
  { key: "returnDate", label: "Return date", aliases: ["return date", "date return", "tanggal kembali", "tgl kembali"] },
  { key: "condition", label: "Condition", aliases: ["condition", "kondisi"] },
  { key: "purchaseDate", label: "Purchase date", aliases: ["purchase date", "tanggal beli", "tgl beli"] },
  { key: "warranty", label: "Warranty", aliases: ["warranty", "garansi"] },
  { key: "notes", label: "Notes", aliases: ["notes", "note", "catatan", "keterangan"] },
  { key: "lat", label: "Latitude", aliases: ["lat", "latitude"] },
  { key: "lng", label: "Longitude", aliases: ["lng", "lon", "long", "longitude"] },
];

export type Cell = string | number | boolean | Date | null | undefined;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export function guessMapping(headers: string[]): Record<ImportFieldKey, number> {
  const out = {} as Record<ImportFieldKey, number>;
  const used = new Set<number>();
  for (const f of IMPORT_FIELDS) {
    const idx = headers.findIndex((h, i) => !used.has(i) && f.aliases.includes(norm(h)));
    out[f.key] = idx;
    if (idx >= 0) used.add(idx);
  }
  return out;
}

export function cellToString(v: Cell): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  return String(v).trim();
}

export function toIsoDate(v: Cell): string {
  if (v instanceof Date) return cellToString(v);
  const s = cellToString(v);
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // DD/MM/YYYY
  if (m) {
    const [, d, mo, y] = m;
    const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    return isNaN(Date.parse(iso)) ? "" : iso;
  }
  return "";
}

export function toCategory(v: Cell): Category {
  const s = norm(cellToString(v));
  if (s === "poe injector") return "POE Injektor";
  if (s === "ac" || s === "wireless controller") return "Access Controller";
  if (s === "ap" || s === "access point") return "Wireless";
  const hit = CATEGORIES.find((c) => c.toLowerCase() === s);
  return hit ?? "Lainnya";
}

export function toStatus(v: Cell): Status {
  const s = norm(cellToString(v));
  if (["in use", "inuse", "dipakai", "terpakai", "out", "dipinjam"].includes(s)) return "In Use";
  if (["hilang", "lost", "missing"].includes(s)) return "Hilang";
  const hit = STATUSES.find((x) => x.toLowerCase() === s);
  return hit ?? "Available";
}

const DATE_KEYS: ImportFieldKey[] = ["outDate", "returnDate", "purchaseDate"];

export function mapRow(
  row: Cell[],
  mapping: Record<ImportFieldKey, number>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of IMPORT_FIELDS) {
    const idx = mapping[f.key];
    const raw = idx >= 0 ? row[idx] : undefined;
    if (f.key === "category") out.category = toCategory(raw);
    else if (f.key === "status") out.status = toStatus(raw);
    else if (DATE_KEYS.includes(f.key)) out[f.key] = toIsoDate(raw);
    else out[f.key] = cellToString(raw);
  }
  return out;
}
