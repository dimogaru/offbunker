import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tripsTable } from "./trips";

export const baggageItemsTable = pgTable("baggage_items", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => tripsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  isChecked: boolean("is_checked").notNull().default(false),
  isLastMinute: boolean("is_last_minute").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBaggageItemSchema = createInsertSchema(baggageItemsTable).omit({ id: true, createdAt: true });
export type InsertBaggageItem = z.infer<typeof insertBaggageItemSchema>;
export type BaggageItem = typeof baggageItemsTable.$inferSelect;
