import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateExpenseSettlement,
  calculateMinimumSettlementTransfers,
} from "./settlement.ts";

function assertDirectAndSettled(balances, transfers) {
  const original = new Map(balances.map(({ participantId, balanceMinor }) => [participantId, balanceMinor]));
  const remaining = new Map(original);
  for (const { payerId, receiverId, amountMinor } of transfers) {
    assert.ok(original.get(payerId) < 0, `${payerId} must be an original debtor`);
    assert.ok(original.get(receiverId) > 0, `${receiverId} must be an original creditor`);
    assert.ok(Number.isSafeInteger(amountMinor) && amountMinor > 0);
    remaining.set(payerId, remaining.get(payerId) + amountMinor);
    remaining.set(receiverId, remaining.get(receiverId) - amountMinor);
  }
  for (const balance of remaining.values()) assert.equal(balance, 0);
}

test("IreneGR and DiegoGD2 each pay DiegoGD directly", () => {
  const balances = [
    { participantId: "DiegoGD", balanceMinor: 4163 },
    { participantId: "IreneGR", balanceMinor: -2082 },
    { participantId: "DiegoGD2", balanceMinor: -2081 },
  ];
  const transfers = calculateMinimumSettlementTransfers(balances);
  assert.deepEqual(transfers, [
    { payerId: "DiegoGD2", receiverId: "DiegoGD", amountMinor: 2081 },
    { payerId: "IreneGR", receiverId: "DiegoGD", amountMinor: 2082 },
  ]);
  assertDirectAndSettled(balances, transfers);
});

test("a residual that changes sign never becomes a payment intermediary", () => {
  const balances = [
    { participantId: "A", balanceMinor: 500 },
    { participantId: "B", balanceMinor: 500 },
    { participantId: "C", balanceMinor: -600 },
    { participantId: "D", balanceMinor: -400 },
  ];
  const transfers = calculateMinimumSettlementTransfers(balances);
  assert.equal(transfers.length, 3);
  assertDirectAndSettled(balances, transfers);
});

test("independent zero-sum groups still need only two direct payments", () => {
  const balances = [
    { participantId: "A", balanceMinor: 100 },
    { participantId: "B", balanceMinor: -100 },
    { participantId: "C", balanceMinor: 50 },
    { participantId: "D", balanceMinor: -50 },
  ];
  const transfers = calculateMinimumSettlementTransfers(balances);
  assert.equal(transfers.length, 2);
  assertDirectAndSettled(balances, transfers);
});

test("balances derived from original expenses use the same direct settlement", () => {
  const result = calculateExpenseSettlement([
    {
      payerId: "DiegoGD",
      baseAmountMinor: 4163,
      splits: [
        { participantId: "IreneGR", baseAmountMinor: 2082 },
        { participantId: "DiegoGD2", baseAmountMinor: 2081 },
      ],
    },
  ]);
  assert.equal(result.transfers.length, 2);
  assertDirectAndSettled(result.balances, result.transfers);
});