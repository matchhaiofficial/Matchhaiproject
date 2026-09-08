import { parseKarachiDateTimeMillis } from "./karachiDateTime";

const USER_BUSY_MATCHROOM_STATUSES = new Set(["open", "locked", "in-progress"]);
const RESOURCE_BUSY_MATCHROOM_STATUSES = new Set(["open", "locked", "in-progress"]);
const BUSY_BOOKING_REQUEST_STATUSES = new Set(["open", "pending_payment", "accepted"]);
const BUSY_BOOKING_INTENT_STATUSES = new Set([
  "pending_approvals",
  "approved",
  "approved_pending_payment",
  "confirmed",
]);

const ZONE_RESOURCE_UNAVAILABLE_MESSAGE =
  "This venue does not have enough available resources for that time slot. Please choose another time or venue.";
const USER_TIME_CONFLICT_MESSAGE =
  "You already have a matchroom or booking request scheduled at this time.";

function normalizeToken(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeConflictGameKey(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  switch (normalized) {
    case "cs2":
      return "cs2";
    case "cs16":
    case "cs1.6":
    case "counterstrike1.6":
      return "cs16";
    case "valorant":
      return "valorant";
    case "fc25":
    case "fc26":
      return "fc26";
    case "tekken":
    case "tekken8":
      return "tekken8";
    case "indoorcricket":
    case "indoor_cricket":
    case "cricket":
      return "indoor_cricket";
    case "futsal":
    case "padel":
    case "pickleball":
      return normalized;
    default:
      return normalized || "";
  }
}

function getTierFromRateKey(value?: string | null) {
  const [, tier] = normalizeToken(value).split(":");
  return tier || "";
}

function inferResourceTier(resource: any) {
  const explicit = normalizeToken(resource?.tier);
  if (explicit) return explicit;
  const label = normalizeToken(`${resource?.name || ""} ${resource?.label || ""} ${resource?.roomLabel || ""}`);
  if (label.includes("elite")) return "elite";
  if (label.includes("premium")) return "premium";
  if (label.includes("regular")) return "regular";
  if (label.includes("ps5") || label.includes("playstation 5")) return "ps5";
  if (label.includes("xbox")) return "xbox";
  return "";
}

export function getRequiredResourceProfile(input: {
  game?: string | null;
  gameKey?: string | null;
  requestedResourceAssetType?: string | null;
  requestedResourceSurface?: string | null;
  requestedResourceTier?: string | null;
  selectedZoneRateKey?: string | null;
}) {
  const gameKey = normalizeConflictGameKey(input.gameKey || input.game);
  const requestedTier =
    normalizeToken(input.requestedResourceTier) ||
    getTierFromRateKey(input.selectedZoneRateKey);
  const requestedSurface = normalizeToken(input.requestedResourceSurface);

  if (["cs2", "cs16", "valorant"].includes(gameKey)) {
    return {
      assetType: "pc",
      requiredResourceIds: 10,
      tier: ["regular", "premium", "elite"].includes(requestedTier) ? requestedTier : "",
      surface: "",
    };
  }

  if (["fc26", "tekken8"].includes(gameKey)) {
    return {
      assetType: "console",
      requiredResourceIds: 1,
      tier: ["regular", "premium", "elite", "ps5", "xbox"].includes(requestedTier) ? requestedTier : "",
      surface: "",
    };
  }

  const courtAssetTypeByGame: Record<string, string> = {
    futsal: "futsal",
    indoor_cricket: "indoor_cricket",
    padel: "padel",
    pickleball: "pickleball",
  };

  return {
    assetType: courtAssetTypeByGame[gameKey] || normalizeToken(input.requestedResourceAssetType),
    requiredResourceIds: 1,
    tier: requestedTier,
    surface: requestedSurface,
  };
}

function getRoomStartAt(room: any) {
  const direct = Number(room?.scheduledStartAt || room?.startTime || 0);
  if (Number.isFinite(direct) && direct > 0) return direct;
  return parseKarachiDateTimeMillis(room?.scheduledDate, room?.scheduledTime);
}

function getRequestStartAt(request: any) {
  const direct = Number(request?.scheduledStartAt || 0);
  return Number.isFinite(direct) && direct > 0
    ? direct
    : parseKarachiDateTimeMillis(request?.preferredDate, request?.preferredTime);
}

async function requestHasTerminalOrMissingLinkedRoom(ctx: any, request: any) {
  if (!request?.matchroomId) return false;
  const room = await ctx.db.get(request.matchroomId).catch(() => null);
  return !room || ["completed", "cancelled", "expired"].includes(String(room.status || ""));
}

export function getBookingRequestStartAtForConflict(request: any) {
  return getRequestStartAt(request);
}

function getDurationMinutes(value: any, fallback = 60) {
  const durationMinutes = Number(value?.durationMinutes || 0);
  if (Number.isFinite(durationMinutes) && durationMinutes > 0) return durationMinutes;
  const durationHours = Number(value?.durationHours || 0);
  if (Number.isFinite(durationHours) && durationHours > 0) return Math.max(1, Math.round(durationHours * 60));
  return fallback;
}

export function timesOverlap(startA: number, durationMinutesA: number, startB: number, durationMinutesB: number) {
  const endA = startA + durationMinutesA * 60 * 1000;
  const endB = startB + durationMinutesB * 60 * 1000;
  return startA < endB && startB < endA;
}

function sameBranchOrConservative(targetBranchId?: string | null, candidateBranchId?: string | null) {
  const target = String(targetBranchId || "").trim();
  const candidate = String(candidateBranchId || "").trim();
  if (!target) return true;
  if (!candidate) return true;
  return target === candidate;
}

function profileSharesPool(left: ReturnType<typeof getRequiredResourceProfile>, right: ReturnType<typeof getRequiredResourceProfile>) {
  if (!left.assetType || !right.assetType) return false;
  if (left.assetType !== right.assetType) return false;
  if (left.tier && right.tier && left.tier !== right.tier) return false;
  if (left.surface && right.surface && left.surface !== right.surface) return false;
  return true;
}

function resourceMatchesProfile(resource: any, profile: ReturnType<typeof getRequiredResourceProfile>) {
  if (!resource || resource.isActive === false) return false;
  if (normalizeToken(resource.assetType) !== profile.assetType) return false;
  if (profile.tier && inferResourceTier(resource) !== profile.tier) return false;
  if (profile.surface && normalizeToken(resource.surface) !== profile.surface) return false;
  return true;
}

function resourceIsSelectable(resource: any, excludeRequestId?: string | null, excludeMatchroomId?: string | null) {
  const status = normalizeToken(resource?.lifecycleStatus);
  if (resource?.isActive === false || status === "maintenance") return false;
  if (status === "available") return true;
  const sameRequest = excludeRequestId && String(resource?.bookingRequestId || "") === String(excludeRequestId);
  const sameMatchroom = excludeMatchroomId && String(resource?.matchroomId || "") === String(excludeMatchroomId);
  if ((status === "held" || status === "booked") && (sameRequest || sameMatchroom)) return true;
  // A physical resource may be reserved for multiple non-overlapping future
  // slots. Exact room/request overlap checks below are the source of truth;
  // lifecycleStatus alone is not a global calendar lock.
  return status === "held" || status === "booked";
}

const MAX_WINDOW_ROWS = 500;
const MAX_BOOKING_LOOKBACK_MS = 24 * 60 * 60 * 1000;

async function getZoneRowsNearSlot(ctx: any, input: {
  table: "matchrooms" | "bookingRequests";
  zoneId: string;
  targetStart: number;
  targetDuration: number;
}) {
  const targetEnd = input.targetStart + input.targetDuration * 60_000;
  const from = input.targetStart - MAX_BOOKING_LOOKBACK_MS;
  const current = await ctx.db.query(input.table)
    .withIndex("by_zoneId_and_scheduledStartAt", (q: any) =>
      q.eq("zoneId", input.zoneId as any).gte("scheduledStartAt", from).lt("scheduledStartAt", targetEnd),
    )
    .take(MAX_WINDOW_ROWS + 1);
  const legacy: any[] = [];
  const zone = await ctx.db.get(input.zoneId as any).catch(() => null);
  if (Number(zone?.scheduleIndexVersion || 0) < 1) {
    const statuses = input.table === "matchrooms"
      ? Array.from(RESOURCE_BUSY_MATCHROOM_STATUSES)
      : Array.from(BUSY_BOOKING_REQUEST_STATUSES);
    for (const status of statuses) {
      const rows = input.table === "matchrooms"
        ? await ctx.db.query("matchrooms")
            .withIndex("by_zoneId_and_status_and_createdAt", (q: any) =>
              q.eq("zoneId", input.zoneId).eq("status", status),
            ).order("desc").take(MAX_WINDOW_ROWS + 1)
        : await ctx.db.query("bookingRequests")
            .withIndex("by_zoneId_and_status_and_updatedAt", (q: any) =>
              q.eq("zoneId", input.zoneId as any).eq("status", status),
            ).order("desc").take(MAX_WINDOW_ROWS + 1);
      if (rows.length > MAX_WINDOW_ROWS) {
        throw new Error("This venue has too many active booking records to verify safely. Please contact support.");
      }
      legacy.push(...rows.filter((row: any) => !Number(row.scheduledStartAt || 0)));
    }
  }
  if (current.length > MAX_WINDOW_ROWS) {
    throw new Error("This venue has too many active booking records to verify safely. Please contact support.");
  }
  return [...current, ...legacy];
}

async function getPendingZoneOffers(ctx: any, zoneId: string) {
  const current = await ctx.db.query("zoneOffers")
    .withIndex("by_zoneId_and_status_and_expiresAt", (q: any) =>
      q.eq("zoneId", zoneId as any).eq("status", "pending").gte("expiresAt", Date.now()),
    )
    .take(MAX_WINDOW_ROWS + 1);
  const legacy = await ctx.db.query("zoneOffers")
    .withIndex("by_zoneId_and_status_and_expiresAt", (q: any) =>
      q.eq("zoneId", zoneId as any).eq("status", "pending").eq("expiresAt", undefined),
    )
    .take(MAX_WINDOW_ROWS + 1);
  if (current.length > MAX_WINDOW_ROWS || legacy.length > MAX_WINDOW_ROWS) {
    throw new Error("This venue has too many pending offers to verify safely. Please contact support.");
  }
  return [...current, ...legacy];
}

function belongsToBranch(candidateBranchId: unknown, branchId: string, primaryBranchId?: string | null) {
  const candidate = String(candidateBranchId || "").trim();
  if (candidate) return candidate === branchId;
  // Historical zone-scoped rows predate branch IDs and refer to the primary
  // branch. Fail closed when that primary branch is being removed.
  return Boolean(primaryBranchId) && branchId === String(primaryBranchId);
}

export async function findActiveBranchAssignment(ctx: any, input: {
  zoneId: string;
  branchId: string;
  primaryBranchId?: string | null;
}) {
  for (const status of RESOURCE_BUSY_MATCHROOM_STATUSES) {
    const rows = await ctx.db.query("matchrooms")
      .withIndex("by_zoneId_and_status_and_createdAt", (q: any) =>
        q.eq("zoneId", input.zoneId).eq("status", status),
      )
      .order("desc")
      .take(MAX_WINDOW_ROWS + 1);
    if (rows.length > MAX_WINDOW_ROWS) {
      throw new Error("This venue has too many active matchrooms to delete a branch safely.");
    }
    const room = rows.find((candidate: any) => belongsToBranch(
      candidate.confirmedBranchId || candidate.branchId,
      input.branchId,
      input.primaryBranchId,
    ));
    if (room) return { kind: "matchroom", id: room._id };
  }

  for (const status of BUSY_BOOKING_REQUEST_STATUSES) {
    const rows = await ctx.db.query("bookingRequests")
      .withIndex("by_zoneId_and_status_and_updatedAt", (q: any) =>
        q.eq("zoneId", input.zoneId as any).eq("status", status),
      )
      .order("desc")
      .take(MAX_WINDOW_ROWS + 1);
    if (rows.length > MAX_WINDOW_ROWS) {
      throw new Error("This venue has too many active booking requests to delete a branch safely.");
    }
    for (const request of rows) {
      if (!belongsToBranch(request.allocatedBranchId, input.branchId, input.primaryBranchId)) continue;
      if (status === "accepted" && await requestHasTerminalOrMissingLinkedRoom(ctx, request)) continue;
      return { kind: "bookingRequest", id: request._id };
    }
  }

  const offers = await getPendingZoneOffers(ctx, input.zoneId);
  const offer = offers.find((candidate: any) => belongsToBranch(
    candidate.branchId,
    input.branchId,
    input.primaryBranchId,
  ));
  return offer ? { kind: "zoneOffer", id: offer._id } : null;
}

export type ActiveResourceAssignment = {
  lifecycleStatus: "held" | "booked";
  bookingRequestId?: any;
  matchroomId?: any;
};

// zoneResources keeps one legacy pointer for older clients, while the canonical
// allocation lives on booking requests, matchrooms, and offers. Reconcile that
// pointer after releases so cancelling one slot cannot make a resource used by
// another slot appear globally available.
export async function findActiveResourceAssignment(ctx: any, input: {
  zoneId: string;
  resourceId: any;
  excludeBookingRequestId?: string | null;
  excludeMatchroomId?: string | null;
}): Promise<ActiveResourceAssignment | null> {
  const resourceId = String(input.resourceId);
  for (const status of RESOURCE_BUSY_MATCHROOM_STATUSES) {
    const rows = await ctx.db.query("matchrooms")
      .withIndex("by_zoneId_and_status_and_createdAt", (q: any) =>
        q.eq("zoneId", input.zoneId).eq("status", status),
      )
      .order("desc")
      .take(MAX_WINDOW_ROWS + 1);
    if (rows.length > MAX_WINDOW_ROWS) {
      throw new Error("This venue has too many active matchrooms to reconcile resource inventory safely.");
    }
    const room = rows.find((candidate: any) =>
      String(candidate._id) !== String(input.excludeMatchroomId || "")
      && (candidate.resourceIds || []).some((id: any) => String(id) === resourceId),
    );
    if (room) return { lifecycleStatus: "booked", matchroomId: room._id };
  }

  for (const status of BUSY_BOOKING_REQUEST_STATUSES) {
    const rows = await ctx.db.query("bookingRequests")
      .withIndex("by_zoneId_and_status_and_updatedAt", (q: any) =>
        q.eq("zoneId", input.zoneId as any).eq("status", status),
      )
      .order("desc")
      .take(MAX_WINDOW_ROWS + 1);
    if (rows.length > MAX_WINDOW_ROWS) {
      throw new Error("This venue has too many active booking requests to reconcile resource inventory safely.");
    }
    for (const request of rows) {
      if (String(request._id) === String(input.excludeBookingRequestId || "")) continue;
      if (String(request.matchroomId || "") === String(input.excludeMatchroomId || "")) continue;
      if (!(request.allocatedResourceIds || []).some((id: any) => String(id) === resourceId)) continue;
      if (status === "accepted" && await requestHasTerminalOrMissingLinkedRoom(ctx, request)) continue;
      return {
        lifecycleStatus: status === "accepted" ? "booked" : "held",
        bookingRequestId: request._id,
        matchroomId: request.matchroomId,
      };
    }
  }

  const offers = await getPendingZoneOffers(ctx, input.zoneId);
  const offer = offers.find((candidate: any) =>
    String(candidate.requestId || "") !== String(input.excludeBookingRequestId || "")
    && (candidate.resourceIds || []).some((id: any) => String(id) === resourceId),
  );
  if (!offer) return null;
  const request = await ctx.db.get(offer.requestId).catch(() => null);
  return {
    lifecycleStatus: "held",
    bookingRequestId: offer.requestId,
    matchroomId: request?.matchroomId,
  };
}

export async function reconcileResourceLegacyAssignment(ctx: any, input: {
  resourceId: any;
  excludeBookingRequestId?: string | null;
  excludeMatchroomId?: string | null;
  now?: number;
}) {
  const resource = await ctx.db.get(input.resourceId).catch(() => null);
  if (!resource || resource.lifecycleStatus === "maintenance") return null;
  const assignment = await findActiveResourceAssignment(ctx, {
    zoneId: String(resource.zoneId),
    resourceId: resource._id,
    excludeBookingRequestId: input.excludeBookingRequestId,
    excludeMatchroomId: input.excludeMatchroomId,
  });
  await ctx.db.patch(resource._id, assignment ? {
    lifecycleStatus: assignment.lifecycleStatus,
    bookingRequestId: assignment.bookingRequestId,
    matchroomId: assignment.matchroomId,
    updatedAt: input.now || Date.now(),
  } : {
    lifecycleStatus: "available",
    bookingRequestId: undefined,
    matchroomId: undefined,
    bookedAt: undefined,
    bookedByUid: undefined,
    updatedAt: input.now || Date.now(),
  });
  return assignment;
}

function getOfferStarts(offer: any) {
  const options = Array.isArray(offer?.scheduleOptions) ? offer.scheduleOptions : [];
  const starts = options.map((option: any) =>
    Number(option?.startAt || 0) || parseKarachiDateTimeMillis(option?.date, option?.time) || 0,
  );
  const primary = Number(offer?.proposedStartAt || 0)
    || parseKarachiDateTimeMillis(offer?.proposedDate, offer?.proposedTime)
    || 0;
  return Array.from(new Set([primary, ...starts].filter((value) => Number.isFinite(value) && value > 0)));
}

async function getUserRooms(ctx: any, uid: string) {
  const rooms: any[] = [];
  const seen = new Set<string>();

  const addRoom = async (roomId: any) => {
    const key = String(roomId || "");
    if (!key || seen.has(key)) return;
    const room = await ctx.db.get(roomId).catch(() => null);
    if (!room) return;
    seen.add(key);
    rooms.push(room);
  };

  const memberRows = await ctx.db
    .query("matchroomMembers")
    .withIndex("by_uid", (q: any) => q.eq("uid", uid))
    .order("desc")
    .take(100);
  for (const row of memberRows) {
    await addRoom(row.matchroomId);
  }

  const hostedRows = await ctx.db
    .query("matchrooms")
    .withIndex("by_hostUid", (q: any) => q.eq("hostUid", uid))
    .order("desc")
    .take(100);
  for (const room of hostedRows) {
    const key = String(room._id);
    if (!seen.has(key)) {
      seen.add(key);
      rooms.push(room);
    }
  }

  return rooms;
}

export async function assertNoParticipantTimeConflict(ctx: any, input: {
  userIds: string[];
  scheduledStartAt?: number | null;
  durationMinutes?: number | null;
  excludeMatchroomId?: string | null;
  excludeBookingRequestId?: string | null;
  message?: string;
}) {
  const targetStart = Number(input.scheduledStartAt || 0);
  if (!Number.isFinite(targetStart) || targetStart <= 0) return;
  const targetDuration = Math.max(1, Math.floor(Number(input.durationMinutes || 60)));
  const uniqueUserIds = Array.from(new Set((input.userIds || []).map(String).filter(Boolean)));

  for (const uid of uniqueUserIds) {
    const rooms = await getUserRooms(ctx, uid);
    for (const room of rooms) {
      if (String(room._id) === String(input.excludeMatchroomId || "")) continue;
      if (!USER_BUSY_MATCHROOM_STATUSES.has(String(room.status || ""))) continue;
      const roomStart = getRoomStartAt(room);
      if (!roomStart) continue;
      if (timesOverlap(targetStart, targetDuration, roomStart, getDurationMinutes(room))) {
        throw new Error(input.message || USER_TIME_CONFLICT_MESSAGE);
      }
    }

    let bookingRequests: any[] = [];
    try {
      bookingRequests = await ctx.db
        .query("bookingRequests")
        .withIndex("by_userId", (q: any) => q.eq("userId", uid as any))
        .order("desc")
        .take(100);
    } catch {
      bookingRequests = [];
    }
    for (const request of bookingRequests) {
      if (String(request._id) === String(input.excludeBookingRequestId || "")) continue;
      if (!BUSY_BOOKING_REQUEST_STATUSES.has(String(request.status || ""))) continue;
      // Accepted request rows are retained for history. Once their canonical
      // matchroom is terminal (or missing), they must not remain a ghost time
      // conflict forever.
      if (await requestHasTerminalOrMissingLinkedRoom(ctx, request)) continue;
      const requestStart = getRequestStartAt(request);
      if (!requestStart) continue;
      if (timesOverlap(targetStart, targetDuration, requestStart, getDurationMinutes(request))) {
        throw new Error(input.message || USER_TIME_CONFLICT_MESSAGE);
      }
    }

    let bookingIntents: any[] = [];
    try {
      bookingIntents = await ctx.db
        .query("bookingIntents")
        .withIndex("by_createdByUid", (q: any) => q.eq("createdByUid", uid as any))
        .order("desc")
        .take(100);
    } catch {
      bookingIntents = [];
    }
    for (const intent of bookingIntents) {
      if (!BUSY_BOOKING_INTENT_STATUSES.has(String(intent.status || ""))) continue;
      const room = await ctx.db.get(intent.matchroomId).catch(() => null);
      if (!room || String(room._id) === String(input.excludeMatchroomId || "")) continue;
      if (!USER_BUSY_MATCHROOM_STATUSES.has(String(room.status || ""))) continue;
      const roomStart = getRoomStartAt(room);
      if (!roomStart) continue;
      if (timesOverlap(targetStart, targetDuration, roomStart, getDurationMinutes(room))) {
        throw new Error(input.message || USER_TIME_CONFLICT_MESSAGE);
      }
    }
  }
}

export async function assertZoneResourceCapacityAvailable(ctx: any, input: {
  zoneId?: string | null;
  branchId?: string | null;
  game?: string | null;
  gameKey?: string | null;
  requestedResourceAssetType?: string | null;
  requestedResourceSurface?: string | null;
  requestedResourceTier?: string | null;
  selectedZoneRateKey?: string | null;
  scheduledStartAt?: number | null;
  durationMinutes?: number | null;
  excludeMatchroomId?: string | null;
  excludeBookingRequestId?: string | null;
  message?: string;
}) {
  const zoneId = String(input.zoneId || "").trim();
  const targetStart = Number(input.scheduledStartAt || 0);
  if (!zoneId || !Number.isFinite(targetStart) || targetStart <= 0) return;

  const profile = getRequiredResourceProfile(input);
  if (!profile.assetType || profile.requiredResourceIds <= 0) return;
  const targetDuration = Math.max(1, Math.floor(Number(input.durationMinutes || 60)));

  const resourceQuery = input.branchId
    ? ctx.db.query("zoneResources").withIndex("by_zoneId_and_branchId", (q: any) =>
        q.eq("zoneId", zoneId as any).eq("branchId", input.branchId!),
      )
    : ctx.db.query("zoneResources").withIndex("by_zoneId", (q: any) => q.eq("zoneId", zoneId as any));
  const resourcePage = await resourceQuery.take(501);
  if (resourcePage.length > 500) {
    throw new Error("This venue has too many resources to verify safely. Please contact support.");
  }
  const resources = resourcePage.slice(0, 500);
  const availableResourceCount = resources.filter((resource: any) =>
    sameBranchOrConservative(input.branchId, resource.branchId) &&
    resourceMatchesProfile(resource, profile) &&
    normalizeToken(resource.lifecycleStatus) !== "maintenance"
  ).length;

  let overlappingDemand = 0;
  const countedMatchroomIds = new Set<string>();
  const rooms = await getZoneRowsNearSlot(ctx, {
    table: "matchrooms",
    zoneId,
    targetStart,
    targetDuration,
  });
  for (const room of rooms) {
    if (String(room._id) === String(input.excludeMatchroomId || "")) continue;
    if (!RESOURCE_BUSY_MATCHROOM_STATUSES.has(String(room.status || ""))) continue;
    const roomStart = getRoomStartAt(room);
    if (!roomStart || !timesOverlap(targetStart, targetDuration, roomStart, getDurationMinutes(room))) continue;
    if (!sameBranchOrConservative(input.branchId, room.branchId || room.confirmedBranchId)) continue;
    const roomProfile = getRequiredResourceProfile({
      game: room.game,
      requestedResourceAssetType: room.requestedResourceAssetType,
      requestedResourceSurface: room.requestedResourceSurface,
      requestedResourceTier: room.requestedResourceTier,
      selectedZoneRateKey: room.selectedZoneRateKey,
    });
    if (!profileSharesPool(profile, roomProfile)) continue;
    countedMatchroomIds.add(String(room._id));
    overlappingDemand += roomProfile.requiredResourceIds;
  }

  const requests = await getZoneRowsNearSlot(ctx, {
    table: "bookingRequests",
    zoneId,
    targetStart,
    targetDuration,
  });
  const countedRequestIds = new Set<string>();
  for (const request of requests) {
    if (String(request._id) === String(input.excludeBookingRequestId || "")) continue;
    if (request.matchroomId && countedMatchroomIds.has(String(request.matchroomId))) continue;
    if (!BUSY_BOOKING_REQUEST_STATUSES.has(String(request.status || ""))) continue;
    if (await requestHasTerminalOrMissingLinkedRoom(ctx, request)) continue;
    const requestStart = getRequestStartAt(request);
    if (!requestStart || !timesOverlap(targetStart, targetDuration, requestStart, getDurationMinutes(request))) continue;
    if (!sameBranchOrConservative(input.branchId, request.allocatedBranchId)) continue;
    const requestProfile = getRequiredResourceProfile({
      gameKey: request.gameKey,
      requestedResourceAssetType: request.requestedResourceAssetType,
      requestedResourceSurface: request.requestedResourceSurface,
      requestedResourceTier: request.requestedResourceTier,
      selectedZoneRateKey: request.selectedZoneRateKey,
    });
    if (!profileSharesPool(profile, requestProfile)) continue;
    countedRequestIds.add(String(request._id));
    overlappingDemand += requestProfile.requiredResourceIds;
  }


  const pendingOffers = await getPendingZoneOffers(ctx, zoneId);
  for (const offer of pendingOffers) {
    if (String(offer.requestId) === String(input.excludeBookingRequestId || "")) continue;
    if (countedRequestIds.has(String(offer.requestId))) continue;
    if (!sameBranchOrConservative(input.branchId, offer.branchId)) continue;
    const request = await ctx.db.get(offer.requestId);
    if (!request || !BUSY_BOOKING_REQUEST_STATUSES.has(String(request.status || ""))) continue;
    const duration = getDurationMinutes(request);
    if (!getOfferStarts(offer).some((start) => timesOverlap(targetStart, targetDuration, start, duration))) continue;
    const requestProfile = getRequiredResourceProfile(request);
    if (!profileSharesPool(profile, requestProfile)) continue;
    overlappingDemand += requestProfile.requiredResourceIds;
  }

  if (availableResourceCount - overlappingDemand < profile.requiredResourceIds) {
    throw new Error(input.message || ZONE_RESOURCE_UNAVAILABLE_MESSAGE);
  }
}

export async function assertSelectedResourcesAvailableForSlot(ctx: any, input: {
  zoneId: string;
  branchId?: string | null;
  resourceIds: any[];
  scheduledStartAt?: number | null;
  durationMinutes?: number | null;
  excludeMatchroomId?: string | null;
  excludeBookingRequestId?: string | null;
}) {
  const zoneId = String(input.zoneId || "").trim();
  const targetStart = Number(input.scheduledStartAt || 0);
  if (!zoneId || !Number.isFinite(targetStart) || targetStart <= 0 || !input.resourceIds.length) return;
  const targetDuration = Math.max(1, Math.floor(Number(input.durationMinutes || 60)));
  const resourceIdSet = new Set(input.resourceIds.map(String));

  for (const resourceId of input.resourceIds) {
    const resource = await ctx.db.get(resourceId);
    if (!resource) throw new Error("One or more selected resources no longer exist.");
    if (String(resource.zoneId || "") !== zoneId) {
      throw new Error(`${resource.name || "Selected resource"} does not belong to this venue.`);
    }
    if (input.branchId && String(resource.branchId || "") !== String(input.branchId)) {
      throw new Error(`${resource.name || "Selected resource"} does not belong to the selected branch.`);
    }
    if (!resourceIsSelectable(resource, input.excludeBookingRequestId, input.excludeMatchroomId)) {
      throw new Error(`${resource.name || "Selected resource"} is no longer available.`);
    }
  }

  const rooms = await getZoneRowsNearSlot(ctx, {
    table: "matchrooms",
    zoneId,
    targetStart,
    targetDuration,
  });
  for (const room of rooms) {
    if (String(room._id) === String(input.excludeMatchroomId || "")) continue;
    if (!RESOURCE_BUSY_MATCHROOM_STATUSES.has(String(room.status || ""))) continue;
    const roomStart = getRoomStartAt(room);
    if (!roomStart || !timesOverlap(targetStart, targetDuration, roomStart, getDurationMinutes(room))) continue;
    const overlap = (room.resourceIds || []).some((resourceId: any) => resourceIdSet.has(String(resourceId)));
    if (overlap) {
      throw new Error("One or more selected resources are already booked for this time slot.");
    }
  }

  const requests = await getZoneRowsNearSlot(ctx, {
    table: "bookingRequests",
    zoneId,
    targetStart,
    targetDuration,
  });
  for (const request of requests) {
    if (String(request._id) === String(input.excludeBookingRequestId || "")) continue;
    if (!BUSY_BOOKING_REQUEST_STATUSES.has(String(request.status || ""))) continue;
    const requestStart = getRequestStartAt(request);
    if (!requestStart || !timesOverlap(targetStart, targetDuration, requestStart, getDurationMinutes(request))) continue;
    const overlap = (request.allocatedResourceIds || []).some((resourceId: any) => resourceIdSet.has(String(resourceId)));
    if (overlap) {
      throw new Error("One or more selected resources are already held for another booking at this time.");
    }
  }


  const pendingOffers = await getPendingZoneOffers(ctx, zoneId);
  for (const offer of pendingOffers) {
    if (String(offer.requestId) === String(input.excludeBookingRequestId || "")) continue;
    if (!sameBranchOrConservative(input.branchId, offer.branchId)) continue;
    if (!(offer.resourceIds || []).some((resourceId: any) => resourceIdSet.has(String(resourceId)))) continue;
    const request = await ctx.db.get(offer.requestId);
    const duration = getDurationMinutes(request);
    if (getOfferStarts(offer).some((start) => timesOverlap(targetStart, targetDuration, start, duration))) {
      throw new Error("One or more selected resources are already held for another offer at this time.");
    }
  }
}
