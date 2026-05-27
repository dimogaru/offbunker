import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  tripsTable,
  tripSharesTable,
  flightsTable,
  parkingTable,
  rentalsTable,
  accommodationsTable,
  itineraryItemsTable,
  documentsTable,
  baggageItemsTable,
} from "@workspace/db";
import type { Trip } from "@workspace/db";
import {
  CreateTripBody,
  UpdateTripParams,
  UpdateTripBody,
  GetTripProgressParams,
  GetTripProgressResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

/* ─── Cover-image helper ─────────────────────────────────────── */

// Return the URL as-is so cover images survive server restarts/redeployments.
// Downloading to local disk was unreliable in production (ephemeral filesystem).
function localizecover(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/") || url.startsWith("http://") || url.startsWith("https://")) return url;
  return null;
}

/* ─── Routes ─────────────────────────────────────────────────── */

router.get("/trips", async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const owned = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.ownerId, userId))
    .orderBy(tripsTable.startDate);

  const shareRows = await db
    .select({ tripId: tripSharesTable.tripId })
    .from(tripSharesTable)
    .where(eq(tripSharesTable.userId, userId));

  const sharedIds = shareRows.map((r) => r.tripId);
  const shared: Trip[] =
    sharedIds.length > 0
      ? await db
          .select()
          .from(tripsTable)
          .where(inArray(tripsTable.id, sharedIds))
          .orderBy(tripsTable.startDate)
      : [];

  const all = [...owned, ...shared].sort((a, b) =>
    a.startDate.localeCompare(b.startDate)
  );

  res.json(all);
});

router.post("/trips", async (req, res): Promise<void> => {
  const parsed = CreateTripBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { coverImage, notes, ...required } = parsed.data;
  const localCover = await localizecover(coverImage);
  if (coverImage && !localCover) {
    req.log.warn({ coverImage }, "Cover image download failed — storing null");
  }

  const [trip] = await db
    .insert(tripsTable)
    .values({
      ...required,
      startDate: required.startDate as unknown as string,
      endDate: required.endDate as unknown as string,
      ownerId: req.session.userId!,
      coverImage: localCover,
      notes: notes ?? null,
    })
    .returning();

  res.status(201).json(trip);
});

router.get("/trips/:tripId", async (req, res): Promise<void> => {
  const access = (req as unknown as Record<string, unknown>).tripAccess as
    | { trip: Trip; permission: string }
    | undefined;

  if (!access) {
    res.status(404).json({ error: "Viaje no encontrado" });
    return;
  }

  res.json({ ...access.trip, permission: access.permission });
});

router.patch("/trips/:tripId", async (req, res): Promise<void> => {
  const access = (req as unknown as Record<string, unknown>).tripAccess as
    | { trip: Trip; permission: string }
    | undefined;

  if (!access) {
    res.status(404).json({ error: "Viaje no encontrado" });
    return;
  }

  if (access.permission !== "owner") {
    res.status(403).json({ error: "Solo el propietario puede modificar el viaje" });
    return;
  }

  const params = UpdateTripParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTripBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { coverImage, ...rest } = parsed.data;
  let resolvedCover: string | null | undefined = coverImage;
  if (coverImage !== undefined) {
    resolvedCover = await localizecover(coverImage);
    if (coverImage && !resolvedCover) {
      req.log.warn({ coverImage }, "Cover image download failed — storing null");
    }
  }

  const updateData = resolvedCover !== undefined
    ? { ...rest, coverImage: resolvedCover }
    : rest;

  const serializedUpdate = {
    ...updateData,
    ...(updateData.startDate !== undefined && { startDate: updateData.startDate as unknown as string }),
    ...(updateData.endDate !== undefined && { endDate: updateData.endDate as unknown as string }),
  };

  const [trip] = await db
    .update(tripsTable)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set(serializedUpdate as any)
    .where(eq(tripsTable.id, params.data.tripId))
    .returning();

  if (!trip) {
    res.status(404).json({ error: "Viaje no encontrado" });
    return;
  }

  res.json(trip);
});

router.delete("/trips/:tripId", async (req, res): Promise<void> => {
  const access = (req as unknown as Record<string, unknown>).tripAccess as
    | { trip: Trip; permission: string }
    | undefined;

  if (!access) {
    res.status(404).json({ error: "Viaje no encontrado" });
    return;
  }

  if (access.permission !== "owner") {
    res.status(403).json({ error: "Solo el propietario puede eliminar el viaje" });
    return;
  }

  const [trip] = await db
    .delete(tripsTable)
    .where(eq(tripsTable.id, access.trip.id))
    .returning();

  if (!trip) {
    res.status(404).json({ error: "Viaje no encontrado" });
    return;
  }

  res.sendStatus(204);
});

router.get("/trips/:tripId/progress", async (req, res): Promise<void> => {
  const params = GetTripProgressParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { tripId } = params.data;

  const [flights, parkings, rentals, accommodations, itinerary, baggage] =
    await Promise.all([
      db.select().from(flightsTable).where(eq(flightsTable.tripId, tripId)),
      db.select().from(parkingTable).where(eq(parkingTable.tripId, tripId)),
      db.select().from(rentalsTable).where(eq(rentalsTable.tripId, tripId)),
      db.select().from(accommodationsTable).where(eq(accommodationsTable.tripId, tripId)),
      db.select().from(itineraryItemsTable).where(eq(itineraryItemsTable.tripId, tripId)),
      db.select().from(baggageItemsTable).where(eq(baggageItemsTable.tripId, tripId)),
    ]);

  const modules = [
    { module: "flights",       label: "Logística Aérea", count: flights.length },
    { module: "parking",       label: "Estacionamiento", count: parkings.length },
    { module: "rental",        label: "Transportes",     count: rentals.length },
    { module: "accommodation", label: "Alojamiento",     count: accommodations.length },
    { module: "itinerary",     label: "Itinerario",      count: itinerary.length },
    { module: "baggage",       label: "Equipaje",        count: baggage.length },
  ];

  const moduleBreakdown = modules.map((m) => ({
    module: m.module,
    label: m.label,
    hasDocuments: m.count > 0,
    documentCount: m.count,
  }));

  const completedModules = moduleBreakdown.filter((m) => m.hasDocuments).length;
  const totalModules = 6;
  const percentComplete = Math.round((completedModules / totalModules) * 100);

  res.json(
    GetTripProgressResponse.parse({
      tripId,
      totalModules,
      completedModules,
      percentComplete,
      moduleBreakdown,
    })
  );
});

export default router;
