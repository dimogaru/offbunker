import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { db, tripsTable, flightsTable, parkingTable, rentalsTable, accommodationsTable, itineraryItemsTable, documentsTable } from "@workspace/db";
import {
  ListTripsResponse,
  CreateTripBody,
  GetTripParams,
  GetTripResponse,
  UpdateTripParams,
  UpdateTripBody,
  UpdateTripResponse,
  DeleteTripParams,
  GetTripProgressParams,
  GetTripProgressResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

/* ─── Cover-image helper ─────────────────────────────────────── */

const coversDir = path.join(process.cwd(), "uploads", "covers");

/**
 * If `url` is an external HTTP(S) URL, download the image and store it
 * under /uploads/covers/, returning the local /api/uploads/covers/... path.
 *
 * Returns the original local path unchanged if already local.
 * Returns null if the download fails (caller should fall back to null cover).
 */
async function localizecover(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  // Already a local path — nothing to do.
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
  const trips = await db.select().from(tripsTable).orderBy(tripsTable.startDate);
  res.json(ListTripsResponse.parse(trips));
});

router.post("/trips", async (req, res): Promise<void> => {
  const parsed = CreateTripBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { coverImage, notes, ...required } = parsed.data;
  // Download external cover images so the app works fully offline.
  const localCover = await localizecover(coverImage);
  if (coverImage && !localCover) {
    req.log.warn({ coverImage }, "Cover image download failed — storing null");
  }

  const [trip] = await db
    .insert(tripsTable)
    .values({ ...required, coverImage: localCover, notes: notes ?? null })
    .returning();

  res.status(201).json(GetTripResponse.parse(trip));
});

router.get("/trips/:tripId", async (req, res): Promise<void> => {
  const params = GetTripParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, params.data.tripId));
  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  res.json(GetTripResponse.parse(trip));
});

router.patch("/trips/:tripId", async (req, res): Promise<void> => {
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

  // Only download if a new (external) cover is being set in this update.
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

  const [trip] = await db
    .update(tripsTable)
    .set(updateData)
    .where(eq(tripsTable.id, params.data.tripId))
    .returning();

  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  res.json(UpdateTripResponse.parse(trip));
});

router.delete("/trips/:tripId", async (req, res): Promise<void> => {
  const params = DeleteTripParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [trip] = await db
    .delete(tripsTable)
    .where(eq(tripsTable.id, params.data.tripId))
    .returning();

  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
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

  const [flights, parkings, rentals, accommodations, itinerary, documents] = await Promise.all([
    db.select().from(flightsTable).where(eq(flightsTable.tripId, tripId)),
    db.select().from(parkingTable).where(eq(parkingTable.tripId, tripId)),
    db.select().from(rentalsTable).where(eq(rentalsTable.tripId, tripId)),
    db.select().from(accommodationsTable).where(eq(accommodationsTable.tripId, tripId)),
    db.select().from(itineraryItemsTable).where(eq(itineraryItemsTable.tripId, tripId)),
    db.select().from(documentsTable).where(eq(documentsTable.tripId, tripId)),
  ]);

  const modules = [
    { module: "flights",       label: "Logística Aérea",    count: flights.length,       docCount: documents.filter(d => d.module === "flights").length },
    { module: "parking",       label: "Estacionamiento",    count: parkings.length,       docCount: documents.filter(d => d.module === "parking").length },
    { module: "rental",        label: "Alquiler de Vehículo", count: rentals.length,      docCount: documents.filter(d => d.module === "rental").length },
    { module: "accommodation", label: "Alojamiento",        count: accommodations.length, docCount: documents.filter(d => d.module === "accommodation").length },
    { module: "itinerary",     label: "Itinerario",         count: itinerary.length,      docCount: documents.filter(d => d.module === "itinerary").length },
    { module: "vault",         label: "Bóveda de Docs",     count: documents.filter(d => d.module === "vault").length, docCount: documents.filter(d => d.module === "vault").length },
  ];

  const moduleBreakdown = modules.map(m => ({
    module: m.module,
    label: m.label,
    hasDocuments: m.docCount > 0 || m.count > 0,
    documentCount: m.docCount,
  }));

  const completedModules = moduleBreakdown.filter(m => m.hasDocuments).length;
  const totalModules = 6;
  const percentComplete = Math.round((completedModules / totalModules) * 100);

  res.json(GetTripProgressResponse.parse({
    tripId,
    totalModules,
    completedModules,
    percentComplete,
    moduleBreakdown,
  }));
});

export default router;
