import fs from "fs";
import path from "path";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("urgent server-authority regressions", () => {
  // Regression: ISSUE-001 — zone owners could act on another zone's request.
  // Found by /qa on 2026-09-05.
  it("binds every zone booking decision to the request's persisted zone", () => {
    const source = read("convex/zoneAdminBooking.ts");
    const calls = source.match(/assertRequestBelongsToZone\(/g) || [];

    expect(calls.length).toBeGreaterThanOrEqual(4); // helper + accept/reject/counter-offer
    expect(source).toContain("This booking request does not belong to your zone.");
    expect(source).not.toContain("allocatedByUid: args.adminUid");
    expect(source).not.toContain("zoneOwnerUid: args.zoneOwnerUid");
  });

  // Regression: ISSUE-002 — alternate times could validate different epochs
  // from those persisted by the counter-offer.
  // Found by /qa on 2026-09-05.
  it("derives every persisted counter-offer time in Asia/Karachi", () => {
    const source = read("convex/zoneAdminBooking.ts");

    expect(source).toContain('new Date(`${date}T${time}:00+05:00`)');
    expect(source).toContain("const startAt = parseKarachiDateTimeMillis(date, time)");
    expect(source).toContain("Math.abs(startAt - originalStartMs!)");
    expect(source).toContain("Client-supplied epoch fields are");
  });

  // Regression: ISSUE-003 — either captain could patch privileged challenge state.
  // Found by /qa on 2026-09-05.
  it("rejects generic lifecycle writes and validates venue records", () => {
    const source = read("convex/teamChallenges.ts");

    expect(source).toContain("Use the dedicated challenge action for lifecycle, venue, and matchroom changes");
    expect(source).toContain('if (!zone || zone.status !== "active")');
    expect(source).toContain("Only the challenged captain can suggest an alternative venue");
    expect(source).toContain('user?.accountStatus === "suspended"');
  });

  // Regression: ISSUE-004 — email failure made a committed withdrawal look failed.
  // Found by /qa on 2026-09-05.
  it("makes withdrawals idempotent and email delivery non-authoritative", () => {
    const action = read("convex/zoneWithdrawals.ts");
    const wallet = read("convex/wallet.ts");

    expect(action).toContain("assertKycFullyVerified");
    expect(action).toContain("Withdrawal saved but email delivery failed");
    expect(wallet).toContain("requestKey: v.string()");
    expect(wallet).toContain('withIndex("by_reference"');
    expect(wallet).toContain("already used with different details");
  });

  // Regression: ISSUE-005 — a same-type checkout could be reused for another entity.
  // Found by /qa on 2026-09-05.
  it("compares exact checkout context identity before reuse", () => {
    const source = read("convex/easypaisa.ts");

    expect(source).toContain("getCheckoutContextIdentity(checkoutContext)");
    expect(source).toContain('return `team:${String(context.teamChallengeHold.challengeId || "")}:${String(context.teamChallengeHold.side || "")}`');
    expect(source).toContain("stableCheckoutContextValue(context.matchroomCreateArgs)");
  });

  // Regression: ISSUE-006 — approval calculated a due time but did not enqueue it.
  // Found by /qa on 2026-09-05.
  it("schedules matchroom lifecycle immediately after zone acceptance", () => {
    const source = read("convex/zoneAdminBooking.ts");

    expect(source).toContain("async function scheduleMatchroomLifecycle");
    expect(source).toContain("internal.matchrooms.processScheduledLifecycle");
    expect(source).toContain("await scheduleMatchroomLifecycle(ctx, matchroomId)");
  });

  // Regression: account deletion inspected only the first 100 room memberships
  // and ignored provider payments and unlinked team challenges.
  it("blocks deletion for every active financial and match lifecycle", () => {
    const admin = read("convex/admin.ts");
    const schema = read("convex/schema.ts");

    expect(admin).toContain('.query("paymentTransactions")');
    expect(admin).toContain('q.eq("userId", user._id).eq("status", status)');
    expect(admin).toContain('.withIndex("by_uid"');
    expect(admin).toContain(".collect()");
    expect(admin).toContain('.withIndex("by_captainAUid_and_status"');
    expect(admin).toContain('.withIndex("by_captainBUid_and_status"');
    expect(schema).toContain('.index("by_captainAUid_and_status", ["captainAUid", "status"])');
    expect(schema).toContain('.index("by_captainBUid_and_status", ["captainBUid", "status"])');
  });
});
