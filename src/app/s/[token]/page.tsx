import Link from "next/link";
import type { Metadata } from "next";
import { loadShared } from "@/lib/shared";
import { Backdrop } from "@/components/Backdrop";
import { Logo } from "@/components/StatusLed";
import { SharedView } from "@/components/SharedView";

export const dynamic = "force-dynamic";
// Token links: keep them out of search engines and out of Referer headers.
export const metadata: Metadata = {
  title: "Shared inventory · RackTrack",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = /^[A-Za-z0-9_-]{20,64}$/.test(token) ? await loadShared(token) : { state: "missing" as const };

  return (
    <div className="min-h-screen px-4 pb-16 pt-6 sm:px-6">
      <Backdrop dim />
      <header className="mx-auto mb-6 flex max-w-5xl items-center justify-between gap-3">
        <Link href="/" aria-label="RackTrack home">
          <Logo />
        </Link>
        <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider text-[#C3CBD6]">
          Read only
        </span>
      </header>
      <main className="mx-auto max-w-5xl">
        {view.state === "ok" ? (
          <SharedView view={view} />
        ) : (
          <div className="lg lg-solid mx-auto max-w-md rounded-[28px] p-6">
            <h1 className="font-mono text-xl font-semibold">{view.state === "expired" ? "Link expired" : "Link not found"}</h1>
            <p className="mt-2 text-sm text-[#BAC3CF]">
              {view.state === "expired"
                ? "This share link has expired. Ask the person who sent it for a new one."
                : "This link was revoked or never existed. Ask the person who sent it for a new one."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
