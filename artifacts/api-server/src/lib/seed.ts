import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { logger } from "./logger.js";

const ADMIN_USERNAME = "52557586X";
const ADMIN_PASSWORD = "52557586X";

export async function seedSuperAdmin(): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, ADMIN_USERNAME));

    if (existing) return;

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await db.insert(usersTable).values({
      username: ADMIN_USERNAME,
      passwordHash,
      role: "superadmin",
    });
    logger.info("Superadmin user created");
  } catch (err) {
    logger.error({ err }, "Failed to seed superadmin");
  }
}
