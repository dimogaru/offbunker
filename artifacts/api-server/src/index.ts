import app from "./app";
import { logger } from "./lib/logger";
import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort?.trim()) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Ensure the connect-pg-simple session table exists.
// createTableIfMissing:true reads a .sql asset that esbuild doesn't bundle,
// so we create the table explicitly here before the server accepts any requests.
try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid"    varchar        NOT NULL COLLATE "default",
      "sess"   json           NOT NULL,
      "expire" timestamp(6)   NOT NULL
    );
  `);
  // Add PK only if it doesn't already exist
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'session_pkey'
      ) THEN
        ALTER TABLE "session"
          ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
          NOT DEFERRABLE INITIALLY IMMEDIATE;
      END IF;
    END $$;
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
  `);
} catch (err) {
  logger.error({ err }, "Failed to ensure session table — sessions may not persist");
}

// One-time migration: documents uploaded before the /api/uploads fix had URLs
// starting with /uploads/ which the proxy never routed to this server (→ 404).
// Rewrite them to /api/uploads/ so existing records work correctly.
try {
  const result = await db.execute(sql`
    UPDATE documents
    SET file_url = REPLACE(file_url, '/uploads/', '/api/uploads/')
    WHERE file_url LIKE '/uploads/%'
  `);
  const count = (result as { rowCount?: number }).rowCount ?? 0;
  if (count > 0) {
    logger.info({ count }, "Migrated document file_url paths to /api/uploads/");
  }
} catch (err) {
  logger.warn({ err }, "Could not run upload URL migration — skipping");
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
