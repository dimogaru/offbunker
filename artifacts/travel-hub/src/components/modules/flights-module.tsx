import { useState, useRef } from "react";
import {
  PlusCircle, Pencil, Trash2, Plane, Clock, Armchair, DoorOpen, LayoutGrid,
  Paperclip, Loader2, CheckCircle2, Eye, Lock,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListFlights, useCreateFlight, useUpdateFlight, useDeleteFlight, getListFlightsQueryKey,
  useListDocuments, useCreateDocument, useDeleteDocument, getListDocumentsQueryKey,
} from "@workspace/api-client-react";
import type { Flight, Document } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import ModuleHeader from "@/components/modules/module-header";
import { documentUploadDestination, LOCAL_DOCUMENT_MESSAGE, useLocalDocuments, isLocalDocument } from "@/lib/local-documents";
import type { LocalDocument } from "@/lib/local-documents";
type DisplayDocument = Document | LocalDocument;

/* ─── Constants ──────────────────────────────────────────────── */

const FILE_CHIP_COLORS: Record<string, string> = {
  PDF: "bg-red-500/15 text-red-400",
  Imagen: "bg-emerald-500/15 text-emerald-400",
  Word: "bg-blue-500/15 text-blue-400",
  Otro: "bg-slate-500/15 text-slate-400",
};

/* ─── Helpers ────────────────────────────────────────────────── */

function toLocalDatetime(iso: string) { return iso ? iso.substring(0, 16) : ""; }
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}
function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
function openDocUrl(url: string): void {
  if (url.startsWith("data:")) {
    const blob = dataUrlToBlob(url);
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
function fileTypeFrom(url: string) {
  if (url.startsWith("data:")) {
    const mime = url.match(/^data:(.*?);/)?.[1] ?? "";
    if (mime === "application/pdf") return "PDF";
    if (mime.startsWith("image/")) return "Imagen";
    if (mime.includes("word") || mime.includes("document")) return "Word";
    return "Otro";
  }
  const ext = url.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "PDF";
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "Imagen";
  if (["doc", "docx"].includes(ext)) return "Word";
  return "Otro";
}

/* ─── Schema ─────────────────────────────────────────────────── */

const schema = z.object({
  airline: z.string().min(1, "La aerolínea es obligatoria"),
  flightNumber: z.string().min(1, "El número de vuelo es obligatorio"),
  departureAirport: z.string().min(1, "Obligatorio"),
  arrivalAirport: z.string().min(1, "Obligatorio"),
  departureTime: z.string().min(1, "Obligatorio"),
  arrivalTime: z.string().min(1, "Obligatorio"),
  terminal: z.string().optional(),
  gate: z.string().optional(),
  seat: z.string().optional(),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface Props { tripId: number; readOnly?: boolean; localDocumentsEnabled?: boolean }

export default function FlightsModule({ tripId, readOnly, localDocumentsEnabled }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  /* Flight CRUD state */
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Flight | null>(null);
  const [deleting, setDeleting] = useState<Flight | null>(null);
  const [isViewing, setIsViewing] = useState(false);

  /* Doc upload state */
  const [uploadingFor, setUploadingFor] = useState<Flight | null>(null);
  const [docName, setDocName] = useState("");
  const [docFileUrl, setDocFileUrl] = useState("");
  const [pendingDocFile, setPendingDocFile] = useState<File | null>(null);
  const [uploadIsLocal, setUploadIsLocal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingLocal, setSavingLocal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Doc delete state */
  const [deletingDoc, setDeletingDoc] = useState<DisplayDocument | null>(null);

  /* ── Queries ── */
  const { data: flights, isLoading } = useListFlights(tripId, { query: { queryKey: getListFlightsQueryKey(tripId) } });
  const { data: allDocs } = useListDocuments(tripId, { query: { queryKey: getListDocumentsQueryKey(tripId) } });
  const localStore = useLocalDocuments(tripId);

  const invalidateFlights = () => queryClient.invalidateQueries({ queryKey: getListFlightsQueryKey(tripId) });
  const invalidateDocs    = () => queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey(tripId) });

  /* ── Mutations ── */
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { airline: "", flightNumber: "", departureAirport: "", arrivalAirport: "", departureTime: "", arrivalTime: "", terminal: "", gate: "", seat: "", notes: "" },
  });

  const onErr = (label: string) => () => toast({ title: `Error al ${label}`, description: "Comprueba tu conexión e inténtalo de nuevo.", variant: "destructive" });

  const createFlight = useCreateFlight({ mutation: { onSuccess: () => { invalidateFlights(); setOpen(false); form.reset(); toast({ title: "Vuelo añadido" }); }, onError: onErr("guardar el vuelo") } });
  const updateFlight = useUpdateFlight({ mutation: { onSuccess: () => { invalidateFlights(); setOpen(false); setEditing(null); form.reset(); toast({ title: "Vuelo actualizado" }); }, onError: onErr("actualizar el vuelo") } });
  const deleteFlight = useDeleteFlight({ mutation: { onSuccess: () => { if (deleting) void localStore.removeByAssociation("flights", `flightId:${deleting.id}`); invalidateFlights(); setDeleting(null); toast({ title: "Vuelo eliminado" }); }, onError: onErr("eliminar el vuelo") } });

  const createDoc = useCreateDocument({
    mutation: {
      onSuccess: () => {
        invalidateDocs();
        setUploadingFor(null);
        setDocName(""); setDocFileUrl("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        toast({ title: "Documento añadido" });
      },
      onError: onErr("guardar el documento"),
    },
  });
  const deleteDoc = useDeleteDocument({ mutation: { onSuccess: () => { invalidateDocs(); setDeletingDoc(null); toast({ title: "Documento eliminado" }); }, onError: onErr("eliminar el documento") } });

  /* ── Derived ── */
  function getFlightDocs(flightId: number) {
    return [...(allDocs?.filter(d => d.module === "flights" && d.notes === `flightId:${flightId}`) ?? []), ...localStore.documents.filter(d => d.module === "flights" && d.notes === `flightId:${flightId}`)] as DisplayDocument[];
  }

  /* ── Handlers ── */
  function openNew() {
    form.reset({ airline: "", flightNumber: "", departureAirport: "", arrivalAirport: "", departureTime: "", arrivalTime: "", terminal: "", gate: "", seat: "", notes: "" });
    setEditing(null);
    setIsViewing(false);
    setOpen(true);
  }
  function openEdit(f: Flight) {
    form.reset({ airline: f.airline, flightNumber: f.flightNumber, departureAirport: f.departureAirport, arrivalAirport: f.arrivalAirport, departureTime: toLocalDatetime(f.departureTime), arrivalTime: toLocalDatetime(f.arrivalTime), terminal: f.terminal ?? "", gate: f.gate ?? "", seat: f.seat ?? "", notes: f.notes ?? "" });
    setEditing(f);
    setIsViewing(false);
    setOpen(true);
  }
  function openView(f: Flight) {
    form.reset({ airline: f.airline, flightNumber: f.flightNumber, departureAirport: f.departureAirport, arrivalAirport: f.arrivalAirport, departureTime: toLocalDatetime(f.departureTime), arrivalTime: toLocalDatetime(f.arrivalTime), terminal: f.terminal ?? "", gate: f.gate ?? "", seat: f.seat ?? "", notes: f.notes ?? "" });
    setEditing(f);
    setIsViewing(true);
    setOpen(true);
  }
  function handleDialogClose(v: boolean) {
    setOpen(v);
    if (!v) setIsViewing(false);
  }
  function onSubmit(values: FormValues) {
    const payload = { ...values, departureTime: new Date(values.departureTime).toISOString(), arrivalTime: new Date(values.arrivalTime).toISOString() };
    if (editing) updateFlight.mutate({ tripId, flightId: editing.id, data: payload });
    else createFlight.mutate({ tripId, data: payload });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (uploadIsLocal) {
      const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
      if (!allowed.includes(file.type) || file.size > 5 * 1024 * 1024) {
        toast({ title: "Formato o tamaño no permitido", description: "Solo PDF, JPEG, PNG o WebP; máximo 5 MB.", variant: "destructive" });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setPendingDocFile(file);
      setDocName(file.name);
      return;
    }
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

  async function handleSaveDoc() {
    if (!uploadingFor || !docName.trim() || createDoc.isPending || savingLocal) return;
    if (uploadIsLocal && !pendingDocFile) { toast({ title: "Selecciona un archivo", variant: "destructive" }); return; }
    if (uploadIsLocal && pendingDocFile) {
      setSavingLocal(true);
      try {
        await localStore.save({ tripId, module: "flights", name: docName.trim(), fileType: pendingDocFile.type === "application/pdf" ? "PDF" : "Imagen", notes: `flightId:${uploadingFor.id}`, blob: pendingDocFile });
        setUploadingFor(null);
        setPendingDocFile(null);
        setDocName("");
        setDocFileUrl("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        toast({ title: "Documento guardado", description: LOCAL_DOCUMENT_MESSAGE });
      } catch (error) {
        setPendingDocFile(null);
        setDocName("");
        setDocFileUrl("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        toast({ title: "Error al guardar", description: error instanceof Error ? error.message : "IndexedDB no disponible.", variant: "destructive" });
      } finally {
        setSavingLocal(false);
      }
      return;
    }
    if (!docFileUrl) { toast({ title: "Selecciona un archivo", variant: "destructive" }); return; }
    const fileType = docFileUrl ? fileTypeFrom(docFileUrl) : "Otro";
    createDoc.mutate({
      tripId,
      data: {
        module: "flights",
        name: docName.trim(),
        fileType,
        fileUrl: docFileUrl || undefined,
        notes: `flightId:${uploadingFor.id}`,
      },
    });
  }

  function openUpload(f: Flight) {
    setUploadingFor(f);
    setDocName(""); setDocFileUrl("");
    setPendingDocFile(null); setUploadIsLocal(Boolean(localDocumentsEnabled) || documentUploadDestination() === "soloDispositivo");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /* ─── JSX ─── */
  return (
    <div>
      <ModuleHeader title="Logística Aérea" description="Gestiona tus vuelos, tarjetas de embarque y visados" onAdd={openNew} readOnly={readOnly} />

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>
      ) : flights && flights.length > 0 ? (
        <div className="space-y-3">
          {flights.map(f => {
            const docs = getFlightDocs(f.id);
            return (
              <div key={f.id} className="booking-card border border-border rounded-xl bg-card p-4" data-testid={`card-flight-${f.id}`}>
                {/* Top row: airline + flight number + actions */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{f.airline}</span>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">{f.flightNumber}</span>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openView(f)} title="Ver detalles"><Eye className="w-3.5 h-3.5" /></Button>
                    {!readOnly && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(f)} data-testid={`button-edit-flight-${f.id}`}><Pencil className="w-3.5 h-3.5" /></Button>}
                    {!readOnly && <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleting(f)} data-testid={`button-delete-flight-${f.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>}
                  </div>
                </div>

                {/* Route row */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-center min-w-[56px]">
                    <p className="font-bold text-xl leading-tight">{f.departureAirport}</p>
                    <p className="flex items-center justify-center gap-0.5 text-xs text-muted-foreground mt-0.5">
                      <Clock className="w-3 h-3" />{formatTime(f.departureTime)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{formatDay(f.departureTime)}</p>
                  </div>
                  <div className="flex-1 flex items-center gap-1">
                    <div className="h-px flex-1 bg-border" />
                    <Plane className="w-4 h-4 text-primary" />
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="text-center min-w-[56px]">
                    <p className="font-bold text-xl leading-tight">{f.arrivalAirport}</p>
                    <p className="flex items-center justify-center gap-0.5 text-xs text-muted-foreground mt-0.5">
                      <Clock className="w-3 h-3" />{formatTime(f.arrivalTime)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{formatDay(f.arrivalTime)}</p>
                  </div>
                </div>

                {/* Details row (terminal / gate / seat) */}
                {(f.terminal || f.gate || f.seat) && (
                  <div className="flex items-center gap-3 mb-3 pb-3 border-b border-border/60">
                    {f.terminal && <span className="flex items-center gap-1 text-xs text-muted-foreground"><LayoutGrid className="w-3.5 h-3.5" />Terminal {f.terminal}</span>}
                    {f.gate    && <span className="flex items-center gap-1 text-xs text-muted-foreground"><DoorOpen  className="w-3.5 h-3.5" />Puerta {f.gate}</span>}
                    {f.seat    && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Armchair  className="w-3.5 h-3.5" />Asiento {f.seat}</span>}
                  </div>
                )}

                {/* Document chips */}
                <div className={`${f.terminal || f.gate || f.seat ? "" : "pt-3 border-t border-border/50 mt-3"}`}>
                  <div className="flex items-center flex-wrap gap-1.5">
                    {docs.map(doc => (
                      <div key={doc.id} className="flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-1 text-xs hover:border-primary/40 transition-colors">
                        <span className={`font-bold px-1 py-0.5 rounded-full text-[9px] uppercase tracking-wide flex-shrink-0 ${FILE_CHIP_COLORS[doc.fileType] ?? FILE_CHIP_COLORS["Otro"]}`}>
                          {doc.fileType?.slice(0, 3)}
                        </span>
                         {doc.fileUrl || isLocalDocument(doc) ? (
                           <button type="button" onClick={() => isLocalDocument(doc) ? localStore.open(doc) : openDocUrl(doc.fileUrl!)} className="font-medium max-w-[110px] truncate text-foreground/80 hover:text-primary transition-colors text-left">
                            {doc.name}
                          </button>
                        ) : (
                          <span className="font-medium max-w-[110px] truncate text-foreground/80">{doc.name}</span>
                        )}
                         {isLocalDocument(doc) && <span title={LOCAL_DOCUMENT_MESSAGE} aria-label={LOCAL_DOCUMENT_MESSAGE}><Lock className="w-3 h-3" /><span className="sr-only">{LOCAL_DOCUMENT_MESSAGE}</span></span>}
                         {(!readOnly || (localDocumentsEnabled && isLocalDocument(doc))) && (
                           <button onClick={() => setDeletingDoc(doc)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 p-0.5" title="Eliminar documento">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    {(!readOnly || localDocumentsEnabled) && (
                      <button
                        onClick={() => openUpload(f)}
                        className="flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
                      >
                        <Paperclip className="w-2.5 h-2.5" />
                        Añadir doc
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          <Plane className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No hay vuelos añadidos</p>
        </div>
      )}

      {/* ── Flight form / view dialog ── */}
      <Dialog open={open} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isViewing ? "Detalles del Vuelo" : editing ? "Editar Vuelo" : "Añadir Vuelo"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="airline"          render={({ field }) => (<FormItem><FormLabel>Aerolínea</FormLabel><FormControl><Input placeholder="Japan Airlines" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="flightNumber"     render={({ field }) => (<FormItem><FormLabel>Nº de vuelo</FormLabel><FormControl><Input placeholder="JL408" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="departureAirport" render={({ field }) => (<FormItem><FormLabel>Origen (IATA)</FormLabel><FormControl><Input placeholder="MAD" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="arrivalAirport"   render={({ field }) => (<FormItem><FormLabel>Destino (IATA)</FormLabel><FormControl><Input placeholder="NRT" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="departureTime"    render={({ field }) => (<FormItem><FormLabel>Salida</FormLabel><FormControl><Input type="datetime-local" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="arrivalTime"      render={({ field }) => (<FormItem><FormLabel>Llegada</FormLabel><FormControl><Input type="datetime-local" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="terminal"         render={({ field }) => (<FormItem><FormLabel>Terminal</FormLabel><FormControl><Input placeholder="T4" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="gate"             render={({ field }) => (<FormItem><FormLabel>Puerta</FormLabel><FormControl><Input placeholder="G22" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="seat"             render={({ field }) => (<FormItem><FormLabel>Asiento</FormLabel><FormControl><Input placeholder="24A" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notas</FormLabel><FormControl><Textarea rows={2} disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>)} />

              {/* Read-only document chips */}
              {isViewing && editing && (() => {
                const viewDocs = getFlightDocs(editing.id);
                return (
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Documentos adjuntos</p>
                    {viewDocs.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No hay documentos adjuntos a este vuelo</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {viewDocs.map(doc => (
                          <div key={doc.id} className="flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-1 text-xs">
                            <span className={`font-bold px-1 py-0.5 rounded-full text-[9px] uppercase tracking-wide flex-shrink-0 ${FILE_CHIP_COLORS[doc.fileType] ?? FILE_CHIP_COLORS["Otro"]}`}>
                              {doc.fileType?.slice(0, 3)}
                            </span>
                             {doc.fileUrl || isLocalDocument(doc) ? (
                               <button type="button" onClick={() => isLocalDocument(doc) ? localStore.open(doc) : openDocUrl(doc.fileUrl!)} className="font-medium max-w-[110px] truncate text-foreground/80 hover:text-primary transition-colors text-left">
                                {doc.name}
                              </button>
                            ) : (
                              <span className="font-medium max-w-[110px] truncate text-foreground/80">{doc.name}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {!isViewing && (
                <DialogFooter>
                  <Button type="submit" disabled={createFlight.isPending || updateFlight.isPending}>{editing ? "Guardar cambios" : "Añadir vuelo"}</Button>
                </DialogFooter>
              )}
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Delete flight dialog ── */}
      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar vuelo?</AlertDialogTitle><AlertDialogDescription>Se eliminará {deleting?.flightNumber}. Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteFlight.mutate({ tripId, flightId: deleting.id })} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Upload doc dialog ── */}
      <Dialog open={!!uploadingFor} onOpenChange={(v) => { if (!v && !savingLocal) { setUploadingFor(null); setDocName(""); setDocFileUrl(""); setPendingDocFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Añadir documento</DialogTitle>
            {uploadingFor && <p className="text-xs text-muted-foreground mt-1">{uploadingFor.airline} · {uploadingFor.flightNumber}</p>}
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`flex items-center gap-3 border border-border rounded-md px-3 py-2.5 bg-background transition-colors ${uploading ? "opacity-60" : "cursor-pointer hover:bg-muted/40"}`}
            >
              {uploading ? <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" /> : <Paperclip className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
              <span className={`text-sm truncate flex-1 ${docFileUrl || uploading ? "text-foreground" : "text-muted-foreground"}`}>
                {uploading ? "Subiendo…" : docFileUrl ? docName : "Seleccionar archivo (PDF, imagen…)"}
              </span>
              {docFileUrl && !uploading && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx" className="hidden" onChange={handleFileChange} />
            <div>
              <label className="text-sm font-medium">Nombre del documento</label>
              <Input className="mt-1.5" placeholder="Billete, tarjeta de embarque, visado…" value={docName} onChange={(e) => setDocName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveDoc} disabled={!docName.trim() || uploading || createDoc.isPending || savingLocal}>
              {createDoc.isPending || savingLocal ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete doc dialog ── */}
      <AlertDialog open={!!deletingDoc} onOpenChange={() => setDeletingDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle><AlertDialogDescription>Se eliminará "{deletingDoc?.name}" de este vuelo.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingDoc && (isLocalDocument(deletingDoc) ? localStore.remove(String(deletingDoc.id)).then(() => { setDeletingDoc(null); }) : deleteDoc.mutate({ tripId, documentId: Number(deletingDoc.id) }))} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
