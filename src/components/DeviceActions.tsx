"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ASSIGNMENTS, ASSIGNMENT_LABELS, statusLabel, type Assignment, type Status } from "@/lib/categories";
import type { Place } from "@/lib/places";
import type { DeviceRow } from "@/lib/types";
import { PlaceSelect } from "./PlaceSelect";
import type { MoveInput } from "@/lib/validation";
import { moveDevice } from "@/app/app/actions";

type Mode =
  | { kind: "checkout" }
  | { kind: "checkin"; label: string }
  | { kind: "status"; status: "Internal" | "Faulty" | "Hilang" | "Retired"; label: string };

function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// What you can do from each status. The first entry is the main (amber) button.
const ACTIONS: Record<Status, Mode[]> = {
  Available: [
    { kind: "checkout" },
    { kind: "status", status: "Internal", label: "Use internally" },
    { kind: "status", status: "Faulty", label: "Mark faulty" },
    { kind: "status", status: "Hilang", label: "Mark missing" },
    { kind: "status", status: "Retired", label: "Retire" },
  ],
  "In Use": [
    { kind: "checkin", label: "Return to stock" },
    { kind: "status", status: "Hilang", label: "Mark missing" },
  ],
  Internal: [
    { kind: "checkin", label: "Return to stock" },
    { kind: "checkout" },
    { kind: "status", status: "Faulty", label: "Mark faulty" },
    { kind: "status", status: "Hilang", label: "Mark missing" },
  ],
  Faulty: [
    { kind: "checkin", label: "Repaired" },
    { kind: "status", status: "Retired", label: "Retire" },
    { kind: "status", status: "Hilang", label: "Mark missing" },
  ],
  Hilang: [{ kind: "checkin", label: "Found" }],
  Retired: [{ kind: "checkin", label: "Back to stock" }],
};

const label = (m: Mode) => (m.kind === "checkout" ? "Send to customer" : m.label);

/**
 * Status buttons for a device (editors and up). Each opens a short inline form,
 * then calls `moveDevice`, which also writes the history entry.
 */
export function DeviceActions({
  device,
  workspaceId,
  customers,
  places,
}: {
  device: DeviceRow;
  workspaceId: string;
  customers: string[];
  places: Place[];
}) {
  const router = useRouter();
  const ids = useId();
  const [mode, setMode] = useState<Mode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // form fields (reset whenever a form opens)
  const [customer, setCustomer] = useState("");
  const [contact, setContact] = useState("");
  const [assignment, setAssignment] = useState<Assignment | "">("");
  const [outDate, setOutDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [result, setResult] = useState<"Available" | "Faulty">("Available");
  const [locationId, setLocationId] = useState("");
  const [note, setNote] = useState("");

  function open(m: Mode) {
    setMode(m);
    setError(null);
    setCustomer("");
    setContact("");
    setAssignment("");
    setOutDate(localToday());
    setReturnDate("");
    setResult("Available");
    // back where it came from, else the first site
    setLocationId(device.locationId ?? places.find((p) => !p.parentId)?.id ?? "");
    setNote("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!mode) return;
    const move: MoveInput =
      mode.kind === "checkout"
        ? { type: "checkout", customer, contact, assignment: assignment as Assignment, outDate, returnDate, note }
        : mode.kind === "checkin"
          ? { type: "checkin", result, locationId, note }
          : { type: "status", status: mode.status, note };
    setError(null);
    startTransition(async () => {
      const res = await moveDevice(workspaceId, device.id, move);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMode(null);
      router.refresh();
    });
  }

  const actions = ACTIONS[device.status];

  if (!mode) {
    return (
      <div className="flex flex-wrap gap-2">
        {actions.map((m, i) => (
          <button
            key={label(m)}
            type="button"
            onClick={() => open(m)}
            className={i === 0 ? "btn-primary px-3 py-1.5 text-xs" : "btn-ghost px-3 py-1.5 text-xs"}
          >
            {label(m)}
          </button>
        ))}
      </div>
    );
  }

  const field = "block";
  const lab = "label";
  return (
    <form onSubmit={submit} className="rounded-2xl bg-black/25 p-4 shadow-[inset_0_0_0_1px_rgba(239,155,62,.35)]">
      <div className="mb-3 font-mono text-[11px] uppercase tracking-widest text-[#FFC27A]">{label(mode)}</div>

      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-red/15 px-3 py-2 text-sm text-[#FFB3A6] shadow-[inset_0_0_0_1px_rgba(240,102,76,.55)]">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        {mode.kind === "checkout" && (
          <>
            <label className={`${field} col-span-2`}>
              <span className={lab}>Customer *</span>
              <input
                className="input"
                list={`${ids}-customers`}
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                maxLength={200}
                required
                autoFocus
              />
              <datalist id={`${ids}-customers`}>
                {customers.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <fieldset className="col-span-2">
              <legend className={lab}>Loan or installed? *</legend>
              <div className="grid grid-cols-2 gap-2">
                {ASSIGNMENTS.map((a) => (
                  <label
                    key={a}
                    className={`cursor-pointer rounded-xl px-3 py-2 text-sm transition ${
                      assignment === a ? "bg-amber/20 text-[#FFE1B8] shadow-[inset_0_0_0_1px_rgba(239,155,62,.6)]" : "bg-white/[.05] text-[#BAC3CF] hover:bg-white/[.08]"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${ids}-assignment`}
                      value={a}
                      checked={assignment === a}
                      onChange={() => setAssignment(a)}
                      className="sr-only"
                      required
                    />
                    <span className="block font-mono text-xs font-semibold">{ASSIGNMENT_LABELS[a]}</span>
                    <span className="block text-xs text-[#97A3B3]">{a === "loan" ? "Comes back" : "Stays there"}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className={field}>
              <span className={lab}>Out date</span>
              <input type="date" className="input" value={outDate} onChange={(e) => setOutDate(e.target.value)} />
            </label>
            <label className={field}>
              <span className={lab}>{assignment === "loan" ? "Return date *" : "Return date"}</span>
              <input
                type="date"
                className="input"
                value={returnDate}
                min={outDate || undefined}
                onChange={(e) => setReturnDate(e.target.value)}
                required={assignment === "loan"}
              />
            </label>
            <label className={`${field} col-span-2`}>
              <span className={lab}>Contact</span>
              <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={200} placeholder="Name / phone" />
            </label>
          </>
        )}

        {mode.kind === "checkin" && (
          <>
            <fieldset className="col-span-2">
              <legend className={lab}>Condition</legend>
              <div className="grid grid-cols-2 gap-2">
                {(["Available", "Faulty"] as const).map((r) => (
                  <label
                    key={r}
                    className={`cursor-pointer rounded-xl px-3 py-2 text-sm transition ${
                      result === r ? "bg-white/[.12] text-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,.3)]" : "bg-white/[.05] text-[#BAC3CF] hover:bg-white/[.08]"
                    }`}
                  >
                    <input type="radio" name={`${ids}-result`} value={r} checked={result === r} onChange={() => setResult(r)} className="sr-only" />
                    <span className="block font-mono text-xs font-semibold">{r === "Available" ? "Works" : "Broken"}</span>
                    <span className="block text-xs text-[#97A3B3]">→ {statusLabel(r)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className={`${field} col-span-2`}>
              <span className={lab}>Stored at</span>
              <PlaceSelect places={places} value={locationId} onChange={setLocationId} />
            </label>
          </>
        )}

        <label className={`${field} col-span-2`}>
          <span className={lab}>Note (optional, goes into history)</span>
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder={mode.kind === "checkin" ? "e.g. adapter missing" : ""}
            autoFocus={mode.kind === "status"}
          />
        </label>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn-ghost" disabled={pending} onClick={() => setMode(null)}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Confirm"}
        </button>
      </div>
    </form>
  );
}
