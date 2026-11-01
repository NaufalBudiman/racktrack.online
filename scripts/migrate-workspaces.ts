/**
 * One-off migration to workspaces (v1.1). Run BEFORE `npm run db:push`:
 *
 *   npm run db:migrate-workspaces
 *   npm run db:push            # should report no changes afterwards
 *
 * Creates the workspace tables, gives every user who owns devices a personal
 * workspace (as owner), moves their devices into it, and loosens devices.user_id
 * to "added by". Safe to re-run; everything runs in one transaction.
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
config();

const STEPS = [
  `CREATE TABLE IF NOT EXISTS "workspaces" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "created_by" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "workspaces_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null
  )`,
  `CREATE TABLE IF NOT EXISTS "workspace_members" (
    "workspace_id" uuid NOT NULL,
    "user_id" text NOT NULL,
    "role" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "workspace_members_workspace_id_user_id_pk" PRIMARY KEY ("workspace_id", "user_id"),
    CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade,
    CONSTRAINT "workspace_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade,
    CONSTRAINT "workspace_members_role_check" CHECK ("role" in ('owner', 'admin', 'editor', 'viewer'))
  )`,
  `CREATE INDEX IF NOT EXISTS "workspace_members_user_idx" ON "workspace_members" USING btree ("user_id")`,
  `CREATE TABLE IF NOT EXISTS "workspace_invites" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "workspace_id" uuid NOT NULL,
    "email" text NOT NULL,
    "role" text NOT NULL,
    "token" text NOT NULL,
    "invited_by" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    CONSTRAINT "workspace_invites_token_unique" UNIQUE ("token"),
    CONSTRAINT "workspace_invites_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade,
    CONSTRAINT "workspace_invites_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE set null,
    CONSTRAINT "workspace_invites_role_check" CHECK ("role" in ('admin', 'editor', 'viewer'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "workspace_invites_ws_email_idx" ON "workspace_invites" USING btree ("workspace_id", "email")`,

  // device_history.user_id: who made the change
  `ALTER TABLE "device_history" ADD COLUMN IF NOT EXISTS "user_id" text`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_history_user_id_user_id_fk') THEN
      ALTER TABLE "device_history" ADD CONSTRAINT "device_history_user_id_user_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null;
    END IF;
  END $$`,

  // personal workspace for every device owner that has none yet
  `ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "workspace_id" uuid`,
  `WITH owners AS (
    SELECT DISTINCT d."user_id" FROM "devices" d
    WHERE d."workspace_id" IS NULL AND d."user_id" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "workspace_members" m WHERE m."user_id" = d."user_id" AND m."role" = 'owner')
  ), ws AS (
    INSERT INTO "workspaces" ("name", "created_by")
    SELECT coalesce(nullif(split_part(u."name", ' ', 1), '') || '''s workspace', 'My workspace'), u."id"
    FROM owners o JOIN "user" u ON u."id" = o."user_id"
    RETURNING "id", "created_by"
  )
  INSERT INTO "workspace_members" ("workspace_id", "user_id", "role")
  SELECT "id", "created_by", 'owner' FROM ws`,
  `UPDATE "devices" d SET "workspace_id" = (
    SELECT m."workspace_id" FROM "workspace_members" m
    WHERE m."user_id" = d."user_id" AND m."role" = 'owner'
    ORDER BY m."created_at" LIMIT 1
  ) WHERE d."workspace_id" IS NULL`,
  `ALTER TABLE "devices" ALTER COLUMN "workspace_id" SET NOT NULL`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devices_workspace_id_workspaces_id_fk') THEN
      ALTER TABLE "devices" ADD CONSTRAINT "devices_workspace_id_workspaces_id_fk"
        FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade;
    END IF;
  END $$`,
  `CREATE INDEX IF NOT EXISTS "devices_workspace_idx" ON "devices" USING btree ("workspace_id")`,

  // devices.user_id becomes "added by": nullable, and the device survives its creator
  `ALTER TABLE "devices" ALTER COLUMN "user_id" DROP NOT NULL`,
  `ALTER TABLE "devices" DROP CONSTRAINT IF EXISTS "devices_user_id_user_id_fk"`,
  `ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null`,
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (.env.local)");
  const sql = neon(url);

  await sql.transaction(STEPS.map((s) => sql.query(s)));

  const [stats] = await sql.query(
    `SELECT (SELECT count(*) FROM "workspaces")::int AS workspaces,
            (SELECT count(*) FROM "workspace_members")::int AS members,
            (SELECT count(*) FROM "devices")::int AS devices`,
  );
  console.log(
    `Done: ${stats.workspaces} workspace(s), ${stats.members} member(s), ${stats.devices} device(s) all assigned.`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
