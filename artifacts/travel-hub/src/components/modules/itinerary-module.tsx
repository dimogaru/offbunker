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

const CATEGORIES = ["transport", "sightseeing", "dining", "activity", "accommodation", "other"] as const;
const CATEGORY_COLORS: Record<string, string> = {
  transport: "bg-sky-100 text-sky-700",
  sightseeing: "bg-violet-100 text-violet-700",
  dining: "bg-orange-100 text-orange-700",
  activity: "bg-emerald-100 text-emerald-700",
  accommodation: "bg-blue-100 text-blue-700",
  other: "bg-slate-100 text-slate-600",
};

const schema = z.object({
  date: z.string().min(1, "Date is required"),
  time: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  location: z.string().optional(),
  category: z.enum(CATEGORIES),
});
type FormValues = z.infer<typeof schema>;

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
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

  const createItem = useCreateItineraryItem({ mutation: { onSuccess: () => { invalidate(); setOpen(false); form.reset(); toast({ title: "Activity added" }); } } });
  const updateItem = useUpdateItineraryItem({ mutation: { onSuccess: () => { invalidate(); setOpen(false); setEditing(null); form.reset(); toast({ title: "Activity updated" }); } } });
  const deleteItem = useDeleteItineraryItem({ mutation: { onSuccess: () => { invalidate(); setDeleting(null); toast({ title: "Activity deleted" }); } } });

  function openNew() { form.reset({ date: "", time: "", title: "", description: "", location: "", category: "other" }); setEditing(null); setOpen(true); }
  function openEdit(i: ItineraryItem) { form.reset({ date: i.date, time: i.time ?? "", title: i.title, description: i.description ?? "", location: i.location ?? "", category: (i.category || "other") as FormValues["category"] }); setEditing(i); setOpen(true); }

  function onSubmit(values: FormValues) {
    const payload = { ...values, time: values.time || undefined, description: values.description || undefined, location: values.location || undefined };
    if (editing) updateItem.mutate({ tripId, itemId: editing.id, data: payload });
    else createItem.mutate({ tripId, data: payload });
  }

  // Group by date
  const grouped = items?.reduce((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {} as Record<string, ItineraryItem[]>) ?? {};

  const sortedDates = Object.keys(grouped).sort();

  return (
    <div>
      <ModuleHeader title="Itinerary" description="Day-by-day schedule of activities" onAdd={openNew} />

      {isLoading ? (
        <div className="space-y-4">{[1, 2].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}</div>
      ) : sortedDates.length > 0 ? (
        <div className="space-y-6">
          {sortedDates.map(date => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">{formatDate(date)}</h3>
              </div>
              <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                {grouped[date].sort((a, b) => (a.time || "").localeCompare(b.time || "")).map(item => (
                  <div key={item.id} className="border border-border rounded-lg bg-card p-3" data-testid={`card-itinerary-${item.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.time && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />{item.time}
                            </span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[item.category || "other"]}`}>
                            {item.category}
                          </span>
                        </div>
                        <p className="font-medium text-sm mt-1">{item.title}</p>
                        {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                        {item.location && (
                          <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <MapPin className="w-3 h-3" />{item.location}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(item)}><Pencil className="w-3 h-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => setDeleting(item)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No itinerary items added</p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Activity" : "Add Activity"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="date" render={({ field }) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="time" render={({ field }) => (<FormItem><FormLabel>Time (optional)</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Activity title</FormLabel><FormControl><Input placeholder="Visit Sensoji Temple" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="location" render={({ field }) => (<FormItem><FormLabel>Location (optional)</FormLabel><FormControl><Input placeholder="Asakusa, Tokyo" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description (optional)</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter>
                <Button type="submit" disabled={createItem.isPending || updateItem.isPending}>{editing ? "Save changes" : "Add activity"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete activity?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteItem.mutate({ tripId, itemId: deleting.id })} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
