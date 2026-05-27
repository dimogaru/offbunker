import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tripsTable } from "./trips";

export const rentalsTable = pgTable("rentals", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => tripsTable.id, { onDelete: "cascade" }),

  // Transport type — discriminates which group of fields is relevant
  transportType: text("transport_type").notNull().default("Alquiler de Vehículo"),

  // ── Vehicle rental fields (nullable for non-rental transport types) ─────────
  company: text("company"),
  pickupLocation: text("pickup_location"),
  returnLocation: text("return_location"),
  pickupDate: timestamp("pickup_date", { withTimezone: true }),
  returnDate: timestamp("return_date", { withTimezone: true }),
  fuelPolicy: text("fuel_policy"),
  vehicleType: text("vehicle_type"),
  confirmationCode: text("confirmation_code"),

  // ── Train / Bus fields ───────────────────────────────────────────────────────
  originStation: text("origin_station"),
  destinationStation: text("destination_station"),
  departureDateTime: timestamp("departure_date_time", { withTimezone: true }),
  arrivalDateTime: timestamp("arrival_date_time", { withTimezone: true }),
  transportNumber: text("transport_number"),
  seatInfo: text("seat_info"),

  // ── Transfer / Other ─────────────────────────────────────────────────────────
  meetingPoint: text("meeting_point"),

  // ── Shared ───────────────────────────────────────────────────────────────────
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRentalSchema = createInsertSchema(rentalsTable).omit({ id: true, createdAt: true });
export type InsertRental = z.infer<typeof insertRentalSchema>;
export type Rental = typeof rentalsTable.$inferSelect;
