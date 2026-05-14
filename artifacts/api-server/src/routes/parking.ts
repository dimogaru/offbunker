import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, parkingTable } from "@workspace/db";
import {
  ListParkingsParams,
  ListParkingsResponse,
  CreateParkingParams,
  CreateParkingBody,
  UpdateParkingParams,
  UpdateParkingBody,
  UpdateParkingResponse,
  DeleteParkingParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/trips/:tripId/parking", async (req, res): Promise<void> => {
  const params = ListParkingsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parkings = await db
    .select()
    .from(parkingTable)
    .where(eq(parkingTable.tripId, params.data.tripId))
    .orderBy(parkingTable.entryDate);

  res.json(ListParkingsResponse.parse(parkings));
});

router.post("/trips/:tripId/parking", async (req, res): Promise<void> => {
  const params = CreateParkingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateParkingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [parking] = await db
    .insert(parkingTable)
    .values({
      ...parsed.data,
      tripId: params.data.tripId,
      priceTotal: parsed.data.priceTotal?.toString() ?? null,
      notes: parsed.data.notes ?? null,
    })
    .returning();

  res.status(201).json(parking);
});

router.patch("/trips/:tripId/parking/:parkingId", async (req, res): Promise<void> => {
  const params = UpdateParkingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateParkingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.priceTotal !== undefined) {
    updateData.priceTotal = parsed.data.priceTotal?.toString() ?? null;
  }

  const [parking] = await db
    .update(parkingTable)
    .set(updateData)
    .where(and(eq(parkingTable.id, params.data.parkingId), eq(parkingTable.tripId, params.data.tripId)))
    .returning();

  if (!parking) {
    res.status(404).json({ error: "Parking not found" });
    return;
  }

  res.json(UpdateParkingResponse.parse(parking));
});

router.delete("/trips/:tripId/parking/:parkingId", async (req, res): Promise<void> => {
  const params = DeleteParkingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [parking] = await db
    .delete(parkingTable)
    .where(and(eq(parkingTable.id, params.data.parkingId), eq(parkingTable.tripId, params.data.tripId)))
    .returning();

  if (!parking) {
    res.status(404).json({ error: "Parking not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
