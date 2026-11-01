// Single source of truth for categories, groups and statuses.

export const MAX_DEVICES_PER_WORKSPACE = 300;

export const GROUPS = ["Wireless", "Networking", "Lainnya"] as const;
export type Group = (typeof GROUPS)[number];

export const CATEGORIES = [
  "Wireless",
  "POE Injektor",
  "Access Controller",
  "Switch",
  "Router",
  "Server",
  "Sparepart Server",
  "Firewall",
  "Lainnya",
] as const;
export type Category = (typeof CATEGORIES)[number];

// Groups are derived from category in code (not stored in the DB).
export const CATEGORY_GROUPS: Record<Group, readonly Category[]> = {
  Wireless: ["Wireless", "POE Injektor", "Access Controller"],
  Networking: ["Switch", "Router", "Server", "Sparepart Server", "Firewall"],
  Lainnya: ["Lainnya"],
};

export function groupOf(category: string): Group {
  for (const g of GROUPS) {
    if ((CATEGORY_GROUPS[g] as readonly string[]).includes(category)) return g;
  }
  return "Lainnya";
}

export const GROUP_COLORS: Record<Group, string> = {
  Wireless: "#5DC9E0",
  Networking: "#9B8CF2",
  Lainnya: "#8B97A8",
};

// Stored values never get renamed (labels below are what users see):
//   Available = in stock at the office, ready to use
//   In Use    = at a customer (customer required; assignment = loan or installed)
//   Internal  = used on our own network
//   Faulty    = broken / RMA, not usable
//   Hilang    = missing
//   Retired   = sold or written off, kept for the record
export const STATUSES = ["Available", "In Use", "Internal", "Faulty", "Hilang", "Retired"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_COLORS: Record<Status, string> = {
  Available: "#4FD199",
  "In Use": "#EF9B3E",
  Internal: "#5DC9E0",
  Faulty: "#F2C14E",
  Hilang: "#F0664C",
  Retired: "#8B97A8",
};

export const STATUS_HINTS: Record<Status, string> = {
  Available: "In the office, ready to use",
  "In Use": "With a customer",
  Internal: "Used on our own network",
  Faulty: "Broken or out for repair",
  Hilang: "Can't be found",
  Retired: "Sold or written off",
};

// At a customer: a loan comes back (return date required), an install stays.
export const ASSIGNMENTS = ["loan", "installed"] as const;
export type Assignment = (typeof ASSIGNMENTS)[number];
export const ASSIGNMENT_LABELS: Record<Assignment, string> = { loan: "Loan", installed: "Installed" };

// Display labels (English). Stored DB values stay unchanged.
const STATUS_LABELS: Record<string, string> = {
  Available: "In Stock",
  "In Use": "At Customer",
  Internal: "Internal Use",
  Hilang: "Missing",
};
const GROUP_LABELS: Record<string, string> = { Lainnya: "Others" };
const CATEGORY_LABELS: Record<string, string> = {
  "POE Injektor": "PoE Injector",
  "Sparepart Server": "Server Spare Part",
  Lainnya: "Other",
};
export const statusLabel = (s: string) => STATUS_LABELS[s] ?? s;
export const groupLabel = (g: string) => GROUP_LABELS[g] ?? g;
export const categoryLabel = (c: string) => CATEGORY_LABELS[c] ?? c;

export function limitMessage(current: number): string {
  return `Device limit reached: a workspace can hold up to ${MAX_DEVICES_PER_WORKSPACE} devices (you have ${current}). Delete some devices to add more.`;
}

// History text embeds stored status values ("Status: Available → Hilang"); show the labels instead.
const STATUS_IN_TEXT = /\b(In Use|Available|Internal|Hilang)\b/g;
export const historyLabel = (text: string) =>
  text.startsWith("Status:") ? text.replace(STATUS_IN_TEXT, (m) => statusLabel(m)) : text;
