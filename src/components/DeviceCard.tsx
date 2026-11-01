import { GROUP_COLORS, categoryLabel, groupOf, statusLabel } from "@/lib/categories";
import type { DeviceRow } from "@/lib/types";
import { StatusLed } from "./StatusLed";

export { isOverdue } from "@/lib/stats";

export function OverdueBadge() {
  return (
    <span className="rounded-md bg-red/20 px-1.5 py-px font-mono text-[10px] font-semibold uppercase tracking-wider text-[#FFB3A6] shadow-[inset_0_0_0_1px_rgba(240,102,76,.6)]">
      Overdue
    </span>
  );
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
      className={`lg lg-dark group w-full rounded-[20px] p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:bg-white/[.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber ${
        overdue ? "outline outline-1 outline-red/50" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-widest">
        <span className="flex min-w-0 items-center gap-1.5" style={{ color: GROUP_COLORS[group] }}>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: GROUP_COLORS[group] }} />
          <span className="truncate">{categoryLabel(d.category)}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[#C3CBD6]">
          <StatusLed status={d.status} />
          {statusLabel(d.status)}
        </span>
      </div>

      <div className="mt-2.5 truncate font-mono text-[15px] font-semibold text-ink transition group-hover:text-[#FFC27A]">
        {d.name}
      </div>
      <div className="truncate font-mono text-xs text-[#97A3B3]">{d.serial ?? "no serial"}</div>

      <dl className="mt-3 space-y-1 rounded-xl bg-black/20 px-3 py-2 text-xs text-[#AEB8C5] empty:hidden">
        {d.location && (
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 font-mono text-[10px] uppercase leading-4 tracking-wider">Loc</dt>
            <dd className="truncate text-ink/85">
              {d.location}
              {d.rackPosition ? ` · ${d.rackPosition}` : ""}
            </dd>
          </div>
        )}
        {d.customer && (
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 font-mono text-[10px] uppercase leading-4 tracking-wider">Cust</dt>
            <dd className="truncate text-ink/85">{d.customer}</dd>
          </div>
        )}
        {d.status === "In Use" && d.assignment === "loan" && d.returnDate && (
          <div className="flex items-center gap-2">
            <dt className="w-14 shrink-0 font-mono text-[10px] uppercase leading-4 tracking-wider">Due</dt>
            <dd className="flex items-center gap-2 text-ink/85">
              {d.returnDate}
              {overdue && <OverdueBadge />}
            </dd>
          </div>
        )}
      </dl>
    </button>
  );
}
