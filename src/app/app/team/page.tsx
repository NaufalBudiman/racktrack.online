import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getAppContext } from "@/lib/access";
import { getDb } from "@/lib/db";
import { users, workspaceInvites, workspaceMembers } from "@/lib/schema";
import { canManageMembers, effectiveDigest } from "@/lib/roles";
import { WorkspaceSettings } from "@/components/WorkspaceSettings";
import { listDevices, listPlaces } from "@/lib/devices";
import { listShareLinks } from "@/lib/shared";
import { shareableCustomers } from "@/lib/share";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/");
  const { workspace } = ctx;
  const db = getDb();
  const manage = canManageMembers(workspace.role);

  const [members, invites, sharing] = await Promise.all([
    db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        role: workspaceMembers.role,
        digest: workspaceMembers.digest,
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
    // Share links (and what they can point at) are admin-only too.
    manage
      ? Promise.all([
          listShareLinks(workspace.workspaceId),
          listDevices(workspace.workspaceId),
          listPlaces(workspace.workspaceId),
        ]).then(([links, devices, places]) => ({ links, customers: shareableCustomers(devices), places }))
      : Promise.resolve(null),
  ]);

  return (
    <WorkspaceSettings
      key={workspace.workspaceId}
      workspaceId={workspace.workspaceId}
      name={workspace.name}
      role={workspace.role}
      me={ctx.userId}
      members={members.map(({ digest: _d, ...m }) => m)}
      myDigest={effectiveDigest(
        workspace.role,
        members.find((m) => m.userId === ctx.userId)?.digest ?? null,
      )}
      invites={invites?.map((i) => ({ ...i, expiresAt: i.expiresAt.toISOString() })) ?? null}
      sharing={sharing}
    />
  );
}
