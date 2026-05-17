import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import {
  db,
  tripsTable,
  tripSharesTable,
  usersTable,
  flightsTable,
  parkingTable,
  rentalsTable,
  accommodationsTable,
  itineraryItemsTable,
} from "@workspace/db";
import type { Trip } from "@workspace/db";
import { getTripAccess } from "../lib/trip-access.js";

const router: IRouter = Router();

/* ─── Public share link generation ─────────────────────────── */

router.post("/trips/:tripId/share", async (req, res): Promise<void> => {
  const access = (req as unknown as Record<string, unknown>).tripAccess as
    | { trip: Trip; permission: string }
    | undefined;

  if (!access || access.permission !== "owner") {
    res.status(403).json({ error: "Solo el propietario puede generar un enlace de compartir" });
    return;
  }

  const trip = access.trip;

  if (trip.shareToken) {
    res.json({ shareToken: trip.shareToken });
    return;
  }

  const token = randomBytes(18).toString("base64url");
  const [updated] = await db
    .update(tripsTable)
    .set({ shareToken: token })
    .where(eq(tripsTable.id, trip.id))
    .returning();

  res.json({ shareToken: updated.shareToken });
});

/* ─── User shares (collaborative) ──────────────────────────── */

router.get("/trips/:tripId/shares", async (req, res): Promise<void> => {
  const access = (req as unknown as Record<string, unknown>).tripAccess as
    | { trip: Trip; permission: string }
    | undefined;

  if (!access || access.permission !== "owner") {
    res.status(403).json({ error: "Solo el propietario puede ver los colaboradores" });
    return;
  }

  const shares = await db
    .select({
      id: tripSharesTable.id,
      userId: tripSharesTable.userId,
      username: usersTable.username,
      permission: tripSharesTable.permission,
      createdAt: tripSharesTable.createdAt,
    })
    .from(tripSharesTable)
    .innerJoin(usersTable, eq(tripSharesTable.userId, usersTable.id))
    .where(eq(tripSharesTable.tripId, access.trip.id));

  res.json(shares);
});

router.post("/trips/:tripId/shares", async (req, res): Promise<void> => {
  const access = (req as unknown as Record<string, unknown>).tripAccess as
    | { trip: Trip; permission: string }
    | undefined;

  if (!access || access.permission !== "owner") {
    res.status(403).json({ error: "Solo el propietario puede compartir el viaje" });
    return;
  }

  const { userId, permission } = req.body as {
    userId?: number;
    permission?: string;
  };

  if (!userId || !["edit", "view"].includes(permission ?? "")) {
    res.status(400).json({ error: "userId y permission (edit|view) son obligatorios" });
    return;
  }

  try {
    const [share] = await db
      .insert(tripSharesTable)
      .values({ tripId: access.trip.id, userId, permission: permission! })
      .returning();
    res.status(201).json(share);
  } catch {
    res.status(409).json({ error: "Este usuario ya tiene acceso al viaje" });
  }
});

router.delete("/trips/:tripId/shares/:shareId", async (req, res): Promise<void> => {
  const access = (req as unknown as Record<string, unknown>).tripAccess as
    | { trip: Trip; permission: string }
    | undefined;

  if (!access || access.permission !== "owner") {
    res.status(403).json({ error: "Solo el propietario puede eliminar colaboradores" });
    return;
  }

  const shareId = parseInt(req.params.shareId, 10);
  if (isNaN(shareId) || shareId <= 0) {
    res.status(400).json({ error: "shareId inválido" });
    return;
  }

  const [share] = await db
    .delete(tripSharesTable)
    .where(
      and(
        eq(tripSharesTable.id, shareId),
        eq(tripSharesTable.tripId, access.trip.id)
      )
    )
    .returning();

  if (!share) {
    res.status(404).json({ error: "Colaborador no encontrado" });
    return;
  }

  res.sendStatus(204);
});

/* ─── Public shared trip view (no auth) ────────────────────── */

router.get("/shared/:token", async (req, res): Promise<void> => {
  const { token } = req.params;
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Token inválido" });
    return;
  }

  const [trip] = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.shareToken, token));

  if (!trip) {
    res.status(404).json({ error: "Viaje compartido no encontrado" });
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

  const { shareToken: _st, ...publicTrip } = trip;

  res.json({ trip: publicTrip, flights, parkings, rentals, accommodations, itinerary });
});

// Keep getTripAccess imported (used above) — suppress unused warning
void getTripAccess;

export default router;
