import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";

/** A local document deliberately has a different shape from the API Document. */
export interface LocalDocument {
  id: string;
  ownerId: string;
  tripId: number;
  module: string;
  name: string;
  fileType: string;
  notes?: string;
  fileUrl?: undefined;
  uploadedAt: string;
  esLocal: true;
  soloDispositivo: true;
  blob: Blob;
}

export type DocumentRecord = LocalDocument;
export function isLocalDocument(document: { id: number | string; esLocal?: boolean }): document is LocalDocument {
  return document.esLocal === true || String(document.id).startsWith("local-");
}

const DB_NAME = "travelhub-local-documents";
const DB_VERSION = 2;
const STORE = "documents";
const CHANGE_EVENT = "travelhub-local-documents-changed";

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB no está disponible en este navegador."));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir IndexedDB."));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("tripId", "tripId", { unique: false });
      }
      const store = request.transaction?.objectStore(STORE);
      if (store && !store.indexNames.contains("ownerTrip")) {
        store.createIndex("ownerTrip", ["ownerId", "tripId"], { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function notifyChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("travelhub-local-documents");
    channel.postMessage({ changed: true });
    channel.close();
  }
}

function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `local-${crypto.randomUUID()}`;
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function isPrivateDocumentContext(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  const ipadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
  const smallViewport = window.innerWidth < 768;
  return Boolean(standalone || iosStandalone || uaData?.mobile || ipadOs || mobile || coarse || smallViewport);
}

export function documentUploadDestination(): "soloDispositivo" | "servidor" {
  return isPrivateDocumentContext() ? "soloDispositivo" : "servidor";
}

export const LOCAL_DOCUMENT_MESSAGE = "Solo guardado en este dispositivo";

export async function listLocalDocuments(ownerId: string, tripId: number): Promise<LocalDocument[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).index("ownerTrip").getAll([ownerId, tripId]);
    let result: LocalDocument[] = [];
    request.onerror = () => reject(request.error ?? new Error("No se pudieron leer los documentos locales."));
    request.onsuccess = () => { result = (request.result as LocalDocument[]).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)); };
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(transaction.error ?? new Error("No se pudieron leer los documentos locales."));
  });
}

export async function saveLocalDocument(ownerId: string, input: {
  tripId: number;
  module: string;
  name: string;
  fileType: string;
  notes?: string;
  blob: Blob;
}): Promise<LocalDocument> {
  if (!ownerId) throw new Error("No hay un usuario autenticado para guardar documentos locales.");
  const document: LocalDocument = {
    ...input,
    ownerId,
    id: uuid(),
    uploadedAt: new Date().toISOString(),
    esLocal: true,
    soloDispositivo: true,
  };
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    const request = transaction.objectStore(STORE).put(document);
    request.onerror = () => reject(request.error ?? new Error("No se pudo guardar el documento local."));
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("No se pudo guardar el documento local."));
  });
  notifyChange();
  return document;
}

export async function deleteLocalDocument(ownerId: string, id: string): Promise<void> {
  if (!id.startsWith("local-")) throw new Error("Solo se pueden eliminar documentos locales aquí.");
  if (!ownerId) throw new Error("No hay un usuario autenticado.");
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    const request = transaction.objectStore(STORE).get(id);
    request.onerror = () => reject(request.error ?? new Error("No se pudo comprobar el documento local."));
    request.onsuccess = () => {
      if ((request.result as LocalDocument | undefined)?.ownerId !== ownerId) {
        transaction.abort();
        reject(new Error("Documento local no pertenece al usuario actual."));
        return;
      }
      transaction.objectStore(STORE).delete(id);
    };
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("No se pudo eliminar el documento local."));
  });
  notifyChange();
}

export async function removeLocalDocumentsByAssociation(ownerId: string, tripId: number, module: string, notes: string): Promise<void> {
  const documents = await listLocalDocuments(ownerId, tripId);
  await Promise.all(documents.filter((document) => document.module === module && document.notes === notes).map((document) => deleteLocalDocument(ownerId, document.id)));
}

export async function removeLocalDocumentsForTrip(ownerId: string, tripId: number): Promise<void> {
  const documents = await listLocalDocuments(ownerId, tripId);
  await Promise.all(documents.map((document) => deleteLocalDocument(ownerId, document.id)));
}

export async function getLocalDocument(ownerId: string, id: string): Promise<LocalDocument | undefined> {
  if (!ownerId) return undefined;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).get(id);
    let result: LocalDocument | undefined;
    request.onerror = () => reject(request.error ?? new Error("No se pudo leer el documento local."));
    request.onsuccess = () => {
      const value = request.result as LocalDocument | undefined;
      result = value?.ownerId === ownerId ? value : undefined;
    };
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(transaction.error ?? new Error("No se pudo leer el documento local."));
  });
}

function triggerBlob(blob: Blob, name: string, download: boolean) {
  const url = URL.createObjectURL(blob);
  if (download) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function openLocalDocument(ownerId: string, documentOrId: LocalDocument | string): Promise<void> {
  const popup = window.open("", "_blank");
  if (popup) popup.opener = null;
  const id = typeof documentOrId === "string" ? documentOrId : documentOrId.id;
  try {
    const document = await getLocalDocument(ownerId, id);
    if (!document) throw new Error("Documento local no encontrado.");
    const url = URL.createObjectURL(document.blob);
    if (popup) {
      popup.location.href = url;
    } else {
      triggerBlob(document.blob, document.name, true);
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    popup?.close();
    throw error;
  }
}

export async function downloadLocalDocument(ownerId: string, documentOrId: LocalDocument | string): Promise<void> {
  const id = typeof documentOrId === "string" ? documentOrId : documentOrId.id;
  const document = await getLocalDocument(ownerId, id);
  if (!document) throw new Error("Documento local no encontrado.");
  triggerBlob(document.blob, document.name, true);
}

/** Shared hook; local writes update every mounted module in this tab immediately. */
export function useLocalDocuments(tripId: number) {
  const { user } = useAuth();
  const ownerId = user?.id != null ? String(user.id) : null;
  const [documents, setDocuments] = useState<LocalDocument[]>([]);
  const refresh = useCallback(() => {
    if (!ownerId) {
      setDocuments([]);
      return;
    }
    listLocalDocuments(ownerId, tripId).then(setDocuments).catch(() => setDocuments([]));
  }, [ownerId, tripId]);

  useEffect(() => {
    refresh();
    window.addEventListener(CHANGE_EVENT, refresh);
    const channel = typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel("travelhub-local-documents")
      : null;
    channel?.addEventListener("message", refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      channel?.close();
    };
  }, [refresh]);

  const save = useCallback(async (input: Omit<LocalDocument, "id" | "ownerId" | "uploadedAt" | "esLocal" | "soloDispositivo">) => {
    if (!ownerId) throw new Error("No hay un usuario autenticado para guardar documentos locales.");
    const result = await saveLocalDocument(ownerId, input);
    refresh();
    return result;
  }, [ownerId, refresh]);
  const remove = useCallback(async (id: string) => {
    if (!ownerId) throw new Error("No hay un usuario autenticado.");
    await deleteLocalDocument(ownerId, id);
    refresh();
  }, [ownerId, refresh]);
  const open = useCallback((documentOrId: LocalDocument | string) => {
    if (!ownerId) return Promise.reject(new Error("No hay un usuario autenticado."));
    return openLocalDocument(ownerId, documentOrId);
  }, [ownerId]);
  const download = useCallback((documentOrId: LocalDocument | string) => {
    if (!ownerId) return Promise.reject(new Error("No hay un usuario autenticado."));
    return downloadLocalDocument(ownerId, documentOrId);
  }, [ownerId]);
  const removeByAssociation = useCallback(async (module: string, notes: string) => {
    if (!ownerId) return;
    await removeLocalDocumentsByAssociation(ownerId, tripId, module, notes);
    refresh();
  }, [ownerId, refresh, tripId]);

  return useMemo(() => ({
    ownerId,
    documents,
    save,
    remove,
    open,
    download,
    removeByAssociation,
    isLocalContext: documentUploadDestination() === "soloDispositivo",
  }), [ownerId, documents, save, remove, open, download, removeByAssociation]);
}