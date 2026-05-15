import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const BROADCAST_ZONE_RESPONSE_WINDOW_MS = 2 * 60 * 60 * 1000;
export const BROADCAST_COUNTER_RESPONSE_WINDOW_MS = 30 * 60 * 1000;
const PC_SETUP_GAME_KEYS = ["cs2", "cs16", "valorant"] as const;

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
      lifecycleStatus: "zone_confirmed_elsewhere",
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
  if (!room) return { cancelled: false, reason: "missing_room" };
  if (room.broadcastRequestStatus === "zone_confirmed") {
    return { cancelled: false, reason: "already_confirmed" };
  }

  const requests = await listBroadcastRequestsForMatchroom(ctx, matchroomId);
  const openRequests = requests.filter(
    (request: any) =>
      request.requestKind === "broadcast_fanout" &&
      ["open", "pending_payment", "accepted"].includes(String(request.status || "")),
  );
  if (openRequests.length > 0) {
    if (reason === "no_zone_response") {
      return { cancelled: false, reason: "still_pending" };
    }
    if (reason === "counter_offer_expired" || reason === "counter_offer_rejected") {
      return { cancelled: false, reason: "alternatives_still_open" };
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
    return { cancelled: false, reason: "still_pending" };
  }

  const now = Date.now();
  await ctx.db.patch(matchroomId, {
    status: "cancelled",
    broadcastRequestStatus: reason === "no_zone_response" ? "expired" : "cancelled",
    cancelReason: reason,
    cancelledAt: room.cancelledAt || now,
    cancelledBy: room.cancelledBy || "system_broadcast",
    refundStatus: room.refundStatus === "completed" ? "completed" : "pending",
    updatedAt: now,
  });

  for (const request of requests) {
    if (request.requestKind !== "broadcast_fanout") continue;
    if (!["open", "pending_payment", "accepted"].includes(String(request.status || ""))) continue;
    await ctx.db.patch(request._id, {
      status: reason === "no_zone_response" ? "expired" : "cancelled",
      lifecycleStatus: "broadcast_failed",
      closedReason: reason,
      updatedAt: now,
    });
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

  if (room.refundStatus !== "completed") {
    await ctx.runMutation(internal.matchrooms.releaseHoldsForMatchroom, {
      matchroomId,
      reason,
    });
    await ctx.runMutation(internal.matchrooms.refundCapturedHoldsForMatchroom, {
      matchroomId,
      reason,
    });
    await refundBroadcastPayments(ctx, room, reason);
    await ctx.db.patch(matchroomId, {
      refundStatus: "completed",
      refundCompletedAt: now,
      updatedAt: now,
    });
    await notifyRefundCompletion(ctx, room);
  }

  await notifyMatchroomParticipants(ctx, room, {
    type: "match.cancelled",
    title: "Broadcast matchroom cancelled",
    body:
      reason === "no_eligible_zones"
        ? "No eligible venues were available in the selected broadcast areas. The matchroom was cancelled."
        : "No venue confirmed this broadcast matchroom in time. The matchroom was cancelled and refunded.",
  });

  return { cancelled: true, reason };
}

export async function dispatchBroadcastZoneRequestsForMatchroom(
  ctx: any,
  matchroomId: Id<"matchrooms">,
) {
  const room = await ctx.db.get(matchroomId);
  if (!room) return { dispatched: false, reason: "missing_room" };
  if (room.locationMode !== "broadcast") return { dispatched: false, reason: "not_broadcast" };
  if ((room.currentPlayers || 0) < room.maxPlayers) {
    return { dispatched: false, reason: "not_full" };
  }
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

  const selectedAreas = normalizeStringList(room.broadcastAreas || []);
  if (!selectedAreas.length) {
    return await finalizeBroadcastFailure(ctx, matchroomId, "no_eligible_zones");
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

  const now = Date.now();
  const responseExpiresAt = now + BROADCAST_ZONE_RESPONSE_WINDOW_MS;
  const fanoutGroupKey = `broadcast:${String(matchroomId)}:${now}`;

  for (const entry of eligibleZones) {
    const { zone, targetAreaLabel } = entry;
    const zoneName = zone.venueBrandName || zone.name || "Zone Venue";
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

    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "booking.request_submitted",
      toUid: zone.ownerUid,
      recipientRole: "zone_admin",
      status: "pending",
      dedupeKey: `booking.request_submitted:${String(requestId)}:${String(zone.ownerUid)}`,
      dedupePolicy: "replace_active",
      matchroomId,
      entity: { kind: "booking_request", id: String(requestId) },
      route: `/zone/modules/bookings?segment=requests&requestId=${String(requestId)}`,
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
        href: `/zone/modules/bookings?segment=requests&requestId=${String(requestId)}`,
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

  await ctx.scheduler.runAfter(
    BROADCAST_ZONE_RESPONSE_WINDOW_MS,
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
    throw new Error("Venue already confirmed for this matchroom.");
  }

  const now = Date.now();
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
    resourceIds: input.resourceIds || room.resourceIds,
    location: locationLabel,
    zoneAdminApproved: true,
    broadcastRequestStatus: "zone_confirmed",
    venueConfirmedAt: now,
    updatedAt: now,
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
        allocatedResourceIds: input.resourceIds || undefined,
        updatedAt: now,
      });
    } else if (["open", "pending_payment", "accepted"].includes(String(request.status || ""))) {
      await ctx.db.patch(request._id, {
        status: "cancelled",
        lifecycleStatus: "zone_confirmed_elsewhere",
        closedReason: "zone_confirmed_elsewhere",
        updatedAt: now,
      });
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
  await ctx.db.patch(offerId, {
    status: "expired",
    updatedAt: now,
  });
  await ctx.db.patch(request._id, {
    status: "cancelled",
    lifecycleStatus: "broadcast_counter_offer_expired",
    closedReason: "counter_offer_expired",
    updatedAt: now,
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

  await finalizeBroadcastFailure(ctx, request.matchroomId, "counter_offer_expired");
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
