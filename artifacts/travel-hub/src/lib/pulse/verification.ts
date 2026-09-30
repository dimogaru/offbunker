import { getListFlightsQueryKey, getListAccommodationsQueryKey, getListDocumentsQueryKey } from "@workspace/api-client-react";
import type { Flight, Accommodation, Document } from "@workspace/api-client-react";
import { persistedQueryCacheKey } from "@/lib/query-cache";
import { listLocalDocuments } from "@/lib/local-documents";
import { loadCachedLedgerSnapshot, loadLatestFxRates } from "@/lib/expenses/offline-store";

export type CheckState = "verified" | "missing" | "unverified";
export interface PulseCheck { label: string; state: CheckState; detail: string }
export interface PulseResult { checks: PulseCheck[]; ready: boolean }

type DescribedDocument = { module: string; name: string; notes?: string | null; fileType: string };
const isPassport = (doc: DescribedDocument) => /\b(pasaportes?|passports?)\b/i.test(`${doc.name} ${doc.notes ?? ""}`);
const isReservationPdf = (doc: DescribedDocument) =>
  (doc.fileType.toLowerCase().includes("pdf") || /\.pdf$/i.test(doc.name)) &&
  (["flights", "accommodation", "rental", "parking", "itinerary"].includes(doc.module) ||
    (doc.module === "vault" && /\b(reservas?|reservaci[oó]n|confirmaci[oó]n|booking|hotel)\b/i.test(`${doc.name} ${doc.notes ?? ""}`)));

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
  let remoteDocuments: Document[] | null = null;
  try {
    flights = savedQuery<Flight[]>(ownerId, getListFlightsQueryKey(tripId));
    accommodations = savedQuery<Accommodation[]>(ownerId, getListAccommodationsQueryKey(tripId));
    const documents = savedQuery<Document[]>(ownerId, getListDocumentsQueryKey(tripId));
    if (Array.isArray(documents) && documents.every(doc => doc.tripId === tripId)) remoteDocuments = documents;
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

  let localDocuments: Awaited<ReturnType<typeof listLocalDocuments>> | null = null;
  try {
    localDocuments = await listLocalDocuments(ownerId, tripId);
  } catch {
    // A failed IndexedDB read cannot establish local availability.
  }
  const availableRemoteIds = new Set<number>();
  let remoteCacheReadable = false;
  if (remoteDocuments && typeof caches !== "undefined") {
    try {
      const cache = await caches.open("travelhub-uploads-v2");
      remoteCacheReadable = true;
      for (const doc of remoteDocuments) {
        if (typeof doc.fileUrl !== "string" || !/^\/(?:api\/)?uploads\//.test(doc.fileUrl)) continue;
        const response = await cache.match(doc.fileUrl);
        if (response?.ok && (await response.clone().blob()).size > 0) availableRemoteIds.add(doc.id);
      }
    } catch {
      remoteCacheReadable = false;
    }
  }
  const localAvailable = (doc: { blob: Blob }) => doc.blob instanceof Blob && doc.blob.size > 0;
  const allTickets = flightsValid && flights!.every(f =>
    (localDocuments?.some(doc => doc.module === "flights" && doc.notes === `flightId:${f.id}` && localAvailable(doc)) ?? false) ||
    (remoteDocuments?.some(doc => doc.module === "flights" && doc.notes === `flightId:${f.id}` && availableRemoteIds.has(doc.id)) ?? false),
  );
  checks.push({
    label: "Archivos de billetes disponibles",
    state: allTickets ? "verified" : "unverified",
    detail: allTickets
      ? "Hay un archivo local o en caché asociado a cada vuelo; no se verifica el contenido del billete."
      : "No se pudo confirmar un archivo descargado para cada vuelo. Un enlace no demuestra que esté disponible sin conexión.",
  });

  for (const { label, matches } of [
    { label: "Pasaportes disponibles sin conexión", matches: isPassport },
    { label: "PDFs de reservas disponibles sin conexión", matches: isReservationPdf },
  ]) {
    const localMatches = localDocuments?.filter(matches) ?? [];
    const remoteMatches = remoteDocuments?.filter(matches) ?? [];
    const complete = localMatches.length + remoteMatches.length > 0 &&
      localMatches.every(localAvailable) &&
      remoteMatches.every(doc => availableRemoteIds.has(doc.id));
    const state: CheckState = !localDocuments || !remoteDocuments || !remoteCacheReadable
      ? "unverified" : complete ? "verified" : "missing";
    checks.push({
      label,
      state,
      detail: state === "verified"
        ? `${localMatches.length + remoteMatches.length} archivo(s) etiquetado(s) y con bytes disponibles en este dispositivo; no se valida su contenido, identidad ni vigencia.`
        : !remoteDocuments
          ? "No hay una lista persistida de documentos del viaje: no se puede confirmar que estén todos descargados."
          : !localDocuments || !remoteCacheReadable
            ? "No se pudo leer el almacén local o la caché de archivos; disponibilidad no verificada."
            : "Faltan archivos etiquetados de este tipo o alguno no tiene una copia local utilizable.",
    });
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