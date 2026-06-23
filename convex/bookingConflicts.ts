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
      tier: ["ps5", "xbox"].includes(requestedTier) ? requestedTier : "",
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

function parseLocalDateTimeMillis(dateValue?: string | number | null, timeValue?: string | null) {
  const timeText = String(timeValue || "").trim();
  if (!timeText) return null;

  let dateText = "";
  if (typeof dateValue === "number" && Number.isFinite(dateValue)) {
    const date = new Date(dateValue);
    dateText = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  } else {
    dateText = String(dateValue || "").trim();
  }
  if (!dateText) return null;

  let time = timeText;
  const twelveHour = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time);
  if (twelveHour) {
    let hour = Number(twelveHour[1]);
    const minute = Number(twelveHour[2]);
    const period = twelveHour[3].toUpperCase();
    if (period === "PM" && hour !== 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;
    time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  const parsed = new Date(`${dateText}T${time}`).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function getRoomStartAt(room: any) {
  const direct = Number(room?.scheduledStartAt || room?.startTime || 0);
  if (Number.isFinite(direct) && direct > 0) return direct;
  return parseLocalDateTimeMillis(room?.scheduledDate, room?.scheduledTime);
}

function getRequestStartAt(request: any) {
  return parseLocalDateTimeMillis(request?.preferredDate, request?.preferredTime);
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
  if (status === "available") return true;
  const sameRequest = excludeRequestId && String(resource?.bookingRequestId || "") === String(excludeRequestId);
  const sameMatchroom = excludeMatchroomId && String(resource?.matchroomId || "") === String(excludeMatchroomId);
  return Boolean((status === "held" || status === "booked") && (sameRequest || sameMatchroom));
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

  const resources = await ctx.db
    .query("zoneResources")
    .withIndex("by_zoneId", (q: any) => q.eq("zoneId", zoneId as any))
    .take(500);
  const availableResourceCount = resources.filter((resource: any) =>
    sameBranchOrConservative(input.branchId, resource.branchId) &&
    resourceMatchesProfile(resource, profile) &&
    resourceIsSelectable(resource, input.excludeBookingRequestId, input.excludeMatchroomId)
  ).length;

  let unallocatedDemand = 0;
  const countedMatchroomIds = new Set<string>();
  const rooms = await ctx.db
    .query("matchrooms")
    .withIndex("by_zoneId", (q: any) => q.eq("zoneId", zoneId))
    .take(300);
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
    if (Array.isArray(room.resourceIds) && room.resourceIds.length > 0) continue;
    unallocatedDemand += roomProfile.requiredResourceIds;
  }

  const requests = await ctx.db
    .query("bookingRequests")
    .withIndex("by_zoneId", (q: any) => q.eq("zoneId", zoneId as any))
    .take(300);
  for (const request of requests) {
    if (String(request._id) === String(input.excludeBookingRequestId || "")) continue;
    if (request.matchroomId && countedMatchroomIds.has(String(request.matchroomId))) continue;
    if (!BUSY_BOOKING_REQUEST_STATUSES.has(String(request.status || ""))) continue;
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
    if (Array.isArray(request.allocatedResourceIds) && request.allocatedResourceIds.length > 0) continue;
    unallocatedDemand += requestProfile.requiredResourceIds;
  }

  if (availableResourceCount - unallocatedDemand < profile.requiredResourceIds) {
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

  const rooms = await ctx.db
    .query("matchrooms")
    .withIndex("by_zoneId", (q: any) => q.eq("zoneId", zoneId))
    .take(300);
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

  const requests = await ctx.db
    .query("bookingRequests")
    .withIndex("by_zoneId", (q: any) => q.eq("zoneId", zoneId as any))
    .take(300);
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
}
