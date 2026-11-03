"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteReceipt, setReceiptSigned } from "@/app/app/receipts/actions";

/** Screen-only controls above the printable receipt. */
export function ReceiptToolbar({
  workspaceId,
  receiptId,
  projectId,
  signedAt,
  canEdit,
}: {
  workspaceId: string;
  receiptId: string;
  projectId: string | null;
  signedAt: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const back = projectId ? `/app/projects/${projectId}` : "/app/projects";

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return setError(res.error);
      after?.();
      router.refresh();
    });
  }

  return (
    <div className="no-print mx-auto mb-4 flex w-[210mm] max-w-full flex-wrap items-center gap-2 px-3 sm:px-0">
      <Link href={back} className="font-mono text-xs text-[#FFC27A] hover:underline">
        ← Project
      </Link>
      <span className="flex-1" />
      {signedAt ? (
        <span className="rounded-md bg-green/15 px-2 py-1 font-mono text-[11px] text-[#A6EFCB]">Signed photo received</span>
      ) : (
        <span className="rounded-md bg-amber/15 px-2 py-1 font-mono text-[11px] text-[#FFE1B8]">Waiting for signed photo</span>
      )}
      {canEdit && (
        <button type="button" className="btn-ghost" disabled={pending} onClick={() => run(() => setReceiptSigned(workspaceId, receiptId, !signedAt))}>
          {signedAt ? "Mark not received" : "Mark signed"}
        </button>
      )}
      {canEdit &&
        (confirmDelete ? (
          <button
            type="button"
            className="btn-danger"
            disabled={pending}
            onClick={() => run(() => deleteReceipt(workspaceId, receiptId), () => router.push(back))}
          >
            Yes, delete
          </button>
        ) : (
          <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(true)}>
            Delete
          </button>
        ))}
      <button type="button" className="btn-primary" onClick={() => window.print()}>
        Print / Save PDF
      </button>
      {error && <p className="w-full text-sm text-[#FFB3A6]">{error}</p>}
    </div>
  );
}
