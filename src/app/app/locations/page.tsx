import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/access";
import { listDevices, listPlaces } from "@/lib/devices";
import { canEditDevices, canManageMembers } from "@/lib/roles";
import { LocationsView } from "@/components/LocationsView";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/");
  const { workspace } = ctx;

  const [places, devices] = await Promise.all([listPlaces(workspace.workspaceId), listDevices(workspace.workspaceId)]);
  return (
    <LocationsView
      key={workspace.workspaceId}
      places={places}
      devices={devices}
      workspaceId={workspace.workspaceId}
      canEdit={canEditDevices(workspace.role)}
      canShare={canManageMembers(workspace.role)}
    />
  );
}
