/**
 * Seed script: loads seed/devices.seed.json into the oldest workspace owned by SEED_OWNER_EMAIL
 * (a personal workspace is created if they have none).
 *
 *   npm run seed            # refuses to run if that workspace already has devices
 *   npm run seed -- --append  # add on top of existing devices (still capped at 300)
 *
 * If that user has not signed in yet, the user row is created; Google login later
 * links to it by email.
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, asc, count, eq } from "drizzle-orm";
import * as schema from "../src/lib/schema";
import { MAX_DEVICES_PER_WORKSPACE } from "../src/lib/categories";
import { deviceInputSchema } from "../src/lib/validation";

config({ path: ".env.local" });
config();

type SeedHistory = { ts?: string; text?: string };
type SeedDevice = Record<string, unknown> & { history?: SeedHistory[] };

async function main() {
  const url = process.env.DATABASE_URL;
  const email = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase();
  if (!url) throw new Error("DATABASE_URL is not set (.env.local)");
  if (!email) throw new Error("SEED_OWNER_EMAIL is not set (.env.local)");
  const append = process.argv.includes("--append");

  const file = resolve(process.cwd(), "seed/devices.seed.json");
  const raw = JSON.parse(readFileSync(file, "utf8")) as SeedDevice[];
  if (!Array.isArray(raw)) throw new Error("seed/devices.seed.json must be a JSON array");

  const db = drizzle(neon(url), { schema });
  const { users, devices, deviceHistory, workspaces, workspaceMembers } = schema;

  // 1. find or create the owner
  let [owner] = await db.select().from(users).where(eq(users.email, email));
  if (!owner) {
    [owner] = await db.insert(users).values({ email }).returning();
    console.log(`Created user row for ${email} (will link on first Google sign-in).`);
  }

  // 2. find or create the owner's workspace (same naming as the app's personal workspace)
  let [membership] = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.userId, owner.id), eq(workspaceMembers.role, "owner")))
    .orderBy(asc(workspaceMembers.createdAt))
    .limit(1);
  if (!membership) {
    const first = owner.name?.trim().split(/\s+/)[0];
    const workspaceId = crypto.randomUUID();
    await db.batch([
      db.insert(workspaces).values({ id: workspaceId, name: first ? `${first}'s workspace` : "My workspace", createdBy: owner.id }),
      db.insert(workspaceMembers).values({ workspaceId, userId: owner.id, role: "owner" }),
    ]);
    membership = { workspaceId };
    console.log(`Created a workspace for ${email}.`);
  }
  const { workspaceId } = membership;

  // 3. guard against double-seeding and the per-workspace limit
  const [{ n }] = await db
    .select({ n: count() })
    .from(devices)
    .where(eq(devices.workspaceId, workspaceId));
  if (n > 0 && !append) {
    throw new Error(`${email}'s workspace already has ${n} devices. Re-run with --append to add more.`);
  }

  // 4. validate with the same schema the app uses
  const rows: { input: ReturnType<typeof deviceInputSchema.parse>; history: SeedHistory[] }[] = [];
  raw.forEach((item, i) => {
    const parsed = deviceInputSchema.safeParse(item);
    if (!parsed.success) {
      console.warn(`Skipping row ${i + 1}: ${parsed.error.issues[0]?.message}`);
      return;
    }
    rows.push({ input: parsed.data, history: Array.isArray(item.history) ? item.history : [] });
  });

  if (n + rows.length > MAX_DEVICES_PER_WORKSPACE) {
    throw new Error(
      `Would exceed the ${MAX_DEVICES_PER_WORKSPACE}-device limit (have ${n}, adding ${rows.length}).`,
    );
  }

  // 5. insert devices + history in one transaction
  const withIds = rows.map((r) => ({ ...r, id: crypto.randomUUID() }));
  const historyRows = withIds.flatMap((r) => {
    const entries = r.history.filter((h) => h.text);
    const list = entries.length ? entries : [{ text: "Imported from seed data." }];
    return list.map((h) => ({
      deviceId: r.id,
      text: h.text as string,
      // seed timestamps have no timezone; treat as Asia/Jakarta
      createdAt: h.ts ? new Date(`${h.ts}+07:00`) : new Date(),
    }));
  });

  await db.batch([
    db.insert(devices).values(withIds.map((r) => ({ ...r.input, id: r.id, workspaceId, userId: owner.id }))),
    db.insert(deviceHistory).values(historyRows),
  ]);

  console.log(`Seeded ${withIds.length} devices into ${email}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
