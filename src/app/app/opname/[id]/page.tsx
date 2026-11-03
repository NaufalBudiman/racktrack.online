import { notFound, redirect } from "next/navigation";
import { getAppContext } from "@/lib/access";
import { getCount } from "@/lib/counts";
import { listDevices, listPlaces } from "@/lib/devices";
import { canEditDevices, canManageMembers } from "@/lib/roles";
import { idSchema } from "@/lib/validation";
import { CountView } from "@/components/CountView";

export const dynamic = "force-dynamic";

export default async function CountPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAppContext();
  if (!ctx) redirect("/");
  const { workspace } = ctx;
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();

  const [count, devices, places] = await Promise.all([
    getCount(workspace.workspaceId, id.data),
    listDevices(workspace.workspaceId),
    listPlaces(workspace.workspaceId),
  ]);
  if (!count) notFound();
  return (
    <CountView
      key={count.id}
      count={count}
      devices={devices}
      places={places}
      workspaceId={workspace.workspaceId}
      canEdit={canEditDevices(workspace.role)}
      canDelete={canManageMembers(workspace.role)}
    />
  );
}
