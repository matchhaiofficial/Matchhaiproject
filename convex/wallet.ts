import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { Id } from "./_generated/dataModel";

async function getWalletUserRecord(
  ctx: any,
  userId?: Id<"users">,
) {
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

    if (user) {
      return user;
    }
  }

  if (userId) {
    const user = await ctx.db.get(userId);
    if (user) {
      return user;
    }
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
    const user = await ctx.db.get(args.userId);
    return user?.walletBalance ?? 0;
  },
});

// List wallet transactions for a user
export const listTransactions = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("walletTransactions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const listHistory = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const [walletRows, paymentRows] = await Promise.all([
      ctx.db
        .query("walletTransactions")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .collect(),
      ctx.db
        .query("paymentTransactions")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .collect(),
    ]);

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
          linkedPayment?.providerDescription
          || metadata.sourceLabel
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
        subtitle: row.providerDescription || row.paymentMethod || null,
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

    const user = await getWalletUserRecord(ctx, args.userId);
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
    await ctx.db.insert("walletTransactions", {
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

    return { reference, createdAt: now, walletBalance };
  },
});


// ============================================
// WALLET MUTATIONS
// ============================================

// Add funds to wallet (manual top-up)
export const addFunds = mutation({
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

    const user = await getWalletUserRecord(ctx, args.userId);
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

// Deduct funds from wallet (for payments)
export const deductFunds = mutation({
  args: {
    amount: v.number(),
    metadata: v.optional(v.any()),
    reference: v.optional(v.string()),
    source: v.optional(v.string()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    if (args.amount <= 0) {
      throw new Error("Amount must be positive");
    }

    const user = await getWalletUserRecord(ctx, args.userId);

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
      reference: args.reference || args.source || "payment",
      metadata: args.metadata,
      createdAt: now,
    });

    return { newBalance: currentBalance - args.amount };
  },
});
