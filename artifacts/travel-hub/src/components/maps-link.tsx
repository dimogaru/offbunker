import { ExternalLink, WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";

interface MapsLinkProps {
  query: string;
  label?: string;
  className?: string;
}

/**
 * A Google Maps external link that degrades gracefully offline.
 * - Online:  normal link that opens Maps in a new tab.
 * - Offline: link is still present (it will work once the user is back online
 *            or if the mobile OS handles the intent), but a WifiOff badge
 *            appears to set clear expectations.
 */
export default function MapsLink({ query, label = "Maps", className }: MapsLinkProps) {
  const { isOnline } = useOnlineStatus();
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query).replace(/%20/g, "+")}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={isOnline ? `Ver ${query} en Google Maps` : "Sin conexión — el enlace funcionará cuando recuperes internet"}
      className={`flex items-center gap-0.5 text-xs hover:underline flex-shrink-0 transition-colors ${
        isOnline ? "text-primary" : "text-muted-foreground"
      } ${className ?? ""}`}
    >
      {isOnline ? (
        <ExternalLink className="w-3 h-3" />
      ) : (
        <WifiOff className="w-3 h-3" />
      )}
      {label}
    </a>
  );
}
