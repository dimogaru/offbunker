import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  db,
  expenseGuestsTable,
  expenseSplitsTable,
  expensesTable,
  expenseRatesTable,
  tripSharesTable,
  tripsTable,
  usersTable,
} from "@workspace/db";
import type { Trip } from "@workspace/db";
import {
  CreateExpenseBody,
  CreateExpenseGuestBody,
  CreateExpenseResponse,
  DeleteExpenseGuestParams,
  DeleteExpenseParams,
  GetExpenseLedgerParams,
  GetExpenseLedgerResponse,
  GetExpenseRatesParams,
  GetExpenseRatesResponse,
  UpdateExpenseSettingsBody,
  UpdateExpenseSettingsParams,
  UpdateExpenseSettingsResponse,
} from "@workspace/api-zod";
import {
  allocateConvertedSplits,
  convertMinorUnits,
  type ExpenseCurrency,
} from "../lib/expense-calculations.js";
import { classifyExpenseRetry } from "../lib/expense-idempotency.js";
import { loadExpenseRates, rateForExpense } from "../lib/expense-rates.js";

const router: IRouter = Router();
const POSTGRES_INT_MAX = 2_147_483_647;
type Access = { trip: Trip; permission: string };
type Participant = { id: string; name: string; kind: "user" | "guest"; active: boolean };

function accessFor(req: Request): Access | undefined {
  return (req as unknown as Record<string, unknown>).tripAccess as Access | undefined;
}

function responseForExpense(
  expense: typeof expensesTable.$inferSelect,
  splits: Array<typeof expenseSplitsTable.$inferSelect>,
) {
  const validated = CreateExpenseResponse.parse({
    id: expense.id,
    clientId: expense.clientId,
    concept: expense.concept,
    amountMinor: expense.amountMinor,
    currency: expense.currency,
    payerId: expense.payerId,
    splits: splits.map((split) => ({
      participantId: split.participantId,
      amountMinor: split.amountMinor,
      baseAmountMinor: split.baseAmountMinor,
    })),
    baseAmountMinor: expense.baseAmountMinor,
    rateToBase: expense.rateToBase,
    rateDate: new Date(`${expense.rateDate}T00:00:00.000Z`),
    createdAt: expense.createdAt,
    createdBy: expense.createdBy,
  });
  return { ...validated, rateDate: expense.rateDate };
}

async function loadStoredExpense(tripId: number, clientId: string) {
  const [expense] = await db.select().from(expensesTable).where(and(
    eq(expensesTable.tripId, tripId),
    eq(expensesTable.clientId, clientId),
  ));
  if (!expense) return undefined;
  const splits = await db.select().from(expenseSplitsTable)
    .where(eq(expenseSplitsTable.expenseId, expense.id));
  return { expense, splits };
}

async function currentParticipants(tripId: number, trip: Trip): Promise<Map<string, Participant>> {
  const result = new Map<string, Participant>();
  const memberIds = new Set<number>();
  if (trip.ownerId !== null) memberIds.add(trip.ownerId);
  const shares = await db.select({ userId: tripSharesTable.userId }).from(tripSharesTable)
    .where(eq(tripSharesTable.tripId, tripId));
  for (const share of shares) memberIds.add(share.userId);
  const users = memberIds.size > 0
    ? await db.select({ id: usersTable.id, username: usersTable.username }).from(usersTable)
      .where(inArray(usersTable.id, [...memberIds]))
    : [];
  for (const user of users) {
    result.set(`user:${user.id}`, { id: `user:${user.id}`, name: user.username, kind: "user", active: true });
  }
  const guests = await db.select().from(expenseGuestsTable).where(eq(expenseGuestsTable.tripId, tripId));
  for (const guest of guests) {
    result.set(`guest:${guest.id}`, { id: `guest:${guest.id}`, name: guest.name, kind: "guest", active: true });
  }
  return result;
}

router.get("/trips/:tripId/expense-ledger", async (req, res): Promise<void> => {
  const params = GetExpenseLedgerParams.safeParse(req.params);
  const access = accessFor(req);
  if (!params.success || !access) {
    res.status(400).json({ error: params.success ? "Trip access unavailable" : params.error.message });
    return;
  }
  const tripId = params.data.tripId;
  const [current, expenses] = await Promise.all([
    currentParticipants(tripId, access.trip),
    db.select().from(expensesTable).where(and(
      eq(expensesTable.tripId, tripId),
      isNull(expensesTable.deletedAt),
    )).orderBy(desc(expensesTable.createdAt)),
  ]);
  const expenseIds = expenses.map((expense) => expense.id);
  const splitRows = expenseIds.length
    ? await db.select().from(expenseSplitsTable).where(inArray(expenseSplitsTable.expenseId, expenseIds))
    : [];
  const splitsByExpense = new Map<number, typeof splitRows>();
  for (const split of splitRows) {
    const list = splitsByExpense.get(split.expenseId) ?? [];
    list.push(split);
    splitsByExpense.set(split.expenseId, list);
    if (!current.has(split.participantId)) {
      current.set(split.participantId, {
        id: split.participantId,
        name: split.participantNameSnapshot,
        kind: split.participantId.startsWith("guest:") ? "guest" : "user",
        active: false,
      });
    }
  }
  for (const expense of expenses) {
    if (!current.has(expense.payerId)) {
      current.set(expense.payerId, {
        id: expense.payerId,
        name: expense.payerNameSnapshot,
        kind: expense.payerId.startsWith("guest:") ? "guest" : "user",
        active: false,
      });
    }
  }
  const ledger = GetExpenseLedgerResponse.parse({
    baseCurrency: access.trip.expenseBaseCurrency,
    participants: [...current.values()],
    expenses: expenses.map((expense) => responseForExpense(expense, splitsByExpense.get(expense.id) ?? [])),
  });
  res.json({
    ...ledger,
    expenses: ledger.expenses.map((expense) => ({
      ...expense,
      rateDate: expenses.find((row) => row.id === expense.id)!.rateDate,
    })),
  });
});

router.get("/trips/:tripId/expense-rates", async (req, res): Promise<void> => {
  const params = GetExpenseRatesParams.safeParse(req.params);
  const access = accessFor(req);
  if (!params.success || !access) {
    res.status(400).json({ error: params.success ? "Trip access unavailable" : params.error.message });
    return;
  }
  try {
    const snapshot = await loadExpenseRates(access.trip.expenseBaseCurrency as ExpenseCurrency);
    const validated = GetExpenseRatesResponse.parse(snapshot);
    res.json({ ...validated, date: snapshot.date });
  } catch (error) {
    req.log.warn({ error, tripId: params.data.tripId }, "Unable to load expense exchange rates");
    res.status(503).json({ error: "Exchange-rate provider unavailable and no cached rates exist" });
  }
});

router.patch("/trips/:tripId/expense-settings", async (req, res): Promise<void> => {
  const access = accessFor(req);
  const params = UpdateExpenseSettingsParams.safeParse(req.params);
  const body = UpdateExpenseSettingsBody.safeParse(req.body);
  if (!params.success || !body.success || !access) {
    res.status(400).json({ error: !params.success ? params.error.message : !body.success ? body.error.message : "Trip access unavailable" });
    return;
  }
  if (access.permission !== "owner") {
    res.status(403).json({ error: "Only the trip owner can change expense settings" });
    return;
  }
  const updatedCurrency = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM trips WHERE id = ${params.data.tripId} FOR UPDATE`);
    const [trip] = await tx.select({
      expenseBaseCurrency: tripsTable.expenseBaseCurrency,
      expenseCurrencyLocked: tripsTable.expenseCurrencyLocked,
    }).from(tripsTable).where(eq(tripsTable.id, params.data.tripId));
    const [existing] = await tx.select({ id: expensesTable.id }).from(expensesTable)
      .where(eq(expensesTable.tripId, params.data.tripId)).limit(1);
    if (!trip) return null;
    if (trip.expenseBaseCurrency === body.data.baseCurrency) return trip.expenseBaseCurrency;
    if (existing || trip.expenseCurrencyLocked) {
      return null;
    }
    const [updatedTrip] = await tx.update(tripsTable)
      .set({ expenseBaseCurrency: body.data.baseCurrency })
      .where(eq(tripsTable.id, params.data.tripId))
      .returning({ expenseBaseCurrency: tripsTable.expenseBaseCurrency });
    return updatedTrip?.expenseBaseCurrency ?? null;
  });
  if (!updatedCurrency) {
    res.status(409).json({ error: "Base currency cannot be changed after an expense has been recorded" });
    return;
  }
  res.json(UpdateExpenseSettingsResponse.parse({ baseCurrency: updatedCurrency }));
});

router.post("/trips/:tripId/expense-guests", async (req, res): Promise<void> => {
  const access = accessFor(req);
  const body = CreateExpenseGuestBody.safeParse(req.body);
  if (!access || !body.success) {
    res.status(400).json({ error: body.success ? "Trip access unavailable" : body.error.message });
    return;
  }
  if (access.permission !== "owner") {
    res.status(403).json({ error: "Only the trip owner can manage expense guests" });
    return;
  }
  const name = body.data.name.trim();
  if (!name) {
    res.status(400).json({ error: "Guest name must not be empty" });
    return;
  }
  const creation = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM trips WHERE id = ${access.trip.id} FOR UPDATE`);
    const guests = await tx.select({ id: expenseGuestsTable.id }).from(expenseGuestsTable)
      .where(eq(expenseGuestsTable.tripId, access.trip.id));
    if (guests.length >= 12) return null;
    const [created] = await tx.insert(expenseGuestsTable)
      .values({ tripId: access.trip.id, name })
      .returning();
    return created;
  });
  if (!creation) {
    res.status(409).json({ error: "A trip can have at most 12 named expense guests" });
    return;
  }
  const guest = creation;
  res.status(201).json({ id: `guest:${guest.id}`, name: guest.name, kind: "guest" });
});

router.delete("/trips/:tripId/expense-guests/:guestId", async (req, res): Promise<void> => {
  const access = accessFor(req);
  const params = DeleteExpenseGuestParams.safeParse(req.params);
  if (!access || !params.success) {
    res.status(400).json({ error: params.success ? "Trip access unavailable" : params.error.message });
    return;
  }
  if (access.permission !== "owner") {
    res.status(403).json({ error: "Only the trip owner can manage expense guests" });
    return;
  }
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM trips WHERE id = ${params.data.tripId} FOR UPDATE`);
    const [guest] = await tx.select().from(expenseGuestsTable).where(and(
      eq(expenseGuestsTable.id, params.data.guestId),
      eq(expenseGuestsTable.tripId, params.data.tripId),
    ));
    if (!guest) return "missing" as const;
    const participantId = `guest:${guest.id}`;
    const [paidExpense] = await tx.select({ id: expensesTable.id }).from(expensesTable).where(and(
      eq(expensesTable.tripId, params.data.tripId),
      eq(expensesTable.payerId, participantId),
      isNull(expensesTable.deletedAt),
    )).limit(1);
    const [split] = await tx.select({ id: expenseSplitsTable.id })
      .from(expenseSplitsTable)
      .innerJoin(expensesTable, eq(expenseSplitsTable.expenseId, expensesTable.id))
      .where(and(
        eq(expensesTable.tripId, params.data.tripId),
        eq(expenseSplitsTable.participantId, participantId),
        isNull(expensesTable.deletedAt),
      )).limit(1);
    if (paidExpense || split) return "in-use" as const;
    await tx.delete(expenseGuestsTable).where(and(
      eq(expenseGuestsTable.id, params.data.guestId),
      eq(expenseGuestsTable.tripId, params.data.tripId),
    ));
    return "deleted" as const;
  });
  if (result === "missing") {
    res.status(404).json({ error: "Guest not found" });
    return;
  }
  if (result === "in-use") {
    res.status(409).json({ error: "Guest is referenced by recorded expenses and cannot be deleted" });
    return;
  }
  res.sendStatus(204);
});

router.post("/trips/:tripId/expenses", async (req, res): Promise<void> => {
  const access = accessFor(req);
  const params = GetExpenseLedgerParams.safeParse(req.params);
  const body = CreateExpenseBody.safeParse(req.body);
  if (!access || !params.success || !body.success) {
    res.status(400).json({ error: !params.success ? params.error.message : !body.success ? body.error.message : "Trip access unavailable" });
    return;
  }
  if (!["owner", "edit"].includes(access.permission)) {
    res.status(403).json({ error: "Only trip owners and editors can record expenses" });
    return;
  }
  const payload = body.data;
  const splits = payload.splits;
  if (
    !Number.isSafeInteger(payload.amountMinor) ||
    !splits.every((split) => Number.isSafeInteger(split.amountMinor)) ||
    !payload.concept.trim() ||
    new Set(splits.map((split) => split.participantId)).size !== splits.length ||
    splits.reduce((sum, split) => sum + BigInt(split.amountMinor), 0n) !== BigInt(payload.amountMinor)
  ) {
    res.status(400).json({ error: "Expense amounts must be positive integers and splits must be unique and sum to the total" });
    return;
  }
  if (payload.amountMinor > POSTGRES_INT_MAX || splits.some((split) => split.amountMinor > POSTGRES_INT_MAX)) {
    res.status(400).json({ error: "Expense amount exceeds the maximum supported 32-bit integer" });
    return;
  }
  const prior = await loadStoredExpense(params.data.tripId, payload.clientId);
  if (prior) {
    const disposition = classifyExpenseRetry({
      ...prior.expense,
      splits: prior.splits.map((split) => ({
        participantId: split.participantId,
        amountMinor: split.amountMinor,
      })),
    }, payload);
    if (disposition === "conflict") {
      res.status(409).json({ error: "clientId has already been used for a different expense" });
      return;
    }
    res.status(200).json(responseForExpense(prior.expense, prior.splits));
    return;
  }
  const participants = await currentParticipants(params.data.tripId, access.trip);
  const payer = participants.get(payload.payerId);
  if (!payer || splits.some((split) => !participants.has(split.participantId))) {
    res.status(400).json({ error: "Payer and split participants must be current members or trip guests" });
    return;
  }
  let rateToBase: number;
  let rateDate: string;
  try {
    if (payload.currency === access.trip.expenseBaseCurrency) {
      rateToBase = 1;
      rateDate = new Date().toISOString().slice(0, 10);
    } else {
      const snapshot = await loadExpenseRates(access.trip.expenseBaseCurrency as ExpenseCurrency);
      rateToBase = rateForExpense(snapshot, payload.currency as ExpenseCurrency);
      rateDate = snapshot.date;
    }
  } catch (error) {
    req.log.warn({ error, tripId: params.data.tripId }, "Unable to obtain rates for new expense");
    res.status(503).json({ error: "Exchange-rate provider unavailable and no cached rates exist" });
    return;
  }
  let baseAmountMinor: number;
  try {
    baseAmountMinor = convertMinorUnits(
      payload.amountMinor,
      payload.currency as ExpenseCurrency,
      access.trip.expenseBaseCurrency as ExpenseCurrency,
      rateToBase,
    );
  } catch (error) {
    req.log.warn({ error, clientId: payload.clientId }, "Converted expense amount is outside the supported integer range");
    res.status(400).json({ error: "Converted base amount exceeds the maximum supported 32-bit integer" });
    return;
  }
  if (baseAmountMinor > POSTGRES_INT_MAX) {
    res.status(400).json({ error: "Converted base amount exceeds the maximum supported 32-bit integer" });
    return;
  }
  const convertedSplits = allocateConvertedSplits(splits, payload.amountMinor, baseAmountMinor);
  if (convertedSplits.some((split) => split.baseAmountMinor > POSTGRES_INT_MAX)) {
    res.status(400).json({ error: "Converted split amount exceeds the maximum supported 32-bit integer" });
    return;
  }
  try {
    const recorded = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM trips WHERE id = ${params.data.tripId} FOR UPDATE`);
      const [trip] = await tx.select({
        expenseBaseCurrency: tripsTable.expenseBaseCurrency,
      }).from(tripsTable).where(eq(tripsTable.id, params.data.tripId));
      if (!trip || trip.expenseBaseCurrency !== access.trip.expenseBaseCurrency) {
        return { kind: "settings-changed" as const };
      }
      const guestIds = [...new Set([payload.payerId, ...splits.map((split) => split.participantId)]
        .filter((participantId) => participantId.startsWith("guest:"))
        .map((participantId) => Number(participantId.slice("guest:".length))))];
      if (guestIds.length > 0) {
        const stillActiveGuests = await tx.select({ id: expenseGuestsTable.id }).from(expenseGuestsTable)
          .where(and(
            eq(expenseGuestsTable.tripId, params.data.tripId),
            inArray(expenseGuestsTable.id, guestIds),
          ));
        if (stillActiveGuests.length !== guestIds.length) {
          return { kind: "guest-removed" as const };
        }
      }
      const [expense] = await tx.insert(expensesTable).values({
        tripId: params.data.tripId,
        clientId: payload.clientId,
        concept: payload.concept.trim(),
        amountMinor: payload.amountMinor,
        currency: payload.currency,
        payerId: payer.id,
        payerNameSnapshot: payer.name,
        baseCurrency: access.trip.expenseBaseCurrency,
        baseAmountMinor,
        rateToBase,
        rateDate,
        createdBy: req.session.userId!,
      }).returning();
      await tx.insert(expenseSplitsTable).values(convertedSplits.map((split) => ({
        expenseId: expense.id,
        participantId: split.participantId,
        participantNameSnapshot: participants.get(split.participantId)!.name,
        amountMinor: split.amountMinor,
        baseAmountMinor: split.baseAmountMinor,
      })));
      await tx.update(tripsTable).set({ expenseCurrencyLocked: true })
        .where(eq(tripsTable.id, params.data.tripId));
      return { kind: "recorded" as const, expense, splits: convertedSplits };
    });
    if (recorded.kind === "settings-changed") {
      res.status(409).json({ error: "Trip expense settings changed; retry with current settings" });
      return;
    }
    if (recorded.kind === "guest-removed") {
      res.status(400).json({ error: "A guest participant is no longer active on this trip" });
      return;
    }
    res.status(201).json(responseForExpense(recorded.expense, recorded.splits.map((split) => ({
      id: 0,
      expenseId: recorded.expense.id,
      participantId: split.participantId,
      participantNameSnapshot: participants.get(split.participantId)!.name,
      amountMinor: split.amountMinor,
      baseAmountMinor: split.baseAmountMinor,
    }))));
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      const retry = await loadStoredExpense(params.data.tripId, payload.clientId);
      if (retry) {
        const disposition = classifyExpenseRetry({
          ...retry.expense,
          splits: retry.splits.map((split) => ({
            participantId: split.participantId,
            amountMinor: split.amountMinor,
          })),
        }, payload);
        if (disposition === "conflict") {
          res.status(409).json({ error: "clientId has already been used for a different expense" });
          return;
        }
        res.status(200).json(responseForExpense(retry.expense, retry.splits));
        return;
      }
    }
    throw error;
  }
});

router.delete("/trips/:tripId/expenses/:expenseId", async (req, res): Promise<void> => {
  const access = accessFor(req);
  const params = DeleteExpenseParams.safeParse(req.params);
  if (!access || !params.success) {
    res.status(400).json({ error: params.success ? "Trip access unavailable" : params.error.message });
    return;
  }
  if (!["owner", "edit"].includes(access.permission)) {
    res.status(403).json({ error: "Only trip owners and editors can delete expenses" });
    return;
  }
  const [expense] = await db.update(expensesTable).set({ deletedAt: new Date() }).where(and(
    eq(expensesTable.id, params.data.expenseId),
    eq(expensesTable.tripId, params.data.tripId),
    isNull(expensesTable.deletedAt),
  )).returning();
  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;