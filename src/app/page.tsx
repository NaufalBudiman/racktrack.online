import Link from "next/link";
import { auth, signIn } from "@/auth";
import { Logo, StatusLed } from "@/components/StatusLed";
import { LiquidGlass } from "@/components/ui/liquid-glass";
import { Backdrop } from "@/components/Backdrop";
import { MAX_DEVICES_PER_WORKSPACE } from "@/lib/categories";

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

// Preview data is made up (99 devices = 52 + 38 + 4 + 3 + 2).
const STOCK = [
  ["Access Point", 18, "#5DC9E0"],
  ["Switch", 14, "#9B8CF2"],
  ["PoE Injector", 9, "#5DC9E0"],
  ["Router", 6, "#9B8CF2"],
  ["Firewall", 5, "#9B8CF2"],
] as const;

const CUSTOMERS = [
  { name: "PT Maju Jaya", sub: "3 on loan · due 28 Oct", n: 9, overdue: true },
  { name: "Bekasi Logistics", sub: "installed", n: 7, overdue: false },
  { name: "Sinar Retail", sub: "2 on loan · next due 14 Nov", n: 5, overdue: false },
];

const NAV_ITEMS = ["Dashboard", "Devices", "Customers", "Activity", "Team"];

function OverdueTag() {
  return (
    <span className="rounded-md bg-red/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-[#FFB3A6] shadow-[inset_0_0_0_1px_rgba(240,102,76,.6)]">
      OVERDUE
    </span>
  );
}

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
            <a href="#teams" className="hover:text-white">Teams</a>
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
            v1.2 · free · built for teams
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
          Know exactly what&apos;s ready in stock and what&apos;s out at a customer. Switches, APs, routers, firewalls and
          servers, shared with your whole team.
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
            <div className="hidden flex-col gap-1 border-r border-white/[.07] px-3 py-5 text-left lg:flex">
              <div className="mx-2 mb-3 rounded-lg bg-black/35 px-2.5 py-1.5 font-mono text-[11px] text-[#C3CBD6] shadow-[inset_0_0_0_1px_rgba(255,255,255,.1)]">
                CKI Office ▾
              </div>
              {NAV_ITEMS.map((n, i) => (
                <span
                  key={n}
                  className={`rounded-xl px-3 py-1.5 text-[13px] ${
                    i === 0 ? "bg-amber/15 text-[#FFD9A8] shadow-[inset_0_0_0_1px_rgba(239,155,62,.45)]" : "text-[#AEB8C5]"
                  }`}
                >
                  {n}
                </span>
              ))}
              <div className="mx-2 mb-1 mt-4 font-mono text-[11px] tracking-[0.14em] text-[#8E99A8]">CATEGORIES</div>
              {[
                ["Wireless", 41, "#5DC9E0"],
                ["Networking", 47, "#9B8CF2"],
                ["Others", 11, "#8B97A8"],
              ].map(([t, n, c]) => (
                <span key={t} className="flex items-center gap-2 px-3 py-1 font-mono text-[11px] uppercase tracking-wider" style={{ color: c as string }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: c as string }} />
                  <span className="flex-1">{t}</span>
                  <span className="text-[#97A3B3]">{n}</span>
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
                    <StatusLed status="Available" /> IN STOCK
                  </div>
                  <div className="font-mono text-3xl font-semibold text-[#6BE3B0]">52</div>
                </div>
                <div className={`${GLASS_STAT} lg-amber`}>
                  <div className="flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.12em] text-[#FFE6C6]">
                    <StatusLed status="In Use" /> AT CUSTOMER
                  </div>
                  <div className="font-mono text-3xl font-semibold text-[#FFE1B8]">
                    38<span className="text-xs font-medium text-[#FFB3A6]"> · 2 overdue</span>
                  </div>
                </div>
                <div className={GLASS_STAT}>
                  <div className="flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.12em] text-[#C3CBD6]">
                    <StatusLed status="Faulty" /> FAULTY
                  </div>
                  <div className="font-mono text-3xl font-semibold text-[#FBE29A]">3</div>
                </div>
              </div>

              <div className="grid gap-3.5 md:grid-cols-2">
                <div className="rounded-2xl bg-white/[.045] p-4 shadow-[inset_0_2px_0_rgba(79,209,153,.55),inset_0_0_0_1px_rgba(255,255,255,.07)]">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-mono text-[10.5px] tracking-[0.12em] text-[#6BE3B0]">READY TO USE</div>
                      <div className="mt-0.5 font-mono text-[15px] font-semibold">IN STOCK</div>
                    </div>
                    <div className="font-mono text-3xl font-semibold leading-none text-[#6BE3B0]">52</div>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {STOCK.map(([name, n, c]) => (
                      <li key={name}>
                        <div className="flex justify-between text-[13px]">
                          <span className="text-[#BAC3CF]">{name}</span>
                          <span className="font-mono text-[11px] text-[#6BE3B0]">{n} ready</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-white/[.06]">
                          <div className="h-full rounded-full" style={{ width: `${(n / 18) * 100}%`, background: c }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl bg-white/[.045] p-4 shadow-[inset_0_2px_0_rgba(239,155,62,.65),inset_0_0_0_1px_rgba(255,255,255,.07)]">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-mono text-[10.5px] tracking-[0.12em] text-[#FFC27A]">OUT IN THE FIELD</div>
                      <div className="mt-0.5 font-mono text-[15px] font-semibold">AT CUSTOMERS</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-3xl font-semibold leading-none text-[#FFE1B8]">38</div>
                      <div className="mt-1 font-mono text-[10px] text-[#97A3B3]">at 12 customers</div>
                    </div>
                  </div>
                  <ul className="mt-2 divide-y divide-white/10">
                    {CUSTOMERS.map((c) => (
                      <li key={c.name} className="flex items-center gap-3 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] text-ink">{c.name}</div>
                          <div className="truncate font-mono text-[10.5px] text-[#97A3B3]">{c.sub}</div>
                        </div>
                        {c.overdue && <OverdueTag />}
                        <span className="w-6 text-right font-mono text-sm text-[#FFE1B8]">{c.n}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-[1180px] scroll-mt-24 px-4 pb-24 sm:px-7 sm:pb-28">
        <div className="mb-11 text-center">
          <div className="eyebrow">Features</div>
          <h2 className="mt-3 font-mono text-[clamp(26px,3.8vw,42px)] font-semibold leading-tight tracking-[-0.02em]">
            In stock or at a customer.
            <br />
            Never a guess again.
          </h2>
        </div>
        <div className="grid gap-[18px] md:grid-cols-6">
          <div className="lg flex min-h-[250px] flex-col justify-between gap-6 p-7 md:col-span-4">
            <div>
              <div className="eyebrow text-[#6BE3B0]">01 · Stock vs customer</div>
              <h3 className="mt-2.5 font-mono text-[22px] leading-tight">One clear status per device.</h3>
              <p className="mt-2 max-w-[480px] leading-relaxed text-[#BAC3CF]">
                The dashboard splits what&apos;s ready to use from what&apos;s out in the field, per category and per
                customer. Internal, faulty and missing gear never gets counted as ready.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <span className="chip"><StatusLed status="Available" /> In Stock</span>
              <span className="chip"><StatusLed status="In Use" /> At Customer</span>
              <span className="chip"><StatusLed status="Internal" /> Internal Use</span>
              <span className="chip"><StatusLed status="Faulty" /> Faulty</span>
              <span className="chip"><StatusLed status="Hilang" /> Missing</span>
              <span className="chip"><StatusLed status="Retired" /> Retired</span>
            </div>
          </div>

          <div className="lg lg-amber flex min-h-[250px] flex-col justify-between gap-5 p-7 md:col-span-2">
            <div>
              <div className="eyebrow text-[#FFE6C6]">02 · Loans</div>
              <h3 className="mt-2.5 font-mono text-xl leading-tight text-[#FFF3E2]">Loan or installed.</h3>
              <p className="mt-2 leading-relaxed text-[#F4E2CC]">
                Loans need a return date and turn red the day they&apos;re late. Installs just stay put.
              </p>
            </div>
            <div className="font-mono text-[44px] font-semibold tracking-[-0.04em] text-[#FFF3E2]">
              2<span className="text-sm font-medium text-[#FFD2C8]"> overdue</span>
            </div>
          </div>

          <div className="lg min-h-[250px] p-7 md:col-span-3">
            <div className="eyebrow text-[#FFC27A]">03 · One-click moves</div>
            <h3 className="mt-2.5 font-mono text-xl leading-tight">Send it out. Bring it back.</h3>
            <p className="mb-4 mt-2 leading-relaxed text-[#BAC3CF]">
              No retyping fields. Pick a customer, choose loan or installed, done. On return, mark it working or faulty and
              add a note like &ldquo;adapter missing&rdquo;.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="btn-primary pointer-events-none px-3 py-1.5 text-xs">Send to customer</span>
              <span className="btn-ghost pointer-events-none px-3 py-1.5 text-xs">Return to stock</span>
              <span className="btn-ghost pointer-events-none px-3 py-1.5 text-xs">Mark faulty</span>
              <span className="btn-ghost pointer-events-none px-3 py-1.5 text-xs">Found</span>
            </div>
          </div>

          <div className="lg min-h-[250px] p-7 md:col-span-3">
            <div className="eyebrow text-[#FFE1B8]">04 · Customers</div>
            <h3 className="mt-2.5 font-mono text-xl leading-tight">Who has what, since when.</h3>
            <p className="mb-4 mt-2 leading-relaxed text-[#BAC3CF]">
              Every customer on one page: devices they hold, loans vs installs, next due date. Click through to the list.
            </p>
            <ul className="divide-y divide-white/10 rounded-xl bg-black/20 px-3">
              {CUSTOMERS.slice(0, 2).map((c) => (
                <li key={c.name} className="flex items-center gap-3 py-2 text-[13px]">
                  <span className="min-w-0 flex-1 truncate text-ink">{c.name}</span>
                  {c.overdue && <OverdueTag />}
                  <span className="font-mono text-[#FFE1B8]">{c.n}</span>
                </li>
              ))}
            </ul>
          </div>

          <div id="teams" className="lg min-h-[250px] scroll-mt-24 p-7 md:col-span-4">
            <div className="eyebrow text-[#C2B8FF]">05 · Teams</div>
            <h3 className="mt-2.5 font-mono text-[22px] leading-tight">One inventory, the whole team.</h3>
            <p className="mb-4 mt-2 max-w-[520px] leading-relaxed text-[#BAC3CF]">
              Create a workspace per office or client and invite people by email. Each workspace is private: only the people
              you invite can see it.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Owner", "Everything"],
                ["Admin", "Manage members"],
                ["Editor", "Add & move devices"],
                ["Viewer", "Read only"],
              ].map(([r, d]) => (
                <div key={r} className="rounded-xl bg-black/20 px-3 py-2.5">
                  <div className="font-mono text-xs font-semibold text-[#E2DCFF]">{r}</div>
                  <div className="mt-0.5 text-xs text-[#AEB8C5]">{d}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg min-h-[250px] p-7 md:col-span-2">
            <div className="eyebrow text-[#8EE3F2]">06 · History</div>
            <h3 className="mt-2.5 font-mono text-xl leading-tight">Who moved it?</h3>
            <p className="mb-4 mt-2 leading-relaxed text-[#BAC3CF]">Every move is logged with who did it and when.</p>
            <ol className="space-y-2.5 border-l border-white/10 pl-4 text-[13px]">
              <li className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[#EF9B3E]" aria-hidden />
                <div className="text-ink">Sent to PT Maju Jaya (loan)</div>
                <div className="font-mono text-[11px] text-[#97A3B3]">2 Nov · Rina</div>
              </li>
              <li className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[#EF9B3E]" aria-hidden />
                <div className="text-ink">Returned → In Stock — adapter missing</div>
                <div className="font-mono text-[11px] text-[#97A3B3]">28 Oct · Dimas</div>
              </li>
            </ol>
          </div>

          <div className="lg min-h-[230px] p-7 md:col-span-3">
            <div className="eyebrow text-[#8EE3F2]">07 · Import</div>
            <h3 className="mt-2.5 font-mono text-xl leading-tight">Bring your old spreadsheet.</h3>
            <p className="mb-4 mt-2 leading-relaxed text-[#BAC3CF]">
              Upload .xlsx or .csv, map the columns, check the preview. Words like &ldquo;dipinjam&rdquo; or
              &ldquo;rusak&rdquo; are understood. The file is read in your browser.
            </p>
            <div className="grid max-w-[420px] grid-cols-[1fr_auto_1fr] items-center gap-x-3.5 gap-y-2 font-mono">
              {[
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
            <div className="eyebrow text-[#6BE3B0]">08 · Data cleanup</div>
            <h3 className="mt-2.5 font-mono text-xl leading-tight">Messy records, found for you.</h3>
            <p className="mb-4 mt-2 leading-relaxed text-[#BAC3CF]">
              Spots look-alike customer names, stock with leftover customer details, and duplicate serials. Merge or fix in
              one click.
            </p>
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              <span className="chip">PT Maju Jaya</span>
              <span className="text-[#97A3B3]" aria-hidden>≈</span>
              <span className="chip">Maju jaya</span>
              <span className="text-[#6BE3B0]" aria-hidden>→</span>
              <span className="chip chip-on">Merged</span>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="mx-auto max-w-[1180px] scroll-mt-24 px-4 pb-24 sm:px-7 sm:pb-28">
        <div className="mb-10 text-center">
          <div className="eyebrow">How it works</div>
          <h2 className="mt-3 font-mono text-[clamp(26px,3.8vw,42px)] font-semibold tracking-[-0.02em]">Four steps. Done.</h2>
        </div>
        <ol className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Sign in with Google", "One click, no new password. You get your own workspace."],
            ["Add or import", "Type devices in, or import your Excel sheet. Rack, port, firmware and warranty included."],
            ["Invite your team", "Share the workspace by email as Admin, Editor or Viewer."],
            ["Send out, bring back", "Move devices between stock and customers. The dashboard and history update themselves."],
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
            Free for up to {MAX_DEVICES_PER_WORKSPACE} devices per workspace, with your whole team. No credit card needed.
          </p>
          <div className="flex justify-center">
            <Cta signedIn={signedIn} className="min-h-[52px] px-7 text-sm" />
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-[1180px] px-4 pb-10 sm:px-7">
        <div className="flex flex-wrap justify-between gap-3 border-t border-white/10 pt-5 font-mono text-xs text-[#97A3B3]">
          <span>© {new Date().getFullYear()} RackTrack · racktrack.online</span>
          <span className="flex gap-4">
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
            <span>Cipta Kreasi Inovatif</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
