import { useState, useEffect } from "react";
import { WifiOff, CloudCheck, RefreshCw } from "lucide-react";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return isOnline;
}

export default function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const [justCameOnline, setJustCameOnline] = useState(false);
  const [visible, setVisible] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setVisible(true);
      setJustCameOnline(false);
      return;
    }
    if (wasOffline) {
      setJustCameOnline(true);
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setJustCameOnline(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOnline, wasOffline]);

  if (!visible) return null;

  if (!isOnline) {
    return (
      <div className="fixed bottom-20 sm:bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-amber-500 text-white text-sm font-medium shadow-lg animate-in slide-in-from-bottom-4">
        <WifiOff className="w-4 h-4 flex-shrink-0" />
        <span>Sin conexión — mostrando datos guardados</span>
      </div>
    );
  }

  if (justCameOnline) {
    return (
      <div className="fixed bottom-20 sm:bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-600 text-white text-sm font-medium shadow-lg animate-in slide-in-from-bottom-4">
        <RefreshCw className="w-4 h-4 flex-shrink-0 animate-spin" />
        <span>Conexión restaurada — sincronizando…</span>
      </div>
    );
  }

  return null;
}

export function SavedLocallyBadge() {
  return (
    <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
      <CloudCheck className="w-3.5 h-3.5" />
      <span>Guardado localmente · Disponible sin conexión</span>
    </div>
  );
}
