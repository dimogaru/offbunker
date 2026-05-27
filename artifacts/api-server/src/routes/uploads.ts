import { Router } from "express";
import multer from "multer";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

// Use memory storage — files are converted to base64 data URLs and stored in
// the database, so they survive server restarts and redeployments.
const upload = multer({
  storage: multer.memoryStorage(),
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
    const mimeType = req.file.mimetype;
    const base64   = req.file.buffer.toString("base64");
    const dataUrl  = `data:${mimeType};base64,${base64}`;
    res.json({ url: dataUrl });
  });
});

export default router;
