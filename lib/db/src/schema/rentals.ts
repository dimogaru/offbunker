import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tripsTable } from "./trips";

export const rentalsTable = pgTable("rentals", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => tripsTable.id, { onDelete: "cascade" }),
  company: text("company").notNull(),
  pickupLocation: text("pickup_location").notNull(),
  returnLocation: text("return_location"),
  pickupDate: timestamp("pickup_date", { withTimezone: true }).notNull(),
  returnDate: timestamp("return_date", { withTimezone: true }).notNull(),
  fuelPolicy: text("fuel_policy").notNull(),
  vehicleType: text("vehicle_type"),
  confirmationCode: text("confirmation_code"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRentalSchema = createInsertSchema(rentalsTable).omit({ id: true, createdAt: true });
export type InsertRental = z.infer<typeof insertRentalSchema>;
export type Rental = typeof rentalsTable.$inferSelect;
