import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import NewTrip from "@/pages/new-trip";
import TripDetail from "@/pages/trip-detail";
import SharedTrip from "@/pages/shared-trip";
import TripExport from "@/pages/trip-export";
import OfflineIndicator from "@/components/offline-indicator";

const CACHE_KEY = "travelhub-cache-v1";
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: CACHE_MAX_AGE,
      // staleTime: 0 → "stale-while-revalidate":
      // localStorage data is shown instantly, but a background fetch ALWAYS
      // fires on mount and on window/tab focus to get the latest server data.
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
      retry: (failureCount) => {
        if (!navigator.onLine) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

function restoreCacheFromStorage() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const { queries, savedAt } = JSON.parse(raw) as {
      queries: Array<{ queryKey: unknown[]; data: unknown }>;
      savedAt: number;
    };
    if (Date.now() - savedAt > CACHE_MAX_AGE) {
      localStorage.removeItem(CACHE_KEY);
      return;
    }
    for (const { queryKey, data } of queries) {
      queryClient.setQueryData(queryKey, data);
    }
  } catch {
    localStorage.removeItem(CACHE_KEY);
  }
}

restoreCacheFromStorage();

function QueryCachePersister() {
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
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ queries, savedAt: Date.now() }),
          );
        } catch {
          // Silently fail (e.g. quota exceeded)
        }
      }, 1500);
    });

    return () => {
      unsubscribe();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return null;
}

// Ensures data is re-fetched when the mobile user switches back to the tab.
// TanStack Query already listens to `focus`, but the `visibilitychange` API
// is more reliable on iOS/Android when the user returns from another app.
function VisibilitySync() {
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") {
        queryClient.invalidateQueries();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/trips/new" component={NewTrip} />
      <Route path="/trips/:tripId/export" component={TripExport} />
      <Route path="/trips/:tripId/:module" component={TripDetail} />
      <Route path="/trips/:tripId" component={TripDetail} />
      <Route path="/share/:token" component={SharedTrip} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <QueryCachePersister />
      <VisibilitySync />
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
        <OfflineIndicator />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
