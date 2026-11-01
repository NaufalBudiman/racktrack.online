import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/access";
import { listDevices, listHistory } from "@/lib/devices";
import { canEditDevices } from "@/lib/roles";
import { Dashboard } from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/");
  const { workspace } = ctx;

  const [devices, history] = await Promise.all([
    listDevices(workspace.workspaceId),
    listHistory(workspace.workspaceId, { limit: 10 }),
  ]);

  return (
    <Dashboard
      devices={devices}
      history={history}
      workspaceId={workspace.workspaceId}
      workspaceName={workspace.name}
      role={workspace.role}
      canEdit={canEditDevices(workspace.role)}
    />
  );
}
