import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "../convex/test.setup";

describe("venue payout clearing and zone wallet visibility", () => {
  afterEach(() => vi.useRealTimers());

  test("shows a resolved payout as pending before clearing, then credits exactly once", async () => {
    vi.useFakeTimers();
    const now = Date.parse("2026-09-19T12:00:00.000Z");
    vi.setSystemTime(now);
    const t = convexTest(schema, modules);

    const { ownerId, roomId } = await t.run(async (ctx) => {
      const ownerId = await ctx.db.insert("users", {
        authId: "zone-owner-auth",
        email: "zone-owner@example.com",
        fullName: "Zone Owner",
        username: "zone_owner",
        usernameLower: "zone_owner",
        accountType: "zone",
        isOnline: false,
        kycVerificationStatus: "verified",
        createdAt: now - 10_000,
        updatedAt: now - 1_000,
      });
      const zoneId = await ctx.db.insert("zones", {
        ownerUid: ownerId,
        name: "QA Zone",
        status: "active",
        games: ["tekken8"],
        branches: [{ id: "b1", name: "Main Branch" }],
        normalPayoutRate: 0.9,
        createdAt: now - 10_000,
        updatedAt: now - 1_000,
      });
      const joinerId = await ctx.db.insert("users", {
        authId: "joiner-auth",
        email: "joiner@example.com",
        fullName: "Joining Player",
        username: "joining_player",
        usernameLower: "joining_player",
        accountType: "player",
        isOnline: false,
        createdAt: now - 10_000,
        updatedAt: now - 1_000,
      });
      const roomId = await ctx.db.insert("matchrooms", {
        hostUid: "player-a",
        hostName: "Player A",
        game: "tekken8",
        title: "Clearing window test",
        status: "completed",
        maxPlayers: 2,
        currentPlayers: 2,
        players: [
          { uid: "player-a", username: "Player A", joinedAt: now - 2_000 },
          { uid: "player-b", username: "Player B", joinedAt: now - 2_000 },
        ],
        playerUids: ["player-a", "player-b"],
        locationMode: "zone",
        zoneId: String(zoneId),
        zoneOwnerUid: String(ownerId),
        branchId: "b1",
        zoneAdminApproved: true,
        pricing: { perPlayer: 301, currency: "PKR" },
        paymentStatus: "paid",
        paymentAmount: 301,
        merchantSettlementStatus: "captured",
        merchantSettlementAmount: 301,
        venuePayoutStatus: "pending",
        venuePayoutEligibleAt: now + 24 * 60 * 60 * 1000,
        resultVerification: {
          status: "resolved",
          team1Captain: "player-a",
          team2Captain: "player-b",
          finalWinner: "team1",
          resolvedAt: now,
          resolutionSource: "test",
        },
        slotsA: [{ slotId: "A1", uid: "player-a", status: "confirmed" }],
        slotsB: [{ slotId: "B1", uid: "player-b", status: "confirmed" }],
        createdAt: now - 10_000,
        updatedAt: now,
      });
      await ctx.db.insert("bookingIntents", {
        matchroomId: roomId,
        createdByUid: joinerId,
        side: "B",
        selectedSlots: [1],
        selectedSlotIds: ["B1"],
        source: "direct_join",
        status: "confirmed",
        pricing: { totalCost: 301, perPlayerCost: 301, currency: "PKR" },
        game: "tekken8",
        paymentStatus: "paid",
        heldStatus: "captured",
        heldAmount: 301,
        heldCapturedAt: now,
        createdAt: now - 5_000,
        updatedAt: now,
      });
      return { ownerId, roomId };
    });

    const pending = await t.withIdentity({ subject: "zone-owner-auth" }).query(api.zoneWallet.getSummary, {});
    expect(pending?.availableBalance).toBe(0);
    expect(pending?.pendingEarnings).toBe(541.8);
    expect(pending?.pendingEarningCount).toBe(1);

    const settlement = await t.withIdentity({ subject: "zone-owner-auth" }).query(api.matchrooms.getSettlementSummary, {
      matchroomId: roomId,
    });
    expect(settlement?.grossAmount).toBe(602);
    expect(settlement?.merchantSettlementAmount).toBe(301);

    const beforeEligibility = await t.mutation(internal.matchrooms.settleVenuePayoutAfterResult, { matchroomId: roomId });
    expect(beforeEligibility.result).toEqual({ status: "pending", reason: "clearing_window", eligibleAt: now + 24 * 60 * 60 * 1000 });

    vi.setSystemTime(now + 24 * 60 * 60 * 1000 + 1);
    const settled = await t.mutation(internal.matchrooms.settleVenuePayoutAfterResult, { matchroomId: roomId });
    expect(settled.result).toMatchObject({ status: "paid", amount: 541.8 });
    const retried = await t.mutation(internal.matchrooms.settleVenuePayoutAfterResult, { matchroomId: roomId });
    expect(retried.result).toMatchObject({ status: "paid", amount: 541.8 });

    const after = await t.withIdentity({ subject: "zone-owner-auth" }).query(api.zoneWallet.getSummary, {});
    expect(after?.availableBalance).toBe(541.8);
    expect(after?.pendingEarnings).toBe(0);
    expect(after?.pendingEarningCount).toBe(0);

    // A legacy/already-reconciled room may no longer retain the host payment
    // field; an explicit merchant gross must still not be inflated by the
    // captured intent on a retry.
    await t.run(async (ctx) => {
      await ctx.db.patch(roomId, {
        paymentAmount: undefined,
        merchantSettlementAmount: 602,
        venuePayoutStatus: "pending",
        venuePayoutAt: undefined,
        venuePayoutAmount: undefined,
        venuePayoutReference: undefined,
        venuePayoutEligibleAt: Date.now() - 1,
      });
    });
    const alreadyTotal = await t.withIdentity({ subject: "zone-owner-auth" }).query(api.matchrooms.getSettlementSummary, {
      matchroomId: roomId,
    });
    expect(alreadyTotal?.grossAmount).toBe(602);
    const repaired = await t.mutation(internal.matchrooms.settleVenuePayoutAfterResult, { matchroomId: roomId });
    expect(repaired.result).toMatchObject({ status: "paid", amount: 541.8 });

    const result = await t.run(async (ctx) => ({
      owner: await ctx.db.get(ownerId),
      room: await ctx.db.get(roomId),
      transactions: await ctx.db.query("walletTransactions").withIndex("by_reference", (q) =>
        q.eq("reference", `venue_payout:${String(roomId)}`),
      ).take(10),
    }));
    expect(result.owner?.walletBalance).toBe(541.8);
    expect(result.room?.venuePayoutStatus).toBe("paid");
    expect(result.room?.merchantSettlementAmount).toBe(602);
    expect(result.transactions).toHaveLength(1);
  });
});
