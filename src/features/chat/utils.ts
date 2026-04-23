import { formatDistanceToNowStrict } from "date-fns";
import { useEffect, useState } from "react";

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

export function formatVoiceDuration(durationMs?: number | null) {
    const totalSeconds = Math.max(0, Math.round((durationMs || 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function buildSeenLabel(names: string[], otherParticipantCount?: number) {
    if (names.length === 0) return "";
    if ((otherParticipantCount || 0) <= 1) return "Seen";
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
