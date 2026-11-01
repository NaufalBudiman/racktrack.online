// Workspace roles and limits (client-safe).

export const ROLES = ["owner", "admin", "editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

// Roles that can be handed out by invite or role change (there is exactly one owner).
export const ASSIGNABLE_ROLES = ["admin", "editor", "viewer"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 };

export const atLeast = (role: Role, min: Role) => RANK[role] >= RANK[min];
export const canEditDevices = (role: Role) => atLeast(role, "editor");
export const canManageMembers = (role: Role) => atLeast(role, "admin");

// You can grant up to your own role, and only manage people ranked below you.
export const canGrant = (actor: Role, role: Role) => role !== "owner" && RANK[role] <= RANK[actor];
export const outranks = (actor: Role, target: Role) => RANK[actor] > RANK[target];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

export const ROLE_HINTS: Record<AssignableRole, string> = {
  admin: "Edit devices and manage members",
  editor: "Add, edit, delete and import devices",
  viewer: "Read only",
};

export const MAX_OWNED_WORKSPACES = 5;
export const MAX_MEMBERS_PER_WORKSPACE = 50; // members + pending invites
export const INVITE_TTL_DAYS = 7;
