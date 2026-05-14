import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadsDir = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-z0-9]/gi, "-")
      .toLowerCase()
      .slice(0, 50);
    const id = Math.random().toString(36).slice(2, 10);
    cb(null, `${base}-${id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
});

const router = Router();

router.post("/uploads", upload.single("file"), (req, res): void => {
  if (!req.file) {
    res.status(400).json({ error: "No se recibió ningún archivo" });
    return;
  }
  res.json({ url: `/uploads/${req.file.filename}` });
});

export default router;
