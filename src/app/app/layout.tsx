import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getAppContext } from "@/lib/access";
import { categoryCounts } from "@/lib/devices";
import { Logo } from "@/components/StatusLed";
import { LiquidGlass } from "@/components/ui/liquid-glass";
import { Backdrop } from "@/components/Backdrop";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { BottomNav, SidebarNav } from "@/components/AppNav";

async function doSignOut() {
  "use server";
  await signOut({ redirectTo: "/" });
}

function Avatar({ image }: { image: string | null | undefined }) {
  if (!image) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" width={28} height={28} referrerPolicy="no-referrer" className="h-7 w-7 shrink-0 rounded-full ring-1 ring-white/25" />
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const ctx = await getAppContext();
  if (!session?.user || !ctx) redirect("/");
  const { name, email, image } = session.user;
  const counts = await categoryCounts(ctx.workspace.workspaceId);

  const switcher = (
    <WorkspaceSwitcher
      current={ctx.workspace.workspaceId}
      workspaces={ctx.workspaces.map(({ workspaceId, name }) => ({ id: workspaceId, name }))}
    />
  );

  return (
    <div className="min-h-screen">
      <Backdrop dim />

      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 p-3 lg:block">
        <div className="lg lg-dark flex h-full flex-col rounded-[24px] p-3">
          <Link href="/app" aria-label="RackTrack dashboard" className="px-2 pb-4 pt-1">
            <Logo />
          </Link>
          <div className="mb-4 px-1 [&>select]:max-w-none [&>select]:w-full">{switcher}</div>
          <Suspense>
            <SidebarNav counts={counts} />
          </Suspense>
          <div className="mt-3 flex items-center gap-2 border-t border-white/10 px-1 pt-3">
            <Avatar image={image} />
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-[#C3CBD6]">{name ?? email}</span>
            <form action={doSignOut}>
              <button type="submit" className="btn-ghost px-3 py-1.5 text-xs">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* phone/tablet top bar */}
      <header className="sticky top-0 z-30 px-4 pt-4 sm:px-6 lg:hidden">
        <LiquidGlass
          scale={28}
          bevelDepth={12}
          aberration={3}
          tint={0.06}
          className="glass-rim mx-auto max-w-7xl"
          style={{ backgroundColor: "rgba(10,12,16,.5)" }}
          contentClassName="flex items-center justify-between gap-3 py-2 pl-5 pr-2"
        >
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/app" aria-label="RackTrack dashboard" className="shrink-0">
              <Logo textClassName="hidden sm:inline" />
            </Link>
            {switcher}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden sm:block">
              <Avatar image={image} />
            </span>
            <form action={doSignOut}>
              <button type="submit" className="btn-ghost">
                Sign out
              </button>
            </form>
          </div>
        </LiquidGlass>
      </header>

      <main className="px-4 pb-28 pt-7 sm:px-6 lg:pb-10 lg:pl-[17.5rem] lg:pr-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>

      <BottomNav />
    </div>
  );
}
