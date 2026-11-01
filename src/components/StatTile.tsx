import Link from "next/link";
import { MAX_DEVICES_PER_WORKSPACE, statusLabel, type Status } from "@/lib/categories";
import type { DeviceStats } from "@/lib/stats";
import { StatusLed } from "./StatusLed";
import { LiquidGlass } from "./ui/liquid-glass";

// Text colors for the big numbers, lighter than the LED colors so they stay readable on glass.
const NUMBER_COLORS: Record<Status, string> = {
  Available: "#6BE3B0",
  "In Use": "#FFE1B8",
  Internal: "#9FE3F0",
  Faulty: "#FBE29A",
  Hilang: "#FF9A86",
  Retired: "#C3CBD6",
};

// Retired is left out on purpose: it's history, not inventory. It stays reachable from the status filter.
const TILE_STATUSES: Status[] = ["Available", "In Use", "Internal", "Faulty", "Hilang"];

/** Total + one tile per live status. Give `hrefFor` for links (dashboard) or `onSelect` for filter toggles. */
export function StatusTiles({
  stats,
  active,
  hrefFor,
  onSelect,
}: {
  stats: DeviceStats;
  active?: StatKey;
  hrefFor?: (key: StatKey) => string;
  onSelect?: (key: StatKey) => void;
}) {
  const props = (key: StatKey) => ({
    active: active === key,
    href: hrefFor?.(key),
    onClick: onSelect ? () => onSelect(key) : undefined,
  });
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <StatTile statKey="All" label="Total" value={stats.total} sub={`/${MAX_DEVICES_PER_WORKSPACE}`} {...props("All")} />
      {TILE_STATUSES.map((s) => (
        <StatTile
          key={s}
          statKey={s}
          label={statusLabel(s)}
          value={stats[s]}
          sub={s === "In Use" && stats.overdue ? `· ${stats.overdue} overdue` : undefined}
          {...props(s)}
        />
      ))}
    </div>
  );
}

export type StatKey = "All" | Status;

/** Glass stat card. Pass `href` for a link or `onClick` for a filter toggle. */
export function StatTile({
  statKey,
  label,
  value,
  sub,
  active = false,
  href,
  onClick,
}: {
  statKey: StatKey;
  label: string;
  value: number;
  sub?: string;
  active?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const amber = statKey === "In Use";
  const inner = (
    <>
      <div
        className={`flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.12em] ${
          amber ? "text-[#FFE6C6]" : "text-[#C3CBD6]"
        }`}
      >
        {statKey !== "All" && <StatusLed status={statKey} />}
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="font-mono text-3xl font-semibold" style={{ color: statKey === "All" ? undefined : NUMBER_COLORS[statKey] }}>
          {value}
        </span>
        {sub && (
          <span className={`font-mono text-xs ${sub.includes("overdue") ? "text-[#FFB3A6]" : "text-[#97A3B3]"}`}>{sub}</span>
        )}
      </div>
    </>
  );
  const cls =
    "block w-full rounded-[20px] px-4 py-3.5 text-left transition hover:bg-white/[.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber";

  return (
    <LiquidGlass
      radius={20}
      scale={22}
      bevelDepth={10}
      aberration={2}
      tint={amber ? 0.02 : 0.07}
      className={`glass-rim ${active ? "outline outline-2 outline-offset-0 outline-amber" : ""}`}
      style={
        amber
          ? {
              backgroundColor: "rgba(30,16,4,.55)",
              backgroundImage: "linear-gradient(160deg, rgba(255,200,120,.32), rgba(245,150,50,.1) 50%, rgba(120,50,0,.15))",
            }
          : { backgroundColor: "rgba(10,12,16,.55)" }
      }
    >
      {href ? (
        <Link href={href} className={cls}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onClick} aria-pressed={active} className={cls}>
          {inner}
        </button>
      )}
    </LiquidGlass>
  );
}
