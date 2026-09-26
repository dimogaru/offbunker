import { desc, eq } from "drizzle-orm";
import { db, expenseRatesTable } from "@workspace/db";
import { EXPENSE_CURRENCIES, getRateToBase, type ExpenseCurrency } from "./expense-calculations.js";

export interface ExpenseRateSnapshot {
  baseCurrency: ExpenseCurrency;
  date: string;
  rates: Record<string, number>;
}

const dailyCache = new Map<string, ExpenseRateSnapshot>();

function toSnapshot(row: { baseCurrency: string; rateDate: string; rates: Record<string, number> }): ExpenseRateSnapshot {
  return {
    baseCurrency: row.baseCurrency as ExpenseCurrency,
    date: row.rateDate,
    rates: row.rates,
  };
}

export async function loadExpenseRates(baseCurrency: ExpenseCurrency): Promise<ExpenseRateSnapshot> {
  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `${baseCurrency}:${today}`;
  const memorySnapshot = dailyCache.get(cacheKey);
  if (memorySnapshot) return memorySnapshot;

  const [todaySnapshot] = await db.select().from(expenseRatesTable).where(
    eq(expenseRatesTable.baseCurrency, baseCurrency),
  ).orderBy(desc(expenseRatesTable.rateDate)).limit(1);
  if (todaySnapshot?.createdAt.toISOString().slice(0, 10) === today) {
    const snapshot = toSnapshot(todaySnapshot);
    dailyCache.set(cacheKey, snapshot);
    return snapshot;
  }

  try {
    const response = await fetch(`https://api.frankfurter.dev/v1/latest?base=${baseCurrency}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Frankfurter returned HTTP ${response.status}`);
    const result = await response.json() as { date?: unknown; rates?: unknown };
    if (
      typeof result.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(result.date) ||
      result.rates === null ||
      typeof result.rates !== "object"
    ) throw new Error("Frankfurter returned an invalid rate snapshot");

    const providerRates = result.rates as Record<string, number>;
    const rates: Record<string, number> = { [baseCurrency]: 1 };
    for (const currency of EXPENSE_CURRENCIES) {
      if (currency !== baseCurrency) {
        rates[currency] = getRateToBase(currency, baseCurrency, providerRates);
      }
    }
    const [persisted] = await db.insert(expenseRatesTable).values({
      baseCurrency,
      rateDate: result.date,
      rates,
    }).onConflictDoUpdate({
      target: [expenseRatesTable.baseCurrency, expenseRatesTable.rateDate],
      set: { rates },
    }).returning();
    const snapshot = toSnapshot(persisted);
    dailyCache.set(cacheKey, snapshot);
    return snapshot;
  } catch (error) {
    const [latest] = await db.select().from(expenseRatesTable)
      .where(eq(expenseRatesTable.baseCurrency, baseCurrency))
      .orderBy(desc(expenseRatesTable.rateDate))
      .limit(1);
    if (latest) {
      const snapshot = toSnapshot(latest);
      dailyCache.set(cacheKey, snapshot);
      return snapshot;
    }
    throw new Error("Exchange-rate provider unavailable and no cached rates exist", { cause: error });
  }
}

export function rateForExpense(snapshot: ExpenseRateSnapshot, currency: ExpenseCurrency): number {
  const rate = snapshot.rates[currency];
  if (!Number.isFinite(rate) || rate <= 0) throw new Error(`Exchange rate for ${currency} is unavailable`);
  return Number(rate.toFixed(12));
}