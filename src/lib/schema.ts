import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";
import type { Assignment, Status } from "./categories";
import type { AssignableRole, Digest, Role } from "./roles";
import type { ShareKind } from "./share";
import type { ProjectStatus } from "./projectTypes";
import type { ReceiptItem } from "./receiptTypes";
import type { CountExpected, CountStatus } from "./countTypes";

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

// A shared inventory. Every user gets a personal one on first visit; others join by invite.
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Tanda terima (goods receipt) letterhead and defaults. See lib/receipts.ts.
  companyName: text("company_name"),
  companyCity: text("company_city"),
  receiptWa: text("receipt_wa"), // WhatsApp number the signed receipt photo goes to
  receiptFormat: text("receipt_format"), // number pattern, e.g. TT/CKI/{YYYY}/{MM}/{NNN}
  letterhead: text("letterhead"), // data: URL of the header image (small JPEG/PNG)
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<Role>().notNull(),
    // Email digest preference; null = role default (owner/admin daily, others off). See effectiveDigest().
    digest: text("digest").$type<Digest>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.userId] }),
    check("workspace_members_digest_check", sql`${t.digest} in ('daily', 'weekly', 'off')`),
    index("workspace_members_user_idx").on(t.userId),
    check("workspace_members_role_check", sql`${t.role} in ('owner', 'admin', 'editor', 'viewer')`),
  ],
);

// Invite links are bound to one email; accepting deletes the row.
export const workspaceInvites = pgTable(
  "workspace_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(), // lowercase
    role: text("role").$type<AssignableRole>().notNull(),
    token: text("token").notNull().unique(),
    invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("workspace_invites_ws_email_idx").on(t.workspaceId, t.email),
    check("workspace_invites_role_check", sql`${t.role} in ('admin', 'editor', 'viewer')`),
  ],
);

// Where stock is kept: a site (parent_id null) or a spot inside a site (rack, shelf, cabinet). Two levels max.
export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => locations.id),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("locations_workspace_idx").on(t.workspaceId)],
);

// Low-stock threshold per model. model_key = lowercased name with spaces collapsed (see modelKey()).
export const stockMinimums = pgTable(
  "stock_minimums",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    modelKey: text("model_key").notNull(),
    minStock: integer("min_stock").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.modelKey] }),
    check("stock_minimums_min_check", sql`${t.minStock} between 1 and 1000`),
  ],
);

// A project = a customer job (e.g. "UT Palembang"). `name` is the key devices.customer and device_history.project point at,
// so a rename must update those too (see renameProject). Rows are created automatically when a device is sent somewhere new.
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status").$type<ProjectStatus>().notNull().default("active"),
    picUserId: text("pic_user_id").references(() => users.id, { onDelete: "set null" }),
    city: text("city"),
    // Who receives the goods (printed on tanda terima): legal name, address, "U.p." person and phone.
    company: text("company"),
    address: text("address"),
    attnName: text("attn_name"),
    attnPhone: text("attn_phone"),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("projects_ws_name_idx").on(t.workspaceId, t.name),
    check("projects_status_check", sql`${t.status} in ('active', 'done')`),
  ],
);

// Tanda terima (goods receipt). Recipient and items are a snapshot, so a reprint matches what was signed.
export const receipts = pgTable(
  "receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    number: text("number").notNull(),
    seq: integer("seq").notNull(), // running number within the year, for {NNN}
    date: date("date", { mode: "string" }).notNull(),
    city: text("city"),
    company: text("company").notNull(),
    address: text("address"),
    attnName: text("attn_name"),
    attnPhone: text("attn_phone"),
    senderName: text("sender_name"),
    items: jsonb("items").$type<ReceiptItem[]>().notNull(),
    signedAt: timestamp("signed_at", { withTimezone: true }), // set when the signed photo came back
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("receipts_ws_number_idx").on(t.workspaceId, t.number), index("receipts_project_idx").on(t.projectId)],
);

// Read-only public links (/s/<token>), no sign-in. target = customer name, location id or device id (null for "all").
export const shareLinks = pgTable(
  "share_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    kind: text("kind").$type<ShareKind>().notNull(),
    target: text("target"),
    showCustomer: boolean("show_customer").notNull().default(true),
    showSerial: boolean("show_serial").notNull().default(true),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }), // null = never
    views: integer("views").notNull().default(0),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
  },
  (t) => [
    index("share_links_workspace_idx").on(t.workspaceId),
    check("share_links_kind_check", sql`${t.kind} in ('all', 'customer', 'location', 'device')`),
  ],
);

export const devices = pgTable(
  "devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // Who added it. Kept if that user goes away, since the device belongs to the workspace.
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    serial: text("serial"),
    category: text("category").notNull().default("Lainnya"),
    // Where it's stored (or returns to while out). `location` is the display label of location_id
    // ("Site" or "Site › Spot"), always written by the server.
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "set null" }),
    location: text("location"),
    rackPosition: text("rack_position"),
    firmwareVersion: text("firmware_version"),
    status: text("status").$type<Status>().notNull().default("Available"),
    assignment: text("assignment").$type<Assignment>(), // only while status = 'In Use'
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
    index("devices_workspace_idx").on(t.workspaceId),
    index("devices_location_idx").on(t.locationId),
    check(
      "devices_status_check",
      sql`${t.status} in ('Available', 'In Use', 'Internal', 'Faulty', 'Hilang', 'Retired')`,
    ),
    check("devices_assignment_check", sql`${t.assignment} in ('loan', 'installed')`),
  ],
);

// Written on every status/location/customer change.
export const deviceHistory = pgTable(
  "device_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }), // who made the change
    text: text("text").notNull(),
    project: text("project"), // project/customer name this change touched (to or from), for project timelines
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("device_history_device_idx").on(t.deviceId), index("device_history_project_idx").on(t.project)],
);

// Stock opname: a recount of what should be in the warehouse. `expected` is frozen at the start (devices In Stock,
// Internal Use or Faulty in the chosen site, or everywhere when location_id is null), so the result doesn't shift while
// people scan. open = scanning, review = scanning done and fixes being applied, closed = finished.
export const stockCounts = pgTable(
  "stock_counts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "set null" }),
    scope: text("scope").notNull(), // label of the area counted, kept if the location is renamed or removed
    status: text("status").$type<CountStatus>().notNull().default("open"),
    expected: jsonb("expected").$type<CountExpected[]>().notNull(),
    note: text("note"),
    startedBy: text("started_by").references(() => users.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    index("stock_counts_workspace_idx").on(t.workspaceId),
    check("stock_counts_status_check", sql`${t.status} in ('open', 'review', 'closed')`),
  ],
);

// One row per serial seen during a count (several people can scan at once). device_id is the match at scan time.
export const stockCountScans = pgTable(
  "stock_count_scans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    countId: uuid("count_id")
      .notNull()
      .references(() => stockCounts.id, { onDelete: "cascade" }),
    serial: text("serial").notNull(),
    serialKey: text("serial_key").notNull(), // lowercased, for the duplicate check
    deviceId: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),
    model: text("model"), // guessed from the label when the serial isn't in the workspace
    scannedBy: text("scanned_by").references(() => users.id, { onDelete: "set null" }),
    scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("stock_count_scans_key_idx").on(t.countId, t.serialKey)],
);
