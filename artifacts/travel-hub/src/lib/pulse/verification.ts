import { getListFlightsQueryKey, getListAccommodationsQueryKey } from "@workspace/api-client-react";
import type { Flight, Accommodation } from "@workspace/api-client-react";
import { persistedQueryCacheKey } from "@/lib/query-cache";
import { listLocalDocuments } from "@/lib/local-documents";
import { loadCachedLedgerSnapshot, loadLatestFxRates } from "@/lib/expenses/offline-store";

export type CheckState = "verified" | "missing" | "unverified";
export interface PulseCheck { label: string; state: CheckState; detail: string }
export interface PulseResult { checks: PulseCheck[]; ready: boolean }

function savedQuery<T>(ownerId: string, queryKey: readonly unknown[]): T | null {
  const raw = localStorage.getItem(persistedQueryCacheKey(ownerId));
  if (!raw) return null;
  const snapshot: unknown = JSON.parse(raw);
  if (!snapshot || typeof snapshot !== "object") return null;
  const cache = snapshot as { ownerId?: unknown; savedAt?: unknown; queries?: unknown };
  if (cache.ownerId !== ownerId || typeof cache.savedAt !== "number" ||
    cache.savedAt > Date.now() || Date.now() - cache.savedAt > 7 * 24 * 60 * 60 * 1000 ||
    !Array.isArray(cache.queries)) return null;
  const match = cache.queries.find((item: unknown) =>
    item !== null && typeof item === "object" &&
    JSON.stringify((item as { queryKey?: unknown }).queryKey) === JSON.stringify(queryKey),
  ) as { data?: unknown } | undefined;
  return match?.data == null ? null : match.data as T;
}

export async function verifyBunker(ownerId: string, tripId: number): Promise<PulseResult> {
  const checks: PulseCheck[] = [];
  let flights: Flight[] | null = null;
  let accommodations: Accommodation[] | null = null;
  try {
    flights = savedQuery<Flight[]>(ownerId, getListFlightsQueryKey(tripId));
    accommodations = savedQuery<Accommodation[]>(ownerId, getListAccommodationsQueryKey(tripId));
  } catch {
    // Damaged or inaccessible localStorage is not evidence of availability.
  }
  const flightsValid = Array.isArray(flights) && flights.length > 0 &&
    flights.every(f => f.tripId === tripId && [f.airline, f.flightNumber, f.departureAirport, f.arrivalAirport, f.departureTime, f.arrivalTime].every(v => typeof v === "string" && v.trim()));
  checks.push({
    label: "Datos de vuelos sin conexión",
    state: flightsValid ? "verified" : "missing",
    detail: flightsValid ? `${flights!.length} vuelo(s) con ruta, número y horario en caché persistida.` : "No se encontraron vuelos completos en la caché persistida de este viaje.",
  });

  try {
    const docs = await listLocalDocuments(ownerId, tripId);
    const allTickets = flightsValid && flights!.every(f =>
      docs.some(d => d.module === "flights" && d.notes === `flightId:${f.id}` && d.blob instanceof Blob && d.blob.size > 0),
    );
    checks.push({
      label: "Archivos de billetes disponibles",
      state: allTickets ? "verified" : "unverified",
      detail: allTickets
        ? "Archivo local asociado a cada vuelo y guardado en este dispositivo; no se verifica el contenido del billete."
        : "No se puede verificar un archivo local para cada vuelo. Un enlace o archivo del servidor no demuestra que esté descargado.",
    });
  } catch {
    checks.push({ label: "Archivos de billetes disponibles", state: "unverified", detail: "No se pudo leer el almacén local de documentos; descarga no verificada." });
  }

  const staysValid = Array.isArray(accommodations) && accommodations.length > 0 &&
    accommodations.every(a => a.tripId === tripId && typeof a.address === "string" && !!a.address.trim() &&
      typeof a.confirmationCode === "string" && !!a.confirmationCode.trim());
  checks.push({
    label: "Dirección y reserva de alojamiento",
    state: staysValid ? "verified" : "missing",
    detail: staysValid ? `${accommodations!.length} alojamiento(s) con dirección y código en caché persistida.` : "Falta dirección o código de reserva en la caché persistida.",
  });

  try {
    const ledger = await loadCachedLedgerSnapshot<{ baseCurrency?: unknown }>(ownerId, String(tripId));
    const base = ledger?.baseCurrency;
    const fx = typeof base === "string" && /^[A-Z]{3}$/.test(base)
      ? await loadLatestFxRates(ownerId, `${tripId}:${base}`)
      : null;
    const valid = fx && /^\d{4}-\d{2}-\d{2}$/.test(fx.date) &&
      Object.keys(fx.rates).length > 0 &&
      Object.values(fx.rates).every(rate => typeof rate === "number" && Number.isFinite(rate) && rate > 0);
    checks.push({
      label: "Tipos de cambio en este dispositivo",
      state: valid ? "verified" : "missing",
      detail: valid ? `Cotizaciones ${base} guardadas el ${fx!.date}. Pueden estar desactualizadas.` : "No hay cotizaciones guardadas para la moneda base de este viaje.",
    });
  } catch {
    checks.push({ label: "Tipos de cambio en este dispositivo", state: "unverified", detail: "No se pudo leer el almacén local de cotizaciones." });
  }
  return { checks, ready: checks.every(check => check.state === "verified") };
}