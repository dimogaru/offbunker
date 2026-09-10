import { useState, useRef } from "react";
import {
  Pencil, Trash2, Building2, MapPin, Clock, Phone, Hash,
  Paperclip, Loader2, CheckCircle2, Eye, Lock,
} from "lucide-react";
import MapsLink from "@/components/maps-link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAccommodations, useCreateAccommodation, useUpdateAccommodation, useDeleteAccommodation, getListAccommodationsQueryKey,
  useListDocuments, useCreateDocument, useDeleteDocument, getListDocumentsQueryKey,
} from "@workspace/api-client-react";
import type { Accommodation, Document } from "@workspace/api-client-react";
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
import { documentUploadDestination, LOCAL_DOCUMENT_MESSAGE, useLocalDocuments, isLocalDocument } from "@/lib/local-documents";
import type { LocalDocument } from "@/lib/local-documents";
type DisplayDocument = Document | LocalDocument;

/* ─── Types ──────────────────────────────────────────────────── */

type AccommodationExt = Accommodation & { bookingPlatform?: string | null };

/* ─── Constants ──────────────────────────────────────────────── */

const FILE_CHIP_COLORS: Record<string, string> = {
  PDF: "bg-red-500/15 text-red-400",
  Imagen: "bg-emerald-500/15 text-emerald-400",
  Word: "bg-blue-500/15 text-blue-400",
  Otro: "bg-slate-500/15 text-slate-400",
};

const TYPE_LABEL: Record<string, string> = { hotel: "Hotel", airbnb: "Airbnb", hostel: "Hostel", other: "Otro" };

/* ─── Helpers ────────────────────────────────────────────────── */

function toLocal(iso: string) { return iso ? iso.substring(0, 16) : ""; }
function fmt(iso: string) { return new Date(iso).toLocaleString("es-ES", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
function fmtDay(iso: string) { return new Date(iso).getDate(); }
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

interface Props { tripId: number; readOnly?: boolean; localDocumentsEnabled?: boolean }

export default function AccommodationsModule({ tripId, readOnly, localDocumentsEnabled }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  /* Accommodation CRUD state */
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AccommodationExt | null>(null);
  const [deleting, setDeleting] = useState<AccommodationExt | null>(null);
  const [isViewing, setIsViewing] = useState(false);

  /* Tab selection */
  const [selectedAccId, setSelectedAccId] = useState<number | null>(null);

  /* Doc upload state */
  const [uploadingFor, setUploadingFor] = useState<AccommodationExt | null>(null);
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
  const { data: accommodations, isLoading } = useListAccommodations(tripId, { query: { queryKey: getListAccommodationsQueryKey(tripId) } });
  const { data: allDocs } = useListDocuments(tripId, { query: { queryKey: getListDocumentsQueryKey(tripId) } });
  const localStore = useLocalDocuments(tripId);

  const invalidateAcc  = () => queryClient.invalidateQueries({ queryKey: getListAccommodationsQueryKey(tripId) });
  const invalidateDocs = () => queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey(tripId) });

  /* ── Derived: tab logic ── */
  const accList = (accommodations as AccommodationExt[] | undefined) ?? [];
  const effectiveAccId = (selectedAccId && accList.find(a => a.id === selectedAccId)) ? selectedAccId : (accList[0]?.id ?? null);
  const selectedAcc = accList.find(a => a.id === effectiveAccId) ?? null;

  /* ── Mutations ── */
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "", type: "hotel", bookingPlatform: "", address: "", checkIn: "", checkOut: "", confirmationCode: "", contactPhone: "", notes: "" } });
  const addressValue = form.watch("address");

  const onErr = (label: string) => () => toast({ title: `Error al ${label}`, description: "Comprueba tu conexión e inténtalo de nuevo.", variant: "destructive" });

  const createAccommodation = useCreateAccommodation({ mutation: { onSuccess: () => { invalidateAcc(); setOpen(false); form.reset(); toast({ title: "Alojamiento añadido" }); }, onError: onErr("guardar el alojamiento") } });
  const updateAccommodation = useUpdateAccommodation({ mutation: { onSuccess: () => { invalidateAcc(); setOpen(false); setEditing(null); form.reset(); toast({ title: "Alojamiento actualizado" }); }, onError: onErr("actualizar el alojamiento") } });
  const deleteAccommodation = useDeleteAccommodation({ mutation: { onSuccess: () => { if (deleting) void localStore.removeByAssociation("accommodation", `accommodationId:${deleting.id}`); invalidateAcc(); setDeleting(null); toast({ title: "Alojamiento eliminado" }); }, onError: onErr("eliminar el alojamiento") } });

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
  function getAccDocs(accId: number) {
    return [...(allDocs?.filter(d => d.module === "accommodation" && d.notes === `accommodationId:${accId}`) ?? []), ...localStore.documents.filter(d => d.module === "accommodation" && d.notes === `accommodationId:${accId}`)] as DisplayDocument[];
  }

  /* ── Handlers ── */
  function openNew() { form.reset({ name: "", type: "hotel", bookingPlatform: "", address: "", checkIn: "", checkOut: "", confirmationCode: "", contactPhone: "", notes: "" }); setEditing(null); setIsViewing(false); setOpen(true); }
  function openEdit(a: AccommodationExt) { form.reset({ name: a.name, type: (a.type || "hotel") as FormValues["type"], bookingPlatform: a.bookingPlatform ?? "", address: a.address, checkIn: toLocal(a.checkIn), checkOut: toLocal(a.checkOut), confirmationCode: a.confirmationCode, contactPhone: a.contactPhone ?? "", notes: a.notes ?? "" }); setEditing(a); setIsViewing(false); setOpen(true); }
  function openView(a: AccommodationExt) { form.reset({ name: a.name, type: (a.type || "hotel") as FormValues["type"], bookingPlatform: a.bookingPlatform ?? "", address: a.address, checkIn: toLocal(a.checkIn), checkOut: toLocal(a.checkOut), confirmationCode: a.confirmationCode, contactPhone: a.contactPhone ?? "", notes: a.notes ?? "" }); setEditing(a); setIsViewing(true); setOpen(true); }
  function handleDialogClose(v: boolean) { setOpen(v); if (!v) setIsViewing(false); }

  function onSubmit(values: FormValues) {
    const payload = { ...values, checkIn: new Date(values.checkIn).toISOString(), checkOut: new Date(values.checkOut).toISOString(), bookingPlatform: values.bookingPlatform || undefined, contactPhone: values.contactPhone || undefined, notes: values.notes || undefined };
    if (editing) updateAccommodation.mutate({ tripId, accommodationId: editing.id, data: payload as Parameters<typeof updateAccommodation.mutate>[0]["data"] });
    else createAccommodation.mutate({ tripId, data: payload as Parameters<typeof createAccommodation.mutate>[0]["data"] });
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
        await localStore.save({ tripId, module: "accommodation", name: docName.trim(), fileType: pendingDocFile.type === "application/pdf" ? "PDF" : "Imagen", notes: `accommodationId:${uploadingFor.id}`, blob: pendingDocFile });
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
        module: "accommodation",
        name: docName.trim(),
        fileType,
        fileUrl: docFileUrl || undefined,
        notes: `accommodationId:${uploadingFor.id}`,
      },
    });
  }

  function openUpload(a: AccommodationExt) {
    setUploadingFor(a);
    setDocName(""); setDocFileUrl("");
    setPendingDocFile(null); setUploadIsLocal(Boolean(localDocumentsEnabled) || documentUploadDestination() === "soloDispositivo");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /* ─── JSX ─── */
  return (
    <div>
      <ModuleHeader title="Alojamiento" description="Hoteles y alojamientos del viaje" onAdd={openNew} readOnly={readOnly} />

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>
      ) : accList.length > 0 ? (
        <div className="space-y-3">

          {/* ── Tab strip ── */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {accList.map(a => {
              const isActive = a.id === effectiveAccId;
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedAccId(a.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  Día {fmtDay(a.checkIn)} - Día {fmtDay(a.checkOut)}
                </button>
              );
            })}
          </div>

          {/* ── Selected accommodation card ── */}
          {selectedAcc && (() => {
            const a = selectedAcc;
            const docs = getAccDocs(a.id);
            return (
              <div className="booking-card border border-border rounded-xl bg-card p-4" data-testid={`card-accommodation-${a.id}`}>
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{a.name}</p>
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{TYPE_LABEL[a.type || "other"]}</span>
                      {a.bookingPlatform && (
                        <span className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 px-2 py-0.5 rounded-full">{a.bookingPlatform}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Hash className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">{a.confirmationCode}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openView(a)} title="Ver detalles"><Eye className="w-3.5 h-3.5" /></Button>
                    {!readOnly && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(a)}><Pencil className="w-3.5 h-3.5" /></Button>}
                    {!readOnly && <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleting(a)}><Trash2 className="w-3.5 h-3.5" /></Button>}
                  </div>
                </div>

                {/* Address */}
                <div className="flex items-center gap-1.5 mb-3">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-muted-foreground truncate flex-1">{a.address}</span>
                  <MapsLink query={a.address} label="Maps" />
                </div>

                {/* Check-in / check-out */}
                <div className="grid grid-cols-2 gap-3 pb-3 border-b border-border/60">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Entrada</p>
                    <p className="flex items-center gap-1 text-sm font-medium"><Clock className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />{fmt(a.checkIn)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Salida</p>
                    <p className="flex items-center gap-1 text-sm font-medium"><Clock className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />{fmt(a.checkOut)}</p>
                  </div>
                </div>

                {/* Phone (if present) */}
                {a.contactPhone && (
                  <div className="flex items-center gap-1.5 pt-2 pb-2 border-b border-border/40">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground">{a.contactPhone}</span>
                  </div>
                )}

                {/* Document chips */}
                <div className="pt-3">
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
                        onClick={() => openUpload(a)}
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
          })()}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No hay alojamientos añadidos</p>
        </div>
      )}

      {/* ── Accommodation form / view dialog ── */}
      <Dialog open={open} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isViewing ? "Detalles del Alojamiento" : editing ? "Editar Alojamiento" : "Añadir Alojamiento"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nombre</FormLabel><FormControl><Input placeholder="Park Hyatt Tokyo" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem><FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isViewing}>
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
              <FormField control={form.control} name="bookingPlatform" render={({ field }) => (<FormItem><FormLabel>Plataforma de Reserva (opcional)</FormLabel><FormControl><Input placeholder="Booking.com, Airbnb, Web del Hotel…" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Dirección</FormLabel>
                    {addressValue && <MapsLink query={addressValue} label="Ver en Google Maps" />}
                  </div>
                  <FormControl><Input placeholder="1-1 Example St, Tokio" disabled={isViewing} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="checkIn"  render={({ field }) => (<FormItem><FormLabel>Entrada</FormLabel><FormControl><Input type="datetime-local" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="checkOut" render={({ field }) => (<FormItem><FormLabel>Salida</FormLabel><FormControl><Input type="datetime-local" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="confirmationCode" render={({ field }) => (<FormItem><FormLabel>Código de confirmación</FormLabel><FormControl><Input placeholder="CONF-12345" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="contactPhone"     render={({ field }) => (<FormItem><FormLabel>Teléfono de contacto (opcional)</FormLabel><FormControl><Input placeholder="+81 3-1234-5678" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="notes"            render={({ field }) => (<FormItem><FormLabel>Notas (opcional)</FormLabel><FormControl><Textarea rows={2} disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>)} />

              {/* Read-only document chips */}
              {isViewing && editing && (() => {
                const viewDocs = getAccDocs(editing.id);
                return (
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Documentos adjuntos</p>
                    {viewDocs.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No hay documentos adjuntos a este alojamiento</p>
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
                  <Button type="submit" disabled={createAccommodation.isPending || updateAccommodation.isPending}>{editing ? "Guardar cambios" : "Añadir alojamiento"}</Button>
                </DialogFooter>
              )}
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Delete accommodation dialog ── */}
      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar alojamiento?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteAccommodation.mutate({ tripId, accommodationId: deleting.id })} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Upload doc dialog ── */}
      <Dialog open={!!uploadingFor} onOpenChange={(v) => { if (!v && !savingLocal) { setUploadingFor(null); setDocName(""); setDocFileUrl(""); setPendingDocFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Añadir documento</DialogTitle>
            {uploadingFor && <p className="text-xs text-muted-foreground mt-1">{uploadingFor.name}</p>}
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
              <Input className="mt-1.5" placeholder="Confirmación, bono, comprobante…" value={docName} onChange={(e) => setDocName(e.target.value)} />
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
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle><AlertDialogDescription>Se eliminará "{deletingDoc?.name}" de este alojamiento.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingDoc && (isLocalDocument(deletingDoc) ? localStore.remove(String(deletingDoc.id)).then(() => setDeletingDoc(null)) : deleteDoc.mutate({ tripId, documentId: Number(deletingDoc.id) }))} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
