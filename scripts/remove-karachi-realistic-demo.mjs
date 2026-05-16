import process from "node:process";
import fs from "node:fs";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";

function loadDotEnvIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (!key) continue;
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

loadDotEnvIfPresent(path.join(process.cwd(), ".env.local"));
loadDotEnvIfPresent(path.join(process.cwd(), ".env"));

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
if (!CONVEX_URL) {
  console.error(
    "Missing EXPO_PUBLIC_CONVEX_URL (or CONVEX_URL). Set it in your shell or in .env.local."
  );
  process.exit(1);
}

const deployment = String(process.env.CONVEX_DEPLOYMENT || "").trim();
if (!deployment.startsWith("dev:")) {
  console.error(
    "Refusing to run: this cleanup script requires a local/dev deployment (CONVEX_DEPLOYMENT must start with \"dev:\")."
  );
  process.exit(1);
}

const seedKey = process.argv[2];
if (!seedKey) {
  console.error('Usage: node scripts/remove-karachi-realistic-demo.mjs "<seedKey>"');
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

let cursor = null;
let iterations = 0;

while (true) {
  iterations += 1;
  if (iterations > 5000) {
    throw new Error("Aborting: too many iterations (cursor did not converge).");
  }

  const res = await client.action("demoSeed:removeKarachiRealisticDemo", {
    seedKey,
    cursor,
    batchSize: 200,
    maxMs: 15000,
  });

  console.log(
    JSON.stringify(
      {
        ok: res?.ok,
        done: res?.done,
        cursor: res?.cursor,
        deleted: res?.deleted,
        seedSource: res?.seedSource,
      },
      null,
      2
    )
  );

  if (res?.done) break;
  cursor = res?.cursor || cursor;
}

console.log("Karachi realistic demo cleanup completed.");

