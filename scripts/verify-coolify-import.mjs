import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const requireFromDb = createRequire(
  new URL("../lib/db/package.json", import.meta.url),
);
const { Client } = requireFromDb("pg");

const args = process.argv.slice(2);
if (args[0] === "--") args.shift();
const [mode, snapshotPath = "offbunker-import-snapshot.json"] = args;
if (!["snapshot", "verify"].includes(mode)) {
  throw new Error(
    "Usage: pnpm run verify:coolify-import -- <snapshot|verify> [snapshot-file]",
  );
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!process.env.UPLOADS_DIR) throw new Error("UPLOADS_DIR is required");

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function databaseCounts() {
  await client.connect();
  try {
    const tables = await client.query(`
      SELECT tablename
      FROM pg_catalog.pg_tables
      WHERE schemaname = 'public' AND tablename <> 'session'
      ORDER BY tablename
    `);
    const counts = {};
    for (const { tablename } of tables.rows) {
      const escaped = tablename.replaceAll('"', '""');
      const result = await client.query(`SELECT count(*)::int AS count FROM "${escaped}"`);
      counts[tablename] = result.rows[0].count;
    }
    return counts;
  } finally {
    await client.end();
  }
}

async function fileManifest(root, current = root) {
  const entries = [];
  for (const name of (await readdir(current)).sort()) {
    if (name === ".gitkeep" || name === ".persistence-checks") continue;
    const absolute = path.join(current, name);
    const metadata = await stat(absolute);
    if (metadata.isDirectory()) {
      entries.push(...(await fileManifest(root, absolute)));
    } else if (metadata.isFile()) {
      const contents = await readFile(absolute);
      entries.push({
        path: path.relative(root, absolute),
        bytes: metadata.size,
        sha256: createHash("sha256").update(contents).digest("hex"),
      });
    }
  }
  return entries;
}

const actual = {
  databaseCounts: await databaseCounts(),
  uploads: await fileManifest(path.resolve(process.env.UPLOADS_DIR)),
};

if (mode === "snapshot") {
  await writeFile(snapshotPath, `${JSON.stringify(actual, null, 2)}\n`, {
    flag: "wx",
  });
  process.stdout.write(`Import snapshot written to ${snapshotPath}\n`);
} else {
  const expected = JSON.parse(await readFile(snapshotPath, "utf8"));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      "Imported database row counts or uploaded file hashes do not match the source snapshot",
    );
  }
  process.stdout.write(
    "Import verified: database row counts and uploaded file hashes match the source.\n",
  );
}