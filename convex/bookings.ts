import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { PAYMENT_INTENT_TTL_MS } from "./timing";
import { requireCurrentUser, requireOwnedZone } from "./authz";
import {
  assertNoParticipantTimeConflict,
  assertZoneResourceCapacityAvailable,
  getBookingRequestStartAtForConflict,
} from "./bookingConflicts";
import { withBookingRequestLifecycleDueAt } from "./maintenanceDue";

const BOOKING_INTENT_TTL_MS = PAYMENT_INTENT_TTL_MS;

function normalizeBookingGameKey(value?: string | null) {
  const gameKey = String(value || "").trim().toLowerCase();
  return gameKey === "fc25" ? "fc26" : gameKey;
}

function serializeBookingIntent(intent: any) {
  if (!intent) return intent;
  return {
    ...intent,
    id: String(intent._id),
    intentId: String(intent._id),
    matchroomId: String(intent.matchroomId),
    createdByUid: String(intent.createdByUid),
    sourceNotificationId: intent.sourceNotificationId ? String(intent.sourceNotificationId) : undefined,
    game: normalizeBookingGameKey(intent.game),
    gameKey: normalizeBookingGameKey(intent.game),
  };
}

function serializeBookingRequest(request: any) {
  if (!request) return request;
  return {
    ...request,
    id: String(request._id),
    requestId: String(request._id),
    userId: String(request.userId),
    zoneId: request.zoneId ? String(request.zoneId) : undefined,
    matchroomId: request.matchroomId ? String(request.matchroomId) : undefined,
    allocatedResourceIds: Array.isArray(request.allocatedResourceIds)
      ? request.allocatedResourceIds.map((resourceId: any) => String(resourceId))
      : undefined,
    gameKey: normalizeBookingGameKey(request.gameKey),
  };
}

function serializeZoneOffer(offer: any) {
  if (!offer) return offer;
  return {
    ...offer,
    id: String(offer._id),
    offerId: String(offer._id),
    requestId: String(offer.requestId),
    zoneId: String(offer.zoneId),
  };
}

async function resolveUserByAnyId(ctx: any, value?: string | null) {
  if (!value) return null;

  try {
    const directUser = await ctx.db.get(value as Id<"users">);
    if (directUser) {
      return directUser;
    }
  } catch {
    // Ignore invalid IDs and fall back to authId lookup.
  }

  return await ctx.db
    .query("users")
    .withIndex("by_authId", (q: any) => q.eq("authId", value))
    .unique();
}

async function notifyZoneOwnerOfRequest(
  ctx: any,
  input: {
    requestId: Id<"bookingRequests">;
    requesterId: Id<"users">;
    zoneId?: Id<"zones">;
    gameKey: string;
    title?: string;
    playerCount: number;
  },
) {
  if (!input.zoneId) return;

  const zone = await ctx.db.get(input.zoneId);
  if (!zone?.ownerUid) return;

  const requester = await ctx.db.get(input.requesterId);
  const zoneName = zone.venueBrandName || zone.name || "your venue";
  const playerName = requester?.username || requester?.fullName || "A player";
  const gameLabel = normalizeBookingGameKey(input.gameKey).toUpperCase();
  const requestTitle = input.title?.trim() || `${gameLabel} booking request`;
  const now = Date.now();
  const requestRoute = `/zone/modules/bookings?segment=requests&requestId=${encodeURIComponent(String(input.requestId))}&expandedRequestId=${encodeURIComponent(String(input.requestId))}&focusRequestId=${encodeURIComponent(String(input.requestId))}`;

  await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
    type: "booking.request_submitted",
    fromUid: input.requesterId,
    fromUsername: requester?.username || requester?.fullName || "Player",
    toUid: zone.ownerUid,
    recipientRole: "zone_admin",
    status: "pending",
    dedupeKey: `booking.request_submitted:${String(input.requestId)}:${String(zone.ownerUid)}`,
    dedupePolicy: "upsert_active",
    entity: { kind: "booking_request", id: String(input.requestId) },
    route: requestRoute,
    title: "New booking request",
    body: `${playerName} requested ${requestTitle} at ${zoneName}.`,
    data: {
      requestId: String(input.requestId),
      zoneId: String(input.zoneId),
      zoneName,
      gameKey: normalizeBookingGameKey(input.gameKey),
      title: requestTitle,
      playerCount: input.playerCount,
      route: requestRoute,
      href: requestRoute,
    },
  });
}

async function getAuthenticatedBookingUser(ctx: any, expectedUid?: Id<"users">) {
  const expectedUser = expectedUid ? await ctx.db.get(expectedUid) : null;
  const actor = await requireCurrentUser(ctx);
  if (expectedUser && String(expectedUser._id) !== String(actor.user._id)) {
    throw new Error("You can only perform this action for your own booking.");
  }
  return actor.user;
}

async function canActorAccessIntent(ctx: any, actorUserId: Id<"users">, intent: any) {
  if (String(intent.createdByUid) === String(actorUserId)) return true;
  const room = await ctx.db.get(intent.matchroomId);
  if (!room) return false;
  const actor = String(actorUserId);
  if (String(room.hostUid || "") === actor) return true;
  if (String(room.captainUidA || "") === actor || String(room.captainUidB || "") === actor) return true;
  if (room.zoneId) {
    const zone = await ctx.db.get(room.zoneId as Id<"zones">);
    if (String(zone?.ownerUid || "") === actor) return true;
  }
  return false;
}

async function requireActorCanAccessIntent(ctx: any, intent: any) {
  const actor = await requireCurrentUser(ctx);
  if (!(await canActorAccessIntent(ctx, actor.user._id, intent))) {
    throw new Error("Booking intent not found");
  }
  return actor;
}

// ============================================
// BOOKING INTENTS
// ============================================

// Get booking intent by ID
export const getIntentById = query({
  args: { intentId: v.id("bookingIntents") },
  handler: async (ctx, args) => {
    const intent = await ctx.db.get(args.intentId);
    if (!intent) return null;
    try {
      await requireActorCanAccessIntent(ctx, intent);
    } catch {
      return null;
    }
    return serializeBookingIntent(intent);
  },
});

// List booking intents for matchroom
export const listIntentsForMatchroom = query({
  args: { matchroomId: v.id("matchrooms") },
  handler: async (ctx, args) => {
    const actor = await requireCurrentUser(ctx);
    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new Error("Matchroom not found");
    const actorId = String(actor.user._id);
    let allowed = String(room.hostUid || "") === actorId
      || String(room.captainUidA || "") === actorId
      || String(room.captainUidB || "") === actorId
      || (Array.isArray(room.playerUids) && room.playerUids.map(String).includes(actorId));
    if (!allowed && room.zoneId) {
      const zone = await ctx.db.get(room.zoneId as Id<"zones">);
      allowed = String(zone?.ownerUid || "") === actorId;
    }
    if (!allowed) throw new Error("Not authorized");
    const intents = await ctx.db
      .query("bookingIntents")
      .withIndex("by_matchroomId", (q) => q.eq("matchroomId", args.matchroomId))
      .order("desc")
      .collect();
    return intents.map(serializeBookingIntent);
  },
});

// List booking intents by user
export const listIntentsByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedBookingUser(ctx, args.userId);
    const intents = await ctx.db
      .query("bookingIntents")
      .withIndex("by_createdByUid", (q) => q.eq("createdByUid", user._id))
      .order("desc")
      .collect();
    return intents.map(serializeBookingIntent);
  },
});

export const listActiveIntentsByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedBookingUser(ctx, args.userId);
    const now = Date.now();
    const intents = await ctx.db
      .query("bookingIntents")
      .withIndex("by_createdByUid", (q) => q.eq("createdByUid", user._id))
      .order("desc")
      .collect();

    return intents.filter((intent: any) =>
      intent.paymentStatus !== "paid" &&
      (!intent.expiresAt || intent.expiresAt > now) &&
      (intent.status === "approved_pending_payment" ||
        intent.status === "pending_approvals" ||
        intent.status === "approved")
    ).map(serializeBookingIntent);
  },
});

export const listActiveIntentsByUserForMatchroom = query({
  args: {
    userId: v.id("users"),
    matchroomId: v.id("matchrooms"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedBookingUser(ctx, args.userId);
    const now = Date.now();
    const intents = await ctx.db
      .query("bookingIntents")
      .withIndex("by_createdByUid_matchroomId", (q) =>
        q.eq("createdByUid", user._id).eq("matchroomId", args.matchroomId)
      )
      .collect();

    return intents.filter((intent: any) =>
      intent.paymentStatus !== "paid" &&
      (!intent.expiresAt || intent.expiresAt > now) &&
      (intent.status === "approved_pending_payment" ||
        intent.status === "pending_approvals" ||
        intent.status === "approved")
    ).map(serializeBookingIntent);
  },
});

// Create booking intent
export const createIntent = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    createdByUid: v.id("users"),
    createdByUsername: v.optional(v.string()),
    side: v.union(v.literal("A"), v.literal("B")),
    selectedSlots: v.array(v.number()),
    selectedSlotIds: v.optional(v.array(v.string())),
    role: v.optional(v.string()),
    source: v.optional(
      v.union(v.literal("direct_join"), v.literal("captain_approved_join"), v.literal("captain_invite"))
    ),
    sourceNotificationId: v.optional(v.id("notifications")),
    pricing: v.optional(
      v.object({
        totalCost: v.number(),
        perPlayerCost: v.number(),
        currency: v.optional(v.string()),
      })
    ),
    game: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("pending_approvals"),
        v.literal("approved"),
        v.literal("approved_pending_payment"),
        v.literal("confirmed"),
        v.literal("rejected"),
        v.literal("expired"),
        v.literal("cancelled")
      )
    ),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await getAuthenticatedBookingUser(ctx, args.createdByUid);

    const intentId = await ctx.db.insert("bookingIntents", {
      matchroomId: args.matchroomId,
      createdByUid: user._id,
      createdByUsername: user.username || args.createdByUsername,
      side: args.side,
      selectedSlots: args.selectedSlots,
      selectedSlotIds: args.selectedSlotIds,
      role: args.role,
      source: args.source,
      sourceNotificationId: args.sourceNotificationId,
      status: args.status || "pending_approvals",
      pricing: args.pricing,
      game: normalizeBookingGameKey(args.game),
      paymentStatus: "unpaid",
      expiresAt: args.expiresAt || now + BOOKING_INTENT_TTL_MS,
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
    const actor = await requireActorCanAccessIntent(ctx, intent);
    const room = await ctx.db.get(intent.matchroomId);
    if (!room) throw new Error("Matchroom not found");
    if (args.approvalType === "captain") {
      const actorId = String(actor.user._id);
      if (String(room.hostUid || "") !== actorId && String(room.captainUidA || "") !== actorId && String(room.captainUidB || "") !== actorId) {
        throw new Error("Captain approval requires matchroom captain or host.");
      }
    } else {
      if (!room.zoneId) throw new Error("This booking has no zone approval.");
      await requireOwnedZone(ctx, room.zoneId as Id<"zones">);
    }

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
    if (args.paymentStatus === "paid") {
      throw new Error("Payment status is updated by the payment processor.");
    }
    const intent = await ctx.db.get(args.intentId);
    if (!intent) throw new Error("Booking intent not found");
    await requireActorCanAccessIntent(ctx, intent);
    await ctx.db.patch(args.intentId, {
      paymentStatus: args.paymentStatus,
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const cancelIntent = mutation({
  args: {
    intentId: v.id("bookingIntents"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedBookingUser(ctx, args.userId);
    const intent = await ctx.db.get(args.intentId);
    if (!intent) throw new Error("Booking intent not found");
    if (String(intent.createdByUid) !== String(user._id)) {
      throw new Error("You can only cancel your own booking.");
    }
    if (intent.paymentStatus === "paid" || intent.status === "confirmed") {
      throw new Error("Paid bookings cannot be cancelled here.");
    }

    const now = Date.now();
    await ctx.db.patch(args.intentId, {
      status: "cancelled",
      updatedAt: now,
    });

    if (intent.sourceNotificationId) {
      await ctx.db.patch(intent.sourceNotificationId, {
        status: "declined",
        updatedAt: now,
      });
    }

    return { ok: true };
  },
});

// ============================================
// BOOKING REQUESTS
// ============================================

// Get booking request by ID
export const getRequestById = query({
  args: { requestId: v.id("bookingRequests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) return null;
    const actor = await requireCurrentUser(ctx);
    let allowed = String(request.userId) === String(actor.user._id);
    if (!allowed && request.zoneId) {
      const zone = await ctx.db.get(request.zoneId);
      allowed = String(zone?.ownerUid || "") === String(actor.user._id);
    }
    if (!allowed) throw new Error("Booking request not found");
    return serializeBookingRequest(request);
  },
});

// List booking requests by user
export const listRequestsByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedBookingUser(ctx, args.userId);
    const requests = await ctx.db
      .query("bookingRequests")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
    return requests.map(serializeBookingRequest);
  },
});

// List booking requests by zone
export const listRequestsByZone = query({
  args: { zoneId: v.id("zones") },
  handler: async (ctx, args) => {
    await requireOwnedZone(ctx, args.zoneId);
    const requests = await ctx.db
      .query("bookingRequests")
      .withIndex("by_zoneId", (q) => q.eq("zoneId", args.zoneId))
      .order("desc")
      .collect();
    return requests.map(serializeBookingRequest);
  },
});

// List open booking requests by game
export const listOpenRequestsByGame = query({
  args: { gameKey: v.string() },
  handler: async (ctx, args) => {
    const requests = await ctx.db
      .query("bookingRequests")
      .withIndex("by_gameKey", (q) => q.eq("gameKey", args.gameKey))
      .order("desc")
      .take(100);
    return requests.map(serializeBookingRequest);
  },
});

// Create booking request
export const createRequest = mutation({
  args: {
    userId: v.id("users"),
    gameKey: v.string(),
    zoneId: v.optional(v.id("zones")),
    userName: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    maxPlayers: v.optional(v.number()),
    format: v.optional(v.string()),
    seriesType: v.optional(v.string()),
    durationHours: v.optional(v.number()),
    selectedMaps: v.optional(v.array(v.string())),
    skillLevel: v.optional(v.string()),
    hostSkillScore: v.optional(v.number()),
    hostSkillTier: v.optional(v.string()),
    hostSkillContext: v.optional(v.any()),
    overs: v.optional(v.string()),
    teamMode: v.optional(v.union(v.literal("solo"), v.literal("team"))),
    teamId: v.optional(v.string()),
    reservedSlots: v.optional(v.number()),
    preferredDate: v.optional(v.number()),
    preferredTime: v.optional(v.string()),
    flexibilityWindow: v.optional(v.string()),
    locationMode: v.optional(v.union(v.literal("zone"), v.literal("broadcast"))),
    preferredAreas: v.optional(v.array(v.string())),
    budgetPerPlayer: v.optional(v.number()),
    currency: v.optional(v.string()),
    playerCount: v.number(),
    paymentStatus: v.optional(v.union(v.literal("paid"), v.literal("unpaid"))),
    paymentAmount: v.optional(v.number()),
    paymentReservedSlots: v.optional(v.number()),
    requestedResourceAssetType: v.optional(v.string()),
    requestedResourceSurface: v.optional(v.string()),
    requestedResourceTier: v.optional(v.string()),
    selectedZoneRateKey: v.optional(v.string()),
    matchroomId: v.optional(v.id("matchrooms")),
    lifecycleStatus: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const normalizedGameKey = normalizeBookingGameKey(args.gameKey);
    const user = await getAuthenticatedBookingUser(ctx, args.userId);
    const scheduledStartAt = getBookingRequestStartAtForConflict(args);
    const durationMinutes = Math.max(1, Math.round(Number(args.durationHours || 1) * 60));

    if (args.matchroomId) {
      const existingByUser = await ctx.db
        .query("bookingRequests")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect();
      const existing = existingByUser.find(
        (request) => String((request as any).matchroomId || "") === String(args.matchroomId),
      );
      if (existing) {
        return existing._id;
      }
    }

    await assertNoParticipantTimeConflict(ctx, {
      userIds: [String(user._id)],
      scheduledStartAt,
      durationMinutes,
      excludeMatchroomId: args.matchroomId ? String(args.matchroomId) : null,
      message: "You already have a matchroom or booking request scheduled at this time.",
    });

    if (args.zoneId) {
      await assertZoneResourceCapacityAvailable(ctx, {
        zoneId: String(args.zoneId),
        gameKey: normalizedGameKey,
        requestedResourceAssetType: args.requestedResourceAssetType,
        requestedResourceSurface: args.requestedResourceSurface,
        requestedResourceTier: args.requestedResourceTier,
        selectedZoneRateKey: args.selectedZoneRateKey,
        scheduledStartAt,
        durationMinutes,
        excludeMatchroomId: args.matchroomId ? String(args.matchroomId) : null,
      });
    }

    const linkedRoom = args.matchroomId
      ? await ctx.db.get(args.matchroomId).catch(() => null)
      : null;
    const requestId = await ctx.db.insert("bookingRequests", withBookingRequestLifecycleDueAt(null, linkedRoom, {
      userId: user._id,
      gameKey: normalizedGameKey,
      zoneId: args.zoneId,
      userName: args.userName,
      title: args.title,
      description: args.description,
      maxPlayers: args.maxPlayers,
      format: args.format,
      seriesType: args.seriesType,
      durationHours: args.durationHours,
      selectedMaps: args.selectedMaps,
      skillLevel: args.skillLevel,
      hostSkillScore: args.hostSkillScore,
      hostSkillTier: args.hostSkillTier,
      hostSkillContext: args.hostSkillContext,
      overs: args.overs,
      teamMode: args.teamMode,
      teamId: args.teamId,
      reservedSlots: args.reservedSlots,
      status: "open",
      preferredDate: args.preferredDate,
      preferredTime: args.preferredTime,
      flexibilityWindow: args.flexibilityWindow,
      locationMode: args.locationMode,
      preferredAreas: args.preferredAreas,
      budgetPerPlayer: args.budgetPerPlayer,
      currency: args.currency,
      playerCount: args.playerCount,
      paymentStatus: args.paymentStatus,
      paymentAmount: args.paymentAmount,
      paymentReservedSlots: args.paymentReservedSlots,
      requestedResourceAssetType: args.requestedResourceAssetType,
      requestedResourceSurface: args.requestedResourceSurface,
      requestedResourceTier: args.requestedResourceTier,
      selectedZoneRateKey: args.selectedZoneRateKey,
      matchroomId: args.matchroomId,
      lifecycleStatus: args.lifecycleStatus,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    }, now));

    await notifyZoneOwnerOfRequest(ctx, {
      requestId,
      requesterId: user._id,
      zoneId: args.zoneId,
      gameKey: normalizedGameKey,
      title: args.title,
      playerCount: args.playerCount,
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
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Booking request not found");
    if (request.zoneId) {
      await requireOwnedZone(ctx, request.zoneId);
    } else {
      const actor = await requireCurrentUser(ctx);
      if (String(request.userId) !== String(actor.user._id)) throw new Error("Not authorized");
    }
    const linkedRoom = request.matchroomId
      ? await ctx.db.get(request.matchroomId).catch(() => null)
      : null;
    const now = Date.now();
    await ctx.db.patch(args.requestId, withBookingRequestLifecycleDueAt(request, linkedRoom, {
      status: args.status,
      updatedAt: now,
    }, now));
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
    const offer = await ctx.db.get(args.offerId);
    if (!offer) return null;
    const request = await ctx.db.get(offer.requestId);
    const actor = await requireCurrentUser(ctx);
    let allowed = request && String(request.userId) === String(actor.user._id);
    if (!allowed) {
      const zone = await ctx.db.get(offer.zoneId);
      allowed = String(zone?.ownerUid || "") === String(actor.user._id);
    }
    if (!allowed) throw new Error("Offer not found");
    return serializeZoneOffer(offer);
  },
});

// List offers for booking request
export const listOffersForRequest = query({
  args: { requestId: v.id("bookingRequests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Booking request not found");
    const actor = await requireCurrentUser(ctx);
    let allowed = String(request.userId) === String(actor.user._id);
    if (!allowed && request.zoneId) {
      const zone = await ctx.db.get(request.zoneId);
      allowed = String(zone?.ownerUid || "") === String(actor.user._id);
    }
    if (!allowed) throw new Error("Not authorized");
    const offers = await ctx.db
      .query("zoneOffers")
      .withIndex("by_requestId", (q) => q.eq("requestId", args.requestId))
      .order("desc")
      .collect();
    return offers.map(serializeZoneOffer);
  },
});

// List offers by zone
export const listOffersByZone = query({
  args: { zoneId: v.id("zones") },
  handler: async (ctx, args) => {
    await requireOwnedZone(ctx, args.zoneId);
    const offers = await ctx.db
      .query("zoneOffers")
      .withIndex("by_zoneId", (q) => q.eq("zoneId", args.zoneId))
      .order("desc")
      .collect();
    return offers.map(serializeZoneOffer);
  },
});

export const listOffersForUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedBookingUser(ctx, args.userId);
    const requests = await ctx.db
      .query("bookingRequests")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    if (requests.length === 0) {
      return [];
    }

    const offersByRequest = await Promise.all(
      requests.map((request) =>
        ctx.db
          .query("zoneOffers")
          .withIndex("by_requestId", (q) => q.eq("requestId", request._id))
          .collect(),
      ),
    );

    return offersByRequest.flat().map(serializeZoneOffer);
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
    await requireOwnedZone(ctx, args.zoneId);

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
    const offer = await ctx.db.get(args.offerId);
    if (!offer) throw new Error("Offer not found");
    const request = await ctx.db.get(offer.requestId);
    const actor = await requireCurrentUser(ctx);
    let allowed = request && String(request.userId) === String(actor.user._id);
    if (!allowed) {
      const zone = await ctx.db.get(offer.zoneId);
      allowed = String(zone?.ownerUid || "") === String(actor.user._id);
    }
    if (!allowed) throw new Error("Not authorized");
    await ctx.db.patch(args.offerId, {
      status: args.status,
      updatedAt: Date.now(),
    });
    return true;
  },
});
