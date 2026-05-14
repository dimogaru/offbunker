import { useState } from "react";
import { Pencil, Trash2, ParkingCircle } from "lucide-react";
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

const schema = z.object({
  location: z.string().min(1, "Location is required"),
  reservationCode: z.string().min(1, "Reservation code is required"),
  entryDate: z.string().min(1, "Required"),
  exitDate: z.string().min(1, "Required"),
  priceTotal: z.string().optional(),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function toLocalDatetime(iso: string) { return iso ? iso.substring(0, 16) : ""; }
function fmt(iso: string) { return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

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

  const createParking = useCreateParking({ mutation: { onSuccess: () => { invalidate(); setOpen(false); form.reset(); toast({ title: "Parking added" }); } } });
  const updateParking = useUpdateParking({ mutation: { onSuccess: () => { invalidate(); setOpen(false); setEditing(null); form.reset(); toast({ title: "Parking updated" }); } } });
  const deleteParking = useDeleteParking({ mutation: { onSuccess: () => { invalidate(); setDeleting(null); toast({ title: "Parking deleted" }); } } });

  function openNew() { form.reset({ location: "", reservationCode: "", entryDate: "", exitDate: "", priceTotal: "", notes: "" }); setEditing(null); setOpen(true); }
  function openEdit(p: Parking) { form.reset({ location: p.location, reservationCode: p.reservationCode, entryDate: toLocalDatetime(p.entryDate), exitDate: toLocalDatetime(p.exitDate), priceTotal: p.priceTotal?.toString() ?? "", notes: p.notes ?? "" }); setEditing(p); setOpen(true); }

  function onSubmit(values: FormValues) {
    const payload = { location: values.location, reservationCode: values.reservationCode, entryDate: new Date(values.entryDate).toISOString(), exitDate: new Date(values.exitDate).toISOString(), priceTotal: values.priceTotal ? parseFloat(values.priceTotal) : undefined, notes: values.notes || undefined };
    if (editing) updateParking.mutate({ tripId, parkingId: editing.id, data: payload });
    else createParking.mutate({ tripId, data: payload });
  }

  return (
    <div>
      <ModuleHeader title="Airport Parking" description="Track your airport parking reservations" onAdd={openNew} />

      {isLoading ? (
        <div className="space-y-3">{[1].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
      ) : parkings && parkings.length > 0 ? (
        <div className="space-y-3">
          {parkings.map(p => (
            <div key={p.id} className="border border-border rounded-xl bg-card p-4" data-testid={`card-parking-${p.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{p.location}</p>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">{p.reservationCode}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-muted-foreground">
                    <div><span className="text-xs uppercase font-medium text-foreground">Entry</span><br />{fmt(p.entryDate)}</div>
                    <div><span className="text-xs uppercase font-medium text-foreground">Exit</span><br />{fmt(p.exitDate)}</div>
                  </div>
                  {p.priceTotal && <p className="text-sm mt-1 font-medium">${Number(p.priceTotal).toFixed(2)}</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleting(p)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          <ParkingCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No parking reservations added</p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Parking" : "Add Parking"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField control={form.control} name="location" render={({ field }) => (<FormItem><FormLabel>Location</FormLabel><FormControl><Input placeholder="Parking T4 Barajas" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="reservationCode" render={({ field }) => (<FormItem><FormLabel>Reservation code</FormLabel><FormControl><Input placeholder="MAD-78234" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="entryDate" render={({ field }) => (<FormItem><FormLabel>Entry date</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="exitDate" render={({ field }) => (<FormItem><FormLabel>Exit date</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="priceTotal" render={({ field }) => (<FormItem><FormLabel>Total price (optional)</FormLabel><FormControl><Input type="number" placeholder="145.50" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter>
                <Button type="submit" disabled={createParking.isPending || updateParking.isPending}>{editing ? "Save changes" : "Add parking"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete parking?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteParking.mutate({ tripId, parkingId: deleting.id })} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
