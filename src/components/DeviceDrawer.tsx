"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CATEGORY_GROUPS,
  GROUPS,
  GROUP_COLORS,
  STATUSES,
  groupOf,
} from "@/lib/categories";
import type { DeviceRow } from "@/lib/types";
import { createDevice, deleteDevice, updateDevice } from "@/app/app/actions";
import { StatusLed } from "./StatusLed";

type FormState = {
  name: string;
  serial: string;
  category: string;
  status: string;
  location: string;
  rackPosition: string;
  firmwareVersion: string;
  customer: string;
  contact: string;
  outDate: string;
  returnDate: string;
  lat: string;
  lng: string;
  condition: string;
  purchaseDate: string;
  warranty: string;
  notes: string;
};

function toForm(d: DeviceRow | null): FormState {
  return {
    name: d?.name ?? "",
    serial: d?.serial ?? "",
    category: d?.category ?? "Switch",
    status: d?.status ?? "Available",
    location: d?.location ?? "",
    rackPosition: d?.rackPosition ?? "",
    firmwareVersion: d?.firmwareVersion ?? "",
    customer: d?.customer ?? "",
    contact: d?.contact ?? "",
    outDate: d?.outDate ?? "",
    returnDate: d?.returnDate ?? "",
    lat: d?.lat != null ? String(d.lat) : "",
    lng: d?.lng != null ? String(d.lng) : "",
    condition: d?.condition ?? "",
    purchaseDate: d?.purchaseDate ?? "",
    warranty: d?.warranty ?? "",
    notes: d?.notes ?? "",
  };
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={full ? "col-span-2 block" : "block"}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-line/60 py-2 text-sm">
      <dt className="font-mono text-[10px] uppercase tracking-widest text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-ink/90">{value}</dd>
    </div>
  );
}

export function DeviceDrawer({
  device,
  overdue,
  onClose,
}: {
  device: DeviceRow | null; // null = new device
  overdue: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const isNew = device === null;
  const [editing, setEditing] = useState(isNew);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<FormState>(() => toForm(device));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !pending && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, pending]);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = isNew ? await createDevice(form) : await updateDevice(device.id, form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
      if (isNew) onClose();
      else setEditing(false);
    });
  }

  function remove() {
    if (!device) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteDevice(device.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  const group = device ? groupOf(device.category) : null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={() => !pending && onClose()} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "Add device" : device.name}
        className="relative flex h-full w-full max-w-xl animate-slidein flex-col border-l border-line bg-surface shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            {group && device && (
              <div
                className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest"
                style={{ color: GROUP_COLORS[group] }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: GROUP_COLORS[group] }} />
                {group} · {device.category}
              </div>
            )}
            <h2 className="truncate font-mono text-lg font-semibold">
              {isNew ? "Add device" : editing ? `Edit ${device.name}` : device.name}
            </h2>
            {device && !editing && (
              <div className="truncate font-mono text-xs text-muted">{device.serial ?? "no serial"}</div>
            )}
          </div>
          <button type="button" onClick={onClose} className="btn-ghost px-2.5 py-1" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <p role="alert" className="mb-4 rounded border border-red/60 bg-red/10 px-3 py-2 text-sm text-red">
              {error}
            </p>
          )}

          {editing ? (
            <form id="device-form" onSubmit={save} className="grid grid-cols-2 gap-x-3 gap-y-4">
              <Field label="Name *" full>
                <input className="input" value={form.name} onChange={set("name")} required maxLength={120} autoFocus />
              </Field>
              <Field label="Serial" full>
                <input className="input font-mono" value={form.serial} onChange={set("serial")} maxLength={120} />
              </Field>
              <Field label="Type">
                <select className="input" value={form.category} onChange={set("category")}>
                  {GROUPS.map((g) => (
                    <optgroup key={g} label={g}>
                      {CATEGORY_GROUPS[g].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select className="input" value={form.status} onChange={set("status")}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Location">
                <input className="input" value={form.location} onChange={set("location")} maxLength={200} />
              </Field>
              <Field label="Rack position / port">
                <input className="input" value={form.rackPosition} onChange={set("rackPosition")} maxLength={80} placeholder="e.g. R2-U14" />
              </Field>
              <Field label="Firmware version" full>
                <input className="input font-mono" value={form.firmwareVersion} onChange={set("firmwareVersion")} maxLength={80} />
              </Field>

              <div className="col-span-2 mt-1 border-t border-line pt-3 font-mono text-[10px] uppercase tracking-widest text-amber">
                Customer / loan
              </div>
              <Field label="Customer">
                <input className="input" value={form.customer} onChange={set("customer")} maxLength={200} />
              </Field>
              <Field label="Contact">
                <input className="input" value={form.contact} onChange={set("contact")} maxLength={200} />
              </Field>
              <Field label="Out date">
                <input type="date" className="input" value={form.outDate} onChange={set("outDate")} />
              </Field>
              <Field label="Return date">
                <input type="date" className="input" value={form.returnDate} onChange={set("returnDate")} />
              </Field>

              <div className="col-span-2 mt-1 border-t border-line pt-3 font-mono text-[10px] uppercase tracking-widest text-amber">
                Details
              </div>
              <Field label="Condition">
                <input className="input" value={form.condition} onChange={set("condition")} maxLength={200} />
              </Field>
              <Field label="Warranty">
                <input className="input" value={form.warranty} onChange={set("warranty")} maxLength={200} />
              </Field>
              <Field label="Purchase date">
                <input type="date" className="input" value={form.purchaseDate} onChange={set("purchaseDate")} />
              </Field>
              <span />
              <Field label="Latitude">
                <input className="input font-mono" inputMode="decimal" value={form.lat} onChange={set("lat")} placeholder="-6.2" />
              </Field>
              <Field label="Longitude">
                <input className="input font-mono" inputMode="decimal" value={form.lng} onChange={set("lng")} placeholder="106.8" />
              </Field>
              <Field label="Notes" full>
                <textarea className="input min-h-24" value={form.notes} onChange={set("notes")} maxLength={4000} />
              </Field>
            </form>
          ) : (
            device && (
              <dl>
                <Row
                  label="Status"
                  value={
                    <span className="flex items-center gap-2">
                      <StatusLed status={device.status} /> {device.status}
                      {overdue && (
                        <span className="rounded border border-red/60 bg-red/10 px-1.5 py-px font-mono text-[10px] font-semibold uppercase tracking-wider text-red">
                          Overdue
                        </span>
                      )}
                    </span>
                  }
                />
                <Row label="Location" value={device.location} />
                <Row label="Rack / port" value={device.rackPosition} />
                <Row label="Firmware" value={device.firmwareVersion && <span className="font-mono">{device.firmwareVersion}</span>} />
                <Row label="Customer" value={device.customer} />
                <Row label="Contact" value={device.contact} />
                <Row label="Out date" value={device.outDate} />
                <Row label="Return date" value={device.returnDate} />
                <Row label="Condition" value={device.condition} />
                <Row label="Purchase date" value={device.purchaseDate} />
                <Row label="Warranty" value={device.warranty} />
                <Row
                  label="Coordinates"
                  value={device.lat != null && device.lng != null ? `${device.lat}, ${device.lng}` : null}
                />
                <Row label="Notes" value={device.notes && <span className="whitespace-pre-wrap">{device.notes}</span>} />
                <Row label="Added" value={new Date(device.createdAt).toLocaleDateString()} />
                <Row label="Updated" value={new Date(device.updatedAt).toLocaleDateString()} />
              </dl>
            )
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3">
          {editing ? (
            <>
              <button
                type="button"
                className="btn-ghost"
                disabled={pending}
                onClick={() => {
                  if (isNew) onClose();
                  else {
                    setForm(toForm(device));
                    setError(null);
                    setEditing(false);
                  }
                }}
              >
                Cancel
              </button>
              <button type="submit" form="device-form" className="btn-primary" disabled={pending}>
                {pending ? "Saving…" : isNew ? "Add device" : "Save changes"}
              </button>
            </>
          ) : confirmDelete ? (
            <>
              <span className="text-sm text-red">Delete this device permanently?</span>
              <div className="flex gap-2">
                <button type="button" className="btn-ghost" disabled={pending} onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
                <button type="button" className="btn-danger" disabled={pending} onClick={remove}>
                  {pending ? "Deleting…" : "Yes, delete"}
                </button>
              </div>
            </>
          ) : (
            <>
              <button type="button" className="btn-danger" onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
              <button type="button" className="btn-primary" onClick={() => setEditing(true)}>
                Edit
              </button>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
