"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ASSIGNMENT_LABELS, GROUP_COLORS, categoryLabel, groupLabel, groupOf, statusLabel } from "@/lib/categories";
import type { DeviceRow, HistoryItem } from "@/lib/types";
import { deleteDevice } from "@/app/app/actions";
import { OverdueBadge, isOverdue } from "./DeviceCard";
import { DeviceDrawer, Row, type Suggestions } from "./DeviceDrawer";
import { DeviceActions } from "./DeviceActions";
import { StatusLed } from "./StatusLed";
import { Timeline } from "./Timeline";

function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="lg lg-dark rounded-[22px] p-5">
      <h2 className="mb-2 font-mono text-sm font-semibold tracking-wider">{title}</h2>
      <dl>{children}</dl>
    </section>
  );
}

export function DeviceDetail({
  device: d,
  history,
  workspaceId,
  canEdit,
  suggestions,
}: {
  device: DeviceRow;
  history: HistoryItem[];
  workspaceId: string;
  canEdit: boolean;
  suggestions: Suggestions;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [today, setToday] = useState(""); // set after mount to avoid hydration mismatch
  useEffect(() => setToday(localToday()), []);

  const group = groupOf(d.category);
  const overdue = isOverdue(d, today);

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await deleteDevice(workspaceId, d.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/app/devices");
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href="/app/devices" className="font-mono text-xs text-[#FFC27A] hover:underline">
          ← Devices
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-widest" style={{ color: GROUP_COLORS[group] }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: GROUP_COLORS[group] }} />
              {groupLabel(group)} · {categoryLabel(d.category)}
            </div>
            <h1 className="mt-1.5 break-words font-mono text-2xl font-semibold normal-case tracking-[-0.02em] sm:text-3xl">{d.name}</h1>
            <div className="font-mono text-sm text-[#97A3B3]">{d.serial ?? "no serial"}</div>
          </div>
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              {confirmDelete ? (
                <>
                  <span className="text-sm text-[#FFB3A6]">Delete permanently?</span>
                  <button type="button" className="btn-ghost" disabled={pending} onClick={() => setConfirmDelete(false)}>
                    Keep
                  </button>
                  <button type="button" className="btn-danger" disabled={pending} onClick={remove}>
                    {pending ? "Deleting…" : "Yes, delete"}
                  </button>
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
          )}
        </div>
      </div>

      {canEdit && (
        <section className="lg lg-dark rounded-[22px] p-4">
          <DeviceActions device={d} workspaceId={workspaceId} customers={suggestions.customers} locations={suggestions.locations} />
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red/15 px-3 py-2 text-sm text-[#FFB3A6] shadow-[inset_0_0_0_1px_rgba(240,102,76,.55)]">
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="space-y-4">
          <Panel title="Assignment">
            <Row
              label="Status"
              value={
                <span className="flex items-center gap-2">
                  <StatusLed status={d.status} /> {statusLabel(d.status)}
                  {overdue && <OverdueBadge />}
                </span>
              }
            />
            <Row label="Customer" value={d.customer ?? "—"} />
            <Row label="Assignment" value={d.assignment && ASSIGNMENT_LABELS[d.assignment]} />
            <Row label="Contact" value={d.contact} />
            <Row label="Out date" value={d.outDate} />
            <Row label="Return date" value={d.returnDate} />
          </Panel>
          <Panel title="Location">
            <Row label="Location" value={d.location ?? "—"} />
            <Row label="Rack / port" value={d.rackPosition} />
            <Row label="Coordinates" value={d.lat != null && d.lng != null ? `${d.lat}, ${d.lng}` : null} />
          </Panel>
          <Panel title="Hardware">
            <Row label="Firmware" value={d.firmwareVersion && <span className="font-mono">{d.firmwareVersion}</span>} />
            <Row label="Condition" value={d.condition} />
            <Row label="Purchase date" value={d.purchaseDate} />
            <Row label="Warranty" value={d.warranty} />
            <Row label="Added" value={d.createdAt.slice(0, 10)} />
            <Row label="Updated" value={d.updatedAt.slice(0, 10)} />
          </Panel>
          {d.notes && (
            <section className="lg lg-dark rounded-[22px] p-5">
              <h2 className="mb-2 font-mono text-sm font-semibold tracking-wider">Notes</h2>
              <p className="whitespace-pre-wrap break-words text-sm text-ink/90">{d.notes}</p>
            </section>
          )}
        </div>

        <section className="lg lg-dark h-fit rounded-[22px] p-5">
          <h2 className="mb-4 font-mono text-sm font-semibold tracking-wider">History</h2>
          <Timeline items={history} />
        </section>
      </div>

      {editing && (
        <DeviceDrawer
          device={d}
          workspaceId={workspaceId}
          canEdit={canEdit}
          overdue={overdue}
          startEditing
          showDetailsLink={false}
          suggestions={suggestions}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
