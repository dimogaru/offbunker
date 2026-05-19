import { Router } from "express";
import multer from "multer";

// Use memory storage — files are converted to base64 data URLs and stored in
// the database, so they survive server restarts and redeployments.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
});

const router = Router();

router.post("/uploads", upload.single("file"), (req, res): void => {
  if (!req.file) {
    res.status(400).json({ error: "No se recibió ningún archivo" });
    return;
  }
  const mimeType = req.file.mimetype || "application/octet-stream";
  const base64   = req.file.buffer.toString("base64");
  const dataUrl  = `data:${mimeType};base64,${base64}`;
  res.json({ url: dataUrl });
});

export default router;
