import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { getOwnedZoneForCurrentUser } from "./authz";

const KARACHI_OFFSET_MS = 5 * 60 * 60 * 1000;

function getKarachiPeriodStarts(now = Date.now()) {
  const local = new Date(now + KARACHI_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const date = local.getUTCDate();
  const startOfToday = Date.UTC(year, month, date) - KARACHI_OFFSET_MS;
  const day = local.getUTCDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  const startOfWeek = startOfToday - mondayOffset * 24 * 60 * 60 * 1000;
  const startOfMonth = Date.UTC(year, month, 1) - KARACHI_OFFSET_MS;
  return { startOfToday, startOfWeek, startOfMonth };
}

function branchIdFromBranch(branch: any, index: number) {
  return String(branch?.id || branch?.branchId || `branch_${index + 1}`).trim();
}

function branchNameFromBranch(branch: any, fallback: string) {
  return String(
    branch?.branchDisplayName ||
    branch?.name ||
    branch?.areaLabel ||
    fallback,
  ).trim();
}

function buildBranchMaps(zone: any) {
  const branchIds = new Set<string>();
  const branchNameById = new Map<string, string>();
  const branches = Array.isArray(zone?.branches) ? zone.branches : [];
  branches.forEach((branch: any, index: number) => {
    const id = branchIdFromBranch(branch, index);
    if (!id) return;
    branchIds.add(id);
    branchNameById.set(id, branchNameFromBranch(branch, `Branch ${index + 1}`));
  });
  return { branchIds, branchNameById };
}

function normalizeRequestedBranchId(branchId?: string) {
  const normalized = String(branchId || "").trim();
  return normalized || null;
}

function getMetadataBranch(metadata: any) {
  const branchId = String(metadata?.branchId || "").trim();
  if (!branchId) return null;
  const branchName = String(metadata?.branchName || "").trim() || null;
  return { branchId, branchName };
}

async function resolveTransactionBranchContext(
  ctx: any,
  tx: any,
  branchNameById: Map<string, string>,
) {
  const metadata = tx.metadata || {};
  const metadataBranch = getMetadataBranch(metadata);
  if (metadataBranch) {
    return {
      branchId: metadataBranch.branchId,
      branchName: metadataBranch.branchName || branchNameById.get(metadataBranch.branchId) || null,
    };
  }

  const matchroomId = String(metadata?.matchroomId || "").trim();
  if (!matchroomId) return { branchId: null, branchName: null };

  let room: any = null;
  try {
    room = await ctx.db.get(matchroomId as Id<"matchrooms">);
  } catch {
    room = null;
  }

  const roomBranchId = String(room?.branchId || room?.confirmedBranchId || "").trim();
  if (roomBranchId) {
    return {
      branchId: roomBranchId,
      branchName: branchNameById.get(roomBranchId) || String(room?.branchName || "").trim() || null,
    };
  }

  let requests: any[] = [];
  try {
    requests = await ctx.db
      .query("bookingRequests")
      .withIndex("by_matchroomId", (q: any) => q.eq("matchroomId", matchroomId as Id<"matchrooms">))
      .take(1);
  } catch {
    requests = [];
  }

  const requestBranchId = String(requests[0]?.allocatedBranchId || "").trim();
  if (requestBranchId) {
    return {
      branchId: requestBranchId,
      branchName: branchNameById.get(requestBranchId) || null,
    };
  }

  return { branchId: null, branchName: null };
}

function isPayoutTransaction(tx: any) {
  return tx.type === "deposit" &&
    (tx.metadata as any)?.source === "matchroom_completion_payout" &&
    tx.status === "completed";
}

function isZoneWithdrawalTransaction(tx: any) {
  return tx.type === "withdrawal" &&
    (tx.metadata as any)?.source === "zone_admin_withdrawal_request";
}

function serializeTransaction(
  tx: any,
  branchContext: { branchId: string | null; branchName: string | null },
) {
  const metadata = tx.metadata || {};
  return {
    _id: tx._id,
    type: tx.type,
    amount: tx.amount,
    status: tx.status,
    reference: tx.reference ?? null,
    createdAt: tx.createdAt,
    source: metadata?.source ?? null,
    matchroomId: metadata?.matchroomId ?? null,
    branchId: branchContext.branchId,
    branchName: branchContext.branchName,
    grossAmount: metadata?.grossAmount ?? null,
    payoutRate: metadata?.payoutRate ?? null,
    pilotApplied: metadata?.pilotApplied ?? null,
  };
}

// Zone admin wallet summary: actor-scoped, branch-validated, and account-level
// available balance. Time windows use Asia/Karachi business-day boundaries.
export const getSummary = query({
  args: { branchId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await getOwnedZoneForCurrentUser(ctx);
    if (!actor.zone) return null;

    const { branchIds, branchNameById } = buildBranchMaps(actor.zone);
    const requestedBranchId = normalizeRequestedBranchId(args.branchId);
    if (requestedBranchId && !branchIds.has(requestedBranchId)) {
      throw new Error("Branch not found.");
    }

    const { startOfToday, startOfWeek, startOfMonth } = getKarachiPeriodStarts();
    const txns = await ctx.db
      .query("walletTransactions")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", actor.user._id))
      .order("desc")
      .collect();

    const scopedTxns: any[] = [];
    for (const tx of txns) {
      if (!requestedBranchId) {
        scopedTxns.push(tx);
        continue;
      }
      if (!isPayoutTransaction(tx) && !isZoneWithdrawalTransaction(tx)) continue;
      const branchContext = await resolveTransactionBranchContext(ctx, tx, branchNameById);
      if (branchContext.branchId === requestedBranchId) scopedTxns.push(tx);
    }

    const payoutTxns = scopedTxns.filter(isPayoutTransaction);
    const withdrawalTxns = scopedTxns.filter(isZoneWithdrawalTransaction);
    const completedWithdrawals = withdrawalTxns.filter((tx) => tx.status === "completed");
    const pendingWithdrawalTxns = withdrawalTxns.filter((tx) => tx.status === "pending");

    const totalEarned = payoutTxns.reduce((sum, tx) => sum + tx.amount, 0);
    const totalWithdrawn = completedWithdrawals.reduce((sum, tx) => sum + tx.amount, 0);
    const pendingWithdrawalAmount = pendingWithdrawalTxns.reduce((sum, tx) => sum + tx.amount, 0);
    const todayEarned = payoutTxns
      .filter((tx) => tx.createdAt >= startOfToday)
      .reduce((sum, tx) => sum + tx.amount, 0);
    const weekEarned = payoutTxns
      .filter((tx) => tx.createdAt >= startOfWeek)
      .reduce((sum, tx) => sum + tx.amount, 0);
    const monthEarned = payoutTxns
      .filter((tx) => tx.createdAt >= startOfMonth)
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
      transactionCount: scopedTxns.length,
      zoneId: String(actor.zone._id),
      zoneName: (actor.zone as any).venueBrandName || "Zone",
      selectedBranchId: requestedBranchId,
      selectedBranchName: requestedBranchId ? branchNameById.get(requestedBranchId) || null : null,
      branchFilteringAvailable: true,
      timezone: "Asia/Karachi",
    };
  },
});

// Paginated zone wallet transaction history: "All" uses Convex pagination;
// branch views use an offset cursor after actor-scoped branch filtering.
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

    const { branchIds, branchNameById } = buildBranchMaps(actor.zone);
    const requestedBranchId = normalizeRequestedBranchId(args.branchId);
    if (requestedBranchId && !branchIds.has(requestedBranchId)) {
      throw new Error("Branch not found.");
    }

    if (requestedBranchId) {
      const offset = Math.max(0, Number(args.paginationOpts.cursor || 0) || 0);
      const limit = Math.max(1, Math.min(50, Math.floor(Number(args.paginationOpts.numItems || 20))));
      const txns = await ctx.db
        .query("walletTransactions")
        .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", actor.user._id))
        .order("desc")
        .collect();

      const branchRows = [];
      for (const tx of txns) {
        if (!isPayoutTransaction(tx) && !isZoneWithdrawalTransaction(tx)) continue;
        const branchContext = await resolveTransactionBranchContext(ctx, tx, branchNameById);
        if (branchContext.branchId === requestedBranchId) {
          branchRows.push(serializeTransaction(tx, branchContext));
        }
      }

      const page = branchRows.slice(offset, offset + limit);
      const nextOffset = offset + page.length;
      const isDone = nextOffset >= branchRows.length;
      return {
        page,
        isDone,
        continueCursor: isDone ? "" : String(nextOffset),
      };
    }

    const result = await ctx.db
      .query("walletTransactions")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", actor.user._id))
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: await Promise.all(result.page.map(async (tx) => {
        const branchContext = await resolveTransactionBranchContext(ctx, tx, branchNameById);
        return serializeTransaction(tx, branchContext);
      })),
    };
  },
});
