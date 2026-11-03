// Tanda terima (client-safe).

/** One line on the receipt: a model with its serials (qty = serials.length, or `qty` when there are none). */
export type ReceiptItem = { name: string; serials: string[]; qty: number; deviceIds: string[] };

export const DEFAULT_RECEIPT_FORMAT = "TT/{YYYY}/{MM}/{NNN}";
export const RECEIPT_TOKENS = "{YYYY} year, {YY} short year, {MM} month, {DD} day, {NNN} running number (resets each year)";

/** Fill a number pattern: {YYYY} {YY} {MM} {DD} {NNN} (zero-padded to the number of N's). */
export function formatReceiptNumber(pattern: string, date: string, seq: number): string {
  const [y, m, d] = date.split("-");
  return pattern
    .replace(/\{YYYY\}/g, y)
    .replace(/\{YY\}/g, y.slice(2))
    .replace(/\{MM\}/g, m)
    .replace(/\{DD\}/g, d)
    .replace(/\{(N+)\}/g, (_, n: string) => String(seq).padStart(n.length, "0"));
}

const MONTHS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
/** "2026-10-21" -> "21 Oktober 2026" (receipts are printed in Indonesian, like the paper template). */
export const tanggal = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_ID[m - 1]} ${y}`;
};

/** WhatsApp numbers: "0878-8578-3325" -> "6287885783325". */
export function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

export type ReceiptRow = {
  id: string;
  number: string;
  date: string;
  units: number;
  signedAt: string | null;
};
