import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { tripsTable } from "./trips";
import { usersTable } from "./users";

export const tripSharesTable = pgTable("trip_shares", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => tripsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  permission: text("permission").notNull().default("view"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("uq_trip_user_share").on(t.tripId, t.userId)]);

export type TripShare = typeof tripSharesTable.$inferSelect;
