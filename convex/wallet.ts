import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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

// ============================================
// WALLET MUTATIONS
// ============================================

// Add funds to wallet (manual top-up)
export const addFunds = mutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.amount <= 0) {
      throw new Error("Amount must be positive");
    }

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const currentBalance = user.walletBalance ?? 0;
    const now = Date.now();

    // Update user wallet balance
    await ctx.db.patch(args.userId, {
      walletBalance: currentBalance + args.amount,
      updatedAt: now,
    });

    // Create wallet transaction record
    await ctx.db.insert("walletTransactions", {
      userId: args.userId,
      type: "deposit",
      amount: args.amount,
      status: "completed",
      reference: "manual_topup",
      createdAt: now,
    });

    return { newBalance: currentBalance + args.amount };
  },
});

// Deduct funds from wallet (for payments)
export const deductFunds = mutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.amount <= 0) {
      throw new Error("Amount must be positive");
    }

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const currentBalance = user.walletBalance ?? 0;
    if (!Number.isFinite(currentBalance) || currentBalance < args.amount) {
      throw new Error("Insufficient wallet balance. Please add funds from Wallet.");
    }

    const now = Date.now();

    // Update user wallet balance
    await ctx.db.patch(args.userId, {
      walletBalance: currentBalance - args.amount,
      updatedAt: now,
    });

    // Create wallet transaction record
    await ctx.db.insert("walletTransactions", {
      userId: args.userId,
      type: "withdrawal",
      amount: args.amount,
      status: "completed",
      reference: args.source || "payment",
      createdAt: now,
    });

    return { newBalance: currentBalance - args.amount };
  },
});
