import Link from "next/link";
import { historyLabel } from "@/lib/categories";
import type { HistoryItem } from "@/lib/types";
import { LocalTime } from "./LocalTime";

/** History list, newest first. `showDevice` adds a link to each entry's device. */
export function Timeline({ items, showDevice = false }: { items: HistoryItem[]; showDevice?: boolean }) {
  if (items.length === 0) return <p className="text-sm text-[#AEB8C5]">No activity yet.</p>;
  return (
    <ol className="relative space-y-4 before:absolute before:bottom-1 before:left-[5px] before:top-1 before:w-px before:bg-white/10">
      {items.map((h) => (
        <li key={h.id} className="relative pl-6">
          <span className="absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full bg-[#0A0D12] shadow-[inset_0_0_0_2px_#EF9B3E]" aria-hidden />
          <div className="text-sm text-ink">
            {showDevice && (
              <>
                <Link href={`/app/devices/${h.deviceId}`} className="font-mono normal-case text-[#FFC27A] hover:underline">
                  {h.deviceName}
                </Link>
                <span className="text-[#8B97A8]"> · </span>
              </>
            )}
            {historyLabel(h.text)}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-[#97A3B3]">
            <LocalTime iso={h.createdAt} />
            {h.by && <> · {h.by}</>}
          </div>
        </li>
      ))}
    </ol>
  );
}
