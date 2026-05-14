import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, rentalsTable } from "@workspace/db";
import {
  ListRentalsParams,
  ListRentalsResponse,
  CreateRentalParams,
  CreateRentalBody,
  UpdateRentalParams,
  UpdateRentalBody,
  UpdateRentalResponse,
  DeleteRentalParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/trips/:tripId/rentals", async (req, res): Promise<void> => {
  const params = ListRentalsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rentals = await db
    .select()
    .from(rentalsTable)
    .where(eq(rentalsTable.tripId, params.data.tripId))
    .orderBy(rentalsTable.pickupDate);

  res.json(ListRentalsResponse.parse(rentals));
});

router.post("/trips/:tripId/rentals", async (req, res): Promise<void> => {
  const params = CreateRentalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateRentalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [rental] = await db
    .insert(rentalsTable)
    .values({
      ...parsed.data,
      tripId: params.data.tripId,
      returnLocation: parsed.data.returnLocation ?? null,
      vehicleType: parsed.data.vehicleType ?? null,
      confirmationCode: parsed.data.confirmationCode ?? null,
      notes: parsed.data.notes ?? null,
    })
    .returning();

  res.status(201).json(rental);
});

router.patch("/trips/:tripId/rentals/:rentalId", async (req, res): Promise<void> => {
  const params = UpdateRentalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateRentalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [rental] = await db
    .update(rentalsTable)
    .set(parsed.data)
    .where(and(eq(rentalsTable.id, params.data.rentalId), eq(rentalsTable.tripId, params.data.tripId)))
    .returning();

  if (!rental) {
    res.status(404).json({ error: "Rental not found" });
    return;
  }

  res.json(UpdateRentalResponse.parse(rental));
});

router.delete("/trips/:tripId/rentals/:rentalId", async (req, res): Promise<void> => {
  const params = DeleteRentalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [rental] = await db
    .delete(rentalsTable)
    .where(and(eq(rentalsTable.id, params.data.rentalId), eq(rentalsTable.tripId, params.data.tripId)))
    .returning();

  if (!rental) {
    res.status(404).json({ error: "Rental not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
