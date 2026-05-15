import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import {
  ArrowLeft, Plane, ParkingCircle, Car, Building2, CalendarDays,
  FolderOpen, Pencil, Share2, Check,
} from "lucide-react";
import { useGetTrip, getGetTripQueryKey, useGenerateShareLink } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import TripProgressBar from "@/components/trip-progress-bar";
import EditTripDialog from "@/components/edit-trip-dialog";
import FlightsModule from "@/components/modules/flights-module";
import ParkingModule from "@/components/modules/parking-module";
import RentalsModule from "@/components/modules/rentals-module";
import AccommodationsModule from "@/components/modules/accommodations-module";
import ItineraryModule from "@/components/modules/itinerary-module";
import DocumentsModule from "@/components/modules/documents-module";
import { useToast } from "@/hooks/use-toast";

const MODULES = [
  { id: "flights",       label: "Logística Aérea",     shortLabel: "Vuelos",    icon: Plane },
  { id: "parking",       label: "Estacionamiento",     shortLabel: "Parking",   icon: ParkingCircle },
  { id: "rental",        label: "Alquiler de Vehículo", shortLabel: "Alquiler", icon: Car },
  { id: "accommodation", label: "Alojamiento",          shortLabel: "Estancia", icon: Building2 },
  { id: "itinerary",     label: "Itinerario",           shortLabel: "Plan",     icon: CalendarDays },
  { id: "vault",         label: "Documentos",           shortLabel: "Docs",     icon: FolderOpen },
] as const;

type ModuleId = typeof MODULES[number]["id"];
const VALID_IDS = MODULES.map((m) => m.id) as string[];

function ShareButton({ tripId }: { tripId: number }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const generateLink = useGenerateShareLink({
    mutation: {
      onSuccess: (data) => {
        const url = `${window.location.origin}${import.meta.env.BASE_URL}share/${data.shareToken}`;
        navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
          toast({ title: "¡Enlace copiado!", description: "Comparte este enlace para una vista de solo lectura." });
        });
      },
      onError: () => {
        toast({ title: "Error", description: "No se pudo generar el enlace.", variant: "destructive" });
      },
    },
  });

  return (
    <button
      onClick={() => generateLink.mutate({ tripId })}
      disabled={generateLink.isPending}
      className="p-2 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors flex-shrink-0 flex items-center gap-1.5"
      data-testid="button-share-trip"
      title="Share trip"
    >
      {copied
        ? <Check className="w-4 h-4 text-emerald-400" />
        : <Share2 className="w-4 h-4" />}
      <span className="hidden sm:inline text-xs font-medium">{copied ? "¡Copiado!" : "Compartir"}</span>
    </button>
  );
}

export default function TripDetail() {
  // Both /trips/:tripId and /trips/:tripId/:module render this component.
  // useParams returns whichever params are present in the matched route.
  const { tripId: tripIdStr, module: moduleParam } = useParams<{
    tripId: string;
    module?: string;
  }>();
  const tripId = parseInt(tripIdStr ?? "0", 10);
  const [, navigate] = useLocation();
  const [editOpen, setEditOpen] = useState(false);

  // Derive active module purely from URL — no state needed.
  // This means browser back/forward and page refresh all work correctly.
  const activeModule: ModuleId = VALID_IDS.includes(moduleParam ?? "")
    ? (moduleParam as ModuleId)
    : "flights";

  // If the URL has no module segment, redirect to /trips/:id/flights so the
  // URL always reflects the current section.
  useEffect(() => {
    if (tripId && !moduleParam) {
      navigate(`/trips/${tripId}/flights`, { replace: true });
    }
  }, [tripId, moduleParam, navigate]);

  function handleModuleChange(mod: ModuleId) {
    navigate(`/trips/${tripId}/${mod}`);
    // Scroll the main content area to the top when switching sections.
    document.getElementById("module-main")?.scrollTo({ top: 0, behavior: "instant" });
  }

  const { data: trip, isLoading } = useGetTrip(tripId, {
    query: { enabled: !!tripId, queryKey: getGetTripQueryKey(tripId) },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="h-14 bg-sidebar border-b border-border flex items-center gap-3 px-4">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="hidden md:flex w-56 border-r border-border bg-sidebar p-4 flex-col gap-2">
            {MODULES.map((m) => <Skeleton key={m.id} className="h-9 w-full" />)}
          </div>
          <div className="flex-1 p-5 space-y-4">
            <Skeleton className="h-5 w-full max-w-sm" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold">Trip not found</p>
          <Link href="/">
            <span className="text-primary text-sm underline mt-2 inline-block">Back to dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Top header ── */}
      <header className="border-b border-border bg-sidebar text-sidebar-foreground sticky top-0 z-20">
        <div className="px-3 sm:px-5 h-14 flex items-center gap-2">
          {/* Back */}
          <Link href="/">
            <button
              className="p-2 rounded-md hover:bg-sidebar-accent transition-colors flex-shrink-0"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <h1
              className="font-bold text-sm sm:text-base leading-tight truncate"
              data-testid="text-trip-name"
            >
              {trip.name}
            </h1>
            <p className="text-xs text-sidebar-foreground/60 truncate leading-tight">{trip.destination}</p>
          </div>

          {/* Action buttons */}
          <ShareButton tripId={tripId} />

          <button
            onClick={() => setEditOpen(true)}
            className="p-2 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors flex-shrink-0 flex items-center gap-1.5"
            data-testid="button-edit-trip"
            title="Editar viaje"
          >
            <Pencil className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-medium">Editar</span>
          </button>
        </div>
      </header>

      {/* ── Body: sidebar (desktop) + content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — desktop only */}
        <nav
          className="hidden md:flex w-56 border-r border-border bg-sidebar text-sidebar-foreground flex-shrink-0 flex-col py-4 px-3 gap-1"
          data-testid="nav-modules"
        >
          {MODULES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleModuleChange(id)}
              data-testid={`nav-module-${id}`}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left w-full ${
                activeModule === id
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* Main content */}
        <main id="module-main" className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 md:pb-6">
          {/* Progress bar */}
          <div className="mb-5">
            <TripProgressBar tripId={tripId} />
          </div>

          {/* Active module — key forces remount on switch, triggering the fade-in */}
          <div key={activeModule} className="max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            {activeModule === "flights"       && <FlightsModule tripId={tripId} />}
            {activeModule === "parking"       && <ParkingModule tripId={tripId} />}
            {activeModule === "rental"        && <RentalsModule tripId={tripId} />}
            {activeModule === "accommodation" && <AccommodationsModule tripId={tripId} />}
            {activeModule === "itinerary"     && <ItineraryModule tripId={tripId} />}
            {activeModule === "vault"         && <DocumentsModule tripId={tripId} />}
          </div>
        </main>
      </div>

      {/* ── Bottom tab bar — mobile only ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-sidebar border-t border-border flex"
        data-testid="nav-modules"
      >
        {MODULES.map(({ id, shortLabel, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleModuleChange(id)}
            data-testid={`nav-module-${id}`}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
              activeModule === id
                ? "text-sidebar-primary-foreground bg-sidebar-primary/20"
                : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
            }`}
          >
            <Icon className={`w-5 h-5 flex-shrink-0 ${activeModule === id ? "text-primary" : ""}`} />
            <span className={`text-[9px] font-medium leading-tight ${activeModule === id ? "text-primary" : ""}`}>
              {shortLabel}
            </span>
          </button>
        ))}
      </nav>

      {/* Edit dialog */}
      <EditTripDialog trip={trip} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}
