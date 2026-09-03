import { getMatchroomLockAt } from "./timing";

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export const CHALLENGE_ACCEPT_TTL_MS = 7 * DAY_MS;
export const CHALLENGE_ABANDON_TTL_MS = 14 * DAY_MS;
export const STALE_PAYMENT_RECONCILE_AFTER_MS = 10 * MINUTE_MS;
export const STALE_PAYMENT_RECONCILE_MAX_AGE_MS = 7 * DAY_MS;
export const STALE_PAYMENT_RECONCILE_COOLDOWN_MS = 30 * MINUTE_MS;
export const FUTURE_MAINTENANCE_DUE_AT = Number.MAX_SAFE_INTEGER;

function positiveTimestamp(value: unknown): number | undefined {
  const timestamp = Number(value || 0);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : undefined;
}

function parseLocalDateTimeMillis(dateValue?: unknown, timeValue?: unknown): number | undefined {
  let date = dateValue;
  let time = String(timeValue || "").trim();
  if (!date || !time) return undefined;
  if (typeof date === "number" && Number.isFinite(date)) {
    const parsedDate = new Date(date);
    date = [parsedDate.getFullYear(), String(parsedDate.getMonth() + 1).padStart(2, "0"), String(parsedDate.getDate()).padStart(2, "0")].join("-");
  }
  const twelveHour = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time);
  if (twelveHour) {
    let hour = Number(twelveHour[1]);
    const minute = Number(twelveHour[2]);
    const period = twelveHour[3].toUpperCase();
    if (period === "PM" && hour !== 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;
    time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }
  const parsed = new Date(`${String(date).trim()}T${time}`).getTime();
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function earliestDue(candidates: Array<number | null | undefined>, now: number): number | undefined {
  const valid = candidates.filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  if (!valid.length) return undefined;
  const earliest = Math.min(...valid);
  return earliest <= now ? now : earliest;
}

function linkedRoomStartAt(room: any): number | undefined {
  return positiveTimestamp(room?.scheduledStartAt) || positiveTimestamp(room?.startTime) || parseLocalDateTimeMillis(room?.scheduledDate, room?.scheduledTime);
}

function linkedRoomIsFull(room: any): boolean {
  const maxPlayers = Number(room?.maxPlayers || 0);
  const confirmedSlots = [...(room?.slotsA || []), ...(room?.slotsB || [])].filter((slot: any) => slot?.status === "confirmed" && (slot?.uid || slot?.user?.uid)).length;
  return maxPlayers > 0 && Math.max(Number(room?.currentPlayers || 0), confirmedSlots) >= maxPlayers;
}

function linkedRoomAwaitsZoneDecision(room: any): boolean {
  if (!room) return false;
  const mode = String(room.locationMode || "").toLowerCase();
  if (mode === "broadcast") return !(room.venueConfirmedAt || room.confirmedZoneId);
  if (mode === "zone" || room.zoneId || room.confirmedZoneId) return !(room.venueConfirmedAt || room.confirmedZoneId || room.zoneAdminApproved === true);
  return false;
}

export function getBookingRequestLifecycleDueAt(request: any, linkedRoom: any, now = Date.now()) {
  const status = String(request?.status || "").toLowerCase();
  if (["expired", "cancelled"].includes(status)) return undefined;
  const requestStartAt = parseLocalDateTimeMillis(request?.preferredDate, request?.preferredTime);
  const candidates: Array<number | undefined | null> = [positiveTimestamp(request?.responseExpiresAt)];
  if (requestStartAt) {
    if (status !== "accepted") candidates.push(getMatchroomLockAt(requestStartAt));
    candidates.push(requestStartAt);
  }
  if (linkedRoom) {
    const roomStatus = String(linkedRoom.status || "").toLowerCase();
    if (["expired", "cancelled", "completed"].includes(roomStatus)) return now;
    const roomStartAt = linkedRoomStartAt(linkedRoom);
    const roomIsFull = linkedRoomIsFull(linkedRoom);
    const roomLockAt = positiveTimestamp(linkedRoom.lockAt) || getMatchroomLockAt(roomStartAt);
    if (!roomIsFull || linkedRoomAwaitsZoneDecision(linkedRoom)) candidates.push(roomLockAt);
    if (!roomIsFull) candidates.push(positiveTimestamp(linkedRoom.expiresAt));
    candidates.push(positiveTimestamp(linkedRoom.broadcastRequestExpiresAt), roomStartAt);
  }
  return earliestDue(candidates, now) ?? FUTURE_MAINTENANCE_DUE_AT;
}

export function withBookingRequestLifecycleDueAt<T extends Record<string, unknown>>(request: any, linkedRoom: any, patch: T, now = Date.now()): T & { lifecycleDueAt?: number } {
  if (Object.prototype.hasOwnProperty.call(patch, "lifecycleDueAt")) return patch;
  const lifecycleDueAt = getBookingRequestLifecycleDueAt({ ...request, ...patch }, linkedRoom, now);
  if (request?.lifecycleDueAt === lifecycleDueAt) return patch;
  return { ...patch, lifecycleDueAt };
}

export function getTeamChallengeLifecycleDueAt(challenge: any, now = Date.now()) {
  const status = String(challenge?.status || "").toLowerCase();
  if (["admin_pending", "completed", "rejected", "expired"].includes(status) || challenge?.matchroomId) return undefined;
  if (!["pending", "accepted", "venue_proposed", "venue_confirmed"].includes(status)) return undefined;
  const scheduledAt = positiveTimestamp(challenge?.scheduledAt);
  if (scheduledAt) return scheduledAt <= now ? now : scheduledAt;
  const createdAt = positiveTimestamp(challenge?.createdAt);
  if (!createdAt) return FUTURE_MAINTENANCE_DUE_AT;
  const dueAt = createdAt + (status === "pending" ? CHALLENGE_ACCEPT_TTL_MS : CHALLENGE_ABANDON_TTL_MS);
  return dueAt <= now ? now : dueAt;
}

export function withTeamChallengeLifecycleDueAt<T extends Record<string, unknown>>(challenge: any, patch: T, now = Date.now()): T & { lifecycleDueAt?: number } {
  if (Object.prototype.hasOwnProperty.call(patch, "lifecycleDueAt")) return patch;
  const lifecycleDueAt = getTeamChallengeLifecycleDueAt({ ...challenge, ...patch }, now);
  if (challenge?.lifecycleDueAt === lifecycleDueAt) return patch;
  return { ...patch, lifecycleDueAt };
}

export function getPaymentNextReconcileAt(transaction: any, now = Date.now()) {
  const status = String(transaction?.status || "").toLowerCase();
  if (!["created", "redirected", "token_received", "pending"].includes(status)) return undefined;
  const createdAt = positiveTimestamp(transaction?.createdAt);
  if (!createdAt || now >= createdAt + STALE_PAYMENT_RECONCILE_MAX_AGE_MS) return undefined;
  const firstDueAt = createdAt + STALE_PAYMENT_RECONCILE_AFTER_MS;
  const lastCallbackAt = positiveTimestamp(transaction?.lastCallbackAt);
  const dueAt = Math.max(firstDueAt, lastCallbackAt ? lastCallbackAt + STALE_PAYMENT_RECONCILE_COOLDOWN_MS : firstDueAt);
  return dueAt < createdAt + STALE_PAYMENT_RECONCILE_MAX_AGE_MS ? dueAt : undefined;
}

export function withPaymentNextReconcileAt<T extends Record<string, unknown>>(transaction: any, patch: T, now = Date.now()): T & { nextReconcileAt?: number } {
  if (Object.prototype.hasOwnProperty.call(patch, "nextReconcileAt")) return patch;
  const nextReconcileAt = getPaymentNextReconcileAt({ ...transaction, ...patch }, now);
  if (transaction?.nextReconcileAt === nextReconcileAt) return patch;
  return { ...patch, nextReconcileAt };
}
