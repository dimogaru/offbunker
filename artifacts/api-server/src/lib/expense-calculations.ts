export const EXPENSE_CURRENCIES = ["EUR", "USD", "JPY", "CZK", "GBP", "CHF", "CAD", "AUD"] as const;
export type ExpenseCurrency = (typeof EXPENSE_CURRENCIES)[number];

export function minorUnitExponent(currency: ExpenseCurrency): number {
  return currency === "JPY" ? 0 : 2;
}

function decimalRatio(value: number): { numerator: bigint; denominator: bigint } {
  if (!Number.isFinite(value) || value <= 0) throw new Error("Invalid exchange rate");
  const decimal = value.toString().toLowerCase();
  const [coefficient, exponentText] = decimal.split("e");
  const exponent = Number(exponentText ?? 0);
  const [whole, fraction = ""] = coefficient.split(".");
  const digits = BigInt(`${whole}${fraction}`);
  const scale = fraction.length - exponent;
  return scale >= 0
    ? { numerator: digits, denominator: 10n ** BigInt(scale) }
    : { numerator: digits * 10n ** BigInt(-scale), denominator: 1n };
}

export function convertMinorUnits(
  amountMinor: number,
  sourceCurrency: ExpenseCurrency,
  baseCurrency: ExpenseCurrency,
  rateToBase: number,
): number {
  const { numerator, denominator } = decimalRatio(rateToBase);
  const scaledNumerator = BigInt(amountMinor) * numerator * 10n ** BigInt(minorUnitExponent(baseCurrency));
  const scaledDenominator = denominator * 10n ** BigInt(minorUnitExponent(sourceCurrency));
  const rounded = (scaledNumerator * 2n + scaledDenominator) / (scaledDenominator * 2n);
  const result = Number(rounded);
  if (!Number.isSafeInteger(result)) throw new Error("Converted amount exceeds supported integer range");
  return result;
}

/** Allocate a rounded base total proportionally using largest remainders. */
export function allocateConvertedSplits<T extends { participantId: string; amountMinor: number }>(
  splits: T[],
  sourceTotalMinor: number,
  baseTotalMinor: number,
): Array<T & { baseAmountMinor: number }> {
  const initial = splits.map((split, index) => {
    const numerator = BigInt(split.amountMinor) * BigInt(baseTotalMinor);
    const denominator = BigInt(sourceTotalMinor);
    return {
      ...split,
      baseAmountMinor: Number(numerator / denominator),
      remainder: numerator % denominator,
      index,
    };
  });
  let remaining = baseTotalMinor - initial.reduce((sum, split) => sum + split.baseAmountMinor, 0);
  const byRemainder = [...initial].sort((a, b) =>
    a.remainder === b.remainder ? a.participantId.localeCompare(b.participantId) : a.remainder > b.remainder ? -1 : 1
  );
  for (let index = 0; index < remaining; index += 1) byRemainder[index % byRemainder.length].baseAmountMinor += 1;
  return initial
    .sort((a, b) => a.index - b.index)
    .map(({ remainder: _remainder, index: _index, ...split }) => split as T & { baseAmountMinor: number });
}

export function getRateToBase(
  currency: ExpenseCurrency,
  baseCurrency: ExpenseCurrency,
  providerRates: Record<string, number>,
): number {
  if (currency === baseCurrency) return 1;
  const basePerCurrency = providerRates[currency];
  if (!Number.isFinite(basePerCurrency) || basePerCurrency <= 0) {
    throw new Error(`Exchange rate for ${currency} is unavailable`);
  }
  return 1 / basePerCurrency;
}