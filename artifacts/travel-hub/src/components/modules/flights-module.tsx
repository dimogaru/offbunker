import { useState } from "react";
import { PlusCircle, Pencil, Trash2, Plane, Clock } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListFlights, useCreateFlight, useUpdateFlight, useDeleteFlight,
  getListFlightsQueryKey,
} from "@workspace/api-client-react";
import type { Flight } from "@workspace/api-client-react";
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
  airline: z.string().min(1, "Airline is required"),
  flightNumber: z.string().min(1, "Flight number is required"),
  departureAirport: z.string().min(1, "Required"),
  arrivalAirport: z.string().min(1, "Required"),
  departureTime: z.string().min(1, "Required"),
  arrivalTime: z.string().min(1, "Required"),
  terminal: z.string().optional(),
  gate: z.string().optional(),
  seat: z.string().optional(),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function toLocalDatetime(iso: string) {
  if (!iso) return "";
  return iso.substring(0, 16);
}

function formatDatetime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface Props { tripId: number }

export default function FlightsModule({ tripId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Flight | null>(null);
  const [deleting, setDeleting] = useState<Flight | null>(null);

  const { data: flights, isLoading } = useListFlights(tripId, {
    query: { queryKey: getListFlightsQueryKey(tripId) },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListFlightsQueryKey(tripId) });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { airline: "", flightNumber: "", departureAirport: "", arrivalAirport: "", departureTime: "", arrivalTime: "", terminal: "", gate: "", seat: "", notes: "" },
  });

  const createFlight = useCreateFlight({ mutation: { onSuccess: () => { invalidate(); setOpen(false); form.reset(); toast({ title: "Flight added" }); } } });
  const updateFlight = useUpdateFlight({ mutation: { onSuccess: () => { invalidate(); setOpen(false); setEditing(null); form.reset(); toast({ title: "Flight updated" }); } } });
  const deleteFlight = useDeleteFlight({ mutation: { onSuccess: () => { invalidate(); setDeleting(null); toast({ title: "Flight deleted" }); } } });

  function openNew() { form.reset({ airline: "", flightNumber: "", departureAirport: "", arrivalAirport: "", departureTime: "", arrivalTime: "", terminal: "", gate: "", seat: "", notes: "" }); setEditing(null); setOpen(true); }
  function openEdit(f: Flight) { form.reset({ airline: f.airline, flightNumber: f.flightNumber, departureAirport: f.departureAirport, arrivalAirport: f.arrivalAirport, departureTime: toLocalDatetime(f.departureTime), arrivalTime: toLocalDatetime(f.arrivalTime), terminal: f.terminal ?? "", gate: f.gate ?? "", seat: f.seat ?? "", notes: f.notes ?? "" }); setEditing(f); setOpen(true); }

  function onSubmit(values: FormValues) {
    const payload = { ...values, departureTime: new Date(values.departureTime).toISOString(), arrivalTime: new Date(values.arrivalTime).toISOString() };
    if (editing) {
      updateFlight.mutate({ tripId, flightId: editing.id, data: payload });
    } else {
      createFlight.mutate({ tripId, data: payload });
    }
  }

  return (
    <div>
      <ModuleHeader title="Air Logistics" description="Manage your flights, boarding passes, and visas" onAdd={openNew} />

      {isLoading ? (
        <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
      ) : flights && flights.length > 0 ? (
        <div className="space-y-3">
          {flights.map(f => (
            <div key={f.id} className="border border-border rounded-xl bg-card p-4" data-testid={`card-flight-${f.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{f.airline}</span>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">{f.flightNumber}</span>
                    {f.seat && <span className="text-xs text-muted-foreground">Seat {f.seat}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-sm">
                    <div className="text-center">
                      <p className="font-bold text-base">{f.departureAirport}</p>
                      <p className="text-xs text-muted-foreground">{formatDatetime(f.departureTime)}</p>
                    </div>
                    <div className="flex-1 flex items-center gap-1">
                      <div className="h-px flex-1 bg-border" />
                      <Plane className="w-3.5 h-3.5 text-muted-foreground" />
                      <div className="h-px flex-1 bg-border" />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-base">{f.arrivalAirport}</p>
                      <p className="text-xs text-muted-foreground">{formatDatetime(f.arrivalTime)}</p>
                    </div>
                  </div>
                  {(f.terminal || f.gate) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {f.terminal && `Terminal ${f.terminal}`}{f.terminal && f.gate && " · "}{f.gate && `Gate ${f.gate}`}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(f)} data-testid={`button-edit-flight-${f.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleting(f)} data-testid={`button-delete-flight-${f.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          <Plane className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No flights added yet</p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Flight" : "Add Flight"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="airline" render={({ field }) => (<FormItem><FormLabel>Airline</FormLabel><FormControl><Input placeholder="Japan Airlines" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="flightNumber" render={({ field }) => (<FormItem><FormLabel>Flight No.</FormLabel><FormControl><Input placeholder="JL408" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="departureAirport" render={({ field }) => (<FormItem><FormLabel>From (IATA)</FormLabel><FormControl><Input placeholder="MAD" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="arrivalAirport" render={({ field }) => (<FormItem><FormLabel>To (IATA)</FormLabel><FormControl><Input placeholder="NRT" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="departureTime" render={({ field }) => (<FormItem><FormLabel>Departure</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="arrivalTime" render={({ field }) => (<FormItem><FormLabel>Arrival</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="terminal" render={({ field }) => (<FormItem><FormLabel>Terminal</FormLabel><FormControl><Input placeholder="T4" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="gate" render={({ field }) => (<FormItem><FormLabel>Gate</FormLabel><FormControl><Input placeholder="G22" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="seat" render={({ field }) => (<FormItem><FormLabel>Seat</FormLabel><FormControl><Input placeholder="24A" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter>
                <Button type="submit" disabled={createFlight.isPending || updateFlight.isPending}>{editing ? "Save changes" : "Add flight"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete flight?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove {deleting?.flightNumber}. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteFlight.mutate({ tripId, flightId: deleting.id })} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
