import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { MAX_SHARED_BYTES, removeUnreferencedUpload, sharedBytesUsed, STORAGE_LIMIT_ERROR, userUploadDir, userUploadUrl, withPlanLock } from "../lib/free-plan";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function safeBaseName(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  const baseName = path
    .basename(fileName, extension)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${baseName || "archivo"}-${randomUUID()}${extension}`;
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = userUploadDir(req.session.userId!);
      fs.mkdir(dir, { recursive: true }, (err) => cb(err, dir));
    },
    filename: (_req, file, cb) => cb(null, safeBaseName(file.originalname)),
  }),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("TIPO_NO_PERMITIDO"));
    }
  },
});

const router = Router();

router.post("/uploads", async (req, res): Promise<void> => {
  await withPlanLock(3, req.session.userId!, async (tx) => {
    const err = await new Promise<unknown>((resolve) => {
      upload.single("file")(req, res, resolve);
    });
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "El archivo supera el tamaño máximo permitido de 5 MB." });
      return;
    }
    if (err instanceof Error && err.message === "TIPO_NO_PERMITIDO") {
      res.status(415).json({ error: "Formato no permitido. Sube un PDF o imagen (JPEG, PNG, WebP)." });
      return;
    }
    if (err) {
      res.status(500).json({ error: "Error al procesar el archivo." });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "No se recibió ningún archivo." });
      return;
    }
    if (await sharedBytesUsed(req.session.userId!, tx) > MAX_SHARED_BYTES) {
      await unlink(req.file.path);
      res.status(403).json({ error: STORAGE_LIMIT_ERROR });
      return;
    }
    res.json({ url: userUploadUrl(req.session.userId!, req.file.filename) });
  });
});

router.delete("/uploads/:userId/:filename", async (req, res): Promise<void> => {
  if (String(req.session.userId) !== req.params.userId || req.params.filename !== path.basename(req.params.filename)) {
    res.status(403).json({ error: "No puedes eliminar este archivo." });
    return;
  }
  const url = userUploadUrl(req.session.userId!, req.params.filename);
  await withPlanLock(3, req.session.userId!, async (tx) => {
    await removeUnreferencedUpload(url, tx);
  });
  res.sendStatus(204);
});

export default router;
