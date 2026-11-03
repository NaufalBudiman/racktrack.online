import { notFound, redirect } from "next/navigation";
import { getAppContext } from "@/lib/access";
import { getDevice, listHistory, listSuggestions } from "@/lib/devices";
import { canEditDevices, canManageMembers } from "@/lib/roles";
import { idSchema } from "@/lib/validation";
import { DeviceDetail } from "@/components/DeviceDetail";
import { projectIdByName } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function DevicePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAppContext();
  if (!ctx) redirect("/");
  const { workspace } = ctx;

  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();

  // Scoped to the active workspace: a device from another workspace is a 404.
  const [device, history, suggestions] = await Promise.all([
    getDevice(workspace.workspaceId, id.data),
    listHistory(workspace.workspaceId, { deviceId: id.data, limit: 100 }),
    listSuggestions(workspace.workspaceId),
  ]);
  if (!device) notFound();
  const projectId = await projectIdByName(workspace.workspaceId, device.customer);

  return (
    <DeviceDetail
      key={device.updatedAt}
      device={device}
      history={history}
      workspaceId={workspace.workspaceId}
      canEdit={canEditDevices(workspace.role)}
      canShare={canManageMembers(workspace.role)}
      suggestions={suggestions}
      projectId={projectId}
    />
  );
}
