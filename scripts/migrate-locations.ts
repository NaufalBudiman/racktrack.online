/**
 * One-off migration to structured locations (v1.3). Run BEFORE `npm run db:push`:
 *
 *   npm run db:migrate-locations             # dry run: prints what would change
 *   npm run db:migrate-locations -- --apply  # does it, in one transaction
 *   npm run db:push                          # should only re-create the auth-table PKs (drizzle-kit quirk)
 *
 * Creates the `locations` table and devices.location_id, turns every distinct free-text location in a
 * workspace into a site (case-insensitive), and links devices to it. Labels stay the same. Safe to re-run.
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS "locations" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "workspace_id" uuid NOT NULL,
    "parent_id" uuid,
    "name" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "locations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade,
    CONSTRAINT "locations_parent_id_locations_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."locations"("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "locations_workspace_idx" ON "locations" USING btree ("workspace_id")`,
  `ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "location_id" uuid`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devices_location_id_locations_id_fk') THEN
      ALTER TABLE "devices" ADD CONSTRAINT "devices_location_id_locations_id_fk"
        FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null;
    END IF;
  END $$`,
  `CREATE INDEX IF NOT EXISTS "devices_location_idx" ON "devices" USING btree ("location_id")`,
];

// One site per distinct (workspace, lower(trimmed text)); the most used spelling wins as the name.
const DATA = [
  `INSERT INTO "locations" ("workspace_id", "name")
    SELECT DISTINCT ON (d."workspace_id", lower(trim(d."location"))) d."workspace_id", trim(d."location")
    FROM "devices" d
    WHERE d."location" IS NOT NULL AND trim(d."location") <> ''
      AND NOT EXISTS (
        SELECT 1 FROM "locations" l
        WHERE l."workspace_id" = d."workspace_id" AND l."parent_id" IS NULL AND lower(l."name") = lower(trim(d."location"))
      )
    ORDER BY d."workspace_id", lower(trim(d."location")),
      (SELECT count(*) FROM "devices" x WHERE x."workspace_id" = d."workspace_id" AND x."location" = d."location") DESC`,
  `UPDATE "devices" d SET "location_id" = l."id", "location" = l."name"
    FROM "locations" l
    WHERE d."location_id" IS NULL AND d."location" IS NOT NULL
      AND l."workspace_id" = d."workspace_id" AND l."parent_id" IS NULL AND lower(l."name") = lower(trim(d."location"))`,
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (.env.local)");
  const apply = process.argv.includes("--apply");
  const sql = neon(url);

  const preview = await sql.query(
    `SELECT trim("location") AS name, count(*)::int AS devices FROM "devices"
     WHERE "location" IS NOT NULL AND trim("location") <> '' GROUP BY 1 ORDER BY 2 DESC`,
  );
  const [none] = await sql.query(`SELECT count(*)::int AS n FROM "devices" WHERE "location" IS NULL OR trim("location") = ''`);
  console.log("Sites to create (or reuse), with devices linked:");
  console.table(preview);
  console.log(`Devices without a location (left empty): ${none.n}`);

  if (!apply) {
    console.log("\nDry run. Re-run with --apply to make these changes.");
    return;
  }

  await sql.transaction([...SCHEMA, ...DATA].map((s) => sql.query(s)));
  const [after] = await sql.query(
    `SELECT (SELECT count(*) FROM "locations")::int AS locations,
            (SELECT count(*) FROM "devices" WHERE "location_id" IS NOT NULL)::int AS linked,
            (SELECT count(*) FROM "devices" WHERE "location" IS NOT NULL AND "location_id" IS NULL)::int AS unlinked`,
  );
  console.log("\nApplied:", after);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
