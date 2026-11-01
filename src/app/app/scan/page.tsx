import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/access";
import { listDevices, listPlaces } from "@/lib/devices";
import { canEditDevices } from "@/lib/roles";
import { ScanView } from "@/components/ScanView";

export const dynamic = "force-dynamic";

// Lookups run in the browser against the workspace's devices (max 300), so a scan answers instantly.
export default async function ScanPage() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/");
  const { workspace } = ctx;

  const [devices, places] = await Promise.all([listDevices(workspace.workspaceId), listPlaces(workspace.workspaceId)]);
  return (
    <ScanView
      key={workspace.workspaceId}
      devices={devices}
      places={places}
      workspaceId={workspace.workspaceId}
      canEdit={canEditDevices(workspace.role)}
    />
  );
}
