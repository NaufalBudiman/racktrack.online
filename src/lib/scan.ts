// Turns whatever a scanner read into something we can look up (client-safe).

export type ScanResult = { kind: "device"; id: string } | { kind: "serial"; serial: string } | { kind: "empty" };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
// Our own links (future QR labels), on any host so local testing works too.
const DEVICE_LINK = new RegExp(`/(?:d|app/devices)/(${UUID})(?:[/?#]|$)`, "i");
// "SN: 219801A2XY", "S/N 219801...", "Serial No.: ..."
const LABELLED = /\b(?:s\/?n|serial(?:\s*(?:no|number))?)\.?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{3,})/i;

export function parseScan(raw: string): ScanResult {
  const text = raw.trim();
  if (!text) return { kind: "empty" };

  const link = text.match(DEVICE_LINK);
  if (link) return { kind: "device", id: link[1].toLowerCase() };

  const labelled = text.match(LABELLED);
  if (labelled) return { kind: "serial", serial: labelled[1] };

  // A plain code (most box barcodes): use it whole. Multi-field QR text: take the longest code-like token.
  if (!/\s/.test(text)) return { kind: "serial", serial: text };
  const tokens = text.split(/[\s,;|]+/).filter((t) => /^[A-Z0-9][A-Z0-9-]{5,}$/i.test(t) && /\d/.test(t));
  if (tokens.length) return { kind: "serial", serial: tokens.sort((a, b) => b.length - a.length)[0] };
  return { kind: "serial", serial: text.slice(0, 120) };
}

export const serialKey = (s: string) => s.trim().toLowerCase();
