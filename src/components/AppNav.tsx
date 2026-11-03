"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CATEGORY_GROUPS, GROUPS, GROUP_COLORS, categoryLabel, groupLabel } from "@/lib/categories";

type IconName = "dashboard" | "devices" | "customers" | "locations" | "activity" | "team" | "scan" | "opname";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/app", label: "Dashboard", icon: "dashboard" },
  { href: "/app/devices", label: "Devices", icon: "devices" },
  { href: "/app/projects", label: "Projects", icon: "customers" },
  { href: "/app/locations", label: "Locations", icon: "locations" },
  { href: "/app/activity", label: "Activity", icon: "activity" },
  { href: "/app/team", label: "Team", icon: "team" },
];

// The sidebar also lists Scan; on phones it's the floating button instead of a tab.
const SIDEBAR_NAV = [
  ...NAV.slice(0, 2),
  { href: "/app/scan", label: "Scan", icon: "scan" as const },
  { href: "/app/opname", label: "Stock opname", icon: "opname" as const },
  ...NAV.slice(2),
];
// Five tabs fit a phone; Activity stays reachable from the dashboard's "See all".
const TAB_NAV = NAV.filter((n) => n.href !== "/app/activity");

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    ),
    devices: (
      <>
        <rect x="3" y="4" width="18" height="5" rx="1.5" />
        <rect x="3" y="11" width="18" height="5" rx="1.5" />
        <path d="M7 6.5h.01M7 13.5h.01M3 20h18" />
      </>
    ),
    customers: (
      <>
        <path d="M4 21V6a1 1 0 011-1h8a1 1 0 011 1v15M14 10h5a1 1 0 011 1v10M2 21h20" />
        <path d="M8 9h2M8 13h2M8 17h2M17 14h.01M17 17h.01" />
      </>
    ),
    locations: (
      <>
        <path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z" />
        <circle cx="12" cy="9.5" r="2.5" />
      </>
    ),
    activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
    opname: (
      <>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4V3h6v1M9 11l2 2 4-4M9 17h6" />
      </>
    ),
    scan: <path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M7 12h10" />,
    team: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M18 14a6.5 6.5 0 013.5 6" />
      </>
    ),
  };
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name]}
    </svg>
  );
}

const isActive = (pathname: string, href: string) =>
  href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`);

/** Desktop sidebar body: main nav plus category shortcuts with counts. */
export function SidebarNav({ counts }: { counts: Record<string, number> }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const onDevices = pathname === "/app/devices";
  const activeGroup = onDevices ? params.get("group") : null;
  const activeType = onDevices ? params.get("type") : null;

  return (
    <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col">
      <ul className="space-y-1">
        {SIDEBAR_NAV.map((n) => {
          const active = isActive(pathname, n.href) && !(n.href === "/app/devices" && (activeGroup || activeType));
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                  active ? "bg-amber/15 text-[#FFD9A8] shadow-[inset_0_0_0_1px_rgba(239,155,62,.45)]" : "text-[#C3CBD6] hover:bg-white/[.06] hover:text-ink"
                }`}
              >
                <Icon name={n.icon} />
                {n.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="eyebrow mt-6 px-3">Categories</div>
      <ul className="mt-2 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {GROUPS.map((g) => {
          const cats = CATEGORY_GROUPS[g];
          const total = cats.reduce((n, c) => n + (counts[c] ?? 0), 0);
          const groupActive = activeGroup === g && !activeType;
          return (
            <li key={g}>
              <Link
                href={`/app/devices?group=${encodeURIComponent(g)}`}
                aria-current={groupActive ? "page" : undefined}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition hover:bg-white/[.06] ${
                  groupActive ? "bg-white/[.08]" : ""
                }`}
                style={{ color: GROUP_COLORS[g] }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: GROUP_COLORS[g] }} />
                <span className="flex-1">{groupLabel(g)}</span>
                <span className="text-[#97A3B3]">{total}</span>
              </Link>
              {cats.length > 1 && (
                <ul className="mt-0.5">
                  {cats.map((c) => {
                    const n = counts[c] ?? 0;
                    const active = activeType === c;
                    return (
                      <li key={c}>
                        <Link
                          href={`/app/devices?type=${encodeURIComponent(c)}`}
                          aria-current={active ? "page" : undefined}
                          className={`flex items-center rounded-lg py-1 pl-7 pr-3 text-[13px] transition hover:bg-white/[.06] hover:text-ink ${
                            active ? "bg-white/[.08] text-ink" : n ? "text-[#BAC3CF]" : "text-[#8B97A8]"
                          }`}
                        >
                          <span className="flex-1 truncate">{categoryLabel(c)}</span>
                          <span className="font-mono text-[11px] text-[#97A3B3]">{n}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Phone/tablet tab bar (below lg), plus the floating Scan button. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <>
    {pathname !== "/app/scan" && (
      <Link
        href="/app/scan"
        aria-label="Scan a barcode or QR code"
        className="fixed bottom-[calc(max(.75rem,env(safe-area-inset-bottom))+4.75rem)] right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-b from-[#FFD08A] via-[#F7A23A] to-[#E3841E] text-[#1D1104] shadow-[0_8px_24px_rgba(239,155,62,.45),inset_0_1px_1px_rgba(255,255,255,.8)] transition active:scale-95 lg:hidden"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M7 12h10" />
        </svg>
      </Link>
    )}
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      <ul className="lg lg-dark mx-auto grid max-w-md grid-cols-5 rounded-[22px] p-1.5">
        {TAB_NAV.map((n) => {
          const active = isActive(pathname, n.href);
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 rounded-2xl py-1.5 font-mono text-[9px] uppercase tracking-wide transition ${
                  active ? "bg-amber/15 text-[#FFD9A8]" : "text-[#AEB8C5] hover:text-ink"
                }`}
              >
                <Icon name={n.icon} />
                {n.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
    </>
  );
}
