import fs from "fs";
import path from "path";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("critical server-side state-machine boundaries", () => {
  it("authorizes zone resources and migrations against the session owner", () => {
    const resources = read("convex/zoneAdminResources.ts");
    const migration = read("convex/zoneBranchMigration.ts");
    const zones = read("convex/zones.ts");

    expect(resources).toContain("requireOwnedZone(ctx, args.zoneId)");
    expect(resources).toContain("requireOwnedZone(ctx, resource.zoneId)");
    expect(resources).not.toContain("actorUid: args.adminUid");
    expect(migration).toContain("requireOwnedZone(ctx, args.zoneId)");
    expect(migration).not.toContain("actorUid: args.ownerUid");
    expect(zones).toContain('String(zone.status || "") !== "active"');
    expect(zones).toContain("await requireSuperAdmin(ctx)");
  });

  it("reserves withdrawals immediately and keeps payout details off list responses", () => {
    const wallet = read("convex/wallet.ts");
    const admin = read("convex/admin.ts");
    const email = read("convex/zoneWithdrawals.ts");

    expect(wallet).toContain("walletBalance: walletBalance - amount");
    expect(wallet).toContain("fundsReservedAt: now");
    expect(admin).toContain("getZoneWithdrawalPayoutDetails");
    expect(email).toContain("Account number (masked)");
    expect(email).not.toContain("Account number: ${accountNumberRaw}");
  });

  it("settles venue funds only after a resolved result and clearing period", () => {
    const matchrooms = read("convex/matchrooms.ts");

    expect(matchrooms).toContain("settleVenuePayoutAfterResult");
    expect(matchrooms).toContain("venuePayoutEligibleAt");
    expect(matchrooms).not.toContain("chooseRandomWinner");
  });

  it("uses targeted scheduled recovery for payments and room expiry", () => {
    const payments = read("convex/easypaisa.ts");
    const matchrooms = read("convex/matchrooms.ts");
    const challenges = read("convex/teamChallenges.ts");
    const crons = read("convex/crons.ts");

    expect(payments).toContain("reconcilePaymentByOrderRef");
    expect(matchrooms).toContain("processScheduledLifecycle");
    expect(challenges).toContain("processScheduledExpiry");
    expect(challenges).toContain('withIndex("by_captainAUid_and_createdAt"');
    expect(challenges).not.toContain('q.eq(q.field("captainAUid"), userId)');
    expect(crons).toContain('{ minutes: 30 }');
    expect(crons).toContain('{ hours: 6 }');
  });
});
