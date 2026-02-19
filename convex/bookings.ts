import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";
import { sendNotification } from "./lib/notifications";

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const toMillis = (value: any) => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  return 0;
};

const toDateString = (value: any) => {
  if (!value) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length >= 8) return trimmed;
  }
  const millis = toMillis(value);
  if (!millis) return undefined;
  return new Date(millis).toISOString().slice(0, 10);
};

const toTimeString = (value: any) => {
  if (!value) return undefined;
  if (typeof value === "string") return value.trim();
  const millis = toMillis(value);
  if (!millis) return undefined;
  return new Date(millis).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const toDurationMinutes = (request: Record<string, any>) => {
  const gameKey = String(request.gameKey || "").toLowerCase();
  const seriesType = String(request.seriesType || "").toUpperCase();
  const overs = String(request.overs || "").trim();

  if (gameKey === "futsal") {
    const hours = Number(request.durationHours || 0);
    if (Number.isFinite(hours) && hours > 0) return Math.round(hours * 60);
    return 60;
  }
  if (gameKey === "indoor_cricket") {
    if (overs === "6") return 150;
    if (overs === "5") return 120;
    return 120;
  }
  if (gameKey === "cs2") {
    if (seriesType === "BO1") return 60;
    if (seriesType === "BO3") return 180;
    if (seriesType === "BO5") return 300;
    if (seriesType === "BO10") return 600;
    return 60;
  }
  if (gameKey === "fc26") {
    if (seriesType === "BO1") return 30;
    if (seriesType === "BO3") return 60;
    if (seriesType === "BO5") return 120;
    if (seriesType === "BO10") return 180;
    return 60;
  }
  if (gameKey === "tekken8") {
    if (seriesType === "BO7") return 60;
    if (seriesType === "BO20") return 120;
    if (seriesType === "BO40") return 180;
    return 60;
  }
  if (gameKey === "padel" || gameKey === "pickleball") {
    if (seriesType === "BO5") return 120;
    if (seriesType === "BO10") return 180;
    return 60;
  }
  return 60;
};

const computeAssetTypeFromGame = (gameKey: string) => {
  const key = String(gameKey || "").toLowerCase();
  if (["cs2", "fc25", "fc26", "tekken8"].includes(key)) return "pc";
  if (["futsal", "indoor_cricket", "padel", "pickleball"].includes(key)) return "court";
  return "unknown";
};

const uniqueStrings = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const collectZoneOwnersForAreas = async (ctx: any, areas: string[]) => {
  const ownerUids = new Set<string>();
  const trimmed = uniqueStrings(areas.map((value) => String(value || "").trim())).slice(0, 10);
  for (const area of trimmed) {
    const zones = await ctx.db
      .query("zones")
      .withIndex("by_primaryArea", (q: any) => q.eq("primaryArea", area))
      .collect();
    zones.forEach((zone: any) => {
      if (zone.status === "active" && zone.ownerUid) ownerUids.add(zone.ownerUid);
    });
  }
  return Array.from(ownerUids);
};

const createMatchroomFromOffer = async (
  ctx: any,
  request: Record<string, any>,
  offer: Record<string, any>,
  user: { uid: string; username?: string | null; displayName?: string | null }
) => {
  const scheduledDate = toDateString(offer.proposedDate || request.preferredDate);
  const scheduledTime = toTimeString(offer.proposedTime || request.preferredTime);
  const paymentSlots = Number(request.paymentReservedSlots || request.reservedSlots || 1);
  const paymentAmount = Math.max(0, Number(offer.pricePerPlayer || 0) * paymentSlots);

  const now = Date.now();
  const isPaid = request.paymentStatus === "paid";
  const matchroomId = await ctx.db.insert("matchrooms", {
    hostUid: request.userId,
    hostName: request.userName || "Player",
    game: request.gameKey || "unknown",
    title: request.title || "Zone Booking",
    description: request.description || "Accepted zone booking request",
    status: isPaid ? "open" : "locked",
    maxPlayers: Number(request.maxPlayers || 10),
    currentPlayers: 1,
    players: [{
      uid: request.userId,
      username: request.userName || "Player",
      joinedAt: now,
      role: "Host",
    }],
    playerUids: [request.userId],
    createdAt: now,
    updatedAt: now,
    locationMode: "zone",
    zoneId: offer.zoneId,
    zoneOwnerUid: offer.zoneOwnerUid,
    location: offer.location || offer.branchName || offer.zoneName || request.preferredAreas?.[0] || "Zone Venue",
    scheduledDate,
    scheduledTime,
    durationMinutes: toDurationMinutes(request),
    pricing: {
      perPlayer: Number(offer.pricePerPlayer || 0),
      currency: offer.currency || "PKR",
    },
    format: request.format,
    seriesType: request.seriesType || null,
    durationHours: request.durationHours || null,
    selectedMaps: request.selectedMaps || [],
    skillLevel: request.skillLevel,
    hostSkillScore: request.hostSkillScore ?? null,
    hostSkillTier: request.hostSkillTier ?? "Any",
    hostSkillContext: request.hostSkillContext,
    overs: request.overs ? Number(request.overs) : null,
    teamMode: request.teamMode,
    teamId: request.teamId || null,
    reservedSlots: request.reservedSlots,
    flexibility: request.flexibilityWindow,
    paymentStatus: request.paymentStatus || "unpaid",
    paymentAmount,
    paymentReservedSlots: paymentSlots,
    paymentCurrency: offer.currency || "PKR",
    isLocked: !isPaid,
    zoneAdminApproved: true,
    slotsA: [],
    slotsB: [],
  });

  await ctx.db.insert("chatrooms", {
    matchroomId,
    participantUids: uniqueStrings([request.userId, offer.zoneOwnerUid].filter(Boolean)),
    createdAt: now,
    updatedAt: now,
  });

  return { matchroomId, paymentAmount, paymentSlots, paymentCurrency: offer.currency || "PKR" };
};

export const createBookingRequest = mutation({
  args: {
    gameKey: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    maxPlayers: v.number(),
    format: v.optional(v.string()),
    seriesType: v.optional(v.string()),
    durationHours: v.optional(v.number()),
    selectedMaps: v.optional(v.array(v.string())),
    skillLevel: v.optional(v.string()),
    overs: v.optional(v.string()),
    hostSkillScore: v.optional(v.number()),
    hostSkillTier: v.optional(v.string()),
    hostSkillContext: v.optional(v.any()),
    teamMode: v.optional(v.string()),
    teamId: v.optional(v.string()),
    reservedSlots: v.optional(v.number()),
    preferredDate: v.optional(v.any()),
    preferredTime: v.optional(v.string()),
    flexibilityWindow: v.optional(v.string()),
    locationMode: v.optional(v.string()),
    zoneId: v.optional(v.string()),
    preferredAreas: v.optional(v.array(v.string())),
    budgetPerPlayer: v.optional(v.number()),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const now = Date.now();

    let zoneOwnerUid: string | undefined;
    if (args.zoneId) {
      const zone = await ctx.db.get(args.zoneId as Id<"zones">);
      zoneOwnerUid = zone?.ownerUid;
    }

    const requestId = await ctx.db.insert("bookingRequests", {
      userId: user.uid,
      userName: user.username ?? user.displayName ?? "Player",
      gameKey: args.gameKey,
      title: args.title,
      description: args.description ?? undefined,
      maxPlayers: args.maxPlayers,
      format: args.format ?? undefined,
      seriesType: args.seriesType ?? undefined,
      durationHours: args.durationHours ?? undefined,
      selectedMaps: args.selectedMaps ?? undefined,
      skillLevel: args.skillLevel ?? undefined,
      overs: args.overs ?? undefined,
      hostSkillScore: args.hostSkillScore ?? undefined,
      hostSkillTier: args.hostSkillTier ?? undefined,
      hostSkillContext: args.hostSkillContext ?? undefined,
      teamMode: args.teamMode ?? "solo",
      teamId: args.teamId ?? undefined,
      reservedSlots: args.reservedSlots ?? undefined,
      preferredDate: args.preferredDate ?? undefined,
      preferredTime: args.preferredTime ?? undefined,
      flexibilityWindow: args.flexibilityWindow ?? "Exact time",
      locationMode: args.locationMode ?? "broadcast",
      zoneId: args.zoneId ?? undefined,
      zoneOwnerUid: zoneOwnerUid ?? undefined,
      preferredAreas: args.preferredAreas ?? [],
      budgetPerPlayer: args.budgetPerPlayer ?? undefined,
      currency: args.currency ?? "PKR",
      status: "open",
      paymentStatus: "unpaid",
      lifecycleStatus: "open",
      createdAt: now,
      updatedAt: now,
      expiresAt: now + ONE_DAY_MS,
    });

    const ownerUids = new Set<string>();
    if (zoneOwnerUid) ownerUids.add(zoneOwnerUid);
    const areaOwners = await collectZoneOwnersForAreas(ctx, args.preferredAreas ?? []);
    areaOwners.forEach((uid) => ownerUids.add(uid));
    ownerUids.delete(user.uid);

    await Promise.all(
      Array.from(ownerUids).map((ownerUid) =>
        sendNotification(ctx, {
          type: "admin_booking_request",
          fromUid: user.uid,
          fromUsername: user.username ?? user.displayName ?? "Player",
          toUid: ownerUid,
          status: "pending",
          title: args.title || "New booking request",
          message: `${user.username ?? user.displayName ?? "Player"} requested ${args.gameKey}`,
          entityKey: `admin_booking_request_${requestId}_${ownerUid}`,
          meta: {
            requestId,
            gameKey: args.gameKey,
            assetType: computeAssetTypeFromGame(args.gameKey),
            preferredAreas: args.preferredAreas ?? [],
            preferredDate: args.preferredDate ?? null,
            preferredTime: args.preferredTime ?? null,
            budgetPerPlayer: args.budgetPerPlayer ?? null,
          },
        })
      )
    );

    return { ok: true, requestId };
  },
});

export const listBookingRequestsForUser = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const targetUid = args.userId ?? user.uid;
    if (targetUid !== user.uid) throw new ConvexError("Not authorized.");

    return await ctx.db
      .query("bookingRequests")
      .withIndex("by_userId", (q: any) => q.eq("userId", targetUid))
      .order("desc")
      .collect();
  },
});

export const listOffersForRequest = query({
  args: { requestId: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const request = await ctx.db.get(args.requestId as Id<"bookingRequests">);
    if (!request) throw new ConvexError("Request not found.");
    if (request.userId !== user.uid) throw new ConvexError("Not authorized.");

    return await ctx.db
      .query("bookingOffers")
      .withIndex("by_requestId", (q: any) => q.eq("requestId", args.requestId))
      .order("desc")
      .collect();
  },
});

export const listOffersForUser = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const targetUid = args.userId ?? user.uid;
    if (targetUid !== user.uid) throw new ConvexError("Not authorized.");

    return await ctx.db
      .query("bookingOffers")
      .withIndex("by_requestOwnerUid", (q: any) => q.eq("requestOwnerUid", targetUid))
      .order("desc")
      .collect();
  },
});

export const listBookingIntentsForUser = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const targetUid = args.userId ?? user.uid;
    if (targetUid !== user.uid) throw new ConvexError("Not authorized.");

    return await ctx.db
      .query("bookingIntents")
      .withIndex("by_createdByUid", (q: any) => q.eq("createdByUid", targetUid))
      .order("desc")
      .collect();
  },
});

export const createZoneOffer = mutation({
  args: {
    requestId: v.string(),
    zoneId: v.string(),
    branchId: v.optional(v.string()),
    branchName: v.optional(v.string()),
    zoneName: v.optional(v.string()),
    proposedDate: v.optional(v.any()),
    proposedTime: v.optional(v.string()),
    pricePerPlayer: v.number(),
    currency: v.optional(v.string()),
    location: v.optional(v.string()),
    message: v.optional(v.string()),
    expiresInMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user, role } = await requireUser(ctx);
    const zone = await ctx.db.get(args.zoneId as Id<"zones">);
    if (!zone) throw new ConvexError("Zone not found.");
    if (zone.ownerUid !== user.uid && role !== "superAdmin") {
      throw new ConvexError("Not authorized.");
    }

    const request = await ctx.db.get(args.requestId as Id<"bookingRequests">);
    if (!request) throw new ConvexError("Request not found.");

    const now = Date.now();
    const expiresInMinutes = Math.max(1, Math.min(120, args.expiresInMinutes ?? 10));
    const expiresAt = now + expiresInMinutes * 60 * 1000;

    const offerId = await ctx.db.insert("bookingOffers", {
      requestId: args.requestId,
      requestOwnerUid: request.userId,
      zoneId: args.zoneId,
      zoneName: args.zoneName ?? zone.venueBrandName ?? "Zone",
      zoneOwnerUid: zone.ownerUid,
      zoneAdminId: zone.ownerUid,
      branchId: args.branchId ?? undefined,
      branchName: args.branchName ?? undefined,
      proposedDate: args.proposedDate ?? undefined,
      proposedTime: args.proposedTime ?? undefined,
      pricePerPlayer: args.pricePerPlayer,
      currency: args.currency ?? "PKR",
      location: args.location ?? "",
      message: args.message ?? "",
      status: "pending",
      createdAt: now,
      updatedAt: now,
      expiresAt,
    });

    await ctx.db.patch(request._id, {
      lifecycleStatus: "offer_sent",
      updatedAt: now,
    });

    await sendNotification(ctx, {
      type: "booking_counter_offer",
      fromUid: zone.ownerUid,
      fromUsername: user.username ?? user.displayName ?? "Zone Admin",
      toUid: request.userId,
      status: "pending",
      title: "Counter-offer received",
      message: `New offer: ${args.currency ?? "PKR"} ${args.pricePerPlayer} per player`,
      meta: {
        requestId: args.requestId,
        offerId,
        zoneId: args.zoneId,
        proposedDate: args.proposedDate ?? null,
        proposedTime: args.proposedTime ?? null,
        branchId: args.branchId ?? null,
      },
      expiresAt,
    });

    return { ok: true, offerId };
  },
});

export const acceptBookingOffer = mutation({
  args: { offerId: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const offer = await ctx.db.get(args.offerId as Id<"bookingOffers">);
    if (!offer) throw new ConvexError("Offer not found.");

    const request = await ctx.db.get(offer.requestId as Id<"bookingRequests">);
    if (!request) throw new ConvexError("Request not found.");
    if (request.userId !== user.uid) throw new ConvexError("Not authorized.");

    if (offer.status === "accepted") return { ok: true, matchroomId: offer.matchroomId };

    const { matchroomId, paymentAmount, paymentSlots, paymentCurrency } = await createMatchroomFromOffer(
      ctx,
      request,
      offer,
      user
    );

    await ctx.db.patch(offer._id, {
      status: "accepted",
      matchroomId,
      updatedAt: Date.now(),
    });

    await ctx.db.patch(request._id, {
      status: "accepted",
      acceptedOfferId: offer._id,
      zoneId: offer.zoneId,
      matchroomId,
      paymentStatus: request.paymentStatus || "unpaid",
      paymentAmount,
      paymentReservedSlots: paymentSlots,
      paymentCurrency,
      lifecycleStatus: "confirmed",
      updatedAt: Date.now(),
    });

    const otherOffers = await ctx.db
      .query("bookingOffers")
      .withIndex("by_requestId", (q: any) => q.eq("requestId", offer.requestId))
      .collect();
    await Promise.all(
      otherOffers
        .filter((item: any) => item._id !== offer._id && item.status === "pending")
        .map((item: any) => ctx.db.patch(item._id, { status: "rejected", updatedAt: Date.now() }))
    );

    const intentId = await ctx.db.insert("bookingIntents", {
      matchroomId,
      game: request.gameKey || "unknown",
      createdByUid: request.userId,
      pricing: {
        pricePerPlayer: Number(offer.pricePerPlayer || 0),
        currency: offer.currency || "PKR",
        slots: paymentSlots,
        total: paymentAmount,
      },
      status: "approved_pending_payment",
      paymentStatus: "unpaid",
      paymentMethod: "wallet",
      expiresAt: Date.now() + ONE_HOUR_MS,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    if (offer.zoneOwnerUid) {
      await sendNotification(ctx, {
        type: "booking_offer_accepted",
        fromUid: request.userId,
        fromUsername: request.userName || "Player",
        toUid: offer.zoneOwnerUid,
        status: "pending",
        title: "Offer accepted",
        message: `${request.userName || "Player"} accepted your offer for ${request.title || request.gameKey}.`,
        meta: {
          requestId: offer.requestId,
          offerId: offer._id,
          matchroomId,
          bookingIntentId: intentId,
          zoneId: offer.zoneId,
        },
      });
    }

    return { ok: true, matchroomId, bookingIntentId: intentId };
  },
});

export const payBookingIntent = mutation({
  args: { intentId: v.id("bookingIntents") },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const intent = await ctx.db.get(args.intentId);
    if (!intent) throw new ConvexError("Booking intent not found.");
    if (intent.createdByUid && intent.createdByUid !== user.uid) {
      throw new ConvexError("Not authorized.");
    }

    if (intent.paymentStatus === "paid") return { ok: true };

    const totalAmount = Number(intent.pricing?.total || 0);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      throw new ConvexError("Invalid payment amount.");
    }

    const walletBalance = Number(user.walletBalance || 0);
    if (!Number.isFinite(walletBalance) || walletBalance < totalAmount) {
      throw new ConvexError("Insufficient wallet balance.");
    }

    const nextBalance = walletBalance - totalAmount;
    const now = Date.now();

    await ctx.db.patch(user._id, { walletBalance: nextBalance, updatedAt: now });
    await ctx.db.insert("walletTransactions", {
      userId: user.uid,
      type: "debit",
      amount: totalAmount,
      status: "completed",
      source: "booking",
      intentId: intent._id,
      matchroomId: intent.matchroomId,
      createdAt: now,
    });

    await ctx.db.patch(intent._id, {
      status: "confirmed",
      paymentStatus: "paid",
      paymentMethod: "wallet",
      updatedAt: now,
    });

    if (intent.matchroomId) {
      const room = await ctx.db.get(intent.matchroomId as Id<"matchrooms">);
      if (room) {
        await ctx.db.patch(room._id, {
          paymentStatus: "paid",
          isLocked: false,
          status: room.status === "locked" ? "open" : room.status,
          updatedAt: now,
        });
      }
    }

    return { ok: true };
  },
});

export const confirmBooking = mutation({
  args: { intentId: v.id("bookingIntents") },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const intent = await ctx.db.get(args.intentId);
    if (!intent) throw new ConvexError("Booking intent not found.");
    if (intent.createdByUid && intent.createdByUid !== user.uid) {
      throw new ConvexError("Not authorized.");
    }

    if (intent.paymentStatus !== "paid") {
      throw new ConvexError("Payment required.");
    }

    const now = Date.now();
    await ctx.db.patch(intent._id, { status: "confirmed", updatedAt: now });

    if (intent.matchroomId) {
      const room = await ctx.db.get(intent.matchroomId as Id<"matchrooms">);
      if (room) {
        await ctx.db.patch(room._id, {
          isLocked: false,
          status: room.status === "locked" ? "open" : room.status,
          updatedAt: now,
        });
      }
    }

    return { ok: true };
  },
});

export const cancelBookingRequest = mutation({
  args: { requestId: v.id("bookingRequests") },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError("Request not found.");
    if (request.userId !== user.uid) throw new ConvexError("Not authorized.");

    await ctx.db.patch(request._id, {
      status: "cancelled",
      lifecycleStatus: "cancelled",
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});

const expireStaleBookingsCore = async (ctx: any) => {
  const now = Date.now();
  const requests = await ctx.db
    .query("bookingRequests")
    .withIndex("by_status", (q: any) => q.eq("status", "open"))
    .collect();

  await Promise.all(
    requests
      .filter((req: any) => req.expiresAt && req.expiresAt < now)
      .map((req: any) => ctx.db.patch(req._id, { status: "expired", updatedAt: now }))
  );

  const offers = await ctx.db
    .query("bookingOffers")
    .withIndex("by_status", (q: any) => q.eq("status", "pending"))
    .collect();

  await Promise.all(
    offers
      .filter((offer: any) => offer.expiresAt && offer.expiresAt < now)
      .map((offer: any) => ctx.db.patch(offer._id, { status: "expired", updatedAt: now }))
  );

  const intents = await ctx.db
    .query("bookingIntents")
    .withIndex("by_status", (q: any) => q.eq("status", "approved_pending_payment"))
    .collect();

  await Promise.all(
    intents
      .filter((intent: any) => intent.expiresAt && intent.expiresAt < now)
      .map((intent: any) => ctx.db.patch(intent._id, { status: "expired", updatedAt: now }))
  );

  return { ok: true };
};

export const expireStaleBookings = mutation({
  args: {},
  handler: async (ctx) => {
    const { role } = await requireUser(ctx);
    if (role !== "superAdmin") throw new ConvexError("Not authorized.");
    return await expireStaleBookingsCore(ctx);
  },
});

export const expireStaleBookingsInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await expireStaleBookingsCore(ctx);
  },
});
