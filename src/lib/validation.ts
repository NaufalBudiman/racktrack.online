import { z } from "zod";
import { CATEGORIES, STATUSES } from "./categories";

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Max ${max} characters`)
    .nullish()
    .transform((v) => (v ? v : null));

const optDate = z
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

export const deviceInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name: max 120 characters"),
  serial: optText(120),
  category: z.enum(CATEGORIES, "Pick a valid type"),
  status: z.enum(STATUSES, "Pick a valid status"),
  location: optText(200),
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
});

export type DeviceInput = z.output<typeof deviceInputSchema>;
export type DeviceFormInput = z.input<typeof deviceInputSchema>;

export const idSchema = z.string().uuid("Invalid device id");
