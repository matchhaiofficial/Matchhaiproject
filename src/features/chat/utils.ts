import { formatDistanceToNowStrict } from "date-fns";
import { useEffect, useState } from "react";
import type { ChatSeenReceipt } from "./types";

export function formatChatTime(timestamp?: number | null) {
    if (!timestamp) return "";
    return new Date(timestamp).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
    });
}

export function formatRelativeChatTime(timestamp?: number | null, nowMs?: number) {
    if (!timestamp) return "";
    const now = nowMs ?? Date.now();
    const diffMs = Math.max(0, now - timestamp);
    if (diffMs < 45_000) return "Just now";
    return formatDistanceToNowStrict(new Date(timestamp), { addSuffix: true });
}

export function isChatUserOnline(
    lastActiveAt?: number | null,
    isOnline?: boolean | null,
    nowMs?: number,
) {
    if (!isOnline || !lastActiveAt) return false;
    return Math.max(0, (nowMs ?? Date.now()) - lastActiveAt) < 2 * 60_000;
}

export function formatChatPresenceLabel(
    lastActiveAt?: number | null,
    isOnline?: boolean | null,
    nowMs?: number,
) {
    if (!lastActiveAt) return null;

    const now = nowMs ?? Date.now();
    if (isChatUserOnline(lastActiveAt, isOnline, now)) return "online";

    const seenAt = new Date(lastActiveAt);
    const today = new Date(now);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const sameDay = seenAt.toDateString() === today.toDateString();
    const yesterdayDay = seenAt.toDateString() === yesterday.toDateString();
    const timeLabel = formatChatTime(lastActiveAt);

    if (sameDay) return `last seen today at ${timeLabel}`;
    if (yesterdayDay) return `last seen yesterday at ${timeLabel}`;

    return `last seen ${seenAt.toLocaleDateString([], { month: "short", day: "numeric" })} at ${timeLabel}`;
}

export function formatVoiceDuration(durationMs?: number | null) {
    const totalSeconds = Math.max(0, Math.round((durationMs || 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function buildSeenLabel(receipts: ChatSeenReceipt[], otherParticipantCount?: number) {
    if (receipts.length === 0) return "";

    const sortedReceipts = [...receipts].sort((a, b) => b.readAt - a.readAt);

    if ((otherParticipantCount || 0) <= 1) return "Seen";

    const names = sortedReceipts.map((receipt) => receipt.name);
    if (names.length <= 2) return `Seen by ${names.join(", ")}`;
    return `Seen by ${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

// Returns Date.now() that refreshes every `intervalMs` (default 60s) so
// relative timestamps stay fresh without each bubble owning its own timer.
export function useRelativeNow(intervalMs: number = 60_000) {
    const [now, setNow] = useState<number>(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);
    return now;
}
