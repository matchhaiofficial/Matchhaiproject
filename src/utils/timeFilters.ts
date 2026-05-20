// src/utils/timeFilters.ts
// Helpers for timeline-based filtering of matchrooms

import { TimelineFilterKey } from '../constants/timelineFilters';

/**
 * Normalize Firestore timestamp or date to a Date object.
 * Supports:
 * - Firestore Timestamp { seconds: number }
 * - Date object
 * - ISO string
 * - scheduledDate + scheduledTime fallback
 */
export function getRoomStartDate(room: any): Date | null {
    // Preferred: scheduledStartAt (Convex stores this as ms epoch for scheduled start)
    if (typeof room?.scheduledStartAt === 'number') {
        const parsed = new Date(room.scheduledStartAt);
        if (!isNaN(parsed.getTime())) return parsed;
    }

    // Primary: startTime
    if (room.startTime) {
        if (typeof room.startTime === 'object' && 'seconds' in room.startTime) {
            const parsed = new Date(room.startTime.seconds * 1000);
            if (!isNaN(parsed.getTime())) return parsed;
        }
        if (typeof room.startTime === 'number') {
            const parsed = new Date(room.startTime);
            if (!isNaN(parsed.getTime())) return parsed;
        }
        if (room.startTime instanceof Date) {
            return room.startTime;
        }
        if (typeof room.startTime === 'string') {
            const parsed = new Date(room.startTime);
            if (!isNaN(parsed.getTime())) return parsed;
        }
    }

    // Fallback: scheduledDate + scheduledTime
    if (room.scheduledDate) {
        const dateStr = room.scheduledDate;
        const timeStr = room.scheduledTime || '00:00';
        const combined = new Date(`${dateStr}T${timeStr}`);
        if (!isNaN(combined.getTime())) return combined;
    }

    return null;
}

/**
 * Check if a date falls within a timeline bucket.
 * 
 * @param date The date to check
 * @param key The timeline filter key
 * @param now Current time (for testing)
 * @returns true if date is in the timeline bucket
 */
export function isInTimeline(date: Date, key: TimelineFilterKey, now = new Date()): boolean {
    if (key === 'any') return true;

    // Get start of today (midnight)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000); // Tomorrow 00:00

    switch (key) {
        case 'today':
            // Within today's 00:00 -> tomorrow 00:00
            return date >= todayStart && date < todayEnd;

        case 'next_3_days':
            // From tomorrow 00:00 -> (today + 3 days) end
            const threeDaysEnd = new Date(todayStart.getTime() + 3 * 24 * 60 * 60 * 1000);
            return date >= todayEnd && date < threeDaysEnd;

        case 'next_1_week':
            // From (today + 3 days) -> (today + 7 days) end
            const threeDaysStart = new Date(todayStart.getTime() + 3 * 24 * 60 * 60 * 1000);
            const oneWeekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);
            return date >= threeDaysStart && date < oneWeekEnd;

        default:
            return true;
    }
}

/**
 * Filter matchrooms by timeline.
 * If room has no start date, only match when timeline is 'any'.
 */
export function matchesTimeline(room: any, key: TimelineFilterKey): boolean {
    if (key === 'any') return true;

    const startDate = getRoomStartDate(room);
    if (!startDate) return false; // No date = only show for 'any'

    return isInTimeline(startDate, key);
}
