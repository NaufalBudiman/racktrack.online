import { z } from "zod";
import { ASSIGNMENTS, CATEGORIES, STATUSES } from "./categories";

export const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Max ${max} characters`)
    .nullish()
    .transform((v) => (v ? v : null));

export const optDate = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))
  .refine(
    (v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v))),
    "Dates must be YYYY-MM-DD",
  );

const optNum = (min: number, max: number, label: string) =>
  z
    .union([z.number(), z.string()])
    .nullish()
    .transform((v) => (v === undefined || v === null || v === "" ? null : Number(v)))
    .refine(
      (v) => v === null || (Number.isFinite(v) && v >= min && v <= max),
      `${label} must be a number between ${min} and ${max}`,
    );

// Fields that only make sense while a device is at a customer.
const CUSTOMER_FIELDS = { assignment: null, customer: null, contact: null, outDate: null, returnDate: null } as const;

export const deviceInputSchema = z
  .object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name: max 120 characters"),
  serial: optText(120),
  category: z.enum(CATEGORIES, "Pick a valid type"),
  status: z.enum(STATUSES, "Pick a valid status"),
  location: optText(200), // free text, only used when locationId is absent (imports)
  // undefined = not sent (fall back to text), "" / null = no location, uuid = a place in this workspace
  locationId: z
    .union([z.string().uuid(), z.literal("")])
    .nullish()
    .transform((v) => (v === undefined ? undefined : v || null)),
  rackPosition: optText(80),
  firmwareVersion: optText(80),
  customer: optText(200),
  contact: optText(200),
  outDate: optDate,
  returnDate: optDate,
  lat: optNum(-90, 90, "Latitude"),
  lng: optNum(-180, 180, "Longitude"),
  condition: optText(200),
  purchaseDate: optDate,
  warranty: optText(200),
  notes: optText(4000),
  assignment: z
    .union([z.enum(ASSIGNMENTS), z.literal("")], "Pick Loan or Installed")
    .nullish()
    .transform((v) => v || null),
})
  .superRefine((d, ctx) => {
    if (d.status !== "In Use") return;
    if (!d.customer) ctx.addIssue({ code: "custom", path: ["customer"], message: "Customer is required for a device at a customer" });
    if (!d.assignment) ctx.addIssue({ code: "custom", path: ["assignment"], message: "Pick Loan or Installed" });
    if (d.assignment === "loan" && !d.returnDate)
      ctx.addIssue({ code: "custom", path: ["returnDate"], message: "A loan needs a return date" });
  })
  // Keeps stock and customer data apart: only devices at a customer carry customer details.
  // Missing devices keep them, since "lost at customer X" is worth knowing.
  .transform((d) => {
    if (d.status === "In Use") return d;
    if (d.status === "Hilang") return { ...d, assignment: null };
    return { ...d, ...CUSTOMER_FIELDS };
  });

export type DeviceInput = z.output<typeof deviceInputSchema>;
export type DeviceFormInput = z.input<typeof deviceInputSchema>;

export const idSchema = z.string().uuid("Invalid device id");

// Status moves from the device action buttons. The server merges them into the device and
// re-validates with deviceInputSchema, so the stock-vs-customer rules still hold.
const note = optText(500);

export const moveSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("checkout"),
    customer: z.string().trim().min(1, "Customer is required").max(200, "Customer: max 200 characters"),
    contact: optText(200),
    assignment: z.enum(ASSIGNMENTS, "Pick Loan or Installed"),
    outDate: optDate,
    returnDate: optDate,
    note,
  }),
  z.object({
    type: z.literal("checkin"),
    result: z.enum(["Available", "Faulty"], "Pick the condition"),
    locationId: z.union([z.string().uuid(), z.literal("")]).nullish().transform((v) => v || null),
    note,
  }),
  z.object({
    type: z.literal("relocate"), // same status, different shelf (stock opname)
    locationId: z.union([z.string().uuid(), z.literal("")]).nullish().transform((v) => v || null),
    note,
  }),
  z.object({
    type: z.literal("status"),
    status: z.enum(["Internal", "Faulty", "Hilang", "Retired"], "Pick a valid status"),
    note,
  }),
]);

export type MoveInput = z.input<typeof moveSchema>;
