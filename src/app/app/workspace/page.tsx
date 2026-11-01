import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getAppContext } from "@/lib/access";
import { getDb } from "@/lib/db";
import { users, workspaceInvites, workspaceMembers } from "@/lib/schema";
import { canManageMembers } from "@/lib/roles";
import { WorkspaceSettings } from "@/components/WorkspaceSettings";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/");
  const { workspace } = ctx;
  const db = getDb();
  const manage = canManageMembers(workspace.role);

  const [members, invites] = await Promise.all([
    db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        role: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, workspace.workspaceId))
      .orderBy(asc(workspaceMembers.createdAt)),
    // Invite tokens are only sent to people who may manage members.
    manage
      ? db
          .select({
            id: workspaceInvites.id,
            email: workspaceInvites.email,
            role: workspaceInvites.role,
            token: workspaceInvites.token,
            expiresAt: workspaceInvites.expiresAt,
          })
          .from(workspaceInvites)
          .where(eq(workspaceInvites.workspaceId, workspace.workspaceId))
          .orderBy(asc(workspaceInvites.createdAt))
      : Promise.resolve(null),
  ]);

  return (
    <WorkspaceSettings
      key={workspace.workspaceId}
      workspaceId={workspace.workspaceId}
      name={workspace.name}
      role={workspace.role}
      me={ctx.userId}
      members={members}
      invites={invites?.map((i) => ({ ...i, expiresAt: i.expiresAt.toISOString() })) ?? null}
    />
  );
}
