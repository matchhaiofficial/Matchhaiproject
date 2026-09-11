const HOUR_MS = 60 * 60 * 1000;

type LifecycleStatus =
  | "open"
  | "locked"
  | "in-progress"
  | "completed"
  | "expired"
  | "cancelled";

export type LifecycleRoom = {
  status?: LifecycleStatus | string;
  bookingSource?: string;
  maxPlayers?: number;
  playerUids?: unknown[];
  slotsA?: Array<{ status?: string; uid?: string; user?: { uid?: string } }>;
  slotsB?: Array<{ status?: string; uid?: string; user?: { uid?: string } }>;
  scheduledStartAt?: number;
  startTime?: number;
  lockAt?: number;
  durationMinutes?: number;
  locationMode?: string;
  zoneId?: string;
  zoneAdminApproved?: boolean;
  venueConfirmedAt?: number;
  confirmedZoneId?: string;
  broadcastRequestStatus?: string;
  broadcastRequestExpiresAt?: number;
  lifecycleDueAt?: number;
  resultVerification?: { status?: string; lifecyclePromptedAt?: number };
};

import { getSafeScheduleAt, MIN_SCHEDULE_DELAY_MS } from "./schedulingSafety";

const REMINDER_WINDOWS_MS = [24 * HOUR_MS, 2 * HOUR_MS, 30 * 60 * 1000];

// A due lifecycle may legitimately need one immediate pass (for example a
// newly-full broadcast room). Convex accepts a timestamp in the past, but
// scheduling at that timestamp can run back-to-back with no opportunity for
// the state to advance. Keep immediate work asynchronous and bounded.
export const LIFECYCLE_MIN_SCHEDULE_DELAY_MS = MIN_SCHEDULE_DELAY_MS;

function asTimestamp(value: unknown): number | undefined {
  const timestamp = Number(value || 0);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : undefined;
}

function isWalkIn(room: LifecycleRoom): boolean {
  return String(room.bookingSource || "").toLowerCase() === "walkin";
}

function getStartAt(room: LifecycleRoom): number | undefined {
  return asTimestamp(room.startTime) || asTimestamp(room.scheduledStartAt);
}

function isFull(room: LifecycleRoom): boolean {
  const required = Math.max(1, Number(room.maxPlayers || 0));
  const slots = [...(room.slotsA || []), ...(room.slotsB || [])];
  if (slots.length > 0) {
    const confirmed = slots
      .filter((slot) => slot.status === "confirmed")
      .map((slot) => String(slot.uid || slot.user?.uid || "").trim())
      .filter(Boolean);
    return slots.every((slot) => slot.status === "confirmed" && Boolean(slot.uid || slot.user?.uid))
      && new Set(confirmed).size >= required;
  }
  return new Set((room.playerUids || []).map((uid) => String(uid || "")).filter(Boolean)).size >= required;
}

function nextDue(candidates: Array<number | undefined>, now: number): number | undefined {
  const valid = candidates.filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  if (!valid.length) return undefined;
  const earliest = Math.min(...valid);
  return earliest <= now ? now : earliest;
}

/**
 * Converts a lifecycle deadline into a scheduler timestamp. A past/due
 * deadline gets exactly one short-delay attempt; callers must recompute the
 * lifecycle deadline after that attempt and stop if it is not in the future.
 */
export function getLifecycleScheduleAt(dueAt: unknown, now = Date.now()): number | undefined {
  return getSafeScheduleAt(dueAt, now);
}

/** Returns only a deadline that is strictly after `now`.
 *
 * This is the termination guard for scheduled lifecycle handlers: an
 * unchanged due-at value must never be scheduled again indefinitely.
 */
export function getFutureLifecycleDueAt(room: LifecycleRoom, now = Date.now()): number | undefined {
  const dueAt = getLifecycleDueAt(room, now);
  return typeof dueAt === "number" && dueAt > now ? dueAt : undefined;
}

/** Recomputes the deadline from current room state, ignoring persisted due-at
 * metadata that may be stale after an interrupted/old scheduler run. */
export function recomputeLifecycleDueAt(room: LifecycleRoom, now = Date.now()): number | undefined {
  return getLifecycleDueAt(room, now);
}

/** Returns the next time a lifecycle sweep can make a stateful change. */
export function getLifecycleDueAt(room: LifecycleRoom, now = Date.now()): number | undefined {
  const status = String(room.status || "");
  if (["expired", "cancelled"].includes(status)) return undefined;
  if (status === "completed") {
    const verification = room.resultVerification;
    return (!verification?.status || verification.status === "pending") && !verification?.lifecyclePromptedAt
      ? now
      : undefined;
  }

  const startAt = getStartAt(room);
  if (status === "in-progress") {
    if (!startAt) return undefined;
    return nextDue([startAt + Math.max(1, Number(room.durationMinutes || 60)) * 60 * 1000], now);
  }
  if (status !== "open" && status !== "locked") return undefined;

  const lockAt = asTimestamp(room.lockAt) || startAt;
  if (!isFull(room)) return nextDue([isWalkIn(room) ? startAt : lockAt], now);

  if (room.locationMode === "broadcast" && !room.venueConfirmedAt && !room.confirmedZoneId) {
    if (["idle", "waiting_for_fill"].includes(String(room.broadcastRequestStatus || ""))) return now;
    if (room.broadcastRequestStatus === "waiting_for_zones") {
      return nextDue([asTimestamp(room.broadcastRequestExpiresAt), lockAt], now);
    }
  }

  const awaitingZoneApproval =
    room.locationMode === "zone" && Boolean(room.zoneId) && !room.zoneAdminApproved &&
    !room.venueConfirmedAt && !room.confirmedZoneId;
  if (awaitingZoneApproval) return undefined;

  const reminders = startAt
    ? REMINDER_WINDOWS_MS.map((windowMs) => startAt - windowMs).filter((dueAt) => dueAt > now)
    : [];
  return nextDue([...reminders, startAt], now);
}

export function withLifecycleDueAt<T extends Record<string, unknown>>(
  room: LifecycleRoom,
  patch: T,
  now = Date.now(),
): T & { lifecycleDueAt?: number } {
  if (Object.prototype.hasOwnProperty.call(patch, "lifecycleDueAt")) return patch;
  const lifecycleDueAt = getLifecycleDueAt({ ...room, ...patch }, now);
  if (room.lifecycleDueAt === lifecycleDueAt) return patch;
  return { ...patch, lifecycleDueAt };
}
