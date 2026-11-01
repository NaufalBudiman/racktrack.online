import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getAppContext } from "@/lib/access";
import { getDb } from "@/lib/db";
import { devices } from "@/lib/schema";
import type { DeviceRow } from "@/lib/types";
import { canEditDevices } from "@/lib/roles";
import { Inventory } from "@/components/Inventory";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/");
  const { workspace } = ctx;

  // Always scoped to a workspace the signed-in user belongs to.
  const rows = await getDb()
    .select()
    .from(devices)
    .where(eq(devices.workspaceId, workspace.workspaceId))
    .orderBy(asc(devices.name), asc(devices.serial));

  const list: DeviceRow[] = rows.map(({ userId: _u, workspaceId: _w, createdAt, updatedAt, ...rest }) => ({
    ...rest,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  }));

  return (
    <Inventory
      devices={list}
      workspaceId={workspace.workspaceId}
      workspaceName={workspace.name}
      role={workspace.role}
      canEdit={canEditDevices(workspace.role)}
    />
  );
}
