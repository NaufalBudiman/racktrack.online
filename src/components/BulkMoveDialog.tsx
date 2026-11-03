"use client";

import { useId, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { moveDevices } from "@/app/app/actions";
import { ASSIGNMENTS, ASSIGNMENT_LABELS, type Assignment } from "@/lib/categories";
import type { Place } from "@/lib/places";
import type { DeviceRow } from "@/lib/types";
import { PlaceSelect } from "./PlaceSelect";

function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export type BulkKind = "send" | "return";

// Who can make each move (same rules as the single-device buttons).
export const canSend = (d: DeviceRow) => d.status === "Available" || d.status === "Internal";
export const canReturn = (d: DeviceRow) => d.status === "In Use";

/** One form for many devices: send them all to a project, or return them all. */
export function BulkMoveDialog({
  kind,
  devices,
  workspaceId,
  customers,
  places,
  onClose,
  onDone,
}: {
  kind: BulkKind;
  devices: DeviceRow[]; // the selection; ineligible ones are skipped and listed
  workspaceId: string;
  customers: string[];
  places: Place[];
  onClose: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const ids = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const eligible = devices.filter(kind === "send" ? canSend : canReturn);
  const skipped = devices.length - eligible.length;

  const [customer, setCustomer] = useState("");
  const [assignment, setAssignment] = useState<Assignment | "">("");
  const [outDate, setOutDate] = useState(localToday);
  const [returnDate, setReturnDate] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState(true);
  const [result, setResult] = useState<"Available" | "Faulty">("Available");
  const [locationId, setLocationId] = useState(() => {
    const first = eligible.find((d) => d.locationId)?.locationId;
    return first ?? places.find((p) => !p.parentId)?.id ?? "";
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const move =
      kind === "send"
        ? { type: "checkout" as const, customer, contact, assignment, outDate, returnDate, note }
        : { type: "checkin" as const, result, locationId, note };
    startTransition(async () => {
      const res = await moveDevices(workspaceId, eligible.map((d) => d.id), move);
      if (!res.ok) return setError(res.error);
      onDone();
      if (kind === "send" && receipt && res.projectId) {
        router.push(`/app/projects/${res.projectId}/receipt?devices=${eligible.map((d) => d.id).join(",")}`);
      } else {
        router.refresh();
        onClose();
      }
    });
  }

  const lab = "label";
  const title = kind === "send" ? "Send to project" : "Return to stock";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => !pending && onClose()} aria-hidden />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="lg lg-solid relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-b-none rounded-t-[28px] sm:rounded-[28px]"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="font-mono text-lg font-semibold">
            {title} · {eligible.length}
          </h2>
          <button type="button" className="btn-ghost h-10 w-10 px-0" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
          {skipped > 0 && (
            <p className="rounded-xl bg-amber/10 px-3 py-2 text-xs text-[#FFE1B8] shadow-[inset_0_0_0_1px_rgba(239,155,62,.45)]">
              {skipped} selected device{skipped === 1 ? "" : "s"} skipped:{" "}
              {kind === "send" ? "only In Stock or Internal Use devices can be sent." : "only devices at a project can be returned."}
            </p>
          )}

          {eligible.length === 0 ? (
            <p className="text-sm text-[#AEB8C5]">Nothing to {kind === "send" ? "send" : "return"} in this selection.</p>
          ) : kind === "send" ? (
            <>
              <label className="block">
                <span className={lab}>Project / customer *</span>
                <input className="input" list={`${ids}-c`} value={customer} onChange={(e) => setCustomer(e.target.value)} maxLength={200} required autoFocus />
                <datalist id={`${ids}-c`}>
                  {customers.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <fieldset>
                <legend className={lab}>Type *</legend>
                <div className="flex gap-1.5">
                  {ASSIGNMENTS.map((a) => (
                    <button key={a} type="button" className={`chip ${assignment === a ? "chip-on" : ""}`} aria-pressed={assignment === a} onClick={() => setAssignment(a)}>
                      {ASSIGNMENT_LABELS[a]}
                      <span className="text-[#97A3B3]">{a === "loan" ? "comes back" : "stays"}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className={lab}>Out date</span>
                  <input type="date" className="input" value={outDate} onChange={(e) => setOutDate(e.target.value)} />
                </label>
                {assignment === "loan" && (
                  <label className="block">
                    <span className={lab}>Return by *</span>
                    <input type="date" className="input" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} required />
                  </label>
                )}
              </div>
              <label className="block">
                <span className={lab}>Contact</span>
                <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={200} placeholder="Name / phone at site" />
              </label>
              <label className="block">
                <span className={lab}>Note</span>
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
              </label>
              <label className="flex items-center gap-2.5 text-sm text-ink">
                <input type="checkbox" className="h-4 w-4 accent-[#F7A23A]" checked={receipt} onChange={(e) => setReceipt(e.target.checked)} />
                Make a tanda terima right after
              </label>
            </>
          ) : (
            <>
              <fieldset>
                <legend className={lab}>Comes back as</legend>
                <div className="flex gap-1.5">
                  {(["Available", "Faulty"] as const).map((r) => (
                    <button key={r} type="button" className={`chip ${result === r ? "chip-on" : ""}`} aria-pressed={result === r} onClick={() => setResult(r)}>
                      {r === "Available" ? "In Stock" : "Faulty"}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="block">
                <span className={lab}>Location</span>
                <PlaceSelect places={places} value={locationId} onChange={setLocationId} noneLabel="Keep each device's location" className="input" />
              </label>
              <label className="block">
                <span className={lab}>Note</span>
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
              </label>
            </>
          )}

          {error && (
            <p role="alert" className="rounded-xl bg-red/15 px-3 py-2 text-sm text-[#FFB3A6] shadow-[inset_0_0_0_1px_rgba(240,102,76,.55)]">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-white/10 px-6 py-4">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={pending}>Cancel</button>
          <button
            type="submit"
            className="btn-primary"
            disabled={pending || eligible.length === 0 || (kind === "send" && !assignment)}
          >
            {pending ? "Saving…" : kind === "send" ? `Send ${eligible.length}` : `Return ${eligible.length}`}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
