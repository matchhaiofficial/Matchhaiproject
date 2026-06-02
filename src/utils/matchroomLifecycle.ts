// src/utils/matchroomLifecycle.ts
// Helpers for matchroom expiry/lock using scheduled match time.

import {
    DAY_MS,
    MATCHROOM_LOCK_BEFORE_START_MS,
} from "../constants/timing";

// Legacy fallback TTL (older docs without scheduled timestamps)
const ROOM_TTL_MS = 48 * 60 * 60 * 1000;
const ONE_DAY_MS = DAY_MS;

function toDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value?.toDate === "function") {
        const d = value.toDate();
        return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    }
    if (typeof value?.toMillis === "function") {
        const ms = value.toMillis();
        return Number.isFinite(ms) ? new Date(ms) : null;
    }
    if (typeof value?.seconds === "number") {
        const parsed = new Date(value.seconds * 1000);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === "number") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === "string") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
}

export function parseScheduledStartAt(room: any): Date | null {
    const existing = toDate(room?.scheduledStartAt);
    if (existing) return existing;

    const date = String(room?.scheduledDate || "").trim();
    const time = String(room?.scheduledTime || "").trim();
    if (!date || !time) return null;

    // Treat as local time (consistent with existing date/time storage)
    const dt = new Date(`${date}T${time}`);
    return Number.isNaN(dt.getTime()) ? null : dt;
}

export function getRoomLockAt(room: any): Date | null {
    const explicit = toDate(room?.lockAt);
    if (explicit) return explicit;
    const start = parseScheduledStartAt(room);
    return start ? new Date(start.getTime() - MATCHROOM_LOCK_BEFORE_START_MS) : null;
}

export function getRoomExpiresAt(room: any): Date | null {
    const explicit = toDate(room?.expiresAt);
    if (explicit) return explicit;
    return parseScheduledStartAt(room);
}

/**
 * Get the creation date of a matchroom.
 * @param room The matchroom object
 * @returns Date or null if unavailable
 */
export function getRoomCreatedAt(room: any): Date | null {
    const created = toDate(room?.createdAt);
    if (created) return created;
    return toDate(room?.updatedAt);
}

/**
 * Check if a matchroom is full (all slots confirmed or player count met).
 * Primary: count confirmed slots in slotsA + slotsB
 * Fallback: players.length >= maxPlayers
 * 
 * @param room The matchroom object
 * @returns true if room is full
 */
export function isRoomFull(room: any): boolean {
    const slotsA = room.slotsA || [];
    const slotsB = room.slotsB || [];
    const allSlots = [...slotsA, ...slotsB];

    // If slots exist, check confirmed count
    if (allSlots.length > 0) {
        const confirmedSlots = allSlots.filter((s: any) => s.status === 'confirmed' && (s.uid || s.user?.uid)).length;
        return confirmedSlots >= allSlots.length && confirmedSlots >= (room.maxPlayers || allSlots.length);
    }

    // Fallback: player count
    const maxPlayers = room.maxPlayers || 10;
    const currentPlayers = room.currentPlayers || room.players?.length || 0;
    return currentPlayers >= maxPlayers;
}

/**
 * A matchroom is expired if it is not full by its expiry time.
 *
 * New behavior:
 * - expiresAt defaults to lockAt (24h before scheduledStartAt).
 * - If not full by expiresAt, treat as expired.
 *
 * Legacy fallback:
 * - expires after ROOM_TTL_MS from createdAt if scheduled timestamps are missing.
 * 
 * @param room The matchroom object
 * @param now Current time (for testing)
 * @returns true if room is expired
 */
export function isRoomExpired(room: any, now = new Date()): boolean {
    if (!room) return false;
    if (room.status === "expired" || room.status === "cancelled") return true;
    // Completed / in-progress rooms are a valid terminal/active lifecycle, never
    // "expired" regardless of roster.
    if (room.status === "completed" || room.status === "in-progress") return false;
    if (isRoomFull(room)) return false;
    // Joins close at lockAt (24h before start). An unfilled room that has passed
    // its join-lock can never fill, so it is expired/dead — not merely "locked".
    const lockAt = getRoomLockAt(room);
    if (lockAt && lockAt.getTime() <= now.getTime()) return true;
    const expiresAt = getRoomExpiresAt(room);
    if (!expiresAt) return false;
    return expiresAt.getTime() <= now.getTime();
}

/**
 * Check if a matchroom is join-locked.
 *
 * Join-lock rules:
 * - Full rooms are considered locked (no more joins).
 * - If now >= lockAt, new join flows are blocked.
 * 
 * @param room The matchroom object
 * @returns true if room is join-locked
 */
export function isJoinLocked(room: any, now = new Date()): boolean {
    // Expired rooms aren't treated as locked for join logic
    if (isRoomExpired(room, now)) return false;

    if (isRoomFull(room)) return true;

    const lockAt = getRoomLockAt(room);
    return Boolean(lockAt && lockAt.getTime() <= now.getTime());
}

export function isLeaveLocked(room: any, now = new Date()): boolean {
    if (!room) return false;
    if (room.status === "expired" || room.status === "cancelled") return true;
    if (room.venueConfirmedAt || room.confirmedZoneId || room.zoneAdminApproved === true) return true;
    const lockAt = getRoomLockAt(room);
    return Boolean(lockAt && lockAt.getTime() <= now.getTime());
}

export function isRoomLocked(room: any, now = new Date()): boolean {
    return isJoinLocked(room, now);
}

/**
 * Get the room status for display.
 * 
 * @param room The matchroom object
 * @returns 'locked' | 'expired' | 'open' | original status
 */
export function getRoomDisplayStatus(room: any): string {
    if (isRoomExpired(room)) return 'expired';
    if (isRoomLocked(room)) return 'locked';
    if (room.status === 'expired') return 'open';
    return room.status || 'open';
}

/**
 * Check if a user can submit a complaint for a matchroom.
 * Allowed if status is 'in-progress' OR 'completed' (within 24 hours of completion).
 * 
 * @param room The matchroom object
 * @param now Current time (for testing)
 * @returns true if reporting is allowed
 */
export function canSubmitComplain(room: any, now = new Date()): boolean {
    const status = room?.status;
    if (status === 'in-progress' || status === 'open' || status === 'locked') return true;

    if (status === 'completed') {
        const completedAt = toDate(room?.completedAt);
        if (!completedAt) return true; // Fallback: allow if timestamp is missing for existing rooms

        const diff = now.getTime() - completedAt.getTime();
        return diff >= 0 && diff <= ONE_DAY_MS;
    }

    return false;
}

// Export TTL for external use
export { ROOM_TTL_MS, ONE_DAY_MS, toDate };
