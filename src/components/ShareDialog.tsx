"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createShareLink } from "@/app/app/share/actions";
import { SHARE_EXPIRY, SHARE_KIND_LABELS, type ShareExpiry, type ShareKind } from "@/lib/share";
import type { Place } from "@/lib/places";

type Scope = { kind: ShareKind; target: string | null };

/**
 * Creates a read-only public link. Pass `fixed` to share one thing (a device page);
 * otherwise the person picks whole inventory / a customer / a location.
 */
export function ShareDialog({
  workspaceId,
  initial = { kind: "all", target: null },
  fixed,
  customers = [],
  places = [],
  onClose,
}: {
  workspaceId: string;
  initial?: Scope;
  fixed?: { kind: ShareKind; target: string; title: string };
  customers?: string[];
  places?: Place[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [scope, setScope] = useState<Scope>(fixed ?? initial);
  const [showSerial, setShowSerial] = useState(true);
  const [showCustomer, setShowCustomer] = useState(true);
  const [expiry, setExpiry] = useState<ShareExpiry>("30");
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const kinds = (["all", "customer", "location"] as const).filter(
    (k) => k === "all" || (k === "customer" ? customers.length > 0 : places.length > 0),
  );

  function pickKind(kind: ShareKind) {
    const target = kind === "customer" ? customers[0] ?? null : kind === "location" ? places[0]?.id ?? null : null;
    setScope({ kind, target });
  }

  function create() {
    setError(null);
    startTransition(async () => {
      const res = await createShareLink(workspaceId, { ...scope, showSerial, showCustomer, expiry });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setUrl(`${window.location.origin}/s/${res.token}`);
      router.refresh();
    });
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("Copy failed. Select the link and copy it manually.");
    }
  }

  const label = "mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-[#AEB8C5]";

  // Portal to <body>: glass cards (backdrop-filter) would otherwise trap position:fixed inside them.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => !pending && onClose()} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Share read-only link"
        className="lg lg-solid relative flex max-h-[92vh] w-full max-w-md flex-col rounded-b-none rounded-t-[28px] sm:rounded-[28px]"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="font-mono text-lg font-semibold">Share link</h2>
          <button type="button" className="btn-ghost h-10 w-10 px-0" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {url ? (
            <>
              <p className="text-sm text-[#BAC3CF]">
                Anyone with this link can view it, no sign-in needed. It updates live. Revoke it any time on the Team page.
              </p>
              <div className="flex gap-2">
                <input readOnly className="input font-mono text-xs" value={url} onFocus={(e) => e.target.select()} aria-label="Share link" />
                <button type="button" className="btn-primary shrink-0" onClick={copy}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <a href={url} target="_blank" rel="noreferrer" className="inline-block font-mono text-xs text-[#FFC27A] hover:underline">
                Open in new tab ↗
              </a>
            </>
          ) : (
            <>
              {fixed ? (
                <div>
                  <span className={label}>Sharing</span>
                  <p className="normal-case text-ink">{fixed.title}</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className={label} htmlFor="share-kind">What to share</label>
                    <select id="share-kind" className="input" value={scope.kind} onChange={(e) => pickKind(e.target.value as ShareKind)}>
                      {kinds.map((k) => (
                        <option key={k} value={k}>{SHARE_KIND_LABELS[k]}</option>
                      ))}
                    </select>
                  </div>
                  {scope.kind === "customer" && (
                    <div>
                      <label className={label} htmlFor="share-customer">Customer</label>
                      <select id="share-customer" className="input" value={scope.target ?? ""} onChange={(e) => setScope({ kind: "customer", target: e.target.value })}>
                        {customers.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <p className="mt-1.5 text-xs text-[#AEB8C5]">Shows only the devices at this customer. Other customers stay hidden.</p>
                    </div>
                  )}
                  {scope.kind === "location" && (
                    <div>
                      <label className={label} htmlFor="share-place">Location</label>
                      <select id="share-place" className="input" value={scope.target ?? ""} onChange={(e) => setScope({ kind: "location", target: e.target.value })}>
                        {places.map((p) => (
                          <option key={p.id} value={p.id}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              <fieldset className="space-y-2">
                <legend className={label}>Show</legend>
                <label className="flex items-center gap-2.5 text-sm text-ink">
                  <input type="checkbox" className="h-4 w-4 accent-[#F7A23A]" checked={showSerial} onChange={(e) => setShowSerial(e.target.checked)} />
                  Serial numbers
                </label>
                {scope.kind !== "customer" && (
                  <label className="flex items-center gap-2.5 text-sm text-ink">
                    <input type="checkbox" className="h-4 w-4 accent-[#F7A23A]" checked={showCustomer} onChange={(e) => setShowCustomer(e.target.checked)} />
                    Customer names
                  </label>
                )}
                <p className="text-xs text-[#AEB8C5]">Notes, contacts and purchase details are never shown.</p>
              </fieldset>

              <fieldset>
                <legend className={label}>Expires</legend>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(SHARE_EXPIRY) as ShareExpiry[]).map((k) => (
                    <button key={k} type="button" className={`chip ${expiry === k ? "chip-on" : ""}`} aria-pressed={expiry === k} onClick={() => setExpiry(k)}>
                      {SHARE_EXPIRY[k]}
                    </button>
                  ))}
                </div>
              </fieldset>

              <p className="rounded-xl bg-amber/10 px-3 py-2 text-xs text-[#FFE1B8] shadow-[inset_0_0_0_1px_rgba(239,155,62,.45)]">
                Anyone who has the link can view it without signing in. Only send it to people you trust.
              </p>
              {error && (
                <p role="alert" className="rounded-xl bg-red/15 px-3 py-2 text-sm text-[#FFB3A6] shadow-[inset_0_0_0_1px_rgba(240,102,76,.55)]">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        {!url && (
          <div className="flex justify-end gap-2 border-t border-white/10 px-6 py-4">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={pending}>Cancel</button>
            <button type="button" className="btn-primary" onClick={create} disabled={pending || (scope.kind !== "all" && !scope.target)}>
              {pending ? "Creating…" : "Create link"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** A "Share" button that opens the dialog. Render only for admins/owners. */
export function ShareButton(props: Omit<React.ComponentProps<typeof ShareDialog>, "onClose"> & { className?: string }) {
  const [open, setOpen] = useState(false);
  const { className = "btn-ghost", ...rest } = props;
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        Share
      </button>
      {open && <ShareDialog {...rest} onClose={() => setOpen(false)} />}
    </>
  );
}
