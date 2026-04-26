import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { recordZoneAuditEvent } from "./zoneAudit";
import { api, internal } from "./_generated/api";
import {
  BROADCAST_COUNTER_RESPONSE_WINDOW_MS,
  confirmBroadcastVenue,
  finalizeBroadcastFailure,
} from "./matchroomBroadcast";

function normalizeGameKey(value?: string | null) {
  const gameKey = String(value || "").trim().toLowerCase();
  return gameKey === "fc25" ? "fc26" : gameKey;
}

async function resolveUserByAnyId(ctx: any, value?: string | null) {
  if (!value) return null;

  try {
    const directUser = await ctx.db.get(value);
    if (directUser) return directUser;
  } catch {
    // Ignore invalid direct ids and fall back to authId.
  }

  return await ctx.db
    .query("users")
    .withIndex("by_authId", (q: any) => q.eq("authId", value))
    .unique();
}

function buildZoneBookingNotificationData(input: {
  requestId: string;
  zoneId: string;
  zoneName?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  matchroomId?: string | null;
  offerId?: string | null;
  gameKey?: string | null;
  proposedDate?: string | null;
  proposedTime?: string | null;
  pricePerPlayer?: number | null;
  currency?: string | null;
  reason?: string | null;
  note?: string | null;
  alternative?: string | null;
}) {
  return {
    requestId: input.requestId,
    zoneId: input.zoneId,
    zoneName: input.zoneName || null,
    branchId: input.branchId || null,
    branchName: input.branchName || null,
    matchroomId: input.matchroomId || null,
    offerId: input.offerId || null,
    gameKey: normalizeGameKey(input.gameKey),
    proposedDate: input.proposedDate || null,
    proposedTime: input.proposedTime || null,
    pricePerPlayer: input.pricePerPlayer ?? null,
    currency: input.currency || "PKR",
    reason: input.reason || null,
    note: input.note || null,
    alternative: input.alternative || null,
  };
}

function getRequestIdentityKey(request: any) {
  const matchroomKey = request.matchroomId ? `matchroom:${String(request.matchroomId)}` : "";
  if (matchroomKey) return matchroomKey;

  return [
    String(request.userId || ""),
    String(request.zoneId || ""),
    normalizeGameKey(request.gameKey),
    String(request.preferredDate || ""),
    String(request.preferredTime || ""),
    String(request.playerCount || request.maxPlayers || ""),
    String(request.title || ""),
  ].join("|");
}

function buildOpenSlots(maxPlayers: number) {
  const total = Math.max(2, Math.floor(Number(maxPlayers || 2)));
  const teamSplit = Math.max(1, Math.ceil(total / 2));
  const createSlot = (slotNumber: number) => ({
    slotId: `slot-${slotNumber}`,
    status: "open" as const,
  });
  return {
    slotsA: Array.from({ length: teamSplit }, (_, index) => createSlot(index + 1)),
    slotsB: Array.from({ length: Math.max(0, total - teamSplit) }, (_, index) =>
      createSlot(teamSplit + index + 1),
    ),
  };
}

function getDurationMinutesFromRequest(request: any) {
  const gameKey = normalizeGameKey(request.gameKey);
  const seriesType = String(request.seriesType || "").toUpperCase();
  const overs = String(request.overs || "").trim();

  if (gameKey === "futsal") {
    const hours = Number(request.durationHours || 0);
    return Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : 60;
  }
  if (gameKey === "indoor_cricket") {
    return overs === "6" ? 150 : 120;
  }
  if (["cs2", "cs16", "valorant"].includes(gameKey)) {
    if (seriesType === "BO3") return 180;
    if (seriesType === "BO5") return 300;
    if (seriesType === "BO10") return 600;
    return 60;
  }
  if (gameKey === "fc26") {
    if (seriesType === "BO3") return 60;
    if (seriesType === "BO5") return 120;
    if (seriesType === "BO10") return 180;
    return 30;
  }
  if (gameKey === "tekken8") {
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
}

async function getOfferRecipients(ctx: any, request: any) {
  const recipients = new Map<string, { uid: string; username?: string }>();
  const addRecipient = async (value?: string | null) => {
    const user = await resolveUserByAnyId(ctx, value);
    if (!user) return;
    recipients.set(String(user._id), {
      uid: String(user._id),
      username: user.username || user.fullName || "Captain",
    });
  };

  await addRecipient(String(request.userId || ""));

  if (request.teamId) {
    try {
      const team = await ctx.db.get(request.teamId);
      if (team?.captainUid) {
        await addRecipient(String(team.captainUid));
      }
    } catch {
      // Ignore invalid team ids.
    }
  }

  if (request.matchroomId) {
    try {
      const matchroom = await ctx.db.get(request.matchroomId);
      if (matchroom?.captainUidA) await addRecipient(matchroom.captainUidA);
      if (matchroom?.captainUidB) await addRecipient(matchroom.captainUidB);
      if (matchroom?.hostUid) await addRecipient(matchroom.hostUid);
    } catch {
      // Ignore invalid matchroom ids.
    }
  }

  return Array.from(recipients.values());
}

async function resolveBroadcastCaptainApprovalState(ctx: any, request: any) {
  if (!request?.matchroomId) {
    return {
      ok: false as const,
      code: "broadcast_counter_offer_invalid",
      message: "Broadcast counter-offers require a linked matchroom.",
    };
  }

  const matchroom = await ctx.db.get(request.matchroomId);
  if (!matchroom) {
    return {
      ok: false as const,
      code: "broadcast_counter_offer_invalid",
      message: "The linked matchroom no longer exists.",
    };
  }

  const requiresTwoCaptains = String(matchroom.teamMode || request.teamMode || "").toLowerCase() === "team";
  const captainAValue = String(matchroom.captainUidA || matchroom.hostUid || "").trim();
  const captainBValue = String(matchroom.captainUidB || "").trim();

  if (!captainAValue) {
    return {
      ok: false as const,
      code: "captains_not_resolved",
      message: "Captain A is not resolved for this broadcast matchroom.",
      matchroom,
      requiresTwoCaptains,
    };
  }

  if (requiresTwoCaptains && !captainBValue) {
    return {
      ok: false as const,
      code: "captains_not_resolved",
      message: "Both captains must be resolved before sending a broadcast counter-offer.",
      matchroom,
      requiresTwoCaptains,
    };
  }

  const requiredCaptainSourceIds = requiresTwoCaptains
    ? [captainAValue, captainBValue]
    : [captainAValue];

  const recipients: Array<{ uid: string; username?: string }> = [];
  for (const captainSourceId of requiredCaptainSourceIds) {
    const captain = await resolveUserByAnyId(ctx, captainSourceId);
    if (!captain) {
      return {
        ok: false as const,
        code: "captains_not_resolved",
        message: "Both captains must be resolvable before sending a broadcast counter-offer.",
        matchroom,
        requiresTwoCaptains,
      };
    }
    recipients.push({
      uid: String(captain._id),
      username: captain.username || captain.fullName || "Captain",
    });
  }

  return {
    ok: true as const,
    matchroom,
    recipients,
    requiredCaptainUids: recipients.map((recipient) => recipient.uid),
    requiresTwoCaptains,
  };
}

async function patchOfferNotifications(ctx: any, input: {
  offerId: string;
  recipientUids: string[];
  status?: "accepted" | "rejected" | "expired";
  responderUid?: string;
}) {
  for (const recipientUid of input.recipientUids) {
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_toUid", (q: any) => q.eq("toUid", recipientUid))
      .collect();

    const matching = notifications.filter(
      (notification: any) =>
        ["booking_counter_offer", "booking.counter_offer"].includes(String(notification.type || "")) &&
        String(notification.data?.offerId || "") === input.offerId,
    );

    for (const notification of matching) {
      if (input.responderUid && String(notification.toUid) !== input.responderUid) continue;
      await ctx.db.patch(notification._id, {
        status: input.status || notification.status,
        updatedAt: Date.now(),
      });
    }
  }
}

async function notifyZoneOfferOutcome(ctx: any, input: {
  offer: any;
  request: any;
  status: "accepted" | "rejected" | "expired";
  title: string;
  body: string;
  reason?: string | null;
}) {
  if (!input.offer?.zoneOwnerUid) return;

  const zoneOwner = await resolveUserByAnyId(ctx, String(input.offer.zoneOwnerUid));
  if (!zoneOwner) return;

  const requestId = String(input.request?._id || input.offer.requestId || "");
  await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
    type: "booking.counter_offer_result",
    toUid: zoneOwner._id,
    status: input.status,
    recipientRole: "zone_admin",
    dedupeKey: `booking.counter_offer_result:${String(input.offer._id)}:${input.status}`,
    dedupePolicy: "replace_active",
    route: `/zone/modules/bookings?segment=requests&requestId=${requestId}`,
    title: input.title,
    body: input.body,
    entity: { kind: "booking_offer", id: String(input.offer._id) },
    entityId: String(input.offer._id),
    data: {
      offerId: String(input.offer._id),
      requestId,
      zoneId: String(input.offer.zoneId || input.request?.zoneId || ""),
      zoneName: input.offer.zoneName || null,
      branchId: input.offer.branchId || null,
      branchName: input.offer.branchName || null,
      decision: input.status,
      reason: input.reason || null,
      href: `/zone/modules/bookings?segment=requests&requestId=${requestId}`,
    },
  });
}

async function ensureMatchroomForAcceptedOffer(ctx: any, input: {
  request: any;
  offer: any;
  option: { date: string; time: string };
}) {
  const now = Date.now();
  const request = input.request;
  const offer = input.offer;
  const locationLabel = offer.branchName || offer.zoneName || "Zone Venue";

  if (request.matchroomId) {
    await ctx.db.patch(request.matchroomId, {
      scheduledDate: input.option.date,
      scheduledTime: input.option.time,
      location: locationLabel,
      updatedAt: now,
    });
    return request.matchroomId;
  }

  const hostUser = await ctx.db.get(request.userId);
  const maxPlayers = Math.max(2, Number(request.maxPlayers || request.playerCount || 2));
  const slots = buildOpenSlots(maxPlayers);
  const players = hostUser
    ? [{
      uid: String(hostUser._id),
      username: hostUser.username || hostUser.fullName || "Captain",
      joinedAt: now,
      role: "Captain",
      skillTier: request.hostSkillTier || undefined,
    }]
    : [];

  const matchroomId = await ctx.db.insert("matchrooms", {
    hostUid: String(request.userId),
    hostName: hostUser?.username || hostUser?.fullName || request.userName || "Captain",
    game: normalizeGameKey(request.gameKey),
    title: request.title || `${normalizeGameKey(request.gameKey).toUpperCase()} Match`,
    description: request.description || "Zone booking matchroom",
    status: "open",
    maxPlayers,
    currentPlayers: players.length,
    players,
    playerUids: players.map((player) => player.uid),
    location: locationLabel,
    locationMode: "zone",
    zoneId: String(request.zoneId || offer.zoneId),
    zoneOwnerUid: offer.zoneOwnerUid || undefined,
    scheduledDate: input.option.date,
    scheduledTime: input.option.time,
    durationMinutes: getDurationMinutesFromRequest(request),
    pricing: {
      perPlayer: Number(request.budgetPerPlayer || offer.proposedPrice || 0),
      currency: request.currency || "PKR",
    },
    bookingSource: "zone_accepted",
    format: request.format || undefined,
    seriesType: request.seriesType || undefined,
    durationHours: request.durationHours || undefined,
    selectedMaps: request.selectedMaps || undefined,
    skillLevel: request.skillLevel || undefined,
    hostSkillScore: request.hostSkillScore || undefined,
    hostSkillTier: request.hostSkillTier || undefined,
    hostSkillContext: request.hostSkillContext || undefined,
    overs: request.overs ? Number(request.overs) || undefined : undefined,
    slotsA: slots.slotsA,
    slotsB: slots.slotsB,
    captainUidA: String(request.userId),
    teamMode: request.teamMode || undefined,
    teamId: request.teamId || undefined,
    reservedSlots: request.reservedSlots || undefined,
    paymentStatus: request.paymentStatus || "unpaid",
    paymentAmount: request.paymentAmount || undefined,
    paymentReservedSlots: request.paymentReservedSlots || undefined,
    paymentCurrency: request.currency || "PKR",
    zoneAdminApproved: true,
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.patch(request._id, {
    status: "accepted",
    matchroomId,
    lifecycleStatus: "zone_accepted",
    updatedAt: now,
  });

  return matchroomId;
}

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

    const deduped = new Map<string, any>();
    filtered.forEach((request) => {
      const key = getRequestIdentityKey(request);
      const existing = deduped.get(key);
      if (!existing || (request.createdAt || 0) > (existing.createdAt || 0)) {
        deduped.set(key, request);
      }
    });

    const normalizedRequests = Array.from(deduped.values());

    const users = await Promise.all(
      normalizedRequests.map((request) => ctx.db.get(request.userId)).map((promise) => promise.catch(() => null)),
    );
    const userMap = new Map(normalizedRequests.map((request, index) => [String(request.userId), users[index]]));

    return normalizedRequests
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => ({
        ...r,
        id: String(r._id),
        requestId: String(r._id),
        userId: String(r.userId),
        zoneId: r.zoneId ? String(r.zoneId) : undefined,
        gameKey: normalizeGameKey(r.gameKey),
        requestKind: r.requestKind || "direct_zone",
        responseExpiresAt: r.responseExpiresAt,
        targetAreaLabel: r.targetAreaLabel || undefined,
        userName:
          r.userName ||
          (userMap.get(String(r.userId)) as any)?.username ||
          (userMap.get(String(r.userId)) as any)?.fullName ||
          "Player",
        title: r.title || `Booking request for ${normalizeGameKey(r.gameKey).toUpperCase()}`,
        matchroomId: (r as any).matchroomId ? String((r as any).matchroomId) : undefined,
      }));
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
    const includeInAdminList = (matchroom: any) =>
      String(matchroom.zoneId || "") === args.zoneId &&
      (matchroom.bookingSource === "zone_accepted" ||
        matchroom.bookingSource === "walkin" ||
        matchroom.zoneAdminApproved === true);

    // By zoneId
    const byZone = await ctx.db
      .query("matchrooms")
      .withIndex("by_zoneId", (q) => q.eq("zoneId", args.zoneId))
      .order("desc")
      .collect();

    byZone
      .filter(includeInAdminList)
      .forEach((m) => merged.set(String(m._id), { ...m, id: m._id }));

    // By ownerUid
    if (args.ownerUid) {
      const allMatchrooms = await ctx.db
        .query("matchrooms")
        .withIndex("by_createdAt")
        .order("desc")
        .take(200);

      allMatchrooms
        .filter((m) => m.zoneOwnerUid === args.ownerUid && includeInAdminList(m))
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
          .filter((m) => m.location && locationSet.has(m.location) && includeInAdminList(m))
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
    branchId: v.string(),
    branchName: v.optional(v.string()),
    location: v.optional(v.string()),
    zoneName: v.optional(v.string()),
    resourceIds: v.array(v.id("zoneResources")),
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
    const bookingRequest = await ctx.db.get(args.requestId);
    if (!bookingRequest) {
      throw new Error("Booking request not found.");
    }
    if (!["open", "pending_payment"].includes(String(bookingRequest.status || ""))) {
      throw new Error("Booking request can no longer be accepted.");
    }
    if (!args.resourceIds.length) {
      throw new Error("Select at least one resource.");
    }

    const selectedResources = await Promise.all(
      args.resourceIds.map((resourceId) => ctx.db.get(resourceId)),
    );
    selectedResources.forEach((resource, index) => {
      if (!resource) {
        throw new Error("One or more selected resources no longer exist.");
      }
      if (String(resource.zoneId) !== args.zoneId) {
        throw new Error(`${resource.name || "Selected resource"} does not belong to this venue.`);
      }
      if (String(resource.branchId || "") !== String(args.branchId)) {
        throw new Error(`${resource.name || "Selected resource"} does not belong to the selected branch.`);
      }
      if (!["available", "held"].includes(String(resource.lifecycleStatus || ""))) {
        throw new Error(`${resource.name || `Resource ${index + 1}`} is no longer available.`);
      }
    });

    let matchroomId: any;

    if (bookingRequest.requestKind === "broadcast_fanout" && bookingRequest.matchroomId) {
      const confirmation = await confirmBroadcastVenue(ctx, {
        matchroomId: bookingRequest.matchroomId,
        winningRequestId: args.requestId,
        zoneId: args.zoneId as any,
        zoneOwnerUid: args.adminUid,
        zoneName: args.zoneName || null,
        locationLabel: args.location || args.branchName || args.zoneName || null,
        branchId: args.branchId || null,
        branchName: args.branchName || null,
        resourceIds: args.resourceIds,
      });
      matchroomId = confirmation.matchroomId;

      for (const resourceId of args.resourceIds) {
        await ctx.db.patch(resourceId, {
          lifecycleStatus: "booked",
          bookingRequestId: args.requestId,
          bookedAt: now,
          bookedByUid: args.adminUid,
          matchroomId,
          updatedAt: now,
        });
      }
    } else {
      for (const resourceId of args.resourceIds) {
        await ctx.db.patch(resourceId, {
          lifecycleStatus: "booked",
          bookingRequestId: args.requestId,
          bookedAt: now,
          bookedByUid: args.adminUid,
          updatedAt: now,
        });
      }

      matchroomId = await ctx.db.insert("matchrooms", {
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
        branchId: args.branchId,
        resourceIds: args.resourceIds,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.patch(args.requestId, {
        status: "accepted",
        matchroomId,
        allocatedBranchId: args.branchId,
        allocatedResourceIds: args.resourceIds,
        allocatedAt: now,
        allocatedByUid: args.adminUid,
        lifecycleStatus: "zone_accepted",
        updatedAt: now,
      });

      for (const resourceId of args.resourceIds) {
        await ctx.db.patch(resourceId, {
          matchroomId,
          updatedAt: now,
        });
      }
    }

    // Send notification if requestOwnerUid provided
    if (args.requestOwnerUid && bookingRequest.requestKind !== "broadcast_fanout") {
      const requestOwner = await resolveUserByAnyId(ctx, args.requestOwnerUid);

      if (requestOwner) {
        await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
          type: "booking.request_accepted",
          toUid: requestOwner._id,
          status: "pending",
          dedupeKey: `booking.request_accepted:${String(args.requestId)}:${String(requestOwner._id)}`,
          dedupePolicy: "replace_active",
          matchroomId,
          entity: { kind: "booking_request", id: String(args.requestId) },
          route: `/matchrooms/${String(matchroomId)}`,
          title: "Booking request accepted",
          body: "Your booking request was accepted by the venue.",
          data: {
            ...buildZoneBookingNotificationData({
              requestId: String(args.requestId),
              zoneId: args.zoneId,
              zoneName: args.zoneName || null,
              branchId: args.branchId || null,
              branchName: args.branchName || null,
              matchroomId: String(matchroomId),
              gameKey: args.matchroomData.game,
              note: args.note || null,
            }),
            href: `/matchrooms/${String(matchroomId)}`,
          },
        });
      }
    }

    await recordZoneAuditEvent(ctx, {
      zoneId: args.zoneId,
      module: "bookings",
      action: "accept_request",
      actorUid: args.adminUid,
      targetType: "booking_request",
      targetId: String(args.requestId),
      summary: `Accepted booking request and created matchroom ${String(matchroomId)}.`,
      details: {
        branchId: args.branchId || null,
        branchName: args.branchName || null,
        zoneName: args.zoneName || null,
        location: args.location || args.matchroomData.location || null,
        note: args.note || null,
        matchroomId: String(matchroomId),
        resourceIds: args.resourceIds.map(String),
        requestOwnerUid: args.requestOwnerUid || null,
        gameKey: bookingRequest?.gameKey || args.matchroomData.game,
        scheduledDate: args.matchroomData.scheduledDate || null,
        scheduledTime: args.matchroomData.scheduledTime || null,
        maxPlayers: args.matchroomData.maxPlayers,
        paymentStatus: args.matchroomData.paymentStatus || "unpaid",
      },
      createdAt: now,
    });

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
    const request = await ctx.db.get(args.requestId);

    const statusPatch =
      request?.requestKind === "broadcast_fanout"
        ? {
            closedReason: "rejected_by_zone",
            lifecycleStatus: "broadcast_rejected",
            status: "cancelled" as const,
            updatedAt: now,
          }
        : {
            status: "cancelled" as const,
            updatedAt: now,
          };

    await ctx.db.patch(args.requestId, statusPatch);

    if (args.requestOwnerUid && request?.requestKind !== "broadcast_fanout") {
      const requestOwner = await resolveUserByAnyId(ctx, args.requestOwnerUid);

      if (requestOwner) {
        await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
          type: "booking.request_rejected",
          toUid: requestOwner._id,
          status: "pending",
          dedupeKey: `booking.request_rejected:${String(args.requestId)}:${String(requestOwner._id)}`,
          dedupePolicy: "replace_active",
          entity: { kind: "booking_request", id: String(args.requestId) },
          route: "/(player)/inbox",
          title: "Booking request declined",
          body: args.alternative
            ? `Reason: ${args.reason}. Alternative: ${args.alternative}`
            : `Reason: ${args.reason}`,
          data: {
            ...buildZoneBookingNotificationData({
              requestId: String(args.requestId),
              zoneId: args.zoneId,
              reason: args.reason,
              note: args.note || null,
              alternative: args.alternative || null,
            }),
            href: "/(player)/inbox",
          },
        });
      }
    }

    await recordZoneAuditEvent(ctx, {
      zoneId: args.zoneId,
      module: "bookings",
      action: "reject_request",
      actorUid: args.adminUid,
      targetType: "booking_request",
      targetId: String(args.requestId),
      summary: `Rejected booking request for ${normalizeGameKey(request?.gameKey)}.`,
      details: {
        reason: args.reason,
        note: args.note || null,
        alternative: args.alternative || null,
        requestOwnerUid: args.requestOwnerUid || null,
        title: request?.title || null,
        gameKey: request?.gameKey || null,
      },
      createdAt: now,
    });

    if (request?.requestKind === "broadcast_fanout" && request.matchroomId) {
      await finalizeBroadcastFailure(ctx, request.matchroomId, "no_zone_response");
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
    adminUid: v.optional(v.string()),
    branchId: v.optional(v.string()),
    branchName: v.optional(v.string()),
    scheduleOptions: v.array(v.object({
      date: v.string(),
      time: v.string(),
    })),
    pricePerPlayer: v.number(),
    currency: v.optional(v.string()),
    location: v.optional(v.string()),
    message: v.optional(v.string()),
    expiresInMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const currency = args.currency || "PKR";
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Booking request not found.");
    }

    const scheduleOptions = args.scheduleOptions
      .map((option) => ({
        date: String(option.date || "").trim(),
        time: String(option.time || "").trim(),
      }))
      .filter((option) => option.date && option.time)
      .slice(0, 3);

    if (!scheduleOptions.length) {
      throw new Error("Add at least one date and time option.");
    }

    const isBroadcastRequest = request.requestKind === "broadcast_fanout";
    const broadcastApprovalState = isBroadcastRequest
      ? await resolveBroadcastCaptainApprovalState(ctx, request)
      : null;
    const recipients = isBroadcastRequest
      ? (broadcastApprovalState?.ok ? broadcastApprovalState.recipients : [])
      : await getOfferRecipients(ctx, request);
    if (isBroadcastRequest && !broadcastApprovalState?.ok) {
      await ctx.db.patch(args.requestId, {
        lifecycleStatus: "counter_offer_waiting_for_captains",
        updatedAt: now,
      });
      throw new Error(broadcastApprovalState?.message || "Required captains are not resolved for this broadcast counter-offer.");
    }
    if (!recipients.length) {
      throw new Error("No captains found for this booking request.");
    }

    const expiresAt = isBroadcastRequest
      ? now + BROADCAST_COUNTER_RESPONSE_WINDOW_MS
      : now + Math.max(60, args.expiresInMinutes || 240) * 60 * 1000;
    const primaryOption = scheduleOptions[0];

    // Create zone offer
    const offerId = await ctx.db.insert("zoneOffers", {
      requestId: args.requestId,
      zoneId: args.zoneId,
      status: "pending",
      proposedPrice: args.pricePerPlayer,
      proposedDate: new Date(`${primaryOption.date}T00:00:00`).getTime(),
      proposedTime: primaryOption.time,
      scheduleOptions,
      recipientUids: recipients.map((recipient) => recipient.uid),
      responses: [],
      selectedOptionIndex: undefined,
      resolvedMatchroomId: request.matchroomId || undefined,
      expiresAt,
      zoneName: args.zoneName,
      zoneOwnerUid: args.zoneOwnerUid,
      branchId: args.branchId,
      branchName: args.branchName,
      requestOwnerUid: args.requestOwnerUid,
      requestKind: request.requestKind || "direct_zone",
      responseExpiresAt: expiresAt,
      message: args.message,
      createdAt: now,
      updatedAt: now,
    });

    // Update request status
    await ctx.db.patch(args.requestId, {
      updatedAt: now,
    });

    // Send notifications to the booking requester and any known captains.
    for (const recipient of recipients) {
      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: "booking.counter_offer",
        toUid: recipient.uid as any,
        status: "pending",
        dedupeKey: `booking.counter_offer:${String(offerId)}:${String(recipient.uid)}`,
        dedupePolicy: "upsert_active",
        entity: { kind: "booking_offer", id: String(offerId) },
        route: "/(player)/inbox",
        title: "Time options received",
        body: `Venue shared ${scheduleOptions.length} time option${scheduleOptions.length > 1 ? "s" : ""} for your booking.`,
        data: {
          ...buildZoneBookingNotificationData({
            requestId: String(args.requestId),
            zoneId: String(args.zoneId),
            zoneName: args.zoneName,
            branchId: args.branchId || null,
            branchName: args.branchName || null,
            offerId: String(offerId),
            proposedDate: primaryOption.date,
            proposedTime: primaryOption.time,
            pricePerPlayer: args.pricePerPlayer,
            currency,
            note: args.message || null,
          }),
          scheduleOptions,
          expiresAt,
          href: "/(player)/inbox",
        },
        expiresAt,
      });
    }

    if (isBroadcastRequest) {
      await ctx.scheduler.runAfter(
        BROADCAST_COUNTER_RESPONSE_WINDOW_MS,
        internal.matchroomBroadcast.expireBroadcastCounterOffer,
        { offerId },
      );
    }

    await recordZoneAuditEvent(ctx, {
      zoneId: String(args.zoneId),
      module: "bookings",
      action: "send_counter_offer",
      actorUid: args.adminUid || args.zoneOwnerUid,
      targetType: "booking_request",
      targetId: String(args.requestId),
      summary: `Sent counter-offer with ${scheduleOptions.length} time option${scheduleOptions.length === 1 ? "" : "s"}.`,
      details: {
        offerId: String(offerId),
        branchId: args.branchId || null,
        branchName: args.branchName || null,
        location: args.location || null,
        zoneName: args.zoneName,
        pricePerPlayer: args.pricePerPlayer,
        currency,
        scheduleOptions,
        recipientUids: recipients.map((recipient) => recipient.uid),
        expiresAt,
        message: args.message || null,
      },
      createdAt: now,
    });

    return String(offerId);
  },
});

export const respondToCounterOffer = mutation({
  args: {
    offerId: v.id("zoneOffers"),
    responderUid: v.string(),
    decision: v.union(v.literal("accepted"), v.literal("rejected")),
    selectedOptionIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const offer = await ctx.db.get(args.offerId);
    if (!offer) throw new Error("Offer not found.");
    if (offer.status !== "pending" && offer.status !== "accepted") {
      throw new Error("This negotiation is already closed.");
    }
    if (offer.expiresAt && offer.expiresAt < now && offer.status === "pending") {
      await ctx.db.patch(args.offerId, { status: "expired", updatedAt: now });
      throw new Error("This negotiation has expired.");
    }

    const request = await ctx.db.get(offer.requestId);
    if (!request) throw new Error("Booking request not found.");

    const responder = await resolveUserByAnyId(ctx, args.responderUid);
    if (!responder) throw new Error("Responder not found.");

    const recipientUids = Array.isArray(offer.recipientUids)
      ? offer.recipientUids.map((uid: string) => String(uid))
      : [];
    if (!recipientUids.includes(String(responder._id))) {
      throw new Error("You are not allowed to respond to this negotiation.");
    }

    const scheduleOptions = Array.isArray(offer.scheduleOptions) ? offer.scheduleOptions : [];
    const selectedOptionIndex =
      typeof args.selectedOptionIndex === "number" ? args.selectedOptionIndex : 0;
    if (args.decision === "accepted" && !scheduleOptions[selectedOptionIndex]) {
      throw new Error("Please choose a valid time option.");
    }

    const responses = Array.isArray(offer.responses) ? [...offer.responses] : [];
    const existingIndex = responses.findIndex(
      (response: any) => String(response.uid) === String(responder._id),
    );
    const nextResponse: {
      uid: string;
      decision: "accepted" | "rejected";
      respondedAt: number;
      selectedOptionIndex?: number;
    } = {
      uid: String(responder._id),
      decision: args.decision,
      respondedAt: now,
    };
    if (args.decision === "accepted") {
      nextResponse.selectedOptionIndex = selectedOptionIndex;
    }
    if (existingIndex >= 0) {
      responses[existingIndex] = nextResponse;
    } else {
      responses.push(nextResponse);
    }

    const acceptedResponses = responses.filter((response: any) => response.decision === "accepted");
    const rejectedResponses = responses.filter((response: any) => response.decision === "rejected");
    const patch: Record<string, any> = {
      responses,
      selectedOptionIndex:
        acceptedResponses[0]?.selectedOptionIndex ?? offer.selectedOptionIndex,
      updatedAt: now,
    };

    let finalStatus: "pending" | "accepted" | "rejected" | "expired" = offer.status;
    let matchroomId = offer.resolvedMatchroomId || request.matchroomId || undefined;
    const isBroadcastRequest = request.requestKind === "broadcast_fanout";

    if (isBroadcastRequest && request.matchroomId) {
      const requiredCaptainIds = recipientUids;
      const acceptedByRequired = requiredCaptainIds.filter((uid) =>
        acceptedResponses.some((response: any) => String(response.uid) === uid),
      );
      const rejectedByRequired = requiredCaptainIds.filter((uid) =>
        rejectedResponses.some((response: any) => String(response.uid) === uid),
      );

      if (rejectedByRequired.length > 0) {
        patch.status = "rejected";
        finalStatus = "rejected";
        await ctx.db.patch(request._id, {
          status: "cancelled",
          lifecycleStatus: "broadcast_counter_offer_rejected",
          closedReason: "counter_offer_rejected",
          updatedAt: now,
        });
        await patchOfferNotifications(ctx, {
          offerId: String(args.offerId),
          recipientUids,
          status: "rejected",
        });
        await ctx.db.patch(args.offerId, patch);
        await patchOfferNotifications(ctx, {
          offerId: String(args.offerId),
          recipientUids,
          status: args.decision,
          responderUid: String(responder._id),
        });
        await notifyZoneOfferOutcome(ctx, {
          offer,
          request,
          status: "rejected",
          title: "Counter-offer rejected",
          body: "A captain rejected the broadcast counter-offer, so the request was closed.",
          reason: "captain_rejected",
        });
        await finalizeBroadcastFailure(ctx, request.matchroomId, "counter_offer_rejected");
        return {
          status: finalStatus,
          matchroomId: matchroomId ? String(matchroomId) : undefined,
          locked: false,
        };
      }

      if (requiredCaptainIds.length > 0 && acceptedByRequired.length === requiredCaptainIds.length) {
        const chosenOption = scheduleOptions[
          acceptedResponses[0].selectedOptionIndex ?? 0
        ];
        const confirmation = await confirmBroadcastVenue(ctx, {
          matchroomId: request.matchroomId,
          winningRequestId: request._id,
          winningOfferId: args.offerId,
          zoneId: offer.zoneId,
          zoneOwnerUid: offer.zoneOwnerUid || null,
          zoneName: offer.zoneName || null,
          branchId: offer.branchId || null,
          branchName: offer.branchName || null,
          locationLabel: offer.branchName || offer.zoneName || undefined,
        });
        matchroomId = confirmation.matchroomId;
        patch.status = "accepted";
        patch.selectedOptionIndex = acceptedResponses[0].selectedOptionIndex ?? 0;
        patch.resolvedMatchroomId = matchroomId;
        finalStatus = "accepted";
        await ctx.db.patch(request._id, {
          status: "accepted",
          matchroomId,
          lifecycleStatus: "zone_accepted_locked",
          preferredDate: chosenOption ? new Date(`${chosenOption.date}T00:00:00`).getTime() : request.preferredDate,
          preferredTime: chosenOption?.time || request.preferredTime,
          updatedAt: now,
        });
        await notifyZoneOfferOutcome(ctx, {
          offer,
          request,
          status: "accepted",
          title: "Counter-offer accepted",
          body: "Both captains accepted the broadcast counter-offer and the venue is now confirmed.",
          reason: "captains_accepted",
        });
      }

      await ctx.db.patch(args.offerId, patch);
      await patchOfferNotifications(ctx, {
        offerId: String(args.offerId),
        recipientUids,
        status: args.decision,
        responderUid: String(responder._id),
      });

      return {
        status: finalStatus,
        matchroomId: matchroomId ? String(matchroomId) : undefined,
        locked: finalStatus === "accepted",
      };
    }

    if (acceptedResponses.length > 0) {
      const chosenOption = scheduleOptions[
        acceptedResponses[0].selectedOptionIndex ?? 0
      ];
      matchroomId = await ensureMatchroomForAcceptedOffer(ctx, {
        request,
        offer,
        option: chosenOption,
      });

      patch.status = "accepted";
      patch.selectedOptionIndex = acceptedResponses[0].selectedOptionIndex ?? 0;
      patch.resolvedMatchroomId = matchroomId;
      finalStatus = "accepted";

      if (acceptedResponses.length === recipientUids.length && matchroomId) {
        await ctx.db.patch(matchroomId, {
          status: "locked",
          isLocked: true,
          lockedAt: now,
          updatedAt: now,
        });
      }

      await ctx.db.patch(request._id, {
        status: "accepted",
        matchroomId,
        lifecycleStatus:
          acceptedResponses.length === recipientUids.length
            ? "zone_accepted_locked"
            : "zone_accepted",
        updatedAt: now,
      });
      await notifyZoneOfferOutcome(ctx, {
        offer,
        request,
        status: "accepted",
        title: "Counter-offer accepted",
        body: "Your counter-offer was accepted.",
        reason: "accepted",
      });
    } else if (rejectedResponses.length === recipientUids.length) {
      patch.status = "rejected";
      finalStatus = "rejected";
      await ctx.db.patch(request._id, {
        status: "cancelled",
        lifecycleStatus: "zone_schedule_rejected",
        updatedAt: now,
      });
      if (request.matchroomId) {
        await ctx.db.patch(request.matchroomId, {
          status: "cancelled",
          updatedAt: now,
        });
      }
      await patchOfferNotifications(ctx, {
        offerId: String(args.offerId),
        recipientUids,
        status: "rejected",
      });
      await notifyZoneOfferOutcome(ctx, {
        offer,
        request,
        status: "rejected",
        title: "Counter-offer rejected",
        body: "All recipients rejected the counter-offer.",
        reason: "rejected",
      });
    }

    await ctx.db.patch(args.offerId, patch);
    await patchOfferNotifications(ctx, {
      offerId: String(args.offerId),
      recipientUids,
      status: args.decision,
      responderUid: String(responder._id),
    });

    return {
      status: finalStatus,
      matchroomId: matchroomId ? String(matchroomId) : undefined,
      locked: acceptedResponses.length === recipientUids.length && finalStatus === "accepted",
    };
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

    await recordZoneAuditEvent(ctx, {
      zoneId: args.zoneId,
      module: "bookings",
      action: "create_walk_in_matchroom",
      actorUid: args.adminUid,
      targetType: "matchroom",
      targetId: String(matchroomId),
      summary: `Created walk-in matchroom "${args.title.trim() || "Walk-in Matchroom"}".`,
      details: {
        branchId: args.branchId || null,
        branchName: args.branchName || null,
        gameKey: args.gameKey,
        scheduledDate: args.scheduledDate,
        scheduledTime: args.scheduledTime,
        durationMinutes: args.durationMinutes,
        seatCount: args.seatCount,
        bookedSeatCount: args.bookedSeatCount || null,
        paymentMode: args.paymentMode,
        pricePerPlayer,
        currency: args.currency || "PKR",
        paymentStatus: args.paymentStatus,
        playerCount: args.currentPlayers,
      },
      createdAt: now,
    });

    return String(matchroomId);
  },
});
