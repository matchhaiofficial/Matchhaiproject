import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "..", "..");
const convexRoot = path.join(root, "convex");

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function convexSources(dir = convexRoot, prefix = "") {
  const sources: Array<{ entry: string; source: string }> = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name.startsWith("_generated")) continue;
    const relative = prefix ? `${prefix}/${item.name}` : item.name;
    const absolute = path.join(dir, item.name);
    if (item.isDirectory()) {
      sources.push(...convexSources(absolute, relative));
    } else if (item.name.endsWith(".ts")) {
      sources.push({ entry: relative, source: fs.readFileSync(absolute, "utf8") });
    }
  }
  return sources;
}

describe("Convex usage-safety contracts", () => {
  it("does not clamp an overdue runAt deadline to now", () => {
    // `runAt(Math.max(Date.now(), dueAt), ...)` turns stale data into a tight
    // loop when the callback leaves the same dueAt in place. A past deadline
    // must be handled/advanced/terminated before another job is scheduled.
    const unsafe: string[] = [];
    for (const { entry, source } of convexSources()) {
      const matches = source.match(/ctx\.scheduler\.runAt\([\s\S]{0,220}?Math\.max\(Date\.now\(\),/g) || [];
      for (const match of matches) unsafe.push(`${entry}: ${match.replace(/\s+/g, " ").slice(0, 180)}`);
    }
    expect(unsafe).toEqual([]);
  });

  it("keeps self-rescheduling batch workers bounded and progressing", () => {
    const contracts = [
      ["convex/accountDeletion.ts", "Account deletion made no progress", "query.take(PAGE_SIZE)"],
      ["convex/easypaisa.ts", "STALE_PAYMENT_RECONCILE_COOLDOWN_MS", "result?.shouldRetry"],
      ["convex/matchroomBroadcast.ts", "currentDeadline > Date.now()", "reason: \"stale_timer\""],
      ["convex/scheduleIndexMigration.ts", "page.isDone", "page.continueCursor === args.cursor"],
      ["convex/zones.ts", "page.isDone", "page.continueCursor === args.cursor"],
      ["convex/matchrooms.ts", "Matchroom-area notification pagination made no progress"],
      ["convex/zonePilot.ts", "Zone pilot scheduling pagination made no progress"],
    ] as const;

    for (const [file, ...markers] of contracts) {
      const source = read(file);
      for (const marker of markers) expect(source).toContain(marker);
    }
  });

  it("keeps maintenance sweeps feature-gated and batch-bounded", () => {
    const crons = read("convex/crons.ts");
    const requiredFlags = [
      "MATCHHAI_ENABLE_LIFECYCLE_CRON",
      "MATCHHAI_ENABLE_ZONE_PILOT_CRON",
      "MATCHHAI_ENABLE_ZONE_BOOKING_EXPIRY_CRON",
      "MATCHHAI_ENABLE_PAYMENT_RECONCILER_CRON",
      "MATCHHAI_ENABLE_TEAM_CHALLENGE_EXPIRY_CRON",
    ];
    for (const flag of requiredFlags) expect(crons).toContain(flag);

    const sweepSources = [
      read("convex/matchrooms.ts"),
      read("convex/teamChallenges.ts"),
      read("convex/zoneAdminBooking.ts"),
      read("convex/zonePilot.ts"),
      read("convex/easypaisa.ts"),
    ];
    for (const source of sweepSources) {
      expect(source).toMatch(/Math\.min\([^\n]*(?:batchSize|remaining|limit)/);
    }
  });

  it("does not use unbounded collection reads in runtime maintenance workers", () => {
    const workerFiles = [
      "convex/accountDeletion.ts",
      "convex/easypaisa.ts",
      "convex/matchroomBroadcast.ts",
      "convex/matchrooms.ts",
      "convex/teamChallenges.ts",
      "convex/zoneAdminBooking.ts",
      "convex/zonePilot.ts",
      "convex/zones.ts",
    ];
    for (const file of workerFiles) {
      const source = read(file);
      expect(source).not.toMatch(/export const (?:runLifecycleSweep|expireStaleChallenges|expireStaleBookingRequests|expireEndedPilots)[\s\S]{0,5000}\.collect\(\)/);
    }
  });
});
