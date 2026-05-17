import { useState, useRef } from "react";
import {
  Paperclip, FileText, ExternalLink, Trash2,
  Loader2, CheckCircle2, X,
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
  readOnly?: boolean;
}

const FILE_CHIP_COLORS: Record<string, string> = {
  PDF:    "bg-red-500/15 text-red-400",
  Imagen: "bg-emerald-500/15 text-emerald-400",
  Word:   "bg-blue-500/15 text-blue-400",
  Otro:   "bg-slate-500/15 text-slate-400",
};

export default function ModuleDocsWidget({ tripId, module, moduleLabel, readOnly }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Document | null>(null);
  const [docName, setDocName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      toast({ title: "Error al subir el archivo", description: "Comprueba tu conexión.", variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit() {
    if (!docName.trim() || createDoc.isPending) return;
    const ext = fileUrl.split(".").pop()?.toLowerCase() ?? "";
    const fileType = ext === "pdf" ? "PDF" : ["png", "jpg", "jpeg", "webp", "gif"].includes(ext) ? "Imagen" : "Otro";
    createDoc.mutate({ tripId, data: { module, name: docName.trim(), fileType, fileUrl: fileUrl || undefined } });
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
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Paperclip className="w-3.5 h-3.5" />
          Documentos
          {moduleDocs.length > 0 && (
            <span className="ml-0.5 bg-primary/10 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-bold">
              {moduleDocs.length}
            </span>
          )}
        </div>
        {!readOnly && (
          <button
            onClick={openDialog}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/70 transition-colors"
          >
            <span className="text-base leading-none">+</span>
            Subir
          </button>
        )}
      </div>

      {/* File Chips */}
      {moduleDocs.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {moduleDocs.map((doc) => (
            <div
              key={doc.id}
              className="group flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1.5 text-xs hover:border-primary/40 transition-colors"
            >
              {/* File type badge */}
              <span className={`font-bold px-1.5 py-0.5 rounded-full text-[9px] uppercase tracking-wide flex-shrink-0 ${FILE_CHIP_COLORS[doc.fileType] ?? FILE_CHIP_COLORS["Otro"]}`}>
                {doc.fileType?.slice(0, 3)}
              </span>

              {/* Filename */}
              <span className="font-medium max-w-[130px] truncate text-foreground/80">
                {doc.name}
              </span>

              {/* Open link */}
              {doc.fileUrl && (
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir documento"
                  className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}

              {/* Delete */}
              {!readOnly && (
                <button
                  onClick={() => setDeleting(doc)}
                  title="Eliminar"
                  className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
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
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`flex items-center gap-3 border border-border rounded-md px-3 py-2.5 bg-background transition-colors ${uploading ? "opacity-60" : "cursor-pointer hover:bg-muted/40"}`}
            >
              {uploading
                ? <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                : <Paperclip className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
              <span className={`text-sm truncate flex-1 ${fileUrl || uploading ? "text-foreground" : "text-muted-foreground"}`}>
                {uploading ? "Subiendo al servidor…" : fileUrl ? docName : "Seleccionar archivo (PDF, imagen…)"}
              </span>
              {fileUrl && !uploading && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx" className="hidden" onChange={handleFile} />
            <div>
              <label className="text-sm font-medium">Nombre del documento</label>
              <Input className="mt-1.5" placeholder="Tarjeta de embarque, seguro…" value={docName} onChange={(e) => setDocName(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Se guardará en la categoría <span className="font-medium text-foreground">{moduleLabel}</span> y aparecerá también en la Bóveda de Documentos.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={handleSubmit} disabled={!docName.trim() || uploading || createDoc.isPending}>
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
              onClick={() => deleting && deleteDoc.mutate({ tripId, documentId: deleting.id })}
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
