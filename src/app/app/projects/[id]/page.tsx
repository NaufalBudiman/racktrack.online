import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getAppContext } from "@/lib/access";
import { getDb } from "@/lib/db";
import { getProject } from "@/lib/projects";
import { users, workspaceMembers } from "@/lib/schema";
import { canEditDevices, canManageMembers } from "@/lib/roles";
import { idSchema } from "@/lib/validation";
import { ProjectDetail } from "@/components/ProjectDetail";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAppContext();
  if (!ctx) redirect("/");
  const { workspace } = ctx;

  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();

  const [data, members] = await Promise.all([
    getProject(workspace.workspaceId, id.data),
    getDb()
      .select({ id: users.id, name: users.name, email: users.email })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, workspace.workspaceId))
      .orderBy(asc(users.name)),
  ]);
  if (!data) notFound();

  return (
    <ProjectDetail
      key={`${data.project.id}-${data.project.name}`}
      data={data}
      members={members.map((m) => ({ id: m.id, name: m.name ?? m.email ?? "Member" }))}
      workspaceId={workspace.workspaceId}
      canEdit={canEditDevices(workspace.role)}
      canShare={canManageMembers(workspace.role)}
    />
  );
}
