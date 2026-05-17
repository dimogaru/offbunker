import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import {
  db,
  tripsTable,
  flightsTable,
  parkingTable,
  rentalsTable,
  accommodationsTable,
  itineraryItemsTable,
} from "@workspace/db";

const router: IRouter = Router();

router.post("/trips/:tripId/share", async (req, res): Promise<void> => {
  const tripId = parseInt(req.params.tripId, 10);
  if (isNaN(tripId) || tripId <= 0) {
    res.status(400).json({ error: "Invalid tripId" });
    return;
  }

  const [trip] = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.id, tripId));

  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  if (trip.shareToken) {
    res.json({ shareToken: trip.shareToken });
    return;
  }

  const token = randomBytes(18).toString("base64url");
  const [updated] = await db
    .update(tripsTable)
    .set({ shareToken: token })
    .where(eq(tripsTable.id, tripId))
    .returning();

  res.json({ shareToken: updated.shareToken });
});

router.get("/shared/:token", async (req, res): Promise<void> => {
  const { token } = req.params;
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Invalid token" });
    return;
  }

  const [trip] = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.shareToken, token));

  if (!trip) {
    res.status(404).json({ error: "Shared trip not found" });
    return;
  }

  const [flights, parkings, rentals, accommodations, itinerary] =
    await Promise.all([
      db.select().from(flightsTable).where(eq(flightsTable.tripId, trip.id)),
      db.select().from(parkingTable).where(eq(parkingTable.tripId, trip.id)),
      db.select().from(rentalsTable).where(eq(rentalsTable.tripId, trip.id)),
      db.select().from(accommodationsTable).where(eq(accommodationsTable.tripId, trip.id)),
      db.select().from(itineraryItemsTable).where(eq(itineraryItemsTable.tripId, trip.id)),
    ]);

  // Strip shareToken (and any other internal fields) from the public trip snapshot.
  // Documents are intentionally excluded — file URLs must never be exposed to guests.
  const { shareToken: _st, ...publicTrip } = trip;

  res.json({ trip: publicTrip, flights, parkings, rentals, accommodations, itinerary });
});

export default router;
