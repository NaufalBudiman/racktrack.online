// Reading device labels (client-safe): which barcodes on a box are serials, and which model they belong to.
import type { Category } from "./categories";
import { modelKey } from "./models";
import { parseScan, serialKey } from "./scan";
import type { DeviceRow } from "./types";

// H3C serials: "21" or "29" + 8-char BOM code + vendor/date/sequence, e.g. 219801A2K2P23B00000B (BOM 9801A2K2).
const H3C_SERIAL = /^(?:21|29)([0-9A-Z]{8})[0-9A-Z]{8,12}$/i;
// The BOM / part code printed as its own barcode on H3C labels, e.g. 9801A2K2, 0235A3FE, 0231A2VU.
const BOM = /^\d{4}[A-Z][0-9A-Z]{3}$/i;
const MAC = /^(?:[0-9A-F]{2}[:.-]?){5}[0-9A-F]{2}$/i;
const EAN = /^\d{8}$|^\d{12,14}$/; // retail barcodes, never a serial

export const bomOf = (serial: string) => serial.trim().match(H3C_SERIAL)?.[1].toUpperCase() ?? null;

/** BOM code → model name, learned from the workspace's own devices (most common name wins). */
export function learnBoms(devices: Pick<DeviceRow, "name" | "serial">[]): Map<string, string> {
  const votes = new Map<string, Map<string, number>>();
  for (const d of devices) {
    const bom = d.serial ? bomOf(d.serial) : null;
    if (!bom) continue;
    const v = votes.get(bom) ?? new Map<string, number>();
    v.set(d.name, (v.get(d.name) ?? 0) + 1);
    votes.set(bom, v);
  }
  return new Map([...votes].map(([bom, v]) => [bom, [...v].sort((a, b) => b[1] - a[1])[0][0]]));
}

export type LabelContext = {
  serials: Set<string>; // serialKey of every device in the workspace
  boms: Map<string, string>;
  models: string[]; // known model names
};

export function labelContext(devices: DeviceRow[]): LabelContext {
  return {
    serials: new Set(devices.flatMap((d) => (d.serial ? [serialKey(d.serial)] : []))),
    boms: learnBoms(devices),
    models: [...new Set(devices.map((d) => d.name))],
  };
}

const bare = (name: string) => modelKey(name).replace(/^h3c\s+/, "");

/** A known model whose name appears in the text (longest match wins), e.g. OCR'd "H3C WA6636" or a model barcode. */
export function findModel(text: string, models: string[]): string | null {
  const hay = ` ${text.toLowerCase().replace(/[^a-z0-9.-]+/g, " ")} `;
  const hits = models.filter((m) => {
    const key = bare(m).replace(/[^a-z0-9.-]+/g, " ").trim();
    return key.length >= 4 && hay.includes(` ${key} `);
  });
  return hits.sort((a, b) => bare(b).length - bare(a).length)[0] ?? null;
}

// Model-looking words on H3C/HPE labels when the model isn't in the workspace yet: WA6636, LS-5130S-10MS-UPWR-EI-GL, S6520X-54XC…
const MODEL_WORD = /\b(?:H3C\s+)?((?:WA|WX|WT|WTU|EWP-|LS-|S|SR|MSR|RT-|F|UIS|R|UN-)\d{3,5}[A-Z0-9]*(?:-[A-Z0-9]+)*)\b/;

export function modelFromText(text: string, models: string[]): string | null {
  const known = findModel(text, models);
  if (known) return known;
  const m = text.toUpperCase().match(MODEL_WORD);
  return m ? `H3C ${m[1]}` : null;
}

export type LabelRead = {
  serials: string[]; // in the order found, no duplicates
  deviceIds: string[]; // RackTrack QR labels
  model: string | null; // from a model barcode or the BOM code on the label
};

/** Sorts the codes found on one photo/label into serials and a model hint. */
export function readLabel(codes: string[], ctx: LabelContext): LabelRead {
  const out: LabelRead = { serials: [], deviceIds: [], model: null };
  const keys = new Set<string>();
  for (const raw of codes) {
    const text = raw.trim();
    if (!text) continue;
    const parsed = parseScan(text);
    if (parsed.kind === "device") {
      if (!out.deviceIds.includes(parsed.id)) out.deviceIds.push(parsed.id);
      continue;
    }
    if (parsed.kind !== "serial") continue;
    const code = parsed.serial;
    const key = serialKey(code);
    const isSerial =
      ctx.serials.has(key) ||
      H3C_SERIAL.test(code) ||
      (!BOM.test(code) && !MAC.test(code) && !EAN.test(code) && !findModel(code, ctx.models) && /\d/.test(code) && code.length >= 8 && !/\s/.test(code));
    if (isSerial) {
      if (!keys.has(key)) {
        keys.add(key);
        out.serials.push(code);
      }
      continue;
    }
    if (!out.model && BOM.test(code)) out.model = ctx.boms.get(code.toUpperCase()) ?? null;
    if (!out.model) out.model = findModel(text, ctx.models);
  }
  return out;
}

/** Best model guess for one serial: its own BOM code first, then whatever the label said. */
export const guessModel = (serial: string, ctx: LabelContext, labelModel: string | null) =>
  ctx.boms.get(bomOf(serial) ?? "") ?? labelModel;

/** Type for a model we haven't seen before, from H3C naming habits. */
export function guessCategory(model: string): Category {
  const m = model.toUpperCase().replace(/^H3C\s+/, "");
  if (/^(WA|EWP|WTU)/.test(m)) return "Wireless";
  if (/^(WX|WT|AC)\d/.test(m)) return "Access Controller";
  if (/INJECTOR|^PSE|POE/.test(m)) return "POE Injektor";
  if (/^(LS-|S\d)/.test(m)) return "Switch";
  if (/^(MSR|RT-|SR\d)/.test(m)) return "Router";
  if (/^F\d|^SECPATH/.test(m)) return "Firewall";
  if (/^UN-|^PSR|FAN|HEATSINK/.test(m)) return "Sparepart Server";
  if (/^(R\d|UIS|UNI SERVER)/.test(m)) return "Server";
  return "Lainnya";
}
