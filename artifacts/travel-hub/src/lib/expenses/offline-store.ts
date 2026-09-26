export interface PendingExpenseBody {
  clientId: string;
  concept: string;
  amountMinor: number;
  currency: string;
  payerId: string;
  splits: Array<{
    participantId: string;
    amountMinor: number;
  }>;
}

export interface NewPendingExpenseBody extends Omit<PendingExpenseBody, "clientId"> {}

export interface PendingExpenseRecord {
  clientId: string;
  body: PendingExpenseBody;
  enqueuedAt: number;
}

export type DailyFxRates = Record<string, number>;

export interface LatestFxRates {
  date: string;
  rates: DailyFxRates;
}

interface PendingExpenseRow extends PendingExpenseRecord {
  userId: string;
  tripId: string;
}

interface LedgerSnapshotRow {
  userId: string;
  tripId: string;
  snapshot: unknown;
  savedAt: number;
}

interface DailyFxRatesRow {
  userId: string;
  tripId: string;
  date: string;
  rates: DailyFxRates;
  savedAt: number;
}

const DATABASE_NAME = "travel-hub-expenses-offline";
const DATABASE_VERSION = 1;
const PENDING_STORE = "pending-expenses";
const LEDGER_STORE = "ledger-snapshots";
const FX_STORE = "daily-fx-rates";

export class OfflineExpenseStoreError extends Error {
  override name = "OfflineExpenseStoreError";

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

let databasePromise: Promise<IDBDatabase> | undefined;

function requireScope(userId: string, tripId: string): void {
  if (!userId || !tripId) {
    throw new TypeError("Offline expense storage requires both userId and tripId");
  }
}

function toStoreError(error: unknown, operation: string): OfflineExpenseStoreError {
  if (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "QuotaExceededError"
  ) {
    return new OfflineExpenseStoreError(
      `IndexedDB quota exceeded while attempting to ${operation}`,
      { cause: error },
    );
  }
  const detail = error instanceof Error ? error.message : String(error);
  return new OfflineExpenseStoreError(
    `IndexedDB could not ${operation}: ${detail}`,
    { cause: error },
  );
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new OfflineExpenseStoreError("IndexedDB is unavailable in this environment"),
    );
  }

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    } catch (error) {
      reject(toStoreError(error, "open offline expense storage"));
      return;
    }

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PENDING_STORE)) {
        const store = database.createObjectStore(PENDING_STORE, {
          keyPath: ["userId", "tripId", "clientId"],
        });
        store.createIndex("user-trip", ["userId", "tripId"], { unique: false });
      }
      if (!database.objectStoreNames.contains(LEDGER_STORE)) {
        database.createObjectStore(LEDGER_STORE, {
          keyPath: ["userId", "tripId"],
        });
      }
      if (!database.objectStoreNames.contains(FX_STORE)) {
        database.createObjectStore(FX_STORE, {
          keyPath: ["userId", "tripId", "date"],
        });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => {
      databasePromise = undefined;
      reject(toStoreError(request.error, "open offline expense storage"));
    };
    request.onblocked = () => {
      databasePromise = undefined;
      reject(
        new OfflineExpenseStoreError(
          "IndexedDB upgrade is blocked by another open connection",
        ),
      );
    };
  });
  return databasePromise;
}

function runTransaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, setResult: (value: T) => void) => void,
  description: string,
): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        let transaction: IDBTransaction | undefined;
        let result: T;
        let hasResult = false;
        const setResult = (value: T) => {
          result = value;
          hasResult = true;
        };

        try {
          const activeTransaction = database.transaction(storeName, mode);
          transaction = activeTransaction;
          activeTransaction.oncomplete = () => {
            if (hasResult) resolve(result);
            else resolve(undefined as T);
          };
          activeTransaction.onerror = () => {
            reject(toStoreError(activeTransaction.error, description));
          };
          activeTransaction.onabort = () => {
            reject(toStoreError(activeTransaction.error, description));
          };
          operation(activeTransaction.objectStore(storeName), setResult);
        } catch (error) {
          try {
            transaction?.abort();
          } catch {
            // The transaction may already have completed or been aborted.
          }
          reject(toStoreError(error, description));
        }
      }),
  );
}

function assertValidPendingBody(body: PendingExpenseBody): void {
  if (!body || typeof body !== "object") {
    throw new TypeError("Pending expense body must be an object");
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      body.clientId,
    )
  ) {
    throw new TypeError("Pending expense clientId must be a UUID");
  }
  if (
    typeof body.concept !== "string" ||
    typeof body.currency !== "string" ||
    typeof body.payerId !== "string" ||
    !body.payerId ||
    !Number.isSafeInteger(body.amountMinor) ||
    body.amountMinor < 0 ||
    !Array.isArray(body.splits) ||
    body.splits.some(
      (split) =>
        !split ||
        typeof split.participantId !== "string" ||
        !split.participantId ||
        !Number.isSafeInteger(split.amountMinor) ||
        split.amountMinor < 0,
    )
  ) {
    throw new TypeError("Pending expense body has invalid fields or amounts");
  }
}

/**
 * Generates a UUID suitable for an expense creation idempotency key.
 * Throws rather than using a non-cryptographic fallback when unavailable.
 */
export function createExpenseClientId(): string {
  if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") {
    throw new OfflineExpenseStoreError(
      "crypto.randomUUID is unavailable; cannot create an idempotency clientId",
    );
  }
  return crypto.randomUUID();
}

/**
 * Adds an expense creation request to the per-user, per-trip IndexedDB queue.
 * The exact body (including clientId) is retained for idempotent replay.
 */
export function enqueuePendingExpense(
  userId: string,
  tripId: string,
  body: PendingExpenseBody,
): Promise<void> {
  requireScope(userId, tripId);
  assertValidPendingBody(body);
  const row: PendingExpenseRow = {
    userId,
    tripId,
    clientId: body.clientId,
    body,
    enqueuedAt: Date.now(),
  };
  return runTransaction(
    PENDING_STORE,
    "readwrite",
    (store) => {
      store.put(row);
    },
    "enqueue a pending expense",
  );
}

/** Generates a UUID and queues the supplied expense creation body. */
export async function enqueueNewPendingExpense(
  userId: string,
  tripId: string,
  expense: NewPendingExpenseBody,
): Promise<PendingExpenseBody> {
  const body: PendingExpenseBody = {
    ...expense,
    clientId: createExpenseClientId(),
  };
  await enqueuePendingExpense(userId, tripId, body);
  return body;
}

/** Returns this user's pending expenses for this trip, oldest first. */
export function loadPendingExpenses(
  userId: string,
  tripId: string,
): Promise<PendingExpenseRecord[]> {
  requireScope(userId, tripId);
  return runTransaction(
    PENDING_STORE,
    "readonly",
    (store, setResult) => {
      const request = store.index("user-trip").getAll([userId, tripId]);
      request.onsuccess = () => {
        const rows = request.result as PendingExpenseRow[];
        setResult(
          rows
            .map(({ clientId, body, enqueuedAt }) => ({
              clientId,
              body,
              enqueuedAt,
            }))
            .sort(
              (a, b) =>
                a.enqueuedAt - b.enqueuedAt ||
                (a.clientId < b.clientId ? -1 : a.clientId > b.clientId ? 1 : 0),
            ),
        );
      };
    },
    "load pending expenses",
  );
}

/** Removes only the matching user's/trip's queued request. */
export function removePendingExpense(
  userId: string,
  tripId: string,
  clientId: string,
): Promise<void> {
  requireScope(userId, tripId);
  if (!clientId) throw new TypeError("clientId must be non-empty");
  return runTransaction(
    PENDING_STORE,
    "readwrite",
    (store) => {
      store.delete([userId, tripId, clientId]);
    },
    "remove a pending expense",
  );
}

/** Saves or replaces the cached ledger snapshot for exactly one user and trip. */
export function saveCachedLedgerSnapshot(
  userId: string,
  tripId: string,
  snapshot: unknown,
): Promise<void> {
  requireScope(userId, tripId);
  const row: LedgerSnapshotRow = { userId, tripId, snapshot, savedAt: Date.now() };
  return runTransaction(
    LEDGER_STORE,
    "readwrite",
    (store) => {
      store.put(row);
    },
    "save the cached ledger snapshot",
  );
}

/** Loads this user's cached trip ledger, or null when no snapshot is saved. */
export function loadCachedLedgerSnapshot<T = unknown>(
  userId: string,
  tripId: string,
): Promise<T | null> {
  requireScope(userId, tripId);
  return runTransaction(
    LEDGER_STORE,
    "readonly",
    (store, setResult) => {
      const request = store.get([userId, tripId]);
      request.onsuccess = () => {
        const row = request.result as LedgerSnapshotRow | undefined;
        setResult(row ? (row.snapshot as T) : null);
      };
    },
    "load the cached ledger snapshot",
  );
}

/** Saves the currency rates for one calendar date, user, and trip. */
export function saveDailyFxRates(
  userId: string,
  tripId: string,
  date: string,
  rates: DailyFxRates,
): Promise<void> {
  requireScope(userId, tripId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new TypeError("FX rate date must use YYYY-MM-DD format");
  }
  if (
    !rates ||
    typeof rates !== "object" ||
    Object.entries(rates).some(
      ([currency, rate]) =>
        !currency || typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0,
    )
  ) {
    throw new TypeError("Daily FX rates must map currency codes to positive finite rates");
  }
  const row: DailyFxRatesRow = {
    userId,
    tripId,
    date,
    rates,
    savedAt: Date.now(),
  };
  return runTransaction(
    FX_STORE,
    "readwrite",
    (store) => {
      store.put(row);
    },
    "save daily FX rates",
  );
}

/** Loads the saved rates for one date, or null if that date is not cached. */
export function loadDailyFxRates(
  userId: string,
  tripId: string,
  date: string,
): Promise<DailyFxRates | null> {
  requireScope(userId, tripId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new TypeError("FX rate date must use YYYY-MM-DD format");
  }
  return runTransaction(
    FX_STORE,
    "readonly",
    (store, setResult) => {
      const request = store.get([userId, tripId, date]);
      request.onsuccess = () => {
        const row = request.result as DailyFxRatesRow | undefined;
        setResult(row ? row.rates : null);
      };
    },
    "load daily FX rates",
  );
}

/**
 * Loads the most recent cached rates for this user and trip, or null when no
 * rates are cached. Dates use YYYY-MM-DD, so descending key order is newest
 * first and the returned date lets callers communicate rate age.
 */
export function loadLatestFxRates(
  userId: string,
  tripId: string,
): Promise<LatestFxRates | null> {
  requireScope(userId, tripId);
  return runTransaction(
    FX_STORE,
    "readonly",
    (store, setResult) => {
      const range = IDBKeyRange.bound(
        [userId, tripId, ""],
        [userId, tripId, "\uffff"],
      );
      const request = store.openCursor(range, "prev");
      request.onsuccess = () => {
        const row = request.result?.value as DailyFxRatesRow | undefined;
        setResult(row ? { date: row.date, rates: row.rates } : null);
      };
    },
    "load the latest daily FX rates",
  );
}