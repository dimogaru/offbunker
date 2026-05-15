import { useState } from "react";
import { Pencil, Trash2, ParkingCircle, Clock, MapPin, Hash, Euro } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useListParkings, useCreateParking, useUpdateParking, useDeleteParking, getListParkingsQueryKey } from "@workspace/api-client-react";
import type { Parking } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import ModuleHeader from "@/components/modules/module-header";
import ModuleDocsWidget from "@/components/modules/module-docs-widget";

const schema = z.object({
  location: z.string().min(1, "La ubicación es obligatoria"),
  reservationCode: z.string().min(1, "El código de reserva es obligatorio"),
  entryDate: z.string().min(1, "Obligatorio"),
  exitDate: z.string().min(1, "Obligatorio"),
  priceTotal: z.string().optional(),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function toLocalDatetime(iso: string) { return iso ? iso.substring(0, 16) : ""; }
function fmt(iso: string) { return new Date(iso).toLocaleString("es-ES", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }

interface Props { tripId: number }

export default function ParkingModule({ tripId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Parking | null>(null);
  const [deleting, setDeleting] = useState<Parking | null>(null);

  const { data: parkings, isLoading } = useListParkings(tripId, { query: { queryKey: getListParkingsQueryKey(tripId) } });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListParkingsQueryKey(tripId) });

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { location: "", reservationCode: "", entryDate: "", exitDate: "", priceTotal: "", notes: "" } });

  const createParking = useCreateParking({ mutation: { onSuccess: () => { invalidate(); setOpen(false); form.reset(); toast({ title: "Estacionamiento añadido" }); } } });
  const updateParking = useUpdateParking({ mutation: { onSuccess: () => { invalidate(); setOpen(false); setEditing(null); form.reset(); toast({ title: "Estacionamiento actualizado" }); } } });
  const deleteParking = useDeleteParking({ mutation: { onSuccess: () => { invalidate(); setDeleting(null); toast({ title: "Estacionamiento eliminado" }); } } });

  function openNew() { form.reset({ location: "", reservationCode: "", entryDate: "", exitDate: "", priceTotal: "", notes: "" }); setEditing(null); setOpen(true); }
  function openEdit(p: Parking) { form.reset({ location: p.location, reservationCode: p.reservationCode, entryDate: toLocalDatetime(p.entryDate), exitDate: toLocalDatetime(p.exitDate), priceTotal: p.priceTotal?.toString() ?? "", notes: p.notes ?? "" }); setEditing(p); setOpen(true); }

  function onSubmit(values: FormValues) {
    const payload = { location: values.location, reservationCode: values.reservationCode, entryDate: new Date(values.entryDate).toISOString(), exitDate: new Date(values.exitDate).toISOString(), priceTotal: values.priceTotal ? parseFloat(values.priceTotal) : undefined, notes: values.notes || undefined };
    if (editing) updateParking.mutate({ tripId, parkingId: editing.id, data: payload });
    else createParking.mutate({ tripId, data: payload });
  }

  return (
    <div>
      <ModuleHeader title="Estacionamiento" description="Registra tus reservas de estacionamiento en el aeropuerto" onAdd={openNew} />

      {isLoading ? (
        <div className="space-y-3">{[1].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
      ) : parkings && parkings.length > 0 ? (
        <div className="space-y-3">
          {parkings.map(p => (
            <div key={p.id} className="booking-card border border-border rounded-xl bg-card p-4" data-testid={`card-parking-${p.id}`}>
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <p className="font-semibold truncate">{p.location}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Hash className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">{p.reservationCode}</span>
                    {p.priceTotal && (
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground ml-1">
                        <Euro className="w-3 h-3" />
                        {Number(p.priceTotal).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleting(p)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/60">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Entrada</p>
                  <p className="flex items-center gap-1 text-sm font-medium">
                    <Clock className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    {fmt(p.entryDate)}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Salida</p>
                  <p className="flex items-center gap-1 text-sm font-medium">
                    <Clock className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                    {fmt(p.exitDate)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          <ParkingCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No hay reservas de estacionamiento</p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar Estacionamiento" : "Añadir Estacionamiento"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField control={form.control} name="location" render={({ field }) => (<FormItem><FormLabel>Ubicación</FormLabel><FormControl><Input placeholder="Parking T4 Barajas" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="reservationCode" render={({ field }) => (<FormItem><FormLabel>Código de reserva</FormLabel><FormControl><Input placeholder="MAD-78234" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="entryDate" render={({ field }) => (<FormItem><FormLabel>Fecha de entrada</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="exitDate" render={({ field }) => (<FormItem><FormLabel>Fecha de salida</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="priceTotal" render={({ field }) => (<FormItem><FormLabel>Precio total (opcional)</FormLabel><FormControl><Input type="number" placeholder="145.50" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notas</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter>
                <Button type="submit" disabled={createParking.isPending || updateParking.isPending}>{editing ? "Guardar cambios" : "Añadir estacionamiento"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar estacionamiento?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteParking.mutate({ tripId, parkingId: deleting.id })} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ModuleDocsWidget tripId={tripId} module="parking" moduleLabel="Estacionamiento" />
    </div>
  );
}
