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

export const STATUSES = ["Available", "In Use", "Hilang"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_COLORS: Record<Status, string> = {
  Available: "#4FD199",
  "In Use": "#EF9B3E",
  Hilang: "#F0664C",
};

// Display labels (English). Stored DB values stay unchanged.
const STATUS_LABELS: Record<string, string> = { Hilang: "Missing" };
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
