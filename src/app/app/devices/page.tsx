import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/access";
import { listDevices, listMinimums, listPlaces } from "@/lib/devices";
import { canEditDevices } from "@/lib/roles";
import { Inventory } from "@/components/Inventory";

export const dynamic = "force-dynamic";

export default async function DevicesPage() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/");
  const { workspace } = ctx;

  // Always scoped to a workspace the signed-in user belongs to.
  const [devices, places, minimums] = await Promise.all([
    listDevices(workspace.workspaceId),
    listPlaces(workspace.workspaceId),
    listMinimums(workspace.workspaceId),
  ]);

  return (
    <Inventory
      devices={devices}
      places={places}
      minimums={minimums}
      workspaceId={workspace.workspaceId}
      workspaceName={workspace.name}
      role={workspace.role}
      canEdit={canEditDevices(workspace.role)}
    />
  );
}
