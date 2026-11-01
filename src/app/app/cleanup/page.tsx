import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/access";
import { listDevices } from "@/lib/devices";
import { canEditDevices } from "@/lib/roles";
import { CleanupView } from "@/components/CleanupView";

export const dynamic = "force-dynamic";

export default async function CleanupPage() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/");
  const { workspace } = ctx;

  const devices = await listDevices(workspace.workspaceId);
  return (
    <CleanupView
      key={workspace.workspaceId}
      devices={devices}
      workspaceId={workspace.workspaceId}
      canEdit={canEditDevices(workspace.role)}
    />
  );
}
