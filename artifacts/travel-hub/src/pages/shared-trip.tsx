import { useRoute } from "wouter";
import { useGetSharedTrip } from "@workspace/api-client-react";
import {
  Plane, ParkingCircle, Car, Building2, CalendarDays,
  MapPin, Calendar, Clock, ExternalLink,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/* ─── Formatters (es-ES locale) ──────────────────────────────── */

function fmt(iso: string) {
  return new Date(iso).toLocaleString("es-ES", {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtDate(str: string) {
  return new Date(str + "T00:00:00").toLocaleDateString("es-ES", {
    weekday: "long", month: "long", day: "numeric",
  });
}
function fmtDateRange(s: string, e: string) {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${new Date(s).toLocaleDateString("es-ES", opts)} – ${new Date(e).toLocaleDateString("es-ES", { ...opts, year: "numeric" })}`;
}
function mapsUrl(q: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q).replace(/%20/g, "+")}`;
}

/* ─── Labels ─────────────────────────────────────────────────── */

const STATUS: Record<string, { label: string; cls: string }> = {
  upcoming:  { label: "Próximo",    cls: "bg-sky-100     text-sky-700    border-sky-200" },
  ongoing:   { label: "En curso",   cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  completed: { label: "Completado", cls: "bg-slate-100   text-slate-500  border-slate-200" },
};

const CATEGORY_LABEL: Record<string, string> = {
  transport:     "Transporte",
  sightseeing:   "Turismo",
  dining:        "Restaurante",
  activity:      "Actividad",
  accommodation: "Alojamiento",
  other:         "Otro",
};

const CATEGORY_COLORS: Record<string, string> = {
  transport:     "bg-sky-100     text-sky-700",
  sightseeing:   "bg-violet-100  text-violet-700",
  dining:        "bg-orange-100  text-orange-700",
  activity:      "bg-emerald-100 text-emerald-700",
  accommodation: "bg-blue-100    text-blue-700",
  other:         "bg-slate-100   text-slate-600",
};

const TYPE_LABEL: Record<string, string> = {
  hotel:  "Hotel",
  airbnb: "Airbnb",
  hostel: "Hostel",
  other:  "Otro",
};

/* ─── Section wrapper ────────────────────────────────────────── */

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-primary" />
        <h2 className="text-base font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */

export default function SharedTrip() {
  const [, params] = useRoute("/share/:token");
  const token = params?.token ?? "";

  const { data, isLoading, isError } = useGetSharedTrip(token, {
    query: { enabled: !!token },
  });

  /* Loading */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  /* Error */
  if (isError || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center px-6">
          <Plane className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <h1 className="text-lg font-semibold">Viaje no encontrado</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Este enlace puede ser inválido o haber expirado.
          </p>
        </div>
      </div>
    );
  }

  const { trip, flights, parkings, rentals, accommodations, itinerary } = data;
  const status = STATUS[trip.status] ?? STATUS.upcoming;

  /* Group itinerary by date */
  const byDate = itinerary.reduce((acc, item) => {
    const day = item.date.substring(0, 10);
    if (!acc[day]) acc[day] = [];
    acc[day].push(item);
    return acc;
  }, {} as Record<string, typeof itinerary>);
  const sortedDates = Object.keys(byDate).sort();

  return (
    <div className="min-h-screen bg-background">

      {/* ── Hero cover ── */}
      <div className="relative h-56 sm:h-72 bg-muted overflow-hidden">
        {trip.coverImage ? (
          <img src={trip.coverImage} alt={trip.destination} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <Plane className="w-16 h-16 text-primary/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-8 pb-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">{trip.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <MapPin className="w-4 h-4 text-white/70" />
                <span className="text-white/80 text-sm">{trip.destination}</span>
              </div>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${status.cls} bg-white/90 backdrop-blur-sm flex-shrink-0`}>
              {status.label}
            </span>
          </div>
        </div>
      </div>

      {/* ── Shared banner ── */}
      <div className="bg-primary/5 border-b border-primary/10 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plane className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-primary">TravelHub</span>
          <span className="text-xs text-muted-foreground">— viaje compartido (solo lectura)</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="w-3.5 h-3.5" />
          {fmtDateRange(trip.startDate, trip.endDate)}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {/* Logística Aérea */}
        {flights.length > 0 && (
          <Section icon={Plane} title="Logística Aérea">
            <div className="space-y-3">
              {flights.map(f => (
                <div key={f.id} className="border border-border rounded-xl bg-card p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className="font-semibold">{f.airline}</span>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">{f.flightNumber}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm mb-2">
                    <div className="text-center min-w-[52px]">
                      <p className="font-bold text-xl leading-tight">{f.departureAirport}</p>
                      <p className="flex items-center justify-center gap-0.5 text-xs text-muted-foreground mt-0.5">
                        <Clock className="w-3 h-3" />{new Date(f.departureTime).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(f.departureTime).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <div className="flex-1 flex items-center gap-1">
                      <div className="h-px flex-1 bg-border" />
                      <Plane className="w-4 h-4 text-primary" />
                      <div className="h-px flex-1 bg-border" />
                    </div>
                    <div className="text-center min-w-[52px]">
                      <p className="font-bold text-xl leading-tight">{f.arrivalAirport}</p>
                      <p className="flex items-center justify-center gap-0.5 text-xs text-muted-foreground mt-0.5">
                        <Clock className="w-3 h-3" />{new Date(f.arrivalTime).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(f.arrivalTime).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  </div>
                  {(f.terminal || f.gate || f.seat) && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2 border-t border-border/50">
                      {f.terminal && <span>Terminal {f.terminal}</span>}
                      {f.gate    && <span>Puerta {f.gate}</span>}
                      {f.seat    && <span>Asiento {f.seat}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Estacionamiento */}
        {parkings.length > 0 && (
          <Section icon={ParkingCircle} title="Estacionamiento">
            <div className="space-y-3">
              {parkings.map(p => (
                <div key={p.id} className="border border-border rounded-xl bg-card p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="font-semibold">{p.location}</span>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">{p.reservationCode}</span>
                    {p.priceTotal && <span className="text-xs font-medium">{Number(p.priceTotal).toFixed(2)} €</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div><span className="text-xs font-medium text-foreground">Entrada</span><br />{fmt(p.entryDate)}</div>
                    <div><span className="text-xs font-medium text-foreground">Salida</span><br />{fmt(p.exitDate)}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Alquiler de Vehículo */}
        {rentals.length > 0 && (
          <Section icon={Car} title="Alquiler de Vehículo">
            <div className="space-y-3">
              {rentals.map(r => (
                <div key={r.id} className="border border-border rounded-xl bg-card p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="font-semibold">{r.company}</span>
                    {r.vehicleType     && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{r.vehicleType}</span>}
                    {r.confirmationCode && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">{r.confirmationCode}</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground">Recogida</span>
                      <p className="font-medium">{r.pickupLocation}</p>
                      <p className="text-xs text-muted-foreground">{fmt(r.pickupDate)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Devolución</span>
                      <p className="font-medium">{r.returnLocation || r.pickupLocation}</p>
                      <p className="text-xs text-muted-foreground">{fmt(r.returnDate)}</p>
                    </div>
                  </div>
                  {r.fuelPolicy && (
                    <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
                      Combustible: {r.fuelPolicy}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Alojamiento */}
        {accommodations.length > 0 && (
          <Section icon={Building2} title="Alojamiento">
            <div className="space-y-3">
              {accommodations.map(a => (
                <div key={a.id} className="border border-border rounded-xl bg-card p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold">{a.name}</span>
                    {a.type && (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                        {TYPE_LABEL[a.type] ?? a.type}
                      </span>
                    )}
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">{a.confirmationCode}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm text-muted-foreground flex-1 truncate">{a.address}</span>
                    <a href={mapsUrl(a.address)} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-0.5 text-xs text-primary hover:underline flex-shrink-0">
                      <ExternalLink className="w-3 h-3" />Maps
                    </a>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground">Entrada</span>
                      <p className="flex items-center gap-1 font-medium">
                        <Clock className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />{fmt(a.checkIn)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Salida</span>
                      <p className="flex items-center gap-1 font-medium">
                        <Clock className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />{fmt(a.checkOut)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Itinerario */}
        {sortedDates.length > 0 && (
          <Section icon={CalendarDays} title="Itinerario">
            <div className="space-y-6">
              {sortedDates.map((date, di) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarDays className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-sm capitalize">
                      Día {di + 1} · {fmtDate(date)}
                    </h3>
                  </div>
                  <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                    {byDate[date]
                      .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
                      .map(item => (
                        <div key={item.id} className="border border-border rounded-lg bg-card p-3">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            {item.time && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />{item.time}
                              </span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[item.category || "other"]}`}>
                              {CATEGORY_LABEL[item.category || "other"] ?? item.category}
                            </span>
                          </div>
                          <p className="font-medium text-sm">{item.title}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                          )}
                          {item.location && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              <span className="text-xs text-muted-foreground flex-1">{item.location}</span>
                              <a href={mapsUrl(item.location)} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-0.5 text-xs text-primary hover:underline flex-shrink-0">
                                <ExternalLink className="w-3 h-3" />Maps
                              </a>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Footer ── */}
        <div className="mt-12 pt-6 border-t border-border text-center">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Plane className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-primary">TravelHub</span>
            <span className="text-xs">— planificación de viajes simplificada</span>
          </div>
        </div>
      </div>
    </div>
  );
}
