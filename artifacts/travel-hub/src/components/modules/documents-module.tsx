import { useState, useRef } from "react";
import { Trash2, FolderOpen, FileText, Paperclip, ExternalLink, Download, WifiOff, CheckCircle2, Loader2, CloudDownload } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useListDocuments, useCreateDocument, useDeleteDocument, getListDocumentsQueryKey } from "@workspace/api-client-react";
import type { Document } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const MODULES = [
  { value: "flights", label: "Vuelos" },
  { value: "parking", label: "Estacionamiento" },
  { value: "rental", label: "Alquiler" },
  { value: "accommodation", label: "Alojamiento" },
  { value: "itinerary", label: "Itinerario" },
  { value: "vault", label: "General" },
] as const;

const MODULE_COLORS: Record<string, string> = {
  flights: "bg-sky-100 text-sky-700",
  parking: "bg-amber-100 text-amber-700",
  rental: "bg-violet-100 text-violet-700",
  accommodation: "bg-blue-100 text-blue-700",
  itinerary: "bg-emerald-100 text-emerald-700",
  vault: "bg-slate-100 text-slate-600",
};

const schema = z.object({
  module: z.enum(["flights", "parking", "rental", "accommodation", "itinerary", "vault"]),
  name: z.string().min(1, "El nombre es obligatorio"),
  fileType: z.string().min(1, "El tipo de archivo es obligatorio"),
  fileUrl: z.string().optional(),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { month: "short", day: "numeric", year: "numeric" });
}

function isServerUrl(url: string | null | undefined): boolean {
  return !!url && url.startsWith("/uploads/");
}

const OFFLINE_CACHE = "travelhub-uploads-v1";

interface Props { tripId: number }

export default function DocumentsModule({ tripId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Document | null>(null);
  const [filterModule, setFilterModule] = useState<string>("all");
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ done: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: docs, isLoading } = useListDocuments(tripId, { query: { queryKey: getListDocumentsQueryKey(tripId) } });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey(tripId) });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { module: "vault", name: "", fileType: "PDF", fileUrl: "", notes: "" },
  });

  const createDocument = useCreateDocument({
    mutation: {
      onSuccess: () => {
        invalidate();
        setOpen(false);
        form.reset();
        setSelectedFileName("");
        toast({ title: "Documento añadido" });
      },
    },
  });
  const deleteDocument = useDeleteDocument({
    mutation: {
      onSuccess: () => {
        invalidate();
        setDeleting(null);
        toast({ title: "Documento eliminado" });
      },
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    form.setValue("name", file.name);
    if (file.type.includes("pdf")) form.setValue("fileType", "PDF");
    else if (file.type.includes("image")) form.setValue("fileType", "Imagen");
    else form.setValue("fileType", "Otro");

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json() as { url: string };
      form.setValue("fileUrl", url);
    } catch {
      toast({ title: "Error al subir el archivo", description: "Comprueba tu conexión e inténtalo de nuevo.", variant: "destructive" });
      setSelectedFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setUploading(false);
    }
  }

  async function handlePrepareOffline() {
    if (!docs) return;
    const serverDocs = docs.filter((d) => isServerUrl(d.fileUrl));

    if (serverDocs.length === 0) {
      toast({ title: "No hay documentos en el servidor", description: "Sube documentos primero para poder guardarlos offline." });
      return;
    }
    if (!("caches" in window)) {
      toast({ title: "Tu navegador no soporta esta función", variant: "destructive" });
      return;
    }

    setSyncing(true);
    setSyncProgress({ done: 0, total: serverDocs.length });

    try {
      const cache = await caches.open(OFFLINE_CACHE);
      for (const doc of serverDocs) {
        await cache.add(doc.fileUrl!);
        setSyncProgress((p) => ({ ...p, done: p.done + 1 }));
      }
      toast({
        title: "Viaje preparado para modo offline",
        description: `${serverDocs.length} documento${serverDocs.length !== 1 ? "s" : ""} guardado${serverDocs.length !== 1 ? "s" : ""} en el dispositivo.`,
      });
    } catch {
      toast({ title: "Error al descargar documentos", description: "Comprueba tu conexión a internet.", variant: "destructive" });
    } finally {
      setSyncing(false);
      setSyncProgress({ done: 0, total: 0 });
    }
  }

  function onOpenDialog() {
    form.reset({ module: "vault", name: "", fileType: "PDF", fileUrl: "", notes: "" });
    setSelectedFileName("");
    setOpen(true);
  }

  function onSubmit(values: FormValues) {
    createDocument.mutate({ tripId, data: { ...values, fileUrl: values.fileUrl || undefined, notes: values.notes || undefined } });
  }

  const filteredDocs = docs ? (filterModule === "all" ? docs : docs.filter((d) => d.module === filterModule)) : [];

  const grouped = filteredDocs.reduce((acc, d) => {
    if (!acc[d.module]) acc[d.module] = [];
    acc[d.module].push(d);
    return acc;
  }, {} as Record<string, Document[]>);

  const serverDocCount = docs ? docs.filter((d) => isServerUrl(d.fileUrl)).length : 0;

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">Bóveda de Documentos</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Guarda tarjetas de embarque, seguros, visados y más</p>
        </div>
        <Button onClick={onOpenDialog} className="gap-2 flex-shrink-0" data-testid="button-add">
          <Paperclip className="w-4 h-4" />
          Subir
        </Button>
      </div>

      {/* Offline sync banner */}
      {serverDocCount > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            {syncing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
                <span>Descargando {syncProgress.done} de {syncProgress.total} documentos…</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 flex-shrink-0" />
                <span><span className="font-medium text-foreground">{serverDocCount}</span> documento{serverDocCount !== 1 ? "s" : ""} disponible{serverDocCount !== 1 ? "s" : ""} para guardar offline</span>
              </>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 flex-shrink-0 text-xs h-8"
            onClick={handlePrepareOffline}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CloudDownload className="w-3.5 h-3.5" />
            )}
            Preparar modo offline
          </Button>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap mb-4">
        <button
          onClick={() => setFilterModule("all")}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${filterModule === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary"}`}
        >
          Todos
        </button>
        {MODULES.map((m) => (
          <button
            key={m.value}
            onClick={() => setFilterModule(m.value)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${filterModule === m.value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary"}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
      ) : filteredDocs.length > 0 ? (
        <div className="space-y-5">
          {Object.entries(grouped).map(([mod, modDocs]) => (
            <div key={mod}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {MODULES.find((m) => m.value === mod)?.label || mod}
              </h3>
              <div className="space-y-2">
                {modDocs.map((doc) => (
                  <div key={doc.id} className="border border-border rounded-lg bg-card p-3 flex items-center gap-3" data-testid={`card-doc-${doc.id}`}>
                    <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{doc.name}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">{doc.fileType}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{fmtDate(doc.uploadedAt)}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${MODULE_COLORS[doc.module]}`}>
                          {MODULES.find((m) => m.value === doc.module)?.label}
                        </span>
                        {isServerUrl(doc.fileUrl) && (
                          <span className="flex items-center gap-0.5 text-xs text-emerald-600">
                            <CheckCircle2 className="w-3 h-3" />
                            Servidor
                          </span>
                        )}
                      </div>
                    </div>
                    {doc.fileUrl && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir en nueva pestaña"
                          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={doc.fileUrl}
                          download={doc.name}
                          title="Descargar"
                          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive flex-shrink-0"
                      onClick={() => setDeleting(doc)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No hay documentos subidos</p>
          <p className="text-xs mt-1">Sube tarjetas de embarque, seguros, visados y más</p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Subir Documento</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Archivo</label>
                <div
                  className={`flex items-center gap-3 border border-border rounded-md px-3 py-2 bg-background transition-colors ${uploading ? "opacity-60" : "cursor-pointer hover:bg-muted/40"}`}
                  onClick={() => !uploading && fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                  ) : (
                    <Paperclip className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className={`text-sm truncate flex-1 ${selectedFileName ? "text-foreground" : "text-muted-foreground"}`}>
                    {uploading ? "Subiendo al servidor…" : selectedFileName || "Seleccionar archivo (PDF o imagen)…"}
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {selectedFileName && !uploading && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Archivo subido al servidor — disponible desde cualquier dispositivo
                  </p>
                )}
              </div>

              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Nombre del documento</FormLabel><FormControl><Input placeholder="Tarjeta de embarque JL408" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="module" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {MODULES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="fileType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de archivo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="PDF">PDF</SelectItem>
                        <SelectItem value="Imagen">Imagen</SelectItem>
                        <SelectItem value="Word">Word</SelectItem>
                        <SelectItem value="Otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notas (opcional)</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="submit" disabled={createDocument.isPending || uploading}>
                  {createDocument.isPending ? "Guardando..." : "Guardar Documento"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminará permanentemente "{deleting?.name}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && deleteDocument.mutate({ tripId, documentId: deleting.id })}
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
