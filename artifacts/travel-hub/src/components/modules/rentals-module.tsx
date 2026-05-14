import { useState } from "react";
import { Pencil, Trash2, Car } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useListRentals, useCreateRental, useUpdateRental, useDeleteRental, getListRentalsQueryKey } from "@workspace/api-client-react";
import type { Rental } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import ModuleHeader from "@/components/modules/module-header";
import ModuleDocsWidget from "@/components/modules/module-docs-widget";

const schema = z.object({
  company: z.string().min(1, "La empresa es obligatoria"),
  pickupLocation: z.string().min(1, "Obligatorio"),
  returnLocation: z.string().optional(),
  pickupDate: z.string().min(1, "Obligatorio"),
  returnDate: z.string().min(1, "Obligatorio"),
  fuelPolicy: z.string().min(1, "Obligatorio"),
  vehicleType: z.string().optional(),
  confirmationCode: z.string().optional(),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function toLocal(iso: string) { return iso ? iso.substring(0, 16) : ""; }
function fmt(iso: string) { return new Date(iso).toLocaleString("es-ES", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

interface Props { tripId: number }

export default function RentalsModule({ tripId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rental | null>(null);
  const [deleting, setDeleting] = useState<Rental | null>(null);

  const { data: rentals, isLoading } = useListRentals(tripId, { query: { queryKey: getListRentalsQueryKey(tripId) } });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListRentalsQueryKey(tripId) });

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { company: "", pickupLocation: "", returnLocation: "", pickupDate: "", returnDate: "", fuelPolicy: "", vehicleType: "", confirmationCode: "", notes: "" } });

  const createRental = useCreateRental({ mutation: { onSuccess: () => { invalidate(); setOpen(false); form.reset(); toast({ title: "Alquiler añadido" }); } } });
  const updateRental = useUpdateRental({ mutation: { onSuccess: () => { invalidate(); setOpen(false); setEditing(null); form.reset(); toast({ title: "Alquiler actualizado" }); } } });
  const deleteRental = useDeleteRental({ mutation: { onSuccess: () => { invalidate(); setDeleting(null); toast({ title: "Alquiler eliminado" }); } } });

  function openNew() { form.reset({ company: "", pickupLocation: "", returnLocation: "", pickupDate: "", returnDate: "", fuelPolicy: "", vehicleType: "", confirmationCode: "", notes: "" }); setEditing(null); setOpen(true); }
  function openEdit(r: Rental) { form.reset({ company: r.company, pickupLocation: r.pickupLocation, returnLocation: r.returnLocation ?? "", pickupDate: toLocal(r.pickupDate), returnDate: toLocal(r.returnDate), fuelPolicy: r.fuelPolicy, vehicleType: r.vehicleType ?? "", confirmationCode: r.confirmationCode ?? "", notes: r.notes ?? "" }); setEditing(r); setOpen(true); }

  function onSubmit(values: FormValues) {
    const payload = { ...values, pickupDate: new Date(values.pickupDate).toISOString(), returnDate: new Date(values.returnDate).toISOString(), returnLocation: values.returnLocation || undefined, vehicleType: values.vehicleType || undefined, confirmationCode: values.confirmationCode || undefined, notes: values.notes || undefined };
    if (editing) updateRental.mutate({ tripId, rentalId: editing.id, data: payload });
    else createRental.mutate({ tripId, data: payload });
  }

  return (
    <div>
      <ModuleHeader title="Alquiler de Vehículo" description="Gestiona tus reservas de alquiler de vehículos" onAdd={openNew} />

      {isLoading ? (
        <Skeleton className="h-28 w-full rounded-xl" />
      ) : rentals && rentals.length > 0 ? (
        <div className="space-y-3">
          {rentals.map(r => (
            <div key={r.id} className="border border-border rounded-xl bg-card p-4" data-testid={`card-rental-${r.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{r.company}</p>
                    {r.vehicleType && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{r.vehicleType}</span>}
                    {r.confirmationCode && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">{r.confirmationCode}</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                    <div><span className="text-xs text-muted-foreground">Recogida</span><br /><span className="text-sm">{r.pickupLocation}</span><br /><span className="text-xs text-muted-foreground">{fmt(r.pickupDate)}</span></div>
                    <div><span className="text-xs text-muted-foreground">Devolución</span><br /><span className="text-sm">{r.returnLocation || r.pickupLocation}</span><br /><span className="text-xs text-muted-foreground">{fmt(r.returnDate)}</span></div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Combustible: {r.fuelPolicy}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleting(r)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          <Car className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No hay alquileres de vehículos</p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Alquiler" : "Añadir Alquiler de Vehículo"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="company" render={({ field }) => (<FormItem><FormLabel>Empresa</FormLabel><FormControl><Input placeholder="Hertz" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="vehicleType" render={({ field }) => (<FormItem><FormLabel>Tipo de vehículo</FormLabel><FormControl><Input placeholder="Toyota Corolla" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="pickupLocation" render={({ field }) => (<FormItem><FormLabel>Lugar de recogida</FormLabel><FormControl><Input placeholder="Terminal 2 Aeropuerto" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="returnLocation" render={({ field }) => (<FormItem><FormLabel>Lugar de devolución (si es diferente)</FormLabel><FormControl><Input placeholder="Oficina centro ciudad" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="pickupDate" render={({ field }) => (<FormItem><FormLabel>Fecha de recogida</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="returnDate" render={({ field }) => (<FormItem><FormLabel>Fecha de devolución</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="fuelPolicy" render={({ field }) => (
                <FormItem>
                  <FormLabel>Política de combustible</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar política" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Full-to-full">Lleno a lleno</SelectItem>
                      <SelectItem value="Full-to-empty">Lleno a vacío</SelectItem>
                      <SelectItem value="Pre-purchased">Prepagado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="confirmationCode" render={({ field }) => (<FormItem><FormLabel>Código de confirmación</FormLabel><FormControl><Input placeholder="HZ-2026-12345" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notas</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter>
                <Button type="submit" disabled={createRental.isPending || updateRental.isPending}>{editing ? "Guardar cambios" : "Añadir alquiler"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar alquiler?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteRental.mutate({ tripId, rentalId: deleting.id })} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ModuleDocsWidget tripId={tripId} module="rental" moduleLabel="Alquiler de Vehículo" />
    </div>
  );
}
