import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  BROADCAST_COUNTER_RESPONSE_WINDOW_MS as BROADCAST_COUNTER_RESPONSE_WINDOW_MS_FROM_TIMING,
  BROADCAST_OFFER_RESPONSE_WINDOW_MS,
  BROADCAST_ZONE_RESPONSE_WINDOW_MS,
  capExpiryAtLockTime,
  getMatchroomLockAt,
  validateMatchroomScheduleWindow,
} from "./timing";

export const BROADCAST_COUNTER_RESPONSE_WINDOW_MS = BROADCAST_COUNTER_RESPONSE_WINDOW_MS_FROM_TIMING;
const PC_SETUP_GAME_KEYS = ["cs2", "cs16", "valorant"] as const;
const NO_ELIGIBLE_ZONES_MESSAGE = "No available zones found for your selected areas.";
const CLOSED_ELSEWHERE_REASON = "closed_elsewhere";

function normalizeStringList(values: unknown[]) {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

function normalizeGameKey(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  const compact = normalized.replace(/[\s._-]+/g, "");
  if (compact === "fc25" || compact === "fc26") return "fc26";
  if (compact === "cs2" || compact === "cs16" || compact === "counterstrike16") return compact === "cs2" ? "cs2" : "cs16";
  if (compact === "valorant" || compact === "tekken8") return compact;
  return normalized;
}

function isPcSetupGame(value?: string | null) {
  const gameKey = normalizeGameKey(value);
  return PC_SETUP_GAME_KEYS.some((key) => key === gameKey);
}

function zoneSupportsGame(zone: any, rawGameKey?: string | null) {
  const gameKey = normalizeGameKey(rawGameKey);
  if (!gameKey) return true;

  if (Array.isArray(zone?.games)) {
    const normalized = new Set(zone.games.map((value: unknown) =>
      normalizeGameKey(String(value || "")),
    ));
    if (isPcSetupGame(gameKey)) {
      return PC_SETUP_GAME_KEYS.some((key) => normalized.has(key));
    }
    return normalized.has(gameKey);
  }

  const flags = zone?.games || {};
  switch (gameKey) {
    case "cs2":
    case "cs16":
    case "valorant":
      return flags.supportsCs2 === true || flags.supportsCs16 === true || flags.supportsValorant === true;
    case "fc26":
      return flags.supportsFc26 === true || flags.supportsFc25 === true;
    case "tekken8":
      return flags.supportsTekken8 === true;
    case "futsal":
      return flags.supportsFutsal === true;
    case "indoor_cricket":
      return flags.supportsIndoorCricket === true;
    case "padel":
      return flags.supportsPadel === true;
    case "pickleball":
      return flags.supportsPickleball === true;
    default:
      return false;
  }
}

function getZoneAreaLabels(zone: any) {
  const labels = new Set<string>();
  const primaryArea = String(zone?.primaryBranch?.areaLabel || "").trim();
  if (primaryArea) labels.add(primaryArea);
  const branches = Array.isArray(zone?.branches) ? zone.branches : [];
  branches.forEach((branch: any) => {
    const areaLabel = String(branch?.areaLabel || "").trim();
    if (areaLabel) labels.add(areaLabel);
  });
  return Array.from(labels);
}

function findMatchingArea(zone: any, selectedAreas: string[]) {
  const selected = new Set(normalizeStringList(selectedAreas));
  const zoneAreas = getZoneAreaLabels(zone);
  return zoneAreas.find((area) => selected.has(area)) || null;
}

function getPreferredDateMillis(room: any) {
  if (typeof room?.scheduledStartAt === "number") return room.scheduledStartAt;
  if (typeof room?.scheduledDate === "string" && room.scheduledDate.trim()) {
    const parsed = new Date(`${room.scheduledDate}T00:00:00`).getTime();
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function isRoomAlreadyResolved(room: any) {
  return (
    room?.broadcastRequestStatus === "zone_confirmed" ||
    room?.status === "cancelled" ||
    room?.status === "expired" ||
    (room?.confirmedZoneId && room?.venueConfirmedAt)
  );
}

async function listBroadcastRequestsForMatchroom(ctx: any, matchroomId: Id<"matchrooms">) {
  return await ctx.db
    .query("bookingRequests")
    .withIndex("by_matchroomId", (q: any) => q.eq("matchroomId", matchroomId))
    .collect();
}

export function canSelectBroadcastOffer(userId: string, matchroom: any) {
  const selectorId = String(userId || "").trim();
  if (!selectorId || !matchroom) return false;
  const captainA = String(matchroom.captainUidA || matchroom.hostUid || "").trim();
  const hostUid = String(matchroom.hostUid || "").trim();
  return selectorId === captainA || selectorId === hostUid;
}

async function resolveUserId(ctx: any, value?: string | null): Promise<Id<"users"> | null> {
  if (!value) return null;
  try {
    const user = await ctx.db.get(value as Id<"users">);
    if (user) return user._id;
  } catch {
    // Some legacy references may be auth IDs, so fall back to the auth index.
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_authId", (q: any) => q.eq("authId", value))
    .unique();
  return user?._id || null;
}

async function resolveAuthenticatedUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("You must be signed in to select a venue offer.");
  const candidates = normalizeStringList([identity.tokenIdentifier, identity.subject]);
  for (const candidate of candidates) {
    const userId = await resolveUserId(ctx, candidate);
    if (userId) {
      const user = await ctx.db.get(userId);
      if (user) return user;
    }
  }
  throw new Error("Signed-in user profile not found.");
}

async function getBroadcastNotificationRecipients(
  ctx: any,
  room: any,
  includeCaptains = false,
) {
  const rawRecipients = includeCaptains
    ? [room?.hostUid, room?.captainUidA, room?.captainUidB]
    : [room?.hostUid];
  const recipients = new Map<string, Id<"users">>();
  for (const rawRecipient of normalizeStringList(rawRecipients)) {
    const recipientId = await resolveUserId(ctx, rawRecipient);
    if (recipientId) recipients.set(String(recipientId), recipientId);
  }
  return Array.from(recipients.values());
}

async function notifyBroadcastParticipants(
  ctx: any,
  room: any,
  input: {
    type: "broadcast.started" | "broadcast.failed" | "broadcast.expired";
    status?: "pending" | "expired";
    title: string;
    body: string;
    reason?: string;
    responseExpiresAt?: number | null;
    includeCaptains?: boolean;
  },
) {
  const matchroomId = room._id as Id<"matchrooms">;
  const route = `/matchrooms/${String(matchroomId)}`;
  const recipients = await getBroadcastNotificationRecipients(ctx, room, input.includeCaptains === true);
  for (const recipientId of recipients) {
    const dedupeKey = `${input.type}:${String(matchroomId)}:${input.reason || "state"}:${String(recipientId)}`;
    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: input.type,
      toUid: recipientId,
      recipientRole: "player",
      status: input.status || "pending",
      dedupeKey,
      dedupePolicy: "replace_active",
      matchroomId,
      route,
      title: input.title,
      body: input.body,
      data: {
        matchroomId: String(matchroomId),
        reason: input.reason || null,
        route,
        href: route,
        dedupeKey,
        responseExpiresAt: input.responseExpiresAt || null,
        expiresAt: input.responseExpiresAt || null,
      },
      expiresAt: input.responseExpiresAt || undefined,
    });
  }
}

export async function notifyBroadcastOfferReceived(
  ctx: any,
  input: {
    room: any;
    offerId: Id<"zoneOffers">;
    requestId: Id<"bookingRequests">;
    zoneName: string;
    expiresAt: number;
  },
) {
  const matchroomId = input.room._id as Id<"matchrooms">;
  const route = `/matchrooms/${String(matchroomId)}`;
  const recipients = await getBroadcastNotificationRecipients(ctx, input.room, false);
  for (const recipientId of recipients) {
    const dedupeKey = `broadcast.offer_received:${String(input.offerId)}:${String(recipientId)}`;
    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "broadcast.offer_received",
      toUid: recipientId,
      recipientRole: "player",
      status: "pending",
      dedupeKey,
      dedupePolicy: "upsert_active",
      matchroomId,
      route,
      title: "Venue offer received",
      body: `${input.zoneName} is available for your ${input.room.game} matchroom. Review the offer before it expires.`,
      data: {
        offerId: String(input.offerId),
        requestId: String(input.requestId),
        matchroomId: String(matchroomId),
        route,
        href: route,
        dedupeKey,
        expiresAt: input.expiresAt,
        responseExpiresAt: input.expiresAt,
      },
      expiresAt: input.expiresAt,
    });
  }
}

export function getBroadcastOfferExpiresAt(room: any, now = Date.now()) {
  return capExpiryAtLockTime(
    now,
    now + BROADCAST_OFFER_RESPONSE_WINDOW_MS,
    room?.scheduledStartAt || room?.startTime,
  );
}

export async function releaseHeldResourcesForBroadcastRequest(ctx: any, request: any, now = Date.now()) {
  const resourceIds = Array.isArray(request?.allocatedResourceIds) ? request.allocatedResourceIds : [];
  for (const resourceId of resourceIds) {
    const resource = await ctx.db.get(resourceId);
    if (!resource) continue;
    if (
      String(resource.bookingRequestId || "") === String(request._id) &&
      String(resource.lifecycleStatus || "") === "held"
    ) {
      await ctx.db.patch(resource._id, {
        lifecycleStatus: "available",
        bookingRequestId: undefined,
        matchroomId: undefined,
        bookedAt: undefined,
        bookedByUid: undefined,
        updatedAt: now,
      });
    }
  }
}

async function bookWinningResourcesForBroadcastRequest(
  ctx: any,
  input: {
    request: any;
    matchroomId: Id<"matchrooms">;
    resourceIds: Id<"zoneResources">[];
    bookedByUid?: string | null;
    now: number;
  },
) {
  for (const resourceId of input.resourceIds) {
    const resource = await ctx.db.get(resourceId);
    if (!resource) {
      throw new Error("One or more selected resources no longer exist.");
    }
    const belongsToWinner = String(resource.bookingRequestId || "") === String(input.request._id);
    const status = String(resource.lifecycleStatus || "");
    if (!belongsToWinner || !["held", "booked"].includes(status)) {
      throw new Error(`${resource.name || "Selected resource"} is no longer held for this offer.`);
    }
    if (status === "booked" && String(resource.matchroomId || "") === String(input.matchroomId)) {
      continue;
    }
    await ctx.db.patch(resource._id, {
      lifecycleStatus: "booked",
      bookingRequestId: input.request._id,
      matchroomId: input.matchroomId,
      bookedAt: input.now,
      bookedByUid: input.bookedByUid || undefined,
      updatedAt: input.now,
    });
  }
}

export async function closeBroadcastOfferRequest(
  ctx: any,
  input: {
    request: any;
    offerId?: Id<"zoneOffers"> | null;
    offerStatus: "expired" | "rejected";
    lifecycleStatus: string;
    closedReason: string;
    now?: number;
  },
) {
  const now = input.now || Date.now();
  if (input.offerId) {
    const offer = await ctx.db.get(input.offerId);
    if (offer && offer.status === "pending") {
      await ctx.db.patch(input.offerId, { status: input.offerStatus, updatedAt: now });
    }
  }
  if (["open", "pending_payment", "accepted"].includes(String(input.request?.status || ""))) {
    await ctx.db.patch(input.request._id, {
      status: input.offerStatus === "expired" ? "expired" : "cancelled",
      lifecycleStatus: input.lifecycleStatus,
      closedReason: input.closedReason,
      updatedAt: now,
    });
  }
  await releaseHeldResourcesForBroadcastRequest(ctx, input.request, now);
}

function belongsToMatchroomPayment(transaction: any, matchroomId: Id<"matchrooms">) {
  const matchroomIdString = String(matchroomId);
  const metadataMatchroomId = String(transaction?.metadata?.matchroomId || "").trim();
  const reference = String(transaction?.reference || "");
  if (metadataMatchroomId === matchroomIdString) return true;
  return reference.startsWith(`matchroom_slot_${matchroomIdString}_`) ||
    reference === `matchroom_create:${matchroomIdString}`;
}

async function refundBroadcastPayments(ctx: any, room: any, reason: string) {
  const participantIds = normalizeStringList([
    ...(room?.playerUids || []),
    room?.hostUid,
  ]);

  for (const participantId of participantIds) {
    let userRecord: any = null;
    try {
      userRecord = await ctx.db.get(participantId as Id<"users">);
    } catch {
      userRecord = null;
    }
    if (!userRecord) continue;

    const walletTransactions = await ctx.db
      .query("walletTransactions")
      .withIndex("by_userId", (q: any) => q.eq("userId", userRecord._id))
      .collect();

    const refundable = walletTransactions.filter((transaction: any) => {
      if (transaction.type === "refund") return false;
      if (transaction.type === "hold" || transaction.type === "hold_release" || transaction.type === "hold_capture") return false;
      if (transaction.status !== "completed") return false;
      return belongsToMatchroomPayment(transaction, room._id);
    });

    if (!refundable.length) continue;

    let walletBalance = Number(userRecord.walletBalance || 0);

    for (const transaction of refundable) {
      const refundReference = `broadcast_refund:${String(room._id)}:${String(transaction._id)}`;
      const existingRefund = await ctx.db
        .query("walletTransactions")
        .withIndex("by_reference", (q: any) => q.eq("reference", refundReference))
        .unique();
      if (existingRefund) continue;

      const amount = Number(transaction.amount || 0);
      if (!Number.isFinite(amount) || amount <= 0) continue;

      walletBalance += amount;
      await ctx.db.insert("walletTransactions", {
        userId: userRecord._id,
        type: "refund",
        amount,
        status: "completed",
        reference: refundReference,
        metadata: {
          matchroomId: String(room._id),
          originalTransactionId: String(transaction._id),
          originalReference: transaction.reference || null,
          reason,
        },
        createdAt: Date.now(),
      });
    }

    await ctx.db.patch(userRecord._id, {
      walletBalance,
      updatedAt: Date.now(),
    });
  }
}

async function notifyMatchroomParticipants(ctx: any, room: any, input: {
  body: string;
  title: string;
  type: string;
}) {
  const participantIds = normalizeStringList([
    ...(room?.playerUids || []),
    room?.hostUid,
  ]);

  for (const participantId of participantIds) {
    let userRecord: any = null;
    try {
      userRecord = await ctx.db.get(participantId as Id<"users">);
    } catch {
      userRecord = null;
    }
    if (!userRecord) continue;

    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: input.type,
      toUid: userRecord._id,
      status: "pending",
      dedupeKey: `${input.type}:${String(room._id)}:${String(userRecord._id)}`,
      dedupePolicy: "replace_active",
      matchroomId: room._id,
      entity: { kind: "matchroom", id: String(room._id) },
      route: `/matchrooms/${String(room._id)}`,
      title: input.title,
      body: input.body,
      data: {
        matchroomId: String(room._id),
        matchroomTitle: room.title,
        zoneId: room.confirmedZoneId || room.zoneId || null,
        branchId: room.confirmedBranchId || room.branchId || null,
        broadcastAreas: room.broadcastAreas || [],
        href: `/matchrooms/${String(room._id)}`,
      },
    });
  }
}

async function notifyRefundCompletion(ctx: any, room: any) {
  const participantIds = normalizeStringList([
    ...(room?.playerUids || []),
    room?.hostUid,
  ]);

  for (const participantId of participantIds) {
    let userRecord: any = null;
    try {
      userRecord = await ctx.db.get(participantId as Id<"users">);
    } catch {
      userRecord = null;
    }
    if (!userRecord) continue;

    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "operations.general",
      toUid: userRecord._id,
      status: "pending",
      dedupeKey: `broadcast.refund_completed:${String(room._id)}:${String(userRecord._id)}`,
      dedupePolicy: "replace_active",
      matchroomId: room._id,
      entity: { kind: "matchroom", id: String(room._id) },
      route: `/matchrooms/${String(room._id)}`,
      title: "Refund completed",
      body: "Your payment for this broadcast matchroom was refunded to your MatchHai wallet.",
      data: {
        matchroomId: String(room._id),
        href: `/matchrooms/${String(room._id)}`,
      },
    });
  }
}

async function notifyZoneRequestClosedElsewhere(ctx: any, input: {
  request: any;
  offer?: any;
  matchroomId: Id<"matchrooms">;
  locationLabel: string;
}) {
  const zoneOwnerId = String(input.offer?.zoneOwnerUid || input.request?.zoneOwnerUid || "").trim();
  if (!zoneOwnerId) return;

  let zoneOwner: any = null;
  try {
    zoneOwner = await ctx.db.get(zoneOwnerId as Id<"users">);
  } catch {
    zoneOwner = null;
  }
  if (!zoneOwner) return;

  await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
    type: "booking.request_closed_elsewhere",
    toUid: zoneOwner._id,
    recipientRole: "zone_admin",
    status: "expired",
    dedupeKey: `booking.request_closed_elsewhere:${String(input.request._id)}`,
    dedupePolicy: "replace_active",
    entity: { kind: "booking_request", id: String(input.request._id) },
    entityId: String(input.request._id),
    route: `/zone/modules/bookings?segment=requests&requestId=${String(input.request._id)}`,
    title: "Request closed",
    body: `This broadcast request closed because another zone confirmed ${input.locationLabel}.`,
    data: {
      requestId: String(input.request._id),
      offerId: input.offer ? String(input.offer._id) : null,
      matchroomId: String(input.matchroomId),
        lifecycleStatus: "closed_elsewhere",
        href: `/zone/modules/bookings?segment=requests&requestId=${String(input.request._id)}`,
      },
  });
}

export async function finalizeBroadcastFailure(
  ctx: any,
  matchroomId: Id<"matchrooms">,
  reason: "no_zone_response" | "no_eligible_zones" | "counter_offer_expired" | "counter_offer_rejected",
) {
  const room = await ctx.db.get(matchroomId);
  if (!room) return { changed: false, reason: "missing_room" };
  if (room.broadcastRequestStatus === "zone_confirmed") {
    return { changed: false, reason: "already_confirmed" };
  }

  const requests = await listBroadcastRequestsForMatchroom(ctx, matchroomId);
  const openRequests = requests.filter(
    (request: any) =>
      request.requestKind === "broadcast_fanout" &&
      ["open", "pending_payment", "accepted"].includes(String(request.status || "")),
  );
  if (openRequests.length > 0) {
    if (reason === "counter_offer_expired" || reason === "counter_offer_rejected") {
      return { changed: false, reason: "alternatives_still_open" };
    }
  }
  const pendingOffers = await Promise.all(
    requests
      .filter((request: any) => request.requestKind === "broadcast_fanout")
      .map((request: any) =>
        ctx.db
          .query("zoneOffers")
          .withIndex("by_requestId", (q: any) => q.eq("requestId", request._id))
          .collect(),
      ),
  );
  const hasPendingOffers = pendingOffers.some((offerList) =>
    offerList.some((offer: any) => offer.status === "pending"),
  );
  if (hasPendingOffers && reason !== "no_zone_response" && reason !== "no_eligible_zones") {
    return { changed: false, reason: "still_pending" };
  }

  const now = Date.now();
  const nextBroadcastStatus = reason === "no_eligible_zones" ? "failed" : "expired";
  const terminalRequestStatus = reason === "no_eligible_zones" ? "cancelled" : "expired";
  const lifecycleStatus = nextBroadcastStatus === "failed" ? "broadcast_failed" : "broadcast_expired";
  const responseExpiresAt =
    Number(room.broadcastRequestExpiresAt || 0) > 0
      ? Number(room.broadcastRequestExpiresAt)
      : now;

  await ctx.db.patch(matchroomId, {
    broadcastRequestStatus: nextBroadcastStatus,
    broadcastRequestStartedAt: room.broadcastRequestStartedAt || now,
    broadcastRequestExpiresAt: responseExpiresAt,
    updatedAt: now,
  });

  for (const request of requests) {
    if (request.requestKind !== "broadcast_fanout") continue;
    if (!["open", "pending_payment", "accepted"].includes(String(request.status || ""))) continue;
    await ctx.db.patch(request._id, {
      status: terminalRequestStatus,
      lifecycleStatus,
      closedReason: reason,
      updatedAt: now,
    });
    await releaseHeldResourcesForBroadcastRequest(ctx, request, now);
  }

  for (const offerList of pendingOffers) {
    for (const offer of offerList) {
      if (offer.status !== "pending") continue;
      await ctx.db.patch(offer._id, {
        status: "expired",
        updatedAt: now,
      });
    }
  }

  await notifyBroadcastParticipants(ctx, { ...room, _id: matchroomId }, {
    type: nextBroadcastStatus === "failed" ? "broadcast.failed" : "broadcast.expired",
    status: "expired",
    title: nextBroadcastStatus === "failed" ? "Broadcast venue search failed" : "Broadcast venue search expired",
    body: reason === "no_eligible_zones"
      ? NO_ELIGIBLE_ZONES_MESSAGE
      : "No venue was confirmed for your broadcast matchroom.",
    reason,
    responseExpiresAt,
    includeCaptains: reason !== "no_eligible_zones",
  });

  return { changed: true, reason, broadcastRequestStatus: nextBroadcastStatus };
}

export async function dispatchBroadcastZoneRequestsForMatchroom(
  ctx: any,
  matchroomId: Id<"matchrooms">,
) {
  const room = await ctx.db.get(matchroomId);
  if (!room) return { dispatched: false, reason: "missing_room" };
  if (room.locationMode !== "broadcast") return { dispatched: false, reason: "not_broadcast" };
  if (isRoomAlreadyResolved(room)) {
    return { dispatched: false, reason: "already_resolved" };
  }
  if (
    room.broadcastRequestStatus &&
    room.broadcastRequestStatus !== "idle" &&
    room.broadcastRequestStatus !== "waiting_for_fill"
  ) {
    return { dispatched: false, reason: "already_dispatched" };
  }

  const existingBroadcastRequests = (await listBroadcastRequestsForMatchroom(ctx, matchroomId))
    .filter((request: any) => request.requestKind === "broadcast_fanout");
  if (existingBroadcastRequests.length > 0) {
    const existingStartedAt = Math.min(
      ...existingBroadcastRequests
        .map((request: any) => Number(request.createdAt || 0))
        .filter((value: number) => Number.isFinite(value) && value > 0),
    );
    const existingExpiresAt = Math.max(
      ...existingBroadcastRequests
        .map((request: any) => Number(request.responseExpiresAt || 0))
        .filter((value: number) => Number.isFinite(value) && value > 0),
    );
    const now = Date.now();
    if (Number.isFinite(existingExpiresAt) && existingExpiresAt > 0 && existingExpiresAt <= now) {
      return await finalizeBroadcastFailure(ctx, matchroomId, "no_zone_response");
    }
    if (room.broadcastRequestStatus === "waiting_for_fill" || room.broadcastRequestStatus === "idle") {
      const patch: any = {
        broadcastRequestStatus: "waiting_for_zones",
        updatedAt: now,
      };
      if (Number.isFinite(existingStartedAt)) {
        patch.broadcastRequestStartedAt = existingStartedAt;
      }
      if (Number.isFinite(existingExpiresAt)) {
        patch.broadcastRequestExpiresAt = existingExpiresAt;
      }
      await ctx.db.patch(matchroomId, patch);
    }
    return {
      dispatched: false,
      reason: "already_dispatched",
      responseExpiresAt: Number.isFinite(existingExpiresAt) ? existingExpiresAt : null,
      targetedZoneCount: existingBroadcastRequests.length,
    };
  }

  const selectedAreas = normalizeStringList(room.broadcastAreas || []);
  if (!selectedAreas.length) {
    return await finalizeBroadcastFailure(ctx, matchroomId, "no_eligible_zones");
  }

  const now = Date.now();
  const scheduleValidation = validateMatchroomScheduleWindow(
    room.scheduledStartAt,
    Number(room.createdAt || now),
  );
  if (!scheduleValidation.ok) {
    return { dispatched: false, reason: scheduleValidation.code };
  }

  const responseExpiresAt = capExpiryAtLockTime(
    now,
    now + BROADCAST_ZONE_RESPONSE_WINDOW_MS,
    room.scheduledStartAt,
  );
  if (!responseExpiresAt) {
    const lockAt = getMatchroomLockAt(room.scheduledStartAt);
    await ctx.db.patch(matchroomId, {
      broadcastRequestStatus: "expired",
      broadcastRequestStartedAt: room.broadcastRequestStartedAt || now,
      broadcastRequestExpiresAt: lockAt || now,
      updatedAt: now,
    });
    await notifyBroadcastParticipants(ctx, { ...room, _id: matchroomId }, {
      type: "broadcast.expired",
      status: "expired",
      title: "Broadcast venue search expired",
      body: "No venue was confirmed for your broadcast matchroom.",
      reason: "lock_time_elapsed",
      responseExpiresAt: lockAt || now,
      includeCaptains: true,
    });
    return { dispatched: false, reason: "lock_time_elapsed" };
  }

  const activeZones = await ctx.db
    .query("zones")
    .withIndex("by_status", (q: any) => q.eq("status", "active"))
    .collect();

  const eligibleZones = activeZones
    .filter((zone: any) => zoneSupportsGame(zone, room.game))
    .map((zone: any) => ({
      zone,
      targetAreaLabel: findMatchingArea(zone, selectedAreas),
    }))
    .filter((entry: any) => Boolean(entry.targetAreaLabel));

  if (!eligibleZones.length) {
    return await finalizeBroadcastFailure(ctx, matchroomId, "no_eligible_zones");
  }

  const fanoutGroupKey = `broadcast:${String(matchroomId)}:${now}`;

  for (const entry of eligibleZones) {
    const { zone, targetAreaLabel } = entry;
    const zoneName = zone.venueBrandName || zone.name || "Zone Venue";
    const route = `/zone/modules/bookings?segment=requests&requestId=`;
    const requestId = await ctx.db.insert("bookingRequests", {
      userId: room.hostUid as Id<"users">,
      gameKey: normalizeGameKey(room.game),
      zoneId: zone._id,
      userName: room.hostName,
      title: room.title,
      description: room.description,
      maxPlayers: room.maxPlayers,
      format: room.format,
      seriesType: room.seriesType || undefined,
      durationHours: room.durationHours || undefined,
      selectedMaps: room.selectedMaps || undefined,
      skillLevel: room.skillLevel || undefined,
      hostSkillScore: room.hostSkillScore || undefined,
      hostSkillTier: room.hostSkillTier || undefined,
      hostSkillContext: room.hostSkillContext || undefined,
      overs: room.overs ? String(room.overs) : undefined,
      teamMode: room.teamMode || undefined,
      teamId: room.teamId || undefined,
      reservedSlots: room.reservedSlots || undefined,
      requestKind: "broadcast_fanout",
      fanoutGroupKey,
      responseExpiresAt,
      targetAreaLabel,
      status: "open",
      preferredDate: getPreferredDateMillis(room),
      preferredTime: room.scheduledTime || undefined,
      flexibilityWindow: room.flexibility || "Exact time",
      locationMode: "broadcast",
      preferredAreas: selectedAreas,
      budgetPerPlayer: Number(room.pricing?.perPlayer || 0),
      currency: room.pricing?.currency || "PKR",
      playerCount: room.maxPlayers,
      paymentStatus: room.paymentStatus || "unpaid",
      paymentAmount: room.paymentAmount || undefined,
      paymentReservedSlots: room.paymentReservedSlots || undefined,
      matchroomId,
      lifecycleStatus: "broadcast_waiting_zone",
      notes: `Broadcast matchroom fanout for ${zoneName} (${targetAreaLabel}).`,
      createdAt: now,
      updatedAt: now,
    });

    const requestRoute = `${route}${String(requestId)}`;
    const dedupeKey = `booking.request_submitted:${String(requestId)}:${String(zone.ownerUid)}`;
    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "booking.request_submitted",
      toUid: zone.ownerUid,
      recipientRole: "zone_admin",
      status: "pending",
      dedupeKey,
      dedupePolicy: "replace_active",
      matchroomId,
      entity: { kind: "booking_request", id: String(requestId) },
      route: requestRoute,
      title: "Broadcast venue request",
      body: `${room.hostName} needs a confirmed venue for ${room.title} in ${targetAreaLabel}.`,
      data: {
        requestId: String(requestId),
        matchroomId: String(matchroomId),
        requestKind: "broadcast_fanout",
        zoneId: String(zone._id),
        zoneName,
        targetAreaLabel,
        broadcastAreas: selectedAreas,
        responseExpiresAt,
        route: requestRoute,
        href: requestRoute,
        dedupeKey,
      },
      expiresAt: responseExpiresAt,
    });
  }

  await ctx.db.patch(matchroomId, {
    broadcastRequestStatus: "waiting_for_zones",
    broadcastRequestStartedAt: now,
    broadcastRequestExpiresAt: responseExpiresAt,
    updatedAt: now,
  });

  await notifyBroadcastParticipants(ctx, { ...room, _id: matchroomId }, {
    type: "broadcast.started",
    status: "pending",
    title: "Broadcast venue search started",
    body: "Your matchroom has been sent to available zones in your selected areas.",
    reason: "broadcast_dispatched",
    responseExpiresAt,
  });

  await ctx.scheduler.runAfter(
    responseExpiresAt - now,
    internal.matchroomBroadcast.expireBroadcastFanout,
    { matchroomId, startedAt: now },
  );

  return {
    dispatched: true,
    fanoutGroupKey,
    responseExpiresAt,
    targetedZoneCount: eligibleZones.length,
  };
}

export async function confirmBroadcastVenue(
  ctx: any,
  input: {
    matchroomId: Id<"matchrooms">;
    winningRequestId: Id<"bookingRequests">;
    winningOfferId?: Id<"zoneOffers">;
    zoneId: Id<"zones">;
    zoneOwnerUid?: string | null;
    zoneName?: string | null;
    locationLabel?: string | null;
    branchId?: string | null;
    branchName?: string | null;
    resourceIds?: Id<"zoneResources">[];
  },
) {
  const room = await ctx.db.get(input.matchroomId);
  if (!room) throw new Error("Matchroom not found.");

  if (room.broadcastRequestStatus === "zone_confirmed") {
    const winningRequest = await ctx.db.get(input.winningRequestId);
    if (
      winningRequest &&
      String(winningRequest.status || "") === "accepted" &&
      String(winningRequest.lifecycleStatus || "") === "zone_confirmed"
    ) {
      return { confirmed: false, idempotent: true, locationLabel: room.location || "Zone Venue", matchroomId: input.matchroomId };
    }
    throw new Error("A venue has already been confirmed for this matchroom.");
  }

  const now = Date.now();
  const winningRequest = await ctx.db.get(input.winningRequestId);
  if (!winningRequest) throw new Error("Winning booking request not found.");
  const winningResourceIds =
    input.resourceIds ||
    (Array.isArray(winningRequest.allocatedResourceIds) ? winningRequest.allocatedResourceIds : []);
  const locationLabel =
    input.locationLabel ||
    input.branchName ||
    input.zoneName ||
    room.location ||
    "Zone Venue";

  await ctx.db.patch(input.matchroomId, {
    zoneId: String(input.zoneId),
    confirmedZoneId: String(input.zoneId),
    zoneOwnerUid: input.zoneOwnerUid || room.zoneOwnerUid,
    branchId: input.branchId || room.branchId,
    confirmedBranchId: input.branchId || room.confirmedBranchId,
    resourceIds: winningResourceIds || room.resourceIds,
    location: locationLabel,
    zoneAdminApproved: true,
    broadcastRequestStatus: "zone_confirmed",
    venueConfirmedAt: now,
    updatedAt: now,
  });

  await bookWinningResourcesForBroadcastRequest(ctx, {
    request: winningRequest,
    matchroomId: input.matchroomId,
    resourceIds: winningResourceIds,
    bookedByUid: input.zoneOwnerUid || winningRequest.allocatedByUid || null,
    now,
  });

  const requests = await listBroadcastRequestsForMatchroom(ctx, input.matchroomId);
  for (const request of requests) {
    if (request.requestKind !== "broadcast_fanout") continue;

    if (String(request._id) === String(input.winningRequestId)) {
      await ctx.db.patch(request._id, {
        status: "accepted",
        lifecycleStatus: "zone_confirmed",
        closedReason: "zone_confirmed",
        allocatedAt: now,
        allocatedByUid: input.zoneOwnerUid || undefined,
        allocatedBranchId: input.branchId || undefined,
        allocatedResourceIds: winningResourceIds || undefined,
        updatedAt: now,
      });
    } else if (["open", "pending_payment", "accepted"].includes(String(request.status || ""))) {
      await ctx.db.patch(request._id, {
        status: "cancelled",
        lifecycleStatus: "closed_elsewhere",
        closedReason: CLOSED_ELSEWHERE_REASON,
        updatedAt: now,
      });
      await releaseHeldResourcesForBroadcastRequest(ctx, request, now);
    }

    const offers = await ctx.db
      .query("zoneOffers")
      .withIndex("by_requestId", (q: any) => q.eq("requestId", request._id))
      .collect();

    for (const offer of offers) {
      if (input.winningOfferId && String(offer._id) === String(input.winningOfferId)) {
        await ctx.db.patch(offer._id, {
          status: "accepted",
          resolvedMatchroomId: input.matchroomId,
          updatedAt: now,
        });
      } else if (offer.status === "pending") {
        await ctx.db.patch(offer._id, {
          status: "expired",
          updatedAt: now,
        });
        await notifyZoneRequestClosedElsewhere(ctx, {
          request,
          offer,
          matchroomId: input.matchroomId,
          locationLabel,
        });
      }
    }

    if (String(request._id) !== String(input.winningRequestId)) {
      await notifyZoneRequestClosedElsewhere(ctx, {
        request,
        matchroomId: input.matchroomId,
        locationLabel,
      });
    }
  }

  await notifyMatchroomParticipants(ctx, {
    ...room,
    confirmedZoneId: String(input.zoneId),
    confirmedBranchId: input.branchId || null,
    zoneId: String(input.zoneId),
    branchId: input.branchId || null,
  }, {
    type: "operations.general",
    title: "Venue confirmed",
    body: `Your matchroom is now confirmed at ${locationLabel}.`,
  });

  return { confirmed: true, locationLabel, matchroomId: input.matchroomId };
}

async function expireBroadcastCounterOfferInternal(ctx: any, offerId: Id<"zoneOffers">) {
  const offer = await ctx.db.get(offerId);
  if (!offer || offer.status !== "pending") return { expired: false };

  const request = await ctx.db.get(offer.requestId);
  if (!request || request.requestKind !== "broadcast_fanout" || !request.matchroomId) {
    return { expired: false };
  }

  const now = Date.now();
  await closeBroadcastOfferRequest(ctx, {
    request,
    offerId,
    offerStatus: "expired",
    lifecycleStatus: "broadcast_counter_offer_expired",
    closedReason: "counter_offer_expired",
    now,
  });

  const room = await ctx.db.get(request.matchroomId);
  if (room) {
    const captainIds = normalizeStringList(Array.isArray(offer.recipientUids) ? offer.recipientUids : []);
    for (const captainId of captainIds) {
      let captain: any = null;
      try {
        captain = await ctx.db.get(captainId as Id<"users">);
      } catch {
        captain = null;
      }
      if (!captain) continue;
      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: "operations.general",
        toUid: captain._id,
        status: "pending",
        dedupeKey: `broadcast.counter_offer_expired:${String(offerId)}:${String(captain._id)}`,
        dedupePolicy: "replace_active",
        matchroomId: request.matchroomId,
        route: `/matchrooms/${String(request.matchroomId)}`,
        title: "Counter-offer expired",
        body: "The venue counter-offer expired without both captains confirming it.",
        data: {
          offerId: String(offerId),
          requestId: String(request._id),
          matchroomId: String(request.matchroomId),
          href: `/matchrooms/${String(request.matchroomId)}`,
        },
      });
    }
  }

  if (offer.zoneOwnerUid) {
    let zoneOwner: any = null;
    try {
      zoneOwner = await ctx.db.get(offer.zoneOwnerUid as Id<"users">);
    } catch {
      zoneOwner = null;
    }
    if (zoneOwner) {
      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: "booking.counter_offer_result",
        toUid: zoneOwner._id,
        recipientRole: "zone_admin",
        status: "expired",
        dedupeKey: `booking.counter_offer_result:${String(offerId)}:expired`,
        dedupePolicy: "replace_active",
        route: `/zone/modules/bookings?segment=requests&requestId=${String(request._id)}`,
        title: "Counter-offer expired",
        body: "The broadcast counter-offer expired before both captains confirmed it.",
        data: {
          offerId: String(offerId),
          requestId: String(request._id),
          matchroomId: String(request.matchroomId),
          decision: "expired",
          href: `/zone/modules/bookings?segment=requests&requestId=${String(request._id)}`,
        },
      });
    }
  }

  return { expired: true };
}

export const expireBroadcastFanout = internalMutation({
  args: {
    matchroomId: v.id("matchrooms"),
    startedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.matchroomId);
    if (!room) return { expired: false, reason: "missing_room" };
    if (room.broadcastRequestStatus !== "waiting_for_zones") {
      return { expired: false, reason: "not_waiting" };
    }
    if (room.broadcastRequestStartedAt !== args.startedAt) {
      return { expired: false, reason: "stale_timer" };
    }
    return await finalizeBroadcastFailure(ctx, args.matchroomId, "no_zone_response");
  },
});

export const expireBroadcastCounterOffer = internalMutation({
  args: {
    offerId: v.id("zoneOffers"),
  },
  handler: async (ctx, args) => expireBroadcastCounterOfferInternal(ctx, args.offerId),
});

export const selectBroadcastOffer = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    offerId: v.id("zoneOffers"),
  },
  handler: async (ctx, args) => {
    const actor = await resolveAuthenticatedUser(ctx);
    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new Error("Matchroom not found.");
    if (!canSelectBroadcastOffer(String(actor._id), room) && !canSelectBroadcastOffer(String(actor.authId || ""), room)) {
      throw new Error("Only the host/captain can select a broadcast venue offer.");
    }
    if (room.broadcastRequestStatus === "zone_confirmed") {
      const offer = await ctx.db.get(args.offerId);
      if (offer?.resolvedMatchroomId && String(offer.resolvedMatchroomId) === String(args.matchroomId) && offer.status === "accepted") {
        return { confirmed: true, idempotent: true, matchroomId: String(args.matchroomId) };
      }
      throw new Error("A venue has already been confirmed for this matchroom.");
    }
    if (room.locationMode !== "broadcast" || room.broadcastRequestStatus !== "waiting_for_zones") {
      throw new Error("This matchroom is not waiting for broadcast offers.");
    }

    const now = Date.now();
    if (room.broadcastRequestExpiresAt && Number(room.broadcastRequestExpiresAt) <= now) {
      await finalizeBroadcastFailure(ctx, args.matchroomId, "no_zone_response");
      throw new Error("The broadcast venue search has expired.");
    }

    const offer = await ctx.db.get(args.offerId);
    if (!offer) throw new Error("Offer not found.");
    if (offer.status !== "pending") {
      throw new Error("This venue offer is already closed.");
    }
    if (offer.expiresAt && Number(offer.expiresAt) <= now) {
      const request = await ctx.db.get(offer.requestId);
      if (request) {
        await closeBroadcastOfferRequest(ctx, {
          request,
          offerId: args.offerId,
          offerStatus: "expired",
          lifecycleStatus: "broadcast_offer_expired",
          closedReason: "offer_expired",
          now,
        });
      } else {
        await ctx.db.patch(args.offerId, { status: "expired", updatedAt: now });
      }
      throw new Error("This venue offer has expired.");
    }

    const request = await ctx.db.get(offer.requestId);
    if (!request || request.requestKind !== "broadcast_fanout" || String(request.matchroomId || "") !== String(args.matchroomId)) {
      throw new Error("This offer does not belong to this broadcast matchroom.");
    }

    const confirmation = await confirmBroadcastVenue(ctx, {
      matchroomId: args.matchroomId,
      winningRequestId: request._id,
      winningOfferId: args.offerId,
      zoneId: offer.zoneId,
      zoneOwnerUid: offer.zoneOwnerUid || request.allocatedByUid || null,
      zoneName: offer.zoneName || null,
      branchId: offer.branchId || request.allocatedBranchId || null,
      branchName: offer.branchName || null,
      locationLabel: offer.branchName || offer.zoneName || undefined,
    });

    return {
      confirmed: true,
      idempotent: confirmation.idempotent === true,
      matchroomId: String(args.matchroomId),
      locationLabel: confirmation.locationLabel,
    };
  },
});

export const listBroadcastOffersForMatchroom = query({
  args: {
    matchroomId: v.id("matchrooms"),
  },
  handler: async (ctx, args) => {
    const requests = await listBroadcastRequestsForMatchroom(ctx, args.matchroomId);
    const broadcastRequests = requests.filter((request: any) => request.requestKind === "broadcast_fanout");
    const offersByRequest = await Promise.all(
      broadcastRequests.map(async (request: any) => {
        const offers = await ctx.db
          .query("zoneOffers")
          .withIndex("by_requestId", (q: any) => q.eq("requestId", request._id))
          .collect();
        return offers.map((offer: any) => ({
          ...offer,
          id: String(offer._id),
          offerId: String(offer._id),
          requestId: String(offer.requestId),
          zoneId: String(offer.zoneId),
          matchroomId: String(args.matchroomId),
          requestStatus: request.status,
          requestLifecycleStatus: request.lifecycleStatus,
          closedReason: request.closedReason,
          allocatedBranchId: request.allocatedBranchId || null,
          allocatedResourceIds: Array.isArray(request.allocatedResourceIds)
            ? request.allocatedResourceIds.map((resourceId: any) => String(resourceId))
            : [],
        }));
      }),
    );
    return offersByRequest.flat().sort((a: any, b: any) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  },
});
