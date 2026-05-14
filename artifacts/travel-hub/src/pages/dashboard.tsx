import { Link } from "wouter";
import { PlusCircle, MapPin, Calendar, Plane } from "lucide-react";
import { useListTrips } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import TripProgressBar from "@/components/trip-progress-bar";

function statusLabel(status: string) {
  if (status === "upcoming") return { label: "Upcoming", className: "bg-sky-100 text-sky-700 border-sky-200" };
  if (status === "ongoing") return { label: "Ongoing", className: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  return { label: "Completed", className: "bg-slate-100 text-slate-500 border-slate-200" };
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

export default function Dashboard() {
  const { data: trips, isLoading } = useListTrips();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plane className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold tracking-tight">TravelHub</span>
          </div>
          <Link href="/trips/new">
            <Button data-testid="button-new-trip" className="gap-2">
              <PlusCircle className="w-4 h-4" />
              New Trip
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">My Trips</h1>
          <p className="text-muted-foreground mt-1 text-sm">All your travel plans in one place</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                <Skeleton className="h-44 w-full rounded-none" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-full mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : trips && trips.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {trips.map((trip) => {
              const { label, className } = statusLabel(trip.status);
              return (
                <Link key={trip.id} href={`/trips/${trip.id}`} data-testid={`card-trip-${trip.id}`}>
                  <div className="rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow cursor-pointer group">
                    {/* Cover Image */}
                    <div className="relative h-44 bg-muted overflow-hidden">
                      {trip.coverImage ? (
                        <img
                          src={trip.coverImage}
                          alt={trip.destination}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                          <Plane className="w-12 h-12 text-primary/40" />
                        </div>
                      )}
                      <div className="absolute top-3 right-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${className} backdrop-blur-sm bg-white/80`}>
                          {label}
                        </span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <h2 className="font-semibold text-base leading-tight truncate" data-testid={`text-trip-name-${trip.id}`}>
                        {trip.name}
                      </h2>
                      <div className="flex items-center gap-1 text-muted-foreground mt-1">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="text-sm truncate">{trip.destination}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
                        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="text-sm">{formatDateRange(trip.startDate, trip.endDate)}</span>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3">
                        <TripProgressBar tripId={trip.id} compact />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Plane className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">No trips yet</h2>
            <p className="text-muted-foreground text-sm mt-1 mb-6">Start planning your first adventure</p>
            <Link href="/trips/new">
              <Button className="gap-2">
                <PlusCircle className="w-4 h-4" />
                Create your first trip
              </Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
