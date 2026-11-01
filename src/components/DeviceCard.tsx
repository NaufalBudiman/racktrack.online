import { GROUP_COLORS, groupOf } from "@/lib/categories";
import type { DeviceRow } from "@/lib/types";
import { StatusLed } from "./StatusLed";

export function isOverdue(d: DeviceRow, today: string): boolean {
  return d.status === "In Use" && !!d.returnDate && !!today && d.returnDate < today;
}

export function DeviceCard({
  device: d,
  overdue,
  onOpen,
}: {
  device: DeviceRow;
  overdue: boolean;
  onOpen: () => void;
}) {
  const group = groupOf(d.category);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative w-full rounded-md border border-line bg-surface p-4 text-left transition hover:border-amber/60 hover:bg-surface2 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber"
    >
      <span className="rivet left-1.5 top-1.5" />
      <span className="rivet right-1.5 top-1.5" />
      <span className="rivet bottom-1.5 left-1.5" />
      <span className="rivet bottom-1.5 right-1.5" />

      <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-widest">
        <span className="flex min-w-0 items-center gap-1.5" style={{ color: GROUP_COLORS[group] }}>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: GROUP_COLORS[group] }} />
          <span className="truncate">{d.category}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-muted">
          <StatusLed status={d.status} />
          {d.status}
        </span>
      </div>

      <div className="mt-2 truncate font-mono text-[15px] font-semibold text-ink group-hover:text-amber">
        {d.name}
      </div>
      <div className="truncate font-mono text-xs text-muted">{d.serial ?? "no serial"}</div>

      <dl className="mt-3 space-y-1 text-xs text-muted">
        {d.location && (
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 font-mono uppercase tracking-wider text-[10px] leading-4">Loc</dt>
            <dd className="truncate text-ink/80">
              {d.location}
              {d.rackPosition ? ` · ${d.rackPosition}` : ""}
            </dd>
          </div>
        )}
        {d.customer && (
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 font-mono uppercase tracking-wider text-[10px] leading-4">Cust</dt>
            <dd className="truncate text-ink/80">{d.customer}</dd>
          </div>
        )}
        {d.status === "In Use" && d.returnDate && (
          <div className="flex items-center gap-2">
            <dt className="w-14 shrink-0 font-mono uppercase tracking-wider text-[10px] leading-4">Due</dt>
            <dd className="flex items-center gap-2 text-ink/80">
              {d.returnDate}
              {overdue && (
                <span className="rounded border border-red/60 bg-red/10 px-1.5 py-px font-mono text-[10px] font-semibold uppercase tracking-wider text-red">
                  Overdue
                </span>
              )}
            </dd>
          </div>
        )}
      </dl>
    </button>
  );
}
