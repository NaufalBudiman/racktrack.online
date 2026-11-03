"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ASSIGNMENTS,
  ASSIGNMENT_LABELS,
  CATEGORY_GROUPS,
  GROUPS,
  GROUP_COLORS,
  STATUSES,
  STATUS_HINTS,
  categoryLabel,
  groupLabel,
  groupOf,
  statusLabel,
} from "@/lib/categories";
import type { DeviceRow } from "@/lib/types";
import { createDevice, deleteDevice, updateDevice } from "@/app/app/actions";
import { StatusLed } from "./StatusLed";
import { OverdueBadge } from "./DeviceCard";
import { DeviceActions } from "./DeviceActions";
import { PlaceSelect } from "./PlaceSelect";
import type { Place } from "@/lib/places";

// models: existing model names with their type, so picking one fills the type in.
export type Suggestions = { customers: string[]; places: Place[]; models?: { name: string; category: string }[] };

type FormState = {
  name: string;
  serial: string;
  category: string;
  status: string;
  assignment: string;
  locationId: string; // "" = none
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
    assignment: d?.assignment ?? "",
    locationId: d?.locationId ?? "",
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

export function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-white/[.08] py-2.5 text-sm">
      <dt className="font-mono text-[10px] uppercase tracking-widest text-[#AEB8C5]">{label}</dt>
      <dd className="min-w-0 break-words text-ink/90">{value}</dd>
    </div>
  );
}

export function DeviceDrawer({
  device,
  workspaceId,
  canEdit,
  overdue,
  onClose,
  onDeleted,
  startEditing = false,
  showDetailsLink = true,
  suggestions = { customers: [], places: [] },
  initial,
}: {
  device: DeviceRow | null; // null = new device
  workspaceId: string;
  canEdit: boolean; // false = viewer, read only
  overdue: boolean;
  onClose: () => void;
  onDeleted?: () => void; // defaults to onClose
  startEditing?: boolean;
  showDetailsLink?: boolean;
  suggestions?: Suggestions;
  initial?: { serial?: string; locationId?: string }; // prefill for a new device (e.g. from a scan)
}) {
  const router = useRouter();
  const isNew = device === null;
  const [editing, setEditing] = useState(isNew || startEditing);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<FormState>(() =>
    device ? toForm(device) : { ...toForm(null), serial: initial?.serial ?? "", locationId: initial?.locationId ?? "" },
  );
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
      const res = isNew
        ? await createDevice(workspaceId, form)
        : await updateDevice(workspaceId, device.id, form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
      if (isNew || startEditing) onClose();
      else setEditing(false);
    });
  }

  function remove() {
    if (!device) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteDevice(workspaceId, device.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (onDeleted) onDeleted();
      else {
        router.refresh();
        onClose();
      }
    });
  }

  const group = device ? groupOf(device.category) : null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={() => !pending && onClose()} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "Add device" : device.name}
        className="lg lg-solid relative flex h-full w-full max-w-xl animate-slidein flex-col rounded-none sm:my-3 sm:mr-3 sm:h-[calc(100%-1.5rem)] sm:rounded-[28px]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-6 py-5">
          <div className="min-w-0">
            {group && device && (
              <div
                className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest"
                style={{ color: GROUP_COLORS[group] }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: GROUP_COLORS[group] }} />
                {groupLabel(group)} · {categoryLabel(device.category)}
              </div>
            )}
            <h2 className="mt-1 truncate font-mono text-lg font-semibold normal-case">
              {isNew ? "Add device" : editing ? `Edit ${device.name}` : device.name}
            </h2>
            {device && !editing && (
              <div className="truncate font-mono text-xs text-[#97A3B3]">{device.serial ?? "no serial"}</div>
            )}
            {device && !editing && showDetailsLink && (
              <Link href={`/app/devices/${device.id}`} className="mt-1 inline-block font-mono text-xs text-[#FFC27A] hover:underline">
                Open full page and history →
              </Link>
            )}
          </div>
          <button type="button" onClick={onClose} className="btn-ghost h-10 w-10 px-0" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <p role="alert" className="mb-4 rounded-xl bg-red/15 px-3 py-2 text-sm text-[#FFB3A6] shadow-[inset_0_0_0_1px_rgba(240,102,76,.55)]">
              {error}
            </p>
          )}

          {editing ? (
            <form id="device-form" onSubmit={save} className="grid grid-cols-2 gap-x-3 gap-y-4">
              <Field label="Name *" full>
                <input
                  className="input"
                  list="drawer-models"
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    // Picking a known model also sets its type.
                    const known = suggestions.models?.find((m) => m.name.toLowerCase() === name.trim().toLowerCase());
                    setForm((f) => ({ ...f, name, ...(known ? { category: known.category } : {}) }));
                  }}
                  required
                  maxLength={120}
                  autoFocus={!initial?.serial}
                />
                <datalist id="drawer-models">
                  {suggestions.models?.map((m) => (
                    <option key={m.name} value={m.name} />
                  ))}
                </datalist>
              </Field>
              <Field label="Serial" full>
                <input className="input font-mono" value={form.serial} onChange={set("serial")} maxLength={120} />
              </Field>
              <Field label="Type">
                <select className="input" value={form.category} onChange={set("category")}>
                  {GROUPS.map((g) => (
                    <optgroup key={g} label={groupLabel(g)}>
                      {CATEGORY_GROUPS[g].map((c) => (
                        <option key={c} value={c}>{categoryLabel(c)}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select className="input" value={form.status} onChange={set("status")}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{statusLabel(s)}</option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-[#97A3B3]">{STATUS_HINTS[form.status as keyof typeof STATUS_HINTS]}</span>
              </Field>
              <Field label="Location">
                <PlaceSelect
                  places={suggestions.places}
                  value={form.locationId}
                  onChange={(locationId) => setForm((f) => ({ ...f, locationId }))}
                />
                {suggestions.places.length === 0 && (
                  <span className="mt-1 block text-xs text-[#97A3B3]">Add sites and racks on the Locations page.</span>
                )}
              </Field>
              <Field label="Rack position / port">
                <input className="input" value={form.rackPosition} onChange={set("rackPosition")} maxLength={80} placeholder="e.g. R2-U14" />
              </Field>
              <Field label="Firmware version" full>
                <input className="input font-mono" value={form.firmwareVersion} onChange={set("firmwareVersion")} maxLength={80} />
              </Field>

              {/* Customer details only exist while a device is at a customer (or went missing there). */}
              {(form.status === "In Use" || form.status === "Hilang") && (
                <>
                  <div className="col-span-2 mt-1 border-t border-white/10 pt-3 font-mono text-[10px] uppercase tracking-widest text-[#FFC27A]">
                    {form.status === "In Use" ? "At project" : "Last known project"}
                  </div>
                  <Field label={form.status === "In Use" ? "Project / customer *" : "Project / customer"}>
                    <input
                      className="input"
                      value={form.customer}
                      onChange={set("customer")}
                      maxLength={200}
                      required={form.status === "In Use"}
                    />
                  </Field>
                  <Field label="Contact">
                    <input className="input" value={form.contact} onChange={set("contact")} maxLength={200} />
                  </Field>
                  {form.status === "In Use" && (
                    <>
                      <Field label="Loan or installed? *" full>
                        <select className="input" value={form.assignment} onChange={set("assignment")} required>
                          <option value="" disabled>Pick one…</option>
                          {ASSIGNMENTS.map((a) => (
                            <option key={a} value={a}>
                              {ASSIGNMENT_LABELS[a]}
                              {a === "loan" ? " (comes back, needs a return date)" : " (stays with the customer)"}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Out date">
                        <input type="date" className="input" value={form.outDate} onChange={set("outDate")} />
                      </Field>
                      <Field label={form.assignment === "loan" ? "Return date *" : "Return date"}>
                        <input
                          type="date"
                          className="input"
                          value={form.returnDate}
                          onChange={set("returnDate")}
                          required={form.assignment === "loan"}
                        />
                      </Field>
                    </>
                  )}
                </>
              )}

              <div className="col-span-2 mt-1 border-t border-white/10 pt-3 font-mono text-[10px] uppercase tracking-widest text-[#FFC27A]">
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
              <>
                {canEdit && (
                  <div className="mb-5">
                    <DeviceActions
                      device={device}
                      workspaceId={workspaceId}
                      customers={suggestions.customers}
                      places={suggestions.places}
                    />
                  </div>
                )}
                <dl>
                  <Row
                    label="Status"
                    value={
                      <span className="flex items-center gap-2">
                        <StatusLed status={device.status} /> {statusLabel(device.status)}
                        {overdue && <OverdueBadge />}
                      </span>
                    }
                  />
                  <Row label="Location" value={device.location} />
                  <Row label="Rack / port" value={device.rackPosition} />
                  <Row label="Firmware" value={device.firmwareVersion && <span className="font-mono">{device.firmwareVersion}</span>} />
                  <Row label="Project" value={device.customer} />
                  <Row label="Assignment" value={device.assignment && ASSIGNMENT_LABELS[device.assignment]} />
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
              </>
            )
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-6 py-4">
          {editing ? (
            <>
              <button
                type="button"
                className="btn-ghost"
                disabled={pending}
                onClick={() => {
                  if (isNew || startEditing) onClose();
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
              <span className="text-sm text-[#FFB3A6]">Delete this device permanently?</span>
              <div className="flex gap-2">
                <button type="button" className="btn-ghost" disabled={pending} onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
                <button type="button" className="btn-danger" disabled={pending} onClick={remove}>
                  {pending ? "Deleting…" : "Yes, delete"}
                </button>
              </div>
            </>
          ) : !canEdit ? (
            <span className="font-mono text-xs text-[#AEB8C5]">View only. Ask an admin for editor access.</span>
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
