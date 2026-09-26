import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDownRight, ArrowRight, CircleAlert, Clock3, Coins, Plus, RefreshCw, Trash2, Users, WifiOff } from "lucide-react";
import {
  getGetExpenseLedgerQueryKey, getGetExpenseRatesQueryKey,
  useCreateExpense, useCreateExpenseGuest, useDeleteExpense, useDeleteExpenseGuest,
  useGetExpenseLedger, useGetExpenseRates, useUpdateExpenseSettings,
} from "@workspace/api-client-react";
import type { Expense, ExpenseCurrency, ExpenseInput, ExpenseLedger, ExpenseRates } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createExpenseClientId, enqueuePendingExpense, loadPendingExpenses, removePendingExpense,
  saveCachedLedgerSnapshot, loadCachedLedgerSnapshot, saveDailyFxRates, loadLatestFxRates,
} from "@/lib/expenses/offline-store";
import type { PendingExpenseRecord } from "@/lib/expenses/offline-store";
import { calculateExpenseSettlement } from "@/lib/expenses/settlement";

type Props = { tripId: number; readOnly: boolean; isOwner: boolean; userId: string; isOnline: boolean | { isOnline: boolean } };
type Values = { concept: string; amount: string; currency: ExpenseCurrency; payerId: string; splitMode: "equal" | "custom"; selected: string[]; custom: Record<string, string> };
const CURRENCIES: ExpenseCurrency[] = ["EUR", "USD", "JPY", "CZK", "GBP", "CHF", "CAD", "AUD"];
const decimals = (currency: string) => currency === "JPY" ? 0 : 2;
const money = (minor: number, currency: string) => new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: decimals(currency) }).format(minor / (currency === "JPY" ? 1 : 100));
const parseMinor = (value: string, currency: string): number | null => {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const places = normalized.split(".")[1]?.length ?? 0;
  if (places > decimals(currency)) return null;
  const result = Math.round(Number(normalized) * (currency === "JPY" ? 1 : 100));
  return Number.isSafeInteger(result) && result > 0 ? result : null;
};
const displayDate = (date: string) => {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? date : new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" }).format(d);
};
const errorText = (error: unknown) => error instanceof Error ? error.message : "No se pudo completar la operación.";
const errorStatus = (error: unknown): number | null => {
  if (typeof error !== "object" || error === null || !("status" in error)) return null;
  return typeof error.status === "number" ? error.status : null;
};
const initialValues: Values = { concept: "", amount: "", currency: "EUR", payerId: "", splitMode: "equal", selected: [], custom: {} };

// The server records exact converted cents. This projection is only for queued-item estimates.
function estimate(body: ExpenseInput, baseCurrency: ExpenseCurrency, rates: ExpenseRates | null) {
  const rate = body.currency === baseCurrency ? 1 : rates?.rates[body.currency];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return null;
  const factor = (baseCurrency === "JPY" ? 1 : 100) / (body.currency === "JPY" ? 1 : 100);
  const total = Math.round(body.amountMinor * rate * factor);
  if (!Number.isSafeInteger(total)) return null;
  const parts = body.splits.map((split, index) => {
    const exact = total * split.amountMinor / body.amountMinor;
    return { participantId: split.participantId, baseAmountMinor: Math.floor(exact), remainder: exact - Math.floor(exact), index };
  });
  let remaining = total - parts.reduce((sum, part) => sum + part.baseAmountMinor, 0);
  for (const part of [...parts].sort((a, b) => b.remainder - a.remainder || a.index - b.index)) {
    if (remaining-- <= 0) break;
    part.baseAmountMinor++;
  }
  return { payerId: body.payerId, baseAmountMinor: total, splits: parts.map(({ participantId, baseAmountMinor }) => ({ participantId, baseAmountMinor })) };
}

export default function ExpensesModule({ tripId, readOnly, isOwner, userId, isOnline: onlineSignal }: Props) {
  const isOnline = typeof onlineSignal === "boolean" ? onlineSignal : onlineSignal.isOnline;
  const tripKey = String(tripId);
  const queryClient = useQueryClient();
  const ledgerQuery = useGetExpenseLedger(tripId, { query: { enabled: isOnline, queryKey: getGetExpenseLedgerQueryKey(tripId) } });
  const ratesQuery = useGetExpenseRates(tripId, { query: { enabled: isOnline, queryKey: getGetExpenseRatesQueryKey(tripId) } });
  const settingsMutation = useUpdateExpenseSettings();
  const addGuestMutation = useCreateExpenseGuest();
  const removeGuestMutation = useDeleteExpenseGuest();
  const createMutation = useCreateExpense();
  const deleteMutation = useDeleteExpense();
  const [cachedLedger, setCachedLedger] = useState<ExpenseLedger | null>(null);
  const [cachedRates, setCachedRates] = useState<ExpenseRates | null>(null);
  const [pending, setPending] = useState<PendingExpenseRecord[]>([]);
  const [storageLoading, setStorageLoading] = useState(true);
  const [storageError, setStorageError] = useState("");
  const [actionError, setActionError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncingItem, setSyncingItem] = useState<string | null>(null);
  const [syncIssues, setSyncIssues] = useState<Record<string, { status: number | null; message: string }>>({});
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [deletingGuest, setDeletingGuest] = useState<{ id: string; name: string } | null>(null);
  const [deletingPending, setDeletingPending] = useState<PendingExpenseRecord | null>(null);
  const [removingPending, setRemovingPending] = useState(false);
  const [savingLocal, setSavingLocal] = useState(false);
  const flushLock = useRef(false);
  const flushAgain = useRef(false);
  const form = useForm<Values>({ defaultValues: initialValues });
  const selected = form.watch("selected");
  const splitMode = form.watch("splitMode");
  const chosenCurrency = form.watch("currency");
  const ledger = isOnline ? ledgerQuery.data ?? cachedLedger : cachedLedger;
  const activeParticipants = ledger?.participants.filter(p => p.active === true) ?? [];
  const base = ledger?.baseCurrency;
  const baseCurrency = base ?? "EUR";
  const rates = (isOnline && ratesQuery.data?.baseCurrency === base ? ratesQuery.data : cachedRates?.baseCurrency === base ? cachedRates : null) ?? null;
  const canEdit = !readOnly;
  const person = (id: string) => ledger?.participants.find(p => p.id === id)?.name ?? "Participante no disponible";
  const refreshLedger = useCallback(() => queryClient.invalidateQueries({ queryKey: getGetExpenseLedgerQueryKey(tripId) }), [queryClient, tripId]);

  useEffect(() => {
    let active = true;
    setStorageLoading(true);
    setCachedLedger(null);
    setCachedRates(null);
    setPending([]);
    setStorageError("");
    setSyncIssues({});
    setSyncError("");
    Promise.all([loadCachedLedgerSnapshot<ExpenseLedger>(userId, tripKey), loadPendingExpenses(userId, tripKey)])
      .then(([snapshot, queue]) => { if (active) { setCachedLedger(snapshot); setPending(queue); } })
      .catch(e => { if (active) setStorageError(`No se pudo abrir el almacenamiento local: ${errorText(e)}`); })
      .finally(() => { if (active) setStorageLoading(false); });
    return () => { active = false; };
  }, [userId, tripKey]);

  useEffect(() => {
    if (!isOnline || !ledgerQuery.data) return;
    setCachedLedger(ledgerQuery.data);
    void saveCachedLedgerSnapshot(userId, tripKey, ledgerQuery.data).catch(e => setStorageError(`No se pudo guardar una copia sin conexión: ${errorText(e)}`));
  }, [isOnline, ledgerQuery.data, userId, tripKey]);

  useEffect(() => {
    if (!base) return;
    let active = true;
    setCachedRates(null);
    loadLatestFxRates(userId, `${tripKey}:${base}`)
      .then(value => { if (active && value) setCachedRates({ baseCurrency: base, date: value.date, rates: value.rates }); })
      .catch(e => { if (active) setStorageError(`No se pudieron cargar los tipos de cambio: ${errorText(e)}`); });
    return () => { active = false; };
  }, [userId, tripKey, base]);

  useEffect(() => {
    const data = ratesQuery.data;
    if (!isOnline || !data || data.baseCurrency !== base) return;
    setCachedRates(data);
    void saveDailyFxRates(userId, `${tripKey}:${data.baseCurrency}`, data.date, data.rates)
      .catch(e => setStorageError(`No se pudieron guardar los tipos de cambio: ${errorText(e)}`));
  }, [isOnline, ratesQuery.data, base, userId, tripKey]);

  const createRef = useRef(createMutation.mutateAsync);
  createRef.current = createMutation.mutateAsync;
  const flush = useCallback(async () => {
    if (flushLock.current) { flushAgain.current = true; return; }
    if (!isOnline || !canEdit || storageLoading || !ledger) return;
    flushLock.current = true;
    setSyncing(true);
    setSyncError("");
    let succeeded = true;
    try {
      do {
        flushAgain.current = false;
        const queue = await loadPendingExpenses(userId, tripKey);
        for (const record of queue) {
          // A successful mutation resolves only for an accepted HTTP response.
          // Keep the same clientId on every replay so a retry is idempotent.
          setSyncingItem(record.clientId);
          try {
            await createRef.current({ tripId, data: record.body as ExpenseInput });
          } catch (e) {
            const status = errorStatus(e);
            setSyncIssues(previous => ({ ...previous, [record.clientId]: { status, message: errorText(e) } }));
            setSyncingItem(null);
            // Invalid/conflicting requests cannot hold back independent expenses.
            // Do not remove or rewrite the rejected item: it can be retried or removed locally.
            if (status === 400 || status === 409) continue;
            throw e;
          }
          await removePendingExpense(userId, tripKey, record.clientId);
          setPending(previous => previous.filter(item => item.clientId !== record.clientId));
          setSyncIssues(previous => {
            const next = { ...previous };
            delete next[record.clientId];
            return next;
          });
          setSyncingItem(null);
          await refreshLedger();
        }
      } while (flushAgain.current);
    } catch (e) {
      succeeded = false;
      setSyncError(`Hay gastos pendientes sin sincronizar. ${errorText(e)}`);
    } finally {
      flushLock.current = false;
      setSyncing(false);
      setSyncingItem(null);
      if (!succeeded) flushAgain.current = false;
    }
  }, [isOnline, canEdit, storageLoading, ledger, userId, tripKey, tripId, refreshLedger]);
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    if (isOnline && !storageLoading && ledger) void flushRef.current();
    // Automatic replay on mount, connection restore, or first available ledger only.
    // Do not depend on pending or query object: a failed request must not loop.
  }, [isOnline, storageLoading, !!ledger, userId, tripKey]);

  const outstanding = pending.filter(item => !ledger?.expenses.some(expense => expense.clientId === item.clientId));
  const settlement = useMemo(() => {
    if (!ledger) return null;
    try { return { value: calculateExpenseSettlement(ledger.expenses), error: "" }; }
    catch (e) { return { value: null, error: errorText(e) }; }
  }, [ledger]);
  const pendingEstimates = useMemo(() => outstanding.map(item => ({ id: item.clientId, value: base ? estimate(item.body as ExpenseInput, base, rates) : null })), [outstanding, base, rates]);
  const unavailableEstimates = pendingEstimates.filter(item => item.value === null).length;
  const offlineEstimate = useMemo(() => {
    if (isOnline || !ledger || !outstanding.length || unavailableEstimates) return null;
    try {
      return { value: calculateExpenseSettlement([...ledger.expenses, ...pendingEstimates.map(item => item.value!).filter(Boolean)]), error: "" };
    } catch (e) {
      return { value: null, error: errorText(e) };
    }
  }, [isOnline, ledger, outstanding.length, unavailableEstimates, pendingEstimates]);

  async function saveExpense(values: Values) {
    if (!ledger || !canEdit || savingLocal) return;
    setActionError("");
    const amountMinor = parseMinor(values.amount, values.currency);
    if (!values.concept.trim()) { form.setError("concept", { message: "Escribe un concepto." }); return; }
    if (!amountMinor) { form.setError("amount", { message: `Introduce un importe válido${values.currency === "JPY" ? " sin decimales" : " con hasta dos decimales"}.` }); return; }
    if (!activeParticipants.some(p => p.id === values.payerId)) { form.setError("payerId", { message: "Selecciona una persona activa que pagó." }); return; }
    if (values.selected.some(id => !activeParticipants.some(p => p.id === id))) { form.setError("selected", { message: "El reparto incluye una persona que ya no participa. Actualiza la selección." }); return; }
    const ids = values.selected;
    if (!ids.length) { form.setError("selected", { message: "Selecciona al menos una persona." }); return; }
    if (ids.length > amountMinor && values.splitMode === "equal") { form.setError("selected", { message: "El importe es demasiado pequeño para repartirlo entre todas estas personas." }); return; }
    const splits = values.splitMode === "equal"
      ? ids.map((participantId, index) => ({ participantId, amountMinor: Math.floor(amountMinor / ids.length) + (index < amountMinor % ids.length ? 1 : 0) }))
      : ids.map(participantId => ({ participantId, amountMinor: parseMinor(values.custom[participantId] ?? "", values.currency) ?? 0 }));
    if (splits.some(s => s.amountMinor < 1) || splits.reduce((sum, s) => sum + s.amountMinor, 0) !== amountMinor) {
      form.setError("custom", { message: "Las partes deben ser positivas y sumar exactamente el importe original." }); return;
    }
    setSavingLocal(true);
    try {
      const body: ExpenseInput = { clientId: createExpenseClientId(), concept: values.concept.trim(), amountMinor, currency: values.currency, payerId: values.payerId, splits };
      await enqueuePendingExpense(userId, tripKey, body);
      setPending(previous => [...previous, { clientId: body.clientId, body, enqueuedAt: Date.now() }]);
      form.reset(initialValues);
      setExpenseOpen(false);
      if (isOnline) void flushRef.current();
    } catch (e) {
      setActionError(`No se guardó el gasto: ${errorText(e)}. Inténtalo de nuevo.`);
    } finally { setSavingLocal(false); }
  }

  async function changeBase(currency: ExpenseCurrency) {
    if (!isOwner || !isOnline || !ledger || ledger.expenses.length || pending.length) return;
    setActionError("");
    try {
      await settingsMutation.mutateAsync({ tripId, data: { baseCurrency: currency } });
      await Promise.all([refreshLedger(), queryClient.invalidateQueries({ queryKey: getGetExpenseRatesQueryKey(tripId) })]);
    } catch (e) { setActionError(errorText(e)); }
  }
  async function addGuest() {
    const name = guestName.trim();
    if (!name || name.length > 100 || !isOwner || !isOnline) return;
    setActionError("");
    try {
      await addGuestMutation.mutateAsync({ tripId, data: { name } });
      await refreshLedger();
      setGuestName("");
      setGuestOpen(false);
    } catch (e) { setActionError(errorText(e)); }
  }
  async function confirmDeleteExpense() {
    if (!deletingExpense || !canEdit || !isOnline) return;
    setActionError("");
    try {
      await deleteMutation.mutateAsync({ tripId, expenseId: deletingExpense.id });
      await refreshLedger();
      setDeletingExpense(null);
    } catch (e) { setActionError(errorText(e)); }
  }
  async function confirmDeleteGuest() {
    if (!deletingGuest || !isOwner || !isOnline) return;
    const guestId = Number(deletingGuest.id.replace(/^guest:/, ""));
    if (!Number.isSafeInteger(guestId)) { setActionError("Identificador de invitado no válido."); return; }
    setActionError("");
    try {
      await removeGuestMutation.mutateAsync({ tripId, guestId });
      await refreshLedger();
      setDeletingGuest(null);
    } catch (e) { setActionError(errorText(e)); }
  }
  async function confirmDeletePending() {
    if (!deletingPending || removingPending || syncing) return;
    setRemovingPending(true);
    setActionError("");
    try {
      await removePendingExpense(userId, tripKey, deletingPending.clientId);
      setPending(previous => previous.filter(item => item.clientId !== deletingPending.clientId));
      setSyncIssues(previous => {
        const next = { ...previous };
        delete next[deletingPending.clientId];
        return next;
      });
      setSyncError("");
      setDeletingPending(null);
    } catch (e) {
      setActionError(`No se pudo quitar el gasto local: ${errorText(e)}`);
    } finally {
      setRemovingPending(false);
    }
  }
  function startExpense() {
    form.reset({ ...initialValues, currency: base ?? "EUR", payerId: activeParticipants[0]?.id ?? "", selected: activeParticipants.map(p => p.id) });
    setActionError("");
    setExpenseOpen(true);
  }

  const fieldClass = "h-10 rounded-lg border-border bg-background text-sm";
  return (
    <section className="space-y-5 pb-10" data-testid="module-expenses">
      <div className="relative overflow-hidden rounded-2xl border border-[#d7ded5] bg-[#eef0e6] px-5 py-6 sm:px-7 sm:py-7">
        <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full border-[28px] border-[#dce6d9] opacity-70 pointer-events-none" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#476b67]"><Coins className="h-4 w-4" /> Caja compartida</div>
            <h2 className="font-serif text-3xl font-semibold tracking-tight text-[#203d39] sm:text-4xl">Gastos del viaje</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-[#566660]">Cada importe en su moneda. Las cuentas, claras para todos.</p>
          </div>
          <div className="relative flex flex-col items-start gap-3 sm:items-end"><span data-testid="status-expenses-sync" className="rounded-full border border-[#c6d8cd] bg-[#f6faf2] px-2.5 py-1 text-xs font-medium text-[#38675a]">{syncing ? "Sincronizando…" : pending.length ? `${pending.length} pendiente${pending.length === 1 ? "" : "s"}` : "Gastos al día"}</span>{canEdit && <Button data-testid="button-add-expense" onClick={startExpense} disabled={!activeParticipants.length || storageLoading} className="w-full gap-2 bg-[#225a54] text-[#f6f3e9] hover:bg-[#194a45] sm:w-auto"><Plus className="h-4 w-4" /> Añadir gasto</Button>}</div>
        </div>
      </div>

      {(actionError || storageError || syncError) && <div role="alert" data-testid="status-expenses-error" className="flex items-start gap-2 rounded-xl border border-[#e6c8b9] bg-[#fff4ed] p-3 text-sm text-[#884532]"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /><div>{actionError || storageError || syncError}{syncError && isOnline && canEdit && <button type="button" data-testid="button-retry-sync" className="ml-2 font-semibold underline underline-offset-2" onClick={() => void flush()}>Reintentar</button>}</div></div>}
      {!isOnline && <div role="status" data-testid="status-expenses-offline" className="flex items-start gap-2 rounded-xl border border-[#d9d8c5] bg-[#f7f3e7] p-3 text-sm text-[#6e6546]"><WifiOff className="mt-0.5 h-4 w-4 shrink-0" /> Sin conexión. Puedes guardar gastos en este dispositivo; se enviarán al volver a conectarte.</div>}
      {(storageLoading || (isOnline && ledgerQuery.isLoading && !ledger)) ? <div className="space-y-3"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-28 rounded-xl" /></div> : !ledger ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <Coins className="mx-auto mb-3 h-8 w-8 text-[#8aa29b]" />
          <p className="font-medium">{isOnline ? "No se pudieron cargar los gastos." : "Todavía no hay una copia de estos gastos en este dispositivo."}</p>
          <p className="mt-1 text-sm text-muted-foreground">{isOnline ? "Comprueba la conexión y vuelve a intentarlo." : "Abre este viaje una vez con conexión para disponer de él sin red."}</p>
          {isOnline && <Button data-testid="button-retry-ledger" variant="outline" className="mt-4" onClick={() => void ledgerQuery.refetch()}>Reintentar</Button>}
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(230px,0.44fr)]">
            <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Moneda de referencia</p><p data-testid="text-base-currency" className="mt-1 font-serif text-2xl text-[#225a54]">{base}</p></div>
                {isOwner && !ledger.expenses.length && !pending.length && <select data-testid="select-base-currency" aria-label="Moneda base del viaje" value={base} onChange={e => void changeBase(e.target.value as ExpenseCurrency)} disabled={!isOnline || settingsMutation.isPending} className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium">{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select>}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{ledger.expenses.length || pending.length ? "La moneda base queda fijada tras el primer gasto." : "La persona propietaria puede cambiarla antes del primer gasto."}</p>
              <div className="mt-4 border-t border-border/70 pt-3 text-xs text-muted-foreground" data-testid="text-fx-date">
                {rates ? <>Tipo de cambio {displayDate(rates.date)}{!isOnline ? " · copia guardada, puede estar desactualizada" : ""}</> : "Tipos de cambio no disponibles; las conversiones pendientes no se estimarán."}
                {isOnline && ratesQuery.isError && <span className="ml-1 text-[#9a5c3b]">No se pudieron actualizar los tipos.</span>}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-[#42766d]" /><h3 className="font-semibold">Participantes</h3></div>{isOwner && <button type="button" data-testid="button-add-guest" disabled={!isOnline} onClick={() => setGuestOpen(true)} className="text-xs font-semibold text-[#225a54] hover:underline disabled:opacity-40">+ Invitado</button>}</div>
              <div className="flex flex-wrap gap-1.5">{ledger.participants.map(p => <span key={p.id} data-testid={`participant-${p.id}`} className={`inline-flex items-center gap-1.5 rounded-full border py-1 pl-2.5 pr-2 text-xs ${p.active ? "border-[#e0e7df] bg-[#f5f6ee] text-[#38524b]" : "border-border bg-muted/40 text-muted-foreground"}`}>{p.name}{p.kind === "guest" && <span className="text-[#8a9188]">· invitado</span>}{!p.active && <span>· histórico</span>}{isOwner && p.kind === "guest" && p.active && <button type="button" data-testid={`button-remove-guest-${p.id}`} disabled={!isOnline} onClick={() => setDeletingGuest(p)} aria-label={`Eliminar invitado ${p.name}`} className="ml-0.5 text-[#9b6150] hover:text-[#703728] disabled:opacity-40"><Trash2 className="h-3 w-3" /></button>}</span>)}</div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Solo la persona propietaria, las cuentas que comparten este viaje y los invitados con nombre participan en el reparto. El enlace público no participa.</p>
            </div>
          </div>

          {outstanding.length > 0 && <div className="rounded-xl border border-[#e4d9b8] bg-[#faf6e9] p-4" data-testid="status-pending-expenses">
            <div className="flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-sm font-semibold text-[#756343]"><Clock3 className="h-4 w-4" /> {outstanding.length} {outstanding.length === 1 ? "gasto pendiente" : "gastos pendientes"} de sincronizar</p>{isOnline && canEdit && <button type="button" data-testid="button-sync-expenses" disabled={syncing} onClick={() => void flush()} className="flex items-center gap-1 text-xs font-semibold text-[#225a54] disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" />{syncing ? "Enviando…" : "Reintentar"}</button>}</div>
            <div className="mt-3 space-y-2">{outstanding.map(item => {
              const projected = pendingEstimates.find(v => v.id === item.clientId)?.value;
              const issue = syncIssues[item.clientId];
              const rejected = issue?.status === 400 || issue?.status === 409;
              return <div key={item.clientId} data-testid={`pending-expense-${item.clientId}`} className="border-t border-[#e7dfc9] pt-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="font-medium">{item.body.concept} <span className="font-normal text-muted-foreground">· {person(item.body.payerId)}</span></span>
                  <div className="flex items-center gap-3"><span className="text-right">{money(item.body.amountMinor, item.body.currency)}<span className="block text-xs text-[#887a5f]">{projected ? `Estimado: ${money(projected.baseAmountMinor, baseCurrency)}` : "Estimación no disponible · falta tipo de cambio"}</span></span><button type="button" data-testid={`button-remove-pending-${item.clientId}`} disabled={syncing || removingPending} onClick={() => { setActionError(""); setDeletingPending(item); }} aria-label={`Quitar gasto pendiente ${item.body.concept}`} title="Quitar gasto local" className="rounded-md p-1.5 text-[#9b6150] hover:bg-[#f3e9d7] disabled:opacity-40"><Trash2 className="h-4 w-4" /></button></div>
                </div>
                <p data-testid={`status-pending-expense-${item.clientId}`} role={issue ? "alert" : "status"} className={`mt-1 text-xs ${issue ? "text-[#96513b]" : "text-[#827454]"}`}>
                  {syncingItem === item.clientId ? "Enviando…" : rejected ? `Rechazado (${issue.status}): ${issue.message}. Sigue guardado aquí; puedes quitarlo o reintentar.` : issue ? `Sin enviar${issue.status ? ` (${issue.status})` : ""}: ${issue.message}. Sigue en cola.` : readOnly ? "En cola · sin permiso de edición" : "En cola · pendiente de sincronización"}
                </p>
              </div>;
            })}</div>
            <p className="mt-3 text-xs text-[#827454]">No incluidos en la liquidación confirmada.{unavailableEstimates > 0 ? ` ${unavailableEstimates} sin estimación de cambio.` : ""}</p>
            {readOnly && <p role="status" data-testid="status-pending-readonly" className="mt-2 rounded-lg border border-[#e3c8ac] bg-[#fff5e9] p-2 text-xs font-medium text-[#885735]">Ya no tienes permiso para editar este viaje. Estos gastos locales no se pueden sincronizar hasta que recuperes acceso de edición. Puedes quitarlos de este dispositivo.</p>}
          </div>}

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(290px,0.72fr)]">
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-5"><div><h3 className="font-serif text-xl font-semibold">Movimientos</h3><p className="text-xs text-muted-foreground">{ledger.expenses.length} {ledger.expenses.length === 1 ? "gasto confirmado" : "gastos confirmados"}</p></div><span className="rounded-full bg-[#edf2ea] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#4f7567]">Registrados</span></div>
              {!ledger.expenses.length ? <div className="px-6 py-12 text-center"><Coins className="mx-auto mb-3 h-8 w-8 text-[#9fb1a8]" /><p className="font-medium">La cuenta empieza aquí</p><p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">Anota el primer gasto para que el grupo vea qué se pagó y cómo se reparte.</p>{canEdit && <Button data-testid="button-add-first-expense" variant="outline" className="mt-4" onClick={startExpense}>Añadir primer gasto</Button>}</div> :
                <div className="divide-y divide-border/70">{[...ledger.expenses].reverse().map(expense => <article key={expense.id} data-testid={`expense-${expense.id}`} className="flex gap-3 px-4 py-4 sm:px-5"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf0ea] text-[#49766a]"><ArrowDownRight className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h4 className="truncate font-semibold">{expense.concept}</h4><p className="mt-0.5 text-xs text-muted-foreground">Pagó {person(expense.payerId)} · {displayDate(expense.createdAt)}</p></div><div className="shrink-0 text-right"><p className="font-semibold tabular-nums">{money(expense.amountMinor, expense.currency)}</p>{expense.currency !== base && <p className="text-xs text-muted-foreground tabular-nums">{money(expense.baseAmountMinor, baseCurrency)}</p>}</div></div><div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"><span>Entre {expense.splits.map(s => person(s.participantId)).join(", ")}</span><span>· cambio {displayDate(expense.rateDate)}</span></div></div>{canEdit && <button type="button" data-testid={`button-delete-expense-${expense.id}`} disabled={!isOnline} onClick={() => setDeletingExpense(expense)} aria-label={`Eliminar gasto ${expense.concept}`} className="self-start rounded-md p-1 text-muted-foreground hover:bg-[#fff1eb] hover:text-[#a4543e] disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>}</article>)}</div>}
            </div>

            <div className="rounded-xl border border-[#ceddd3] bg-[#e9f0e9] p-5 sm:p-6" data-testid="section-settlement">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#568075]">Cuentas claras</p>
              <h3 className="mt-1 font-serif text-2xl font-semibold text-[#244a43]">Balance y Liquidación</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#60786c]">Transferencias mínimas exactas sobre los gastos confirmados, en {base}. No se registran pagos automáticamente.</p>
              {settlement?.error ? <p role="alert" data-testid="status-settlement-error" className="mt-5 rounded-lg bg-[#fff5ed] p-3 text-sm text-[#904d38]">No se puede calcular la liquidación exacta. {settlement.error.includes("at most 15") ? "Se admiten hasta 15 participantes con saldo distinto de cero." : settlement.error}</p> : !settlement?.value?.transfers.length ? <div className="mt-6 rounded-lg border border-dashed border-[#bfd2c3] px-4 py-7 text-center text-sm text-[#60796b]">{ledger.expenses.length ? "Todo está saldado. No hay transferencias pendientes." : "Los balances aparecerán con el primer gasto."}</div> :
                <div className="mt-5 space-y-2.5">{settlement.value.transfers.map((transfer, index) => <div key={`${transfer.payerId}-${transfer.receiverId}-${index}`} data-testid={`transfer-${index}`} className="rounded-lg border border-[#d8e4d8] bg-[#f9fbf5] px-3 py-3"><div className="flex items-center gap-2 text-sm"><span className="min-w-0 flex-1 truncate font-semibold">{person(transfer.payerId)}</span><ArrowRight className="h-4 w-4 shrink-0 text-[#739b86]" /><span className="min-w-0 flex-1 truncate font-semibold">{person(transfer.receiverId)}</span></div><p className="mt-1 text-right font-semibold tabular-nums text-[#255e53]">{money(transfer.amountMinor, baseCurrency)}</p></div>)}</div>}
              {!!settlement?.value?.balances.length && <div className="mt-5 border-t border-[#cdddcf] pt-4"><p className="mb-2 text-xs font-semibold text-[#5b7668]">Saldo por persona</p>{settlement.value.balances.map(b => <div key={b.participantId} data-testid={`balance-${b.participantId}`} className="flex justify-between gap-3 py-1 text-xs"><span>{person(b.participantId)}</span><span className={`font-semibold tabular-nums ${b.balanceMinor > 0 ? "text-[#246354]" : "text-[#a35d43]"}`}>{b.balanceMinor > 0 ? "+" : "−"}{money(Math.abs(b.balanceMinor), baseCurrency)}</span></div>)}</div>}
              {outstanding.length > 0 && <p className="mt-4 border-t border-[#cdddcf] pt-3 text-xs text-[#647b6c]">Hay {outstanding.length} {outstanding.length === 1 ? "gasto local" : "gastos locales"} aún sin incluir. La liquidación se actualizará tras sincronizar.</p>}
            </div>
          </div>
          {!isOnline && outstanding.length > 0 && <div data-testid="section-estimated-settlement" className="rounded-xl border border-dashed border-[#ceb98d] bg-[#fbf5e8] p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h3 className="font-serif text-xl font-semibold text-[#6c5939]">Liquidación estimada · sin conexión</h3><span className="text-xs font-semibold uppercase tracking-wider text-[#947952]">No confirmada</span></div>
            {unavailableEstimates > 0 ? <p data-testid="status-estimate-unavailable" className="mt-3 text-sm leading-relaxed text-[#78654c]">No se puede calcular un total estimado: {unavailableEstimates} {unavailableEstimates === 1 ? "gasto pendiente no tiene" : "gastos pendientes no tienen"} un tipo de cambio guardado para {base}. No se inventa ningún importe; los pendientes quedan excluidos de la liquidación confirmada.</p> :
              offlineEstimate?.error ? <p role="alert" data-testid="status-estimate-error" className="mt-3 text-sm text-[#914c38]">No se puede calcular la liquidación estimada. {offlineEstimate.error.includes("at most 15") ? "Se admiten hasta 15 participantes con saldo distinto de cero." : offlineEstimate.error}</p> :
              <><p className="mt-2 text-xs leading-relaxed text-[#817051]">Incluye {ledger.expenses.length} gastos confirmados y {outstanding.length} pendientes, convertidos con el tipo guardado{rates ? ` del ${displayDate(rates.date)}` : ""}. Los importes reales pueden variar al sincronizar.</p>
                {offlineEstimate?.value?.transfers.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{offlineEstimate.value.transfers.map((transfer, index) => <div key={`${transfer.payerId}-${transfer.receiverId}-${index}`} data-testid={`estimated-transfer-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e5d9bc] bg-[#fffaf0] px-3 py-2.5 text-sm"><span className="flex items-center gap-2"><span className="font-medium">{person(transfer.payerId)}</span><ArrowRight className="h-3.5 w-3.5 text-[#a58b5d]" /><span className="font-medium">{person(transfer.receiverId)}</span></span><strong className="tabular-nums text-[#6b5938]">{money(transfer.amountMinor, baseCurrency)}</strong></div>)}</div> : <p className="mt-3 text-sm text-[#78654c]">Sin transferencias estimadas; los saldos se compensan.</p>}
                {!!offlineEstimate?.value?.balances.length && <div className="mt-4 grid gap-x-6 gap-y-1 border-t border-[#e4d6b8] pt-3 sm:grid-cols-2">{offlineEstimate.value.balances.map(balance => <div key={balance.participantId} data-testid={`estimated-balance-${balance.participantId}`} className="flex justify-between gap-3 text-xs text-[#78654c]"><span>{person(balance.participantId)}</span><span className="font-semibold tabular-nums">{balance.balanceMinor > 0 ? "+" : "−"}{money(Math.abs(balance.balanceMinor), baseCurrency)}</span></div>)}</div>}
              </>}
          </div>}
        </>
      )}

      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}><DialogContent className="max-h-[min(90dvh,850px)] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto rounded-xl">
        <DialogHeader><DialogTitle className="font-serif text-2xl">Nuevo gasto</DialogTitle><DialogDescription>Indica quién pagó y cómo se reparte el importe original.</DialogDescription></DialogHeader>
        {actionError && <p role="alert" className="rounded-lg bg-[#fff1e8] p-2 text-sm text-[#914c38]">{actionError}</p>}
        <Form {...form}><form onSubmit={form.handleSubmit(saveExpense)} className="space-y-4 pt-2">
          <FormField control={form.control} name="concept" rules={{ required: "Escribe un concepto." }} render={({ field }) => <FormItem><FormLabel>Concepto</FormLabel><FormControl><Input data-testid="input-expense-concept" maxLength={200} placeholder="Cena de la primera noche" className={fieldClass} {...field} /></FormControl><FormMessage /></FormItem>} />
          <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3"><FormField control={form.control} name="amount" render={({ field }) => <FormItem><FormLabel>Importe original</FormLabel><FormControl><Input data-testid="input-expense-amount" inputMode="decimal" placeholder={chosenCurrency === "JPY" ? "2400" : "24,50"} className={fieldClass} {...field} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="currency" render={({ field }) => <FormItem><FormLabel>Moneda</FormLabel><FormControl><select data-testid="select-expense-currency" aria-label="Moneda del gasto" className={`${fieldClass} w-full px-2`} {...field}>{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select></FormControl><FormMessage /></FormItem>} /></div>
          <FormField control={form.control} name="payerId" render={({ field }) => <FormItem><FormLabel>Pagó</FormLabel><FormControl><select data-testid="select-expense-payer" className={`${fieldClass} w-full px-3`} {...field}><option value="">Selecciona una persona</option>{activeParticipants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></FormControl><FormMessage /></FormItem>} />
          <div className="border-t border-border pt-4"><p className="text-sm font-semibold">¿Entre quiénes se reparte?</p><p className="mt-0.5 text-xs text-muted-foreground">Puedes incluir a quien pagó o dejarlo fuera.</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">{activeParticipants.map(p => <label key={p.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm"><input data-testid={`checkbox-split-${p.id}`} type="checkbox" checked={selected.includes(p.id)} onChange={e => { form.setValue("selected", e.target.checked ? [...selected, p.id] : selected.filter(id => id !== p.id), { shouldValidate: true }); form.clearErrors("selected"); }} className="accent-[#225a54]" /><span className="truncate">{p.name}</span></label>)}</div>
            {form.formState.errors.selected && <p role="alert" className="mt-1 text-xs text-destructive">{form.formState.errors.selected.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-1"><button type="button" data-testid="button-equal-split" onClick={() => { form.setValue("splitMode", "equal"); form.clearErrors("custom"); }} className={`rounded-md px-3 py-2 text-sm font-medium ${splitMode === "equal" ? "bg-card text-[#225a54] shadow-sm" : "text-muted-foreground"}`}>A partes iguales</button><button type="button" data-testid="button-custom-split" onClick={() => form.setValue("splitMode", "custom")} className={`rounded-md px-3 py-2 text-sm font-medium ${splitMode === "custom" ? "bg-card text-[#225a54] shadow-sm" : "text-muted-foreground"}`}>Importes a medida</button></div>
          {splitMode === "custom" && <div className="space-y-2">{selected.map(id => <div key={id} className="flex items-center gap-3"><label htmlFor={`custom-${id}`} className="min-w-0 flex-1 truncate text-sm">{person(id)}</label><Input id={`custom-${id}`} data-testid={`input-custom-split-${id}`} inputMode="decimal" placeholder={chosenCurrency === "JPY" ? "0" : "0,00"} className="w-32" value={form.watch(`custom.${id}`) ?? ""} onChange={e => { form.setValue(`custom.${id}`, e.target.value); form.clearErrors("custom"); }} /><span className="w-9 text-xs text-muted-foreground">{chosenCurrency}</span></div>)}{form.formState.errors.custom && <p role="alert" className="text-xs text-destructive">{typeof form.formState.errors.custom.message === "string" ? form.formState.errors.custom.message : "Comprueba el reparto."}</p>}<p className="text-xs text-muted-foreground">Los importes deben sumar el total en {chosenCurrency}, no en {base}.</p></div>}
          <div className="rounded-lg bg-[#f5f3e9] px-3 py-2 text-xs text-[#736b54]">{isOnline ? "Primero se guarda en este dispositivo y luego se sincroniza." : "Sin conexión: quedará pendiente en este dispositivo hasta que vuelva la red."}</div>
          <DialogFooter><Button type="button" data-testid="button-cancel-expense" variant="outline" onClick={() => setExpenseOpen(false)}>Cancelar</Button><Button type="submit" data-testid="button-save-expense" disabled={savingLocal} className="bg-[#225a54] hover:bg-[#194a45]">{savingLocal ? "Guardando…" : "Guardar gasto"}</Button></DialogFooter>
        </form></Form>
      </DialogContent></Dialog>

      <Dialog open={guestOpen} onOpenChange={setGuestOpen}><DialogContent className="w-[calc(100vw-1.5rem)] max-w-sm"><DialogHeader><DialogTitle className="font-serif text-2xl">Añadir invitado</DialogTitle><DialogDescription>Una persona sin cuenta que participa en los gastos de este viaje.</DialogDescription></DialogHeader>{actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}<div className="space-y-2"><label htmlFor="guest-name" className="text-sm font-medium">Nombre</label><Input id="guest-name" data-testid="input-guest-name" maxLength={100} placeholder="Nombre del invitado" value={guestName} onChange={e => setGuestName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void addGuest(); }} /></div><DialogFooter><Button data-testid="button-save-guest" disabled={!guestName.trim() || addGuestMutation.isPending} onClick={() => void addGuest()} className="bg-[#225a54] hover:bg-[#194a45]">{addGuestMutation.isPending ? "Añadiendo…" : "Añadir invitado"}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={!!deletingExpense} onOpenChange={open => { if (!open) setDeletingExpense(null); }}><DialogContent className="w-[calc(100vw-1.5rem)] max-w-sm"><DialogHeader><DialogTitle>¿Eliminar este gasto?</DialogTitle><DialogDescription>Se eliminará «{deletingExpense?.concept}» y se recalcularán los balances. No se puede deshacer.</DialogDescription></DialogHeader>{actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}<DialogFooter><Button data-testid="button-cancel-delete-expense" variant="outline" onClick={() => setDeletingExpense(null)}>Cancelar</Button><Button data-testid="button-confirm-delete-expense" variant="destructive" disabled={deleteMutation.isPending} onClick={() => void confirmDeleteExpense()}>{deleteMutation.isPending ? "Eliminando…" : "Eliminar gasto"}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={!!deletingGuest} onOpenChange={open => { if (!open) setDeletingGuest(null); }}><DialogContent className="w-[calc(100vw-1.5rem)] max-w-sm"><DialogHeader><DialogTitle>¿Eliminar a {deletingGuest?.name}?</DialogTitle><DialogDescription>Solo se puede eliminar a un invitado que no participe en gastos registrados.</DialogDescription></DialogHeader>{actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}<DialogFooter><Button data-testid="button-cancel-delete-guest" variant="outline" onClick={() => setDeletingGuest(null)}>Cancelar</Button><Button data-testid="button-confirm-delete-guest" variant="destructive" disabled={removeGuestMutation.isPending} onClick={() => void confirmDeleteGuest()}>{removeGuestMutation.isPending ? "Eliminando…" : "Eliminar invitado"}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={!!deletingPending} onOpenChange={open => { if (!open && !removingPending) setDeletingPending(null); }}><DialogContent className="w-[calc(100vw-1.5rem)] max-w-sm"><DialogHeader><DialogTitle>¿Quitar este gasto local?</DialogTitle><DialogDescription>Se borrará «{deletingPending?.body.concept}» de este dispositivo. No se sincronizará y esta acción no se puede deshacer. Los gastos ya confirmados no se verán afectados.</DialogDescription></DialogHeader>{actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}<DialogFooter><Button type="button" data-testid="button-cancel-remove-pending" variant="outline" disabled={removingPending} onClick={() => setDeletingPending(null)}>Cancelar</Button><Button type="button" data-testid="button-confirm-remove-pending" variant="destructive" disabled={removingPending || syncing} onClick={() => void confirmDeletePending()}>{removingPending ? "Quitando…" : "Quitar gasto local"}</Button></DialogFooter></DialogContent></Dialog>
      <span className="sr-only" aria-live="polite">{syncing ? "Sincronizando gastos" : syncError ? "Error de sincronización" : pending.length ? "Hay gastos pendientes" : "Gastos sincronizados"}</span>
    </section>
  );
}