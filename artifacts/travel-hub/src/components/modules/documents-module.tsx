import { useState, useRef, useEffect } from "react";
import {
  Trash2, FolderOpen, FileText, Paperclip, ExternalLink, Download,
  WifiOff, CheckCircle2, Loader2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDocuments, useCreateDocument, useDeleteDocument, getListDocumentsQueryKey,
} from "@workspace/api-client-react";
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

// Matches both new /api/uploads/ URLs and legacy /uploads/ URLs.
function isServerUrl(url: string | null | undefined): boolean {
  return !!url && (url.startsWith("/api/uploads/") || url.startsWith("/uploads/"));
}

// Cache name must match the Workbox runtimeCaching config in vite.config.ts.
const OFFLINE_CACHE = "travelhub-uploads-v2";

// Per-trip localStorage key that stores the set of file URLs already synced.
function syncedUrlsKey(tripId: number) {
  return `travelhub-synced-urls-${tripId}`;
}

function loadSyncedUrls(tripId: number): Set<string> {
  try {
    const raw = localStorage.getItem(syncedUrlsKey(tripId));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveSyncedUrls(tripId: number, urls: Set<string>) {
  try {
    localStorage.setItem(syncedUrlsKey(tripId), JSON.stringify([...urls]));
  } catch {
    // quota exceeded — ignore
  }
}

interface Props {
  tripId: number;
  /** Local cover-image URL for the trip (e.g. /api/uploads/covers/…).
   *  When present it is included in the offline sync pass so the hero image
   *  is available without internet. */
  coverImageUrl?: string | null;
  readOnly?: boolean;
}

export default function DocumentsModule({ tripId, coverImageUrl, readOnly }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Document | null>(null);
  const [filterModule, setFilterModule] = useState<string>("all");
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ done: 0, total: 0 });
  const autoSyncedRef = useRef(false);

  // Persisted set of file URLs that have been successfully cached offline.
  const [syncedUrls, setSyncedUrls] = useState<Set<string>>(() => loadSyncedUrls(tripId));

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: docs, isLoading } = useListDocuments(tripId, {
    query: { queryKey: getListDocumentsQueryKey(tripId) },
  });
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

  const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({
        title: "Formato no permitido",
        description: "Solo se aceptan archivos PDF, JPEG, PNG o WebP.",
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "Archivo demasiado grande",
        description: `El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB. El límite es 5 MB.`,
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFileName(file.name);
    form.setValue("name", file.name);
    if (file.type === "application/pdf") form.setValue("fileType", "PDF");
    else if (file.type.startsWith("image/")) form.setValue("fileType", "Imagen");
    else form.setValue("fileType", "Otro");

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Error al subir el archivo");
      }
      const { url } = await res.json() as { url: string };
      form.setValue("fileUrl", url);
    } catch (err) {
      toast({
        title: "Error al subir el archivo",
        description: err instanceof Error ? err.message : "Comprueba tu conexión e inténtalo de nuevo.",
        variant: "destructive",
      });
      setSelectedFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setUploading(false);
    }
  }

  async function handlePrepareOffline() {
    if (!docs) return;
    const serverDocs = docs.filter((d) => isServerUrl(d.fileUrl));

    // Also include the trip's cover image if it is a local server URL.
    const coverEntry = coverImageUrl && isServerUrl(coverImageUrl)
      ? [{ name: "Portada del viaje", fileUrl: coverImageUrl }]
      : [];
    const allAssets = [...serverDocs, ...coverEntry];

    if (allAssets.length === 0) {
      toast({
        title: "No hay documentos en el servidor",
        description: "Sube documentos primero para poder guardarlos offline.",
      });
      return;
    }
    if (!("caches" in window)) {
      toast({ title: "Tu navegador no soporta esta función", variant: "destructive" });
      return;
    }

    setSyncing(true);
    setSyncProgress({ done: 0, total: allAssets.length });

    const failed: string[] = [];
    const succeededUrls: string[] = [];

    try {
      const cache = await caches.open(OFFLINE_CACHE);

      for (const asset of allAssets) {
        try {
          // Integrity check: fetch the file and verify it returns 200 OK
          // before storing it in Cache Storage.
          const response = await fetch(asset.fileUrl!, { cache: "no-store" });
          if (!response.ok) {
            failed.push(asset.name);
          } else {
            await cache.put(asset.fileUrl!, response);
            succeededUrls.push(asset.fileUrl!);
          }
        } catch {
          failed.push(asset.name);
        }
        setSyncProgress((p) => ({ ...p, done: p.done + 1 }));
      }

      // Persist synced URLs so the button state survives page reloads.
      if (succeededUrls.length > 0) {
        const next = new Set([...syncedUrls, ...succeededUrls]);
        setSyncedUrls(next);
        saveSyncedUrls(tripId, next);
      }

      if (failed.length === 0) {
        toast({
          title: "Documentos sincronizados para uso offline",
          description: `${succeededUrls.length} archivo${succeededUrls.length !== 1 ? "s" : ""} guardado${succeededUrls.length !== 1 ? "s" : ""} en este dispositivo.`,
        });
      } else {
        toast({
          title: `${failed.length} archivo${failed.length !== 1 ? "s" : ""} no pudo${failed.length !== 1 ? "ron" : ""} descargarse`,
          description: failed.length < serverDocs.length
            ? `Descargados correctamente: ${succeededUrls.length}. Verifica tu conexión.`
            : "Verifica tu conexión a internet e inténtalo de nuevo.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error al preparar modo offline",
        description: "Comprueba tu conexión a internet.",
        variant: "destructive",
      });
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
    createDocument.mutate({
      tripId,
      data: { ...values, fileUrl: values.fileUrl || undefined, notes: values.notes || undefined },
    });
  }

  // Auto-sync: run once when documents are first loaded and there are pending server files
  useEffect(() => {
    if (!docs || syncing || autoSyncedRef.current) return;
    const serverDocs = docs.filter((d) => isServerUrl(d.fileUrl));
    const pending = serverDocs.filter((d) => !syncedUrls.has(d.fileUrl!));
    if (pending.length > 0) {
      autoSyncedRef.current = true;
      handlePrepareOffline();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs]);

  // Derived sync state
  const serverDocs = docs ? docs.filter((d) => isServerUrl(d.fileUrl)) : [];
  const pendingDocs = serverDocs.filter((d) => !syncedUrls.has(d.fileUrl!));
  const allSynced = serverDocs.length > 0 && pendingDocs.length === 0;

  const filteredDocs = docs
    ? filterModule === "all" ? docs : docs.filter((d) => d.module === filterModule)
    : [];

  const grouped = filteredDocs.reduce((acc, d) => {
    if (!acc[d.module]) acc[d.module] = [];
    acc[d.module].push(d);
    return acc;
  }, {} as Record<string, Document[]>);

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">Bóveda de Documentos</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Guarda tarjetas de embarque, seguros, visados y más</p>
        </div>
        {!readOnly && (
          <Button onClick={onOpenDialog} className="gap-2 flex-shrink-0" data-testid="button-add">
            <Paperclip className="w-4 h-4" />
            Subir
          </Button>
        )}
      </div>

      {/* ── Offline sync banner (automatic — no manual controls) ── */}
      {serverDocs.length > 0 && (
        <>
          {syncing ? (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
              <span className="text-sm text-muted-foreground flex-1">
                Sincronizando documentos para uso offline… ({syncProgress.done}/{syncProgress.total})
              </span>
            </div>
          ) : allSynced ? (
            <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>
                <span className="font-medium">{serverDocs.length}</span>{" "}
                documento{serverDocs.length !== 1 ? "s" : ""} disponible{serverDocs.length !== 1 ? "s" : ""} sin conexión
              </span>
            </div>
          ) : (
            <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              <WifiOff className="w-4 h-4 flex-shrink-0" />
              <span>
                <span className="font-medium text-foreground">{pendingDocs.length}</span>{" "}
                documento{pendingDocs.length !== 1 ? "s" : ""} pendiente{pendingDocs.length !== 1 ? "s" : ""} de sincronizar offline
              </span>
            </div>
          )}
        </>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap mb-4">
        <button
          onClick={() => setFilterModule("all")}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            filterModule === "all"
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:border-primary"
          }`}
        >
          Todos
        </button>
        {MODULES.map((m) => (
          <button
            key={m.value}
            onClick={() => setFilterModule(m.value)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              filterModule === m.value
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Document list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      ) : filteredDocs.length > 0 ? (
        <div className="space-y-5">
          {Object.entries(grouped).map(([mod, modDocs]) => (
            <div key={mod}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {MODULES.find((m) => m.value === mod)?.label || mod}
              </h3>
              <div className="space-y-2">
                {modDocs.map((doc) => {
                  const isDataUrl = !!doc.fileUrl && doc.fileUrl.startsWith("data:");
                  const isCached = isDataUrl || (!!doc.fileUrl && syncedUrls.has(doc.fileUrl));
                  return (
                    <div
                      key={doc.id}
                      className="border border-border rounded-lg bg-card p-3 flex items-center gap-3"
                      data-testid={`card-doc-${doc.id}`}
                    >
                      <div
                        className="doc-filetype-icon w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0"
                        data-filetype={doc.fileType}
                      >
                        <FileText className="doc-filetype-icon-svg w-4 h-4 text-muted-foreground" />
                        <span className="doc-filetype-icon-label hidden">{doc.fileType?.slice(0, 3).toUpperCase()}</span>
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
                          {isCached && (
                            <span className="flex items-center gap-0.5 text-xs text-emerald-600">
                              <CheckCircle2 className="w-3 h-3" />
                              Offline
                            </span>
                          )}
                          {isServerUrl(doc.fileUrl) && !isCached && (
                            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
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
                      {!readOnly && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive flex-shrink-0"
                          onClick={() => setDeleting(doc)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
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

      {/* Upload dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Subir Documento</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Archivo</label>
                <div
                  className={`flex items-center gap-3 border border-border rounded-md px-3 py-2 bg-background transition-colors ${
                    uploading ? "opacity-60" : "cursor-pointer hover:bg-muted/40"
                  }`}
                  onClick={() => !uploading && fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                  ) : (
                    <Paperclip className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className={`text-sm truncate flex-1 ${selectedFileName ? "text-foreground" : "text-muted-foreground"}`}>
                    {uploading
                      ? "Subiendo al servidor…"
                      : selectedFileName || "Seleccionar archivo (PDF o imagen)…"}
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
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
                <FormItem>
                  <FormLabel>Nombre del documento</FormLabel>
                  <FormControl><Input placeholder="Tarjeta de embarque JL408" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
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
                <FormItem>
                  <FormLabel>Notas (opcional)</FormLabel>
                  <FormControl><Textarea rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
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

      {/* Delete confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente "{deleting?.name}".
            </AlertDialogDescription>
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
