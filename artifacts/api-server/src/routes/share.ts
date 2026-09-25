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
import { MAX_COLLABORATORS, SHARE_LIMIT_ERROR, withPlanLock } from "../lib/free-plan";

const router: IRouter = Router();

/* ─── Public share link generation ─────────────────────────── */

router.post("/trips/:tripId/share", async (req, res): Promise<void> => {
  const access = (req as unknown as Record<string, unknown>).tripAccess as
    | { trip: Trip; permission: string }
    | undefined;

  if (!access || access.permission !== "owner") {
    res.status(403).json({ error: "Solo el creador original del viaje puede invitar a nuevos colaboradores." });
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
    res.status(403).json({ error: "Solo el creador original del viaje puede invitar a nuevos colaboradores." });
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
    res.status(403).json({ error: "Solo el creador original del viaje puede invitar a nuevos colaboradores." });
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

  if (userId === access.trip.ownerId) {
    res.status(400).json({ error: "El propietario ya tiene acceso al viaje" });
    return;
  }
  try {
    const result = await withPlanLock(2, access.trip.id, async (tx) => {
    const [recipient] = await tx.select({ id: usersTable.id, role: usersTable.role }).from(usersTable)
      .where(eq(usersTable.id, userId));
    if (!recipient) {
      return "recipient-not-found" as const;
    }
    if (recipient.role === "demo") {
      return "demo-recipient" as const;
    }
    const shares = await tx.select({ userId: tripSharesTable.userId }).from(tripSharesTable)
      .where(eq(tripSharesTable.tripId, access.trip.id));
    if (shares.some((share) => share.userId === userId)) {
      return "duplicate" as const;
    }
    if (shares.length >= MAX_COLLABORATORS) {
      return "limit" as const;
    }
    const [share] = await tx.insert(tripSharesTable)
      .values({ tripId: access.trip.id, userId, permission: permission! }).returning();
    return share;
    });
    if (result === "duplicate") {
      res.status(409).json({ error: "Este usuario ya tiene acceso al viaje" });
      return;
    }
    if (result === "limit") {
      res.status(403).json({ error: SHARE_LIMIT_ERROR });
      return;
    }
    if (result === "recipient-not-found") {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }
    if (result === "demo-recipient") {
      res.status(400).json({ error: "No se pueden añadir usuarios demo como colaboradores" });
      return;
    }
    res.status(201).json(result);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23503" || code === "23505") {
      res.status(code === "23503" ? 400 : 409).json({
        error: code === "23503" ? "Usuario no encontrado" : "Este usuario ya tiene acceso al viaje",
      });
      return;
    }
    throw error;
  }
});

router.delete("/trips/:tripId/shares/:shareId", async (req, res): Promise<void> => {
  const access = (req as unknown as Record<string, unknown>).tripAccess as
    | { trip: Trip; permission: string }
    | undefined;

  if (!access || access.permission !== "owner") {
    res.status(403).json({ error: "Solo el creador original del viaje puede invitar a nuevos colaboradores." });
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
