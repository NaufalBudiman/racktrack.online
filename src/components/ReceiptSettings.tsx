"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateReceiptSettings } from "@/app/app/receipts/actions";
import { DEFAULT_RECEIPT_FORMAT, RECEIPT_TOKENS, formatReceiptNumber } from "@/lib/receiptTypes";
import type { ReceiptSettings as Settings } from "@/lib/receipts";

const MAX_BYTES = 290_000;

/** Team page (admins): letterhead + defaults for tanda terima. */
export function ReceiptSettings({ workspaceId, settings }: { workspaceId: string; settings: Settings }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [f, setF] = useState({
    companyName: settings.companyName ?? "",
    companyCity: settings.companyCity ?? "",
    receiptWa: settings.receiptWa ?? "",
    receiptFormat: settings.receiptFormat ?? "",
    letterhead: settings.letterhead ?? "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  function pickImage(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_BYTES) return setMsg({ ok: false, text: "Image too big. Use one under about 290 KB (a wide JPEG works well)." });
    const reader = new FileReader();
    reader.onload = () => setF((x) => ({ ...x, letterhead: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await updateReceiptSettings(workspaceId, f);
      setMsg(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error });
      if (res.ok) router.refresh();
    });
  }

  const lab = "mb-1 block font-mono text-[10px] uppercase tracking-widest text-[#AEB8C5]";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section id="receipts" className="lg lg-dark scroll-mt-28 rounded-[22px] p-5">
      <h2 className="font-mono text-sm font-semibold tracking-wider">Tanda terima</h2>
      <p className="mt-1 text-sm text-[#BAC3CF]">Letterhead and defaults for goods receipts made from a project.</p>
      <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label>
          <span className={lab}>Company name</span>
          <input className="input" value={f.companyName} onChange={set("companyName")} maxLength={200} placeholder="PT. Cipta Kreasi Inovatif" />
        </label>
        <label>
          <span className={lab}>City (printed before the date)</span>
          <input className="input" value={f.companyCity} onChange={set("companyCity")} maxLength={80} placeholder="Bekasi" />
        </label>
        <label>
          <span className={lab}>WhatsApp for signed photos</span>
          <input className="input" value={f.receiptWa} onChange={set("receiptWa")} maxLength={40} inputMode="tel" placeholder="0878-8578-3325" />
          <span className="mt-1 block text-xs text-[#AEB8C5]">Printed with a QR code that opens a chat to this number.</span>
        </label>
        <label>
          <span className={lab}>Number format</span>
          <input className="input font-mono" value={f.receiptFormat} onChange={set("receiptFormat")} maxLength={80} placeholder={DEFAULT_RECEIPT_FORMAT} />
          <span className="mt-1 block text-xs text-[#AEB8C5]">
            e.g. {formatReceiptNumber(f.receiptFormat || DEFAULT_RECEIPT_FORMAT, today, 1)} · {RECEIPT_TOKENS}
          </span>
        </label>
        <div className="sm:col-span-2">
          <span className={lab}>Letterhead image</span>
          {f.letterhead && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.letterhead} alt="Letterhead preview" className="mb-2 w-full rounded-lg bg-white" />
          )}
          <div className="flex flex-wrap gap-2">
            <label className="btn-ghost cursor-pointer">
              {f.letterhead ? "Replace image" : "Upload image"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => pickImage(e.target.files?.[0])} />
            </label>
            {f.letterhead && (
              <button type="button" className="btn-ghost" onClick={() => setF((x) => ({ ...x, letterhead: "" }))}>
                Remove
              </button>
            )}
          </div>
          <span className="mt-1 block text-xs text-[#AEB8C5]">A wide banner, printed across the top of the page (max about 290 KB).</span>
        </div>
        <div className="flex items-center justify-end gap-3 sm:col-span-2">
          {msg && <span className={`text-sm ${msg.ok ? "text-[#A6EFCB]" : "text-[#FFB3A6]"}`}>{msg.text}</span>}
          <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </section>
  );
}
