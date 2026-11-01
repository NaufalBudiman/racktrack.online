import Link from "next/link";
import { Backdrop } from "./Backdrop";
import { Logo } from "./StatusLed";

export const LEGAL = {
  operator: "Cipta Kreasi Inovatif",
  contact: "naufal@ckinovatif.co.id",
  updated: "2 November 2026",
};

/** Shared shell for /privacy and /terms. Children use plain h2/p/ul; styling comes from here. */
export function LegalPage({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen px-4 py-10">
      <Backdrop dim />
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href="/" aria-label="RackTrack home">
            <Logo />
          </Link>
          <nav className="flex gap-4 font-mono text-xs text-[#AEB8C5]">
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
          </nav>
        </div>
        <article
          className="lg lg-solid rounded-[28px] p-6 sm:p-10 [&_a]:text-[#FFC27A] [&_a]:underline [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:font-mono [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:tracking-wider [&_li]:mt-1.5 [&_p]:mt-3 [&_p]:leading-relaxed [&_p]:text-[#C3CBD6] [&_strong]:text-ink [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ul]:leading-relaxed [&_ul]:text-[#C3CBD6]"
        >
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="mt-2 font-mono text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{title}</h1>
          <p className="font-mono text-xs !text-[#97A3B3]">Last updated {LEGAL.updated}</p>
          {children}
        </article>
        <p className="mt-6 text-center font-mono text-xs text-[#97A3B3]">
          © {new Date().getFullYear()} RackTrack · {LEGAL.operator}
        </p>
      </div>
    </div>
  );
}
