import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Slot validator (matching schema)
const slotValidator = v.object({
  slotId: v.string(),
  uid: v.optional(v.string()),
  user: v.optional(v.object({
    uid: v.string(),
    username: v.string(),
    photoURL: v.optional(v.string()),
    skillTier: v.optional(v.string()),
  })),
  status: v.union(v.literal("open"), v.literal("reserved"), v.literal("confirmed")),
  reservedFor: v.optional(v.object({
    uid: v.string(),
    username: v.string(),
    photoURL: v.optional(v.string()),
  })),
  reservedForUid: v.optional(v.string()),
  role: v.optional(v.string()),
});

// Player validator
const playerValidator = v.object({
  uid: v.string(),
  username: v.string(),
  joinedAt: v.number(),
  role: v.optional(v.string()),
  skillTier: v.optional(v.string()),
  character: v.optional(v.string()),
  favouriteClub: v.optional(v.string()),
  formation: v.optional(v.string()),
});

// ============================================
// QUERIES
// ============================================

// List booking requests for zone queue (by areas or direct zoneId)
export const listBookingQueueForZone = query({
  args: {
    zoneId: v.string(),
    branchAreas: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const activeStatuses = new Set(["open", "pending_payment", "accepted"]);

    // Get requests directed to this zone
    const directRequests = await ctx.db
      .query("bookingRequests")
      .withIndex("by_status")
      .collect();

    // Filter for active requests that match zoneId or areas
    const normalizedAreas = new Set(
      args.branchAreas
        .map((a) => a.trim())
        .filter(Boolean)
    );

    const filtered = directRequests.filter((r) => {
      if (!activeStatuses.has(r.status)) return false;
      // Match by zoneId
      if (r.zoneId && String(r.zoneId) === args.zoneId) return true;
      // No area matching possible with current schema (bookingRequests doesn't have preferredAreas)
      return false;
    });

    return filtered
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => ({ ...r, id: r._id }));
  },
});

// List matchrooms for zone admin (by zoneId, ownerUid, location)
export const listMatchroomsForZone = query({
  args: {
    zoneId: v.string(),
    ownerUid: v.optional(v.string()),
    locationHints: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const merged = new Map<string, any>();

    // By zoneId
    const byZone = await ctx.db
      .query("matchrooms")
      .withIndex("by_zoneId", (q) => q.eq("zoneId", args.zoneId))
      .order("desc")
      .collect();

    byZone.forEach((m) => merged.set(String(m._id), { ...m, id: m._id }));

    // By ownerUid
    if (args.ownerUid) {
      const allMatchrooms = await ctx.db
        .query("matchrooms")
        .withIndex("by_createdAt")
        .order("desc")
        .take(200);

      allMatchrooms
        .filter((m) => m.zoneOwnerUid === args.ownerUid)
        .forEach((m) => merged.set(String(m._id), { ...m, id: m._id }));
    }

    // By location hints
    if (args.locationHints && args.locationHints.length > 0) {
      const locationSet = new Set(args.locationHints.map((l) => l.trim()).filter(Boolean));
      if (locationSet.size > 0) {
        const allMatchrooms = await ctx.db
          .query("matchrooms")
          .withIndex("by_createdAt")
          .order("desc")
          .take(200);

        allMatchrooms
          .filter((m) => m.location && locationSet.has(m.location))
          .forEach((m) => merged.set(String(m._id), { ...m, id: m._id }));
      }
    }

    return Array.from(merged.values())
      .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
  },
});

// ============================================
// MUTATIONS
// ============================================

// Accept a zone booking request
export const acceptBookingRequest = mutation({
  args: {
    requestId: v.id("bookingRequests"),
    adminUid: v.string(),
    zoneId: v.string(),
    requestOwnerUid: v.optional(v.string()),
    note: v.optional(v.string()),
    branchId: v.optional(v.string()),
    branchName: v.optional(v.string()),
    location: v.optional(v.string()),
    zoneName: v.optional(v.string()),
    // Matchroom data
    matchroomData: v.object({
      hostUid: v.string(),
      hostName: v.string(),
      game: v.string(),
      title: v.string(),
      description: v.optional(v.string()),
      maxPlayers: v.number(),
      players: v.array(playerValidator),
      playerUids: v.array(v.string()),
      location: v.optional(v.string()),
      locationMode: v.optional(v.string()),
      scheduledDate: v.optional(v.string()),
      scheduledTime: v.optional(v.string()),
      durationMinutes: v.optional(v.number()),
      pricing: v.object({
        perPlayer: v.number(),
        currency: v.string(),
      }),
      slotsA: v.array(slotValidator),
      slotsB: v.array(slotValidator),
      format: v.optional(v.string()),
      seriesType: v.optional(v.string()),
      selectedMaps: v.optional(v.array(v.string())),
      skillLevel: v.optional(v.string()),
      hostSkillTier: v.optional(v.string()),
      teamMode: v.optional(v.string()),
      teamId: v.optional(v.string()),
      reservedSlots: v.optional(v.number()),
      paymentStatus: v.optional(v.string()),
      paymentAmount: v.optional(v.number()),
      paymentReservedSlots: v.optional(v.number()),
      paymentCurrency: v.optional(v.string()),
      isLocked: v.optional(v.boolean()),
      zoneAdminApproved: v.optional(v.boolean()),
      overs: v.optional(v.number()),
      durationHours: v.optional(v.number()),
      hostSkillScore: v.optional(v.number()),
      hostSkillContext: v.optional(v.any()),
      flexibility: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Create matchroom
    const matchroomId = await ctx.db.insert("matchrooms", {
      ...args.matchroomData,
      status: "open",
      currentPlayers: args.matchroomData.players.length,
      zoneId: args.zoneId,
      locationMode: (args.matchroomData.locationMode as any) || "zone",
      captainUidA: args.matchroomData.hostUid,
      isLocked: args.matchroomData.isLocked,
      zoneAdminApproved: args.matchroomData.zoneAdminApproved ?? true,
      paymentStatus: (args.matchroomData.paymentStatus as any) || "unpaid",
      teamMode: args.matchroomData.teamMode as any,
      bookingSource: "zone_accepted",
      createdAt: now,
      updatedAt: now,
    });

    // Update booking request
    await ctx.db.patch(args.requestId, {
      status: "accepted",
      updatedAt: now,
    });

    // Send notification if requestOwnerUid provided
    if (args.requestOwnerUid) {
      // Look up user by authId
      const users = await ctx.db
        .query("users")
        .withIndex("by_authId", (q) => q.eq("authId", args.requestOwnerUid!))
        .take(1);

      if (users.length > 0) {
        await ctx.db.insert("notifications", {
          type: "booking_request_accepted",
          fromUid: undefined,
          toUid: users[0]._id,
          status: "pending",
          title: "Booking request accepted",
          body: "Your booking request was accepted by the venue.",
          data: {
            requestId: String(args.requestId),
            zoneId: args.zoneId,
            branchId: args.branchId || null,
            matchroomId: String(matchroomId),
          },
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return { matchroomId: String(matchroomId) };
  },
});

// Reject a zone booking request
export const rejectBookingRequest = mutation({
  args: {
    requestId: v.id("bookingRequests"),
    adminUid: v.string(),
    zoneId: v.string(),
    requestOwnerUid: v.optional(v.string()),
    reason: v.string(),
    note: v.optional(v.string()),
    alternative: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.patch(args.requestId, {
      status: "cancelled",
      updatedAt: now,
    });

    if (args.requestOwnerUid) {
      const users = await ctx.db
        .query("users")
        .withIndex("by_authId", (q) => q.eq("authId", args.requestOwnerUid!))
        .take(1);

      if (users.length > 0) {
        await ctx.db.insert("notifications", {
          type: "booking_request_rejected",
          toUid: users[0]._id,
          status: "pending",
          title: "Booking request declined",
          body: args.alternative
            ? `Reason: ${args.reason}. Alternative: ${args.alternative}`
            : `Reason: ${args.reason}`,
          data: {
            requestId: String(args.requestId),
            zoneId: args.zoneId,
          },
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return true;
  },
});

// Send counter-offer for a booking request
export const sendCounterOffer = mutation({
  args: {
    requestId: v.id("bookingRequests"),
    requestOwnerUid: v.string(),
    zoneId: v.id("zones"),
    zoneName: v.string(),
    zoneOwnerUid: v.string(),
    branchId: v.optional(v.string()),
    branchName: v.optional(v.string()),
    proposedDate: v.string(),
    proposedTime: v.string(),
    pricePerPlayer: v.number(),
    currency: v.optional(v.string()),
    location: v.optional(v.string()),
    message: v.optional(v.string()),
    expiresInMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const currency = args.currency || "PKR";

    // Create zone offer
    const offerId = await ctx.db.insert("zoneOffers", {
      requestId: args.requestId,
      zoneId: args.zoneId,
      status: "pending",
      proposedPrice: args.pricePerPlayer,
      proposedDate: undefined,
      proposedTime: args.proposedTime,
      message: args.message,
      createdAt: now,
      updatedAt: now,
    });

    // Update request status
    await ctx.db.patch(args.requestId, {
      updatedAt: now,
    });

    // Send notification
    const users = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.requestOwnerUid))
      .take(1);

    if (users.length > 0) {
      await ctx.db.insert("notifications", {
        type: "booking_counter_offer",
        toUid: users[0]._id,
        status: "pending",
        title: "Counter-offer received",
        body: `New offer: ${currency} ${args.pricePerPlayer} per player`,
        data: {
          requestId: String(args.requestId),
          zoneId: String(args.zoneId),
          proposedDate: args.proposedDate,
          proposedTime: args.proposedTime,
          branchId: args.branchId || null,
        },
        createdAt: now,
        updatedAt: now,
      });
    }

    return String(offerId);
  },
});

// Create a walk-in matchroom
export const createWalkInMatchroom = mutation({
  args: {
    zoneId: v.string(),
    zoneOwnerUid: v.string(),
    branchId: v.optional(v.string()),
    branchName: v.optional(v.string()),
    adminUid: v.string(),
    adminName: v.string(),
    gameKey: v.string(),
    title: v.string(),
    scheduledDate: v.string(),
    scheduledTime: v.string(),
    durationMinutes: v.number(),
    seriesType: v.optional(v.string()),
    seatCount: v.number(),
    bookedSeatCount: v.optional(v.number()),
    paymentMode: v.union(v.literal("venue_pay"), v.literal("guest_pay")),
    pricePerPlayer: v.optional(v.number()),
    currency: v.optional(v.string()),
    captainSeatNumber: v.optional(v.number()),
    knownPlayers: v.optional(v.array(v.object({
      uid: v.string(),
      username: v.string(),
      skillTier: v.optional(v.string()),
      seatNumber: v.optional(v.number()),
      isCaptain: v.optional(v.boolean()),
    }))),
    // Pre-computed data from client
    slotsA: v.array(slotValidator),
    slotsB: v.array(slotValidator),
    captainUidA: v.optional(v.string()),
    captainUidB: v.optional(v.string()),
    players: v.array(playerValidator),
    playerUids: v.array(v.string()),
    currentPlayers: v.number(),
    paymentStatus: v.union(v.literal("paid"), v.literal("unpaid")),
    walkIn: v.any(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const pricePerPlayer = args.pricePerPlayer ?? 0;

    const matchroomId = await ctx.db.insert("matchrooms", {
      hostUid: args.adminUid,
      hostName: args.adminName || "Zone Admin",
      game: args.gameKey,
      title: args.title.trim() || "Walk-in Matchroom",
      description: "Created from admin walk-in flow",
      status: "open",
      bookingSource: "walkin",
      maxPlayers: args.seatCount,
      currentPlayers: args.currentPlayers,
      players: args.players,
      playerUids: args.playerUids,
      locationMode: "zone",
      zoneId: args.zoneId,
      zoneOwnerUid: args.zoneOwnerUid,
      scheduledDate: args.scheduledDate,
      scheduledTime: args.scheduledTime,
      durationMinutes: Math.max(30, Math.floor(args.durationMinutes)),
      seriesType: args.seriesType,
      slotsA: args.slotsA,
      slotsB: args.slotsB,
      captainUidA: args.captainUidA,
      captainUidB: args.captainUidB,
      pricing: {
        perPlayer: pricePerPlayer,
        currency: args.currency || "PKR",
      },
      paymentStatus: args.paymentStatus,
      walkIn: args.walkIn,
      createdAt: now,
      updatedAt: now,
    });

    return String(matchroomId);
  },
});
