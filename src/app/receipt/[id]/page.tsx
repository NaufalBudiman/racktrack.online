import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { getAppContext } from "@/lib/access";
import { getDb } from "@/lib/db";
import { receipts } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getReceiptSettings } from "@/lib/receipts";
import { waNumber } from "@/lib/receiptTypes";
import { canEditDevices } from "@/lib/roles";
import { idSchema } from "@/lib/validation";
import { ReceiptToolbar } from "@/components/ReceiptToolbar";
import { ReceiptSheet } from "@/components/ReceiptSheet";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tanda terima · RackTrack", robots: { index: false } };

// Printable A4 tanda terima. Outside /app so it prints without the app shell; access is checked here.
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAppContext();
  if (!ctx) redirect("/");
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();

  const [r] = await getDb().select().from(receipts).where(eq(receipts.id, id.data));
  const member = r && ctx.workspaces.find((w) => w.workspaceId === r.workspaceId);
  if (!r || !member) notFound();
  const s = await getReceiptSettings(r.workspaceId);

  const wa = s.receiptWa ? waNumber(s.receiptWa) : null;
  const qr = wa
    ? await QRCode.toString(
        `https://wa.me/${wa}?text=${encodeURIComponent(`Halo, berikut foto tanda terima ${r.number} (${r.company}) yang sudah ditandatangani.`)}`,
        { type: "svg", margin: 0, errorCorrectionLevel: "M" },
      )
    : null;

  return (
    <div className="receipt-screen min-h-screen bg-[#2A2F37] py-6 print:bg-white print:py-0">
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .sheet { box-shadow: none !important; margin: 0 !important; }
        }
      `}</style>
      <ReceiptToolbar
        workspaceId={r.workspaceId}
        receiptId={r.id}
        projectId={r.projectId}
        signedAt={r.signedAt?.toISOString() ?? null}
        canEdit={canEditDevices(member.role)}
      />

      <ReceiptSheet r={r} s={s} qr={qr} />
    </div>
  );
}
