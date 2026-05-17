import { useState, useRef } from "react";
import {
  Pencil, Trash2, Building2, MapPin, ExternalLink, Clock, Phone, Hash,
  Paperclip, X, Loader2, CheckCircle2, Eye,
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
function mapsUrl(address: string) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address).replace(/%20/g, "+")}`; }
function fileTypeFrom(url: string) {
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

interface Props { tripId: number; readOnly?: boolean }

export default function AccommodationsModule({ tripId, readOnly }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  /* Accommodation CRUD state */
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AccommodationExt | null>(null);
  const [deleting, setDeleting] = useState<AccommodationExt | null>(null);
  const [isViewing, setIsViewing] = useState(false);

  /* Doc upload state */
  const [uploadingFor, setUploadingFor] = useState<AccommodationExt | null>(null);
  const [docName, setDocName] = useState("");
  const [docFileUrl, setDocFileUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Doc delete state */
  const [deletingDoc, setDeletingDoc] = useState<Document | null>(null);

  /* ── Queries ── */
  const { data: accommodations, isLoading } = useListAccommodations(tripId, { query: { queryKey: getListAccommodationsQueryKey(tripId) } });
  const { data: allDocs } = useListDocuments(tripId, { query: { queryKey: getListDocumentsQueryKey(tripId) } });

  const invalidateAcc  = () => queryClient.invalidateQueries({ queryKey: getListAccommodationsQueryKey(tripId) });
  const invalidateDocs = () => queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey(tripId) });

  /* ── Mutations ── */
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "", type: "hotel", bookingPlatform: "", address: "", checkIn: "", checkOut: "", confirmationCode: "", contactPhone: "", notes: "" } });
  const addressValue = form.watch("address");

  const onErr = (label: string) => () => toast({ title: `Error al ${label}`, description: "Comprueba tu conexión e inténtalo de nuevo.", variant: "destructive" });

  const createAccommodation = useCreateAccommodation({ mutation: { onSuccess: () => { invalidateAcc(); setOpen(false); form.reset(); toast({ title: "Alojamiento añadido" }); }, onError: onErr("guardar el alojamiento") } });
  const updateAccommodation = useUpdateAccommodation({ mutation: { onSuccess: () => { invalidateAcc(); setOpen(false); setEditing(null); form.reset(); toast({ title: "Alojamiento actualizado" }); }, onError: onErr("actualizar el alojamiento") } });
  const deleteAccommodation = useDeleteAccommodation({ mutation: { onSuccess: () => { invalidateAcc(); setDeleting(null); toast({ title: "Alojamiento eliminado" }); }, onError: onErr("eliminar el alojamiento") } });

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
    return allDocs?.filter(d => d.module === "accommodation" && d.notes === `accommodationId:${accId}`) ?? [];
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
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /* ─── JSX ─── */
  return (
    <div>
      <ModuleHeader title="Alojamiento" description="Lista cronológica de hoteles y alojamientos" onAdd={openNew} readOnly={readOnly} />

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>
      ) : accommodations && accommodations.length > 0 ? (
        <div className="space-y-3">
          {(accommodations as AccommodationExt[]).map(a => {
            const docs = getAccDocs(a.id);
            return (
              <div key={a.id} className="booking-card border border-border rounded-xl bg-card p-4" data-testid={`card-accommodation-${a.id}`}>
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
                      <div key={doc.id} className="group flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-1 text-xs hover:border-primary/40 transition-colors">
                        <span className={`font-bold px-1 py-0.5 rounded-full text-[9px] uppercase tracking-wide flex-shrink-0 ${FILE_CHIP_COLORS[doc.fileType] ?? FILE_CHIP_COLORS["Otro"]}`}>
                          {doc.fileType?.slice(0, 3)}
                        </span>
                        <span className="font-medium max-w-[110px] truncate text-foreground/80">{doc.name}</span>
                        {doc.fileUrl && (
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0">
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                        {!readOnly && (
                          <button onClick={() => setDeletingDoc(doc)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    {!readOnly && (
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
          })}
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
                            <span className="font-medium max-w-[110px] truncate text-foreground/80">{doc.name}</span>
                            {doc.fileUrl && (
                              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0" title="Abrir documento">
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
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
      <Dialog open={!!uploadingFor} onOpenChange={(v) => { if (!v) { setUploadingFor(null); setDocName(""); setDocFileUrl(""); } }}>
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
            <Button onClick={handleSaveDoc} disabled={!docName.trim() || uploading || createDoc.isPending}>
              {createDoc.isPending ? "Guardando…" : "Guardar"}
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
            <AlertDialogAction onClick={() => deletingDoc && deleteDoc.mutate({ tripId, documentId: deletingDoc.id })} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
