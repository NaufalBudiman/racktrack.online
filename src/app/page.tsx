import Link from "next/link";
import { auth, signIn } from "@/auth";
import { Logo, StatusLed } from "@/components/StatusLed";
import { LiquidGlass } from "@/components/ui/liquid-glass";
import { Backdrop } from "@/components/Backdrop";
import { MAX_DEVICES_PER_WORKSPACE, type Status } from "@/lib/categories";

async function signInWithGoogle() {
  "use server";
  await signIn("google", { redirectTo: "/app" });
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="currentColor"
        d="M44.5 20H24v8.5h11.8C34.2 33.4 29.7 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l6-6C34.3 5.7 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 19.5-8 19.5-20c0-1.3-.1-2.7-.4-4z"
      />
    </svg>
  );
}

/** Sign-in button, or a dashboard link when already signed in. */
function Cta({ signedIn, className = "", children }: { signedIn: boolean; className?: string; children?: React.ReactNode }) {
  if (signedIn) {
    return (
      <Link href="/app" className={`btn-primary ${className}`}>
        Open dashboard →
      </Link>
    );
  }
  return (
    <form action={signInWithGoogle}>
      <button type="submit" className={`btn-primary ${className}`}>
        {children ?? (
          <>
            <GoogleIcon /> Sign in with Google
          </>
        )}
      </button>
    </form>
  );
}

const ROWS: { name: string; sub: string; status: Status; right: React.ReactNode }[] = [
  {
    name: "SW-Core-9300-48P",
    sub: "PT Maju Jaya · Due 28 Oct",
    status: "In Use",
    right: (
      <span className="rounded-md bg-red/20 px-2 py-1 font-mono text-[10.5px] font-semibold tracking-wider text-[#FFB3A6] shadow-[inset_0_0_0_1px_rgba(240,102,76,.6)]">
        OVERDUE
      </span>
    ),
  },
  { name: "SW-Access-5130-24", sub: "Bekasi site · R2-U14", status: "In Use", right: "fw 7.1.070" },
  { name: "AP-WA6330X", sub: "Warehouse · Shelf B", status: "Available", right: "SN 219801A…" },
];

const GLASS_STAT = "lg rounded-[18px] px-4 py-3.5";

export default async function Landing() {
  const session = await auth();
  const signedIn = !!session?.user;

  return (
    <div className="overflow-x-hidden">
      <Backdrop />
      {/* NAV */}
      <div className="sticky top-0 z-30 px-4 pt-4 sm:px-7">
        <LiquidGlass
          scale={28}
          bevelDepth={12}
          aberration={3}
          tint={0.06}
          className="glass-rim mx-auto max-w-[860px]"
          style={{ backgroundColor: "rgba(10,12,16,.5)" }}
          contentClassName="flex items-center justify-between gap-3 py-2 pl-5 pr-2"
        >
          <Link href="/" aria-label="RackTrack home">
            <Logo />
          </Link>
          <nav className="hidden gap-7 font-mono text-[13px] uppercase tracking-[0.08em] text-[#C9D1DB] sm:flex">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#how" className="hover:text-white">How it works</a>
            <a href="#privacy" className="hover:text-white">Privacy</a>
          </nav>
          <Cta signedIn={signedIn} className="min-h-[42px] px-5">
            Sign in
          </Cta>
        </LiquidGlass>
      </div>

      {/* HERO */}
      <section className="mx-auto max-w-[1180px] px-4 pt-20 text-center sm:px-7 sm:pt-28">
        <div className="lg lg-dark mx-auto inline-flex h-[34px] items-center gap-2 rounded-full px-3.5">
          <span className="blink h-2 w-2 rounded-full bg-green shadow-[0_0_10px_#4FD199]" />
          <span className="font-mono text-xs tracking-[0.06em] text-[#DDE3EA]">
            v1.0 · free · up to {MAX_DEVICES_PER_WORKSPACE} devices
          </span>
        </div>
        <h1 className="mx-auto mt-7 max-w-[1040px] font-mono text-[clamp(34px,6.4vw,78px)] font-semibold leading-none tracking-[-0.04em]">
          Network inventory,
          <br />
          <span className="bg-gradient-to-b from-[#FFE2B0] via-[#F7A23A] to-[#D86F12] bg-clip-text text-transparent">
            crystal clear.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-[620px] text-lg leading-relaxed text-[#BAC3CF]">
          Track switches, APs, routers, firewalls, and servers. Status, location, customer, and return date, all on one
          screen.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Cta signedIn={signedIn} className="min-h-[52px] px-7 text-sm" />
          <a href="#features" className="btn-ghost min-h-[52px] px-7 text-sm">
            See how it works
          </a>
        </div>
      </section>

      {/* HERO APP WINDOW */}
      <section aria-label="Dashboard preview" className="mx-auto max-w-[1180px] px-4 pb-24 pt-16 sm:px-7 sm:pb-28">
        <div className="lg lg-dark overflow-hidden rounded-[32px] p-2.5">
          <div className="sheen" />
          <div className="flex items-center gap-2 px-3.5 pb-3.5 pt-2.5" aria-hidden>
            <span className="h-[11px] w-[11px] rounded-full bg-white/20" />
            <span className="h-[11px] w-[11px] rounded-full bg-white/20" />
            <span className="h-[11px] w-[11px] rounded-full bg-white/20" />
            <span className="ml-3.5 hidden font-mono text-xs text-[#AEB8C5] sm:inline">racktrack.online/app</span>
          </div>
          <div className="grid overflow-hidden rounded-3xl bg-[#06080C]/55 shadow-[inset_0_0_0_1px_rgba(255,255,255,.07)] lg:grid-cols-[200px_1fr]">
            <div className="hidden flex-col gap-1.5 border-r border-white/[.07] px-4 py-5 text-left lg:flex">
              <div className="mx-2 mb-2 font-mono text-[11px] tracking-[0.14em] text-[#8E99A8]">GROUPS</div>
              <span className="chip chip-on h-9 rounded-xl">All · 99</span>
              {[
                ["Wireless · 41", "#5DC9E0"],
                ["Networking · 47", "#9B8CF2"],
                ["Others · 11", "#8B97A8"],
              ].map(([t, c]) => (
                <span key={t} className="chip h-9 rounded-xl bg-transparent shadow-none">
                  <span className="h-2 w-2 rounded-full" style={{ background: c }} />
                  {t}
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-3.5 p-4 text-left sm:p-5">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className={GLASS_STAT}>
                  <div className="font-mono text-[10.5px] tracking-[0.12em] text-[#C3CBD6]">TOTAL</div>
                  <div className="font-mono text-3xl font-semibold">
                    99<span className="text-xs font-normal text-[#97A3B3]"> /{MAX_DEVICES_PER_WORKSPACE}</span>
                  </div>
                </div>
                <div className={GLASS_STAT}>
                  <div className="flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.12em] text-[#C3CBD6]">
                    <StatusLed status="Available" /> AVAILABLE
                  </div>
                  <div className="font-mono text-3xl font-semibold text-[#6BE3B0]">62</div>
                </div>
                <div className={`${GLASS_STAT} lg-amber`}>
                  <div className="flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.12em] text-[#FFE6C6]">
                    <StatusLed status="In Use" /> IN USE
                  </div>
                  <div className="font-mono text-3xl font-semibold text-[#FFE1B8]">
                    31<span className="text-xs font-medium text-[#FFB3A6]"> · 3 overdue</span>
                  </div>
                </div>
                <div className={GLASS_STAT}>
                  <div className="flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.12em] text-[#C3CBD6]">
                    <StatusLed status="Hilang" /> MISSING
                  </div>
                  <div className="font-mono text-3xl font-semibold text-[#FF9A86]">6</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-xl bg-black/35 px-3.5 text-sm text-[#8E99A8] shadow-[inset_0_0_0_1px_rgba(255,255,255,.1)]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-4-4" />
                  </svg>
                  Search name, serial, customer…
                </div>
                <span className="chip">Type: Switch</span>
                <span className="chip chip-on">In Use</span>
              </div>
              {ROWS.map((r) => (
                <div
                  key={r.name}
                  className="flex items-center gap-3.5 rounded-2xl bg-white/[.045] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,.07)]"
                >
                  <StatusLed status={r.status} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[14.5px] font-semibold">{r.name}</div>
                    <div className="truncate font-mono text-xs text-[#AEB8C5]">{r.sub}</div>
                  </div>
                  <span className="hidden font-mono text-xs text-[#AEB8C5] sm:inline">{r.right}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-[1180px] scroll-mt-24 px-4 pb-24 sm:px-7 sm:pb-28">
        <div className="mb-11 text-center">
          <div className="eyebrow">Features</div>
          <h2 className="mt-3 font-mono text-[clamp(26px,3.8vw,42px)] font-semibold leading-tight tracking-[-0.02em]">
            Everything you check daily,
            <br />
            in one place.
          </h2>
        </div>
        <div className="grid gap-[18px] md:grid-cols-6">
          <div className="lg flex min-h-[250px] flex-col justify-between gap-6 p-7 md:col-span-4">
            <div>
              <div className="eyebrow text-[#6BE3B0]">01 · Status</div>
              <h3 className="mt-2.5 font-mono text-[22px] leading-tight">Read it at a glance.</h3>
              <p className="mt-2 max-w-[440px] leading-relaxed text-[#BAC3CF]">
                Every device gets a status LED: Available, In Use, or Missing. The summary cards up top double as filters.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <span className="chip"><StatusLed status="Available" /> Available</span>
              <span className="chip"><StatusLed status="In Use" /> In Use</span>
              <span className="chip"><StatusLed status="Hilang" /> Missing</span>
            </div>
          </div>

          <div className="lg lg-amber flex min-h-[250px] flex-col justify-between gap-5 p-7 md:col-span-2">
            <div>
              <div className="eyebrow text-[#FFE6C6]">02 · Overdue</div>
              <h3 className="mt-2.5 font-mono text-xl leading-tight text-[#FFF3E2]">Late return? You&apos;ll know.</h3>
              <p className="mt-2 leading-relaxed text-[#F4E2CC]">Anything past its return date gets flagged red.</p>
            </div>
            <div className="font-mono text-[44px] font-semibold tracking-[-0.04em] text-[#FFF3E2]">
              3<span className="text-sm font-medium text-[#FFD2C8]"> overdue</span>
            </div>
          </div>

          <div className="lg min-h-[260px] p-7 md:col-span-2">
            <div className="eyebrow text-[#C2B8FF]">03 · Filter</div>
            <h3 className="mt-2.5 font-mono text-xl leading-tight">Group → type → status.</h3>
            <p className="mb-4 mt-2 leading-relaxed text-[#BAC3CF]">
              Cascading filters plus search by name, serial, customer, or location.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="chip chip-on">Wireless</span>
              <span className="chip">Access Point</span>
              <span className="chip">Controller</span>
            </div>
          </div>

          <div className="lg min-h-[260px] p-7 md:col-span-4">
            <div className="eyebrow text-[#8EE3F2]">04 · Import</div>
            <h3 className="mt-2.5 font-mono text-xl leading-tight">Move your old spreadsheet in a minute.</h3>
            <p className="mb-4 mt-2 max-w-[520px] leading-relaxed text-[#BAC3CF]">
              Upload .xlsx or .csv, map the columns, check the preview, import. The file is read right in your browser.
            </p>
            <div className="grid max-w-[460px] grid-cols-[1fr_auto_1fr] items-center gap-x-3.5 gap-y-2 font-mono">
              {[
                ["Item Name", "Name"],
                ["S/N", "Serial"],
                ["Borrower", "Customer"],
              ].map(([a, b]) => (
                <div key={a} className="contents">
                  <span className="chip">{a}</span>
                  <span className="text-[#8EE3F2]" aria-hidden>→</span>
                  <span className="chip chip-on">{b}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg min-h-[230px] p-7 md:col-span-3">
            <div className="eyebrow">05 · Details</div>
            <h3 className="mb-3.5 mt-2.5 font-mono text-xl leading-tight">Rack, port, firmware, warranty.</h3>
            <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-2 font-mono text-[13px]">
              <dt className="text-[#97A3B3]">RACK / PORT</dt>
              <dd>R2-U14 · Gi1/0/24</dd>
              <dt className="text-[#97A3B3]">FIRMWARE</dt>
              <dd>7.1.070 R6635</dd>
              <dt className="text-[#97A3B3]">WARRANTY</dt>
              <dd>until Mar 2028</dd>
              <dt className="text-[#97A3B3]">COORDINATES</dt>
              <dd>-6.24, 106.99</dd>
            </dl>
          </div>

          <div id="privacy" className="lg flex min-h-[230px] scroll-mt-24 items-start gap-5 p-7 md:col-span-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-green/15 shadow-[inset_0_1px_1px_rgba(255,255,255,.35),inset_0_0_0_1px_rgba(79,209,153,.4)]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6BE3B0" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="5" y="11" width="14" height="10" rx="2.5" />
                <path d="M8 11V7a4 4 0 018 0v4" />
              </svg>
            </div>
            <div>
              <div className="eyebrow text-[#6BE3B0]">06 · Shared, on your terms</div>
              <h3 className="mt-2.5 font-mono text-xl leading-tight">Private until you invite.</h3>
              <p className="mt-2 leading-relaxed text-[#BAC3CF]">
                Each workspace is fully separate. Invite teammates by email as Admin, Editor or Viewer, and only they can see that inventory.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="mx-auto max-w-[1180px] scroll-mt-24 px-4 pb-24 sm:px-7 sm:pb-28">
        <div className="mb-10 text-center">
          <div className="eyebrow">How it works</div>
          <h2 className="mt-3 font-mono text-[clamp(26px,3.8vw,42px)] font-semibold tracking-[-0.02em]">Three steps. Done.</h2>
        </div>
        <ol className="grid gap-[18px] md:grid-cols-3">
          {[
            ["Sign in with Google", "One click, no new password."],
            ["Add or import", "Enter devices one by one, or import from Excel."],
            ["Track and update", "Change status, location, or customer anytime, even from your phone."],
          ].map(([t, b], i) => (
            <li key={t} className="lg p-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-gradient-to-b from-[#FFD08A] to-[#F7A23A] font-mono font-semibold text-[#1D1104] shadow-[inset_0_1px_1px_rgba(255,255,255,.8)]">
                {i + 1}
              </div>
              <h3 className="mb-1.5 mt-4 font-mono text-[17px]">{t}</h3>
              <p className="leading-relaxed text-[#BAC3CF]">{b}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1180px] px-4 pb-20 sm:px-7">
        <div className="lg lg-amber overflow-hidden rounded-[36px] px-7 py-16 text-center sm:py-[72px]">
          <div className="sheen" />
          <h2 className="font-mono text-[clamp(26px,4.2vw,48px)] font-semibold tracking-[-0.02em] text-[#FFF6EA]">
            Get your rack in order today.
          </h2>
          <p className="mx-auto mb-8 mt-4 max-w-[460px] text-[17px] leading-relaxed text-[#F7E6D0]">
            Free for up to {MAX_DEVICES_PER_WORKSPACE} devices per workspace. No credit card needed.
          </p>
          <div className="flex justify-center">
            <Cta signedIn={signedIn} className="min-h-[52px] px-7 text-sm" />
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-[1180px] px-4 pb-10 sm:px-7">
        <div className="flex flex-wrap justify-between gap-3 border-t border-white/10 pt-5 font-mono text-xs text-[#97A3B3]">
          <span>© {new Date().getFullYear()} RackTrack · racktrack.online</span>
          <span>Cipta Kreasi Inovatif</span>
        </div>
      </footer>
    </div>
  );
}
