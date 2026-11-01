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
        boxShadow: `0 0 ${size}px ${size / 8}px ${color}66`,
      }}
    />
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-mono text-sm font-semibold tracking-[0.2em] ${className}`}>
      <span className="grid h-5 w-5 grid-rows-3 gap-[2px]" aria-hidden>
        <span className="rounded-[1px] border border-line bg-surface" />
        <span className="rounded-[1px] border border-line bg-surface" />
        <span className="rounded-[1px] border border-amber bg-amber/80" />
      </span>
      RACKTRACK
    </span>
  );
}
