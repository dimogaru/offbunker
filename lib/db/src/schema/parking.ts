import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tripsTable } from "./trips";

export const parkingTable = pgTable("parking", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => tripsTable.id, { onDelete: "cascade" }),
  location: text("location").notNull(),
  reservationCode: text("reservation_code").notNull(),
  entryDate: timestamp("entry_date", { withTimezone: true }).notNull(),
  exitDate: timestamp("exit_date", { withTimezone: true }).notNull(),
  priceTotal: numeric("price_total", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertParkingSchema = createInsertSchema(parkingTable).omit({ id: true, createdAt: true });
export type InsertParking = z.infer<typeof insertParkingSchema>;
export type Parking = typeof parkingTable.$inferSelect;
