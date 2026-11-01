import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/access";
import { listDevices, listHistory, listMinimums } from "@/lib/devices";
import { canEditDevices } from "@/lib/roles";
import { Dashboard } from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/");
  const { workspace } = ctx;

  const [devices, history, minimums] = await Promise.all([
    listDevices(workspace.workspaceId),
    listHistory(workspace.workspaceId, { limit: 10 }),
    listMinimums(workspace.workspaceId),
  ]);

  return (
    <Dashboard
      devices={devices}
      history={history}
      minimums={minimums}
      workspaceId={workspace.workspaceId}
      workspaceName={workspace.name}
      role={workspace.role}
      canEdit={canEditDevices(workspace.role)}
    />
  );
}
