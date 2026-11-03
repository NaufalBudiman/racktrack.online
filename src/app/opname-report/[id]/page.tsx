import { notFound, redirect } from "next/navigation";
import { getAppContext } from "@/lib/access";
import { getDb } from "@/lib/db";
import { getCount } from "@/lib/counts";
import { compareCount, COUNT_STATUS_LABELS } from "@/lib/countTypes";
import { listDevices, listPlaces } from "@/lib/devices";
import { statusLabel } from "@/lib/categories";
import { tanggal } from "@/lib/receiptTypes";
import { stockCounts } from "@/lib/schema";
import { idSchema } from "@/lib/validation";
import { eq } from "drizzle-orm";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stock opname · RackTrack", robots: { index: false } };

const wib = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso)) : "—";

// Printable stock opname report. Outside /app so it prints without the app shell; access is checked here.
export default async function OpnameReport({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAppContext();
  if (!ctx) redirect("/");
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const [row] = await getDb().select({ ws: stockCounts.workspaceId }).from(stockCounts).where(eq(stockCounts.id, id.data));
  const member = row && ctx.workspaces.find((w) => w.workspaceId === row.ws);
  if (!member) notFound();

  const [count, devices, places] = await Promise.all([getCount(row.ws, id.data), listDevices(row.ws), listPlaces(row.ws)]);
  if (!count) notFound();
  const r = compareCount(count, devices, places);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(count.finishedAt ?? count.startedAt));

  const sections: { title: string; rows: [string, string, string][] }[] = [
    {
      title: `Tidak ditemukan (${r.missing.length})`,
      rows: r.missing.map((m) => [
        m.exp.name,
        m.exp.serial ?? "—",
        m.fixed ? `Sekarang: ${m.device ? statusLabel(m.device.status) + (m.device.customer ? ` (${m.device.customer})` : "") : "dihapus"}` : "Belum jelas",
      ]),
    },
    {
      title: `Salah tempat (${r.misplaced.length})`,
      rows: r.misplaced.map((m) => [m.device.name, m.device.serial ?? "—", m.fixed ? "Sudah dipindah ke sini" : m.why]),
    },
    {
      title: `Belum tercatat (${r.unknown.length})`,
      rows: r.unknown.map((u) => [u.device?.name ?? u.scan.model ?? "Model belum diketahui", u.scan.serial, u.fixed ? "Sudah ditambahkan" : "Belum ditambahkan"]),
    },
    {
      title: `Cocok (${r.found.length})`,
      rows: r.found.map((f) => [f.device.name, f.device.serial ?? "—", statusLabel(f.device.status)]),
    },
  ];

  return (
    <div className="min-h-screen bg-[#2A2F37] py-6 print:bg-white print:py-0">
      <style>{`
        @page { size: A4; margin: 14mm; }
        @media print { html, body { background: #fff !important; } .no-print { display: none !important; } .sheet { box-shadow: none !important; margin: 0 !important; padding: 0 !important; } }
      `}</style>
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] justify-end gap-2 px-4">
        <PrintButton />
      </div>
      <div className="sheet mx-auto max-w-[210mm] bg-white p-[14mm] font-sans text-[12px] text-[#111] shadow-xl">
        <h1 className="text-center text-lg font-bold tracking-wide">LAPORAN STOCK OPNAME</h1>
        <p className="mt-1 text-center text-[13px]">{member.name}</p>
        <table className="mt-5 text-[12px]">
          <tbody>
            {[
              ["Area", count.scope],
              ["Tanggal", tanggal(day)],
              ["Mulai", `${wib(count.startedAt)} WIB${count.startedBy ? ` oleh ${count.startedBy}` : ""}`],
              ["Selesai scan", count.finishedAt ? `${wib(count.finishedAt)} WIB` : "—"],
              ["Status", COUNT_STATUS_LABELS[count.status]],
              ...(count.note ? [["Catatan", count.note]] : []),
            ].map(([k, v]) => (
              <tr key={k}>
                <td className="w-32 py-0.5 align-top">{k}</td>
                <td className="py-0.5">: {v}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 grid grid-cols-4 border border-black text-center">
          {[
            ["Seharusnya ada", count.expected.length],
            ["Cocok", r.found.length],
            ["Tidak ditemukan", r.missing.length],
            ["Belum tercatat", r.unknown.length],
          ].map(([k, v], i) => (
            <div key={k} className={`py-2 ${i ? "border-l border-black" : ""}`}>
              <div className="text-xl font-bold">{v}</div>
              <div className="text-[11px]">{k}</div>
            </div>
          ))}
        </div>

        {sections.map((s) =>
          s.rows.length ? (
            <section key={s.title} className="mt-5 break-inside-auto">
              <h2 className="mb-1 text-[13px] font-bold">{s.title}</h2>
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr>
                    {["No", "Nama barang", "Serial number", "Keterangan"].map((h) => (
                      <th key={h} className="border border-black bg-[#eee] px-1.5 py-1 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.rows.map(([a, b, c], i) => (
                    <tr key={`${b}-${i}`} className="break-inside-avoid">
                      <td className="w-8 border border-black px-1.5 py-0.5 text-center">{i + 1}</td>
                      <td className="border border-black px-1.5 py-0.5">{a}</td>
                      <td className="border border-black px-1.5 py-0.5 font-mono">{b}</td>
                      <td className="border border-black px-1.5 py-0.5">{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null,
        )}

        <div className="mt-10 grid grid-cols-2 gap-10 text-center text-[12px] break-inside-avoid">
          {["Dihitung oleh", "Diperiksa oleh"].map((k) => (
            <div key={k}>
              <div>{k},</div>
              <div className="mt-16 border-t border-black pt-1">( ............................ )</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
