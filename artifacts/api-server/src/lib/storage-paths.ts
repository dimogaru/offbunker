import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiServerDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  import.meta.url.includes("/dist/") ? ".." : "../..",
);

export const uploadsDir = path.resolve(
  process.env.UPLOADS_DIR || path.join(apiServerDir, "uploads"),
);

export const publicDir = path.resolve(
  process.env.PUBLIC_DIR ||
    path.join(apiServerDir, "..", "travel-hub", "dist", "public"),
);

export function ensureStorageDirectories(): void {
  fs.mkdirSync(uploadsDir, { recursive: true });
}