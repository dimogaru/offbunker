import { useState, useRef, useEffect } from "react";
import {
  Trash2, FolderOpen, FileText, Paperclip, ExternalLink, Download,
  WifiOff, CheckCircle2, Loader2,
  Lock,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDocuments, useCreateDocument, useDeleteDocument, getListDocumentsQueryKey,
} from "@workspace/api-client-react";
import type { Document } from "@workspace/api-client-react";
import { documentUploadDestination, useLocalDocuments, LOCAL_DOCUMENT_MESSAGE, isLocalDocument } from "@/lib/local-documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

// ── iOS / Blob helpers ────────────────────────────────────────────────────────
function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Opens a document for viewing.
 * iOS Safari: data: URLs and blob: popups are unreliable, so we force a
 * download instead (Files app will open it natively).
 * All other platforms: convert to blob: URL and open in a new tab so the
 * browser's built-in PDF viewer handles it without data: URL restrictions.
 */
function openDocUrl(url: string, fileName: string): void {
  if (url.startsWith("data:")) {
    const blob = dataUrlToBlob(url);
    const blobUrl = URL.createObjectURL(blob);
    if (isIOS()) {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      window.open(blobUrl, "_blank", "noopener,noreferrer");
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/**
 * Triggers a file download on all platforms.
 * Always converts data: URLs to blob: URLs so the download attribute is
 * honoured (Safari ignores download on data: hrefs).
 */
function downloadDocUrl(url: string, fileName: string): void {
  const triggerDownload = (href: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  if (url.startsWith("data:")) {
    const blob = dataUrlToBlob(url);
    const blobUrl = URL.createObjectURL(blob);
    triggerDownload(blobUrl);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } else {
    triggerDownload(url);
  }
}

const MODULES = [
  { value: "flights", label: "Vuelos" },
  { value: "parking", label: "Estacionamiento" },
  { value: "rental", label: "Transporte" },
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
  localDocumentsEnabled?: boolean;
}

export default function DocumentsModule({ tripId, coverImageUrl, readOnly, localDocumentsEnabled }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Document | null>(null);
  const [filterModule, setFilterModule] = useState<string>("all");
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadIsLocal, setUploadIsLocal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingLocal, setSavingLocal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ done: 0, total: 0 });
  const autoSyncedRef = useRef(false);

  // Persisted set of file URLs that have been successfully cached offline.
  const [syncedUrls, setSyncedUrls] = useState<Set<string>>(() => loadSyncedUrls(tripId));

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: docs, isLoading } = useListDocuments(tripId, {
    query: { queryKey: getListDocumentsQueryKey(tripId) },
  });
  const localStore = useLocalDocuments(tripId);
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

    setPendingFile(file);
    if (uploadIsLocal) {
      return;
    }
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
    setPendingFile(null);
    setUploadIsLocal(Boolean(localDocumentsEnabled) || documentUploadDestination() === "soloDispositivo");
    setOpen(true);
  }

  async function onSubmit(values: FormValues) {
    if (savingLocal) return;
    if (uploadIsLocal) {
      if (!pendingFile) { toast({ title: "Selecciona un archivo", variant: "destructive" }); return; }
      setSavingLocal(true);
      try {
        await localStore.save({
          tripId, module: values.module, name: values.name.trim(), fileType: values.fileType,
          notes: values.notes || undefined, blob: pendingFile,
        });
        setOpen(false);
        form.reset();
        setSelectedFileName("");
        setPendingFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        toast({ title: "Documento guardado", description: LOCAL_DOCUMENT_MESSAGE });
      } catch (error) {
        form.reset();
        setSelectedFileName("");
        setPendingFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        toast({ title: "No se pudo guardar el documento", description: error instanceof Error ? error.message : "Error en IndexedDB.", variant: "destructive" });
      } finally {
        setSavingLocal(false);
      }
      return;
    }
    if (!values.fileUrl) { toast({ title: "Selecciona un archivo", variant: "destructive" }); return; }
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

  const allDocuments = [...(docs ?? []), ...localStore.documents as unknown as Document[]];
  const filteredDocs = filterModule === "all"
    ? allDocuments
    : allDocuments.filter((document) => document.module === filterModule);

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
        {(!readOnly || localDocumentsEnabled) && (
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
                          {String(doc.id).startsWith("local-") && (
                            <span className="flex items-center gap-0.5 text-xs text-muted-foreground" title={LOCAL_DOCUMENT_MESSAGE}>
                              <Lock className="w-3 h-3" aria-hidden="true" />
                              <span className="sr-only">{LOCAL_DOCUMENT_MESSAGE}</span>
                              Solo dispositivo
                            </span>
                          )}
                          {isCached && !String(doc.id).startsWith("local-") && (
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
                      {(doc.fileUrl || String(doc.id).startsWith("local-")) && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            title={isIOS() ? "Descargar / Abrir" : "Abrir en nueva pestaña"}
                            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                             onClick={() => String(doc.id).startsWith("local-") ? localStore.open(String(doc.id)) : openDocUrl(doc.fileUrl!, doc.name)}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Descargar"
                            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                             onClick={() => String(doc.id).startsWith("local-") ? localStore.download(String(doc.id)) : downloadDocUrl(doc.fileUrl!, doc.name)}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      {(!readOnly || (localDocumentsEnabled && isLocalDocument(doc))) && (
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
      <Dialog open={open} onOpenChange={(value) => { if (!value && savingLocal) return; setOpen(value); if (!value) { form.reset(); setSelectedFileName(""); setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; } }}>
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
                    {uploadIsLocal ? LOCAL_DOCUMENT_MESSAGE : "Archivo subido al servidor — disponible desde cualquier dispositivo"}
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
                <Button type="submit" disabled={createDocument.isPending || uploading || savingLocal}>
                  {createDocument.isPending || savingLocal ? "Guardando..." : "Guardar Documento"}
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
              onClick={() => {
                if (!deleting) return;
                if (String(deleting.id).startsWith("local-")) {
                  localStore.remove(String(deleting.id)).then(() => { setDeleting(null); toast({ title: "Documento eliminado localmente" }); });
                } else deleteDocument.mutate({ tripId, documentId: deleting.id });
              }}
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
