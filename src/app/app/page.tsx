import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/access";
import { listDevices, listHistory, listMinimums, listPlaces } from "@/lib/devices";
import { listActiveCounts } from "@/lib/counts";
import { compareCount } from "@/lib/countTypes";
import { canEditDevices } from "@/lib/roles";
import { Dashboard } from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/");
  const { workspace } = ctx;

  const [devices, history, minimums, active, places] = await Promise.all([
    listDevices(workspace.workspaceId),
    listHistory(workspace.workspaceId, { limit: 10 }),
    listMinimums(workspace.workspaceId),
    listActiveCounts(workspace.workspaceId),
    listPlaces(workspace.workspaceId),
  ]);
  const counts = active.map((c) => {
    const r = compareCount(c, devices, places);
    return { id: c.id, scope: c.scope, status: c.status, found: r.found.length, expected: c.expected.length, open: r.open };
  });

  return (
    <Dashboard
      devices={devices}
      history={history}
      minimums={minimums}
      counts={counts}
      workspaceId={workspace.workspaceId}
      workspaceName={workspace.name}
      role={workspace.role}
      canEdit={canEditDevices(workspace.role)}
    />
  );
}
