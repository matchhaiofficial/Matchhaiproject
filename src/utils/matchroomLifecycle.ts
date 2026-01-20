// src/utils/matchroomLifecycle.ts
// Helpers for matchroom expiry and lock status

// Matchroom TTL: 48 hours from creation
const ROOM_TTL_MS = 48 * 60 * 60 * 1000;

/**
 * Get the creation date of a matchroom.
 * @param room The matchroom object
 * @returns Date or null if unavailable
 */
export function getRoomCreatedAt(room: any): Date | null {
    // Primary: createdAt
    if (room.createdAt) {
        if (typeof room.createdAt === 'object' && 'seconds' in room.createdAt) {
            return new Date(room.createdAt.seconds * 1000);
        }
        if (room.createdAt instanceof Date) {
            return room.createdAt;
        }
        if (typeof room.createdAt === 'string') {
            const parsed = new Date(room.createdAt);
            if (!isNaN(parsed.getTime())) return parsed;
        }
    }

    // Fallback: updatedAt if createdAt missing
    if (room.updatedAt) {
        if (typeof room.updatedAt === 'object' && 'seconds' in room.updatedAt) {
            return new Date(room.updatedAt.seconds * 1000);
        }
    }

    return null;
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
        const totalSlots = allSlots.length;
        const confirmedSlots = allSlots.filter((s: any) => s.status === 'confirmed').length;
        return confirmedSlots >= totalSlots;
    }

    // Fallback: player count
    const maxPlayers = room.maxPlayers || 10;
    const currentPlayers = room.currentPlayers || room.players?.length || 0;
    return currentPlayers >= maxPlayers;
}

/**
 * Check if a matchroom is expired (not full after 48 hours).
 * 
 * A matchroom is expired if:
 * 1. createdAt exists AND
 * 2. now - createdAt > 48 hours AND
 * 3. Room is NOT full
 * 
 * @param room The matchroom object
 * @param now Current time (for testing)
 * @returns true if room is expired
 */
export function isRoomExpired(room: any, now = new Date()): boolean {
    // Already marked as expired
    if (room.status === 'expired') return true;

    // Full rooms don't expire
    if (isRoomFull(room)) return false;

    const createdAt = getRoomCreatedAt(room);
    if (!createdAt) return false; // Can't determine, assume not expired

    const elapsed = now.getTime() - createdAt.getTime();
    return elapsed > ROOM_TTL_MS;
}

/**
 * Check if a matchroom is locked (full or explicitly locked).
 * 
 * @param room The matchroom object
 * @returns true if room is locked
 */
export function isRoomLocked(room: any): boolean {
    // Explicit lock
    if (room.status === 'locked') return true;
    if (room.isLocked === true) return true;

    // Full = locked
    return isRoomFull(room);
}

/**
 * Get the room status for display.
 * 
 * @param room The matchroom object
 * @returns 'locked' | 'expired' | 'open' | original status
 */
export function getRoomDisplayStatus(room: any): string {
    if (isRoomLocked(room)) return 'locked';
    if (isRoomExpired(room)) return 'expired';
    return room.status || 'open';
}

// Export TTL for external use
export { ROOM_TTL_MS };
