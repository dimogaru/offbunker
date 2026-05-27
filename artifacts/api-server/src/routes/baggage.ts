import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, baggageItemsTable } from "@workspace/db";
import {
  ListBaggageItemsParams,
  ListBaggageItemsResponse,
  CreateBaggageItemParams,
  CreateBaggageItemBody,
  UpdateBaggageItemParams,
  UpdateBaggageItemBody,
  UpdateBaggageItemResponse,
  DeleteBaggageItemParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/trips/:tripId/baggage", async (req, res): Promise<void> => {
  const params = ListBaggageItemsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = req.session?.userId as number;
  const items = await db
    .select()
    .from(baggageItemsTable)
    .where(
      and(
        eq(baggageItemsTable.tripId, params.data.tripId),
        eq(baggageItemsTable.userId, userId),
      ),
    )
    .orderBy(baggageItemsTable.sortOrder, baggageItemsTable.createdAt);

  res.json(ListBaggageItemsResponse.parse(items));
});

router.post("/trips/:tripId/baggage", async (req, res): Promise<void> => {
  const params = CreateBaggageItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateBaggageItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.session?.userId as number;
  const [item] = await db
    .insert(baggageItemsTable)
    .values({
      ...parsed.data,
      tripId: params.data.tripId,
      userId,
      isLastMinute: parsed.data.isLastMinute ?? false,
      sortOrder: parsed.data.sortOrder ?? 0,
    })
    .returning();

  res.status(201).json(item);
});

router.patch("/trips/:tripId/baggage/:itemId", async (req, res): Promise<void> => {
  const params = UpdateBaggageItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateBaggageItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.session?.userId as number;
  const [item] = await db
    .update(baggageItemsTable)
    .set(parsed.data)
    .where(
      and(
        eq(baggageItemsTable.id, params.data.itemId),
        eq(baggageItemsTable.tripId, params.data.tripId),
        eq(baggageItemsTable.userId, userId),
      ),
    )
    .returning();

  if (!item) {
    res.status(404).json({ error: "Ítem no encontrado" });
    return;
  }

  res.json(UpdateBaggageItemResponse.parse(item));
});

router.delete("/trips/:tripId/baggage/:itemId", async (req, res): Promise<void> => {
  const params = DeleteBaggageItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = req.session?.userId as number;
  const [item] = await db
    .delete(baggageItemsTable)
    .where(
      and(
        eq(baggageItemsTable.id, params.data.itemId),
        eq(baggageItemsTable.tripId, params.data.tripId),
        eq(baggageItemsTable.userId, userId),
      ),
    )
    .returning();

  if (!item) {
    res.status(404).json({ error: "Ítem no encontrado" });
    return;
  }

  res.sendStatus(204);
});

export default router;
