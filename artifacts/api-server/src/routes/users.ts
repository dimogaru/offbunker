import { Router, type IRouter } from "express";
import { and, eq, ilike, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { requireAuth, requireSuperAdmin } from "../lib/auth-middleware.js";

const router: IRouter = Router();

router.get("/users/search", requireAuth, async (req, res): Promise<void> => {
  const q = ((req.query.q as string) ?? "").trim();
  if (!q) {
    res.json([]);
    return;
  }

  const users = await db
    .select({ id: usersTable.id, username: usersTable.username })
    .from(usersTable)
    .where(
      and(
        ilike(usersTable.username, `%${q}%`),
        ne(usersTable.id, req.session.userId!)
      )
    );

  res.json(users);
});

router.get("/users", requireSuperAdmin, async (_req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      role: usersTable.role,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(usersTable.createdAt);

  res.json(users);
});

router.post("/users", requireSuperAdmin, async (req, res): Promise<void> => {
  const { username, password, role = "user" } = req.body as {
    username?: string;
    password?: string;
    role?: string;
  };

  if (!username?.trim() || !password) {
    res.status(400).json({ error: "Usuario y contraseña son obligatorios" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const [user] = await db
      .insert(usersTable)
      .values({ username: username.trim(), passwordHash, role })
      .returning({
        id: usersTable.id,
        username: usersTable.username,
        role: usersTable.role,
        createdAt: usersTable.createdAt,
      });
    res.status(201).json(user);
  } catch {
    res.status(409).json({ error: "El nombre de usuario ya existe" });
  }
});

router.patch("/users/:userId", requireSuperAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId as string, 10);
  if (isNaN(userId) || userId <= 0) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }

  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  const updates: Record<string, unknown> = {};
  if (username?.trim()) updates.username = username.trim();
  if (password) updates.passwordHash = await bcrypt.hash(password, 12);

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nada que actualizar" });
    return;
  }

  try {
    const [user] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, userId))
      .returning({
        id: usersTable.id,
        username: usersTable.username,
        role: usersTable.role,
        createdAt: usersTable.createdAt,
      });

    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }
    res.json(user);
  } catch {
    res.status(409).json({ error: "El nombre de usuario ya existe" });
  }
});

router.delete("/users/:userId", requireSuperAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId as string, 10);
  if (isNaN(userId) || userId <= 0) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }

  if (userId === req.session.userId) {
    res.status(400).json({ error: "No puedes eliminarte a ti mismo" });
    return;
  }

  const [user] = await db
    .delete(usersTable)
    .where(eq(usersTable.id, userId))
    .returning({ id: usersTable.id });

  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }

  res.sendStatus(204);
});

export default router;
