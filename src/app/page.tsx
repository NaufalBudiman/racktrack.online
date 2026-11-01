import Link from "next/link";
import { auth, signIn } from "@/auth";
import { Logo } from "@/components/StatusLed";
import { StatusLed } from "@/components/StatusLed";
import { MAX_DEVICES_PER_ACCOUNT, type Status } from "@/lib/categories";

async function signInWithGoogle() {
  "use server";
  await signIn("google", { redirectTo: "/app" });
}

function GoogleButton({ label = "Continue with Google" }: { label?: string }) {
  return (
    <form action={signInWithGoogle}>
      <button type="submit" className="btn-primary px-5 py-3 text-sm">
        {label}
      </button>
    </form>
  );
}

const FEATURES = [
  ["Status at a glance", "LED-style status for every device: Available, In Use (pulsing) or Hilang."],
  ["Built for network gear", "Types for switches, APs, routers, firewalls, servers and spares, grouped as Wireless and Networking."],
  ["Rack & firmware aware", "Keep rack position / port and firmware version next to the serial number."],
  ["Customer & overdue tracking", "Note who has a device and when it is due back. Late returns get flagged automatically."],
  ["Import your spreadsheet", "Upload .xlsx or .csv, map the columns and preview before anything is saved."],
  ["Private by default", "Your inventory is only visible to your Google account. Nothing is shared."],
] as const;

const DEMO: { name: string; serial: string; status: Status; group: string; color: string }[] = [
  { name: "H3C WA6330X", serial: "219801A24G823BE00004", status: "Available", group: "Wireless", color: "#5DC9E0" },
  { name: "H3C S5130S-52S-EI", serial: "210235A1UEH21000123", status: "In Use", group: "Networking", color: "#9B8CF2" },
  { name: "ProLiant DL380", serial: "SGH2290XYZ", status: "In Use", group: "Networking", color: "#9B8CF2" },
  { name: "FortiGate 60F", serial: "FGT60FTK2209XXXX", status: "Hilang", group: "Networking", color: "#9B8CF2" },
];

export default async function Landing() {
  const session = await auth();
  const signedIn = !!session?.user;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <Logo />
        {signedIn ? (
          <Link href="/app" className="btn-primary">Open dashboard</Link>
        ) : (
          <form action={signInWithGoogle}>
            <button className="btn-ghost" type="submit">Sign in</button>
          </form>
        )}
      </header>

      <section className="grid items-center gap-10 py-12 md:grid-cols-2 md:py-20">
        <div>
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-amber">
            Free · for network &amp; IT engineers
          </p>
          <h1 className="font-mono text-3xl font-semibold leading-tight sm:text-5xl">
            Know where every switch, AP and server is.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">
            RackTrack is a simple inventory manager for the gear you actually handle: switches,
            access points, routers, firewalls and servers. Track status, location, customer and
            firmware, and stop losing devices in spreadsheets.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            {signedIn ? (
              <Link href="/app" className="btn-primary px-5 py-3 text-sm">Open dashboard</Link>
            ) : (
              <GoogleButton />
            )}
            <span className="font-mono text-xs text-muted">
              Up to {MAX_DEVICES_PER_ACCOUNT} devices per account
            </span>
          </div>
        </div>

        {/* decorative rack */}
        <div aria-hidden className="space-y-3 rounded-lg border border-line bg-surface/60 p-4">
          {DEMO.map((d) => (
            <div key={d.serial} className="relative rounded-md border border-line bg-surface p-4">
              <span className="rivet left-1.5 top-1.5" />
              <span className="rivet right-1.5 top-1.5" />
              <span className="rivet bottom-1.5 left-1.5" />
              <span className="rivet bottom-1.5 right-1.5" />
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest">
                <span className="flex items-center gap-2" style={{ color: d.color }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: d.color }} />
                  {d.group}
                </span>
                <span className="flex items-center gap-2 text-muted">
                  <StatusLed status={d.status} /> {d.status}
                </span>
              </div>
              <div className="mt-2 font-mono text-sm font-semibold">{d.name}</div>
              <div className="font-mono text-xs text-muted">{d.serial}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-10">
        <h2 className="mb-6 font-mono text-xs uppercase tracking-[0.25em] text-muted">What you get</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([title, body]) => (
            <div key={title} className="relative rounded-md border border-line bg-surface p-5">
              <span className="rivet left-1.5 top-1.5" />
              <span className="rivet right-1.5 top-1.5" />
              <h3 className="font-mono text-sm font-semibold text-amber">{title}</h3>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-10">
        <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-muted">Who it&apos;s for</h2>
        <p className="max-w-3xl text-muted">
          Network engineers, IT administrators, system integrators and vendor partners who keep demo
          units, spares and customer-deployed gear, and need to answer “where is it and who has it?”
          in seconds.
        </p>
      </section>

      <section className="my-10 rounded-lg border border-line bg-surface p-8 text-center">
        <h2 className="font-mono text-xl font-semibold">Set up your inventory in a minute</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Sign in with Google, import your existing sheet or add devices one by one.
        </p>
        <div className="mt-6 flex justify-center">
          {signedIn ? (
            <Link href="/app" className="btn-primary px-5 py-3 text-sm">Open dashboard</Link>
          ) : (
            <GoogleButton label="Sign in with Google" />
          )}
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-6 font-mono text-xs text-muted">
        <span>© {new Date().getFullYear()} RackTrack</span>
        <span>racktrack.online</span>
      </footer>
    </div>
  );
}
