import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { devices } from "@/lib/schema";
import type { DeviceRow } from "@/lib/types";
import { Inventory } from "@/components/Inventory";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/");

  // Always scoped to the signed-in user.
  const rows = await getDb()
    .select()
    .from(devices)
    .where(eq(devices.userId, userId))
    .orderBy(asc(devices.name), asc(devices.serial));

  const list: DeviceRow[] = rows.map(({ userId: _omit, createdAt, updatedAt, ...rest }) => ({
    ...rest,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  }));

  return <Inventory devices={list} />;
}
