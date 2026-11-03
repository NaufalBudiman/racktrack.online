import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getAppContext } from "@/lib/access";
import { getDb } from "@/lib/db";
import { getProject } from "@/lib/projects";
import { getReceiptSettings, suggestReceiptNumber } from "@/lib/receipts";
import { users } from "@/lib/schema";
import { canEditDevices } from "@/lib/roles";
import { idSchema } from "@/lib/validation";
import { ReceiptForm } from "@/components/ReceiptForm";

export const dynamic = "force-dynamic";

// Today in WIB, so the default date doesn't flip at 07:00 like UTC would.
const todayWib = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

export default async function NewReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAppContext();
  if (!ctx) redirect("/");
  const { workspace } = ctx;
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();
  if (!canEditDevices(workspace.role)) redirect(`/app/projects/${id.data}`);

  const date = todayWib();
  const [data, settings, [me]] = await Promise.all([
    getProject(workspace.workspaceId, id.data),
    getReceiptSettings(workspace.workspaceId),
    getDb().select({ name: users.name }).from(users).where(eq(users.id, ctx.userId)),
  ]);
  if (!data) notFound();
  const suggested = await suggestReceiptNumber(workspace.workspaceId, settings.receiptFormat, date);

  return (
    <ReceiptForm
      workspaceId={workspace.workspaceId}
      project={data.project}
      devices={data.current.filter((d) => d.status === "In Use")}
      defaults={{
        date,
        city: settings.companyCity ?? "",
        senderName: data.project.pic ?? me?.name ?? "",
        suggestedNumber: suggested,
      }}
      settingsMissing={!settings.letterhead && !settings.companyName}
      canSetup={workspace.role === "owner" || workspace.role === "admin"}
    />
  );
}
