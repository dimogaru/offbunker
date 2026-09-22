import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { uploadsDir } from "../lib/storage-paths";

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
    destination: uploadsDir,
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

router.post("/uploads", (req, res): void => {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        error: "El archivo supera el tamaño máximo permitido de 5 MB.",
      });
      return;
    }
    if (err instanceof Error && err.message === "TIPO_NO_PERMITIDO") {
      res.status(415).json({
        error: "Formato no permitido. Sube un PDF o imagen (JPEG, PNG, WebP).",
      });
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
    res.json({ url: `/api/uploads/${encodeURIComponent(req.file.filename)}` });
  });
});

export default router;
