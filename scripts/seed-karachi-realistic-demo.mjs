import process from "node:process";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
if (!CONVEX_URL) {
  console.error("Missing EXPO_PUBLIC_CONVEX_URL (or CONVEX_URL).");
  process.exit(1);
}

const deployment = String(process.env.CONVEX_DEPLOYMENT || "").trim();
if (!deployment.startsWith("dev:")) {
  console.error(
    "Refusing to run: this seed script requires a local/dev deployment (CONVEX_DEPLOYMENT must start with \"dev:\")."
  );
  process.exit(1);
}

const seedKey = process.argv[2];
if (!seedKey) {
  console.error('Usage: node scripts/seed-karachi-realistic-demo.mjs "<seedKey>" [xlsxPath]');
  process.exit(1);
}

const xlsxPath = process.argv[3] || path.join(process.cwd(), "matchhai_karachi_realistic_demo_players.xlsx");

let xlsx;
try {
  const mod = await import("xlsx");
  xlsx = mod.default || mod;
} catch (err) {
  console.error("Missing dependency: xlsx. Run: npm i -D xlsx");
  throw err;
}

const wb = xlsx.readFile(xlsxPath);
const ws = wb.Sheets["All Players"];
if (!ws) {
  console.error('Could not find sheet "All Players" in:', xlsxPath);
  process.exit(1);
}

const rows = xlsx.utils.sheet_to_json(ws, { defval: "" });
if (!Array.isArray(rows) || rows.length === 0) {
  console.error("No rows found in All Players sheet.");
  process.exit(1);
}

const players = rows.map((r) => ({
  game: r["Game"],
  city: r["City"],
  country: r["Country"],
  fullName: r["Player Name"],
  username: r["Username"],
  email: r["Email (Demo)"],
  roleStyle: r["Preferred Role / Style"],
  skillTier: r["Skill Tier"],
  sourceType: r["Source Type"],
  notes: r["Notes"],
}));

const client = new ConvexHttpClient(CONVEX_URL);

let cursor = null;
let iterations = 0;
const totals = {
  playersCreated: 0,
  playersUpdated: 0,
  playersSkipped: 0,
  zoneAdmins: 0,
  zonesCreated: 0,
  zonesUpdated: 0,
  branches: 0,
  resourcesCreated: 0,
};

while (true) {
  iterations += 1;
  if (iterations > 5000) {
    throw new Error("Aborting: too many iterations (cursor did not converge).");
  }

  const res = await client.action("demoSeed:seedKarachiRealisticDemo", {
    seedKey,
    cursor,
    players,
    zoneCount: 50,
    batchSize: 10,
    maxMs: 15000,
  });

  console.log(
    JSON.stringify(
      {
        ok: res?.ok,
        done: res?.done,
        cursor: res?.cursor,
        counts: res?.counts,
        seedSource: res?.seedSource,
      },
      null,
      2
    )
  );

  if (res?.counts) {
    for (const [k, v] of Object.entries(res.counts)) {
      if (typeof v === "number" && Object.prototype.hasOwnProperty.call(totals, k)) {
        totals[k] += v;
      }
    }
  }

  if (res?.done) break;
  cursor = res?.cursor || cursor;
}

console.log(
  JSON.stringify(
    {
      ok: true,
      totals,
      defaultPassword: "Demo@123456",
      seedSource: "karachi_realistic_demo_2026",
    },
    null,
    2
  )
);

console.log("Karachi realistic demo seed completed.");
