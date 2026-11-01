import { STATUS_COLORS, type Status } from "@/lib/categories";

export function StatusLed({ status, size = 8 }: { status: Status; size?: number }) {
  const color = STATUS_COLORS[status];
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-full ${status === "In Use" ? "animate-led" : ""}`}
      style={{
        width: size,
        height: size,
        color,
        backgroundColor: color,
        boxShadow: `0 0 ${size + 2}px ${size / 8}px ${color}88`,
      }}
    />
  );
}

export function Logo({ className = "", textClassName = "" }: { className?: string; textClassName?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-mono text-[17px] font-semibold tracking-tight ${className}`}>
      {/* Rack unit in scan corners; same shapes as MARK_SHAPES in lib/brand.ts and app/icon.svg */}
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"
          stroke="#FFC27A"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="6.5" y="9.25" width="11" height="5.5" rx="1.6" stroke="#F1F4F8" strokeWidth="1.7" />
        <circle cx="9.2" cy="12" r="1.15" fill="#4FD199" />
        <rect x="11.4" y="11.35" width="4.2" height="1.3" rx="0.65" fill="#F7A23A" />
      </svg>
      <span className={textClassName}>RackTrack</span>
    </span>
  );
}
