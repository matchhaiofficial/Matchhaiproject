import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "../convex/test.setup";

const NOW = Date.parse("2026-09-19T12:00:00.000Z");

async function seedPlayer(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "payment-test@matchhai.test",
      fullName: "Payment Test Player",
      username: "payment_test_player",
      usernameLower: "payment_test_player",
      accountType: "player",
      isOnline: false,
      playsCs2: true,
      skillScores: {
        cs2: {
          rating: 50,
          tier: "Gold",
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          lastUpdated: NOW,
        },
      },
      walletBalance: 0,
      createdAt: NOW,
      updatedAt: NOW,
    }),
  );
}

async function seedPayment(
  t: ReturnType<typeof convexTest>,
  userId: string,
  overrides: Record<string, unknown> = {},
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("paymentTransactions", {
      provider: "easypaisa",
      kind: "wallet_topup",
      status: "pending",
      userId: userId as never,
      amount: 15,
      currency: "PKR",
      orderRefNum: "MHW-OLD-ATTEMPT",
      checkoutToken: "old-checkout-token",
      checkoutUrl: "https://example.test/checkout",
      appReturnUrl: "matchhai://wallet",
      providerStatus: "FAILED",
      providerDescription: "No response from Easypaisa",
      lastError: "inquiry_unverified",
      providerPayload: {},
      expiresAt: NOW + 10 * 60 * 1000,
      createdAt: NOW - 30_000,
      updatedAt: NOW,
      ...overrides,
    } as never),
  );
}

describe("Easypaisa stale retry behavior", () => {
  it("retires a failed/unverified attempt and clears the old active pointer", async () => {
    const t = convexTest({ schema, modules });
    const userId = await seedPlayer(t);
    const oldPaymentId = await seedPayment(t, userId, {
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    await t.run(async (ctx) => {
      await ctx.db.patch(userId as never, {
        activeTopupPaymentTransactionId: oldPaymentId,
        activeTopupAmount: 15,
        activeTopupExpiresAt: Date.now() + 10 * 60 * 1000,
      });
    });

    const result = await t.mutation(internal.easypaisa.createCheckoutTransactionWithLock, {
      kind: "wallet_topup",
      userId: userId as never,
      amount: 15,
      currency: "PKR",
      orderRefNum: "MHW-NEW-ATTEMPT",
      checkoutToken: "new-checkout-token",
      checkoutUrl: "https://example.test/new-checkout",
      appReturnUrl: "matchhai://wallet",
      expiresAt: NOW + 10 * 60 * 1000,
      flow: "rest",
      forceNew: true,
    });

    expect(String(result.transaction._id)).not.toBe(String(oldPaymentId));
    const rows = await t.run(async (ctx) => ({
      old: await ctx.db.get(oldPaymentId),
      user: await ctx.db.get(userId),
      all: await ctx.db.query("paymentTransactions").collect(),
    }));
    expect(rows.old?.status).toBe("cancelled");
    expect(rows.user?.activeTopupPaymentTransactionId).toBe(result.transaction._id);
    expect(rows.all).toHaveLength(2);
  });

  it("credits a late authoritative paid inquiry exactly once after a retry", async () => {
    const t = convexTest({ schema, modules });
    const userId = await seedPlayer(t);
    const scheduledStartAt = Date.now() + 5 * 24 * 60 * 60 * 1000;
    const retryableCreateArgs = {
      hostUid: userId as never,
      hostName: "payment_test_player",
      game: "cs2",
      title: "Retry-safe paid room",
      maxPlayers: 2,
      players: [{ uid: userId, username: "payment_test_player", joinedAt: NOW }],
      playerUids: [userId],
      location: "Online",
      locationMode: "broadcast",
      broadcastAreas: ["Karachi"],
      broadcastRequestStatus: "waiting_for_fill",
      scheduledStartAt,
      lockAt: scheduledStartAt - 24 * 60 * 60 * 1000,
      expiresAt: scheduledStartAt - 24 * 60 * 60 * 1000,
      durationMinutes: 60,
      pricing: { perPlayer: 15, currency: "PKR" },
      slotsA: [],
      slotsB: [],
      captainUidA: userId,
      bookingSource: "player",
      paymentStatus: "paid",
      paymentAmount: 15,
      paymentReservedSlots: 1,
      paymentCurrency: "PKR",
      clientCreateRequestId: "retry-safe-paid-room-1",
    };
    const oldPaymentId = await seedPayment(t, userId, {
      status: "cancelled",
      lastError: undefined,
      providerPayload: {
        retry: { retiredAt: NOW, reason: "superseded_by_retry" },
        checkoutContext: { matchroomCreateArgs: retryableCreateArgs },
      },
    });

    const result = await t.mutation(internal.easypaisa.applyProviderUpdate, {
      orderRefNum: "MHW-OLD-ATTEMPT",
      source: "inquiry",
      snapshot: {
        responseCode: "0000",
        responseDesc: "SUCCESS",
        transactionStatus: "SUCCESS",
        transactionId: "provider-old-success",
        orderRefNumber: "MHW-OLD-ATTEMPT",
        amount: 15,
        paymentMode: "MA",
        rawPayload: {
          rest: {
            inquiry: {
              response: {
                responseCode: "0000",
                responseDesc: "SUCCESS",
                transactionStatus: "SUCCESS",
                transactionId: "provider-old-success",
                paymentMode: "MA",
              },
            },
          },
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("paid");

    const state = await t.run(async (ctx) => ({
      payment: await ctx.db.get(oldPaymentId),
      walletTransactions: await ctx.db.query("walletTransactions").collect(),
      matchrooms: await ctx.db.query("matchrooms").collect(),
      user: await ctx.db.get(userId),
    }));
    expect(state.payment?.status).toBe("paid");
    expect(state.walletTransactions.filter((row) => row.type === "deposit")).toHaveLength(1);
    expect(state.walletTransactions.find((row) => row.type === "deposit")?.reference).toBe("easypaisa:MHW-OLD-ATTEMPT");
    expect(state.matchrooms).toHaveLength(1);
    expect(state.user?.walletBalance || 0).toBe(0);

    const secondPaymentId = await seedPayment(t, userId, {
      orderRefNum: "MHW-NEW-ATTEMPT",
      status: "cancelled",
      lastError: undefined,
      providerPayload: {
        retry: { retiredAt: NOW, reason: "superseded_by_retry" },
        checkoutContext: { matchroomCreateArgs: retryableCreateArgs },
      },
    });
    const secondResult = await t.mutation(internal.easypaisa.applyProviderUpdate, {
      orderRefNum: "MHW-NEW-ATTEMPT",
      source: "inquiry",
      snapshot: {
        responseCode: "0000",
        responseDesc: "SUCCESS",
        transactionStatus: "SUCCESS",
        transactionId: "provider-new-success",
        orderRefNumber: "MHW-NEW-ATTEMPT",
        amount: 15,
        paymentMode: "MA",
      },
    });
    expect(secondResult.ok).toBe(true);
    const afterSecond = await t.run(async (ctx) => ({
      old: await ctx.db.get(oldPaymentId),
      second: await ctx.db.get(secondPaymentId),
      walletTransactions: await ctx.db.query("walletTransactions").collect(),
      matchrooms: await ctx.db.query("matchrooms").collect(),
      user: await ctx.db.get(userId),
    }));
    expect(afterSecond.old?.status).toBe("paid");
    expect(afterSecond.second?.status).toBe("paid");
    expect(afterSecond.walletTransactions.filter((row) => row.type === "deposit")).toHaveLength(2);
    expect(afterSecond.matchrooms).toHaveLength(1);
    // Both provider orders were genuinely paid. The second payment is retained
    // in the wallet because the room debit is already idempotently settled.
    expect(afterSecond.user?.walletBalance || 0).toBe(15);

    const repeated = await t.mutation(internal.easypaisa.applyProviderUpdate, {
      orderRefNum: "MHW-NEW-ATTEMPT",
      source: "inquiry",
      snapshot: {
        responseCode: "0000",
        responseDesc: "SUCCESS",
        transactionStatus: "SUCCESS",
        transactionId: "provider-new-success",
        orderRefNumber: "MHW-NEW-ATTEMPT",
        amount: 15,
        paymentMode: "MA",
      },
    });
    expect(repeated.ok).toBe(true);
    const afterRepeat = await t.run(async (ctx) => ({
      walletTransactions: await ctx.db.query("walletTransactions").collect(),
      matchrooms: await ctx.db.query("matchrooms").collect(),
      user: await ctx.db.get(userId),
    }));
    expect(afterRepeat.walletTransactions.filter((row) => row.type === "deposit")).toHaveLength(2);
    expect(afterRepeat.matchrooms).toHaveLength(1);
    expect(afterRepeat.user?.walletBalance || 0).toBe(15);
  });
});
