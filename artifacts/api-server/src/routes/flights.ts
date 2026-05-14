import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, flightsTable } from "@workspace/db";
import {
  ListFlightsParams,
  ListFlightsResponse,
  CreateFlightParams,
  CreateFlightBody,
  UpdateFlightParams,
  UpdateFlightBody,
  UpdateFlightResponse,
  DeleteFlightParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/trips/:tripId/flights", async (req, res): Promise<void> => {
  const params = ListFlightsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const flights = await db
    .select()
    .from(flightsTable)
    .where(eq(flightsTable.tripId, params.data.tripId))
    .orderBy(flightsTable.departureTime);

  res.json(ListFlightsResponse.parse(flights));
});

router.post("/trips/:tripId/flights", async (req, res): Promise<void> => {
  const params = CreateFlightParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateFlightBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [flight] = await db
    .insert(flightsTable)
    .values({
      ...parsed.data,
      tripId: params.data.tripId,
      terminal: parsed.data.terminal ?? null,
      gate: parsed.data.gate ?? null,
      seat: parsed.data.seat ?? null,
      notes: parsed.data.notes ?? null,
    })
    .returning();

  res.status(201).json(flight);
});

router.patch("/trips/:tripId/flights/:flightId", async (req, res): Promise<void> => {
  const params = UpdateFlightParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateFlightBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [flight] = await db
    .update(flightsTable)
    .set(parsed.data)
    .where(and(eq(flightsTable.id, params.data.flightId), eq(flightsTable.tripId, params.data.tripId)))
    .returning();

  if (!flight) {
    res.status(404).json({ error: "Flight not found" });
    return;
  }

  res.json(UpdateFlightResponse.parse(flight));
});

router.delete("/trips/:tripId/flights/:flightId", async (req, res): Promise<void> => {
  const params = DeleteFlightParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [flight] = await db
    .delete(flightsTable)
    .where(and(eq(flightsTable.id, params.data.flightId), eq(flightsTable.tripId, params.data.tripId)))
    .returning();

  if (!flight) {
    res.status(404).json({ error: "Flight not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
