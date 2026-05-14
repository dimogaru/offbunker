import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
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
