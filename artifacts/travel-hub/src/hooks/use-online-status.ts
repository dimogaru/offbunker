import { useState, useEffect } from "react";

/**
 * Reactive wrapper around navigator.onLine.
 * Subscribes to the browser's online/offline events so components
 * re-render the moment connectivity changes.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const setOnline  = () => setIsOnline(true);
    const setOffline = () => setIsOnline(false);
    window.addEventListener("online",  setOnline);
    window.addEventListener("offline", setOffline);
    return () => {
      window.removeEventListener("online",  setOnline);
      window.removeEventListener("offline", setOffline);
    };
  }, []);

  return { isOnline };
}
