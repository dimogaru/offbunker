import { useState } from "react";
import { Pencil, Trash2, CalendarDays, Clock, MapPin } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useListItineraryItems, useCreateItineraryItem, useUpdateItineraryItem, useDeleteItineraryItem, getListItineraryItemsQueryKey } from "@workspace/api-client-react";
import type { ItineraryItem } from "@workspace/api-client-react";
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

const CATEGORIES = ["transport", "sightseeing", "dining", "activity", "accommodation", "other"] as const;

const CATEGORY_LABELS: Record<string, string> = {
  transport: "Transporte",
  sightseeing: "Turismo",
  dining: "Gastronomía",
  activity: "Actividad",
  accommodation: "Alojamiento",
  other: "Otro",
};

const CATEGORY_COLORS: Record<string, string> = {
  transport: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  sightseeing: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  dining: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  activity: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  accommodation: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  other: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

const CATEGORY_DOT: Record<string, string> = {
  transport: "bg-sky-400",
  sightseeing: "bg-violet-400",
  dining: "bg-orange-400",
  activity: "bg-emerald-400",
  accommodation: "bg-blue-400",
  other: "bg-slate-400",
};

const schema = z.object({
  date: z.string().min(1, "La fecha es obligatoria"),
  time: z.string().optional(),
  title: z.string().min(1, "El título es obligatorio"),
  description: z.string().optional(),
  location: z.string().optional(),
  category: z.enum(CATEGORIES),
});
type FormValues = z.infer<typeof schema>;

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const d = dateStr.includes("T") ? new Date(dateStr) : new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("es-ES", { weekday: "long", month: "long", day: "numeric" });
}

interface Props { tripId: number }

export default function ItineraryModule({ tripId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ItineraryItem | null>(null);
  const [deleting, setDeleting] = useState<ItineraryItem | null>(null);

  const { data: items, isLoading } = useListItineraryItems(tripId, { query: { queryKey: getListItineraryItemsQueryKey(tripId) } });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListItineraryItemsQueryKey(tripId) });

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { date: "", time: "", title: "", description: "", location: "", category: "other" } });

  const createItem = useCreateItineraryItem({ mutation: { onSuccess: () => { invalidate(); setOpen(false); form.reset(); toast({ title: "Actividad añadida" }); } } });
  const updateItem = useUpdateItineraryItem({ mutation: { onSuccess: () => { invalidate(); setOpen(false); setEditing(null); form.reset(); toast({ title: "Actividad actualizada" }); } } });
  const deleteItem = useDeleteItineraryItem({ mutation: { onSuccess: () => { invalidate(); setDeleting(null); toast({ title: "Actividad eliminada" }); } } });

  function openNew() { form.reset({ date: "", time: "", title: "", description: "", location: "", category: "other" }); setEditing(null); setOpen(true); }
  function openEdit(i: ItineraryItem) { form.reset({ date: i.date, time: i.time ?? "", title: i.title, description: i.description ?? "", location: i.location ?? "", category: (i.category || "other") as FormValues["category"] }); setEditing(i); setOpen(true); }

  function onSubmit(values: FormValues) {
    const payload = { ...values, time: values.time || undefined, description: values.description || undefined, location: values.location || undefined };
    if (editing) updateItem.mutate({ tripId, itemId: editing.id, data: payload });
    else createItem.mutate({ tripId, data: payload });
  }

  const grouped = items?.reduce((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {} as Record<string, ItineraryItem[]>) ?? {};

  const sortedDates = Object.keys(grouped).sort();

  return (
    <div>
      <ModuleHeader title="Itinerario" description="Programa de actividades día a día" onAdd={openNew} />

      {isLoading ? (
        <div className="space-y-4">{[1, 2].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}</div>
      ) : sortedDates.length > 0 ? (
        <div className="space-y-8">
          {sortedDates.map(date => {
            const dayItems = grouped[date].slice().sort((a, b) => (a.time || "").localeCompare(b.time || ""));
            return (
              <div key={date}>
                {/* Day header */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
                    <CalendarDays className="w-3.5 h-3.5 text-primary-foreground" />
                  </div>
                  <h3 className="font-semibold text-sm capitalize">{formatDate(date)}</h3>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Timeline items */}
                <div className="ml-3">
                  {dayItems.map((item, idx) => (
                    <div key={item.id} className="flex gap-4" data-testid={`card-itinerary-${item.id}`}>
                      {/* Dot + vertical connector */}
                      <div className="flex flex-col items-center w-4 flex-shrink-0 pt-1">
                        <div className={`w-3 h-3 rounded-full ring-2 ring-background flex-shrink-0 ${CATEGORY_DOT[item.category || "other"]}`} />
                        {idx < dayItems.length - 1 && (
                          <div className="flex-1 min-h-[2rem] mt-1.5" style={{ borderLeft: "2px dashed rgba(128,128,128,0.25)" }} />
                        )}
                      </div>

                      {/* Content */}
                      <div className={`flex-1 ${idx < dayItems.length - 1 ? "pb-5" : "pb-1"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {/* Time + category badge */}
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              {item.time && (
                                <span className="flex items-center gap-1 text-xs font-mono font-semibold bg-muted px-1.5 py-0.5 rounded text-foreground">
                                  <Clock className="w-3 h-3 text-muted-foreground" />
                                  {item.time}
                                </span>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[item.category || "other"]}`}>
                                {CATEGORY_LABELS[item.category || "other"]}
                              </span>
                            </div>
                            <p className="font-medium text-sm">{item.title}</p>
                            {item.description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>}
                            {item.location && (
                              <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                {item.location}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-0.5 flex-shrink-0">
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(item)}><Pencil className="w-3 h-3" /></Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => setDeleting(item)}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No hay actividades en el itinerario</p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar Actividad" : "Añadir Actividad"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="date" render={({ field }) => (<FormItem><FormLabel>Fecha</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="time" render={({ field }) => (<FormItem><FormLabel>Hora (opcional)</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Título de la actividad</FormLabel><FormControl><Input placeholder="Visitar el Templo Sensoji" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem><FormLabel>Categoría</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="location" render={({ field }) => (<FormItem><FormLabel>Lugar (opcional)</FormLabel><FormControl><Input placeholder="Asakusa, Tokio" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Descripción (opcional)</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter>
                <Button type="submit" disabled={createItem.isPending || updateItem.isPending}>{editing ? "Guardar cambios" : "Añadir actividad"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar actividad?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteItem.mutate({ tripId, itemId: deleting.id })} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ModuleDocsWidget tripId={tripId} module="itinerary" moduleLabel="Itinerario" />
    </div>
  );
}
