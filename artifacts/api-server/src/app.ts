import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";
import { seedSuperAdmin } from "./lib/seed";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PgStore = (connectPgSimple as unknown as (s: typeof session) => new (o: Record<string, unknown>) => session.Store)(session);

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required");
}

const app: Express = express();

// Trust the Replit reverse proxy so secure cookies and IP headers work
app.set("trust proxy", 1);

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
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(cors({ origin: true, credentials: true }));

// Session middleware — must come before auth check and routes
app.use(
  session({
    store: new PgStore({
      pool: pool,
      createTableIfMissing: true,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: "travelhub.sid",
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    },
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files under /api/uploads/ (GET/HEAD only — no auth needed)
const uploadsDir = path.join(process.cwd(), "uploads");
app.use("/api/uploads", express.static(uploadsDir));

// Cache-control headers for all API responses
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  next();
});

// Global auth guard — open: /healthz, /auth/*, /shared/*
app.use("/api", (req, res, next) => {
  const p = req.path;
  if (
    p === "/healthz" ||
    p.startsWith("/auth/") ||
    p.startsWith("/shared/")
  ) {
    return next();
  }
  if (!req.session?.userId) {
    res.status(401).json({ error: "No autenticado. Inicia sesión." });
    return;
  }
  next();
});

app.use("/api", router);

// Seed superadmin on startup (idempotent)
seedSuperAdmin().catch((err: unknown) => {
  logger.error({ err }, "Startup seed failed");
});

export default app;
