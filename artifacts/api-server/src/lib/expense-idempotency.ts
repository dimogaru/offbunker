export interface ExpenseRequestSignature {
  concept: string;
  amountMinor: number;
  currency: string;
  payerId: string;
  splits: Array<{ participantId: string; amountMinor: number }>;
}

export interface StoredExpenseSignature extends ExpenseRequestSignature {
  deletedAt: Date | null;
}

export type ExpenseRetryDisposition = "active-match" | "deleted-match" | "conflict";

export function classifyExpenseRetry(
  expense: StoredExpenseSignature,
  request: ExpenseRequestSignature,
): ExpenseRetryDisposition {
  const matches = expense.concept === request.concept.trim() &&
    expense.amountMinor === request.amountMinor &&
    expense.currency === request.currency &&
    expense.payerId === request.payerId &&
    expense.splits.length === request.splits.length &&
    request.splits.every((split) => expense.splits.some((saved) =>
      saved.participantId === split.participantId && saved.amountMinor === split.amountMinor
    ));
  if (!matches) return "conflict";
  return expense.deletedAt ? "deleted-match" : "active-match";
}