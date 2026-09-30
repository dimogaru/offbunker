import { useState } from "react";
import { AlertCircle, CheckCircle2, CircleHelp, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { verifyBunker } from "@/lib/pulse/verification";
import type { PulseResult } from "@/lib/pulse/verification";

interface Props {
  tripId: number;
  ownerId: string | null;
  isDemo: boolean;
}

export default function BunkerVerification({ tripId, ownerId, isDemo }: Props) {
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
            { label: "Pasaportes disponibles sin conexión", state: "unverified", detail: "No se pueden confirmar archivos de pasaporte en esta sesión temporal." },
            { label: "PDFs de reservas disponibles sin conexión", state: "unverified", detail: "No se pueden confirmar copias descargadas de las reservas en esta sesión." },
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
    <>
      <Button type="button" size="sm" variant="outline" className="gap-2 shrink-0" onClick={() => handleOpen(true)} data-testid="button-verify-bunker">
        <ShieldCheck className="w-4 h-4" aria-hidden="true" /> Verificación Modo Búnker
      </Button>
      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex gap-2 items-center"><ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" /> Verificación Modo Búnker</DialogTitle>
            <DialogDescription>Comprueba la disponibilidad local de datos y archivos etiquetados para este viaje. No valida pasaportes ni reservas, no descarga, no sincroniza y no modifica tus datos.</DialogDescription>
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
    </>
  );
}