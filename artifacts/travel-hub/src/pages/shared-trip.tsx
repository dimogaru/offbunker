import { useRoute } from "wouter";
import { useGetSharedTrip } from "@workspace/api-client-react";
import { Plane, ParkingCircle, Car, Building2, CalendarDays, FolderOpen, MapPin, Calendar, Clock, FileText, MapPin as MapPinIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtDate(str: string) {
  return new Date(str + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
function fmtDateRange(s: string, e: string) {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${new Date(s).toLocaleDateString("en-US", opts)} – ${new Date(e).toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  upcoming: { label: "Upcoming", cls: "bg-sky-100 text-sky-700 border-sky-200" },
  ongoing: { label: "Ongoing", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  completed: { label: "Completed", cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

const CATEGORY_COLORS: Record<string, string> = {
  transport: "bg-sky-100 text-sky-700",
  sightseeing: "bg-violet-100 text-violet-700",
  dining: "bg-orange-100 text-orange-700",
  activity: "bg-emerald-100 text-emerald-700",
  accommodation: "bg-blue-100 text-blue-700",
  other: "bg-slate-100 text-slate-600",
};

const MODULE_DOC_COLORS: Record<string, string> = {
  flights: "bg-sky-100 text-sky-700",
  parking: "bg-amber-100 text-amber-700",
  rental: "bg-violet-100 text-violet-700",
  accommodation: "bg-blue-100 text-blue-700",
  itinerary: "bg-emerald-100 text-emerald-700",
  vault: "bg-slate-100 text-slate-600",
};

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

export default function SharedTrip() {
  const [, params] = useRoute("/share/:token");
  const token = params?.token ?? "";

  const { data, isLoading, isError } = useGetSharedTrip(token, {
    query: { enabled: !!token },
  });

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

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Plane className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <h1 className="text-lg font-semibold">Trip not found</h1>
          <p className="text-muted-foreground text-sm mt-1">This share link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  const { trip, flights, parkings, rentals, accommodations, itinerary, documents } = data;
  const status = STATUS[trip.status] ?? STATUS.upcoming;

  // Group itinerary by date
  const itineraryByDate = itinerary.reduce((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {} as Record<string, typeof itinerary>);
  const sortedDates = Object.keys(itineraryByDate).sort();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero cover */}
      <div className="relative h-56 sm:h-72 bg-muted overflow-hidden">
        {trip.coverImage ? (
          <img src={trip.coverImage} alt={trip.destination} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <Plane className="w-16 h-16 text-primary/30" />
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        {/* Trip info overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-8 pb-5">
          <div className="flex items-end justify-between">
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

      {/* Shared badge */}
      <div className="bg-primary/5 border-b border-primary/10 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plane className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-primary">TravelHub</span>
          <span className="text-xs text-muted-foreground">— shared trip (read-only)</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="w-3.5 h-3.5" />
          {fmtDateRange(trip.startDate, trip.endDate)}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {/* Flights */}
        {flights.length > 0 && (
          <Section icon={Plane} title="Air Logistics">
            <div className="space-y-3">
              {flights.map(f => (
                <div key={f.id} className="border border-border rounded-xl bg-card p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="font-semibold">{f.airline}</span>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">{f.flightNumber}</span>
                    {f.seat && <span className="text-xs text-muted-foreground">Seat {f.seat}</span>}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="text-center">
                      <p className="font-bold text-base">{f.departureAirport}</p>
                      <p className="text-xs text-muted-foreground">{fmt(f.departureTime)}</p>
                    </div>
                    <div className="flex-1 flex items-center gap-1">
                      <div className="h-px flex-1 bg-border" />
                      <Plane className="w-3.5 h-3.5 text-muted-foreground" />
                      <div className="h-px flex-1 bg-border" />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-base">{f.arrivalAirport}</p>
                      <p className="text-xs text-muted-foreground">{fmt(f.arrivalTime)}</p>
                    </div>
                  </div>
                  {(f.terminal || f.gate) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {f.terminal && `Terminal ${f.terminal}`}{f.terminal && f.gate && " · "}{f.gate && `Gate ${f.gate}`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Parking */}
        {parkings.length > 0 && (
          <Section icon={ParkingCircle} title="Airport Parking">
            <div className="space-y-3">
              {parkings.map(p => (
                <div key={p.id} className="border border-border rounded-xl bg-card p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="font-semibold">{p.location}</span>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">{p.reservationCode}</span>
                    {p.priceTotal && <span className="text-xs font-medium">${Number(p.priceTotal).toFixed(2)}</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div><span className="text-xs font-medium text-foreground">Entry</span><br />{fmt(p.entryDate)}</div>
                    <div><span className="text-xs font-medium text-foreground">Exit</span><br />{fmt(p.exitDate)}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Rentals */}
        {rentals.length > 0 && (
          <Section icon={Car} title="Vehicle Rental">
            <div className="space-y-3">
              {rentals.map(r => (
                <div key={r.id} className="border border-border rounded-xl bg-card p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="font-semibold">{r.company}</span>
                    {r.vehicleType && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{r.vehicleType}</span>}
                    {r.confirmationCode && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">{r.confirmationCode}</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-xs text-muted-foreground">Pickup</span><br />{r.pickupLocation}<br /><span className="text-xs text-muted-foreground">{fmt(r.pickupDate)}</span></div>
                    <div><span className="text-xs text-muted-foreground">Return</span><br />{r.returnLocation || r.pickupLocation}<br /><span className="text-xs text-muted-foreground">{fmt(r.returnDate)}</span></div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Fuel: {r.fuelPolicy}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Accommodations */}
        {accommodations.length > 0 && (
          <Section icon={Building2} title="Accommodation">
            <div className="space-y-3">
              {accommodations.map(a => (
                <div key={a.id} className="border border-border rounded-xl bg-card p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold">{a.name}</span>
                    {a.type && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full capitalize">{a.type}</span>}
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">{a.confirmationCode}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{a.address}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-xs text-muted-foreground">Check-in</span><br />{fmt(a.checkIn)}</div>
                    <div><span className="text-xs text-muted-foreground">Check-out</span><br />{fmt(a.checkOut)}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Itinerary */}
        {sortedDates.length > 0 && (
          <Section icon={CalendarDays} title="Itinerary">
            <div className="space-y-6">
              {sortedDates.map(date => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarDays className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-sm">{fmtDate(date)}</h3>
                  </div>
                  <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                    {itineraryByDate[date].sort((a, b) => (a.time || "").localeCompare(b.time || "")).map(item => (
                      <div key={item.id} className="border border-border rounded-lg bg-card p-3">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {item.time && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3" />{item.time}</span>}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[item.category || "other"]}`}>{item.category}</span>
                        </div>
                        <p className="font-medium text-sm">{item.title}</p>
                        {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                        {item.location && <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5"><MapPinIcon className="w-3 h-3" />{item.location}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Documents */}
        {documents.length > 0 && (
          <Section icon={FolderOpen} title="Documents">
            <div className="space-y-2">
              {documents.map(doc => (
                <div key={doc.id} className="border border-border rounded-lg bg-card p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{doc.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{doc.fileType}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${MODULE_DOC_COLORS[doc.module]}`}>{doc.module}</span>
                    </div>
                  </div>
                  {doc.fileUrl && (
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline flex-shrink-0">View</a>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-border text-center">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Plane className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-primary">TravelHub</span>
            <span className="text-xs">— travel planning made simple</span>
          </div>
        </div>
      </div>
    </div>
  );
}
