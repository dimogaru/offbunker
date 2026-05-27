import { useState, useRef } from "react";
import {
  Pencil, Trash2, Car, Train, Bus, MapPin, Ticket, Eye, ArrowRight,
  Paperclip, CheckCircle2, Loader2, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListRentals, useCreateRental, useUpdateRental, useDeleteRental, getListRentalsQueryKey,
  useListDocuments, useCreateDocument, useDeleteDocument, getListDocumentsQueryKey,
} from "@workspace/api-client-react";
import type { Rental, Document } from "@workspace/api-client-react";
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

// ── Transport type config ────────────────────────────────────────────────────

const TRANSPORT_TYPES = [
  "Alquiler de Vehículo",
  "Tren",
  "Autobús",
  "Traslado/Transfer",
  "Otro",
] as const;
type TransportType = typeof TRANSPORT_TYPES[number];

const TRANSPORT_ICONS: Record<TransportType, LucideIcon> = {
  "Alquiler de Vehículo": Car,
  "Tren":                 Train,
  "Autobús":              Bus,
  "Traslado/Transfer":    MapPin,
  "Otro":                 Ticket,
};

const TRANSPORT_COLORS: Record<TransportType, string> = {
  "Alquiler de Vehículo": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "Tren":                 "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "Autobús":              "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  "Traslado/Transfer":    "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  "Otro":                 "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400",
};

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

// ── Form schema ──────────────────────────────────────────────────────────────

const schema = z.object({
  transportType:      z.enum(["Alquiler de Vehículo", "Tren", "Autobús", "Traslado/Transfer", "Otro"]),
  company:            z.string().optional(),
  pickupLocation:     z.string().optional(),
  returnLocation:     z.string().optional(),
  pickupDate:         z.string().optional(),
  returnDate:         z.string().optional(),
  fuelPolicy:         z.string().optional(),
  vehicleType:        z.string().optional(),
  confirmationCode:   z.string().optional(),
  originStation:      z.string().optional(),
  destinationStation: z.string().optional(),
  departureDateTime:  z.string().optional(),
  arrivalDateTime:    z.string().optional(),
  transportNumber:    z.string().optional(),
  seatInfo:           z.string().optional(),
  meetingPoint:       z.string().optional(),
  notes:              z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const BLANK: FormValues = {
  transportType: "Alquiler de Vehículo",
  company: "", pickupLocation: "", returnLocation: "",
  pickupDate: "", returnDate: "", fuelPolicy: "", vehicleType: "",
  confirmationCode: "", originStation: "", destinationStation: "",
  departureDateTime: "", arrivalDateTime: "", transportNumber: "",
  seatInfo: "", meetingPoint: "", notes: "",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function toLocal(val: Date | string | null | undefined): string {
  if (!val) return "";
  const iso = val instanceof Date ? val.toISOString() : String(val);
  return iso.substring(0, 16);
}

function fmt(val: Date | string | null | undefined): string {
  if (!val) return "—";
  const d = val instanceof Date ? val : new Date(String(val));
  return d.toLocaleString("es-ES", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function rentalToForm(r: Rental): FormValues {
  return {
    transportType:      (r.transportType ?? "Alquiler de Vehículo") as TransportType,
    company:            r.company            ?? "",
    pickupLocation:     r.pickupLocation     ?? "",
    returnLocation:     r.returnLocation     ?? "",
    pickupDate:         toLocal(r.pickupDate),
    returnDate:         toLocal(r.returnDate),
    fuelPolicy:         r.fuelPolicy         ?? "",
    vehicleType:        r.vehicleType        ?? "",
    confirmationCode:   r.confirmationCode   ?? "",
    originStation:      r.originStation      ?? "",
    destinationStation: r.destinationStation ?? "",
    departureDateTime:  toLocal(r.departureDateTime),
    arrivalDateTime:    toLocal(r.arrivalDateTime),
    transportNumber:    r.transportNumber    ?? "",
    seatInfo:           r.seatInfo           ?? "",
    meetingPoint:       r.meetingPoint       ?? "",
    notes:              r.notes              ?? "",
  };
}

// ── Transport card ────────────────────────────────────────────────────────────

interface CardProps {
  r: Rental;
  readOnly?: boolean;
  docs: Document[];
  onView: (r: Rental) => void;
  onEdit: (r: Rental) => void;
  onDelete: (r: Rental) => void;
  onUpload: (r: Rental) => void;
  onDeleteDoc: (doc: Document) => void;
}

function TransportCard({ r, readOnly, docs, onView, onEdit, onDelete, onUpload, onDeleteDoc }: CardProps) {
  const type = (r.transportType ?? "Alquiler de Vehículo") as TransportType;
  const Icon = TRANSPORT_ICONS[type] ?? Car;
  const isVehicle  = type === "Alquiler de Vehículo";
  const isTrainBus = type === "Tren" || type === "Autobús";

  return (
    <div className="border border-border rounded-xl bg-card p-4" data-testid={`card-rental-${r.id}`}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${TRANSPORT_COLORS[type]}`}>
              {type}
            </span>
            {r.confirmationCode && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">
                {r.confirmationCode}
              </span>
            )}
          </div>

          {/* Vehicle rental */}
          {isVehicle && (
            <>
              <div className="flex items-center gap-1.5 flex-wrap">
                {r.company     && <p className="font-semibold text-sm">{r.company}</p>}
                {r.vehicleType && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{r.vehicleType}</span>}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <div>
                  <span className="text-xs text-muted-foreground">Recogida</span>
                  <p className="text-sm leading-snug">{r.pickupLocation ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{fmt(r.pickupDate)}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Devolución</span>
                  <p className="text-sm leading-snug">{r.returnLocation ?? r.pickupLocation ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{fmt(r.returnDate)}</p>
                </div>
              </div>
              {r.fuelPolicy && <p className="text-xs text-muted-foreground mt-1">Combustible: {r.fuelPolicy}</p>}
            </>
          )}

          {/* Train / Bus */}
          {isTrainBus && (
            <>
              <div className="flex items-center gap-1.5 flex-wrap">
                {r.transportNumber && <span className="font-semibold text-sm font-mono">{r.transportNumber}</span>}
                {r.seatInfo && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Asiento {r.seatInfo}</span>}
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="font-medium text-sm">{r.originStation ?? "—"}</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="font-medium text-sm">{r.destinationStation ?? "—"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1 text-xs text-muted-foreground">
                <span>Salida: {fmt(r.departureDateTime)}</span>
                {r.arrivalDateTime && <span>Llegada: {fmt(r.arrivalDateTime)}</span>}
              </div>
            </>
          )}

          {/* Transfer / Other */}
          {!isVehicle && !isTrainBus && (
            <>
              {r.company && <p className="font-semibold text-sm">{r.company}</p>}
              {(r.meetingPoint || r.destinationStation) && (
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {r.meetingPoint       && <span className="text-sm">{r.meetingPoint}</span>}
                  {r.meetingPoint && r.destinationStation && (
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  )}
                  {r.destinationStation && <span className="text-sm">{r.destinationStation}</span>}
                </div>
              )}
              {r.departureDateTime && <p className="text-xs text-muted-foreground mt-1">{fmt(r.departureDateTime)}</p>}
            </>
          )}

          {r.notes && <p className="text-xs text-muted-foreground mt-1.5 italic line-clamp-2">{r.notes}</p>}

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
                        <button onClick={() => onDeleteDoc(doc)} title="Eliminar" className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 p-0.5">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {!readOnly && (
                <button onClick={() => onUpload(r)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                  <Paperclip className="w-3.5 h-3.5" />
                  {docs.length > 0 ? "Añadir otro documento" : "Añadir documento"}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-1 flex-shrink-0">
          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => onView(r)} title="Ver detalles">
            <Eye className="w-3.5 h-3.5" />
          </Button>
          {!readOnly && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(r)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          {!readOnly && (
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(r)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main module ───────────────────────────────────────────────────────────────

interface Props { tripId: number; readOnly?: boolean }

export default function TransportsModule({ tripId, readOnly }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  /* Rental CRUD state */
  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState<Rental | null>(null);
  const [deleting, setDeleting] = useState<Rental | null>(null);
  const [isViewing, setIsViewing] = useState(false);

  /* Doc upload state */
  const [uploadingFor, setUploadingFor] = useState<Rental | null>(null);
  const [docName, setDocName]           = useState("");
  const [docFileUrl, setDocFileUrl]     = useState("");
  const [uploading, setUploading]       = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Doc delete state */
  const [deletingDoc, setDeletingDoc] = useState<Document | null>(null);

  /* ── Queries ── */
  const { data: rentals, isLoading } = useListRentals(tripId, { query: { queryKey: getListRentalsQueryKey(tripId) } });
  const { data: allDocs } = useListDocuments(tripId, { query: { queryKey: getListDocumentsQueryKey(tripId) } });

  const invalidate     = () => queryClient.invalidateQueries({ queryKey: getListRentalsQueryKey(tripId) });
  const invalidateDocs = () => queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey(tripId) });

  /* ── Mutations ── */
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: BLANK });
  const transportType   = form.watch("transportType") as TransportType;
  const isVehicle       = transportType === "Alquiler de Vehículo";
  const isTrainBus      = transportType === "Tren" || transportType === "Autobús";
  const isTransferOther = transportType === "Traslado/Transfer" || transportType === "Otro";

  const createRental = useCreateRental({ mutation: { onSuccess: () => { invalidate(); setOpen(false); form.reset(BLANK); toast({ title: "Transporte añadido" }); } } });
  const updateRental = useUpdateRental({ mutation: { onSuccess: () => { invalidate(); setOpen(false); setEditing(null); form.reset(BLANK); toast({ title: "Transporte actualizado" }); } } });
  const deleteRental = useDeleteRental({ mutation: { onSuccess: () => { invalidate(); setDeleting(null); toast({ title: "Transporte eliminado" }); } } });

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
  function getRentalDocs(rentalId: number): Document[] {
    return allDocs?.filter(d => d.module === "rental" && d.notes === `rentalId:${rentalId}`) ?? [];
  }

  /* ── Handlers ── */
  function openNew()           { form.reset(BLANK);            setEditing(null); setIsViewing(false); setOpen(true); }
  function openEdit(r: Rental) { form.reset(rentalToForm(r));  setEditing(r);    setIsViewing(false); setOpen(true); }
  function openView(r: Rental) { form.reset(rentalToForm(r));  setEditing(r);    setIsViewing(true);  setOpen(true); }
  function handleDialogClose(v: boolean) { setOpen(v); if (!v) setIsViewing(false); }

  function openUpload(r: Rental) {
    setUploadingFor(r);
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
        module: "rental",
        name: docName.trim(),
        fileType,
        fileUrl: docFileUrl || undefined,
        notes: `rentalId:${uploadingFor.id}`,
      },
    });
  }

  function onSubmit(values: FormValues) {
    const toIso = (v: string | undefined) => (v ? new Date(v).toISOString() : undefined);
    const payload = {
      transportType:      values.transportType,
      company:            values.company            || undefined,
      pickupLocation:     values.pickupLocation     || undefined,
      returnLocation:     values.returnLocation     || undefined,
      pickupDate:         toIso(values.pickupDate),
      returnDate:         toIso(values.returnDate),
      fuelPolicy:         values.fuelPolicy         || undefined,
      vehicleType:        values.vehicleType        || undefined,
      confirmationCode:   values.confirmationCode   || undefined,
      originStation:      values.originStation      || undefined,
      destinationStation: values.destinationStation || undefined,
      departureDateTime:  toIso(values.departureDateTime),
      arrivalDateTime:    toIso(values.arrivalDateTime),
      transportNumber:    values.transportNumber    || undefined,
      seatInfo:           values.seatInfo           || undefined,
      meetingPoint:       values.meetingPoint       || undefined,
      notes:              values.notes              || undefined,
    };
    if (editing) updateRental.mutate({ tripId, rentalId: editing.id, data: payload });
    else         createRental.mutate({ tripId, data: payload });
  }

  const dialogTitle = isViewing
    ? "Detalles del Transporte"
    : editing
    ? "Editar Transporte"
    : "Añadir Transporte";

  return (
    <div>
      <ModuleHeader
        title="Transportes"
        description="Alquileres, trenes, autobuses y traslados"
        onAdd={openNew}
        readOnly={readOnly}
      />

      {isLoading ? (
        <Skeleton className="h-28 w-full rounded-xl" />
      ) : rentals && rentals.length > 0 ? (
        <div className="space-y-3">
          {rentals.map(r => (
            <TransportCard
              key={r.id}
              r={r}
              readOnly={readOnly}
              docs={getRentalDocs(r.id)}
              onView={openView}
              onEdit={openEdit}
              onDelete={setDeleting}
              onUpload={openUpload}
              onDeleteDoc={setDeletingDoc}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          <Car className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No hay transportes registrados</p>
          <p className="text-xs mt-1 opacity-60">Añade alquileres, trenes, autobuses o traslados</p>
        </div>
      )}

      {/* ── Transport form / view dialog ─────────────────────────────── */}
      <Dialog open={open} onOpenChange={handleDialogClose}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">

              {/* Transport type */}
              <FormField control={form.control} name="transportType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de transporte</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isViewing}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TRANSPORT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* ── Vehicle rental fields ─────────────────────────── */}
              {isVehicle && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="company" render={({ field }) => (
                      <FormItem><FormLabel>Empresa</FormLabel><FormControl><Input placeholder="Hertz, Avis…" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="vehicleType" render={({ field }) => (
                      <FormItem><FormLabel>Vehículo</FormLabel><FormControl><Input placeholder="Toyota Corolla" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="pickupLocation" render={({ field }) => (
                    <FormItem><FormLabel>Lugar de recogida</FormLabel><FormControl><Input placeholder="Terminal 2, Aeropuerto" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="returnLocation" render={({ field }) => (
                    <FormItem><FormLabel>Lugar de devolución</FormLabel><FormControl><Input placeholder="Mismo o diferente lugar" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="pickupDate" render={({ field }) => (
                      <FormItem><FormLabel>Fecha de recogida</FormLabel><FormControl><Input type="datetime-local" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="returnDate" render={({ field }) => (
                      <FormItem><FormLabel>Fecha de devolución</FormLabel><FormControl><Input type="datetime-local" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="fuelPolicy" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Política de combustible</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""} disabled={isViewing}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="Full-to-full">Lleno a lleno</SelectItem>
                          <SelectItem value="Full-to-empty">Lleno a vacío</SelectItem>
                          <SelectItem value="Pre-purchased">Prepagado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </>
              )}

              {/* ── Train / Bus fields ───────────────────────────────── */}
              {isTrainBus && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="transportNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{transportType === "Tren" ? "Número de tren" : "Número de autobús"}</FormLabel>
                        <FormControl><Input placeholder="AVE 4082" disabled={isViewing} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="seatInfo" render={({ field }) => (
                      <FormItem><FormLabel>Asiento / Vagón</FormLabel><FormControl><Input placeholder="4B / Vagón 12" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="originStation" render={({ field }) => (
                      <FormItem><FormLabel>Estación de origen</FormLabel><FormControl><Input placeholder="Madrid Atocha" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="destinationStation" render={({ field }) => (
                      <FormItem><FormLabel>Estación de destino</FormLabel><FormControl><Input placeholder="Barcelona Sants" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="departureDateTime" render={({ field }) => (
                      <FormItem><FormLabel>Salida</FormLabel><FormControl><Input type="datetime-local" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="arrivalDateTime" render={({ field }) => (
                      <FormItem><FormLabel>Llegada</FormLabel><FormControl><Input type="datetime-local" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                </>
              )}

              {/* ── Transfer / Other fields ──────────────────────────── */}
              {isTransferOther && (
                <>
                  <FormField control={form.control} name="company" render={({ field }) => (
                    <FormItem><FormLabel>Empresa / Servicio</FormLabel><FormControl><Input placeholder="Taxi, Uber, shuttle…" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="meetingPoint" render={({ field }) => (
                    <FormItem><FormLabel>Punto de encuentro</FormLabel><FormControl><Input placeholder="Salida Llegadas, Terminal 1" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="destinationStation" render={({ field }) => (
                    <FormItem><FormLabel>Destino</FormLabel><FormControl><Input placeholder="Hotel, ciudad…" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="departureDateTime" render={({ field }) => (
                    <FormItem><FormLabel>Fecha y hora</FormLabel><FormControl><Input type="datetime-local" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </>
              )}

              {/* ── Shared fields ────────────────────────────────────── */}
              <FormField control={form.control} name="confirmationCode" render={({ field }) => (
                <FormItem><FormLabel>Código de confirmación</FormLabel><FormControl><Input placeholder="REF-2026-12345" disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notas</FormLabel><FormControl><Textarea rows={2} disabled={isViewing} {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              {!isViewing && (
                <DialogFooter>
                  <Button type="submit" disabled={createRental.isPending || updateRental.isPending}>
                    {editing ? "Guardar cambios" : "Añadir transporte"}
                  </Button>
                </DialogFooter>
              )}
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Upload document dialog ─────────────────────────────────── */}
      <Dialog open={!!uploadingFor} onOpenChange={(v) => { if (!v) { setUploadingFor(null); setDocName(""); setDocFileUrl(""); } }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm">
          <DialogHeader>
            <DialogTitle>Subir documento — Transporte</DialogTitle>
            {uploadingFor && (
              <p className="text-xs text-muted-foreground mt-1">
                {(uploadingFor.transportType ?? "Transporte")}
                {(uploadingFor.company || uploadingFor.transportNumber) ? ` · ${uploadingFor.company || uploadingFor.transportNumber}` : ""}
              </p>
            )}
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
              <Input className="mt-1.5" placeholder="Billete, confirmación, contrato…" value={docName} onChange={(e) => setDocName(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Aparecerá también en la Bóveda de Documentos bajo la categoría <span className="font-medium text-foreground">Transporte</span>.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveDoc} disabled={!docName.trim() || uploading || createDoc.isPending}>
              {createDoc.isPending ? "Guardando…" : "Guardar documento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete transport confirmation ─────────────────────────── */}
      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar transporte?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && deleteRental.mutate({ tripId, rentalId: deleting.id })}
              className="bg-destructive hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete document confirmation ──────────────────────────── */}
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
