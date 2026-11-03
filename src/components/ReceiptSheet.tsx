import type { receipts } from "@/lib/schema";
import type { ReceiptSettings } from "@/lib/receipts";
import { tanggal } from "@/lib/receiptTypes";

/** The A4 tanda terima itself (white paper, Indonesian, like the Word template). `qr` is a trusted SVG string. */
export function ReceiptSheet({ r, s, qr }: { r: typeof receipts.$inferSelect; s: ReceiptSettings; qr: string | null }) {
  return (
    <article
      className="sheet mx-auto flex min-h-[297mm] w-[210mm] max-w-full flex-col bg-white pb-[18mm] text-[11.5pt] leading-snug text-black shadow-2xl"
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
    >
      {s.letterhead ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.letterhead} alt={s.companyName ?? "Letterhead"} className="mt-[10mm] block w-[180mm]" />
      ) : (
        <div className="mx-[20mm] mt-[16mm] border-b-2 border-black pb-2 text-[16pt] font-bold uppercase">
          {s.companyName ?? ""}
        </div>
      )}

      <div className="px-[22mm]">
        <h1 className="mt-[9mm] text-center text-[15pt] font-bold underline">TANDA TERIMA</h1>
        <p className="mt-1 text-center text-[10pt]">No: {r.number}</p>

        <div className="mt-[9mm]">
          <p>Kepada :</p>
          <p className="font-bold">{r.company}</p>
          {r.address && <p className="whitespace-pre-line font-bold">{r.address}</p>}
          {(r.attnName || r.attnPhone) && (
            <p>
              U.p.: {r.attnName}
              {r.attnPhone && ` (${r.attnPhone})`}
            </p>
          )}
        </div>

        <table className="mt-[12mm] w-full border-collapse">
          <thead>
            <tr>
              <th className="w-[12mm] pb-1 text-left font-bold">No</th>
              <th className="pb-1 text-center font-bold">Keterangan Barang</th>
              <th className="w-[28mm] pb-1 text-center font-bold">Qty</th>
            </tr>
          </thead>
          <tbody>
            {r.items.map((it, i) => (
              <tr key={i} className="align-top">
                <td className="py-1 pl-1">{i + 1}.</td>
                <td className="py-1">
                  <div>{it.name}</div>
                  {it.serials.length > 0 && <div className="break-all">SN: {it.serials.join(", ")}</div>}
                </td>
                <td className="py-1 text-center">{it.qty} unit</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-[16mm]">
          {r.city ? `${r.city}, ` : ""}
          {tanggal(r.date)}
        </p>
        <div className="mt-[6mm] grid grid-cols-2 gap-[20mm]">
          <div>
            <p>Diserahkan,</p>
            <div className="h-[24mm]" />
            <p className="underline">{r.senderName || "……………………………………."}</p>
            {s.companyName && <p>{s.companyName}</p>}
          </div>
          <div>
            <p>Diterima,</p>
            <div className="h-[24mm]" />
            <p>…………………………………….</p>
            <p>{r.company}</p>
          </div>
        </div>
      </div>

      {s.receiptWa && qr && (
        <div className="mx-[22mm] mt-auto flex items-center gap-[6mm] border-2 border-black p-[4mm]">
          <div className="h-[28mm] w-[28mm] shrink-0" dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="text-[11pt]">
            <p className="font-bold uppercase">Wajib</p>
            <p>
              Foto tanda terima yang sudah ditandatangani, lalu kirim ke WhatsApp{" "}
              <span className="whitespace-nowrap font-bold">{s.receiptWa}</span>.
            </p>
            <p className="mt-1 text-[10pt]">Scan QR ini untuk langsung chat ke nomor tersebut.</p>
          </div>
        </div>
      )}
    </article>
  );
}
