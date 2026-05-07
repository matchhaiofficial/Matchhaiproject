import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

const HEARTBEAT_INTERVAL_MS = 60_000;

/**
 * Calls `users.touchPresence` on app foreground and every 60 s while active.
 * Calls `users.goOffline` when the app backgrounds.
 */
export function usePresenceHeartbeat(enabled: boolean = true) {
    const touchPresence = useMutation(api.users.touchPresence);
    const goOffline = useMutation(api.users.goOffline);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!enabled) return;

        const touch = () => {
            void touchPresence().catch(() => {});
        };

        const offline = () => {
            void goOffline().catch(() => {});
        };

        // Fire immediately on mount / foreground
        touch();
        intervalRef.current = setInterval(touch, HEARTBEAT_INTERVAL_MS);

        const handleAppState = (nextState: AppStateStatus) => {
            if (nextState === "active") {
                touch();
                if (!intervalRef.current) {
                    intervalRef.current = setInterval(touch, HEARTBEAT_INTERVAL_MS);
                }
            } else {
                offline();
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            }
        };

        const subscription = AppState.addEventListener("change", handleAppState);

        return () => {
            // If the user logs out or the screen tree unmounts while still active,
            // mark the current user offline so presence doesn't get stuck.
            offline();
            subscription.remove();
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [enabled, goOffline, touchPresence]);
}
