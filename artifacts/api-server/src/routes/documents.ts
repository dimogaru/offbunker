import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, documentsTable } from "@workspace/db";
import { removeUnreferencedUpload } from "../lib/free-plan";
import {
  ListDocumentsParams,
  ListDocumentsResponse,
  CreateDocumentParams,
  CreateDocumentBody,
  DeleteDocumentParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/trips/:tripId/documents", async (req, res): Promise<void> => {
  const params = ListDocumentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const docs = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.tripId, params.data.tripId))
    .orderBy(documentsTable.uploadedAt);

  res.json(ListDocumentsResponse.parse(docs));
});

router.post("/trips/:tripId/documents", async (req, res): Promise<void> => {
  const params = CreateDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // Files created through this API must belong to the uploading user.
  if (parsed.data.fileUrl && !parsed.data.fileUrl.startsWith(`/api/uploads/${req.session.userId!}/`)) {
    res.status(403).json({ error: "El archivo no pertenece a tu espacio de subidas." });
    return;
  }

  const [doc] = await db
    .insert(documentsTable)
    .values({
      ...parsed.data,
      tripId: params.data.tripId,
      fileUrl: parsed.data.fileUrl ?? null,
      notes: parsed.data.notes ?? null,
    })
    .returning();

  res.status(201).json(doc);
});

router.delete("/trips/:tripId/documents/:documentId", async (req, res): Promise<void> => {
  const params = DeleteDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [doc] = await db
    .delete(documentsTable)
    .where(and(eq(documentsTable.id, params.data.documentId), eq(documentsTable.tripId, params.data.tripId)))
    .returning();

  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  await removeUnreferencedUpload(doc.fileUrl).catch((error) => {
    req.log.warn({ error }, "Unable to remove deleted upload");
  });

  res.sendStatus(204);
});

export default router;
