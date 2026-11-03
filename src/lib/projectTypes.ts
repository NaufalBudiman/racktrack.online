// Projects (client-safe). A project is a customer job; its name is what devices.customer holds.
import type { DeviceRow, HistoryItem } from "./types";

export const PROJECT_STATUSES = ["active", "done"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = { active: "Active", done: "Done" };

export type ProjectRow = {
  id: string;
  name: string;
  status: ProjectStatus;
  city: string | null;
  pic: string | null; // PIC display name
  picUserId: string | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  now: number; // devices there now (At Customer)
  missing: number; // went missing there
  used: number; // distinct devices ever sent there
  overdueCandidates: { returnDate: string }[]; // loans there now, for client-side overdue (needs local date)
  lastActivity: string | null; // ISO
};

export type ProjectDetailData = {
  project: ProjectRow;
  current: DeviceRow[]; // there now (In Use + Missing there)
  returned: DeviceRow[]; // used here before, now elsewhere
  history: HistoryItem[];
};
