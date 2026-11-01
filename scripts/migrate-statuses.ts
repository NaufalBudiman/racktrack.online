/**
 * One-off migration to the stock-vs-customer status model (v1.2). Run BEFORE `npm run db:push`:
 *
 *   npm run db:migrate-statuses             # dry run: prints what would change
 *   npm run db:migrate-statuses -- --apply  # does it, in one transaction
 *   npm run db:push                         # should only re-create the auth-table PKs (drizzle-kit quirk)
 *
 * Stored values are never renamed; this only adds statuses and reclassifies rows:
 *   - status check allows Internal, Faulty, Retired; new `assignment` column (loan | installed)
 *   - In Use without a customer -> Internal (our own network)
 *   - In Use with a customer -> assignment = loan if it has a return date, else installed
 *   - location "Customer Side" -> empty (the customer column already says where it is)
 *   - location "Office" -> "CKI Office"
 * Every reclassified device gets a history row. Safe to re-run.
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const LOCATION_RENAMES: [from: string, to: string | null][] = [
  ["Customer Side", null],
  ["Office", "CKI Office"],
];

const SCHEMA = [
  `ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "assignment" text`,
  `ALTER TABLE "devices" DROP CONSTRAINT IF EXISTS "devices_status_check"`,
  `ALTER TABLE "devices" ADD CONSTRAINT "devices_status_check"
    CHECK ("devices"."status" in ('Available', 'In Use', 'Internal', 'Faulty', 'Hilang', 'Retired'))`,
  `ALTER TABLE "devices" DROP CONSTRAINT IF EXISTS "devices_assignment_check"`,
  `ALTER TABLE "devices" ADD CONSTRAINT "devices_assignment_check"
    CHECK ("devices"."assignment" in ('loan', 'installed'))`,
];

// Each: [preview count query, history insert, update]. History goes first so it can see the old values.
const internal = `"status" = 'In Use' AND "customer" IS NULL`;
const needsAssignment = `"status" = 'In Use' AND "customer" IS NOT NULL AND "assignment" IS NULL`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (.env.local)");
  const apply = process.argv.includes("--apply");
  const sql = neon(url);

  const hasAssignment = (
    await sql.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'assignment'`,
    )
  ).length > 0;

  const [preview] = await sql.query(
    `SELECT
      (SELECT count(*) FROM devices WHERE ${internal})::int AS to_internal,
      (SELECT count(*) FROM devices WHERE "status" = 'In Use' AND "customer" IS NOT NULL
        ${hasAssignment ? `AND "assignment" IS NULL` : ""} AND "return_date" IS NOT NULL)::int AS to_loan,
      (SELECT count(*) FROM devices WHERE "status" = 'In Use' AND "customer" IS NOT NULL
        ${hasAssignment ? `AND "assignment" IS NULL` : ""} AND "return_date" IS NULL)::int AS to_installed,
      ${LOCATION_RENAMES.map(([from], i) => `(SELECT count(*) FROM devices WHERE "location" = $${i + 1})::int AS loc_${i}`).join(", ")}`,
    LOCATION_RENAMES.map(([from]) => from),
  );
  console.log(`In Use without customer -> Internal Use: ${preview.to_internal}`);
  console.log(`At customer -> Loan (has return date):   ${preview.to_loan}`);
  console.log(`At customer -> Installed:                ${preview.to_installed}`);
  LOCATION_RENAMES.forEach(([from, to], i) =>
    console.log(`Location "${from}" -> ${to ? `"${to}"` : "empty"}: ${preview[`loc_${i}`]}`),
  );

  if (!apply) {
    console.log("\nDry run. Re-run with --apply to make these changes.");
    return;
  }

  const data = [
    `INSERT INTO "device_history" ("device_id", "text")
      SELECT "id", 'Status: In Use → Internal (reclassified: no customer)' FROM devices WHERE ${internal}`,
    `UPDATE "devices" SET "status" = 'Internal', "updated_at" = now() WHERE ${internal}`,
    `UPDATE "devices" SET "assignment" = CASE WHEN "return_date" IS NOT NULL THEN 'loan' ELSE 'installed' END
      WHERE ${needsAssignment}`,
    ...LOCATION_RENAMES.flatMap(([from, to]) => [
      `INSERT INTO "device_history" ("device_id", "text")
        SELECT "id", 'Location: ${from} → ${to ?? "—"}' FROM devices WHERE "location" = '${from}'`,
      `UPDATE "devices" SET "location" = ${to ? `'${to}'` : "NULL"}, "updated_at" = now() WHERE "location" = '${from}'`,
    ]),
  ];

  await sql.transaction([...SCHEMA, ...data].map((s) => sql.query(s)));

  const rows = await sql.query(`SELECT "status", "assignment", count(*)::int AS n FROM devices GROUP BY 1, 2 ORDER BY 1, 2`);
  console.log("\nApplied. Devices now:");
  console.table(rows);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
