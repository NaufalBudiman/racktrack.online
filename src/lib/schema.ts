import {
  check,
  date,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";
import type { Status } from "./categories";

/* ---------- Auth.js (Drizzle adapter) tables ---------- */

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

// Sessions use the JWT strategy (so middleware works on the edge); this table
// exists because the adapter expects it.
export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

/* ---------- RackTrack tables ---------- */

export const devices = pgTable(
  "devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    serial: text("serial"),
    category: text("category").notNull().default("Lainnya"),
    location: text("location"),
    rackPosition: text("rack_position"),
    firmwareVersion: text("firmware_version"),
    status: text("status").$type<Status>().notNull().default("Available"),
    customer: text("customer"),
    contact: text("contact"),
    outDate: date("out_date", { mode: "string" }),
    returnDate: date("return_date", { mode: "string" }),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    condition: text("condition"),
    purchaseDate: date("purchase_date", { mode: "string" }),
    warranty: text("warranty"),
    notes: text("notes"),
    photoUrl: text("photo_url"), // unused in v1.0
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("devices_user_idx").on(t.userId),
    check(
      "devices_status_check",
      sql`${t.status} in ('Available', 'In Use', 'Hilang')`,
    ),
  ],
);

// Written on every status/location/customer change; UI comes in v1.2.
export const deviceHistory = pgTable(
  "device_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("device_history_device_idx").on(t.deviceId)],
);
