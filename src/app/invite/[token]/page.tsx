import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth, signIn, signOut } from "@/auth";
import { getDb } from "@/lib/db";
import { users, workspaceInvites, workspaces } from "@/lib/schema";
import { ROLE_HINTS, ROLE_LABELS } from "@/lib/roles";
import { acceptInvite } from "@/app/app/workspace/actions";
import { Backdrop } from "@/components/Backdrop";
import { Logo } from "@/components/StatusLed";

export const dynamic = "force-dynamic";
export const metadata = { title: "Workspace invite · RackTrack", robots: { index: false } };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const here = `/invite/${encodeURIComponent(token)}`;
  const session = await auth();
  const email = session?.user?.email?.toLowerCase() ?? null;

  const [invite] = await getDb()
    .select({
      email: workspaceInvites.email,
      role: workspaceInvites.role,
      expiresAt: workspaceInvites.expiresAt,
      workspace: workspaces.name,
      inviter: users.name,
    })
    .from(workspaceInvites)
    .innerJoin(workspaces, eq(workspaces.id, workspaceInvites.workspaceId))
    .leftJoin(users, eq(users.id, workspaceInvites.invitedBy))
    .where(eq(workspaceInvites.token, token));

  async function doSignIn() {
    "use server";
    await signIn("google", { redirectTo: here });
  }
  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: here });
  }
  const accept = acceptInvite.bind(null, token);

  let body: React.ReactNode;
  if (!invite) {
    body = (
      <>
        <h1 className="font-mono text-xl font-semibold">Invite not found</h1>
        <p className="mt-2 text-sm text-[#BAC3CF]">
          This link was revoked, already used, or replaced by a newer invite. Ask the person who invited you for a new link.
        </p>
      </>
    );
  } else if (invite.expiresAt < new Date()) {
    body = (
      <>
        <h1 className="font-mono text-xl font-semibold">Invite expired</h1>
        <p className="mt-2 text-sm text-[#BAC3CF]">Ask the person who invited you to send a new link.</p>
      </>
    );
  } else {
    body = (
      <>
        <div className="eyebrow">You're invited</div>
        <h1 className="mt-1.5 break-words font-mono text-xl font-semibold">{invite.workspace}</h1>
        <p className="mt-2 text-sm text-[#BAC3CF]">
          {invite.inviter ?? "Someone"} invited <span className="font-mono text-ink">{invite.email}</span> to join as{" "}
          <span className="text-ink">{ROLE_LABELS[invite.role]}</span> ({ROLE_HINTS[invite.role].toLowerCase()}).
        </p>
        <div className="mt-6">
          {!email ? (
            <form action={doSignIn}>
              <button type="submit" className="btn-primary w-full">
                Sign in with Google to accept
              </button>
            </form>
          ) : email !== invite.email ? (
            <>
              <p className="rounded-xl bg-red/15 px-3 py-2 text-sm text-[#FFB3A6] shadow-[inset_0_0_0_1px_rgba(240,102,76,.55)]">
                You're signed in as <span className="font-mono">{email}</span>. This invite is for{" "}
                <span className="font-mono">{invite.email}</span>.
              </p>
              <form action={doSignOut} className="mt-3">
                <button type="submit" className="btn-ghost w-full">
                  Sign out and switch account
                </button>
              </form>
            </>
          ) : (
            <form action={accept}>
              <button type="submit" className="btn-primary w-full">
                Join workspace
              </button>
            </form>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Backdrop dim />
      <Link href="/" className="mb-6" aria-label="RackTrack home">
        <Logo />
      </Link>
      <main className="lg lg-solid w-full max-w-md rounded-[28px] p-6">{body}</main>
    </div>
  );
}
