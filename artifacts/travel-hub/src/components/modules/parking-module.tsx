import { useState, useRef } from "react";
import {
  Pencil, Trash2, ParkingCircle, Clock, MapPin, Hash, Euro, Eye,
  Paperclip, CheckCircle2, Loader2, X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListParkings, useCreateParking, useUpdateParking, useDeleteParking, getListParkingsQueryKey,
  useListDocuments, useCreateDocument, useDeleteDocument, getListDocumentsQueryKey,
} from "@workspace/api-client-react";
import type { Parking, Document } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import ModuleHeader from "@/components/modules/module-header";

// ── Doc helpers ──────────────────────────────────────────────────────────────

const FILE_CHIP_COLORS: Record<string, string> = {
  PDF:    "bg-red-500/15 text-red-400",
  Imagen: "bg-emerald-500/15 text-emerald-400",
  Word:   "bg-blue-500/15 text-blue-400",
  Otro:   "bg-slate-500/15 text-slate-400",
};

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

// ── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  location:        z.string().min(1, "La ubicación es obligatoria"),
  reservationCode: z.string().min(1, "El código de reserva es obligatorio"),
  entryDate:       z.string().min(1, "Obligatorio"),
  exitDate:        z.string().min(1, "Obligatorio"),
  priceTotal:      z.string().optional(),
  notes:           z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function toLocalDatetime(iso: string) { return iso ? iso.substring(0, 16) : ""; }
function fmt(iso: string) { return new Date(iso).toLocaleString("es-ES", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }

// ── Module ───────────────────────────────────────────────────────────────────

interface Props { tripId: number; readOnly?: boolean }

export default function ParkingModule({ tripId, readOnly }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  /* Parking CRUD state */
  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState<Parking | null>(null);
  const [deleting, setDeleting] = useState<Parking | null>(null);
  const [isViewing, setIsViewing] = useState(false);

  /* Doc upload state */
  const [uploadingFor, setUploadingFor] = useState<Parking | null>(null);
  const [docName, setDocName]           = useState("");
  const [docFileUrl, setDocFileUrl]     = useState("");
  const [uploading, setUploading]       = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Doc delete state */
  const [deletingDoc, setDeletingDoc] = useState<Document | null>(null);

  /* ── Queries ── */
  const { data: parkings, isLoading } = useListParkings(tripId, { query: { queryKey: getListParkingsQueryKey(tripId) } });
  const { data: allDocs } = useListDocuments(tripId, { query: { queryKey: getListDocumentsQueryKey(tripId) } });

  const invalidate     = () => queryClient.invalidateQueries({ queryKey: getListParkingsQueryKey(tripId) });
  const invalidateDocs = () => queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey(tripId) });

  /* ── Mutations ── */
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { location: "", reservationCode: "", entryDate: "", exitDate: "", priceTotal: "", notes: "" },
  });

  const createParking = useCreateParking({ mutation: { onSuccess: () => { invalidate(); setOpen(false); form.reset(); toast({ title: "Estacionamiento añadido" }); } } });
  const updateParking = useUpdateParking({ mutation: { onSuccess: () => { invalidate(); setOpen(false); setEditing(null); form.reset(); toast({ title: "Estacionamiento actualizado" }); } } });
  const deleteParking = useDeleteParking({ mutation: { onSuccess: () => { invalidate(); setDeleting(null); toast({ title: "Estacionamiento eliminado" }); } } });

  const createDoc = useCreateDocument({
    mutation: {
      onSuccess: () => {
        invalidateDocs();
        setUploadingFor(null);
        setDocName(""); setDocFileUrl("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        toast({ title: "Documento añadido" });
      },
    },
  });
  const deleteDoc = useDeleteDocument({
    mutation: {
      onSuccess: () => { invalidateDocs(); setDeletingDoc(null); toast({ title: "Documento eliminado" }); },
    },
  });

  /* ── Derived ── */
  function getParkingDocs(parkingId: number): Document[] {
    return allDocs?.filter(d => d.module === "parking" && d.notes === `parkingId:${parkingId}`) ?? [];
  }

  /* ── Handlers ── */
  function openNew() {
    form.reset({ location: "", reservationCode: "", entryDate: "", exitDate: "", priceTotal: "", notes: "" });
    setEditing(null); setIsViewing(false); setOpen(true);
  }
  function openEdit(p: Parking) {
    form.reset({ location: p.location, reservationCode: p.reservationCode, entryDate: toLocalDatetime(p.entryDate), exitDate: toLocalDatetime(p.exitDate), priceTotal: p.priceTotal?.toString() ?? "", notes: p.notes ?? "" });
    setEditing(p); setIsViewing(false); setOpen(true);
  }
  function openView(p: Parking) {
    form.reset({ location: p.location, reservationCode: p.reservationCode, entryDate: toLocalDatetime(p.entryDate), exitDate: toLocalDatetime(p.exitDate), priceTotal: p.priceTotal?.toString() ?? "", notes: p.notes ?? "" });
    setEditing(p); setIsViewing(true); setOpen(true);
  }
  function handleDialogClose(v: boolean) { setOpen(v); if (!v) setIsViewing(false); }

  function openUpload(p: Parking) {
    setUploadingFor(p);
    setDocName(""); setDocFileUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!ALLOWED.includes(file.type)) {
      toast({ title: "Formato no permitido", description: "Solo PDF, JPEG, PNG o WebP.", variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Archivo demasiado grande", description: "El límite es 5 MB.", variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
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

  function handleSaveDoc() {
    if (!uploadingFor || !docName.trim() || createDoc.isPending) return;
    const fileType = docFileUrl ? fileTypeFrom(docFileUrl) : "Otro";
    createDoc.mutate({
      tripId,
      data: {
        module: "parking",
        name: docName.trim(),
        fileType,
        fileUrl: docFileUrl || undefined,
        notes: `parkingId:${uploadingFor.id}`,
      },
    });
  }

  function onSubmit(values: FormValues) {
    const payload = {
      location: values.location,
      reservationCode: values.reservationCode,
      entryDate: new Date(values.entryDate).toISOString(),
      exitDate: new Date(values.exitDate).toISOString(),
      priceTotal: values.priceTotal ? parseFloat(values.priceTotal) : undefined,
      notes: values.notes || undefined,
    };
    if (editing) updateParking.mutate({ tripId, parkingId: editing.id, data: payload });
    else createParking.mutate({ tripId, data: payload });
  }

  return (
    <div>
      <ModuleHeader title="Estacionamiento" description="Reservas de estacionamiento en el aeropuerto" onAdd={openNew} readOnly={readOnly} />

      {isLoading ? (
        <div className="space-y-3"><Skeleton className="h-24 w-full rounded-xl" /></div>
      ) : parkings && parkings.length > 0 ? (
        <div className="space-y-3">
          {parkings.map(p => {
            const docs = getParkingDocs(p.id);
            return (
              <div key={p.id} className="booking-card border border-border rounded-xl bg-card p-4" data-testid={`card-parking-${p.id}`}>
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <p className="font-semibold truncate">{p.location}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Hash className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">{p.reservationCode}</span>
                      {p.priceTotal && (
                        <span className="flex items-center gap-0.5 text-xs text-muted-foreground ml-1">
                          <Euro className="w-3 h-3" />
                          {Number(p.priceTotal).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openView(p)} title="Ver detalles">
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    {!readOnly && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>}
                    {!readOnly && <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleting(p)}><Trash2 className="w-3.5 h-3.5" /></Button>}
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/60">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Entrada</p>
                    <p className="flex items-center gap-1 text-sm font-medium">
                      <Clock className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      {fmt(p.entryDate)}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Salida</p>
                    <p className="flex items-center gap-1 text-sm font-medium">
                      <Clock className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                      {fmt(p.exitDate)}
                    </p>
                  </div>
                </div>

                {/* ── Documents section ── */}
                {(!readOnly || docs.length > 0) && (
                  <div className="mt-3 pt-3 border-t border-border/60">
                    {docs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {docs.map(doc => (
                          <div key={doc.id} className="group flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-1 text-xs hover:border-primary/40 transition-colors">
                            <span className={`font-bold px-1 py-0.5 rounded-full text-[9px] uppercase tracking-wide flex-shrink-0 ${FILE_CHIP_COLORS[doc.fileType] ?? FILE_CHIP_COLORS["Otro"]}`}>
                              {doc.fileType?.slice(0, 3)}
                            </span>
                            {doc.fileUrl ? (
                              <button type="button" onClick={() => openDocUrl(doc.fileUrl!)} className="font-medium max-w-[110px] truncate text-foreground/80 hover:text-primary transition-colors text-left">
                                {doc.name}
                              </button>
                            ) : (
                              <span className="font-medium max-w-[110px] truncate text-foreground/80">{doc.name}</span>
                            )}
                            {!readOnly && (
                              <button onClick={() => setDeletingDoc(doc)} title="Eliminar" className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 p-0.5">
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {!readOnly && (
                      <button onClick={() => openUpload(p)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                        <Paperclip className="w-3.5 h-3.5" />
                        {docs.length > 0 ? "Añadir otro documento" : "Añadir documento"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          <ParkingCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No hay reservas de estacionamiento</p>
        </div>
      )}

      {/* ── Parking form / view dialog ── */}
      <Dialog open={open} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isViewing ? "Detalles del Estacionamiento" : editing ? "Editar Estacionamiento" : "Añadir Estacionamiento"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField control={form.control} name="location" render={({ field }) => (<FormItem><FormLabel>Ubicación</FormLabel><FormControl><Input placeholder="Parking T4 Barajas" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="reservationCode" render={({ field }) => (<FormItem><FormLabel>Código de reserva</FormLabel><FormControl><Input placeholder="MAD-78234" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="entryDate" render={({ field }) => (<FormItem><FormLabel>Fecha de entrada</FormLabel><FormControl><Input type="datetime-local" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="exitDate" render={({ field }) => (<FormItem><FormLabel>Fecha de salida</FormLabel><FormControl><Input type="datetime-local" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="priceTotal" render={({ field }) => (<FormItem><FormLabel>Precio total (opcional)</FormLabel><FormControl><Input type="number" placeholder="145.50" step="0.01" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notas</FormLabel><FormControl><Textarea rows={2} disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>)} />
              {!isViewing && (
                <DialogFooter>
                  <Button type="submit" disabled={createParking.isPending || updateParking.isPending}>{editing ? "Guardar cambios" : "Añadir estacionamiento"}</Button>
                </DialogFooter>
              )}
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Upload document dialog ── */}
      <Dialog open={!!uploadingFor} onOpenChange={(v) => { if (!v) { setUploadingFor(null); setDocName(""); setDocFileUrl(""); } }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm">
          <DialogHeader>
            <DialogTitle>Subir documento — Estacionamiento</DialogTitle>
            {uploadingFor && <p className="text-xs text-muted-foreground mt-1">{uploadingFor.location}</p>}
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <div
                onClick={() => !uploading && fileInputRef.current?.click()}
                className={`flex items-center gap-2 border border-border rounded-md px-3 py-2.5 bg-background transition-colors ${uploading ? "opacity-60" : "cursor-pointer hover:bg-muted/40"}`}
              >
                {uploading
                  ? <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                  : <Paperclip className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                <span className={`text-sm truncate flex-1 min-w-0 ${docFileUrl || uploading ? "text-foreground" : "text-muted-foreground"}`}>
                  {uploading ? "Subiendo…" : docFileUrl ? docName : "Seleccionar archivo…"}
                </span>
                {docFileUrl && !uploading && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
              </div>
              <p className="text-[11px] text-muted-foreground px-0.5">PDF, JPEG, PNG o WebP · máx. 5 MB</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            <div>
              <label className="text-sm font-medium">Nombre del documento</label>
              <Input className="mt-1.5" placeholder="Reserva, bono de parking…" value={docName} onChange={(e) => setDocName(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Aparecerá también en la Bóveda de Documentos bajo la categoría <span className="font-medium text-foreground">Estacionamiento</span>.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveDoc} disabled={!docName.trim() || uploading || createDoc.isPending}>
              {createDoc.isPending ? "Guardando…" : "Guardar documento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete parking confirmation ── */}
      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar estacionamiento?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteParking.mutate({ tripId, parkingId: deleting.id })} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete document confirmation ── */}
      <AlertDialog open={!!deletingDoc} onOpenChange={() => setDeletingDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminará permanentemente "{deletingDoc?.name}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingDoc && deleteDoc.mutate({ tripId, documentId: deletingDoc.id })}
              className="bg-destructive hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
