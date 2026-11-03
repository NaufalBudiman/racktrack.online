"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ASSIGNABLE_ROLES,
  DIGESTS,
  DIGEST_LABELS,
  INVITE_TTL_DAYS,
  ROLE_HINTS,
  ROLE_LABELS,
  canGrant,
  canManageMembers,
  outranks,
  type AssignableRole,
  type Digest,
  type Role,
} from "@/lib/roles";
import {
  changeMemberRole,
  createInvite,
  createWorkspace,
  leaveWorkspace,
  removeMember,
  renameWorkspace,
  revokeInvite,
  setDigest,
} from "@/app/app/workspace/actions";
import type { ActionResult } from "@/lib/types";
import { revokeShareLink } from "@/app/app/share/actions";
import { SHARE_KIND_LABELS, type ShareLinkRow } from "@/lib/share";
import type { Place } from "@/lib/places";
import { ShareButton } from "./ShareDialog";

type Member = { userId: string; name: string | null; email: string | null; image: string | null; role: Role };
type Invite = { id: string; email: string; role: AssignableRole; token: string; expiresAt: string };

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="lg lg-dark scroll-mt-28 rounded-[22px] p-5">
      <h2 className="font-mono text-sm font-semibold tracking-wider">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-[#C3CBD6]">
      {ROLE_LABELS[role]}
    </span>
  );
}

export function WorkspaceSettings({
  workspaceId,
  name,
  role,
  me,
  members,
  invites,
  myDigest,
  sharing,
  extra,
}: {
  workspaceId: string;
  name: string;
  role: Role;
  me: string;
  members: Member[];
  invites: Invite[] | null; // null = not allowed to see invites
  myDigest: Digest;
  sharing: { links: ShareLinkRow[]; customers: string[]; places: Place[] } | null; // null = not allowed
  extra?: React.ReactNode; // admin sections rendered before "New workspace"
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const manage = canManageMembers(role);

  const [wsName, setWsName] = useState(name);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AssignableRole>("editor");
  const [newLink, setNewLink] = useState<{ email: string; url: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);
  const linkFor = (token: string) => `${origin}/invite/${token}`;

  function run<T extends object>(fn: () => Promise<ActionResult<T>>, after?: (res: { ok: true } & T) => void) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      after?.(res);
      router.refresh();
    });
  }

  async function copy(text: string, what = "Invite link") {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${what} copied.`);
    } catch {
      setNotice("Copy failed. Select the link and copy it manually.");
    }
  }

  const grantable = ASSIGNABLE_ROLES.filter((r) => canGrant(role, r));
  const now = new Date().toISOString();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <div className="eyebrow">Team · {ROLE_LABELS[role]}</div>
        <h1 className="mt-1.5 break-words font-mono text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{name}</h1>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red/15 px-3 py-2 text-sm text-[#FFB3A6] shadow-[inset_0_0_0_1px_rgba(240,102,76,.55)]">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-green/15 px-3 py-2 text-sm text-[#A6EFCB] shadow-[inset_0_0_0_1px_rgba(79,209,153,.5)]">
          {notice}
        </p>
      )}

      <Section title="Details">
        {manage ? (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => renameWorkspace(workspaceId, wsName), () => setNotice("Workspace renamed."));
            }}
          >
            <label className="sr-only" htmlFor="ws-name">Workspace name</label>
            <input id="ws-name" className="input" value={wsName} onChange={(e) => setWsName(e.target.value)} maxLength={60} required />
            <button type="submit" className="btn-ghost shrink-0" disabled={pending || wsName.trim() === name}>
              Rename
            </button>
          </form>
        ) : (
          <p className="text-sm text-[#BAC3CF]">Only owners and admins can rename this workspace.</p>
        )}
        {role !== "owner" && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
            {confirmLeave ? (
              <>
                <span className="text-sm text-[#FFB3A6]">Leave this workspace? You'll need a new invite to come back.</span>
                <button type="button" className="btn-ghost" disabled={pending} onClick={() => setConfirmLeave(false)}>
                  Stay
                </button>
                <button type="button" className="btn-danger" disabled={pending} onClick={() => run(() => leaveWorkspace(workspaceId))}>
                  Yes, leave
                </button>
              </>
            ) : (
              <button type="button" className="btn-danger" onClick={() => setConfirmLeave(true)}>
                Leave workspace
              </button>
            )}
          </div>
        )}
      </Section>

      <Section title="Your email summary">
        <p className="mb-3 text-sm text-[#BAC3CF]">
          A short email at 07:00 WIB with overdue loans, loans due in the next 3 days, low stock and recent changes. Sent
          only when there&apos;s something to report.
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Email summary frequency">
          {DIGESTS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={myDigest === d}
              disabled={pending}
              onClick={() => run(() => setDigest(workspaceId, d), () => setNotice(`Email summary: ${DIGEST_LABELS[d]}.`))}
              className={`chip ${myDigest === d ? "chip-on" : ""}`}
            >
              {DIGEST_LABELS[d]}
            </button>
          ))}
        </div>
      </Section>

      <Section title={`Members (${members.length})`}>
        <ul className="divide-y divide-white/10">
          {members.map((m) => {
            const editable = manage && m.userId !== me && outranks(role, m.role);
            return (
              <li key={m.userId} className="flex flex-wrap items-center gap-3 py-3">
                {m.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.image} alt="" width={32} height={32} referrerPolicy="no-referrer" className="h-8 w-8 rounded-full ring-1 ring-white/25" />
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 font-mono text-xs" aria-hidden>
                    {(m.name ?? m.email ?? "?").slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-ink">
                    {m.name ?? m.email}
                    {m.userId === me && <span className="text-[#97A3B3]"> (you)</span>}
                  </div>
                  {m.name && <div className="truncate font-mono text-xs text-[#97A3B3]">{m.email}</div>}
                </div>
                {editable ? (
                  <div className="flex items-center gap-2">
                    <select
                      aria-label={`Role for ${m.name ?? m.email}`}
                      className="input w-auto py-1.5 text-xs"
                      value={m.role}
                      disabled={pending}
                      onChange={(e) => run(() => changeMemberRole(workspaceId, m.userId, e.target.value))}
                    >
                      {grantable.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                    {confirmRemove === m.userId ? (
                      <button
                        type="button"
                        className="btn-danger py-1.5 text-xs"
                        disabled={pending}
                        onClick={() => run(() => removeMember(workspaceId, m.userId), () => setConfirmRemove(null))}
                      >
                        Confirm
                      </button>
                    ) : (
                      <button type="button" className="btn-ghost py-1.5 text-xs" onClick={() => setConfirmRemove(m.userId)}>
                        Remove
                      </button>
                    )}
                  </div>
                ) : (
                  <RoleBadge role={m.role} />
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      {manage && invites && (
        <Section title="Invite people">
          <form
            className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              const email = inviteEmail.trim().toLowerCase();
              run(
                () => createInvite(workspaceId, email, inviteRole),
                (res) => {
                  setNewLink({ email, url: linkFor(res.token) });
                  setInviteEmail("");
                },
              );
            }}
          >
            <label className="sr-only" htmlFor="invite-email">Email</label>
            <input
              id="invite-email"
              type="email"
              className="input"
              placeholder="teammate@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
            <label className="sr-only" htmlFor="invite-role">Role</label>
            <select id="invite-role" className="input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as AssignableRole)}>
              {grantable.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? "Creating…" : "Create link"}
            </button>
          </form>
          <p className="mt-2 text-xs text-[#AEB8C5]">{ROLE_LABELS[inviteRole]}: {ROLE_HINTS[inviteRole]}.</p>

          {newLink && (
            <div className="mt-4 rounded-xl bg-amber/10 p-3 shadow-[inset_0_0_0_1px_rgba(239,155,62,.45)]">
              <p className="text-sm text-[#FFE1B8]">
                Send this link to <span className="font-mono">{newLink.email}</span>. They must sign in with that Google account.
                It expires in {INVITE_TTL_DAYS} days.
              </p>
              <div className="mt-2 flex gap-2">
                <input readOnly className="input font-mono text-xs" value={newLink.url} onFocus={(e) => e.target.select()} aria-label="Invite link" />
                <button type="button" className="btn-ghost shrink-0" onClick={() => copy(newLink.url)}>
                  Copy
                </button>
              </div>
            </div>
          )}

          {invites.length > 0 && (
            <>
              <h3 className="mt-6 font-mono text-xs font-semibold tracking-wider text-[#BAC3CF]">Pending invites</h3>
              <ul className="mt-2 divide-y divide-white/10">
                {invites.map((i) => {
                  const expired = i.expiresAt < now;
                  return (
                    <li key={i.id} className="flex flex-wrap items-center gap-2 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-sm text-ink">{i.email}</div>
                        <div className={`font-mono text-[11px] ${expired ? "text-[#FFB3A6]" : "text-[#97A3B3]"}`}>
                          {ROLE_LABELS[i.role]} · {expired ? "expired" : `expires ${i.expiresAt.slice(0, 10)}`}
                        </div>
                      </div>
                      {!expired && (
                        <button type="button" className="btn-ghost py-1.5 text-xs" onClick={() => copy(linkFor(i.token))}>
                          Copy link
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-ghost py-1.5 text-xs"
                        disabled={pending}
                        onClick={() => run(() => revokeInvite(workspaceId, i.id))}
                      >
                        {expired ? "Remove" : "Revoke"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Section>
      )}

      {sharing && (
        <Section title="Share links" id="share">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-md text-sm text-[#BAC3CF]">
              Read-only links anyone can open without signing in, for a manager or the field team. Notes and contacts are never shown.
            </p>
            <ShareButton
              className="btn-primary"
              workspaceId={workspaceId}
              customers={sharing.customers}
              places={sharing.places}
            />
          </div>
          {sharing.links.length > 0 && (
            <ul className="mt-4 divide-y divide-white/10">
              {sharing.links.map((l) => {
                const expired = !!l.expiresAt && l.expiresAt < now;
                const url = `${origin}/s/${l.token}`;
                return (
                  <li key={l.id} className="flex flex-wrap items-center gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="break-words text-sm text-ink">
                        <span className="font-mono text-[10.5px] uppercase tracking-wider text-[#97A3B3]">{SHARE_KIND_LABELS[l.kind]}</span>
                        {l.kind !== "all" && <span className="ml-2">{l.title}</span>}
                      </div>
                      <div className={`font-mono text-[11px] ${expired ? "text-[#FFB3A6]" : "text-[#97A3B3]"}`}>
                        {expired ? "expired" : l.expiresAt ? `expires ${l.expiresAt.slice(0, 10)}` : "never expires"}
                        {" · "}
                        {l.views} {l.views === 1 ? "view" : "views"}
                        {l.lastViewedAt && ` · last ${l.lastViewedAt.slice(0, 10)}`}
                        {!l.showSerial && " · no serials"}
                        {!l.showCustomer && l.kind !== "customer" && " · no customers"}
                        {l.by && ` · by ${l.by}`}
                      </div>
                    </div>
                    {!expired && (
                      <>
                        <a href={url} target="_blank" rel="noreferrer" className="btn-ghost py-1.5 text-xs">
                          Open
                        </a>
                        <button type="button" className="btn-ghost py-1.5 text-xs" onClick={() => copy(url, "Share link")}>
                          Copy link
                        </button>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(`RackTrack: ${l.kind === "all" ? "Inventory" : l.title} (read-only, live)\n${url}`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-ghost py-1.5 text-xs text-[#A6EFCB]"
                        >
                          WhatsApp
                        </a>
                      </>
                    )}
                    <button
                      type="button"
                      className="btn-ghost py-1.5 text-xs"
                      disabled={pending}
                      onClick={() => run(() => revokeShareLink(workspaceId, l.id))}
                    >
                      {expired ? "Remove" : "Revoke"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      )}

      {extra}

      <Section title="New workspace" id="new">
        <p className="mb-3 text-sm text-[#BAC3CF]">
          Separate inventory with its own members, for example one per office or client.
        </p>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => createWorkspace(newName), () => {
              setNewName("");
              router.push("/app/devices");
            });
          }}
        >
          <label className="sr-only" htmlFor="new-ws">New workspace name</label>
          <input
            id="new-ws"
            className="input"
            placeholder="e.g. CKI Office"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={60}
            required
          />
          <button type="submit" className="btn-primary shrink-0" disabled={pending}>
            Create
          </button>
        </form>
      </Section>
    </div>
  );
}
