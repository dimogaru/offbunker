/**
 * All amounts in this module are integer minor units in the trip's base
 * currency. Positive balances are owed money; negative balances owe money.
 */
export interface ExpenseSplit {
  participantId: string;
  baseAmountMinor: number;
}

export interface ExpenseForSettlement {
  payerId: string;
  baseAmountMinor: number;
  splits: ExpenseSplit[];
}

export interface SignedExpenseBalance {
  participantId: string;
  balanceMinor: number;
}

export interface SettlementTransfer {
  /** The participant who owes money and initiates the payment. */
  payerId: string;
  /** The participant who receives the payment. */
  receiverId: string;
  amountMinor: number;
}

// Exact settlement is exponential in the worst case. Memoized debt matching
// performs well for normal trips through 20 participants; beyond that, fail
// explicitly rather than blocking the UI or returning a heuristic result.
const MAX_SETTLEMENT_PARTICIPANTS = 20;

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer number of minor units`);
  }
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Calculates each participant's net position: amounts paid minus their
 * allocated shares. A positive balance is a creditor; a negative balance is
 * a debtor. Expense splits must add up to the expense amount.
 */
export function calculateExpenseBalances(
  expenses: readonly ExpenseForSettlement[],
): SignedExpenseBalance[] {
  const balances = new Map<string, bigint>();

  const add = (participantId: string, amount: bigint) => {
    if (!participantId) {
      throw new TypeError("Participant IDs must be non-empty strings");
    }
    balances.set(participantId, (balances.get(participantId) ?? 0n) + amount);
  };

  for (const expense of expenses) {
    assertSafeInteger(expense.baseAmountMinor, "Expense baseAmountMinor");
    if (expense.baseAmountMinor < 0) {
      throw new RangeError("Expense baseAmountMinor cannot be negative");
    }
    if (!Array.isArray(expense.splits)) {
      throw new TypeError("Expense splits must be an array");
    }

    const amount = BigInt(expense.baseAmountMinor);
    add(expense.payerId, amount);

    let splitTotal = 0n;
    for (const split of expense.splits) {
      assertSafeInteger(split.baseAmountMinor, "Split baseAmountMinor");
      if (split.baseAmountMinor < 0) {
        throw new RangeError("Split baseAmountMinor cannot be negative");
      }
      const splitAmount = BigInt(split.baseAmountMinor);
      splitTotal += splitAmount;
      add(split.participantId, -splitAmount);
    }

    if (splitTotal !== amount) {
      throw new RangeError(
        "Expense splits must sum exactly to baseAmountMinor",
      );
    }
  }

  return [...balances.entries()]
    .map(([participantId, balance]) => {
      const balanceMinor = Number(balance);
      assertSafeInteger(balanceMinor, `Balance for ${participantId}`);
      return { participantId, balanceMinor };
    })
    .filter(({ balanceMinor }) => balanceMinor !== 0)
    .sort((a, b) => compareIds(a.participantId, b.participantId));
}

/**
 * Finds an exact minimum-transfer settlement. It maximizes the number of
 * settlements using memoized debt matching. Equal-cost solutions are resolved
 * by participant ID order, making the selected transfers deterministic.
 *
 * The input should be the balances returned by calculateExpenseBalances.
 * At most 20 nonzero participants are supported; the exact search is
 * exponential in pathological cases, so larger input is rejected explicitly
 * rather than silently returning a non-minimal result.
 */
export function calculateMinimumSettlementTransfers(
  inputBalances: readonly SignedExpenseBalance[],
): SettlementTransfer[] {
  const byId = new Map<string, bigint>();
  for (const { participantId, balanceMinor } of inputBalances) {
    if (!participantId) {
      throw new TypeError("Participant IDs must be non-empty strings");
    }
    assertSafeInteger(balanceMinor, `Balance for ${participantId}`);
    if (byId.has(participantId)) {
      throw new TypeError(`Duplicate balance for participant ${participantId}`);
    }
    if (balanceMinor !== 0) byId.set(participantId, BigInt(balanceMinor));
  }

  const participants = [...byId.entries()]
    .sort(([a], [b]) => compareIds(a, b))
    .map(([participantId, balance]) => ({ participantId, balance }));
  const count = participants.length;
  if (count > MAX_SETTLEMENT_PARTICIPANTS) {
    throw new RangeError(
      `Exact settlement supports at most ${MAX_SETTLEMENT_PARTICIPANTS} nonzero participants; received ${count}`,
    );
  }
  if (count === 0) return [];

  const total = participants.reduce((sum, participant) => sum + participant.balance, 0n);
  if (total !== 0n) {
    throw new RangeError("Participant balances must sum to zero");
  }

  // Each search step clears the first nonzero balance by matching it with an
  // opposite-signed participant. The other balance absorbs the residual.
  // Memoization shares the many equivalent residual debt configurations;
  // skipping equal-valued choices and trying exact cancellation first further
  // reduce the search. Participant order is ID-sorted above, so ties are stable.
  const working = participants.map(({ balance }) => balance);
  const memo = new Map<string, { count: number; nextIndex: number }>();

  const search = (): number => {
    let firstIndex = 0;
    while (firstIndex < count && working[firstIndex] === 0n) firstIndex += 1;
    if (firstIndex === count) return 0;

    const key = working.join(",");
    const cached = memo.get(key);
    if (cached) return cached.count;

    let bestCount = Number.POSITIVE_INFINITY;
    let bestNextIndex = -1;
    let previousOppositeBalance: bigint | undefined;

    for (let nextIndex = firstIndex + 1; nextIndex < count; nextIndex += 1) {
      const otherBalance = working[nextIndex];
      if (
        otherBalance === 0n ||
        (working[firstIndex] < 0n) === (otherBalance < 0n) ||
        otherBalance === previousOppositeBalance
      ) {
        continue;
      }
      previousOppositeBalance = otherBalance;

      const firstBalance = working[firstIndex];
      working[firstIndex] = 0n;
      working[nextIndex] += firstBalance;
      const candidateCount = 1 + search();
      working[nextIndex] -= firstBalance;
      working[firstIndex] = firstBalance;

      // Iterating IDs in order and only replacing strictly better answers
      // makes equal-cost solutions deterministic.
      if (candidateCount < bestCount) {
        bestCount = candidateCount;
        bestNextIndex = nextIndex;
      }

      // Pairing equal-and-opposite balances clears both participants in one
      // transfer and is never worse than pairing either with another person.
      if (otherBalance + firstBalance === 0n) break;
    }

    if (bestNextIndex < 0) {
      throw new Error("Unable to settle balanced participant balances");
    }
    memo.set(key, { count: bestCount, nextIndex: bestNextIndex });
    return bestCount;
  };

  search();

  const transfers: SettlementTransfer[] = [];
  while (true) {
    let firstIndex = 0;
    while (firstIndex < count && working[firstIndex] === 0n) firstIndex += 1;
    if (firstIndex === count) break;

    const choice = memo.get(working.join(","));
    if (!choice) {
      throw new Error("Unable to reconstruct exact settlement transfers");
    }
    const nextIndex = choice.nextIndex;
    const firstBalance = working[firstIndex];
    const amountMinor = Number(firstBalance < 0n ? -firstBalance : firstBalance);
    assertSafeInteger(amountMinor, "Transfer amountMinor");
    transfers.push(
      firstBalance < 0n
        ? {
            payerId: participants[firstIndex].participantId,
            receiverId: participants[nextIndex].participantId,
            amountMinor,
          }
        : {
            payerId: participants[nextIndex].participantId,
            receiverId: participants[firstIndex].participantId,
            amountMinor,
          },
    );
    working[firstIndex] = 0n;
    working[nextIndex] += firstBalance;
  }

  return transfers;
}

/** Convenience function that computes balances and their optimal transfers. */
export function calculateExpenseSettlement(
  expenses: readonly ExpenseForSettlement[],
): {
  balances: SignedExpenseBalance[];
  transfers: SettlementTransfer[];
} {
  const balances = calculateExpenseBalances(expenses);
  return {
    balances,
    transfers: calculateMinimumSettlementTransfers(balances),
  };
}