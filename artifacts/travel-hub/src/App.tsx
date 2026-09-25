import { type ReactNode, useEffect, useRef, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import NewTrip from "@/pages/new-trip";
import TripDetail from "@/pages/trip-detail";
import SharedTrip from "@/pages/shared-trip";
import TripExport from "@/pages/trip-export";
import LoginPage from "@/pages/login";
import AdminPage from "@/pages/admin";
import OfflineIndicator from "@/components/offline-indicator";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Plane } from "lucide-react";
import { persistedQueryCacheKey } from "@/lib/query-cache";

const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: CACHE_MAX_AGE,
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
      retry: (failureCount) => {
        if (!navigator.onLine) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

function restoreCacheFromStorage(ownerId: string) {
  const cacheKey = persistedQueryCacheKey(ownerId);
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return;
    const { queries, savedAt } = JSON.parse(raw) as {
      queries: Array<{ queryKey: unknown[]; data: unknown }>;
      savedAt: number;
    };
    if (Date.now() - savedAt > CACHE_MAX_AGE) {
      localStorage.removeItem(cacheKey);
      return;
    }
    for (const { queryKey, data } of queries) {
      queryClient.setQueryData(queryKey, data);
    }
  } catch {
    localStorage.removeItem(cacheKey);
  }
}

function QueryCachePersister({ ownerId }: { ownerId: string }) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        try {
          const queries = queryClient
            .getQueryCache()
            .getAll()
            .filter((q) => q.state.status === "success" && q.state.data !== undefined)
            .map((q) => ({ queryKey: q.queryKey, data: q.state.data }));
          localStorage.setItem(persistedQueryCacheKey(ownerId), JSON.stringify({ ownerId, queries, savedAt: Date.now() }));
        } catch {
          // Silently fail (quota exceeded)
        }
      }, 1500);
    });
    return () => {
      unsubscribe();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [ownerId]);

  return null;
}

function UserScopedCacheBoundary({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const ownerId = user?.id != null ? String(user.id) : null;
  const [readyOwnerId, setReadyOwnerId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (isLoading) return;
    queryClient.clear();
    if (ownerId && user?.role === "demo") {
      localStorage.removeItem(persistedQueryCacheKey(ownerId));
    } else if (ownerId) {
      restoreCacheFromStorage(ownerId);
    }
    setReadyOwnerId(ownerId);
  }, [isLoading, ownerId, user?.role]);

  if (isLoading || readyOwnerId !== ownerId) return <LoadingScreen />;

  return (
    <>
      {ownerId && user?.role !== "demo" && <QueryCachePersister ownerId={ownerId} />}
      {children}
    </>
  );
}

function VisibilitySync() {
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") queryClient.invalidateQueries();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  return null;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Plane className="w-8 h-8 text-primary animate-pulse" />
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </div>
    </div>
  );
}

function ProtectedApp() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login");
    }
  }, [isLoading, user, navigate]);

  if (isLoading) return <LoadingScreen />;
  if (!user) return null;

  if (user.role === "superadmin") {
    return (
      <Switch>
        <Route path="/admin" component={AdminPage} />
        <Route>{() => { navigate("/admin"); return null; }}</Route>
      </Switch>
    );
  }

  return (
    <>
      {user.role === "demo" && (
        <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950">
          Estás explorando en Modo Demo/Invitado. Los cambios son temporales y no se permiten subidas de archivos.
        </div>
      )}
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/trips/new" component={NewTrip} />
        <Route path="/trips/:tripId/export" component={TripExport} />
        <Route path="/trips/:tripId/:module" component={TripDetail} />
        <Route path="/trips/:tripId" component={TripDetail} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function Router() {
  const { user, isLoading } = useAuth();
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/share/:token" component={SharedTrip} />
      <Route path="/">
        {isLoading ? <LoadingScreen /> : user ? <ProtectedApp /> : <LoginPage />}
      </Route>
      <Route component={ProtectedApp} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UserScopedCacheBoundary>
          <VisibilitySync />
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
            <OfflineIndicator />
          </TooltipProvider>
        </UserScopedCacheBoundary>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
