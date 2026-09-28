import type { Expense, ExpenseLedger, ExpenseRates } from "@workspace/api-client-react";

export const DEMO_EXPENSE_RATES: ExpenseRates = {
  baseCurrency: "EUR",
  date: new Date().toISOString().slice(0, 10),
  rates: { EUR: 1, JPY: 0.0064 },
};

function recentDay(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
}

export function createDemoExpenseLedger(userId: string): ExpenseLedger {
  const diego = `user:${userId}`;
  const elena = "demo:elena";
  const kenji = "demo:kenji";
  const creator = Number(userId);
  const examples: Expense[] = [
    {
      id: -1, clientId: "demo-izakaya", concept: "Cena Izakaya en Shibuya",
      amountMinor: 12500, currency: "JPY", payerId: elena,
      splits: [
        { participantId: diego, amountMinor: 4167, baseAmountMinor: 2667 },
        { participantId: elena, amountMinor: 4167, baseAmountMinor: 2667 },
        { participantId: kenji, amountMinor: 4166, baseAmountMinor: 2666 },
      ],
      baseAmountMinor: 8000, rateToBase: 0.0064, rateDate: recentDay(2).slice(0, 10),
      createdAt: recentDay(2), createdBy: creator,
    },
    {
      id: -2, clientId: "demo-teamlab", concept: "Entradas Museo TeamLab",
      amountMinor: 9600, currency: "JPY", payerId: diego,
      splits: [
        { participantId: diego, amountMinor: 4800, baseAmountMinor: 3000 },
        { participantId: elena, amountMinor: 4800, baseAmountMinor: 3000 },
      ],
      baseAmountMinor: 6000, rateToBase: 0.00625, rateDate: recentDay(1).slice(0, 10),
      createdAt: recentDay(1), createdBy: creator,
    },
    {
      id: -3, clientId: "demo-suica", concept: "Reserva Suica Pass / Transporte",
      amountMinor: 4500, currency: "EUR", payerId: diego,
      splits: [
        { participantId: diego, amountMinor: 1500, baseAmountMinor: 1500 },
        { participantId: elena, amountMinor: 1500, baseAmountMinor: 1500 },
        { participantId: kenji, amountMinor: 1500, baseAmountMinor: 1500 },
      ],
      baseAmountMinor: 4500, rateToBase: 1, rateDate: recentDay(0).slice(0, 10),
      createdAt: recentDay(0), createdBy: creator,
    },
  ];
  return {
    baseCurrency: "EUR",
    participants: [
      { id: diego, name: "Diego (Tú)", kind: "user", active: true },
      { id: kenji, name: "Kenji (Guía local)", kind: "guest", active: true },
      { id: elena, name: "Elena", kind: "guest", active: true },
    ],
    expenses: examples,
  };
}

export function demoSessionKey(userId: string, tripId: number): string {
  return `demo-trip-expenses:${userId}:${tripId}`;
}