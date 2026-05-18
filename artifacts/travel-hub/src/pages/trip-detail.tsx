import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import {
  ArrowLeft, Plane, ParkingCircle, Car, Building2, CalendarDays,
  FolderOpen, Pencil, Share2, Check, Link2, X, Users, LogOut, Shield,
} from "lucide-react";
import { useGetTrip, getGetTripQueryKey, useGenerateShareLink } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TripProgressBar from "@/components/trip-progress-bar";
import EditTripDialog from "@/components/edit-trip-dialog";
import FlightsModule from "@/components/modules/flights-module";
import ParkingModule from "@/components/modules/parking-module";
import RentalsModule from "@/components/modules/rentals-module";
import AccommodationsModule from "@/components/modules/accommodations-module";
import ItineraryModule from "@/components/modules/itinerary-module";
import DocumentsModule from "@/components/modules/documents-module";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useOnlineStatus } from "@/hooks/use-online-status";

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

/* ─── Share modal ─────────────────────────────────────────────── */

interface UserSearchResult { id: number; username: string; }
interface UserShare { id: number; userId: number; username: string; permission: string; createdAt: string; }

function ShareModal({
  tripId,
  open,
  onOpenChange,
}: {
  tripId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [permission, setPermission] = useState<"edit" | "view">("view");
  const [isSearching, setIsSearching] = useState(false);

  const { data: shares = [], refetch: refetchShares } = useQuery<UserShare[]>({
    queryKey: ["trip-shares", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/shares`, { credentials: "include" });
      if (!res.ok) throw new Error("Error al obtener colaboradores");
      return res.json() as Promise<UserShare[]>;
    },
    enabled: open,
  });

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { credentials: "include" });
        if (res.ok) setSearchResults(await res.json() as UserSearchResult[]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const generateLink = useGenerateShareLink({
    mutation: {
      onSuccess: (data) => {
        const url = `${window.location.origin}${import.meta.env.BASE_URL}share/${data.shareToken}`;
        navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
          toast({ title: "¡Enlace copiado!", description: "Vista de solo lectura pública." });
        });
      },
      onError: () => toast({ title: "Error", description: "No se pudo generar el enlace.", variant: "destructive" }),
    },
  });

  async function addShare(userId: number) {
    const res = await fetch(`/api/trips/${tripId}/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId, permission }),
    });
    if (res.ok) {
      void refetchShares();
      setSearchQuery("");
      setSearchResults([]);
      toast({ title: "Usuario añadido como colaborador" });
    } else {
      const err = await res.json().catch(() => ({})) as { error?: string };
      toast({ title: "Error", description: err.error, variant: "destructive" });
    }
  }

  async function removeShare(shareId: number) {
    await fetch(`/api/trips/${tripId}/shares/${shareId}`, {
      method: "DELETE",
      credentials: "include",
    });
    void refetchShares();
    toast({ title: "Colaborador eliminado" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-4 h-4" />
            Compartir viaje
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Public link */}
          <div className="border border-border rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-semibold">Enlace de solo lectura</h3>
            <p className="text-xs text-muted-foreground">
              Cualquier persona con este enlace puede ver el viaje sin poder editarlo.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => generateLink.mutate({ tripId })}
              disabled={generateLink.isPending}
              className="gap-2"
            >
              {copied
                ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                : <Link2 className="w-3.5 h-3.5" />}
              {copied ? "¡Enlace copiado!" : "Copiar enlace público"}
            </Button>
          </div>

          {/* User sharing */}
          <div className="border border-border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              Colaboradores con cuenta
            </h3>

            <div className="flex gap-2">
              <Input
                placeholder="Buscar usuario por nombre…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 h-8 text-sm"
              />
              <select
                value={permission}
                onChange={(e) => setPermission(e.target.value as "edit" | "view")}
                className="border border-border rounded-md px-2 py-1 bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="view">Ver</option>
                <option value="edit">Editar</option>
              </select>
            </div>

            {isSearching && (
              <p className="text-xs text-muted-foreground">Buscando…</p>
            )}

            {searchResults.length > 0 && (
              <div className="border border-border rounded-md overflow-hidden divide-y divide-border">
                {searchResults.map((u) => (
                  <div key={u.id} className="flex items-center justify-between px-3 py-2 hover:bg-muted/30 text-sm">
                    <span>{u.username}</span>
                    <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => addShare(u.id)}>
                      Añadir
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {shares.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Acceso activo
                </p>
                {shares.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm border border-border rounded-md px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{s.username}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        s.permission === "edit"
                          ? "bg-blue-500/15 text-blue-500"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {s.permission === "edit" ? "Editar" : "Ver"}
                      </span>
                    </div>
                    <button
                      onClick={() => removeShare(s.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      title="Quitar acceso"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {shares.length === 0 && !searchQuery && (
              <p className="text-xs text-muted-foreground italic">
                Sin colaboradores aún. Busca un usuario por su nombre de usuario.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main component ──────────────────────────────────────────── */

export default function TripDetail() {
  const { tripId: tripIdStr, module: moduleParam } = useParams<{
    tripId: string;
    module?: string;
  }>();
  const tripId = parseInt(tripIdStr ?? "0", 10);
  const [, navigate] = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const { user, logout } = useAuth();
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();

  async function handleLogout() {
    await logout();
    queryClient.clear();
    window.location.replace("/login");
  }

  const activeModule: ModuleId = VALID_IDS.includes(moduleParam ?? "")
    ? (moduleParam as ModuleId)
    : "flights";

  useEffect(() => {
    if (tripId && !moduleParam) {
      navigate(`/trips/${tripId}/flights`, { replace: true });
    }
  }, [tripId, moduleParam, navigate]);

  function handleModuleChange(mod: ModuleId) {
    navigate(`/trips/${tripId}/${mod}`);
    document.getElementById("module-main")?.scrollTo({ top: 0, behavior: "instant" });
  }

  const { data: trip, isLoading } = useGetTrip(tripId, {
    query: { enabled: !!tripId, queryKey: getGetTripQueryKey(tripId) },
  });

  // Permission is injected by the API into the trip response
  const permission = (trip as Record<string, unknown> | undefined)?.permission as
    | "owner" | "edit" | "view"
    | undefined;
  const isOwner = !permission || permission === "owner";
  const readOnly = permission === "view";

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
          <p className="text-lg font-semibold">Viaje no encontrado</p>
          <Link href="/">
            <span className="text-primary text-sm underline mt-2 inline-block">Volver al inicio</span>
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
          <Link href="/">
            <button
              className="p-2 rounded-md hover:bg-sidebar-accent transition-colors flex-shrink-0"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h1
                className="font-bold text-sm sm:text-base leading-tight truncate"
                data-testid="text-trip-name"
              >
                {trip.name}
              </h1>
              {!isOwner && (
                <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300">
                  <Users className="w-2.5 h-2.5" />
                  {readOnly ? "Vista" : "Colaborador"}
                </span>
              )}
            </div>
            <p className="text-xs text-sidebar-foreground/60 truncate leading-tight">
              {trip.destination}
            </p>
          </div>

          {/* Owner-only actions */}
          {isOwner && (
            <>
              <button
                onClick={() => setShareOpen(true)}
                className="p-2 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors flex-shrink-0 flex items-center gap-1.5"
                data-testid="button-share-trip"
                title="Compartir viaje"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline text-xs font-medium">Compartir</span>
              </button>

              <button
                onClick={() => setEditOpen(true)}
                className="p-2 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors flex-shrink-0 flex items-center gap-1.5"
                data-testid="button-edit-trip"
                title="Editar viaje"
              >
                <Pencil className="w-4 h-4" />
                <span className="hidden sm:inline text-xs font-medium">Editar</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — desktop only */}
        <nav
          className="hidden md:flex w-56 border-r border-border bg-sidebar text-sidebar-foreground flex-shrink-0 flex-col py-4 px-3 gap-1"
          data-testid="nav-modules"
        >
          {/* Brand — links back to dashboard */}
          <Link href="/">
            <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-md hover:bg-sidebar-accent transition-colors cursor-pointer">
              <Shield className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-sm font-bold tracking-tight text-primary">OffBunker</span>
            </div>
          </Link>
          <hr className="mb-2 border-sidebar-border" />

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

          {/* Divider + logout */}
          <hr className="my-3 border-sidebar-border" />
          <div className="px-1 mb-1 text-[10px] font-medium text-sidebar-foreground/40 uppercase tracking-wide">
            {user?.username}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            Cerrar Sesión
          </button>
        </nav>

        {/* Main content */}
        <main id="module-main" className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 md:pb-6">
          <div className="mb-5">
            <TripProgressBar tripId={tripId} />
          </div>

          <div key={activeModule} className="max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            {activeModule === "flights"       && <FlightsModule tripId={tripId} readOnly={readOnly || !isOnline} />}
            {activeModule === "parking"       && <ParkingModule tripId={tripId} readOnly={readOnly || !isOnline} />}
            {activeModule === "rental"        && <RentalsModule tripId={tripId} readOnly={readOnly || !isOnline} />}
            {activeModule === "accommodation" && <AccommodationsModule tripId={tripId} readOnly={readOnly || !isOnline} />}
            {activeModule === "itinerary"     && <ItineraryModule tripId={tripId} readOnly={readOnly || !isOnline} />}
            {activeModule === "vault"         && <DocumentsModule tripId={tripId} coverImageUrl={trip.coverImage} readOnly={readOnly || !isOnline} />}
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

      {/* Dialogs */}
      <EditTripDialog trip={trip} open={editOpen} onOpenChange={setEditOpen} />
      {isOwner && (
        <ShareModal tripId={tripId} open={shareOpen} onOpenChange={setShareOpen} />
      )}
    </div>
  );
}
