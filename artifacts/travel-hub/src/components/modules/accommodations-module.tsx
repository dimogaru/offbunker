import { useState } from "react";
import { Pencil, Trash2, Building2, MapPin, ExternalLink } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useListAccommodations, useCreateAccommodation, useUpdateAccommodation, useDeleteAccommodation, getListAccommodationsQueryKey } from "@workspace/api-client-react";
import type { Accommodation } from "@workspace/api-client-react";
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

type AccommodationExt = Accommodation & { bookingPlatform?: string | null };

const schema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  type: z.enum(["hotel", "airbnb", "hostel", "other"]),
  bookingPlatform: z.string().optional(),
  address: z.string().min(1, "La dirección es obligatoria"),
  checkIn: z.string().min(1, "Obligatorio"),
  checkOut: z.string().min(1, "Obligatorio"),
  confirmationCode: z.string().min(1, "El código de confirmación es obligatorio"),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function toLocal(iso: string) { return iso ? iso.substring(0, 16) : ""; }
function fmt(iso: string) { return new Date(iso).toLocaleString("es-ES", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
function mapsUrl(address: string) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address).replace(/%20/g, "+")}` }

const TYPE_LABEL: Record<string, string> = { hotel: "Hotel", airbnb: "Airbnb", hostel: "Hostel", other: "Otro" };

interface Props { tripId: number }

export default function AccommodationsModule({ tripId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AccommodationExt | null>(null);
  const [deleting, setDeleting] = useState<AccommodationExt | null>(null);

  const { data: accommodations, isLoading } = useListAccommodations(tripId, { query: { queryKey: getListAccommodationsQueryKey(tripId) } });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListAccommodationsQueryKey(tripId) });

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "", type: "hotel", bookingPlatform: "", address: "", checkIn: "", checkOut: "", confirmationCode: "", contactPhone: "", notes: "" } });

  const addressValue = form.watch("address");

  const createAccommodation = useCreateAccommodation({ mutation: { onSuccess: () => { invalidate(); setOpen(false); form.reset(); toast({ title: "Alojamiento añadido" }); } } });
  const updateAccommodation = useUpdateAccommodation({ mutation: { onSuccess: () => { invalidate(); setOpen(false); setEditing(null); form.reset(); toast({ title: "Alojamiento actualizado" }); } } });
  const deleteAccommodation = useDeleteAccommodation({ mutation: { onSuccess: () => { invalidate(); setDeleting(null); toast({ title: "Alojamiento eliminado" }); } } });

  function openNew() { form.reset({ name: "", type: "hotel", bookingPlatform: "", address: "", checkIn: "", checkOut: "", confirmationCode: "", contactPhone: "", notes: "" }); setEditing(null); setOpen(true); }
  function openEdit(a: AccommodationExt) { form.reset({ name: a.name, type: (a.type || "hotel") as FormValues["type"], bookingPlatform: a.bookingPlatform ?? "", address: a.address, checkIn: toLocal(a.checkIn), checkOut: toLocal(a.checkOut), confirmationCode: a.confirmationCode, contactPhone: a.contactPhone ?? "", notes: a.notes ?? "" }); setEditing(a); setOpen(true); }

  function onSubmit(values: FormValues) {
    const payload = {
      ...values,
      checkIn: new Date(values.checkIn).toISOString(),
      checkOut: new Date(values.checkOut).toISOString(),
      bookingPlatform: values.bookingPlatform || undefined,
      contactPhone: values.contactPhone || undefined,
      notes: values.notes || undefined,
    };
    if (editing) updateAccommodation.mutate({ tripId, accommodationId: editing.id, data: payload as Parameters<typeof updateAccommodation.mutate>[0]["data"] });
    else createAccommodation.mutate({ tripId, data: payload as Parameters<typeof createAccommodation.mutate>[0]["data"] });
  }

  return (
    <div>
      <ModuleHeader title="Alojamiento" description="Lista cronológica de hoteles y alojamientos" onAdd={openNew} />

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
      ) : accommodations && accommodations.length > 0 ? (
        <div className="space-y-3">
          {(accommodations as AccommodationExt[]).map(a => (
            <div key={a.id} className="border border-border rounded-xl bg-card p-4" data-testid={`card-accommodation-${a.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{a.name}</p>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{TYPE_LABEL[a.type || "other"]}</span>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">{a.confirmationCode}</span>
                    {a.bookingPlatform && (
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">{a.bookingPlatform}</span>
                    )}
                  </div>
                  {/* Address with Google Maps link */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm text-muted-foreground truncate">{a.address}</span>
                    <a
                      href={mapsUrl(a.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-0.5 text-xs text-primary hover:underline flex-shrink-0 ml-1"
                      title="Ver en Google Maps"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Maps
                    </a>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                    <div><span className="text-xs text-muted-foreground">Entrada</span><br />{fmt(a.checkIn)}</div>
                    <div><span className="text-xs text-muted-foreground">Salida</span><br />{fmt(a.checkOut)}</div>
                  </div>
                  {a.contactPhone && <p className="text-xs text-muted-foreground mt-1">📞 {a.contactPhone}</p>}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(a)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleting(a)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No hay alojamientos añadidos</p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Alojamiento" : "Añadir Alojamiento"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nombre</FormLabel><FormControl><Input placeholder="Park Hyatt Tokyo" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="hotel">Hotel</SelectItem>
                        <SelectItem value="airbnb">Airbnb</SelectItem>
                        <SelectItem value="hostel">Hostel</SelectItem>
                        <SelectItem value="other">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="bookingPlatform" render={({ field }) => (
                <FormItem>
                  <FormLabel>Plataforma de Reserva (opcional)</FormLabel>
                  <FormControl><Input placeholder="Ej: Booking.com, Airbnb, Web del Hotel…" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Address + Google Maps preview */}
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Dirección</FormLabel>
                    {addressValue && (
                      <a
                        href={mapsUrl(addressValue)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Ver en Google Maps
                      </a>
                    )}
                  </div>
                  <FormControl><Input placeholder="1-1 Example St, Tokio" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="checkIn" render={({ field }) => (<FormItem><FormLabel>Entrada</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="checkOut" render={({ field }) => (<FormItem><FormLabel>Salida</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="confirmationCode" render={({ field }) => (<FormItem><FormLabel>Código de confirmación</FormLabel><FormControl><Input placeholder="CONF-12345" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="contactPhone" render={({ field }) => (<FormItem><FormLabel>Teléfono de contacto (opcional)</FormLabel><FormControl><Input placeholder="+81 3-1234-5678" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notas (opcional)</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter>
                <Button type="submit" disabled={createAccommodation.isPending || updateAccommodation.isPending}>
                  {editing ? "Guardar cambios" : "Añadir alojamiento"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar alojamiento?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteAccommodation.mutate({ tripId, accommodationId: deleting.id })} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
