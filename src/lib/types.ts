import type { Status } from "./categories";

// Device as sent to the client (no user_id).
export type DeviceRow = {
  id: string;
  name: string;
  serial: string | null;
  category: string;
  location: string | null;
  rackPosition: string | null;
  firmwareVersion: string | null;
  status: Status;
  customer: string | null;
  contact: string | null;
  outDate: string | null;
  returnDate: string | null;
  lat: number | null;
  lng: number | null;
  condition: string | null;
  purchaseDate: string | null;
  warranty: string | null;
  notes: string | null;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

export type HistoryItem = {
  id: string;
  text: string;
  createdAt: string;
  deviceId: string;
  deviceName: string;
  by: string | null; // null for seed/import rows from before workspaces
};
