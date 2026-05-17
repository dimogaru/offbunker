import { useEffect } from "react";
import { useRoute } from "wouter";
import {
  useGetTrip, getGetTripQueryKey,
  useListFlights, getListFlightsQueryKey,
  useListParkings, getListParkingsQueryKey,
  useListRentals, getListRentalsQueryKey,
  useListAccommodations, getListAccommodationsQueryKey,
  useListItineraryItems, getListItineraryItemsQueryKey,
  useListDocuments, getListDocumentsQueryKey,
} from "@workspace/api-client-react";
import { Plane, ParkingCircle, Car, Building2, CalendarDays, FolderOpen, MapPin, Clock, FileText } from "lucide-react";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function parseDate(str: string) {
  if (!str) return new Date(NaN);
  return str.includes("T") ? new Date(str) : new Date(str + "T12:00:00Z");
}
function fmtDate(str: string) {
  return parseDate(str).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}
function fmtShortDate(str: string) {
  return parseDate(str).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

const CATEGORY_LABELS: Record<string, string> = {
  transport: "Transport", sightseeing: "Sightseeing", dining: "Dining",
  activity: "Activity", accommodation: "Accommodation", other: "Other",
};
const TYPE_LABELS: Record<string, string> = {
  hotel: "Hotel", airbnb: "Airbnb", hostel: "Hostel", other: "Other",
};
const MODULE_LABELS: Record<string, string> = {
  flights: "Flights", parking: "Parking", rental: "Vehicle Rental",
  accommodation: "Accommodation", itinerary: "Itinerary", vault: "General",
};

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section className="section">
      <div className="section-header">
        <Icon size={16} />
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function TripExport() {
  const [, params] = useRoute("/trips/:tripId/export");
  const tripId = parseInt(params?.tripId ?? "0", 10);

  const { data: trip }           = useGetTrip(tripId,           { query: { enabled: !!tripId, queryKey: getGetTripQueryKey(tripId) } });
  const { data: flights }        = useListFlights(tripId,        { query: { enabled: !!tripId, queryKey: getListFlightsQueryKey(tripId) } });
  const { data: parkings }       = useListParkings(tripId,       { query: { enabled: !!tripId, queryKey: getListParkingsQueryKey(tripId) } });
  const { data: rentals }        = useListRentals(tripId,        { query: { enabled: !!tripId, queryKey: getListRentalsQueryKey(tripId) } });
  const { data: accommodations } = useListAccommodations(tripId, { query: { enabled: !!tripId, queryKey: getListAccommodationsQueryKey(tripId) } });
  const { data: itinerary }      = useListItineraryItems(tripId, { query: { enabled: !!tripId, queryKey: getListItineraryItemsQueryKey(tripId) } });
  const { data: documents }      = useListDocuments(tripId,      { query: { enabled: !!tripId, queryKey: getListDocumentsQueryKey(tripId) } });

  const allLoaded = trip && flights && parkings && rentals && accommodations && itinerary && documents;

  useEffect(() => {
    if (!allLoaded) return;
    const timer = setTimeout(() => window.print(), 600);
    return () => clearTimeout(timer);
  }, [allLoaded]);

  if (!allLoaded) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui, sans-serif", color: "#555" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 18, fontWeight: 600 }}>Preparing your offline document…</p>
          <p style={{ fontSize: 13, marginTop: 6 }}>The print dialog will open automatically.</p>
        </div>
      </div>
    );
  }

  const itineraryByDate = itinerary.reduce((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {} as Record<string, typeof itinerary>);
  const sortedDates = Object.keys(itineraryByDate).sort();

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; background: #fff; }

        .page { max-width: 800px; margin: 0 auto; padding: 32px 40px; }

        /* Hero header */
        .hero { border-bottom: 2px solid #1a4a4a; padding-bottom: 20px; margin-bottom: 24px; }
        .hero h1 { font-size: 26pt; font-weight: 700; color: #1a4a4a; }
        .hero-sub { display: flex; gap: 24px; margin-top: 8px; font-size: 10pt; color: #555; flex-wrap: wrap; }
        .hero-sub span { display: flex; align-items: center; gap: 5px; }
        .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 9pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 6px; }
        .badge-upcoming { background: #e0f2fe; color: #0369a1; }
        .badge-ongoing  { background: #d1fae5; color: #065f46; }
        .badge-completed{ background: #f1f5f9; color: #475569; }

        .branding { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; font-size: 9pt; color: #888; }
        .branding strong { color: #1a4a4a; font-size: 11pt; }
        .generated-at { font-size: 8pt; color: #aaa; }

        /* Sections */
        .section { margin-bottom: 28px; break-inside: avoid; }
        .section-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #d0e4e4; }
        .section-header h2 { font-size: 12pt; font-weight: 700; color: #1a4a4a; }

        /* Cards */
        .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-bottom: 8px; break-inside: avoid; }
        .card-title { font-weight: 700; font-size: 11pt; margin-bottom: 4px; }
        .tag { display: inline-block; background: #e0f2fe; color: #0369a1; border-radius: 4px; padding: 1px 6px; font-size: 8pt; font-weight: 600; font-family: monospace; margin-left: 6px; }
        .tag-neutral { background: #f1f5f9; color: #475569; }
        .meta { font-size: 9pt; color: #555; margin-top: 3px; }

        /* Flight route */
        .flight-route { display: flex; align-items: center; gap: 10px; margin: 8px 0; }
        .airport { text-align: center; }
        .airport-code { font-size: 15pt; font-weight: 800; color: #1a4a4a; }
        .airport-time { font-size: 8pt; color: #555; margin-top: 2px; }
        .route-line { flex: 1; border-top: 1px solid #cbd5e1; display: flex; align-items: center; justify-content: center; }

        /* Grid */
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 6px; }
        .grid-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 2px; }
        .grid-value { font-size: 10pt; font-weight: 500; }
        .grid-sub { font-size: 8.5pt; color: #555; }

        /* Itinerary */
        .day-header { font-weight: 700; font-size: 11pt; color: #1a4a4a; margin: 16px 0 8px; padding-left: 10px; border-left: 3px solid #1a4a4a; }
        .activity { padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 6px; }
        .activity-header { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
        .activity-time { font-size: 9pt; color: #555; display: flex; align-items: center; gap: 3px; }
        .category-tag { display: inline-block; border-radius: 4px; padding: 1px 7px; font-size: 8pt; font-weight: 600; }
        .cat-transport { background: #dbeafe; color: #1d4ed8; }
        .cat-sightseeing { background: #ede9fe; color: #6d28d9; }
        .cat-dining { background: #ffedd5; color: #c2410c; }
        .cat-activity { background: #d1fae5; color: #065f46; }
        .cat-accommodation { background: #dbeafe; color: #1d4ed8; }
        .cat-other { background: #f1f5f9; color: #475569; }

        /* Documents */
        .doc-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 6px; }
        .doc-icon { width: 32px; height: 32px; background: #f1f5f9; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .doc-name { font-weight: 600; font-size: 10pt; }
        .doc-meta { font-size: 8.5pt; color: #555; }
        .doc-url { font-size: 8.5pt; color: #0369a1; word-break: break-all; margin-top: 2px; }

        /* Footer */
        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 8.5pt; color: #aaa; }

        /* Print */
        @media print {
          .no-print { display: none !important; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .page { padding: 20px; max-width: 100%; }
          .section { break-inside: avoid; }
          .card { break-inside: avoid; }
        }

        @page { margin: 15mm; size: A4; }
      `}</style>

      <div className="page">
        {/* Print / Save button — hidden in print */}
        <div className="no-print" style={{ marginBottom: 20, display: "flex", gap: 10 }}>
          <button
            onClick={() => window.print()}
            style={{ padding: "8px 18px", background: "#1a4a4a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}
          >
            ⬇ Save as PDF / Print
          </button>
          <button
            onClick={() => window.close()}
            style={{ padding: "8px 18px", background: "#f1f5f9", color: "#333", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", fontSize: 13 }}
          >
            Close
          </button>
        </div>

        {/* Branding row */}
        <div className="branding">
          <div><strong>TravelHub</strong> — Trip Document</div>
          <div className="generated-at">Generated {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
        </div>

        {/* Hero */}
        <div className="hero">
          <h1>{trip.name}</h1>
          <div className="hero-sub">
            <span><MapPin size={13} /> {trip.destination}</span>
            <span>📅 {fmtShortDate(trip.startDate)} – {fmtShortDate(trip.endDate)}</span>
          </div>
          <div>
            <span className={`badge badge-${trip.status}`}>{trip.status}</span>
          </div>
          {trip.notes && <p style={{ marginTop: 10, fontSize: "9.5pt", color: "#555", fontStyle: "italic" }}>{trip.notes}</p>}
        </div>

        {/* Flights */}
        {flights.length > 0 && (
          <Section title="Air Logistics" icon={Plane}>
            {flights.map(f => (
              <div key={f.id} className="card">
                <div className="card-title">
                  {f.airline}
                  <span className="tag">{f.flightNumber}</span>
                  {f.seat && <span className="tag tag-neutral">Seat {f.seat}</span>}
                </div>
                <div className="flight-route">
                  <div className="airport">
                    <div className="airport-code">{f.departureAirport}</div>
                    <div className="airport-time">{fmt(f.departureTime)}</div>
                  </div>
                  <div className="route-line">✈</div>
                  <div className="airport" style={{ textAlign: "right" }}>
                    <div className="airport-code">{f.arrivalAirport}</div>
                    <div className="airport-time">{fmt(f.arrivalTime)}</div>
                  </div>
                </div>
                {(f.terminal || f.gate) && (
                  <div className="meta">
                    {f.terminal && `Terminal ${f.terminal}`}{f.terminal && f.gate && " · "}{f.gate && `Gate ${f.gate}`}
                  </div>
                )}
                {f.notes && <div className="meta" style={{ marginTop: 4, fontStyle: "italic" }}>{f.notes}</div>}
              </div>
            ))}
          </Section>
        )}

        {/* Parking */}
        {parkings.length > 0 && (
          <Section title="Airport Parking" icon={ParkingCircle}>
            {parkings.map(p => (
              <div key={p.id} className="card">
                <div className="card-title">
                  {p.location}
                  <span className="tag">{p.reservationCode}</span>
                  {p.priceTotal && <span className="tag tag-neutral">${Number(p.priceTotal).toFixed(2)}</span>}
                </div>
                <div className="grid-2">
                  <div>
                    <div className="grid-label">Entry</div>
                    <div className="grid-value">{fmt(p.entryDate)}</div>
                  </div>
                  <div>
                    <div className="grid-label">Exit</div>
                    <div className="grid-value">{fmt(p.exitDate)}</div>
                  </div>
                </div>
                {p.notes && <div className="meta" style={{ marginTop: 6, fontStyle: "italic" }}>{p.notes}</div>}
              </div>
            ))}
          </Section>
        )}

        {/* Rentals */}
        {rentals.length > 0 && (
          <Section title="Vehicle Rental" icon={Car}>
            {rentals.map(r => (
              <div key={r.id} className="card">
                <div className="card-title">
                  {r.company}
                  {r.vehicleType && <span className="tag tag-neutral">{r.vehicleType}</span>}
                  {r.confirmationCode && <span className="tag">{r.confirmationCode}</span>}
                </div>
                <div className="grid-2">
                  <div>
                    <div className="grid-label">Pickup</div>
                    <div className="grid-value">{r.pickupLocation}</div>
                    <div className="grid-sub">{fmt(r.pickupDate)}</div>
                  </div>
                  <div>
                    <div className="grid-label">Return</div>
                    <div className="grid-value">{r.returnLocation || r.pickupLocation}</div>
                    <div className="grid-sub">{fmt(r.returnDate)}</div>
                  </div>
                </div>
                <div className="meta" style={{ marginTop: 6 }}>Fuel policy: {r.fuelPolicy}</div>
                {r.notes && <div className="meta" style={{ fontStyle: "italic" }}>{r.notes}</div>}
              </div>
            ))}
          </Section>
        )}

        {/* Accommodations */}
        {accommodations.length > 0 && (
          <Section title="Accommodation" icon={Building2}>
            {accommodations.map(a => (
              <div key={a.id} className="card">
                <div className="card-title">
                  {a.name}
                  {a.type && <span className="tag tag-neutral">{TYPE_LABELS[a.type] ?? a.type}</span>}
                  <span className="tag">{a.confirmationCode}</span>
                </div>
                <div className="meta">{a.address}</div>
                <div className="grid-2" style={{ marginTop: 8 }}>
                  <div>
                    <div className="grid-label">Check-in</div>
                    <div className="grid-value">{fmt(a.checkIn)}</div>
                  </div>
                  <div>
                    <div className="grid-label">Check-out</div>
                    <div className="grid-value">{fmt(a.checkOut)}</div>
                  </div>
                </div>
                {a.contactPhone && <div className="meta" style={{ marginTop: 6 }}>📞 {a.contactPhone}</div>}
                {a.notes && <div className="meta" style={{ fontStyle: "italic" }}>{a.notes}</div>}
              </div>
            ))}
          </Section>
        )}

        {/* Itinerary */}
        {sortedDates.length > 0 && (
          <Section title="Day-by-Day Itinerary" icon={CalendarDays}>
            {sortedDates.map(date => (
              <div key={date}>
                <div className="day-header">{fmtDate(date)}</div>
                {itineraryByDate[date]
                  .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
                  .map(item => (
                    <div key={item.id} className="activity">
                      <div className="activity-header">
                        {item.time && (
                          <span className="activity-time">
                            <Clock size={11} /> {item.time}
                          </span>
                        )}
                        <span className={`category-tag cat-${item.category || "other"}`}>
                          {CATEGORY_LABELS[item.category || "other"]}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: "10pt" }}>{item.title}</div>
                      {item.location && <div className="meta">📍 {item.location}</div>}
                      {item.description && <div className="meta" style={{ fontStyle: "italic" }}>{item.description}</div>}
                    </div>
                  ))}
              </div>
            ))}
          </Section>
        )}

        {/* Documents */}
        {documents.length > 0 && (
          <Section title="Document Vault" icon={FolderOpen}>
            {documents.map(doc => (
              <div key={doc.id} className="doc-item">
                <div className="doc-icon">
                  <FileText size={16} color="#64748b" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="doc-name">{doc.name}</div>
                  <div className="doc-meta">{doc.fileType} · {MODULE_LABELS[doc.module] ?? doc.module}</div>
                  {doc.fileUrl && <div className="doc-url">{doc.fileUrl}</div>}
                  {doc.notes && <div className="meta" style={{ fontStyle: "italic" }}>{doc.notes}</div>}
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* Footer */}
        <div className="footer">
          <span>TravelHub — trip planning made simple</span>
          <span>{trip.name} · {fmtShortDate(trip.startDate)} – {fmtShortDate(trip.endDate)}</span>
        </div>
      </div>
    </>
  );
}
