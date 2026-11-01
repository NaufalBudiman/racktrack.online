import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/access";
import { listHistory } from "@/lib/devices";
import { Timeline } from "@/components/Timeline";

export const dynamic = "force-dynamic";

const LIMIT = 200;

export default async function ActivityPage() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/");
  const { workspace } = ctx;

  const history = await listHistory(workspace.workspaceId, { limit: LIMIT });

  return (
    <div className="space-y-4">
      <div className="mb-5">
        <div className="eyebrow">Activity</div>
        <h1 className="mt-1.5 break-words font-mono text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{workspace.name}</h1>
        <p className="mt-2 text-sm text-[#BAC3CF]">
          Devices added, imported, and every status, location or customer change.
          {history.length === LIMIT && ` Showing the latest ${LIMIT}.`}
        </p>
      </div>
      <section className="lg lg-dark rounded-[22px] p-5">
        <Timeline items={history} showDevice />
      </section>
    </div>
  );
}
