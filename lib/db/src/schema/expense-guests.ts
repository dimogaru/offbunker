import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { tripsTable } from "./trips";

export const expenseGuestsTable = pgTable("expense_guests", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => tripsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ExpenseGuest = typeof expenseGuestsTable.$inferSelect;