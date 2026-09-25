import fs from "node:fs/promises";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { db, documentsTable, tripsTable } from "@workspace/db";
import { uploadsDir } from "./storage-paths";

export const MAX_ACTIVE_TRIPS = 2;
export const MAX_COLLABORATORS = 2;
export const MAX_SHARED_BYTES = 50 * 1024 * 1024;
export const TRIP_LIMIT_ERROR = "Has alcanzado el límite de 2 viajes en el Plan Gratuito.";
export const SHARE_LIMIT_ERROR = "El Plan Gratuito solo permite compartir cada viaje con un máximo de 2 personas más.";
export const STORAGE_LIMIT_ERROR = "Límite de almacenamiento compartido alcanzado (50 MB).";

type PlanTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Use the same database connection for the lock and the quota query/write.
export async function withPlanLock<T>(kind: number, id: number, work: (tx: PlanTransaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${kind}, ${id})`);
    return work(tx);
  });
}

export function isActiveTrip(status: string): boolean {
  return status !== "completed";
}

export function userUploadDir(userId: number): string {
  return path.join(uploadsDir, String(userId));
}

export function userUploadUrl(userId: number, filename: string): string {
  return `/api/uploads/${userId}/${encodeURIComponent(filename)}`;
}

export function uploadedFilePath(url: string | null): string | null {
  if (!url) return null;
  const match = /^\/(?:api\/)?uploads\/(?:(\d+)\/)?([^/]+)$/.exec(url);
  if (!match) return null;
  try {
    const filename = decodeURIComponent(match[2]);
    if (filename !== path.basename(filename) || filename === "." || filename === "..") return null;
    return match[1] ? path.join(userUploadDir(Number(match[1])), filename) : path.join(uploadsDir, filename);
  } catch {
    return null;
  }
}

async function fileSize(filePath: string): Promise<number> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() ? stat.size : 0;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
}

// New uploads occupy the user's directory, including files not yet linked to a document.
// Older flat URLs have no uploader metadata; attribute them to the owning trip.
export async function sharedBytesUsed(userId: number, database: PlanTransaction): Promise<number> {
  let total = 0;
  try {
    const entries = await fs.readdir(userUploadDir(userId), { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) total += await fileSize(path.join(userUploadDir(userId), entry.name));
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const legacy = await database.select({ fileUrl: documentsTable.fileUrl })
    .from(documentsTable)
    .innerJoin(tripsTable, eq(documentsTable.tripId, tripsTable.id))
    .where(eq(tripsTable.ownerId, userId));
  const paths = new Set(legacy.map(({ fileUrl }) => uploadedFilePath(fileUrl))
    .filter((filePath): filePath is string => !!filePath && path.dirname(filePath) === uploadsDir));
  for (const filePath of paths) total += await fileSize(filePath);
  return total;
}

export async function removeUnreferencedUpload(url: string | null, database: PlanTransaction | typeof db = db): Promise<void> {
  const filePath = uploadedFilePath(url);
  if (!filePath || !url) return;
  const references = await database.select({ id: documentsTable.id }).from(documentsTable)
    .where(eq(documentsTable.fileUrl, url)).limit(1);
  if (references.length) return;
  await fs.unlink(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}