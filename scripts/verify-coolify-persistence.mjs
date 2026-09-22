import { createHash, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const requireFromDb = createRequire(
  new URL("../lib/db/package.json", import.meta.url),
);
const { Client } = requireFromDb("pg");

const args = process.argv.slice(2);
if (args[0] === "--") args.shift();
const [mode, suppliedToken] = args;
const databaseUrl = process.env.DATABASE_URL;
const uploadsDir = process.env.UPLOADS_DIR;

if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (!uploadsDir) throw new Error("UPLOADS_DIR is required");
if (!["prepare", "verify"].includes(mode)) {
  throw new Error("Usage: pnpm run verify:coolify-persistence -- <prepare|verify> [token]");
}

const token = suppliedToken || randomBytes(24).toString("hex");
if (mode === "verify" && !suppliedToken) {
  throw new Error("The token printed by the prepare step is required");
}
if (!/^[a-f0-9]{48}$/.test(token)) throw new Error("Invalid verification token");

const markerDir = path.join(path.resolve(uploadsDir), ".persistence-checks");
const markerPath = path.join(markerDir, token);
const expectedContents = `offbunker-persistence-check:${token}\n`;
const expectedHash = createHash("sha256").update(expectedContents).digest("hex");
const sessionId = `persistence-check:${token}`;
const client = new Client({ connectionString: databaseUrl });

await client.connect();
try {
  if (mode === "prepare") {
    await mkdir(markerDir, { recursive: true });
    await writeFile(markerPath, expectedContents, { flag: "wx" });
    await client.query(
      `INSERT INTO "session" (sid, sess, expire)
       VALUES ($1, $2::json, now() + interval '1 day')`,
      [sessionId, JSON.stringify({ persistenceCheck: true, fileSha256: expectedHash })],
    );
    process.stdout.write(
      `Persistence markers created.\nToken: ${token}\nRestart or redeploy, then run the verify step with this token.\n`,
    );
  } else {
    const result = await client.query(
      `SELECT sess->>'fileSha256' AS file_sha256
       FROM "session" WHERE sid = $1`,
      [sessionId],
    );
    if (result.rowCount !== 1) throw new Error("Database marker was not preserved");

    const contents = await readFile(markerPath, "utf8");
    const actualHash = createHash("sha256").update(contents).digest("hex");
    if (actualHash !== result.rows[0].file_sha256 || actualHash !== expectedHash) {
      throw new Error("Upload marker was not preserved intact");
    }

    await client.query(
      `DELETE FROM "session" WHERE sid = $1`,
      [sessionId],
    );
    await rm(markerPath);
    process.stdout.write(
      "Persistence verified: PostgreSQL data and uploaded files survived the restart.\n",
    );
  }
} finally {
  await client.end();
}