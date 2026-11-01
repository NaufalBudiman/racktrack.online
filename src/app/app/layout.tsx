import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { Logo } from "@/components/StatusLed";

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
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/app" aria-label="RackTrack dashboard">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" width={26} height={26} referrerPolicy="no-referrer" className="h-[26px] w-[26px] rounded-full border border-line" />
              ) : null}
              <span className="hidden max-w-[16rem] truncate font-mono text-xs text-muted sm:inline">
                {name ?? email}
              </span>
            </div>
            <form action={doSignOut}>
              <button type="submit" className="btn-ghost py-1.5">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
