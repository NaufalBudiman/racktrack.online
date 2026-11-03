// Read-only share links (client-safe). See shareLinks in schema.ts and lib/shared.ts for the public read.
import type { Assignment, Status } from "./categories";

export const SHARE_KINDS = ["all", "customer", "location", "device"] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];
export const SHARE_KIND_LABELS: Record<ShareKind, string> = {
  all: "Whole inventory",
  customer: "One project",
  location: "One location",
  device: "One device",
};

export const SHARE_EXPIRY = { "7": "7 days", "30": "30 days", never: "Never" } as const;
export type ShareExpiry = keyof typeof SHARE_EXPIRY;
export const MAX_SHARE_LINKS = 50; // per workspace

/** What a shared page may show. Never notes, contact, firmware, purchase or warranty details. */
export type PublicDevice = {
  id: string;
  name: string;
  serial: string | null; // null when hidden
  category: string;
  status: Status;
  location: string | null;
  rackPosition: string | null;
  customer: string | null; // null when hidden
  assignment: Assignment | null;
  outDate: string | null;
  returnDate: string | null;
};

/** One row in the Team page list (target already turned into a readable name). */
export type ShareLinkRow = {
  id: string;
  token: string;
  kind: ShareKind;
  title: string;
  showCustomer: boolean;
  showSerial: boolean;
  createdAt: string;
  expiresAt: string | null;
  views: number;
  lastViewedAt: string | null;
  by: string | null;
};

/** Customers a "one customer" link can point at: those with devices out or missing there now. */
export function shareableCustomers(devices: { customer: string | null; status: Status }[]): string[] {
  const set = new Set<string>();
  for (const d of devices) if (d.customer && (d.status === "In Use" || d.status === "Hilang")) set.add(d.customer);
  return [...set].sort((a, b) => a.localeCompare(b));
}
