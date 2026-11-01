import { notFound, redirect } from "next/navigation";
import { getAppContext } from "@/lib/access";
import { getDevice, listHistory } from "@/lib/devices";
import { canEditDevices } from "@/lib/roles";
import { idSchema } from "@/lib/validation";
import { DeviceDetail } from "@/components/DeviceDetail";

export const dynamic = "force-dynamic";

export default async function DevicePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAppContext();
  if (!ctx) redirect("/");
  const { workspace } = ctx;

  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();

  // Scoped to the active workspace: a device from another workspace is a 404.
  const [device, history] = await Promise.all([
    getDevice(workspace.workspaceId, id.data),
    listHistory(workspace.workspaceId, { deviceId: id.data, limit: 100 }),
  ]);
  if (!device) notFound();

  return (
    <DeviceDetail
      key={device.updatedAt}
      device={device}
      history={history}
      workspaceId={workspace.workspaceId}
      canEdit={canEditDevices(workspace.role)}
    />
  );
}
