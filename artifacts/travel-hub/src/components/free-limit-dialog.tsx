import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";

type FreeLimitDialogProps = {
  type: "trip" | "expense";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGranted?: () => void;
  offer?: boolean;
};

const messages = {
  trip: "Has alcanzado el límite de 2 viajes del plan Gratuito. Pasa a PRO para guardar viajes ilimitados.",
  expense: "Has alcanzado el límite de 10 gastos en este viaje. Desbloquea gastos ilimitados con OffBunker PRO.",
};
const currentBenefits = [
  "Viajes ilimitados (almacena y organiza todos tus viajes pasados y futuros)",
  "Gastos y repartos ilimitados por viaje",
];
const previewBenefits = [
  "Asistente inteligente OffBunker Pulse (alertas de destino, enchufes y visados): vista previa para todos; la inteligencia completa está en desarrollo.",
  "Checklist de Desconexión antes del vuelo: vista previa para todos.",
  "Más espacio en la nube para copias de seguridad de billetes y documentos: propuesta futura; no está incluido ni disponible actualmente.",
];

const congratulations = "¡Enhorabuena! Por ser de los primeros usuarios de OffBunker, te hemos regalado la suscripción PRO Beta de por vida.";

export function FreeLimitDialog({ type, open, onOpenChange, onGranted, offer = false }: FreeLimitDialogProps) {
  const { user, grantProBeta } = useAuth();
  const [granting, setGranting] = useState(false);
  const [error, setError] = useState("");
  const [granted, setGranted] = useState(false);
  const completionTimer = useRef<number | null>(null);
  const mounted = useRef(false);
  const cancelled = useRef(false);
  const canRequest = user?.role === "user";

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (completionTimer.current !== null) window.clearTimeout(completionTimer.current);
    };
  }, []);

  function handleOpenChange(nextOpen: boolean) {
    // Once the gift request starts, keep the dialog open until the pending action
    // resumes. Otherwise closing it during the success animation strands that action.
    if (!nextOpen && (granting || granted)) return;
    cancelled.current = !nextOpen;
    if (!nextOpen && completionTimer.current !== null) {
      window.clearTimeout(completionTimer.current);
      completionTimer.current = null;
    }
    onOpenChange(nextOpen);
  }

  async function requestAccess() {
    if (!canRequest || granting || granted) return;
    setGranting(true);
    setError("");
    try {
      await grantProBeta();
      if (!mounted.current || cancelled.current) return;
      setGranted(true);
      completionTimer.current = window.setTimeout(() => {
        completionTimer.current = null;
        if (!mounted.current || cancelled.current) return;
        onGranted?.();
        cancelled.current = true;
        onOpenChange(false);
      }, 900);
    } catch (requestError) {
      if (!mounted.current) return;
      setError(requestError instanceof Error ? requestError.message : "No se pudo solicitar PRO Beta.");
    } finally {
      if (mounted.current) setGranting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{offer ? "Un regalo para los primeros viajeros" : "Límite del Plan Gratuito"}</DialogTitle>
          <DialogDescription data-testid={`text-free-${type}-limit-message`}>
            {offer ? "Solicita tu suscripción PRO Beta de por vida, sin coste." : messages[type]}
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm">
          <p className="font-semibold">Disponible ahora con PRO Beta</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {currentBenefits.map(benefit => <li key={benefit}>{benefit}</li>)}
          </ul>
          <p className="mt-4 font-semibold">Vistas previas y propuestas futuras (no ventajas desbloqueadas por PRO Beta)</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {previewBenefits.map(benefit => <li key={benefit}>{benefit}</li>)}
          </ul>
        </div>
        {granted ? (
          <p role="status" data-testid="status-pro-beta-granted" className="animate-in fade-in zoom-in-95 duration-500 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
            <Sparkles className="mr-2 inline h-4 w-4" />{congratulations}
          </p>
        ) : canRequest ? (
          <div className="space-y-2">
            <Button type="button" data-testid="button-request-pro-beta" disabled={granting} onClick={() => void requestAccess()} className="w-full bg-emerald-700 text-white hover:bg-emerald-800">
              {granting ? "Solicitando acceso…" : "Solicitar acceso a PRO"}
            </Button>
            {error && <p role="alert" data-testid="status-pro-beta-error" className="text-sm text-destructive">{error}</p>}
          </div>
        ) : user?.role === "demo" ? (
          <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            El modo invitado es temporal y no puede recibir una suscripción. <Link href="/login" data-testid="link-pro-beta-signup" className="font-semibold text-primary underline underline-offset-2">Crea una cuenta o inicia sesión</Link> para solicitar PRO Beta.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Inicia sesión con una cuenta registrada para solicitar acceso.</p>
        )}
        <DialogFooter>
          {!granted && <Button type="button" data-testid="button-dismiss-free-limit" variant="outline" onClick={() => handleOpenChange(false)}>Entendido</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}