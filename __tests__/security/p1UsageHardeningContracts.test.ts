import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("P1 Convex usage hardening contracts", () => {
  it("bounds notification dedupe history while retaining newest-active selection", () => {
    const notifications = read("convex/notifications.ts");
    const schema = read("convex/schema.ts");
    const start = notifications.indexOf("async function findActiveNotificationByDedupeKey");
    const end = notifications.indexOf("\n}\n", start) + 3;
    const lookup = notifications.slice(start, end);

    expect(schema).toContain('.index("by_dedupeKey_and_createdAt", ["dedupeKey", "createdAt"])');
    expect(lookup).toContain(".withIndex(\"by_dedupeKey_and_createdAt\"");
    expect(lookup).toContain('.order("desc")');
    expect(lookup).toContain(".take(DEDUPE_LOOKUP_LIMIT)");
    expect(lookup).not.toContain(".collect()");
    expect(lookup).toContain("find(isNotificationActive)");
  });

  it("fails closed when Better Auth returns a repeated pagination cursor", () => {
    const source = read("convex/demoSeed.ts");
    const start = source.indexOf("async function listBetterAuthUsersByDomain");
    const end = source.indexOf("\n}\n", start) + 3;
    const listing = source.slice(start, end);

    expect(listing).toContain("const seenCursors = new Set<string>()");
    expect(listing).toContain("seenCursors.has(cursorKey)");
    expect(listing).toContain("pagination made no progress");
    expect(listing).toContain("String(next) === cursorKey");
  });

  it("does not close a live broadcast offer or self-multiply early jobs", () => {
    const source = read("convex/matchroomBroadcast.ts");
    const start = source.indexOf("async function expireBroadcastCounterOfferInternal");
    const end = source.indexOf("\nexport const expireBroadcastFanout", start);
    const expiry = source.slice(start, end);

    expect(expiry).toContain("const expiresAt = Number(offer.expiresAt || offer.responseExpiresAt || 0)");
    expect(expiry).toContain('reason: "missing_expiry"');
    expect(expiry).toContain('reason: "not_due"');
    expect(expiry).toContain("if (expiresAt > now)");
    expect(expiry).not.toContain("ctx.scheduler.runAt");

    // The expiry mutation must perform its close only after the due-time guard.
    expect(expiry.indexOf("if (expiresAt > now)")).toBeLessThan(
      expiry.indexOf("closeBroadcastOfferRequest"),
    );
  });

  it("makes the zone-offer scheduling migration idempotent", () => {
    const schema = read("convex/schema.ts");
    const migrations = read("convex/migrations.ts");
    const start = migrations.indexOf("export const scheduleExistingZoneOfferExpiries");
    const end = migrations.indexOf("export const runScheduleExistingZoneOfferExpiries", start);
    const migration = migrations.slice(start, end);

    expect(schema).toContain("expiryScheduledAt: v.optional(v.number())");
    expect(schema).toContain("expiryScheduledFnId: v.optional(v.string())");
    expect(migration).toContain("offer.expiryScheduledAt");
    expect(migration).toContain("offer.expiryScheduledFnId");
    expect(migration).toContain("expiryScheduledFnId: String(expiryScheduledFnId)");
  });
});
