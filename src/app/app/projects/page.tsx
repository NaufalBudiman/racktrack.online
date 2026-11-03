import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/access";
import { listProjects } from "@/lib/projects";
import { canEditDevices, canManageMembers } from "@/lib/roles";
import { ProjectList } from "@/components/ProjectList";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/");
  const { workspace } = ctx;

  const projects = await listProjects(workspace.workspaceId);
  return (
    <ProjectList
      key={workspace.workspaceId}
      projects={projects}
      workspaceName={workspace.name}
      workspaceId={workspace.workspaceId}
      canEdit={canEditDevices(workspace.role)}
      canShare={canManageMembers(workspace.role)}
    />
  );
}
