import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());

// Serve uploaded files statically
const uploadsDir = path.join(process.cwd(), "uploads");
app.use("/uploads", express.static(uploadsDir));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

// Prevent browser/mobile HTTP caching of API responses so clients always
// get the latest data from the server (not a stale 304 / ETag hit).
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  next();
});

app.use("/api", router);

export default app;
