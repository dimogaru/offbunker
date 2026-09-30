import { useState } from "react";
import { AlertCircle, CheckCircle2, CircleHelp, Globe2, PlugZap, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import { useListRentals, getListRentalsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { getPlaceGuidance } from "@/lib/pulse/guidance";
import { verifyBunker } from "@/lib/pulse/verification";
import type { PulseResult } from "@/lib/pulse/verification";

interface Props {
  tripId: number;
  ownerId: string | null;
  destination: string;
  isDemo: boolean;
}

export default function PulsePanel({ tripId, ownerId, destination, isDemo }: Props) {
  const { isOnline } = useOnlineStatus();
  const { data: rentals, isLoading, isError } = useListRentals(tripId, {
    query: { enabled: isOnline, queryKey: getListRentalsQueryKey(tripId) },
  });
  const guidance = getPlaceGuidance(destination, rentals ?? []);
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<PulseResult | null>(null);
  const [error, setError] = useState("");

  async function runCheck() {
    setChecking(true);
    setError("");
    setResult(null);
    try {
      if (isDemo) {
        setResult({
          ready: false,
          checks: [
            { label: "Datos de vuelos sin conexión", state: "unverified", detail: "La sesión invitada no conserva una copia persistida de los vuelos para verificarla." },
            { label: "Archivos de billetes disponibles", state: "unverified", detail: "No se pueden confirmar archivos de billetes descargados en esta vista de muestra." },
            { label: "Dirección y reserva de alojamiento", state: "unverified", detail: "No se puede confirmar una copia offline de direcciones y códigos en esta sesión." },
            { label: "Tipos de cambio en este dispositivo", state: "unverified", detail: "La vista invitada no mantiene cotizaciones persistidas para verificar." },
          ],
        });
      } else if (!ownerId) {
        setError("Inicia sesión para verificar los datos guardados en este dispositivo.");
      } else {
        setResult(await verifyBunker(ownerId, tripId));
      }
    } catch {
      setError("No se pudo completar la lectura local. Reinténtalo en este dispositivo.");
    } finally {
      setChecking(false);
    }
  }

  function handleOpen(next: boolean) {
    setOpen(next);
    if (next) void runCheck();
  }

  return (
    <section className="max-w-3xl mb-5" aria-labelledby="pulse-title">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex gap-2.5 items-start">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary"><Globe2 className="h-4 w-4" aria-hidden="true" /></span>
            <div>
              <h2 id="pulse-title" className="font-semibold text-sm leading-5">OffBunker Pulse <span className="ml-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Vista previa</span></h2>
              <p className="text-xs text-muted-foreground">Pistas para el destino, no requisitos de viaje personalizados.</p>
            </div>
          </div>
          <Button type="button" size="sm" variant="outline" className="gap-2 self-start sm:self-auto shrink-0" onClick={() => handleOpen(true)} data-testid="button-verify-bunker">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" /> Verificación Modo Búnker
          </Button>
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

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex gap-2 items-center"><ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" /> Verificación Modo Búnker</DialogTitle>
            <DialogDescription>Lectura local de este usuario y viaje. No descarga archivos, no sincroniza y no modifica tus datos.</DialogDescription>
          </DialogHeader>
          {checking && <div className="space-y-2" role="status" aria-label="Verificando datos locales"><div className="h-10 rounded-md bg-muted animate-pulse" /><div className="h-10 rounded-md bg-muted animate-pulse" /><div className="h-10 rounded-md bg-muted animate-pulse" /></div>}
          {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{error}</p>}
          {result && (
            <div className="space-y-3" aria-live="polite">
              <p className={`rounded-lg p-3 text-sm font-medium ${result.ready ? "bg-primary/10 text-primary" : "bg-muted text-foreground"}`} data-testid="status-bunker-readiness">
                {result.ready ? "¡Tu Búnker está listo para el Modo Avión!" : "Aún no se puede confirmar el Modo Avión."}
              </p>
              <ul className="space-y-2">
                {result.checks.map(check => {
                  const Icon = check.state === "verified" ? CheckCircle2 : check.state === "missing" ? AlertCircle : CircleHelp;
                  return <li key={check.label} className="flex gap-2 rounded-lg border border-border px-3 py-2.5">
                    <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 mt-0.5 ${check.state === "verified" ? "text-primary" : "text-muted-foreground"}`} />
                    <div><p className="text-xs font-semibold">{check.label} <span className="font-normal text-muted-foreground">· {check.state === "verified" ? "Verificado" : check.state === "missing" ? "Pendiente" : "No verificado"}</span></p><p className="text-xs text-muted-foreground mt-0.5">{check.detail}</p></div>
                  </li>;
                })}
              </ul>
              <p className="text-[11px] text-muted-foreground">La caché y las cotizaciones pueden caducar. Esta comprobación no garantiza acceso a internet, validez de reservas ni aceptación de billetes.</p>
            </div>
          )}
          <Button type="button" variant="outline" size="sm" disabled={checking} onClick={() => void runCheck()} className="gap-2 self-start" data-testid="button-recheck-bunker"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Comprobar de nuevo</Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}