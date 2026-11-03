"use client";

import { useId, useRef, useState } from "react";
import { guessModel, modelFromText, readLabel, type LabelContext } from "@/lib/labels";
import { serialKey } from "@/lib/scan";

export type PhotoItem = { serial: string; model: string | null; known: boolean };
export type PhotoResult = { items: PhotoItem[]; deviceIds: string[] };

/**
 * "Photo" button: take a picture of one label or a whole stack of boxes, and every barcode in it is read at once
 * (the live camera reads one at a time). Serials not in the workspace get a model from their H3C BOM code,
 * a model barcode, or (last resort) the printed text.
 */
export function PhotoScan({
  ctx,
  onResult,
  disabled,
  className = "btn-ghost",
}: {
  ctx: LabelContext;
  onResult: (r: PhotoResult) => void;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function read(file: File) {
    setError(null);
    setBusy("Reading barcodes…");
    try {
      const { readCodes, readText } = await import("@/lib/photo");
      const codes = await readCodes(file);
      const label = readLabel(codes, ctx);
      let items: PhotoItem[] = label.serials.map((serial) => {
        const known = ctx.serials.has(serialKey(serial));
        return { serial, known, model: known ? null : guessModel(serial, ctx, label.model) };
      });
      if (items.some((i) => !i.known && !i.model)) {
        setBusy("Reading the model name…");
        const model = modelFromText(await readText(file).catch(() => ""), ctx.models);
        items = items.map((i) => (i.known || i.model ? i : { ...i, model }));
      }
      if (!items.length && !label.deviceIds.length)
        setError(codes.length ? "No serial number found on that photo." : "No barcode found. Get closer, keep it sharp, avoid glare.");
      onResult({ items, deviceIds: label.deviceIds });
    } catch {
      setError("Couldn't read that photo. Try again, or use the live camera.");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={`${className} cursor-pointer ${busy || disabled ? "pointer-events-none opacity-60" : ""}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 8h3l2-3h6l2 3h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" />
          <circle cx="12" cy="13.5" r="3.5" />
        </svg>
        {busy ?? "Photo (many at once)"}
      </label>
      <input
        ref={input}
        id={id}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={!!busy || disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void read(f);
        }}
      />
      {error && <p className="text-xs text-[#FFB3A6]">{error}</p>}
    </div>
  );
}
