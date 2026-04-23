import process from "node:process";
import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
if (!CONVEX_URL) {
  console.error("Missing EXPO_PUBLIC_CONVEX_URL (or CONVEX_URL).");
  process.exit(1);
}

const seedKey = process.argv[2];
if (!seedKey) {
  console.error('Usage: node scripts/seed-demo-data.mjs "<seedKey>"');
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

  const res = await client.action("demoSeed:seedDemoData", {
    seedKey,
    cursor,
    batchSize: 1,
    maxMs: 15000,
  });

  console.log(
    JSON.stringify(
      {
        ok: res?.ok,
        done: res?.done,
        cursor: res?.cursor,
      },
      null,
      2
    )
  );

  if (res?.done) break;
  cursor = res?.cursor || cursor;
}

console.log("Demo seed completed. Run: node scripts/export-demo-data.mjs");
