import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { recordZoneAuditEvent } from "./zoneAudit";
import { api, internal } from "./_generated/api";
import {
  closeBroadcastOfferRequest,
  confirmBroadcastVenue,
  getBroadcastOfferExpiresAt,
  notifyBroadcastOfferReceived,
} from "./matchroomBroadcast";
import { requireKycVerified } from "./kycGate";
import { getMatchroomLockAt, validateMatchroomScheduleWindow, validateWalkInScheduleWindow, COUNTER_OFFER_TIME_WINDOW_MS } from "./timing";

function normalizeGameKey(value?: string | null) {
  const gameKey = String(value || "").trim().toLowerCase();
  return gameKey === "fc25" ? "fc26" : gameKey;
}

function normalizeResourceToken(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function parseLocalDateTimeMillis(dateValue?: string | null, timeValue?: string | null) {
  const date = String(dateValue || "").trim();
  let time = String(timeValue || "").trim();
  if (!date || !time) return null;
  const twelveHour = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time);
  if (twelveHour) {
    let hour = Number(twelveHour[1]);
    const minute = Number(twelveHour[2]);
    const period = twelveHour[3].toUpperCase();
    if (period === "PM" && hour !== 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;
    time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }
  const parsed = new Date(`${date}T${time}`).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function getScheduledStartMillis(dateValue: unknown, timeValue: unknown) {
  const time = String(timeValue || "").trim();
  if (!time) return null;

  if (typeof dateValue === "number" && Number.isFinite(dateValue)) {
    const date = new Date(dateValue);
    const localDate = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    return parseLocalDateTimeMillis(localDate, time);
  }

  return parseLocalDateTimeMillis(String(dateValue || ""), time);
}

function isExpiredForZoneDecision(request: any, linkedRoom: any, now = Date.now()) {
  const requestStatus = String(request?.status || "").toLowerCase();
  if (["expired", "cancelled"].includes(requestStatus)) return true;

  const responseExpiresAt = Number(request?.responseExpiresAt || 0);
  if (Number.isFinite(responseExpiresAt) && responseExpiresAt > 0 && responseExpiresAt <= now) {
    return true;
  }

  const requestStartAt = getScheduledStartMillis(request?.preferredDate, request?.preferredTime);
  if (requestStartAt !== null && requestStartAt <= now) return true;

  if (!linkedRoom) return false;
  const roomStatus = String(linkedRoom.status || "").toLowerCase();
  if (["expired", "cancelled", "completed"].includes(roomStatus)) return true;

  const maxPlayers = Number(linkedRoom.maxPlayers || 0);
  const confirmedSlots = [...(linkedRoom.slotsA || []), ...(linkedRoom.slotsB || [])]
    .filter((slot: any) => slot?.status === "confirmed" && (slot?.uid || slot?.user?.uid))
    .length;
  const roomIsFull =
    maxPlayers > 0 &&
    Math.max(Number(linkedRoom.currentPlayers || 0), confirmedSlots) >= maxPlayers;
  const expiresAt = Number(linkedRoom.expiresAt || 0);
  if (!roomIsFull && Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= now) {
    return true;
  }
  const broadcastExpiresAt = Number(linkedRoom.broadcastRequestExpiresAt || 0);
  if (
    Number.isFinite(broadcastExpiresAt) &&
    broadcastExpiresAt > 0 &&
    broadcastExpiresAt <= now
  ) {
    return true;
  }

  const roomStartAt =
    Number(linkedRoom.scheduledStartAt || linkedRoom.startTime || 0) ||
    getScheduledStartMillis(linkedRoom.scheduledDate, linkedRoom.scheduledTime);
  return roomStartAt !== null && roomStartAt > 0 && roomStartAt <= now;
}

async function filterActionableZoneRequests(ctx: any, requests: any[], now = Date.now()) {
  const linkedRoomIds = Array.from(
    new Set(requests.map((request) => String(request?.matchroomId || "")).filter(Boolean)),
  );
  const linkedRooms = await Promise.all(
    linkedRoomIds.map((matchroomId) => ctx.db.get(matchroomId as any).catch(() => null)),
  );
  const linkedRoomsById = new Map(
    linkedRoomIds.map((matchroomId, index) => [matchroomId, linkedRooms[index]]),
  );

  return requests.filter(
    (request) =>
      !isExpiredForZoneDecision(
        request,
        request?.matchroomId ? linkedRoomsById.get(String(request.matchroomId)) : null,
        now,
      ),
  );
}

async function assertActionableZoneRequest(
  ctx: any,
  request: any,
  now = Date.now(),
): Promise<any> {
  if (!request) throw new Error("Booking request not found.");
  if (!["open", "pending_payment"].includes(String(request.status || ""))) {
    throw new Error("Booking request can no longer be updated.");
  }
  const linkedRoom = request.matchroomId
    ? await ctx.db.get(request.matchroomId as any).catch(() => null)
    : null;
  if (isExpiredForZoneDecision(request, linkedRoom, now)) {
    throw new Error("This booking request has expired and can no longer be updated.");
  }
  return request;
}

function inferResourceTier(resource: any) {
  const explicit = normalizeResourceToken(resource?.tier);
  if (explicit) return explicit;
  const label = normalizeResourceToken(`${resource?.name || ""} ${resource?.label || ""} ${resource?.roomLabel || ""}`);
  if (label.includes("elite")) return "elite";
  if (label.includes("premium")) return "premium";
  if (label.includes("regular")) return "regular";
  if (label.includes("ps5") || label.includes("playstation 5")) return "ps5";
  if (label.includes("xbox")) return "xbox";
  return "";
}

function getTierFromRateKey(value?: string | null) {
  const [, tier] = normalizeResourceToken(value).split(":");
  return tier || "";
}

function getRequiredResourceProfile(request: any) {
  const gameKey = normalizeGameKey(request?.gameKey);
  const requestedTier =
    normalizeResourceToken(request?.requestedResourceTier) ||
    getTierFromRateKey(request?.selectedZoneRateKey);
  const requestedSurface = normalizeResourceToken(request?.requestedResourceSurface);

  if (["cs2", "cs16", "valorant"].includes(gameKey)) {
    return {
      assetType: "pc",
      requiredResourceIds: 10,
      tier: ["regular", "premium", "elite"].includes(requestedTier) ? requestedTier : "",
    };
  }

  if (["fc26", "tekken8"].includes(gameKey)) {
    return {
      assetType: "console",
      requiredResourceIds: 1,
      tier: ["ps5", "xbox"].includes(requestedTier) ? requestedTier : "",
    };
  }

  const courtAssetTypeByGame: Record<string, string> = {
    futsal: "futsal",
    indoor_cricket: "indoor_cricket",
    cricket: "indoor_cricket",
    padel: "padel",
    pickleball: "pickleball",
  };

  return {
    assetType: courtAssetTypeByGame[gameKey] || normalizeResourceToken(request?.requestedResourceAssetType),
    requiredResourceIds: 1,
    surface: requestedSurface,
  };
}

function validateSelectedResourceFit(request: any, selectedResources: any[]) {
  const profile = getRequiredResourceProfile(request);
  if (!profile.assetType) return;

  if (selectedResources.length !== profile.requiredResourceIds) {
    throw new Error(
      profile.assetType === "pc"
        ? "CS and Valorant bookings require exactly 2 complete PC rooms."
        : `This booking requires exactly ${profile.requiredResourceIds} matching resource.`,
    );
  }

  selectedResources.forEach((resource) => {
    if (normalizeResourceToken(resource.assetType) !== profile.assetType) {
      throw new Error(`${resource.name || "Selected resource"} does not support this matchroom game.`);
    }
    if ("tier" in profile && profile.tier && inferResourceTier(resource) !== profile.tier) {
      throw new Error(`${resource.name || "Selected resource"} does not match the requested resource type.`);
    }
    if ("surface" in profile && profile.surface && normalizeResourceToken(resource.surface) !== profile.surface) {
      throw new Error(`${resource.name || "Selected resource"} does not match the requested surface.`);
    }
  });
}

async function holdResourcesForBroadcastOffer(ctx: any, input: {
  request: any;
  matchroomId: any;
  resourceIds: any[];
  zoneId: string;
  branchId: string;
  adminUid: string;
  now: number;
}) {
  const resources = await Promise.all(input.resourceIds.map((resourceId) => ctx.db.get(resourceId)));
  resources.forEach((resource, index) => {
    if (!resource) {
      throw new Error("One or more selected resources no longer exist.");
    }
    if (String(resource.zoneId) !== input.zoneId) {
      throw new Error(`${resource.name || "Selected resource"} does not belong to this venue.`);
    }
    if (String(resource.branchId || "") !== String(input.branchId)) {
      throw new Error(`${resource.name || "Selected resource"} does not belong to the selected branch.`);
    }
    const status = String(resource.lifecycleStatus || "");
    const heldForSameRequest = status === "held" && String(resource.bookingRequestId || "") === String(input.request._id);
    if (status !== "available" && !heldForSameRequest) {
      throw new Error(`${resource.name || `Resource ${index + 1}`} is no longer available.`);
    }
  });

  validateSelectedResourceFit(input.request, resources);

  for (const resourceId of input.resourceIds) {
    await ctx.db.patch(resourceId, {
      lifecycleStatus: "held",
      bookingRequestId: input.request._id,
      matchroomId: input.matchroomId,
      updatedAt: input.now,
    });
  }
}

function getConfirmedSlotCount(room: any) {
  return [...(room?.slotsA || []), ...(room?.slotsB || [])].filter((slot: any) =>
    slot?.status === "confirmed" && (slot?.uid || slot?.user?.uid),
  ).length;
}

function getExpectedPaidPlayerCount(room: any) {
  return Math.max(1, Number(room?.maxPlayers || room?.currentPlayers || getConfirmedSlotCount(room) || 1));
}

function getMatchroomGrossAmount(room: any) {
  const explicit = Number(room?.merchantSettlementAmount || room?.paymentAmount || 0);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const perPlayer = Number(room?.pricing?.perPlayer || 0);
  return Math.max(0, perPlayer * getExpectedPaidPlayerCount(room));
}

function isFullPaidZoneRoom(room: any) {
  if (!room || room.locationMode !== "zone" || !room.zoneId) return false;
  if (room.zoneAdminApproved !== true) return false;
  const maxPlayers = getExpectedPaidPlayerCount(room);
  return Number(room.currentPlayers || 0) >= maxPlayers && getConfirmedSlotCount(room) >= maxPlayers;
}

async function markMerchantCapturedForAcceptedMatchroom(ctx: any, matchroomId: any) {
  const room = await ctx.db.get(matchroomId);
  if (!isFullPaidZoneRoom(room)) return null;
  if (room.merchantSettlementStatus === "captured") return room.merchantSettlementReference || null;
  const now = Date.now();
  const amount = getMatchroomGrossAmount(room);
  const reference = `merchant_capture:${String(matchroomId)}`;
  await ctx.db.patch(matchroomId, {
    merchantSettlementStatus: "captured",
    merchantSettlementAt: now,
    merchantSettlementAmount: amount,
    merchantSettlementReference: reference,
    updatedAt: now,
  });
  console.log("[settlement] merchant_capture.marked", {
    matchroomId: String(matchroomId),
    amount,
    reference,
  });
  return reference;
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

// Resolve the authenticated caller's `users` row from the verified Convex/Better
// Auth identity. Never trusts a client-passed uid — the actor is derived purely
// from the session. Throws a clean, generic message when unauthenticated.
async function requireAuthenticatedActor(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Please sign in to continue.");

  const candidates = [identity.tokenIdentifier, identity.subject]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  let actor: any = null;
  for (const candidate of candidates) {
    actor = await resolveUserByAnyId(ctx, candidate);
    if (actor) break;
  }
  if (!actor) throw new Error("Signed-in user profile not found.");
  return actor;
}

// Authorize a zone-owner action: caller must be authenticated AND own `zoneId`.
// Returns the resolved actor + zone so callers can attribute writes to the
// server-derived identity instead of any client-supplied uid.
async function requireAuthenticatedZoneOwner(ctx: any, zoneId: string) {
  const actor = await requireAuthenticatedActor(ctx);

  let zone: any = null;
  try {
    zone = await ctx.db.get(zoneId as any);
  } catch {
    zone = null;
  }
  if (!zone) throw new Error("Zone not found.");
  if (String(zone.ownerUid || "") !== String(actor._id)) {
    throw new Error("You are not authorized to manage this zone.");
  }

  return { actor, zone };
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

  const captainAValue = String(matchroom.captainUidA || matchroom.hostUid || "").trim();
  const captainBValue = String(matchroom.captainUidB || "").trim();
  const explicitlyTeamMode = String(matchroom.teamMode || request.teamMode || "").toLowerCase() === "team";
  const requiresTwoCaptains = explicitlyTeamMode || Boolean(captainBValue);

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

async function cancelMatchroomAndReturnPayments(
  ctx: any,
  input: {
    matchroomId?: Id<"matchrooms"> | null;
    reason: string;
    now: number;
  },
) {
  if (!input.matchroomId) return;

  const matchroom = await ctx.db.get(input.matchroomId);
  if (!matchroom) return;
  if (matchroom.status === "completed") {
    throw new Error("Completed matchrooms cannot be cancelled.");
  }

  if (matchroom.status !== "cancelled") {
    await ctx.db.patch(input.matchroomId, {
      status: "cancelled",
      isLocked: true,
      cancelledAt: input.now,
      cancelReason: input.reason,
      updatedAt: input.now,
    });
  }
  await ctx.runMutation(internal.matchrooms.returnPaymentsForCancelledMatchroom, {
    matchroomId: input.matchroomId,
    reason: input.reason,
  });
}

async function markCounterOfferUnavailable(ctx: any, input: {
  offerId: Id<"zoneOffers">;
  request: any;
  recipientUids: string[];
  responderUid: string;
  matchroomId?: Id<"matchrooms"> | null;
  message: string;
  now: number;
  closeRequest?: boolean;
}) {
  await ctx.db.patch(input.offerId, {
    status: "expired",
    updatedAt: input.now,
  });

  if (input.closeRequest) {
    await closeBroadcastOfferRequest(ctx, {
      request: input.request,
      offerId: input.offerId,
      offerStatus: "expired",
      lifecycleStatus: "broadcast_counter_offer_unavailable",
      closedReason: "counter_offer_unavailable",
      now: input.now,
    });
  }

  await patchOfferNotifications(ctx, {
    offerId: String(input.offerId),
    recipientUids: input.recipientUids,
    status: "expired",
    responderUid: input.responderUid,
  });

  return {
    status: "expired",
    matchroomId: input.matchroomId ? String(input.matchroomId) : undefined,
    locked: false,
    alreadyClosed: true,
    message: input.message,
  };
}

async function getBroadcastCounterOfferUnavailableMessage(
  ctx: any,
  input: {
    request: any;
    matchroomId: Id<"matchrooms">;
  },
) {
  const room = await ctx.db.get(input.matchroomId);
  if (!room) return "This matchroom is no longer available.";

  const roomStatus = String(room.status || "").toLowerCase();
  if (["cancelled", "completed", "expired"].includes(roomStatus)) {
    return "This matchroom is no longer available.";
  }
  const requestStatus = String(input.request.status || "").toLowerCase();
  if (["cancelled", "expired"].includes(requestStatus)) {
    return "This time option is no longer available.";
  }
  const broadcastStatus = String(room.broadcastRequestStatus || "").toLowerCase();
  if (["cancelled", "expired", "failed"].includes(broadcastStatus)) {
    return "This venue search is no longer available.";
  }

  if (broadcastStatus === "zone_confirmed") {
    const latestRequest = await ctx.db.get(input.request._id);
    if (
      latestRequest &&
      String(latestRequest.status || "") === "accepted" &&
      String(latestRequest.lifecycleStatus || "") === "zone_confirmed"
    ) {
      return null;
    }
    return "Another venue has already been confirmed for this matchroom.";
  }

  const resourceIds = Array.isArray(input.request.allocatedResourceIds)
    ? input.request.allocatedResourceIds
    : [];
  for (const resourceId of resourceIds) {
    const resource = await ctx.db.get(resourceId);
    if (!resource) {
      return "The selected venue resources are no longer available.";
    }
    const belongsToRequest =
      String(resource.bookingRequestId || "") === String(input.request._id);
    const resourceStatus = String(resource.lifecycleStatus || "");
    if (!belongsToRequest || !["held", "booked"].includes(resourceStatus)) {
      return "The selected venue resources are no longer available.";
    }
  }

  return null;
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
  matchroomId?: any;
}) {
  if (!input.offer?.zoneOwnerUid) return;

  const zoneOwner = await resolveUserByAnyId(ctx, String(input.offer.zoneOwnerUid));
  if (!zoneOwner) return;

  const requestId = String(input.request?._id || input.offer.requestId || "");
  const matchroomId = input.status === "accepted"
    ? String(input.matchroomId || input.request?.matchroomId || "").trim()
    : "";
  const requestRoute = `/zone/modules/bookings?segment=requests&requestId=${encodeURIComponent(requestId)}`;
  const matchroomRoute = matchroomId
    ? `/zone/modules/bookings?segment=matchrooms&matchroomId=${encodeURIComponent(matchroomId)}&requestId=${encodeURIComponent(requestId)}`
    : "";
  const route = matchroomRoute || requestRoute;
  await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
    type: "booking.counter_offer_result",
    toUid: zoneOwner._id,
    status: input.status,
    recipientRole: "zone_admin",
    dedupeKey: `booking.counter_offer_result:${String(input.offer._id)}:${input.status}`,
    dedupePolicy: "replace_active",
    route,
    matchroomId: matchroomId || undefined,
    title: input.title,
    body: input.body,
    entity: { kind: "booking_offer", id: String(input.offer._id) },
    entityId: String(input.offer._id),
    data: {
      offerId: String(input.offer._id),
      requestId,
      matchroomId: matchroomId || null,
      zoneId: String(input.offer.zoneId || input.request?.zoneId || ""),
      zoneName: input.offer.zoneName || null,
      branchId: input.offer.branchId || null,
      branchName: input.offer.branchName || null,
      decision: input.status,
      reason: input.reason || null,
      href: route,
    },
  });
}

async function ensureMatchroomForAcceptedOffer(ctx: any, input: {
  request: any;
  offer: any;
  option: { date: string; time: string; startAt?: number };
}) {
  const now = Date.now();
  const request = input.request;
  const offer = input.offer;
  const locationLabel = offer.branchName || offer.zoneName || "Zone Venue";

  // The accepted instant is the client-computed local epoch (startAt). Falling
  // back to parsing the date/time strings keeps older offers working. This is the
  // single source of truth the lobby/lifecycle read, so it must be updated too —
  // otherwise the lobby keeps showing the original (pre-counter-offer) time.
  const acceptedStartAt =
    typeof input.option.startAt === "number" && Number.isFinite(input.option.startAt)
      ? input.option.startAt
      : parseLocalDateTimeMillis(input.option.date, input.option.time);
  const acceptedZoneId = offer.zoneId || request.zoneId;
  if (!acceptedZoneId) {
    throw new Error("Accepted counter-offer is missing its zone.");
  }

  if (request.matchroomId) {
    await ctx.db.patch(request.matchroomId, {
      scheduledDate: input.option.date,
      scheduledTime: input.option.time,
      ...(acceptedStartAt != null ? { scheduledStartAt: acceptedStartAt } : {}),
      location: locationLabel,
      locationMode: "zone",
      zoneId: String(acceptedZoneId),
      ...(offer.zoneOwnerUid ? { zoneOwnerUid: offer.zoneOwnerUid } : {}),
      ...(offer.branchId ? { branchId: offer.branchId } : {}),
      bookingSource: "zone_accepted",
      zoneAdminApproved: true,
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
    ...(acceptedStartAt != null ? { scheduledStartAt: acceptedStartAt } : {}),
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
    // Authz: only the zone owner may read this zone's booking queue (S-04).
    await requireAuthenticatedZoneOwner(ctx, args.zoneId);
    const activeStatuses = ["open", "pending_payment", "accepted"] as const;

    // H-02 fix: read only THIS zone's active requests via the
    // by_zoneId_and_status index instead of scanning the whole bookingRequests
    // table on every (5s-polled) call. Only zoneId-matched requests are ever
    // surfaced (the old area-matching branch was a no-op — bookingRequests has
    // no preferredAreas usable here), so the result set is identical.
    const filteredArrays = await Promise.all(
      activeStatuses.map((status) =>
        ctx.db
          .query("bookingRequests")
          .withIndex("by_zoneId_and_status", (q) =>
            q.eq("zoneId", args.zoneId as any).eq("status", status),
          )
          .collect(),
      ),
    );
    const filtered = filteredArrays.flat();

    const deduped = new Map<string, any>();
    filtered.forEach((request) => {
      const key = getRequestIdentityKey(request);
      const existing = deduped.get(key);
      if (!existing || (request.createdAt || 0) > (existing.createdAt || 0)) {
        deduped.set(key, request);
      }
    });

    const normalizedRequests = await filterActionableZoneRequests(
      ctx,
      Array.from(deduped.values()),
    );

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

export const listBookingQueuePageForZone = query({
  args: {
    zoneId: v.string(),
    branchAreas: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
    filters: v.optional(v.object({
      requestKind: v.optional(v.string()),
      status: v.optional(v.string()),
      branchId: v.optional(v.string()),
      game: v.optional(v.string()),
      dateFrom: v.optional(v.number()),
      dateTo: v.optional(v.number()),
      searchText: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    await requireAuthenticatedZoneOwner(ctx, args.zoneId);
    const limit = Math.max(1, Math.min(50, Math.floor(Number(args.limit || 20))));
    const offset = Math.max(0, Number(args.cursor || 0) || 0);
    const filters = args.filters || {};
    const requestedStatus = String(filters.status || "active");
    const activeStatuses = ["open", "pending_payment", "accepted"] as const;
    const statuses = requestedStatus && requestedStatus !== "all" && requestedStatus !== "active"
      ? [requestedStatus]
      : [...activeStatuses];

    const filteredArrays = await Promise.all(
      statuses.map((status) =>
        ctx.db
          .query("bookingRequests")
          .withIndex("by_zoneId_and_status", (q: any) =>
            q.eq("zoneId", args.zoneId as any).eq("status", status),
          )
          .collect(),
      ),
    );
    const deduped = new Map<string, any>();
    filteredArrays.flat().forEach((request) => {
      const key = getRequestIdentityKey(request);
      const existing = deduped.get(key);
      if (!existing || (request.createdAt || 0) > (existing.createdAt || 0)) {
        deduped.set(key, request);
      }
    });

    const searchNeedle = String(filters.searchText || "").trim().toLowerCase();
    const actionableRequests = await filterActionableZoneRequests(
      ctx,
      Array.from(deduped.values()),
    );
    const rows = actionableRequests
      .filter((request: any) => {
        if (filters.requestKind && String(request.requestKind || "direct_zone") !== String(filters.requestKind)) return false;
        if (filters.branchId && String(request.branchId || "") !== String(filters.branchId)) return false;
        if (filters.game && String(filters.game) !== "all" && normalizeGameKey(request.gameKey) !== normalizeGameKey(filters.game)) return false;
        const requestTime = parseLocalDateTimeMillis(request.preferredDate, request.preferredTime) || Number(request.createdAt || 0);
        if (filters.dateFrom !== undefined && requestTime < filters.dateFrom) return false;
        if (filters.dateTo !== undefined && requestTime > filters.dateTo) return false;
        if (searchNeedle) {
          const haystack = [
            request.title,
            request.userName,
            request.gameKey,
            request.preferredDate,
            request.preferredTime,
            request.branchName,
            request.targetAreaLabel,
          ].filter(Boolean).join(" ").toLowerCase();
          if (!haystack.includes(searchNeedle)) return false;
        }
        return true;
      })
      .sort((a: any, b: any) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

    const pageRows = rows.slice(offset, offset + limit);
    const users = await Promise.all(
      pageRows.map((request) => ctx.db.get(request.userId)).map((promise) => promise.catch(() => null)),
    );
    const userMap = new Map(pageRows.map((request, index) => [String(request.userId), users[index]]));
    const page = pageRows.map((r: any) => ({
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
    const nextOffset = offset + page.length;
    return {
      page,
      isDone: nextOffset >= rows.length,
      continueCursor: nextOffset >= rows.length ? null : String(nextOffset),
      total: rows.length,
    };
  },
});

export const listBookingHistoryForZone = query({
  args: {
    zoneId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { zone } = await requireAuthenticatedZoneOwner(ctx, args.zoneId);
    const limit = Math.max(1, Math.min(100, Math.floor(Number(args.limit || 20))));
    const fetchLimit = Math.max(50, Math.min(300, limit * 6));

    const requestRows = await ctx.db
      .query("bookingRequests")
      .withIndex("by_zoneId_and_requestKind_and_updatedAt", (q: any) =>
        q.eq("zoneId", zone._id).eq("requestKind", "broadcast_fanout"),
      )
      .order("desc")
      .take(fetchLimit);

    const zoneOffers = await ctx.db
      .query("zoneOffers")
      .withIndex("by_zoneId", (q: any) => q.eq("zoneId", zone._id))
      .order("desc")
      .take(fetchLimit);

    const requestsById = new Map<string, any>();
    for (const request of requestRows) {
      requestsById.set(String(request._id), request);
    }

    const missingOfferRequestIds = Array.from(
      new Set(
        zoneOffers
          .map((offer: any) => String(offer.requestId || ""))
          .filter((requestId: string) => requestId && !requestsById.has(requestId)),
      ),
    );
    const offerRequests = await Promise.all(
      missingOfferRequestIds.map((requestId) => ctx.db.get(requestId as any).catch(() => null)),
    );
    offerRequests.forEach((request: any) => {
      if (request?.requestKind === "broadcast_fanout") {
        requestsById.set(String(request._id), request);
      }
    });

    const offersByRequestId = new Map<string, any[]>();
    zoneOffers.forEach((offer: any) => {
      const requestId = String(offer.requestId || "");
      if (!requestId) return;
      const current = offersByRequestId.get(requestId) || [];
      current.push(offer);
      offersByRequestId.set(requestId, current);
    });

    const matchroomIds = Array.from(
      new Set(
        Array.from(requestsById.values())
          .map((request: any) => String(request.matchroomId || ""))
          .filter(Boolean),
      ),
    );
    const matchroomRows = await Promise.all(
      matchroomIds.map((matchroomId) => ctx.db.get(matchroomId as any).catch(() => null)),
    );
    const matchroomsById = new Map<string, any>();
    matchroomRows.forEach((room: any) => {
      if (room?._id) matchroomsById.set(String(room._id), room);
    });

    const chooseOffer = (offers: any[]) =>
      [...offers].sort((left, right) => {
        const statusPriority: Record<string, number> = { accepted: 4, rejected: 3, expired: 2, pending: 1 };
        const leftPriority = statusPriority[String(left.status || "")] || 0;
        const rightPriority = statusPriority[String(right.status || "")] || 0;
        if (leftPriority !== rightPriority) return rightPriority - leftPriority;
        return Number(right.updatedAt || right.createdAt || 0) - Number(left.updatedAt || left.createdAt || 0);
      })[0] || null;

    const isHistoryRow = (request: any, offer: any, matchroom: any) => {
      const requestStatus = String(request.status || "");
      const lifecycleStatus = String(request.lifecycleStatus || "");
      const closedReason = String(request.closedReason || "");
      const offerStatus = String(offer?.status || "");
      const broadcastStatus = String(matchroom?.broadcastRequestStatus || "");
      const confirmedThisZone =
        broadcastStatus === "zone_confirmed" &&
        String(matchroom?.confirmedZoneId || matchroom?.zoneId || "") === String(zone._id);

      return (
        requestStatus === "expired" ||
        requestStatus === "cancelled" ||
        Boolean(closedReason) ||
        lifecycleStatus === "zone_confirmed" ||
        lifecycleStatus.includes("expired") ||
        lifecycleStatus.includes("rejected") ||
        lifecycleStatus.includes("closed") ||
        confirmedThisZone ||
        ["accepted", "rejected", "expired"].includes(offerStatus) ||
        ["expired", "failed", "cancelled", "zone_confirmed"].includes(broadcastStatus)
      );
    };

    return Array.from(requestsById.values())
      .filter((request: any) => request.requestKind === "broadcast_fanout")
      .map((request: any) => {
        const offers = offersByRequestId.get(String(request._id)) || [];
        const offer = chooseOffer(offers);
        const matchroom = request.matchroomId ? matchroomsById.get(String(request.matchroomId)) || null : null;
        return { request, offer, matchroom };
      })
      .filter(({ request, offer, matchroom }: any) => isHistoryRow(request, offer, matchroom))
      .sort((left: any, right: any) =>
        Number(right.request.updatedAt || right.request.createdAt || 0) -
        Number(left.request.updatedAt || left.request.createdAt || 0),
      )
      .slice(0, limit)
      .map(({ request, offer, matchroom }: any) => ({
        id: String(request._id),
        requestId: String(request._id),
        matchroomId: request.matchroomId ? String(request.matchroomId) : null,
        zoneId: String(zone._id),
        userId: request.userId ? String(request.userId) : null,
        userName: request.userName || "Player",
        title: request.title || `Broadcast request for ${normalizeGameKey(request.gameKey).toUpperCase()}`,
        gameKey: normalizeGameKey(request.gameKey),
        status: request.status || null,
        lifecycleStatus: request.lifecycleStatus || null,
        closedReason: request.closedReason || null,
        requestKind: request.requestKind || null,
        preferredDate: request.preferredDate || null,
        preferredTime: request.preferredTime || null,
        targetAreaLabel: request.targetAreaLabel || null,
        preferredAreas: Array.isArray(request.preferredAreas) ? request.preferredAreas : [],
        budgetPerPlayer: Number(request.budgetPerPlayer || 0) || null,
        currency: request.currency || "PKR",
        allocatedBranchId: request.allocatedBranchId || null,
        allocatedResourceIds: Array.isArray(request.allocatedResourceIds)
          ? request.allocatedResourceIds.map((resourceId: any) => String(resourceId))
          : [],
        allocatedAt: request.allocatedAt || null,
        createdAt: request.createdAt || null,
        updatedAt: request.updatedAt || request.createdAt || null,
        offer: offer
          ? {
              id: String(offer._id),
              offerId: String(offer._id),
              status: offer.status || null,
              offerType: offer.offerType || null,
              requestKind: offer.requestKind || null,
              proposedPrice: Number(offer.proposedPrice || 0) || null,
              proposedDate: offer.proposedDate || null,
              proposedTime: offer.proposedTime || null,
              scheduleOptions: Array.isArray(offer.scheduleOptions) ? offer.scheduleOptions : [],
              expiresAt: offer.expiresAt || offer.responseExpiresAt || null,
              responseExpiresAt: offer.responseExpiresAt || offer.expiresAt || null,
              zoneName: offer.zoneName || null,
              branchId: offer.branchId || null,
              branchName: offer.branchName || null,
              selectedOptionIndex: offer.selectedOptionIndex ?? null,
              resolvedMatchroomId: offer.resolvedMatchroomId ? String(offer.resolvedMatchroomId) : null,
              createdAt: offer.createdAt || null,
              updatedAt: offer.updatedAt || offer.createdAt || null,
            }
          : null,
        matchroom: matchroom
          ? {
              id: String(matchroom._id),
              status: matchroom.status || null,
              locationMode: matchroom.locationMode || null,
              broadcastRequestStatus: matchroom.broadcastRequestStatus || null,
              confirmedZoneId: matchroom.confirmedZoneId || matchroom.zoneId || null,
              confirmedBranchId: matchroom.confirmedBranchId || matchroom.branchId || null,
              venueConfirmedAt: matchroom.venueConfirmedAt || null,
              location: matchroom.location || null,
            }
          : null,
      }));
  },
});

async function loadAcceptedRequestMatchroomFallbacks(ctx: any, zoneId: string) {
  const acceptedRequests = await ctx.db
    .query("bookingRequests")
    .withIndex("by_zoneId_and_status", (q: any) =>
      q.eq("zoneId", zoneId as any).eq("status", "accepted"),
    )
    .order("desc")
    .take(200);

  const directAcceptedRequests = acceptedRequests.filter(
    (request: any) => request.requestKind !== "broadcast_fanout",
  );
  const linkedRooms = await Promise.all(
    directAcceptedRequests.map((request: any) =>
      request.matchroomId ? ctx.db.get(request.matchroomId).catch(() => null) : null,
    ),
  );

  return linkedRooms
    .map((room: any, index: number) => {
      if (!room) return null;
      const request = directAcceptedRequests[index];
      return {
        ...room,
        zoneId,
        bookingSource: "zone_accepted",
        zoneAdminApproved: true,
        branchId: room.branchId || request.allocatedBranchId || undefined,
        resourceIds: room.resourceIds || request.allocatedResourceIds || undefined,
      };
    })
    .filter(Boolean);
}

// List matchrooms for zone admin (by zoneId, ownerUid, location)
export const listMatchroomsForZone = query({
  args: {
    zoneId: v.string(),
    ownerUid: v.optional(v.string()),
    locationHints: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Authz: only the zone owner may read this zone's matchrooms (S-04).
    await requireAuthenticatedZoneOwner(ctx, args.zoneId);
    const merged = new Map<string, any>();
    const includeInAdminList = (matchroom: any) =>
      String(matchroom.zoneId || "") === args.zoneId &&
      (matchroom.bookingSource === "zone_accepted" ||
        matchroom.bookingSource === "walkin" ||
        matchroom.zoneAdminApproved === true);

    // By zoneId — the only source needed. H-03 fix: the former ownerUid and
    // locationHints branches each scanned the global matchrooms table via
    // by_createdAt.take(200) (silently dropping a zone's older rooms once 200
    // newer rooms exist platform-wide, and re-running every 5s). They were also
    // redundant: includeInAdminList already requires zoneId === args.zoneId, so
    // any room they could add is already returned by this indexed by_zoneId
    // query. Result set is unchanged; the global scans are removed.
    const byZone = await ctx.db
      .query("matchrooms")
      .withIndex("by_zoneId", (q) => q.eq("zoneId", args.zoneId))
      .order("desc")
      .collect();

    byZone
      .filter(includeInAdminList)
      .forEach((m) => merged.set(String(m._id), { ...m, id: m._id }));

    // Counter-offers accepted before the lifecycle metadata fix can still have
    // a correctly linked accepted request but no zoneId on the player-created
    // matchroom. Surface those rooms immediately; allocating resources persists
    // the repaired metadata onto the matchroom.
    const acceptedRequestFallbacks = await loadAcceptedRequestMatchroomFallbacks(ctx, args.zoneId);
    acceptedRequestFallbacks
      .filter(includeInAdminList)
      .forEach((m: any) => merged.set(String(m._id), { ...m, id: m._id }));

    return Array.from(merged.values())
      .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
  },
});

export const listMatchroomsPageForZone = query({
  args: {
    zoneId: v.string(),
    limit: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
    filters: v.optional(v.object({
      status: v.optional(v.string()),
      bookingSource: v.optional(v.string()),
      paymentStatus: v.optional(v.string()),
      dateFrom: v.optional(v.number()),
      dateTo: v.optional(v.number()),
      searchText: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    await requireAuthenticatedZoneOwner(ctx, args.zoneId);
    const limit = Math.max(1, Math.min(50, Math.floor(Number(args.limit || 20))));
    const offset = Math.max(0, Number(args.cursor || 0) || 0);
    const filters = args.filters || {};
    const searchNeedle = String(filters.searchText || "").trim().toLowerCase();
    const source = String(filters.bookingSource || "all");

    const baseRows = source && source !== "all"
      ? await ctx.db
          .query("matchrooms")
          .withIndex("by_zoneId_and_bookingSource_and_createdAt", (q: any) =>
            q.eq("zoneId", args.zoneId).eq("bookingSource", source),
          )
          .order("desc")
          .collect()
      : await ctx.db
          .query("matchrooms")
          .withIndex("by_zoneId", (q) => q.eq("zoneId", args.zoneId))
          .order("desc")
          .collect();

    const acceptedRequestFallbacks = await loadAcceptedRequestMatchroomFallbacks(ctx, args.zoneId);
    const mergedRows = new Map<string, any>();
    [...baseRows, ...acceptedRequestFallbacks].forEach((matchroom: any) => {
      mergedRows.set(String(matchroom._id), matchroom);
    });

    const rows = Array.from(mergedRows.values())
      .filter((matchroom: any) =>
        !source || source === "all" || String(matchroom.bookingSource || "") === source
      )
      .filter((matchroom: any) =>
        String(matchroom.zoneId || "") === args.zoneId &&
        (matchroom.bookingSource === "zone_accepted" ||
          matchroom.bookingSource === "walkin" ||
          matchroom.zoneAdminApproved === true)
      )
      .filter((matchroom: any) => {
        if (filters.status && String(filters.status) !== "all" && String(matchroom.status || "") !== String(filters.status)) return false;
        if (filters.paymentStatus && String(filters.paymentStatus) !== "all" && String(matchroom.paymentStatus || "unpaid") !== String(filters.paymentStatus)) return false;
        const start = Number(matchroom.scheduledStartAt || matchroom.createdAt || 0);
        if (filters.dateFrom !== undefined && start < filters.dateFrom) return false;
        if (filters.dateTo !== undefined && start > filters.dateTo) return false;
        if (searchNeedle) {
          const haystack = [
            matchroom.title,
            matchroom.game,
            matchroom.hostName,
            matchroom.location,
            matchroom.scheduledDate,
            matchroom.scheduledTime,
          ].filter(Boolean).join(" ").toLowerCase();
          if (!haystack.includes(searchNeedle)) return false;
        }
        return true;
      })
      .sort((a: any, b: any) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
      .map((matchroom: any) => ({ ...matchroom, id: matchroom._id }));

    const page = rows.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    return {
      page,
      isDone: nextOffset >= rows.length,
      continueCursor: nextOffset >= rows.length ? null : String(nextOffset),
      total: rows.length,
    };
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
      scheduledStartAt: v.optional(v.number()),
      lockAt: v.optional(v.number()),
      expiresAt: v.optional(v.number()),
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
    await requireKycVerified(ctx);
    // Authz: caller must own this zone (CR-01). Actor is derived from the
    // session; client-passed adminUid is treated only as a non-authoritative hint.
    const { actor } = await requireAuthenticatedZoneOwner(ctx, args.zoneId);
    const actorUid = String(actor._id);
    const now = Date.now();
    const bookingRequest = await assertActionableZoneRequest(
      ctx,
      await ctx.db.get(args.requestId),
      now,
    );
    if (!args.resourceIds.length) {
      throw new Error("Select at least one resource.");
    }

    const selectedResources = await Promise.all(
      args.resourceIds.map((resourceId) => ctx.db.get(resourceId)),
    );
    validateSelectedResourceFit(bookingRequest, selectedResources.filter(Boolean));
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
      matchroomId = bookingRequest.matchroomId;
      const room: any = await ctx.db.get(bookingRequest.matchroomId);
      if (!room || room.locationMode !== "broadcast") {
        throw new Error("Broadcast matchroom not found.");
      }
      if (room.broadcastRequestStatus === "zone_confirmed") {
        throw new Error("A venue has already been confirmed for this matchroom.");
      }
      if (room.broadcastRequestStatus !== "waiting_for_zones") {
        throw new Error("This broadcast request is no longer accepting venue offers.");
      }
      if (Number(room.broadcastRequestExpiresAt || 0) > 0 && Number(room.broadcastRequestExpiresAt) <= now) {
        throw new Error("This broadcast request has expired.");
      }

      const existingOffers = await ctx.db
        .query("zoneOffers")
        .withIndex("by_requestId", (q: any) => q.eq("requestId", args.requestId))
        .collect();
      if (existingOffers.length > 0) {
        throw new Error("A venue offer already exists for this broadcast request.");
      }

      const offerExpiresAt = getBroadcastOfferExpiresAt(room, now);
      if (!offerExpiresAt) {
        throw new Error("The broadcast offer response window has expired.");
      }

      await holdResourcesForBroadcastOffer(ctx, {
        request: bookingRequest,
        matchroomId,
        resourceIds: args.resourceIds,
        zoneId: args.zoneId,
        branchId: args.branchId,
        adminUid: args.adminUid,
        now,
      });

      await ctx.db.patch(args.requestId, {
        status: "accepted",
        allocatedBranchId: args.branchId,
        allocatedResourceIds: args.resourceIds,
        allocatedAt: now,
        allocatedByUid: args.adminUid,
        lifecycleStatus: "broadcast_offer_pending_selection",
        updatedAt: now,
      });

      const offerId = await ctx.db.insert("zoneOffers", {
        requestId: args.requestId,
        zoneId: args.zoneId as any,
        status: "pending",
        offerType: "standard_accept",
        requestKind: "broadcast_fanout",
        proposedPrice: Number(bookingRequest.budgetPerPlayer || args.matchroomData.pricing?.perPlayer || 0),
        proposedDate: bookingRequest.preferredDate,
        proposedTime: bookingRequest.preferredTime,
        expiresAt: offerExpiresAt,
        responseExpiresAt: offerExpiresAt,
        zoneName: args.zoneName || "Zone Venue",
        zoneOwnerUid: args.adminUid,
        branchId: args.branchId,
        branchName: args.branchName,
        requestOwnerUid: args.requestOwnerUid,
        message: args.note,
        createdAt: now,
        updatedAt: now,
      });

      await notifyBroadcastOfferReceived(ctx, {
        room: { ...room, _id: bookingRequest.matchroomId },
        offerId,
        requestId: args.requestId,
        zoneName: args.zoneName || "Zone Venue",
        expiresAt: offerExpiresAt,
      });

      await ctx.scheduler.runAfter(
        offerExpiresAt - now,
        internal.matchroomBroadcast.expireBroadcastCounterOffer,
        { offerId },
      );
    } else if (bookingRequest.matchroomId) {
      matchroomId = bookingRequest.matchroomId;

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

      await ctx.db.patch(matchroomId, {
        status: "locked",
        isLocked: true,
        zoneId: args.zoneId,
        zoneOwnerUid: args.adminUid,
        locationMode: (args.matchroomData.locationMode as any) || "zone",
        zoneAdminApproved: true,
        bookingSource: "zone_accepted",
        branchId: args.branchId,
        resourceIds: args.resourceIds,
        location: args.location || args.branchName || args.zoneName || args.matchroomData.location || "Zone Venue",
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
      await markMerchantCapturedForAcceptedMatchroom(ctx, matchroomId);
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
        zoneOwnerUid: args.adminUid,
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
      await markMerchantCapturedForAcceptedMatchroom(ctx, matchroomId);

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
      actorUid,
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
    await requireKycVerified(ctx);
    // Authz: caller must own this zone (CR-01).
    const { actor } = await requireAuthenticatedZoneOwner(ctx, args.zoneId);
    const actorUid = String(actor._id);
    const now = Date.now();
    const request = await assertActionableZoneRequest(
      ctx,
      await ctx.db.get(args.requestId),
      now,
    );

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
    if (request?.requestKind === "broadcast_fanout") {
      const offers = await ctx.db
        .query("zoneOffers")
        .withIndex("by_requestId", (q: any) => q.eq("requestId", args.requestId))
        .collect();
      for (const offer of offers) {
        if (offer.status !== "pending") continue;
        await ctx.db.patch(offer._id, { status: "rejected", updatedAt: now });
      }
      await closeBroadcastOfferRequest(ctx, {
        request,
        offerStatus: "rejected",
        lifecycleStatus: "broadcast_rejected",
        closedReason: "rejected_by_zone",
        now,
      });
    } else if (request?.matchroomId) {
      await ctx.runMutation(internal.matchrooms.returnPaymentsForCancelledMatchroom, {
        matchroomId: request.matchroomId,
        reason: "booking_request_rejected",
      });
    }

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
      actorUid,
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
      endTime: v.optional(v.string()),
      startAt: v.optional(v.number()),
    })),
    pricePerPlayer: v.number(),
    currency: v.optional(v.string()),
    location: v.optional(v.string()),
    message: v.optional(v.string()),
    expiresInMinutes: v.optional(v.number()),
    // Client-computed (local-time) epoch ms used to bound the alternative time.
    // originalStartAt = the originally requested start; proposedStartAts = one
    // entry per scheduleOption. Both are validated server-side below.
    originalStartAt: v.optional(v.number()),
    proposedStartAts: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    await requireKycVerified(ctx);
    // Authz: caller must own this zone (CR-01).
    const { actor } = await requireAuthenticatedZoneOwner(ctx, String(args.zoneId));
    const actorUid = String(actor._id);
    const now = Date.now();
    const currency = args.currency || "PKR";
    const request = await assertActionableZoneRequest(
      ctx,
      await ctx.db.get(args.requestId),
      now,
    );

    // Alternative-time rules: the proposed time(s) must be in the future and
    // within ±2 hours of the originally requested time. Comparisons use
    // client-computed epoch ms (same local frame) to avoid server-TZ skew.
    let originalStartMs =
      typeof args.originalStartAt === "number" && Number.isFinite(args.originalStartAt)
        ? args.originalStartAt
        : null;
    if (originalStartMs == null && request.matchroomId) {
      const linkedRoom = await ctx.db.get(request.matchroomId as any);
      if (linkedRoom && typeof (linkedRoom as any).scheduledStartAt === "number") {
        originalStartMs = (linkedRoom as any).scheduledStartAt;
      }
    }
    if (originalStartMs == null && typeof (request as any).preferredDate === "number") {
      originalStartMs = parseLocalDateTimeMillis(
        new Date((request as any).preferredDate).toISOString().slice(0, 10),
        (request as any).preferredTime || "00:00",
      );
    }

    const proposedStartAts = Array.isArray(args.proposedStartAts) ? args.proposedStartAts : [];
    for (const proposedMs of proposedStartAts) {
      if (typeof proposedMs !== "number" || !Number.isFinite(proposedMs)) continue;
      if (proposedMs <= now) {
        throw new Error("Alternative time cannot be in the past.");
      }
      if (originalStartMs != null && Math.abs(proposedMs - originalStartMs) > COUNTER_OFFER_TIME_WINDOW_MS) {
        throw new Error("Alternative time must be within 2 hours of the original requested time.");
      }
    }

    const scheduleOptions = args.scheduleOptions
      .map((option, index) => ({
        date: String(option.date || "").trim(),
        time: String(option.time || "").trim(),
        endTime: option.endTime ? String(option.endTime).trim() : undefined,
        // Prefer the client-computed local instant; fall back to the matching
        // proposedStartAts entry so older callers still persist a timestamp.
        startAt:
          typeof option.startAt === "number" && Number.isFinite(option.startAt)
            ? option.startAt
            : typeof proposedStartAts[index] === "number" &&
                Number.isFinite(proposedStartAts[index])
              ? proposedStartAts[index]
              : undefined,
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
      ? getBroadcastOfferExpiresAt(broadcastApprovalState?.matchroom, now)
      : now + Math.max(60, args.expiresInMinutes || 240) * 60 * 1000;
    if (!expiresAt) {
      throw new Error("The broadcast counter-offer response window has expired.");
    }
    const primaryOption = scheduleOptions[0];

    // Create zone offer
    const offerId = await ctx.db.insert("zoneOffers", {
      requestId: args.requestId,
      zoneId: args.zoneId,
      status: "pending",
      offerType: "counter_offer",
      proposedPrice: args.pricePerPlayer,
      proposedDate: new Date(`${primaryOption.date}T00:00:00`).getTime(),
      proposedTime: primaryOption.time,
      proposedStartAt: primaryOption.startAt,
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
        expiresAt - now,
        internal.matchroomBroadcast.expireBroadcastCounterOffer,
        { offerId },
      );
    }

    await recordZoneAuditEvent(ctx, {
      zoneId: String(args.zoneId),
      module: "bookings",
      action: "send_counter_offer",
      actorUid,
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

    const request = await ctx.db.get(offer.requestId);
    if (!request) throw new Error("Booking request not found.");

    const recipientUids = Array.isArray(offer.recipientUids)
      ? offer.recipientUids.map((uid: string) => String(uid))
      : [];
    let matchroomId = offer.resolvedMatchroomId || request.matchroomId || undefined;

    // Authz: derive the responder from the authenticated session, never from the
    // client-passed responderUid (CR-01 / IDOR). The recipient check below then
    // confirms this signed-in user is actually an invited recipient.
    const responder = await requireAuthenticatedActor(ctx);

    if (!recipientUids.includes(String(responder._id))) {
      throw new Error("You are not allowed to respond to this negotiation.");
    }

    if (offer.status !== "pending" && offer.status !== "accepted") {
      const closedMatchroomId = offer.resolvedMatchroomId
        ? String(offer.resolvedMatchroomId)
        : request.matchroomId
          ? String(request.matchroomId)
          : undefined;
      return {
        status: String(offer.status || "rejected"),
        ...(closedMatchroomId ? { matchroomId: closedMatchroomId } : {}),
        locked: false,
        alreadyClosed: true,
        message: "This time option is no longer available.",
      };
    }
    if (offer.expiresAt && offer.expiresAt < now && offer.status === "pending") {
      return await markCounterOfferUnavailable(ctx, {
        offerId: args.offerId,
        request,
        recipientUids,
        responderUid: String(responder._id),
        matchroomId,
        message: "This time option has expired.",
        now,
      });
    }

    const scheduleOptions = Array.isArray(offer.scheduleOptions) ? offer.scheduleOptions : [];
    const selectedOptionIndex =
      typeof args.selectedOptionIndex === "number" ? args.selectedOptionIndex : 0;
    if (args.decision === "accepted" && !scheduleOptions[selectedOptionIndex]) {
      return {
        status: "invalid",
        matchroomId: matchroomId ? String(matchroomId) : undefined,
        locked: false,
        message: "Please choose a valid time option.",
      };
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
        await closeBroadcastOfferRequest(ctx, {
          request,
          offerId: args.offerId,
          offerStatus: "rejected",
          lifecycleStatus: "broadcast_counter_offer_rejected",
          closedReason: "counter_offer_rejected",
          now,
        });
        await cancelMatchroomAndReturnPayments(ctx, {
          matchroomId: request.matchroomId,
          reason: "broadcast_counter_offer_rejected",
          now,
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
        const unavailableMessage = await getBroadcastCounterOfferUnavailableMessage(ctx, {
          request,
          matchroomId: request.matchroomId,
        });
        if (unavailableMessage) {
          return await markCounterOfferUnavailable(ctx, {
            offerId: args.offerId,
            request,
            recipientUids,
            responderUid: String(responder._id),
            matchroomId: request.matchroomId,
            message: unavailableMessage,
            now,
            closeRequest: true,
          });
        }

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
          resourceIds: Array.isArray(request.allocatedResourceIds) ? request.allocatedResourceIds : undefined,
        });
        matchroomId = confirmation.matchroomId;
        patch.status = "accepted";
        patch.selectedOptionIndex = acceptedResponses[0].selectedOptionIndex ?? 0;
        patch.resolvedMatchroomId = matchroomId;
        finalStatus = "accepted";
        await ctx.db.patch(request._id, {
          status: "accepted",
          matchroomId,
          lifecycleStatus: "zone_confirmed",
          preferredDate: chosenOption ? new Date(`${chosenOption.date}T00:00:00`).getTime() : request.preferredDate,
          preferredTime: chosenOption?.time || request.preferredTime,
          updatedAt: now,
        });
        // Apply the accepted slot to the broadcast matchroom so the lobby shows
        // the agreed time. scheduledStartAt is the source of truth the lobby/
        // lifecycle read, so it must move with the accepted counter-offer.
        if (chosenOption && matchroomId) {
          const acceptedStartAt =
            typeof chosenOption.startAt === "number" && Number.isFinite(chosenOption.startAt)
              ? chosenOption.startAt
              : parseLocalDateTimeMillis(chosenOption.date, chosenOption.time);
          await ctx.db.patch(matchroomId, {
            scheduledDate: chosenOption.date,
            scheduledTime: chosenOption.time,
            ...(acceptedStartAt != null ? { scheduledStartAt: acceptedStartAt } : {}),
            updatedAt: now,
          });
        }
        await notifyZoneOfferOutcome(ctx, {
          offer,
          request,
          status: "accepted",
          title: "Counter-offer accepted",
          body: "Both captains accepted the broadcast counter-offer and the venue is now confirmed.",
          reason: "captains_accepted",
          matchroomId,
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

    // Require unanimous acceptance for counter-offer to proceed
    // Any rejection results in cancellation and refund
    if (acceptedResponses.length === recipientUids.length) {
      // All recipients accepted - proceed with the counter-offer
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

      if (matchroomId) {
        await ctx.db.patch(matchroomId, {
          status: "locked",
          isLocked: true,
          lockedAt: now,
          updatedAt: now,
        });
      }

      await ctx.db.patch(request._id, {
        status: "accepted",
        zoneId: offer.zoneId,
        matchroomId,
        lifecycleStatus: "zone_accepted_locked",
        updatedAt: now,
      });
      await notifyZoneOfferOutcome(ctx, {
        offer,
        request,
        status: "accepted",
        title: "Counter-offer accepted",
        body: "Your counter-offer was accepted.",
        reason: "accepted",
        matchroomId,
      });
    } else if (rejectedResponses.length > 0) {
      // Any rejection - cancel the matchroom and refund payments
      patch.status = "rejected";
      finalStatus = "rejected";
      await ctx.db.patch(request._id, {
        status: "cancelled",
        lifecycleStatus: "zone_schedule_rejected",
        updatedAt: now,
      });
      if (request.matchroomId) {
        await cancelMatchroomAndReturnPayments(ctx, {
          matchroomId: request.matchroomId,
          reason: "zone_schedule_rejected",
          now,
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
        body: "At least one recipient rejected the counter-offer.",
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
    await requireKycVerified(ctx);
    // Authz: caller must own this zone (CR-01).
    const { actor } = await requireAuthenticatedZoneOwner(ctx, args.zoneId);
    const actorUid = String(actor._id);
    const now = Date.now();
    const pricePerPlayer = args.pricePerPlayer ?? 0;
    const scheduledStartAt = parseLocalDateTimeMillis(args.scheduledDate, args.scheduledTime);
    const scheduleValidation = validateWalkInScheduleWindow(scheduledStartAt, now);
    if (!scheduleValidation.ok) {
      throw new Error(scheduleValidation.message);
    }

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
      scheduledStartAt: scheduledStartAt || undefined,
      lockAt: getMatchroomLockAt(scheduledStartAt) || undefined,
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
      actorUid,
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
