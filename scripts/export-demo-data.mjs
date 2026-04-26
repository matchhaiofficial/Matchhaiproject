import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
if (!CONVEX_URL) {
  console.error("Missing EXPO_PUBLIC_CONVEX_URL (or CONVEX_URL).");
  process.exit(1);
}

const outDir = path.join(process.cwd(), "demo-data");
await fs.mkdir(outDir, { recursive: true });

const client = new ConvexHttpClient(CONVEX_URL);

const exportData = await client.query("demoSeed:exportDemoData", {});

function toCsv(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return "";
  const headers = Array.from(
    rows.reduce((acc, row) => {
      Object.keys(row || {}).forEach((k) => acc.add(k));
      return acc;
    }, new Set())
  );
  const escape = (value) => {
    const s = value == null ? "" : String(value);
    if (/[\",\\n]/.test(s)) return `"${s.replace(/\"/g, "\"\"")}"`;
    return s;
  };
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((row) => headers.map((h) => escape(row?.[h])).join(",")),
  ];
  return lines.join("\n");
}

function writeJson(name, value) {
  return fs.writeFile(path.join(outDir, name), JSON.stringify(value, null, 2), "utf8");
}

function writeCsv(name, rows) {
  return fs.writeFile(path.join(outDir, name), toCsv(rows), "utf8");
}

await Promise.all([
  writeJson("players.json", exportData.players),
  writeJson("zoneAdmins.json", exportData.zoneAdmins),
  writeJson("teams.json", exportData.teams),
  writeJson("matchrooms.json", exportData.matchrooms),
  writeCsv("players.csv", exportData.players),
  writeCsv("zoneAdmins.csv", exportData.zoneAdmins),
  writeCsv("teams.csv", exportData.teams),
  writeCsv("matchrooms.csv", exportData.matchrooms),
]);

const demoMdLines = [];
demoMdLines.push("# MatchHai Demo Seed Export");
demoMdLines.push("");
demoMdLines.push(`- Generated at: ${new Date().toISOString()}`);
demoMdLines.push(`- Convex URL: ${CONVEX_URL}`);
demoMdLines.push(`- Shared password (all demo accounts): \`${exportData.password}\``);
demoMdLines.push("");

demoMdLines.push("## Super Admin");
if (exportData.superAdmin) {
  demoMdLines.push(`- Email: \`${exportData.superAdmin.email}\``);
  demoMdLines.push(`- Username: \`${exportData.superAdmin.username}\``);
  demoMdLines.push(`- Password: \`${exportData.password}\``);
} else {
  demoMdLines.push("- Not present (run seed first).");
}
demoMdLines.push("");

demoMdLines.push("## Players");
demoMdLines.push(`- Count: ${exportData.players.length}`);
demoMdLines.push("");
demoMdLines.push("| # | Email | Username | Full name | Games | Friends |");
demoMdLines.push("|---:|---|---|---|---|---:|");
exportData.players.forEach((p, idx) => {
  const games = Array.isArray(p.games) ? p.games.join(", ") : "";
  demoMdLines.push(`| ${idx + 1} | \`${p.email}\` | \`${p.username}\` | ${p.fullName} | ${games} | ${p.friendCount} |`);
});
demoMdLines.push("");

demoMdLines.push("## Zone Admins / Venues");
demoMdLines.push(`- Count: ${exportData.zoneAdmins.length}`);
demoMdLines.push("");
demoMdLines.push("| # | Email | Username | Venue | City | ZoneId | Branches |");
demoMdLines.push("|---:|---|---|---|---|---|---:|");
exportData.zoneAdmins.forEach((z, idx) => {
  const zoneId = z.zoneId ? `\`${z.zoneId}\`` : "";
  const branches = Array.isArray(z.branches) ? z.branches.length : 0;
  demoMdLines.push(`| ${idx + 1} | \`${z.email}\` | \`${z.username}\` | ${z.venueBrandName || ""} | ${z.city || ""} | ${zoneId} | ${branches} |`);
});
demoMdLines.push("");

demoMdLines.push("## Teams");
demoMdLines.push(`- Count: ${exportData.teams.length}`);
demoMdLines.push("");
demoMdLines.push("| # | Name | Tag | Game | Captain | Members | TeamId |");
demoMdLines.push("|---:|---|---|---|---|---:|---|");
exportData.teams.forEach((t, idx) => {
  demoMdLines.push(`| ${idx + 1} | ${t.name} | ${t.tag || ""} | ${t.game} | \`${t.captainUid}\` | ${t.memberCount}/${t.maxMembers} | \`${t.teamId}\` |`);
});
demoMdLines.push("");

demoMdLines.push("## Matchrooms");
demoMdLines.push(`- Count: ${exportData.matchrooms.length}`);
demoMdLines.push("");
demoMdLines.push("| # | MatchCode | Game | Title | Venue(zoneId) | Start | Host | MatchroomId |");
demoMdLines.push("|---:|---|---|---|---|---|---|---|");
exportData.matchrooms.forEach((m, idx) => {
  const start = m.scheduledStartAt ? new Date(m.scheduledStartAt).toISOString() : "";
  demoMdLines.push(
    `| ${idx + 1} | \`${m.matchCode || ""}\` | ${m.game} | ${m.title} | \`${m.zoneId || ""}\` | ${start} | \`${m.hostUid}\` | \`${m.matchroomId}\` |`
  );
});
demoMdLines.push("");

demoMdLines.push("## Full exports");
demoMdLines.push("- `demo-data/players.json` + `demo-data/players.csv`");
demoMdLines.push("- `demo-data/zoneAdmins.json` + `demo-data/zoneAdmins.csv`");
demoMdLines.push("- `demo-data/teams.json` + `demo-data/teams.csv`");
demoMdLines.push("- `demo-data/matchrooms.json` + `demo-data/matchrooms.csv`");
demoMdLines.push("");

await fs.writeFile(path.join(process.cwd(), "DEMO_DATA.md"), demoMdLines.join("\n"), "utf8");

console.log("Wrote DEMO_DATA.md and demo-data/* exports.");

