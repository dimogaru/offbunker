import { useLocation, Link } from "wouter";
import { ArrowLeft, Plane } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateTrip, getListTripsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { WifiOff } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "El nombre del viaje es obligatorio"),
  destination: z.string().min(1, "El destino es obligatorio"),
  startDate: z.string().min(1, "La fecha de inicio es obligatoria"),
  endDate: z.string().min(1, "La fecha de fin es obligatoria"),
  coverImage: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NewTrip() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", destination: "", startDate: "", endDate: "", coverImage: "", notes: "" },
  });

  const createTrip = useCreateTrip({
    mutation: {
      onSuccess: (trip) => {
        queryClient.invalidateQueries({ queryKey: getListTripsQueryKey() });
        toast({ title: "Viaje creado", description: `${trip.name} ha sido añadido.` });
        navigate(`/trips/${trip.id}`);
      },
      onError: () => {
        toast({ title: "Error", description: "No se pudo crear el viaje.", variant: "destructive" });
      },
    },
  });

  function onSubmit(values: FormValues) {
    if (!isOnline) {
      toast({ title: "Sin conexión", description: "Crear viajes requiere conexión a internet.", variant: "destructive" });
      return;
    }
    createTrip.mutate({
      data: {
        name: values.name,
        destination: values.destination,
        startDate: values.startDate,
        endDate: values.endDate,
        coverImage: values.coverImage || undefined,
        notes: values.notes || undefined,
      },
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Plane className="w-5 h-5 text-primary" />
            <span className="text-lg font-bold">Nuevo Viaje</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-card border border-border rounded-xl p-6">
          <h1 className="text-xl font-bold mb-1">Planifica un nuevo viaje</h1>
          <p className="text-muted-foreground text-sm mb-6">Introduce los datos básicos para comenzar</p>

          {!isOnline && (
            <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              <WifiOff className="w-4 h-4 flex-shrink-0" />
              <span>Sin conexión — no es posible crear viajes en modo offline.</span>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del viaje</FormLabel>
                  <FormControl><Input placeholder="Aventura en Tokio" {...field} data-testid="input-trip-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="destination" render={({ field }) => (
                <FormItem>
                  <FormLabel>Destino</FormLabel>
                  <FormControl><Input placeholder="Tokio, Japón" {...field} data-testid="input-destination" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de inicio</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-start-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="endDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de fin</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-end-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="coverImage" render={({ field }) => (
                <FormItem>
                  <FormLabel>URL de imagen de portada (opcional)</FormLabel>
                  <FormControl><Input placeholder="https://..." {...field} data-testid="input-cover-image" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (opcional)</FormLabel>
                  <FormControl><Textarea placeholder="Cualquier detalle adicional..." rows={3} {...field} data-testid="input-notes" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={createTrip.isPending || !isOnline} className="flex-1" data-testid="button-submit-trip">
                  {createTrip.isPending ? "Creando..." : "Crear Viaje"}
                </Button>
                <Link href="/">
                  <Button type="button" variant="outline" data-testid="button-cancel">Cancelar</Button>
                </Link>
              </div>
            </form>
          </Form>
        </div>
      </main>
    </div>
  );
}
