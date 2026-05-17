import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, itineraryItemsTable } from "@workspace/db";
import {
  ListItineraryItemsParams,
  ListItineraryItemsResponse,
  CreateItineraryItemParams,
  CreateItineraryItemBody,
  UpdateItineraryItemParams,
  UpdateItineraryItemBody,
  UpdateItineraryItemResponse,
  DeleteItineraryItemParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/trips/:tripId/itinerary", async (req, res): Promise<void> => {
  const params = ListItineraryItemsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const items = await db
    .select()
    .from(itineraryItemsTable)
    .where(eq(itineraryItemsTable.tripId, params.data.tripId))
    .orderBy(itineraryItemsTable.date, itineraryItemsTable.time);

  res.json(ListItineraryItemsResponse.parse(items));
});

router.post("/trips/:tripId/itinerary", async (req, res): Promise<void> => {
  const params = CreateItineraryItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateItineraryItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [item] = await db
    .insert(itineraryItemsTable)
    .values({
      ...parsed.data,
      date: parsed.data.date as unknown as string,
      tripId: params.data.tripId,
      time: parsed.data.time ?? null,
      description: parsed.data.description ?? null,
      location: parsed.data.location ?? null,
      category: parsed.data.category ?? "other",
    })
    .returning();

  res.status(201).json(item);
});

router.patch("/trips/:tripId/itinerary/:itemId", async (req, res): Promise<void> => {
  const params = UpdateItineraryItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateItineraryItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData = {
    ...parsed.data,
    ...(parsed.data.date !== undefined && { date: parsed.data.date as unknown as string }),
  };

  const [item] = await db
    .update(itineraryItemsTable)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set(updateData as any)
    .where(and(eq(itineraryItemsTable.id, params.data.itemId), eq(itineraryItemsTable.tripId, params.data.tripId)))
    .returning();

  if (!item) {
    res.status(404).json({ error: "Itinerary item not found" });
    return;
  }

  res.json(UpdateItineraryItemResponse.parse(item));
});

router.delete("/trips/:tripId/itinerary/:itemId", async (req, res): Promise<void> => {
  const params = DeleteItineraryItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [item] = await db
    .delete(itineraryItemsTable)
    .where(and(eq(itineraryItemsTable.id, params.data.itemId), eq(itineraryItemsTable.tripId, params.data.tripId)))
    .returning();

  if (!item) {
    res.status(404).json({ error: "Itinerary item not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
