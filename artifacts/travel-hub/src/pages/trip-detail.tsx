import { useState } from "react";
import { useRoute, Link } from "wouter";
import { ArrowLeft, Plane, ParkingCircle, Car, Building2, CalendarDays, FolderOpen, Pencil, Share2, Check, Download } from "lucide-react";
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
  { id: "flights", label: "Flights", icon: Plane },
  { id: "parking", label: "Parking", icon: ParkingCircle },
  { id: "rental", label: "Vehicle Rental", icon: Car },
  { id: "accommodation", label: "Accommodation", icon: Building2 },
  { id: "itinerary", label: "Itinerary", icon: CalendarDays },
  { id: "vault", label: "Documents", icon: FolderOpen },
] as const;

type ModuleId = typeof MODULES[number]["id"];

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
          toast({ title: "Link copied!", description: "Share this link for a read-only view." });
        });
      },
      onError: () => {
        toast({ title: "Error", description: "Could not generate share link.", variant: "destructive" });
      },
    },
  });

  return (
    <button
      onClick={() => generateLink.mutate({ tripId })}
      disabled={generateLink.isPending}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors flex-shrink-0"
      data-testid="button-share-trip"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
      {copied ? "Copied!" : "Share"}
    </button>
  );
}

export default function TripDetail() {
  const [, params] = useRoute("/trips/:tripId");
  const tripId = parseInt(params?.tripId ?? "0", 10);
  const [activeModule, setActiveModule] = useState<ModuleId>("flights");
  const [editOpen, setEditOpen] = useState(false);

  const { data: trip, isLoading } = useGetTrip(tripId, {
    query: { enabled: !!tripId, queryKey: getGetTripQueryKey(tripId) },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex">
        <div className="w-56 border-r border-border bg-sidebar p-4 space-y-2">
          {MODULES.map((m) => <Skeleton key={m.id} className="h-9 w-full" />)}
        </div>
        <div className="flex-1 p-8 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-20 w-full" />
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
      {/* Top header */}
      <header className="border-b border-border bg-sidebar text-sidebar-foreground sticky top-0 z-10">
        <div className="px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link href="/">
            <button className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base truncate" data-testid="text-trip-name">{trip.name}</h1>
            <p className="text-xs text-sidebar-foreground/60 truncate">{trip.destination}</p>
          </div>
          {/* Offline download button */}
          <a
            href={`${import.meta.env.BASE_URL}trips/${tripId}/export`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors flex-shrink-0"
            data-testid="button-offline-download"
          >
            <Download className="w-3.5 h-3.5" />
            Offline
          </a>
          {/* Share button */}
          <ShareButton tripId={tripId} />
          {/* Edit button */}
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors flex-shrink-0"
            data-testid="button-edit-trip"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar navigation */}
        <nav className="w-56 border-r border-border bg-sidebar text-sidebar-foreground flex-shrink-0 flex flex-col py-4 px-3 gap-1" data-testid="nav-modules">
          {MODULES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveModule(id)}
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
        <main className="flex-1 overflow-y-auto p-5 sm:p-7">
          {/* Progress bar */}
          <div className="mb-6 max-w-2xl">
            <TripProgressBar tripId={tripId} />
          </div>

          {/* Active module */}
          <div className="max-w-3xl">
            {activeModule === "flights" && <FlightsModule tripId={tripId} />}
            {activeModule === "parking" && <ParkingModule tripId={tripId} />}
            {activeModule === "rental" && <RentalsModule tripId={tripId} />}
            {activeModule === "accommodation" && <AccommodationsModule tripId={tripId} />}
            {activeModule === "itinerary" && <ItineraryModule tripId={tripId} />}
            {activeModule === "vault" && <DocumentsModule tripId={tripId} />}
          </div>
        </main>
      </div>

      {/* Edit dialog */}
      <EditTripDialog
        trip={trip}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
