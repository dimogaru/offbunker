import { useState, useRef } from "react";
import {
  Paperclip, FileText, ExternalLink, Trash2,
  Loader2, CheckCircle2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDocuments, useCreateDocument, useDeleteDocument,
  getListDocumentsQueryKey,
} from "@workspace/api-client-react";
import type { Document } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

type ModuleKey = "flights" | "parking" | "rental" | "accommodation" | "itinerary";

interface Props {
  tripId: number;
  module: ModuleKey;
  moduleLabel: string;
}

export default function ModuleDocsWidget({ tripId, module, moduleLabel }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Document | null>(null);
  const [docName, setDocName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Shares the same cache key as the vault — no extra network calls.
  const { data: allDocs } = useListDocuments(tripId, {
    query: { queryKey: getListDocumentsQueryKey(tripId) },
  });
  const moduleDocs = allDocs?.filter((d) => d.module === module) ?? [];

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey(tripId) });

  const createDoc = useCreateDocument({
    mutation: {
      onSuccess: () => {
        invalidate();
        setOpen(false);
        setDocName("");
        setFileUrl("");
        toast({ title: "Documento añadido" });
      },
    },
  });

  const deleteDoc = useDeleteDocument({
    mutation: {
      onSuccess: () => {
        invalidate();
        setDeleting(null);
        toast({ title: "Documento eliminado" });
      },
    },
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocName(file.name);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = (await res.json()) as { url: string };
      setFileUrl(url);
    } catch {
      toast({
        title: "Error al subir el archivo",
        description: "Comprueba tu conexión.",
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit() {
    if (!docName.trim() || createDoc.isPending) return;
    const ext = fileUrl.split(".").pop()?.toLowerCase() ?? "";
    const fileType = ext === "pdf" ? "PDF" : ["png", "jpg", "jpeg", "webp", "gif"].includes(ext) ? "Imagen" : "Otro";
    createDoc.mutate({
      tripId,
      data: {
        module,
        name: docName.trim(),
        fileType,
        fileUrl: fileUrl || undefined,
      },
    });
  }

  function openDialog() {
    setDocName("");
    setFileUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setOpen(true);
  }

  return (
    <div className="mt-5 pt-4 border-t border-border">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Paperclip className="w-3.5 h-3.5" />
          Documentos
          {moduleDocs.length > 0 && (
            <span className="ml-0.5 bg-primary/10 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-bold">
              {moduleDocs.length}
            </span>
          )}
        </div>
        <button
          onClick={openDialog}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/70 transition-colors"
        >
          <span className="text-base leading-none">+</span>
          Subir
        </button>
      </div>

      {/* Document list */}
      {moduleDocs.length > 0 ? (
        <ul className="space-y-1">
          {moduleDocs.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/50 hover:bg-muted transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-sm flex-1 min-w-0 truncate">{doc.name}</span>
              {doc.fileUrl ? (
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir documento"
                  className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <span className="w-6 flex-shrink-0" />
              )}
              <button
                onClick={() => setDeleting(doc)}
                title="Eliminar"
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          Sin documentos adjuntos — pulsa <span className="font-medium">Subir</span> para añadir uno
        </p>
      )}

      {/* Upload dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Subir documento — {moduleLabel}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {/* File picker */}
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`flex items-center gap-3 border border-border rounded-md px-3 py-2.5 bg-background transition-colors ${
                uploading ? "opacity-60" : "cursor-pointer hover:bg-muted/40"
              }`}
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
              ) : (
                <Paperclip className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
              <span className={`text-sm truncate flex-1 ${fileUrl || uploading ? "text-foreground" : "text-muted-foreground"}`}>
                {uploading ? "Subiendo al servidor…" : fileUrl ? docName : "Seleccionar archivo (PDF, imagen…)"}
              </span>
              {fileUrl && !uploading && (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx"
              className="hidden"
              onChange={handleFile}
            />

            {/* Name field — auto-filled from filename but editable */}
            <div>
              <label className="text-sm font-medium">Nombre del documento</label>
              <Input
                className="mt-1.5"
                placeholder="Tarjeta de embarque, seguro…"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Se guardará en la categoría <span className="font-medium text-foreground">{moduleLabel}</span> y aparecerá también en la Bóveda de Documentos.
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSubmit}
              disabled={!docName.trim() || uploading || createDoc.isPending}
            >
              {createDoc.isPending ? "Guardando…" : "Guardar documento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente "{deleting?.name}" de esta sección y de la Bóveda de Documentos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleting && deleteDoc.mutate({ tripId, documentId: deleting.id })
              }
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
