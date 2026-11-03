// Server-only: tanda terima reads and numbering.
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { receipts, workspaces } from "./schema";
import { DEFAULT_RECEIPT_FORMAT, formatReceiptNumber, type ReceiptRow } from "./receiptTypes";

export type ReceiptSettings = {
  companyName: string | null;
  companyCity: string | null;
  receiptWa: string | null;
  receiptFormat: string | null;
  letterhead: string | null;
};

export async function getReceiptSettings(workspaceId: string): Promise<ReceiptSettings> {
  const [row] = await getDb()
    .select({
      companyName: workspaces.companyName,
      companyCity: workspaces.companyCity,
      receiptWa: workspaces.receiptWa,
      receiptFormat: workspaces.receiptFormat,
      letterhead: workspaces.letterhead,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));
  return row ?? { companyName: null, companyCity: null, receiptWa: null, receiptFormat: null, letterhead: null };
}

/** Next running number in the receipt's year (starts at 1 each year). */
export async function nextReceiptSeq(workspaceId: string, date: string): Promise<number> {
  const [row] = await getDb()
    .select({ max: sql<number | null>`max(${receipts.seq})` })
    .from(receipts)
    .where(and(eq(receipts.workspaceId, workspaceId), sql`extract(year from ${receipts.date}) = ${Number(date.slice(0, 4))}`));
  return (row?.max ?? 0) + 1;
}

export async function suggestReceiptNumber(workspaceId: string, format: string | null, date: string): Promise<string> {
  return formatReceiptNumber(format || DEFAULT_RECEIPT_FORMAT, date, await nextReceiptSeq(workspaceId, date));
}

export async function listReceipts(workspaceId: string, projectId: string): Promise<ReceiptRow[]> {
  const rows = await getDb()
    .select({ id: receipts.id, number: receipts.number, date: receipts.date, items: receipts.items, signedAt: receipts.signedAt })
    .from(receipts)
    .where(and(eq(receipts.workspaceId, workspaceId), eq(receipts.projectId, projectId)))
    .orderBy(desc(receipts.date), desc(receipts.seq));
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    date: r.date,
    units: r.items.reduce((n, i) => n + i.qty, 0),
    signedAt: r.signedAt?.toISOString() ?? null,
  }));
}

export async function getReceipt(workspaceId: string, id: string) {
  const [row] = await getDb()
    .select()
    .from(receipts)
    .where(and(eq(receipts.workspaceId, workspaceId), eq(receipts.id, id)));
  return row ?? null;
}
