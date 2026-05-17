import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
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

const coversDir = path.join(process.cwd(), "uploads", "covers");

async function localizecover(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("/")) return url;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return null;

  try {
    await mkdir(coversDir, { recursive: true });
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;

    const ct = res.headers.get("content-type") ?? "";
    const ext = ct.includes("png") ? ".png"
      : ct.includes("webp") ? ".webp"
      : ct.includes("gif") ? ".gif"
      : ".jpg";

    const id = Math.random().toString(36).slice(2, 10);
    const filename = `cover-${id}${ext}`;
    await writeFile(path.join(coversDir, filename), Buffer.from(await res.arrayBuffer()));
    return `/api/uploads/covers/${filename}`;
  } catch {
    return null;
  }
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

  const [flights, parkings, rentals, accommodations, itinerary, documents] =
    await Promise.all([
      db.select().from(flightsTable).where(eq(flightsTable.tripId, tripId)),
      db.select().from(parkingTable).where(eq(parkingTable.tripId, tripId)),
      db.select().from(rentalsTable).where(eq(rentalsTable.tripId, tripId)),
      db.select().from(accommodationsTable).where(eq(accommodationsTable.tripId, tripId)),
      db.select().from(itineraryItemsTable).where(eq(itineraryItemsTable.tripId, tripId)),
      db.select().from(documentsTable).where(eq(documentsTable.tripId, tripId)),
    ]);

  const modules = [
    { module: "flights",       label: "Logística Aérea",     count: flights.length,        docCount: documents.filter((d) => d.module === "flights").length },
    { module: "parking",       label: "Estacionamiento",     count: parkings.length,       docCount: documents.filter((d) => d.module === "parking").length },
    { module: "rental",        label: "Alquiler de Vehículo", count: rentals.length,       docCount: documents.filter((d) => d.module === "rental").length },
    { module: "accommodation", label: "Alojamiento",         count: accommodations.length, docCount: documents.filter((d) => d.module === "accommodation").length },
    { module: "itinerary",     label: "Itinerario",          count: itinerary.length,      docCount: documents.filter((d) => d.module === "itinerary").length },
    { module: "vault",         label: "Bóveda de Docs",      count: documents.filter((d) => d.module === "vault").length, docCount: documents.filter((d) => d.module === "vault").length },
  ];

  const moduleBreakdown = modules.map((m) => ({
    module: m.module,
    label: m.label,
    hasDocuments: m.docCount > 0 || m.count > 0,
    documentCount: m.docCount,
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
