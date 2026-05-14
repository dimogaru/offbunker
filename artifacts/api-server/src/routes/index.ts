import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tripsRouter from "./trips";
import flightsRouter from "./flights";
import parkingRouter from "./parking";
import rentalsRouter from "./rentals";
import accommodationsRouter from "./accommodations";
import itineraryRouter from "./itinerary";
import documentsRouter from "./documents";

const router: IRouter = Router();

router.use(healthRouter);
router.use(tripsRouter);
router.use(flightsRouter);
router.use(parkingRouter);
router.use(rentalsRouter);
router.use(accommodationsRouter);
router.use(itineraryRouter);
router.use(documentsRouter);

export default router;
