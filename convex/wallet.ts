import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { Id } from "./_generated/dataModel";
import { notifySuperAdminsWithdrawalReviewNeeded, notifyZoneAdminWithdrawalRequested } from "./withdrawalNotifications";
import { requireCurrentUser, requireSelf } from "./authz";

async function getWalletUserRecord(
  ctx: any,
  userId?: Id<"users">,
  options?: { allowInternalUserId?: boolean },
) {
  // Primary: Better Auth session lookup.
  let authUser: Awaited<ReturnType<typeof authComponent.getAuthUser>> | null = null;
  try {
    authUser = await authComponent.getAuthUser(ctx);
  } catch {
    authUser = null;
  }

  if (authUser?.userId) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q: any) => q.eq("authId", authUser.userId))
      .unique();
    if (user) return user;
  }

  // Fallback: Convex JWT identity with normalized candidates.
  // Handles both stored forms: full "https://issuer|shortId" and plain "shortId".
  // Required when Better Auth getAuthUser returns null but ctx.auth has a valid token.
  const identity = await ctx.auth.getUserIdentity();
  if (identity) {
    const candidates = new Set<string>();
    for (const raw of [identity.subject, identity.tokenIdentifier]) {
      if (!raw) continue;
      candidates.add(raw);
      // tokenIdentifier is typically "https://issuer|shortId"; also try the shortId alone.
      if (raw.includes("|")) {
        const suffix = raw.split("|").pop();
        if (suffix) candidates.add(suffix);
      }
    }
    for (const candidate of candidates) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_authId", (q: any) => q.eq("authId", candidate))
        .unique();
      if (user) return user;
    }
  }

  // Internal server calls: allow direct userId lookup when the caller has already
  // verified the actor via requireCurrentUser / requireVerifiedActor.
  if (userId && options?.allowInternalUserId) {
    const user = await ctx.db.get(userId);
    if (user) return user;
  }

  throw new Error("Authentication required.");
}

// ============================================
// WALLET QUERIES
// ============================================

// Get wallet balance for a user
export const getBalance = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const { user } = await requireCurrentUser(ctx);
    return user?.walletBalance ?? 0;
  },
});

export const getSummary = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const { user } = await requireCurrentUser(ctx);
    return {
      balance: user?.walletBalance ?? 0,
      heldBalance: user?.walletHeldBalance ?? 0,
    };
  },
});

// List wallet transactions for a user
export const listTransactions = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const { user } = await requireCurrentUser(ctx);
    return await ctx.db
      .query("walletTransactions")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

function buildWalletHistoryRows(walletRows: any[], paymentRows: any[]) {
  const paymentByReference = new Map<string, any>();
  for (const row of paymentRows) {
    paymentByReference.set(`easypaisa:${row.orderRefNum}`, row);
  }

  const consumedPaymentIds = new Set<string>();

  const historyFromWallet = walletRows.map((row) => {
    const metadata = (row.metadata || {}) as Record<string, any>;
    const linkedPayment = row.reference ? paymentByReference.get(row.reference) : null;
    if (linkedPayment?._id) {
      consumedPaymentIds.add(String(linkedPayment._id));
    }

    let title = "Wallet transaction";
    if (row.type === "deposit") title = "Wallet top-up";
    if (metadata.source === "matchroom_completion_payout") title = "Venue payout";
    if (row.type === "withdrawal") title = "Wallet payment";
    if (row.type === "booking_payment") title = "Booking payment";
    if (row.type === "refund") title = "Wallet refund";
    if (row.type === "hold") title = "Reserved for booking";
    if (row.type === "hold_release") title = "Booking reservation released";
    if (row.type === "hold_capture") title = "Booking payment captured";

    return {
      id: `wallet:${String(row._id)}`,
      source: "wallet",
      title,
      kind: row.type,
      status: row.status,
      amount: row.amount,
      reference: row.reference || null,
      createdAt: row.createdAt,
      provider: linkedPayment?.provider || metadata.provider || null,
      subtitle:
        metadata.sourceLabel
        || metadata.paymentMethod
        || null,
      support: {
        walletTransactionId: String(row._id),
        paymentTransactionId: linkedPayment ? String(linkedPayment._id) : metadata.transactionId || null,
        orderRefNum: linkedPayment?.orderRefNum || metadata.orderRefNum || null,
        providerReference: linkedPayment?.providerReference || metadata.providerReference || null,
        callbackCount: linkedPayment?.callbackCount || 0,
        paymentStatus: linkedPayment?.status || null,
        paymentKind: linkedPayment?.kind || null,
        paymentMethod: linkedPayment?.paymentMethod || metadata.paymentMethod || null,
        lastError: linkedPayment?.lastError || null,
        processedAt: linkedPayment?.processedAt || null,
        checkoutPhoneMasked: linkedPayment?.providerPayload?.checkoutContext?.checkoutPhoneMasked || null,
        phoneSource: linkedPayment?.providerPayload?.checkoutContext?.phoneSource || null,
      },
    };
  });

  const historyFromPayments = paymentRows
    .filter((row) => !consumedPaymentIds.has(String(row._id)))
    .map((row) => ({
      id: `payment:${String(row._id)}`,
      source: "payment",
      title: row.kind === "wallet_topup" ? "Wallet top-up" : "Booking payment",
      kind: row.kind,
      status: row.status,
      amount: row.amount,
      reference: row.orderRefNum,
      createdAt: row.createdAt,
      provider: row.provider,
      subtitle: row.paymentMethod || null,
      support: {
        walletTransactionId: null,
        paymentTransactionId: String(row._id),
        orderRefNum: row.orderRefNum,
        providerReference: row.providerReference || null,
        callbackCount: row.callbackCount || 0,
        paymentStatus: row.status,
        paymentKind: row.kind,
        paymentMethod: row.paymentMethod || null,
        lastError: row.lastError || null,
        processedAt: row.processedAt || null,
        checkoutPhoneMasked: row.providerPayload?.checkoutContext?.checkoutPhoneMasked || null,
        phoneSource: row.providerPayload?.checkoutContext?.phoneSource || null,
      },
    }));

  return [...historyFromWallet, ...historyFromPayments].sort(
    (a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0),
  );
}

function matchesWalletHistoryFilters(row: any, filters?: any) {
  if (!filters) return true;
  const type = String(filters.type || "all");
  if (type !== "all") {
    const kind = String(row.kind || "");
    const source = String(row.source || "");
    const mappedType =
      source === "payment" && kind === "wallet_topup" ? "topup"
      : kind === "deposit" ? "topup"
      : kind === "booking_payment" ? "booking_payment"
      : kind === "hold" ? "hold"
      : ["refund"].includes(kind) ? "refund"
      : ["hold_release", "hold_capture"].includes(kind) ? "release_capture"
      : kind === "withdrawal" ? "withdrawal"
      : kind;
    if (mappedType !== type) return false;
  }
  const status = String(filters.status || "all");
  if (status !== "all") {
    const rawStatus = String(row.status || "");
    const mappedStatus =
      rawStatus === "paid" || rawStatus === "completed" ? "successful"
      : rawStatus === "created" || rawStatus === "redirected" || rawStatus === "token_received" ? "pending"
      : rawStatus;
    if (mappedStatus !== status) return false;
  }

  const createdAt = Number(row.createdAt || 0);
  const dateRange = String(filters.dateRange || "all");
  if (dateRange !== "all") {
    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    if (dateRange === "today" && createdAt < todayStart) return false;
    if (dateRange === "last_7_days" && createdAt < now - 7 * 24 * 60 * 60 * 1000) return false;
    if (dateRange === "last_30_days" && createdAt < now - 30 * 24 * 60 * 60 * 1000) return false;
  }

  const amount = Math.abs(Number(row.amount || 0));
  const amountRange = String(filters.amountRange || "all");
  if (amountRange === "under_500" && !(amount < 500)) return false;
  if (amountRange === "500_2000" && !(amount >= 500 && amount <= 2000)) return false;
  if (amountRange === "2000_5000" && !(amount > 2000 && amount <= 5000)) return false;
  if (amountRange === "above_5000" && !(amount > 5000)) return false;
  return true;
}

export const listHistory = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const { user } = await requireCurrentUser(ctx);
    const [walletRows, paymentRows] = await Promise.all([
      ctx.db
        .query("walletTransactions")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("paymentTransactions")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
    ]);

    return buildWalletHistoryRows(walletRows, paymentRows);
  },
});

export const listHistoryPage = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
    filters: v.optional(v.object({
      type: v.optional(v.string()),
      status: v.optional(v.string()),
      dateRange: v.optional(v.string()),
      amountRange: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const { user } = await requireCurrentUser(ctx);
    const limit = Math.max(1, Math.min(50, Math.floor(Number(args.limit || 20))));
    const offset = Math.max(0, Number(args.cursor || 0) || 0);
    const [walletRows, paymentRows] = await Promise.all([
      ctx.db
        .query("walletTransactions")
        .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", user._id))
        .order("desc")
        .collect(),
      ctx.db
        .query("paymentTransactions")
        .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", user._id))
        .order("desc")
        .collect(),
    ]);
    const rows = buildWalletHistoryRows(walletRows, paymentRows)
      .filter((row) => matchesWalletHistoryFilters(row, args.filters));
    const page = rows.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    return {
      page,
      isDone: nextOffset >= rows.length,
      continueCursor: nextOffset >= rows.length ? null : String(nextOffset),
      total: rows.length,
      limitation: "walletTransactions and paymentTransactions are merged after user-scoped reads to preserve existing transaction semantics.",
    };
  },
});

export const createZoneWithdrawalTransaction = mutation({
  args: {
    userId: v.id("users"),
    zoneId: v.optional(v.string()),
    branchId: v.string(),
    branchName: v.string(),
    amount: v.number(),
    bankName: v.string(),
    accountNumberMasked: v.string(),
    accountNumberLast4: v.string(),
    ownerName: v.optional(v.string()),
    ownerEmail: v.optional(v.string()),
    venueName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.amount <= 0) {
      throw new Error("Withdrawal amount must be positive.");
    }

    const actor = await requireSelf(ctx, args.userId);
    const user = actor.user;
    if (args.zoneId) {
      const zone = await ctx.db.get(args.zoneId as Id<"zones">);
      if (zone && zone.ownerUid !== user._id) {
        throw new Error("Not authorized.");
      }
    }
    const walletBalance = Number(user.walletBalance || 0);
    if (walletBalance < args.amount) {
      throw new Error("Withdrawal amount cannot exceed wallet balance.");
    }

    const now = Date.now();
    const reference = `zone_withdrawal_${String(user._id)}_${now}`;
    const withdrawalId = await ctx.db.insert("walletTransactions", {
      userId: user._id,
      type: "withdrawal",
      amount: args.amount,
      status: "pending",
      reference,
      metadata: {
        source: "zone_admin_withdrawal_request",
        zoneId: args.zoneId || null,
        branchId: args.branchId,
        branchName: args.branchName,
        bankName: args.bankName,
        accountNumberMasked: args.accountNumberMasked,
        accountNumberLast4: args.accountNumberLast4,
        ownerName: args.ownerName || user.fullName || user.username || null,
        ownerEmail: args.ownerEmail || user.email || null,
        venueName: args.venueName || null,
      },
      createdAt: now,
    });

    await notifySuperAdminsWithdrawalReviewNeeded(ctx, { withdrawalId });
    await notifyZoneAdminWithdrawalRequested(ctx, { withdrawalId, zoneAdminUserId: user._id });

    return { reference, createdAt: now, walletBalance };
  },
});


// ============================================
// WALLET MUTATIONS
// ============================================

// Add funds to wallet (manual top-up)
export const addFunds = internalMutation({
  args: {
    amount: v.number(),
    userId: v.optional(v.id("users")),
    reference: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    if (args.amount <= 0) {
      throw new Error("Amount must be positive");
    }

    const user = await getWalletUserRecord(ctx, args.userId, { allowInternalUserId: true });
    if (args.reference) {
      const existing = await ctx.db
        .query("walletTransactions")
        .withIndex("by_reference", (q) => q.eq("reference", args.reference))
        .collect();
      if (existing.length > 0) {
        return { newBalance: user.walletBalance ?? 0 };
      }
    }

    const currentBalance = user.walletBalance ?? 0;
    const now = Date.now();

    // Update user wallet balance
    await ctx.db.patch(user._id, {
      walletBalance: currentBalance + args.amount,
      updatedAt: now,
    });

    // Create wallet transaction record
    await ctx.db.insert("walletTransactions", {
      userId: user._id,
      type: "deposit",
      amount: args.amount,
      status: "completed",
      reference: args.reference || "manual_topup",
      metadata: args.metadata,
      createdAt: now,
    });

    return { newBalance: currentBalance + args.amount };
  },
});

export const holdFunds = internalMutation({
  args: {
    amount: v.number(),
    userId: v.optional(v.id("users")),
    reference: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    if (args.amount <= 0) {
      throw new Error("Amount must be positive");
    }

    const user = await getWalletUserRecord(ctx, args.userId, { allowInternalUserId: true });
    const existing = await ctx.db
      .query("walletTransactions")
      .withIndex("by_reference", (q) => q.eq("reference", args.reference))
      .collect();
    if (existing.length > 0) {
      return {
        newBalance: Number(user.walletBalance || 0),
        heldBalance: Number(user.walletHeldBalance || 0),
        alreadyApplied: true,
      };
    }

    const currentBalance = Number(user.walletBalance || 0);
    const currentHeldBalance = Number(user.walletHeldBalance || 0);
    if (!Number.isFinite(currentBalance) || currentBalance < args.amount) {
      throw new Error("Insufficient wallet balance. Please add funds from Wallet.");
    }

    const now = Date.now();
    await ctx.db.patch(user._id, {
      walletBalance: currentBalance - args.amount,
      walletHeldBalance: currentHeldBalance + args.amount,
      updatedAt: now,
    });

    await ctx.db.insert("walletTransactions", {
      userId: user._id,
      type: "hold",
      amount: args.amount,
      status: "completed",
      reference: args.reference,
      metadata: args.metadata,
      createdAt: now,
    });

    return {
      newBalance: currentBalance - args.amount,
      heldBalance: currentHeldBalance + args.amount,
      alreadyApplied: false,
    };
  },
});

export const releaseHeldFunds = internalMutation({
  args: {
    amount: v.number(),
    userId: v.optional(v.id("users")),
    reference: v.string(),
    originalHoldReference: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    if (args.amount <= 0) {
      throw new Error("Amount must be positive");
    }

    const user = await getWalletUserRecord(ctx, args.userId, { allowInternalUserId: true });
    const existing = await ctx.db
      .query("walletTransactions")
      .withIndex("by_reference", (q) => q.eq("reference", args.reference))
      .collect();
    if (existing.length > 0) {
      return {
        newBalance: Number(user.walletBalance || 0),
        heldBalance: Number(user.walletHeldBalance || 0),
        alreadyApplied: true,
      };
    }

    const currentBalance = Number(user.walletBalance || 0);
    const currentHeldBalance = Number(user.walletHeldBalance || 0);
    if (!Number.isFinite(currentHeldBalance) || currentHeldBalance < args.amount) {
      throw new Error("Insufficient held wallet balance.");
    }

    const now = Date.now();
    await ctx.db.patch(user._id, {
      walletBalance: currentBalance + args.amount,
      walletHeldBalance: currentHeldBalance - args.amount,
      updatedAt: now,
    });

    await ctx.db.insert("walletTransactions", {
      userId: user._id,
      type: "hold_release",
      amount: args.amount,
      status: "completed",
      reference: args.reference,
      metadata: {
        ...(args.metadata || {}),
        originalHoldReference: args.originalHoldReference,
      },
      createdAt: now,
    });

    return {
      newBalance: currentBalance + args.amount,
      heldBalance: currentHeldBalance - args.amount,
      alreadyApplied: false,
    };
  },
});

export const captureHeldFunds = internalMutation({
  args: {
    amount: v.number(),
    userId: v.optional(v.id("users")),
    reference: v.string(),
    originalHoldReference: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    if (args.amount <= 0) {
      throw new Error("Amount must be positive");
    }

    const user = await getWalletUserRecord(ctx, args.userId, { allowInternalUserId: true });
    const existing = await ctx.db
      .query("walletTransactions")
      .withIndex("by_reference", (q) => q.eq("reference", args.reference))
      .collect();
    if (existing.length > 0) {
      return {
        newBalance: Number(user.walletBalance || 0),
        heldBalance: Number(user.walletHeldBalance || 0),
        alreadyApplied: true,
      };
    }

    const currentBalance = Number(user.walletBalance || 0);
    const currentHeldBalance = Number(user.walletHeldBalance || 0);
    if (!Number.isFinite(currentHeldBalance) || currentHeldBalance < args.amount) {
      throw new Error("Insufficient held wallet balance.");
    }

    const now = Date.now();
    await ctx.db.patch(user._id, {
      walletHeldBalance: currentHeldBalance - args.amount,
      updatedAt: now,
    });

    await ctx.db.insert("walletTransactions", {
      userId: user._id,
      type: "hold_capture",
      amount: args.amount,
      status: "completed",
      reference: args.reference,
      metadata: {
        ...(args.metadata || {}),
        originalHoldReference: args.originalHoldReference,
      },
      createdAt: now,
    });

    return {
      newBalance: currentBalance,
      heldBalance: currentHeldBalance - args.amount,
      alreadyApplied: false,
    };
  },
});

export const refundFunds = internalMutation({
  args: {
    amount: v.number(),
    userId: v.optional(v.id("users")),
    reference: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    if (args.amount <= 0) {
      throw new Error("Amount must be positive");
    }

    const user = await getWalletUserRecord(ctx, args.userId, { allowInternalUserId: true });
    const existing = await ctx.db
      .query("walletTransactions")
      .withIndex("by_reference", (q) => q.eq("reference", args.reference))
      .collect();
    if (existing.length > 0) {
      return {
        newBalance: Number(user.walletBalance || 0),
        heldBalance: Number(user.walletHeldBalance || 0),
        alreadyApplied: true,
      };
    }

    const currentBalance = Number(user.walletBalance || 0);
    const now = Date.now();
    await ctx.db.patch(user._id, {
      walletBalance: currentBalance + args.amount,
      updatedAt: now,
    });

    await ctx.db.insert("walletTransactions", {
      userId: user._id,
      type: "refund",
      amount: args.amount,
      status: "completed",
      reference: args.reference,
      metadata: args.metadata,
      createdAt: now,
    });

    return {
      newBalance: currentBalance + args.amount,
      heldBalance: Number(user.walletHeldBalance || 0),
      alreadyApplied: false,
    };
  },
});

const deductFundsArgs = {
    amount: v.number(),
    metadata: v.optional(v.any()),
    reference: v.optional(v.string()),
    source: v.optional(v.string()),
    userId: v.optional(v.id("users")),
};

export async function deductWalletFunds(
  ctx: any,
  args: {
    amount: number;
    metadata?: any;
    reference?: string;
    source?: string;
    userId?: Id<"users">;
  },
  options?: { allowInternalUserId?: boolean },
) {
  if (args.amount <= 0) {
    throw new Error("Amount must be positive");
  }

  const user = await getWalletUserRecord(ctx, args.userId, options);
  const reference = args.reference || args.source || "payment";

  if (reference) {
    const existing = await ctx.db
      .query("walletTransactions")
      .withIndex("by_reference", (q: any) => q.eq("reference", reference))
      .collect();
    if (existing.length > 0) {
      return { newBalance: user.walletBalance ?? 0 };
    }
  }

  const currentBalance = user.walletBalance ?? 0;
  if (!Number.isFinite(currentBalance) || currentBalance < args.amount) {
    throw new Error("Insufficient wallet balance. Please add funds from Wallet.");
  }

  const now = Date.now();

  // Update user wallet balance
  await ctx.db.patch(user._id, {
    walletBalance: currentBalance - args.amount,
    updatedAt: now,
  });

  // Create wallet transaction record
  await ctx.db.insert("walletTransactions", {
    userId: user._id,
    type: "withdrawal",
    amount: args.amount,
    status: "completed",
    reference,
    metadata: args.metadata,
    createdAt: now,
  });

  return { newBalance: currentBalance - args.amount };
}

// Deduct funds from wallet (for payments)
export const deductFunds = mutation({
  args: deductFundsArgs,
  handler: async (ctx, args) => {
    return await deductWalletFunds(ctx, args);
  },
});

export const deductFundsInternal = internalMutation({
  args: deductFundsArgs,
  handler: async (ctx, args) => {
    return await deductWalletFunds(ctx, args, { allowInternalUserId: true });
  },
});
