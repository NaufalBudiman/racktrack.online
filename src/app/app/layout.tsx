import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { Logo } from "@/components/StatusLed";
import { LiquidGlass } from "@/components/ui/liquid-glass";
import { Backdrop } from "@/components/Backdrop";

async function doSignOut() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const { name, email, image } = session.user;

  return (
    <div className="min-h-screen">
      <Backdrop dim />
      <header className="sticky top-0 z-30 px-4 pt-4 sm:px-6">
        <LiquidGlass
          scale={28}
          bevelDepth={12}
          aberration={3}
          tint={0.06}
          className="glass-rim mx-auto max-w-7xl"
          style={{ backgroundColor: "rgba(10,12,16,.5)" }}
          contentClassName="flex items-center justify-between gap-3 py-2 pl-5 pr-2"
        >
          <Link href="/app" aria-label="RackTrack dashboard">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image}
                  alt=""
                  width={28}
                  height={28}
                  referrerPolicy="no-referrer"
                  className="h-7 w-7 rounded-full ring-1 ring-white/25"
                />
              ) : null}
              <span className="hidden max-w-[16rem] truncate font-mono text-xs text-[#C3CBD6] sm:inline">
                {name ?? email}
              </span>
            </div>
            <form action={doSignOut}>
              <button type="submit" className="btn-ghost">
                Sign out
              </button>
            </form>
          </div>
        </LiquidGlass>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6">{children}</main>
    </div>
  );
}
