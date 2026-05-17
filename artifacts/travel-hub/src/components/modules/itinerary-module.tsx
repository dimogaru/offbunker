import { useState, useRef } from "react";
import {
  Pencil, Trash2, CalendarDays, Clock, MapPin, ExternalLink,
  Paperclip, X, Loader2, CheckCircle2,
} from "lucide-react";
import MapsLink from "@/components/maps-link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListItineraryItems, useCreateItineraryItem, useUpdateItineraryItem, useDeleteItineraryItem,
  getListItineraryItemsQueryKey,
  useListDocuments, useCreateDocument, useDeleteDocument, getListDocumentsQueryKey,
} from "@workspace/api-client-react";
import type { ItineraryItem, Document } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import ModuleHeader from "@/components/modules/module-header";

/* ─────────────────── Constants ─────────────────────────────── */

const CATEGORIES = ["transport", "sightseeing", "dining", "activity", "accommodation", "other"] as const;

const CATEGORY_LABELS: Record<string, string> = {
  transport: "Transporte", sightseeing: "Turismo", dining: "Gastronomía",
  activity: "Actividad", accommodation: "Alojamiento", other: "Otro",
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
  transport: "bg-sky-400", sightseeing: "bg-violet-400", dining: "bg-orange-400",
  activity: "bg-emerald-400", accommodation: "bg-blue-400", other: "bg-slate-400",
};
const FILE_CHIP_COLORS: Record<string, string> = {
  PDF: "bg-red-500/15 text-red-400", Imagen: "bg-emerald-500/15 text-emerald-400",
  Word: "bg-blue-500/15 text-blue-400", Otro: "bg-slate-500/15 text-slate-400",
};

/* ─────────────────── Helpers ────────────────────────────────── */

/** Normalise to YYYY-MM-DD regardless of whether the server returns a bare date or a full ISO string */
function normalizeDate(dateStr: string) {
  return dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
}
function formatShortDate(dateStr: string) {
  const d = new Date(normalizeDate(dateStr) + "T12:00:00Z");
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}
function mapsUrl(loc: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc).replace(/%20/g, "+")}`;
}
function fileTypeFrom(url: string) {
  const ext = url.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "PDF";
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "Imagen";
  if (["doc", "docx"].includes(ext)) return "Word";
  return "Otro";
}

/* ─────────────────── Schema ─────────────────────────────────── */

const schema = z.object({
  date: z.string().min(1, "La fecha es obligatoria"),
  time: z.string().optional(),
  title: z.string().min(1, "El título es obligatorio"),
  description: z.string().optional(),
  location: z.string().optional(),
  category: z.enum(CATEGORIES),
});
type FormValues = z.infer<typeof schema>;

/* ─────────────────── Component ──────────────────────────────── */

interface Props { tripId: number }

export default function ItineraryModule({ tripId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  /* Activity CRUD state */
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ItineraryItem | null>(null);
  const [deleting, setDeleting] = useState<ItineraryItem | null>(null);

  /* Day tab state */
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  /* Doc upload state */
  const [uploadingFor, setUploadingFor] = useState<ItineraryItem | null>(null);
  const [docName, setDocName] = useState("");
  const [docFileUrl, setDocFileUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Doc delete state */
  const [deletingDoc, setDeletingDoc] = useState<Document | null>(null);

  /* ── Queries ── */
  const { data: items, isLoading } = useListItineraryItems(tripId, {
    query: { queryKey: getListItineraryItemsQueryKey(tripId) },
  });
  const { data: allDocs } = useListDocuments(tripId, {
    query: { queryKey: getListDocumentsQueryKey(tripId) },
  });

  const invalidateItems = () => queryClient.invalidateQueries({ queryKey: getListItineraryItemsQueryKey(tripId) });
  const invalidateDocs  = () => queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey(tripId) });

  /* ── Mutations ── */
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: "", time: "", title: "", description: "", location: "", category: "other" },
  });

  const onMutationError = (label: string) => () => {
    toast({ title: `Error al ${label}`, description: "Comprueba tu conexión e inténtalo de nuevo.", variant: "destructive" });
  };

  const createItem = useCreateItineraryItem({ mutation: { onSuccess: () => { invalidateItems(); setOpen(false); form.reset(); toast({ title: "Actividad añadida" }); }, onError: onMutationError("guardar la actividad") } });
  const updateItem = useUpdateItineraryItem({ mutation: { onSuccess: () => { invalidateItems(); setOpen(false); setEditing(null); form.reset(); toast({ title: "Actividad actualizada" }); }, onError: onMutationError("actualizar la actividad") } });
  const deleteItem = useDeleteItineraryItem({ mutation: { onSuccess: () => { invalidateItems(); setDeleting(null); toast({ title: "Actividad eliminada" }); }, onError: onMutationError("eliminar la actividad") } });

  const createDoc = useCreateDocument({
    mutation: {
      onSuccess: () => {
        invalidateDocs();
        setUploadingFor(null);
        setDocName(""); setDocFileUrl("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        toast({ title: "Documento añadido" });
      },
      onError: onMutationError("guardar el documento"),
    },
  });
  const deleteDoc = useDeleteDocument({ mutation: { onSuccess: () => { invalidateDocs(); setDeletingDoc(null); toast({ title: "Documento eliminado" }); }, onError: onMutationError("eliminar el documento") } });

  /* ── Derived state ── */
  const sortedDates = [...new Set(items?.map(i => normalizeDate(i.date)) ?? [])].sort();
  const effectiveDate = (selectedDate && sortedDates.includes(selectedDate)) ? selectedDate : (sortedDates[0] ?? null);

  const dayItems = items?.filter(i => normalizeDate(i.date) === effectiveDate) ?? [];
  const timedItems   = dayItems.filter(i => i.time).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
  const untimedItems = dayItems.filter(i => !i.time);

  /**
   * Activity docs use module="itinerary" (valid enum) and notes="activityId:{id}"
   * so they appear correctly in the Vault and are included in offline sync.
   */
  function getActivityDocs(activityId: number) {
    return allDocs?.filter(d =>
      d.module === "itinerary" && d.notes === `activityId:${activityId}`
    ) ?? [];
  }

  /* ── Handlers ── */
  function openNew() {
    form.reset({ date: effectiveDate ?? "", time: "", title: "", description: "", location: "", category: "other" });
    setEditing(null);
    setOpen(true);
  }
  function openEdit(item: ItineraryItem) {
    // normalizeDate ensures we pass "YYYY-MM-DD" to the date input, not a full ISO string
    form.reset({ date: normalizeDate(item.date), time: item.time ?? "", title: item.title, description: item.description ?? "", location: item.location ?? "", category: (item.category || "other") as FormValues["category"] });
    setEditing(item);
    setOpen(true);
  }
  function onSubmit(values: FormValues) {
    const payload = { ...values, time: values.time || undefined, description: values.description || undefined, location: values.location || undefined };
    console.log("[Itinerario] onSubmit →", payload);
    if (editing) updateItem.mutate({ tripId, itemId: editing.id, data: payload });
    else createItem.mutate({ tripId, data: payload });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocName(file.name);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      const { url } = (await res.json()) as { url: string };
      setDocFileUrl(url);
    } catch {
      toast({ title: "Error al subir el archivo", variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setUploading(false);
    }
  }

  function handleSaveDoc() {
    if (!uploadingFor || !docName.trim() || createDoc.isPending) return;
    const fileType = docFileUrl ? fileTypeFrom(docFileUrl) : "Otro";
    // module must be the valid enum value "itinerary"; the activity association is
    // stored in `notes` so the Vault displays it correctly and offline sync picks it up.
    createDoc.mutate({
      tripId,
      data: {
        module: "itinerary",
        name: docName.trim(),
        fileType,
        fileUrl: docFileUrl || undefined,
        notes: `activityId:${uploadingFor.id}`,
      },
    });
  }

  function openUpload(item: ItineraryItem) {
    setUploadingFor(item);
    setDocName(""); setDocFileUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /* ── Activity card renderer ── */
  function renderItem(item: ItineraryItem, idx: number, showConnector: boolean) {
    const docs = getActivityDocs(item.id);
    return (
      <div key={item.id} className="flex gap-4" data-testid={`card-itinerary-${item.id}`}>
        {/* Dot + vertical connector */}
        <div className="flex flex-col items-center w-4 flex-shrink-0 pt-1">
          <div className={`w-3 h-3 rounded-full ring-2 ring-background flex-shrink-0 ${CATEGORY_DOT[item.category || "other"]}`} />
          {showConnector && (
            <div className="flex-1 min-h-[2rem] mt-1.5" style={{ borderLeft: "2px dashed rgba(128,128,128,0.25)" }} />
          )}
        </div>

        {/* Card */}
        <div className={`flex-1 rounded-xl border border-border bg-card p-3.5 ${showConnector ? "mb-3" : "mb-1"}`}>
          {/* Title row */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {item.time && (
                  <span className="flex items-center gap-1 text-xs font-mono font-semibold bg-muted px-1.5 py-0.5 rounded text-foreground">
                    <Clock className="w-3 h-3 text-muted-foreground" />{item.time}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[item.category || "other"]}`}>
                  {CATEGORY_LABELS[item.category || "other"]}
                </span>
              </div>
              <p className="font-medium text-sm">{item.title}</p>
              {item.description && (
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>
              )}
            </div>
            <div className="flex gap-0.5 flex-shrink-0">
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(item)}><Pencil className="w-3 h-3" /></Button>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => setDeleting(item)}><Trash2 className="w-3 h-3" /></Button>
            </div>
          </div>

          {/* Location + Maps link */}
          {item.location && (
            <div className="flex items-center gap-1.5 mb-2">
              <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground flex-1 truncate">{item.location}</span>
              <MapsLink query={item.location} label="Ver Maps" />
            </div>
          )}

          {/* Document chips */}
          <div className="pt-2 border-t border-border/50 mt-2">
            <div className="flex items-center flex-wrap gap-1.5">
              {docs.map(doc => (
                <div
                  key={doc.id}
                  className="group flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-1 text-xs hover:border-primary/40 transition-colors"
                >
                  <span className={`font-bold px-1 py-0.5 rounded-full text-[9px] uppercase tracking-wide flex-shrink-0 ${FILE_CHIP_COLORS[doc.fileType] ?? FILE_CHIP_COLORS["Otro"]}`}>
                    {doc.fileType?.slice(0, 3)}
                  </span>
                  <span className="font-medium max-w-[100px] truncate text-foreground/80">{doc.name}</span>
                  {doc.fileUrl && (
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0">
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                  <button onClick={() => setDeletingDoc(doc)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => openUpload(item)}
                className="flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
              >
                <Paperclip className="w-2.5 h-2.5" />
                Añadir doc
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── JSX ─── */
  return (
    <div>
      <ModuleHeader title="Itinerario" description="Programa de actividades día a día" onAdd={openNew} />

      {/* Day Tabs */}
      {!isLoading && sortedDates.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-5 -mx-1 px-1">
          {sortedDates.map((date, idx) => {
            const active = date === effectiveDate;
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all border ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-muted/60 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                }`}
              >
                Día {idx + 1} <span className="opacity-70 ml-1">·</span> {formatShortDate(date)}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">{[1, 2].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>
      ) : sortedDates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No hay actividades en el itinerario</p>
          <p className="text-xs mt-1 opacity-60">Pulsa Añadir para crear la primera actividad</p>
        </div>
      ) : dayItems.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-xl">
          <p className="text-sm">Sin actividades para este día</p>
        </div>
      ) : (
        <div>
          {/* Timed items — timeline */}
          {timedItems.length > 0 && (
            <div className="ml-2">
              {timedItems.map((item, idx) =>
                renderItem(item, idx, idx < timedItems.length - 1 || untimedItems.length > 0)
              )}
            </div>
          )}

          {/* Untimed items */}
          {untimedItems.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3 ml-6">
                Actividades del día sin hora
              </p>
              <div className="ml-2">
                {untimedItems.map((item, idx) => renderItem(item, idx, idx < untimedItems.length - 1))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Form dialog (create / edit activity) ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar Actividad" : "Añadir Actividad"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="date" render={({ field }) => (<FormItem><FormLabel>Fecha</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="time" render={({ field }) => (<FormItem><FormLabel>Hora (opcional)</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Título</FormLabel><FormControl><Input placeholder="Visitar el Templo Sensoji" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem><FormLabel>Categoría</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="location" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Dirección o Lugar (opcional)</FormLabel>
                    {field.value && <MapsLink query={field.value} label="Ver en Maps" />}
                  </div>
                  <FormControl><Input placeholder="Asakusa, Tokio" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Descripción (opcional)</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter>
                <Button type="submit" disabled={createItem.isPending || updateItem.isPending}>
                  {editing ? "Guardar cambios" : "Añadir actividad"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Delete activity dialog ── */}
      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar actividad?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteItem.mutate({ tripId, itemId: deleting.id })} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Upload document dialog ── */}
      <Dialog open={!!uploadingFor} onOpenChange={(v) => { if (!v) { setUploadingFor(null); setDocName(""); setDocFileUrl(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Añadir documento</DialogTitle>
            {uploadingFor && <p className="text-xs text-muted-foreground mt-1">{uploadingFor.title}</p>}
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`flex items-center gap-3 border border-border rounded-md px-3 py-2.5 bg-background transition-colors ${uploading ? "opacity-60" : "cursor-pointer hover:bg-muted/40"}`}
            >
              {uploading
                ? <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                : <Paperclip className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
              <span className={`text-sm truncate flex-1 ${docFileUrl || uploading ? "text-foreground" : "text-muted-foreground"}`}>
                {uploading ? "Subiendo…" : docFileUrl ? docName : "Seleccionar archivo (PDF, imagen…)"}
              </span>
              {docFileUrl && !uploading && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx" className="hidden" onChange={handleFileChange} />
            <div>
              <label className="text-sm font-medium">Nombre del documento</label>
              <Input className="mt-1.5" placeholder="Entrada, ticket, reserva…" value={docName} onChange={(e) => setDocName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveDoc} disabled={!docName.trim() || uploading || createDoc.isPending}>
              {createDoc.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete document dialog ── */}
      <AlertDialog open={!!deletingDoc} onOpenChange={() => setDeletingDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle><AlertDialogDescription>Se eliminará "{deletingDoc?.name}" de esta actividad.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingDoc && deleteDoc.mutate({ tripId, documentId: deletingDoc.id })} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
