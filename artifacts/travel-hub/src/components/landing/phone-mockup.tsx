import { WifiOff } from "lucide-react";
import itineraryScreenshot from "@/assets/landing-itinerary.png";

export function PhoneMockup() {
  return (
    <figure className="ob-mock">
      <div className="ob-mock-phone">
        <img
          className="ob-mock-screenshot"
          src={itineraryScreenshot}
          alt="Itinerario de Nueva York en OffBunker, con actividades de la Estatua de la Libertad, World Trade Center y Distrito financiero."
          width={413}
          height={927}
          fetchPriority="high"
          decoding="async"
        />
      </div>
      <figcaption className="ob-mock-badge">
        <WifiOff size={17} aria-hidden="true" />
        <span><strong>Consulta en modo avión</strong><small>Información y archivos preparados en este dispositivo.</small></span>
      </figcaption>
      <p className="ob-mock-note">Vista del itinerario en OffBunker.</p>
    </figure>
  );
}
