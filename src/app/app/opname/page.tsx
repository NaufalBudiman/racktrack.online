import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/access";
import { listCounts } from "@/lib/counts";
import { listPlaces } from "@/lib/devices";
import { canEditDevices } from "@/lib/roles";
import { CountList } from "@/components/CountList";

export const dynamic = "force-dynamic";

export default async function OpnamePage() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/");
  const { workspace } = ctx;

  const [counts, places] = await Promise.all([listCounts(workspace.workspaceId), listPlaces(workspace.workspaceId)]);
  return (
    <CountList
      key={workspace.workspaceId}
      counts={counts}
      places={places}
      workspaceId={workspace.workspaceId}
      canEdit={canEditDevices(workspace.role)}
    />
  );
}
