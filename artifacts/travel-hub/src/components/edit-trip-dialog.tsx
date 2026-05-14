import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateTrip, getListTripsQueryKey, getGetTripQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(1, "El nombre del viaje es obligatorio"),
  destination: z.string().min(1, "El destino es obligatorio"),
  startDate: z.string().min(1, "La fecha de inicio es obligatoria"),
  endDate: z.string().min(1, "La fecha de fin es obligatoria"),
  status: z.enum(["upcoming", "ongoing", "completed"]),
  coverImage: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Trip {
  id: number;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: string;
  coverImage?: string | null;
  notes?: string | null;
}

interface Props {
  trip: Trip | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditTripDialog({ trip, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", destination: "", startDate: "", endDate: "", status: "upcoming", coverImage: "", notes: "" },
  });

  useEffect(() => {
    if (trip) {
      form.reset({
        name: trip.name,
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
        status: (trip.status as FormValues["status"]) ?? "upcoming",
        coverImage: trip.coverImage ?? "",
        notes: trip.notes ?? "",
      });
    }
  }, [trip, form]);

  const updateTrip = useUpdateTrip({
    mutation: {
      onSuccess: (updated) => {
        queryClient.invalidateQueries({ queryKey: getListTripsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTripQueryKey(updated.id) });
        toast({ title: "Viaje actualizado", description: `${updated.name} ha sido guardado.` });
        onOpenChange(false);
      },
      onError: () => {
        toast({ title: "Error", description: "No se pudo actualizar el viaje.", variant: "destructive" });
      },
    },
  });

  function onSubmit(values: FormValues) {
    if (!trip) return;
    updateTrip.mutate({
      tripId: trip.id,
      data: {
        name: values.name,
        destination: values.destination,
        startDate: values.startDate,
        endDate: values.endDate,
        status: values.status,
        coverImage: values.coverImage || undefined,
        notes: values.notes || undefined,
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Viaje</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre del viaje</FormLabel>
                <FormControl><Input placeholder="Aventura en Tokio" {...field} data-testid="input-edit-trip-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="destination" render={({ field }) => (
              <FormItem>
                <FormLabel>Destino</FormLabel>
                <FormControl><Input placeholder="Tokio, Japón" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="startDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de inicio</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="endDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de fin</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem>
                <FormLabel>Estado</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="upcoming">Próximo</SelectItem>
                    <SelectItem value="ongoing">En curso</SelectItem>
                    <SelectItem value="completed">Completado</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="coverImage" render={({ field }) => (
              <FormItem>
                <FormLabel>URL de imagen de portada (opcional)</FormLabel>
                <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notas (opcional)</FormLabel>
                <FormControl><Textarea placeholder="Cualquier detalle adicional..." rows={3} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={updateTrip.isPending} data-testid="button-save-trip">
                {updateTrip.isPending ? "Guardando..." : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
