import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type FreeLimitDialogProps = {
  type: "trip" | "expense";
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const messages = {
  trip: "Has alcanzado el límite de 2 viajes del plan Gratuito. Pasa a PRO para guardar viajes ilimitados.",
  expense: "Has alcanzado el límite de 10 gastos en este viaje. Desbloquea gastos ilimitados con OffBunker PRO.",
};
const proposedBenefits = [
  "Viajes ilimitados (almacena y organiza todos tus viajes pasados y futuros)",
  "Gastos y repartos ilimitados por viaje",
  "Asistente inteligente OffBunker Pulse (alertas de destino, enchufes y visados)",
  "Checklist de Desconexión antes del vuelo",
  "Más espacio en la nube para copias de seguridad de billetes y documentos",
];

export function FreeLimitDialog({ type, open, onOpenChange }: FreeLimitDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Límite del Plan Gratuito</DialogTitle>
          <DialogDescription data-testid={`text-free-${type}-limit-message`}>{messages[type]}</DialogDescription>
        </DialogHeader>
        <div className="text-sm">
          <p className="font-medium">Propuesta de OffBunker PRO</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {proposedBenefits.map(benefit => <li key={benefit}>{benefit}</li>)}
          </ul>
        </div>
        <p className="text-sm text-muted-foreground">OffBunker PRO es una propuesta Próximamente y todavía no se puede contratar.</p>
        <DialogFooter>
          <Button type="button" data-testid="button-dismiss-free-limit" onClick={() => onOpenChange(false)}>Entendido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}