import { Router, type IRouter, type Request } from "express";
import { and, eq, lt, ne } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import bcrypt from "bcryptjs";
import {
  db,
  usersTable,
  tripsTable,
  itineraryItemsTable,
  flightsTable,
  accommodationsTable,
} from "@workspace/db";
import { userUploadDir } from "../lib/free-plan";
import { DEMO_SESSION_MAX_AGE, SESSION_COOKIE_NAME } from "../lib/session";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const DEMO_STALE_MARGIN_MS = 30 * 60 * 1000;
const DEMO_RATE_WINDOW_MS = 10 * 60 * 1000;
const DEMO_RATE_LIMIT = 5;
const DEMO_RATE_BUCKET_LIMIT = 4096;
const accountCreationBuckets = new Map<string, { count: number; resetAt: number }>();

function allowDemoAccountCreation(ipAddress: string): boolean {
  const now = Date.now();
  for (const [key, bucket] of accountCreationBuckets) {
    if (bucket.resetAt <= now) accountCreationBuckets.delete(key);
  }

  const key = `demo:${ipAddress}`;
  let bucket = accountCreationBuckets.get(key);
  if (!bucket) {
    if (accountCreationBuckets.size >= DEMO_RATE_BUCKET_LIMIT) return false;
    bucket = { count: 0, resetAt: now + DEMO_RATE_WINDOW_MS };
    accountCreationBuckets.set(key, bucket);
  }

  if (bucket.count >= DEMO_RATE_LIMIT) return false;
  bucket.count += 1;
  return true;
}

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => (error ? reject(error) : resolve()));
  });
}

async function removeDemoUser(userId: number, req: Request): Promise<void> {
  const [deleted] = await db
    .delete(usersTable)
    .where(and(eq(usersTable.id, userId), eq(usersTable.role, "demo")))
    .returning({ id: usersTable.id });

  if (deleted) {
    await fs.rm(userUploadDir(deleted.id), { recursive: true, force: true }).catch((error: unknown) => {
      req.log.warn({ error }, "Unable to remove demo upload folder");
    });
  }
}

async function cleanupStaleDemos(preserveUserId?: number): Promise<void> {
  const expiresBefore = new Date(Date.now() - DEMO_SESSION_MAX_AGE - DEMO_STALE_MARGIN_MS);
  const stale = await db
    .delete(usersTable)
    .where(preserveUserId === undefined
      ? and(eq(usersTable.role, "demo"), lt(usersTable.createdAt, expiresBefore))
      : and(
          eq(usersTable.role, "demo"),
          lt(usersTable.createdAt, expiresBefore),
          ne(usersTable.id, preserveUserId),
        ))
    .returning({ id: usersTable.id });

  await Promise.all(stale.map(async ({ id }) => {
    await fs.rm(userUploadDir(id), { recursive: true, force: true }).catch((error: unknown) => {
      logger.warn({ error }, "Unable to remove stale demo upload folder");
    });
  }));
}

const cleanupTimer = setInterval(() => {
  cleanupStaleDemos().catch((error: unknown) => {
    logger.warn({ error }, "Unable to clean up expired demo accounts");
  });
}, 30 * 60 * 1000);
cleanupTimer.unref();

function dateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

router.post("/auth/demo", async (req, res): Promise<void> => {
  if (req.body != null && (
    typeof req.body !== "object" ||
    Array.isArray(req.body) ||
    Object.keys(req.body).length > 0
  )) {
    res.status(400).json({ error: "Este endpoint no acepta datos de entrada" });
    return;
  }

  let existingDemo: { id: number; username: string } | undefined;
  if (req.session?.role === "demo" &&
    req.session.userId &&
    req.session.demoExpiresAt !== undefined &&
    req.session.demoExpiresAt > Date.now()) {
    const [user] = await db.select({ id: usersTable.id, username: usersTable.username })
      .from(usersTable)
      .where(and(eq(usersTable.id, req.session.userId), eq(usersTable.role, "demo")));
    existingDemo = user;
  }

  await cleanupStaleDemos(existingDemo?.id);

  if (existingDemo) {
    res.json({ id: existingDemo.id, username: existingDemo.username, role: "demo" });
    return;
  }

  const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
  if (!allowDemoAccountCreation(ipAddress)) {
    res.status(429).json({ error: "Demasiados intentos de acceso demo. Inténtalo más tarde." });
    return;
  }

  const username = `demo-${randomBytes(18).toString("hex")}`;
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
  const startDate = dateOffset(7);
  const endDate = dateOffset(10);
  const departure = new Date(`${startDate}T09:30:00.000Z`);
  const arrival = new Date(`${startDate}T17:45:00.000Z`);

  const demoUser = await db.transaction(async (tx) => {
    const [user] = await tx.insert(usersTable).values({
      username,
      passwordHash,
      role: "demo",
    }).returning({
      id: usersTable.id,
      username: usersTable.username,
      createdAt: usersTable.createdAt,
    });
    const [trip] = await tx.insert(tripsTable).values({
      ownerId: user.id,
      name: "Exploración de Tokio",
      destination: "Tokio, Japón",
      startDate,
      endDate,
      status: "upcoming",
      notes: "Viaje de muestra para explorar OffBunker.",
    }).returning({ id: tripsTable.id });

    await tx.insert(itineraryItemsTable).values([
      {
        tripId: trip.id,
        date: startDate,
        time: "10:00",
        title: "Llegada y traslado al hotel",
        description: "Deja el equipaje y tómate un momento para descansar.",
        location: "Shinjuku",
        category: "transport",
      },
      {
        tripId: trip.id,
        date: startDate,
        time: "18:30",
        title: "Paseo por Shinjuku",
        description: "Explora las calles y disfruta de una cena local.",
        location: "Shinjuku, Tokio",
        category: "activity",
      },
      {
        tripId: trip.id,
        date: dateOffset(8),
        time: "09:00",
        title: "Visita a Asakusa",
        description: "Recorre el templo Sensō-ji y sus alrededores.",
        location: "Asakusa, Tokio",
        category: "activity",
      },
    ]);

    await tx.insert(flightsTable).values({
      tripId: trip.id,
      airline: "Ejemplo Air",
      flightNumber: "EA 204",
      departureAirport: "LAX",
      arrivalAirport: "HND",
      departureTime: departure,
      arrivalTime: arrival,
      terminal: "Muestra",
      gate: "—",
      seat: "—",
      notes: "Datos ficticios de demostración.",
    });

    await tx.insert(accommodationsTable).values({
      tripId: trip.id,
      name: "Hotel de muestra en Shinjuku",
      type: "hotel",
      bookingPlatform: "Ejemplo",
      address: "Shinjuku, Tokio, Japón",
      checkIn: new Date(`${startDate}T15:00:00.000Z`),
      checkOut: new Date(`${endDate}T11:00:00.000Z`),
      confirmationCode: "DEMO-0000",
      notes: "Reserva ficticia para explorar la aplicación.",
    });

    return user;
  });

  const demoExpiresAt = demoUser.createdAt.getTime() + DEMO_SESSION_MAX_AGE;
  const remainingSessionMs = demoExpiresAt - Date.now();
  if (remainingSessionMs <= 0) {
    await removeDemoUser(demoUser.id, req);
    res.status(500).json({ error: "No se pudo crear la sesión demo" });
    return;
  }

  let sessionRegenerated = false;
  try {
    await regenerateSession(req);
    sessionRegenerated = true;
    req.session.userId = demoUser.id;
    req.session.username = demoUser.username;
    req.session.role = "demo";
    req.session.demoExpiresAt = demoExpiresAt;
    req.session.cookie.maxAge = remainingSessionMs;
    await saveSession(req);
  } catch (error) {
    if (sessionRegenerated) await destroySession(req).catch(() => undefined);
    await removeDemoUser(demoUser.id, req).catch((cleanupError: unknown) => {
      req.log.error({ error: cleanupError }, "Unable to roll back failed demo session");
    });
    req.log.error({ error }, "Unable to create demo session");
    res.status(500).json({ error: "No se pudo crear la sesión demo" });
    return;
  }

  res.status(201).json({ id: demoUser.id, username: demoUser.username, role: "demo" });
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const body: unknown = req.body;
  if (
    body == null ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => key !== "username" && key !== "password")
  ) {
    res.status(400).json({ error: "Solo se admiten los campos usuario y contraseña" });
    return;
  }

  if (req.session?.userId && req.session.role !== "demo") {
    res.status(409).json({ error: "Ya has iniciado sesión con una cuenta" });
    return;
  }

  const input = body as { username?: unknown; password?: unknown };
  if (typeof input.username !== "string" || typeof input.password !== "string") {
    res.status(400).json({ error: "Usuario y contraseña son obligatorios" });
    return;
  }

  const username = input.username.trim();
  if (username.length < 3 || username.length > 32) {
    res.status(400).json({ error: "El usuario debe tener entre 3 y 32 caracteres" });
    return;
  }
  if (input.password.length < 8 || input.password.length > 128) {
    res.status(400).json({ error: "La contraseña debe tener entre 8 y 128 caracteres" });
    return;
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  let account: { id: number; username: string };
  try {
    const [created] = await db.insert(usersTable).values({
      username,
      passwordHash,
      role: "user",
    }).returning({ id: usersTable.id, username: usersTable.username });
    account = created;
  } catch (error) {
    const dbError = error as {
      code?: string;
      constraint?: string;
      cause?: { code?: string; constraint?: string };
    };
    const violation = dbError.cause ?? dbError;
    if (violation.code === "23505" && violation.constraint === "users_username_key") {
      res.status(409).json({ error: "Ese nombre de usuario ya está en uso" });
      return;
    }
    throw error;
  }

  const previousDemoId = req.session?.role === "demo" ? req.session.userId : undefined;
  let sessionRegenerated = false;
  try {
    await regenerateSession(req);
    sessionRegenerated = true;
    req.session.userId = account.id;
    req.session.username = account.username;
    req.session.role = "user";
    delete req.session.demoExpiresAt;
    await saveSession(req);
  } catch (error) {
    if (sessionRegenerated) await destroySession(req).catch(() => undefined);
    await db.delete(usersTable)
      .where(and(eq(usersTable.id, account.id), eq(usersTable.role, "user")))
      .catch((cleanupError: unknown) => {
        req.log.error({ error: cleanupError, userId: account.id }, "Unable to roll back failed registration");
      });
    req.log.error({ error }, "Unable to create registered user session");
    res.status(500).json({ error: "No se pudo iniciar la sesión de la nueva cuenta" });
    return;
  }

  if (previousDemoId) {
    await removeDemoUser(previousDemoId, req).catch((error: unknown) => {
      req.log.error({ error }, "Unable to remove demo account after registration");
    });
  }
  res.status(201).json({ id: account.id, username: account.username, role: "user" });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (!username?.trim() || !password) {
    res.status(400).json({ error: "Usuario y contraseña son obligatorios" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username.trim()));

  if (!user || user.role === "demo" || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Credenciales incorrectas" });
    return;
  }

  if (req.session?.role === "demo" && req.session.userId) {
    const oldDemoId = req.session.userId;
    try {
      await regenerateSession(req);
      await removeDemoUser(oldDemoId, req);
    } catch (error) {
      req.log.error({ error }, "Unable to end demo session during login");
      res.status(500).json({ error: "No se pudo cerrar la sesión demo" });
      return;
    }
  }

  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.role = user.role;

  res.json({ id: user.id, username: user.username, role: user.role });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const demoUserId = req.session?.role === "demo" ? req.session.userId : undefined;
  let logoutError: unknown;
  try {
    await destroySession(req);
  } catch (error) {
    logoutError = error;
    req.log.error({ error }, "Unable to destroy session during logout");
  }
  if (demoUserId) {
    try {
      await removeDemoUser(demoUserId, req);
    } catch (error) {
      logoutError ??= error;
      req.log.error({ error }, "Unable to remove demo account during logout");
    }
  }

  res.clearCookie(SESSION_COOKIE_NAME, { httpOnly: true, secure: true, sameSite: "lax" });
  if (logoutError) {
    res.status(500).json({ error: "Error al cerrar sesión" });
    return;
  }
  res.json({ ok: true });
});

router.get("/auth/me", (req, res): void => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  if (req.session.role === "demo" &&
    (!req.session.demoExpiresAt || req.session.demoExpiresAt <= Date.now())) {
    res.status(401).json({ error: "La sesión demo ha expirado" });
    return;
  }
  res.json({
    id: req.session.userId,
    username: req.session.username,
    role: req.session.role,
  });
});

export default router;
