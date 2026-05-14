import { useState } from "react";
import { Link } from "wouter";
import { PlusCircle, MapPin, Calendar, Plane, Trash2, Pencil } from "lucide-react";
import { useListTrips, useDeleteTrip, getListTripsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import TripProgressBar from "@/components/trip-progress-bar";
import EditTripDialog from "@/components/edit-trip-dialog";
import { useToast } from "@/hooks/use-toast";

interface Trip {
  id: number;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: string;
  coverImage?: string | null;
  notes?: string | null;
}

function statusLabel(status: string) {
  if (status === "upcoming") return { label: "Próximo", className: "bg-sky-100 text-sky-700 border-sky-200" };
  if (status === "ongoing") return { label: "En curso", className: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  return { label: "Completado", className: "bg-slate-100 text-slate-500 border-slate-200" };
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("es-ES", opts)} – ${e.toLocaleDateString("es-ES", { ...opts, year: "numeric" })}`;
}

export default function Dashboard() {
  const { data: trips, isLoading } = useListTrips();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deletingTrip, setDeletingTrip] = useState<Trip | null>(null);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);

  const deleteTrip = useDeleteTrip({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTripsQueryKey() });
        toast({ title: "Viaje eliminado", description: `${deletingTrip?.name} ha sido eliminado.` });
        setDeletingTrip(null);
      },
      onError: () => {
        toast({ title: "Error", description: "No se pudo eliminar el viaje.", variant: "destructive" });
      },
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plane className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold tracking-tight">TravelHub</span>
          </div>
          <Link href="/trips/new">
            <Button data-testid="button-new-trip" className="gap-2">
              <PlusCircle className="w-4 h-4" />
              Nuevo Viaje
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Mis Viajes</h1>
          <p className="text-muted-foreground mt-1 text-sm">Todos tus planes de viaje en un lugar</p>
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
                <div
                  key={trip.id}
                  className="rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow group relative"
                  data-testid={`card-trip-${trip.id}`}
                >
                  <div className="absolute top-3 left-3 z-10 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingTrip(trip as Trip); }}
                      className="w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-primary transition-colors"
                      data-testid={`button-edit-trip-${trip.id}`}
                      title="Editar viaje"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeletingTrip(trip as Trip); }}
                      className="w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-destructive transition-colors"
                      data-testid={`button-delete-trip-${trip.id}`}
                      title="Eliminar viaje"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <Link href={`/trips/${trip.id}`}>
                    <div className="cursor-pointer">
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
                        <div className="mt-3">
                          <TripProgressBar tripId={trip.id} compact />
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Plane className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">Sin viajes todavía</h2>
            <p className="text-muted-foreground text-sm mt-1 mb-6">Empieza a planificar tu primera aventura</p>
            <Link href="/trips/new">
              <Button className="gap-2">
                <PlusCircle className="w-4 h-4" />
                Crear tu primer viaje
              </Button>
            </Link>
          </div>
        )}
      </main>

      <EditTripDialog
        trip={editingTrip}
        open={!!editingTrip}
        onOpenChange={(open) => { if (!open) setEditingTrip(null); }}
      />

      <AlertDialog open={!!deletingTrip} onOpenChange={(open) => { if (!open) setDeletingTrip(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{deletingTrip?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente el viaje y todos sus datos — vuelos, estacionamiento, alquileres, alojamiento, itinerario y documentos. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deletingTrip && deleteTrip.mutate({ tripId: deletingTrip.id })}
              disabled={deleteTrip.isPending}
            >
              {deleteTrip.isPending ? "Eliminando..." : "Eliminar viaje"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
