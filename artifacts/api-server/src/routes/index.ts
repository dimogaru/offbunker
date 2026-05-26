import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import tripsRouter from "./trips";
import flightsRouter from "./flights";
import parkingRouter from "./parking";
import rentalsRouter from "./rentals";
import accommodationsRouter from "./accommodations";
import itineraryRouter from "./itinerary";
import documentsRouter from "./documents";
import baggageRouter from "./baggage";
import shareRouter from "./share";
import uploadsRouter from "./uploads";
import { getTripAccess } from "../lib/trip-access";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);

/* ─── Trip access middleware ───────────────────────────────── */
// Runs before all /trips/:tripId/* routes.
// Validates that the current user owns or has been shared the trip,
// and blocks write operations for "view"-only shares.
router.use("/trips/:tripId", async (req, res, next) => {
  const tripId = parseInt(req.params.tripId, 10);
  if (isNaN(tripId) || tripId <= 0) {
    res.status(400).json({ error: "tripId inválido" });
    return;
  }

  const userId = req.session?.userId;
  if (!userId) {
    // Should not happen — global auth guard fires first, but be defensive
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const access = await getTripAccess(tripId, userId);
  if (!access) {
    res.status(404).json({ error: "Viaje no encontrado o sin acceso" });
    return;
  }

  if (
    ["POST", "PATCH", "DELETE"].includes(req.method) &&
    access.permission === "view"
  ) {
    res.status(403).json({
      error: "Solo lectura: no tienes permisos de edición en este viaje",
    });
    return;
  }

  (req as unknown as Record<string, unknown>).tripAccess = access;
  next();
});

/* ─── Feature routers ──────────────────────────────────────── */
router.use(tripsRouter);
router.use(flightsRouter);
router.use(parkingRouter);
router.use(rentalsRouter);
router.use(accommodationsRouter);
router.use(itineraryRouter);
router.use(documentsRouter);
router.use(baggageRouter);
router.use(shareRouter);
router.use(uploadsRouter);

export default router;
