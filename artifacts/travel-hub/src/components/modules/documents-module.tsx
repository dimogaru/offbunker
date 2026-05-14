import { useState } from "react";
import { Trash2, FolderOpen, FileText, Upload } from "lucide-react";
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
  { value: "flights", label: "Flights" },
  { value: "parking", label: "Parking" },
  { value: "rental", label: "Vehicle Rental" },
  { value: "accommodation", label: "Accommodation" },
  { value: "itinerary", label: "Itinerary" },
  { value: "vault", label: "General Vault" },
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
  name: z.string().min(1, "Name is required"),
  fileType: z.string().min(1, "File type is required"),
  fileUrl: z.string().optional(),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

interface Props { tripId: number }

export default function DocumentsModule({ tripId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Document | null>(null);
  const [filterModule, setFilterModule] = useState<string>("all");

  const { data: docs, isLoading } = useListDocuments(tripId, { query: { queryKey: getListDocumentsQueryKey(tripId) } });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey(tripId) });

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { module: "vault", name: "", fileType: "PDF", fileUrl: "", notes: "" } });

  const createDocument = useCreateDocument({ mutation: { onSuccess: () => { invalidate(); setOpen(false); form.reset(); toast({ title: "Document added" }); } } });
  const deleteDocument = useDeleteDocument({ mutation: { onSuccess: () => { invalidate(); setDeleting(null); toast({ title: "Document deleted" }); } } });

  function onSubmit(values: FormValues) {
    createDocument.mutate({ tripId, data: { ...values, fileUrl: values.fileUrl || undefined, notes: values.notes || undefined } });
  }

  const filteredDocs = docs ? (filterModule === "all" ? docs : docs.filter(d => d.module === filterModule)) : [];

  // Group by module
  const grouped = filteredDocs.reduce((acc, d) => {
    if (!acc[d.module]) acc[d.module] = [];
    acc[d.module].push(d);
    return acc;
  }, {} as Record<string, Document[]>);

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold">Document Vault</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Store boarding passes, insurance, visas and more</p>
        </div>
        <Button onClick={() => { form.reset(); setOpen(true); }} className="gap-2 flex-shrink-0" data-testid="button-add">
          <Upload className="w-4 h-4" />
          Upload Document
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap mb-4">
        <button
          onClick={() => setFilterModule("all")}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${filterModule === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary"}`}
        >
          All
        </button>
        {MODULES.map(m => (
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
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
      ) : filteredDocs.length > 0 ? (
        <div className="space-y-5">
          {Object.entries(grouped).map(([mod, modDocs]) => (
            <div key={mod}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {MODULES.find(m => m.value === mod)?.label || mod}
              </h3>
              <div className="space-y-2">
                {modDocs.map(doc => (
                  <div key={doc.id} className="border border-border rounded-lg bg-card p-3 flex items-center gap-3" data-testid={`card-doc-${doc.id}`}>
                    <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{doc.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{doc.fileType}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{fmtDate(doc.uploadedAt)}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${MODULE_COLORS[doc.module]}`}>
                          {MODULES.find(m => m.value === doc.module)?.label}
                        </span>
                      </div>
                    </div>
                    {doc.fileUrl && (
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline flex-shrink-0">View</a>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive flex-shrink-0" onClick={() => setDeleting(doc)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No documents uploaded yet</p>
          <p className="text-xs mt-1">Upload boarding passes, insurance docs, visas, and more</p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Document name</FormLabel><FormControl><Input placeholder="Boarding Pass JL408" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="module" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {MODULES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="fileType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>File type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="PDF">PDF</SelectItem>
                        <SelectItem value="Image">Image</SelectItem>
                        <SelectItem value="Word">Word</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="fileUrl" render={({ field }) => (<FormItem><FormLabel>File URL (optional)</FormLabel><FormControl><Input placeholder="https://..." {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes (optional)</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter>
                <Button type="submit" disabled={createDocument.isPending}>{createDocument.isPending ? "Uploading..." : "Upload Document"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete document?</AlertDialogTitle><AlertDialogDescription>This will permanently remove "{deleting?.name}".</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteDocument.mutate({ tripId, documentId: deleting.id })} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
