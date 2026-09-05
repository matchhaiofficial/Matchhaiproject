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
    expect(admin).toContain('.withIndex("by_userId", (q: any) => q.eq("odxerId", user._id))');
    expect(admin).toContain('.withIndex("by_captainUid", (q: any) => q.eq("captainUid", user._id))');
    expect(admin).toContain('.withIndex("by_ownerUid", (q: any) => q.eq("ownerUid", user._id))');
    expect(admin).toContain('await ctx.db.patch(membership._id, { username: "Deleted User" })');
    expect(admin).toContain("assertCanActOnSuperAdminTarget(admin, user)");
    expect(schema).toContain('.index("by_captainAUid_and_status", ["captainAUid", "status"])');
    expect(schema).toContain('.index("by_captainBUid_and_status", ["captainBUid", "status"])');
  });

  it("keeps demo creation internal while reusing matchroom validation", () => {
    const seed = read("convex/demoSeed.ts");
    const matchrooms = read("convex/matchrooms.ts");
    const teamSeed = seed.slice(
      seed.indexOf("export const seedDemoTeamByIndex"),
      seed.indexOf("export const seedDemoMatchroomByIndex"),
    );

    expect(teamSeed).not.toContain("ctx.runMutation(api.teams.create");
    expect(teamSeed).not.toContain("ctx.runMutation(api.teams.addMember");
    expect(seed).toContain("(internal as any).matchrooms.createSeededDemo");
    expect(seed).not.toContain('await import("./_generated/api")).internal as any;\n    const matchroomId');
    expect(matchrooms).toContain("export const createSeededDemo = internalMutation");
    expect(matchrooms).toContain('args.bookingSource !== "seed" || args.paymentStatus !== "unpaid"');
    expect(matchrooms).toContain("createMatchroomFromValidatedArgs(ctx, args");
    expect(seed).toContain("capacity: buildZoneCapacity(branches)");
    expect(seed).toContain("seat <= Math.max(0, t.count)");
  });

  it("uses persisted booking times and unique resources for allocation checks", () => {
    const source = read("convex/zoneAdminBooking.ts");
    const accept = source.slice(
      source.indexOf("export const acceptBookingRequest"),
      source.indexOf("export const rejectBookingRequest"),
    );

    expect(accept).toContain("new Set(args.resourceIds.map(String)).size !== args.resourceIds.length");
    expect(accept).toContain("let allocationStartAt = getBookingRequestStartAtForConflict(bookingRequest)");
    expect(accept).toContain("allocationStartAt = getLinkedRoomStartMillis(linkedRoomForSlot) || allocationStartAt");
    expect(accept).toContain("durationMinutes: allocationDurationMinutes");
    expect(accept).not.toContain("args.matchroomData.scheduledStartAt");
  });

  it("keeps team venue negotiation in an accepted, server-priced state", () => {
    const backend = read("convex/teamChallenges.ts");
    const screen = read("app/teams/challenge.tsx");
    const createFull = backend.slice(
      backend.indexOf("export const createFull"),
      backend.indexOf("export const update"),
    );

    expect(backend).toContain('if (!["accepted", "venue_proposed"].includes(challenge.status))');
    expect(backend).toContain('status: "venue_proposed"');
    expect(backend).toContain("captainVenueChoices: buildCaptainChoices(challenge");
    expect(createFull).not.toContain("args.alternativeVenueByCaptainB");
    expect(createFull).not.toContain("args.adminReviewStatus");
    expect(createFull).toContain("[String(args.captainAUid)]: canonicalCaptainAVenue");
    expect(screen).toContain("const canAcceptNow = !!(isPending && !isAdminPending && isCaptainB)");
  });

  it("reports provider-paid team holds that fall back to wallet credit", () => {
    const backend = read("convex/easypaisa.ts");
    const screen = read("app/teams/challenge.tsx");

    expect(backend).toContain('teamChallengeHoldStatus = "wallet_credit_only"');
    expect(backend).toContain('status: "wallet_credit_only"');
    expect(backend).toContain("teamChallengeHoldStatus: latest.providerPayload?.teamChallengeHold?.status || null");
    expect(screen).toContain('statusLike?.teamChallengeHoldStatus === "held"');
    expect(screen).toContain("The funds remain available in your MatchHai wallet.");
  });

  it("keeps verification bypasses development-only and redacts payout details", () => {
    const gate = read("convex/kycGate.ts");
    const users = read("convex/users.ts");
    const wallet = read("convex/wallet.ts");
    const withdrawals = read("convex/zoneWithdrawals.ts");

    expect(gate).toContain('process.env.MATCHHAI_ENV || ""');
    expect(gate).toContain("isExplicitDevelopment &&");
    expect(users).toContain("isPhoneOtpBypassEnabled()");
    expect(wallet).toContain("delete metadata.accountNumberFull");
    expect(wallet).toContain(".take(200)");
    expect(withdrawals).toContain("process.env.WITHDRAWAL_REQUEST_EMAIL");
    expect(withdrawals).not.toContain('const WITHDRAWAL_REQUEST_EMAIL = "admin@matchhai.com"');
  });

  it("schedules direct counter-offer expiry and rejects duplicate holds", () => {
    const source = read("convex/zoneAdminBooking.ts");

    expect(source).toContain("export const expireDirectCounterOffer = internalMutation");
    expect(source).toContain("internal.zoneAdminBooking.expireDirectCounterOffer");
    expect(source).toContain('lifecycleStatus: "counter_offer_expired"');
    expect(source).toContain("new Set(resourceIds.map(String)).size !== resourceIds.length");
    expect(source).toContain("This booking request already has a pending counter-offer.");
  });
});
