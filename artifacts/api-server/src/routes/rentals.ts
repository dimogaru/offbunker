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
    .orderBy(rentalsTable.createdAt);

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

  const d = parsed.data;
  const [rental] = await db
    .insert(rentalsTable)
    .values({
      tripId:             params.data.tripId,
      transportType:      d.transportType,
      company:            d.company            ?? null,
      pickupLocation:     d.pickupLocation     ?? null,
      returnLocation:     d.returnLocation     ?? null,
      pickupDate:         d.pickupDate        ?? null,
      returnDate:         d.returnDate        ?? null,
      fuelPolicy:         d.fuelPolicy         ?? null,
      vehicleType:        d.vehicleType        ?? null,
      confirmationCode:   d.confirmationCode   ?? null,
      originStation:      d.originStation      ?? null,
      destinationStation: d.destinationStation ?? null,
      departureDateTime:  d.departureDateTime ?? null,
      arrivalDateTime:    d.arrivalDateTime   ?? null,
      transportNumber:    d.transportNumber    ?? null,
      seatInfo:           d.seatInfo           ?? null,
      meetingPoint:       d.meetingPoint       ?? null,
      notes:              d.notes              ?? null,
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

  const d = parsed.data;
  const [rental] = await db
    .update(rentalsTable)
    .set({
      ...(d.transportType      !== undefined && { transportType:      d.transportType }),
      ...(d.company            !== undefined && { company:            d.company }),
      ...(d.pickupLocation     !== undefined && { pickupLocation:     d.pickupLocation }),
      ...(d.returnLocation     !== undefined && { returnLocation:     d.returnLocation }),
      ...(d.pickupDate         !== undefined && { pickupDate:         d.pickupDate }),
      ...(d.returnDate         !== undefined && { returnDate:         d.returnDate }),
      ...(d.fuelPolicy         !== undefined && { fuelPolicy:         d.fuelPolicy }),
      ...(d.vehicleType        !== undefined && { vehicleType:        d.vehicleType }),
      ...(d.confirmationCode   !== undefined && { confirmationCode:   d.confirmationCode }),
      ...(d.originStation      !== undefined && { originStation:      d.originStation }),
      ...(d.destinationStation !== undefined && { destinationStation: d.destinationStation }),
      ...(d.departureDateTime  !== undefined && { departureDateTime:  d.departureDateTime }),
      ...(d.arrivalDateTime    !== undefined && { arrivalDateTime:    d.arrivalDateTime }),
      ...(d.transportNumber    !== undefined && { transportNumber:    d.transportNumber }),
      ...(d.seatInfo           !== undefined && { seatInfo:           d.seatInfo }),
      ...(d.meetingPoint       !== undefined && { meetingPoint:       d.meetingPoint }),
      ...(d.notes              !== undefined && { notes:              d.notes }),
    })
    .where(and(eq(rentalsTable.id, params.data.rentalId), eq(rentalsTable.tripId, params.data.tripId)))
    .returning();

  if (!rental) {
    res.status(404).json({ error: "Transporte no encontrado" });
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
    res.status(404).json({ error: "Transporte no encontrado" });
    return;
  }

  res.sendStatus(204);
});

export default router;
