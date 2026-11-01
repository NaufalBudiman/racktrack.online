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
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="3" width="18" height="5" rx="1.5" stroke="#FFC27A" strokeWidth="1.8" />
        <rect x="3" y="10" width="18" height="5" rx="1.5" stroke="#FFC27A" strokeWidth="1.8" />
        <rect x="3" y="17" width="18" height="4" rx="1.5" stroke="#FFC27A" strokeWidth="1.8" />
        <circle cx="7" cy="5.5" r="1" fill="#4FD199" />
        <circle cx="7" cy="12.5" r="1" fill="#F7A23A" />
      </svg>
      <span className={textClassName}>RackTrack</span>
    </span>
  );
}
