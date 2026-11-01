"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { readSheet } from "read-excel-file/universal";
import { MAX_DEVICES_PER_ACCOUNT, categoryLabel, statusLabel } from "@/lib/categories";
import {
  IMPORT_FIELDS,
  cellToString,
  guessMapping,
  mapRow,
  type Cell,
  type ImportFieldKey,
} from "@/lib/importMap";
import { importDevices } from "@/app/app/actions";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

type Parsed = { fileName: string; headers: string[]; rows: Cell[][] };

async function parseFile(file: File): Promise<Cell[][]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".csv")) {
    const text = await file.text();
    const res = Papa.parse<string[]>(text, { skipEmptyLines: true });
    return res.data;
  }
  if (lower.endsWith(".xlsx")) {
    return (await readSheet(file)) as Cell[][];
  }
  throw new Error("Unsupported file type. Please upload a .xlsx or .csv file.");
}

export function ImportDialog({
  currentCount,
  onClose,
}: {
  currentCount: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<Record<ImportFieldKey, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ imported: number; skipped: number; note: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !pending && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setParsed(null);
    setMapping(null);
    if (file.size > MAX_FILE_BYTES) {
      setError("File is too large (max 5 MB).");
      return;
    }
    try {
      const data = await parseFile(file);
      const [head, ...rows] = data.filter((r) => r.some((c) => cellToString(c) !== ""));
      if (!head || rows.length === 0) {
        setError("The file needs a header row and at least one data row.");
        return;
      }
      const headers = head.map((h, i) => cellToString(h) || `Column ${i + 1}`);
      setParsed({ fileName: file.name, headers, rows });
      setMapping(guessMapping(headers));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that file.");
    }
  }

  const mapped = useMemo(() => {
    if (!parsed || !mapping) return [];
    return parsed.rows.map((r) => mapRow(r, mapping));
  }, [parsed, mapping]);

  const valid = mapped.filter((r) => r.name);
  const missingName = mapped.length - valid.length;
  const nameMapped = mapping ? mapping.name >= 0 : false;
  const overLimit = currentCount + valid.length > MAX_DEVICES_PER_ACCOUNT;

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await importDevices(valid);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone({ imported: res.imported, skipped: res.skipped + missingName, note: res.skippedNote });
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => !pending && onClose()} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Import devices"
        className="lg lg-solid relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-b-none rounded-t-[28px] sm:rounded-[28px]"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="font-mono text-lg font-semibold">Import devices</h2>
          <button type="button" className="btn-ghost h-10 w-10 px-0" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {done ? (
            <div className="py-6 text-center">
              <p className="font-mono text-2xl font-semibold text-green">{done.imported} imported</p>
              {done.skipped > 0 && (
                <p className="mt-2 text-sm text-[#AEB8C5]">
                  {done.skipped} row(s) skipped. {done.note}
                </p>
              )}
            </div>
          ) : (
            <>
              <div>
                <span className="label">File (.xlsx or .csv, first sheet, header in row 1)</span>
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={onPick}
                  className="block w-full text-sm text-[#AEB8C5] file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:font-mono file:text-xs file:uppercase file:text-ink hover:file:bg-white/20"
                />
                <p className="mt-2 text-xs text-[#AEB8C5]">
                  The file is read in your browser. Only the mapped columns are sent when you confirm.
                </p>
              </div>

              {error && (
                <p role="alert" className="rounded-xl bg-red/15 px-3 py-2 text-sm text-[#FFB3A6] shadow-[inset_0_0_0_1px_rgba(240,102,76,.55)]">
                  {error}
                </p>
              )}

              {parsed && mapping && (
                <>
                  <div>
                    <span className="label">
                      Column mapping — {parsed.fileName} ({parsed.rows.length} rows)
                    </span>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {IMPORT_FIELDS.map((f) => (
                        <label key={f.key} className="flex items-center gap-2">
                          <span className="w-28 shrink-0 font-mono text-[11px] uppercase tracking-wider text-[#AEB8C5]">
                            {f.label}
                          </span>
                          <select
                            className="input py-1.5"
                            value={mapping[f.key]}
                            onChange={(e) => setMapping({ ...mapping, [f.key]: Number(e.target.value) })}
                          >
                            <option value={-1}>— skip —</option>
                            {parsed.headers.map((h, i) => (
                              <option key={i} value={i}>{h}</option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      Unknown types become “Other”; empty or unknown status becomes “Available”. Dates: YYYY-MM-DD or DD/MM/YYYY.
                    </p>
                  </div>

                  <div>
                    <span className="label">Preview (first 5 rows)</span>
                    <div className="overflow-x-auto rounded-xl bg-black/25 shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]">
                      <table className="w-full min-w-[34rem] text-left text-xs">
                        <thead className="bg-white/[.06] font-mono uppercase tracking-wider text-[#AEB8C5]">
                          <tr>
                            {["Name", "Serial", "Type", "Status", "Location", "Customer"].map((h) => (
                              <th key={h} className="px-3 py-2 font-medium">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {mapped.slice(0, 5).map((r, i) => (
                            <tr key={i} className="border-t border-white/[.07]">
                              <td className={`px-3 py-1.5 ${r.name ? "" : "text-red"}`}>{r.name || "(missing)"}</td>
                              <td className="px-3 py-1.5 font-mono">{r.serial}</td>
                              <td className="px-3 py-1.5">{categoryLabel(r.category)}</td>
                              <td className="px-3 py-1.5">{statusLabel(r.status)}</td>
                              <td className="px-3 py-1.5">{r.location}</td>
                              <td className="px-3 py-1.5">{r.customer}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-xs text-[#AEB8C5]">
                      {valid.length} device(s) ready
                      {missingName > 0 && <span className="text-amber"> · {missingName} row(s) without a name will be skipped</span>}
                      {" · "}
                      you have {currentCount} of {MAX_DEVICES_PER_ACCOUNT}
                    </p>
                    {!nameMapped && <p className="mt-1 text-xs text-red">Map the Name column to continue.</p>}
                    {overLimit && (
                      <p className="mt-1 text-xs text-red">
                        This import would exceed the {MAX_DEVICES_PER_ACCOUNT}-device limit.
                      </p>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-6 py-4">
          {done ? (
            <button type="button" className="btn-primary" onClick={onClose}>Done</button>
          ) : (
            <>
              <button type="button" className="btn-ghost" disabled={pending} onClick={onClose}>Cancel</button>
              <button
                type="button"
                className="btn-primary"
                disabled={pending || !parsed || !nameMapped || valid.length === 0 || overLimit}
                onClick={submit}
              >
                {pending ? "Importing…" : `Import ${valid.length || ""} device${valid.length === 1 ? "" : "s"}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
