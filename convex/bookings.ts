import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ============================================
// BOOKING INTENTS
// ============================================

// Get booking intent by ID
export const getIntentById = query({
  args: { intentId: v.id("bookingIntents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.intentId);
  },
});

// List booking intents for matchroom
export const listIntentsForMatchroom = query({
  args: { matchroomId: v.id("matchrooms") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bookingIntents")
      .withIndex("by_matchroomId", (q) => q.eq("matchroomId", args.matchroomId))
      .order("desc")
      .collect();
  },
});

// List booking intents by user
export const listIntentsByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bookingIntents")
      .withIndex("by_createdByUid", (q) => q.eq("createdByUid", args.userId))
      .order("desc")
      .collect();
  },
});

// Create booking intent
export const createIntent = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    createdByUid: v.id("users"),
    side: v.union(v.literal("A"), v.literal("B")),
    selectedSlots: v.array(v.number()),
    pricing: v.optional(
      v.object({
        totalCost: v.number(),
        perPlayerCost: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const intentId = await ctx.db.insert("bookingIntents", {
      matchroomId: args.matchroomId,
      createdByUid: args.createdByUid,
      side: args.side,
      selectedSlots: args.selectedSlots,
      status: "pending_approvals",
      pricing: args.pricing,
      paymentStatus: "unpaid",
      createdAt: now,
      updatedAt: now,
    });

    return intentId;
  },
});

// Update booking intent approval
export const updateIntentApproval = mutation({
  args: {
    intentId: v.id("bookingIntents"),
    approvalType: v.union(v.literal("captain"), v.literal("zone")),
    approved: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const intent = await ctx.db.get(args.intentId);
    if (!intent) throw new Error("Booking intent not found");

    const approval = {
      approved: args.approved,
      approvedAt: now,
    };

    const updateData: Record<string, unknown> = {
      updatedAt: now,
    };

    if (args.approvalType === "captain") {
      updateData.captainApproval = approval;
    } else {
      updateData.zoneApproval = approval;
    }

    // Check if both approvals are in and update status
    const captainApproval =
      args.approvalType === "captain" ? approval : intent.captainApproval;
    const zoneApproval =
      args.approvalType === "zone" ? approval : intent.zoneApproval;

    if (captainApproval?.approved && zoneApproval?.approved) {
      updateData.status = "approved";
    } else if (
      captainApproval?.approved === false ||
      zoneApproval?.approved === false
    ) {
      updateData.status = "rejected";
    }

    await ctx.db.patch(args.intentId, updateData);
    return true;
  },
});

// Update intent payment status
export const updateIntentPaymentStatus = mutation({
  args: {
    intentId: v.id("bookingIntents"),
    paymentStatus: v.union(v.literal("unpaid"), v.literal("paid")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.intentId, {
      paymentStatus: args.paymentStatus,
      updatedAt: Date.now(),
    });
    return true;
  },
});

// ============================================
// BOOKING REQUESTS
// ============================================

// Get booking request by ID
export const getRequestById = query({
  args: { requestId: v.id("bookingRequests") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.requestId);
  },
});

// List booking requests by user
export const listRequestsByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bookingRequests")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// List booking requests by zone
export const listRequestsByZone = query({
  args: { zoneId: v.id("zones") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bookingRequests")
      .withIndex("by_zoneId", (q) => q.eq("zoneId", args.zoneId))
      .order("desc")
      .collect();
  },
});

// List open booking requests by game
export const listOpenRequestsByGame = query({
  args: { gameKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bookingRequests")
      .withIndex("by_gameKey", (q) => q.eq("gameKey", args.gameKey))
      .order("desc")
      .take(100);
  },
});

// Create booking request
export const createRequest = mutation({
  args: {
    userId: v.id("users"),
    gameKey: v.string(),
    zoneId: v.optional(v.id("zones")),
    preferredDate: v.optional(v.number()),
    preferredTime: v.optional(v.string()),
    playerCount: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const requestId = await ctx.db.insert("bookingRequests", {
      userId: args.userId,
      gameKey: args.gameKey,
      zoneId: args.zoneId,
      status: "open",
      preferredDate: args.preferredDate,
      preferredTime: args.preferredTime,
      playerCount: args.playerCount,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });

    return requestId;
  },
});

// Update booking request status
export const updateRequestStatus = mutation({
  args: {
    requestId: v.id("bookingRequests"),
    status: v.union(
      v.literal("open"),
      v.literal("pending_payment"),
      v.literal("accepted"),
      v.literal("expired"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.requestId, {
      status: args.status,
      updatedAt: Date.now(),
    });
    return true;
  },
});

// ============================================
// ZONE OFFERS
// ============================================

// Get zone offer by ID
export const getOfferById = query({
  args: { offerId: v.id("zoneOffers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.offerId);
  },
});

// List offers for booking request
export const listOffersForRequest = query({
  args: { requestId: v.id("bookingRequests") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("zoneOffers")
      .withIndex("by_requestId", (q) => q.eq("requestId", args.requestId))
      .order("desc")
      .collect();
  },
});

// List offers by zone
export const listOffersByZone = query({
  args: { zoneId: v.id("zones") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("zoneOffers")
      .withIndex("by_zoneId", (q) => q.eq("zoneId", args.zoneId))
      .order("desc")
      .collect();
  },
});

// Create zone offer
export const createOffer = mutation({
  args: {
    requestId: v.id("bookingRequests"),
    zoneId: v.id("zones"),
    proposedPrice: v.number(),
    proposedDate: v.optional(v.number()),
    proposedTime: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const offerId = await ctx.db.insert("zoneOffers", {
      requestId: args.requestId,
      zoneId: args.zoneId,
      status: "pending",
      proposedPrice: args.proposedPrice,
      proposedDate: args.proposedDate,
      proposedTime: args.proposedTime,
      message: args.message,
      createdAt: now,
      updatedAt: now,
    });

    return offerId;
  },
});

// Update zone offer status
export const updateOfferStatus = mutation({
  args: {
    offerId: v.id("zoneOffers"),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("expired")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.offerId, {
      status: args.status,
      updatedAt: Date.now(),
    });
    return true;
  },
});
