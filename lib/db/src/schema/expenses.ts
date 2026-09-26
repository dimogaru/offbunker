import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  date,
  numeric,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { tripsTable } from "./trips";

export const expenseRatesTable = pgTable("expense_rate_snapshots", {
  id: serial("id").primaryKey(),
  baseCurrency: text("base_currency").notNull(),
  rateDate: date("rate_date", { mode: "string" }).notNull(),
  rates: jsonb("rates").$type<Record<string, number>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [unique("uq_expense_rates_base_date").on(table.baseCurrency, table.rateDate)]);

export const expensesTable = pgTable("trip_expenses", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => tripsTable.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull(),
  concept: text("concept").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull(),
  payerId: text("payer_id").notNull(),
  payerNameSnapshot: text("payer_name_snapshot").notNull(),
  baseCurrency: text("base_currency").notNull(),
  baseAmountMinor: integer("base_amount_minor").notNull(),
  rateToBase: numeric("rate_to_base", { precision: 24, scale: 12, mode: "number" }).notNull(),
  rateDate: date("rate_date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdBy: integer("created_by").notNull(),
}, (table) => [unique("uq_trip_expense_client_id").on(table.tripId, table.clientId)]);

export const expenseSplitsTable = pgTable("trip_expense_splits", {
  id: serial("id").primaryKey(),
  expenseId: integer("expense_id").notNull().references(() => expensesTable.id, { onDelete: "cascade" }),
  participantId: text("participant_id").notNull(),
  participantNameSnapshot: text("participant_name_snapshot").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  baseAmountMinor: integer("base_amount_minor").notNull(),
}, (table) => [unique("uq_expense_split_participant").on(table.expenseId, table.participantId)]);

export type Expense = typeof expensesTable.$inferSelect;
export type ExpenseSplit = typeof expenseSplitsTable.$inferSelect;
export type ExpenseRateSnapshot = typeof expenseRatesTable.$inferSelect;