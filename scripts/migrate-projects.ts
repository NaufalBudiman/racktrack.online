/**
 * One-off backfill for Projects (v1.4). Run AFTER `npm run db:push` (which adds `projects` and device_history.project):
 *
 *   npm run db:migrate-projects             # dry run: prints what would change
 *   npm run db:migrate-projects -- --apply  # does it, in one transaction
 *
 * Every customer name (on devices now, or in past history) becomes a project: Active if devices are there now,
 * else Done. Old history rows get tagged with the project they touched, parsed from their text. Safe to re-run:
 * existing projects and existing tags are left alone.
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

type Hist = { id: string; ws: string; text: string; at: string; customer: string | null; status: string; project: string | null };

/** The project a history line is about, or null. */
function tagOf(h: Hist): string | null {
  let m = h.text.match(/^Sent to (.+?) \((?:loan|installed)/);
  if (m) return m[1];
  m = h.text.match(/^(?:Returned|Found|Repaired) from (.+?) → /);
  if (m) return m[1];
  m = h.text.match(/^Customer: (.+?) → (.+?)(?: \((?:merged|from [^)]*)\))?$/);
  if (m) return m[2] !== "—" ? m[2] : m[1] !== "—" ? m[1] : null;
  // Rows that created the device (import/add) belong to where it is now.
  if (/^(Diimpor|Imported|Added|Device added)/.test(h.text) && h.customer && (h.status === "In Use" || h.status === "Hilang"))
    return h.customer;
  return null;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (.env.local)");
  const apply = process.argv.includes("--apply");
  const sql = neon(url);

  const hist = (await sql.query(
    `SELECT h.id, d.workspace_id AS ws, h.text, h.created_at::text AS at, d.customer, d.status, h.project
     FROM device_history h JOIN devices d ON d.id = h.device_id ORDER BY h.created_at`,
  )) as Hist[];
  const current = (await sql.query(
    `SELECT workspace_id AS ws, customer AS name, count(*) FILTER (WHERE status = 'In Use')::int AS here,
            min(out_date)::text AS since
     FROM devices WHERE customer IS NOT NULL AND status IN ('In Use', 'Hilang') GROUP BY 1, 2`,
  )) as { ws: string; name: string; here: number; since: string | null }[];
  const existing = new Set(
    ((await sql.query(`SELECT workspace_id AS ws, name FROM projects`)) as { ws: string; name: string }[]).map(
      (p) => `${p.ws}\u0000${p.name}`,
    ),
  );

  // project key -> { start, active }
  const found = new Map<string, { ws: string; name: string; active: boolean; start: string | null }>();
  const add = (ws: string, name: string, date: string | null, active = false) => {
    const k = `${ws}\u0000${name}`;
    const p = found.get(k) ?? { ws, name, active: false, start: null };
    p.active ||= active;
    if (date && (!p.start || date < p.start)) p.start = date;
    found.set(k, p);
  };
  for (const c of current) add(c.ws, c.name, c.since, c.here > 0);

  const tags = new Map<string, string[]>(); // project name -> history ids (only untagged rows)
  for (const h of hist) {
    const t = tagOf(h);
    if (!t) continue;
    add(h.ws, t, null); // start dates come from devices' out dates only (history dates are import days)
    if (h.project) continue;
    tags.set(t, [...(tags.get(t) ?? []), h.id]);
  }

  const toCreate = [...found.entries()].filter(([k]) => !existing.has(k)).map(([, p]) => p);
  console.log(`Projects to create: ${toCreate.length} (${toCreate.filter((p) => p.active).length} active)`);
  console.table(toCreate.map((p) => ({ name: p.name, status: p.active ? "active" : "done", start: p.start })));
  console.log(`History rows to tag: ${[...tags.values()].reduce((n, ids) => n + ids.length, 0)} of ${hist.length}`);

  if (!apply) {
    console.log("\nDry run. Re-run with --apply to make these changes.");
    return;
  }

  await sql.transaction([
    ...toCreate.map((p) =>
      sql.query(
        `INSERT INTO projects (workspace_id, name, status, start_date) VALUES ($1, $2, $3, $4)
         ON CONFLICT (workspace_id, name) DO NOTHING`,
        [p.ws, p.name, p.active ? "active" : "done", p.start],
      ),
    ),
    ...[...tags.entries()].map(([name, ids]) =>
      sql.query(`UPDATE device_history SET project = $1 WHERE id = ANY($2::uuid[]) AND project IS NULL`, [name, ids]),
    ),
  ]);
  const [after] = await sql.query(
    `SELECT (SELECT count(*) FROM projects)::int AS projects,
            (SELECT count(*) FROM device_history WHERE project IS NOT NULL)::int AS tagged`,
  );
  console.log("\nApplied:", after);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
