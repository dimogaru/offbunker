import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, accommodationsTable } from "@workspace/db";
import {
  ListAccommodationsParams,
  ListAccommodationsResponse,
  CreateAccommodationParams,
  CreateAccommodationBody,
  UpdateAccommodationParams,
  UpdateAccommodationBody,
  UpdateAccommodationResponse,
  DeleteAccommodationParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/trips/:tripId/accommodations", async (req, res): Promise<void> => {
  const params = ListAccommodationsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const accommodations = await db
    .select()
    .from(accommodationsTable)
    .where(eq(accommodationsTable.tripId, params.data.tripId))
    .orderBy(accommodationsTable.checkIn);

  res.json(ListAccommodationsResponse.parse(accommodations));
});

router.post("/trips/:tripId/accommodations", async (req, res): Promise<void> => {
  const params = CreateAccommodationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateAccommodationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [accommodation] = await db
    .insert(accommodationsTable)
    .values({
      ...parsed.data,
      tripId: params.data.tripId,
      type: parsed.data.type ?? "hotel",
      contactPhone: parsed.data.contactPhone ?? null,
      notes: parsed.data.notes ?? null,
    })
    .returning();

  res.status(201).json(accommodation);
});

router.patch("/trips/:tripId/accommodations/:accommodationId", async (req, res): Promise<void> => {
  const params = UpdateAccommodationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateAccommodationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [accommodation] = await db
    .update(accommodationsTable)
    .set(parsed.data)
    .where(and(eq(accommodationsTable.id, params.data.accommodationId), eq(accommodationsTable.tripId, params.data.tripId)))
    .returning();

  if (!accommodation) {
    res.status(404).json({ error: "Accommodation not found" });
    return;
  }

  res.json(UpdateAccommodationResponse.parse(accommodation));
});

router.delete("/trips/:tripId/accommodations/:accommodationId", async (req, res): Promise<void> => {
  const params = DeleteAccommodationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [accommodation] = await db
    .delete(accommodationsTable)
    .where(and(eq(accommodationsTable.id, params.data.accommodationId), eq(accommodationsTable.tripId, params.data.tripId)))
    .returning();

  if (!accommodation) {
    res.status(404).json({ error: "Accommodation not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
