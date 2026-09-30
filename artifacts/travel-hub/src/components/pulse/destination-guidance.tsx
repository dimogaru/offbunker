import { CircleHelp, Globe2, PlugZap, Wallet } from "lucide-react";
import { useListRentals, getListRentalsQueryKey } from "@workspace/api-client-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { getPlaceGuidance } from "@/lib/pulse/guidance";

interface Props {
  tripId: number;
  destination: string;
}

export default function DestinationGuidance({ tripId, destination }: Props) {
  const { isOnline } = useOnlineStatus();
  const { data: rentals, isLoading, isError } = useListRentals(tripId, {
    query: { enabled: isOnline, queryKey: getListRentalsQueryKey(tripId) },
  });
  const guidance = getPlaceGuidance(destination, rentals ?? []);

  return (
    <section className="max-w-3xl mb-5" aria-labelledby="pulse-title">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex gap-2.5 items-start px-4 py-3 border-b border-border bg-muted/30">
          <span className="p-1.5 rounded-lg bg-primary/10 text-primary"><Globe2 className="h-4 w-4" aria-hidden="true" /></span>
          <div>
            <h2 id="pulse-title" className="font-semibold text-sm leading-5">OffBunker Pulse <span className="ml-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Vista previa</span></h2>
            <p className="text-xs text-muted-foreground">Pistas para el destino, no requisitos de viaje personalizados.</p>
          </div>
        </div>
        <div className="p-4">
          {isLoading && !rentals && <p role="status" className="text-xs text-muted-foreground">Consultando transportes del viaje…</p>}
          {guidance.length ? (
            <div className="space-y-3">
              {guidance.map(place => (
                <article key={place.country} className="rounded-lg border border-border bg-background p-3 sm:p-4" data-testid={`card-pulse-${place.country}`}>
                  <div className="flex justify-between items-start gap-3 mb-3">
                    <div>
                      <h3 className="text-sm font-semibold">{place.country}</h3>
                      <p className="text-[11px] text-muted-foreground break-words">{place.source}</p>
                    </div>
                    <span className="text-[10px] rounded-full px-2 py-0.5 bg-primary/10 text-primary font-medium shrink-0">Referencia</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 text-xs">
                    <div className="flex gap-2"><PlugZap className="h-4 w-4 text-primary shrink-0" aria-hidden="true" /><div><p className="font-medium">Enchufe y tensión</p><p className="text-muted-foreground">Tipo {place.plugs} · {place.voltage}. Comprueba tu dispositivo.</p></div></div>
                    <div className="flex gap-2"><Wallet className="h-4 w-4 text-primary shrink-0" aria-hidden="true" /><div><p className="font-medium">Moneda oficial</p><p className="text-muted-foreground">{place.currency}</p></div></div>
                  </div>
                  <p className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">Visado y aduanas: {place.entryReminder} Verifica los requisitos vigentes en fuentes oficiales según tu pasaporte, ruta y fechas; esta vista no determina si necesitas visado.</p>
                </article>
              ))}
              {(!rentals && !isOnline || isError) && <p className="text-xs text-muted-foreground">No se pudieron revisar los transportes; las pistas muestran solo los lugares disponibles.</p>}
            </div>
          ) : (
            <div className="flex items-start gap-2 text-xs text-muted-foreground" role="status">
              <CircleHelp className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <p>No hay orientación verificada para este destino{isLoading ? " todavía" : ""}. {isOnline ? "Añade un país explícito al viaje o a Transportes para mostrar referencias." : "Sin conexión; no hay datos locales suficientes para identificar el país."}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}