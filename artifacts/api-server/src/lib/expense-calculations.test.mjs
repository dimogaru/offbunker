import assert from "node:assert/strict";
import test from "node:test";
import {
  allocateConvertedSplits,
  convertMinorUnits,
  getRateToBase,
} from "./expense-calculations.ts";
import { classifyExpenseRetry } from "./expense-idempotency.ts";

test("converts currency minor units with ISO exponents and half-up rounding", () => {
  assert.equal(convertMinorUnits(100, "USD", "EUR", 0.9), 90);
  assert.equal(convertMinorUnits(99, "USD", "JPY", 150), 149);
  assert.equal(convertMinorUnits(1234, "JPY", "EUR", 1.5), 185100);
});

test("allocates rounding remainder deterministically and exactly", () => {
  const parts = [
    { participantId: "user:3", amountMinor: 1 },
    { participantId: "user:2", amountMinor: 1 },
    { participantId: "user:1", amountMinor: 1 },
  ];
  const allocated = allocateConvertedSplits(parts, 3, 2);
  assert.deepEqual(allocated.map(({ participantId, baseAmountMinor }) => [participantId, baseAmountMinor]), [
    ["user:3", 0],
    ["user:2", 1],
    ["user:1", 1],
  ]);
  assert.equal(allocated.reduce((sum, part) => sum + part.baseAmountMinor, 0), 2);
});

test("converts provider base-to-source rates to source-to-base", () => {
  assert.equal(getRateToBase("USD", "EUR", { USD: 1.25 }), 0.8);
  assert.equal(getRateToBase("EUR", "EUR", {}), 1);
});

test("create-delete-retry acknowledges a tombstone without recreating the expense", () => {
  const request = {
    concept: "Taxi",
    amountMinor: 2400,
    currency: "EUR",
    payerId: "user:1",
    splits: [{ participantId: "user:1", amountMinor: 2400 }],
  };
  const records = new Map([["trip-1/client-1", { ...request, deletedAt: null }]]);
  const stored = records.get("trip-1/client-1");
  assert.equal(classifyExpenseRetry(stored, request), "active-match");

  stored.deletedAt = new Date("2025-01-02T00:00:00.000Z");
  assert.equal(classifyExpenseRetry(stored, request), "deleted-match");
  assert.equal(records.size, 1);
  assert.equal(classifyExpenseRetry(stored, { ...request, amountMinor: 2401 }), "conflict");
});