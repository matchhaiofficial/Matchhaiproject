import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "./_generated/server";
import { getOwnedZoneForCurrentUser } from "./authz";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.getTime();
}

function startOfMonth() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d.getTime();
}

// Zone admin wallet summary — actor-scoped; no client-supplied IDs.
// branchId is validated against zone ownership (same owner = same branches).
// Per-branch filtering is deferred until payout metadata carries branchId.
export const getSummary = query({
  args: { branchId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await getOwnedZoneForCurrentUser(ctx);
    if (!actor.zone) return null;

    const todayStart = startOfToday();
    const weekStart = startOfWeek();
    const monthStart = startOfMonth();

    // Zone admins have bounded transaction history; .collect() is acceptable
    // at current scale. Replace with denormalized counters if volume grows large.
    const txns = await ctx.db
      .query("walletTransactions")
      .withIndex("by_userId_and_createdAt", (q) =>
        q.eq("userId", actor.user._id),
      )
      .order("desc")
      .collect();

    const payoutTxns = txns.filter(
      (tx) =>
        tx.type === "deposit" &&
        (tx.metadata as any)?.source === "matchroom_completion_payout" &&
        tx.status === "completed",
    );

    const withdrawalTxns = txns.filter((tx) => tx.type === "withdrawal");
    const completedWithdrawals = withdrawalTxns.filter(
      (tx) => tx.status === "completed",
    );
    const pendingWithdrawalTxns = withdrawalTxns.filter(
      (tx) => tx.status === "pending",
    );

    const totalEarned = payoutTxns.reduce((sum, tx) => sum + tx.amount, 0);
    const totalWithdrawn = completedWithdrawals.reduce((sum, tx) => sum + tx.amount, 0);
    const pendingWithdrawalAmount = pendingWithdrawalTxns.reduce((sum, tx) => sum + tx.amount, 0);

    const todayEarned = payoutTxns
      .filter((tx) => tx.createdAt >= todayStart)
      .reduce((sum, tx) => sum + tx.amount, 0);
    const weekEarned = payoutTxns
      .filter((tx) => tx.createdAt >= weekStart)
      .reduce((sum, tx) => sum + tx.amount, 0);
    const monthEarned = payoutTxns
      .filter((tx) => tx.createdAt >= monthStart)
      .reduce((sum, tx) => sum + tx.amount, 0);

    return {
      availableBalance: actor.user.walletBalance ?? 0,
      pendingBalance: pendingWithdrawalAmount,
      totalEarned,
      totalWithdrawn,
      todayEarned,
      weekEarned,
      monthEarned,
      pendingWithdrawals: pendingWithdrawalTxns.length,
      transactionCount: txns.length,
      zoneId: String(actor.zone._id),
      zoneName: (actor.zone as any).venueBrandName || "Zone",
      // Reflects whether the client requested a branch filter.
      // Actual per-branch filtering is deferred until payout metadata includes branchId.
      selectedBranchId: args.branchId ?? null,
      branchFilteringAvailable: false,
    };
  },
});

// Paginated zone wallet transaction history — actor-scoped.
export const listTransactionsPage = query({
  args: {
    paginationOpts: paginationOptsValidator,
    branchId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await getOwnedZoneForCurrentUser(ctx);
    if (!actor.zone) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const result = await ctx.db
      .query("walletTransactions")
      .withIndex("by_userId_and_createdAt", (q) =>
        q.eq("userId", actor.user._id),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page.map((tx) => ({
        _id: tx._id,
        type: tx.type,
        amount: tx.amount,
        status: tx.status,
        reference: tx.reference ?? null,
        createdAt: tx.createdAt,
        source: (tx.metadata as any)?.source ?? null,
        matchroomId: (tx.metadata as any)?.matchroomId ?? null,
        grossAmount: (tx.metadata as any)?.grossAmount ?? null,
        payoutRate: (tx.metadata as any)?.payoutRate ?? null,
        pilotApplied: (tx.metadata as any)?.pilotApplied ?? null,
      })),
    };
  },
});
