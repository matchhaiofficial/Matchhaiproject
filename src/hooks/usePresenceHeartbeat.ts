import { useCallback, useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

// The server treats a user as present for two minutes. Ninety seconds keeps a
// safe margin while cutting steady-state presence mutations by one third.
const HEARTBEAT_INTERVAL_MS = 90_000;

/**
 * Calls `users.touchPresence` on app foreground and every 90 s while active.
 * Calls `users.goOffline` only when the app backgrounds or the authenticated
 * user logs out. Route unmounts must not mark the user offline.
 */
export function usePresenceHeartbeat(enabled: boolean = true) {
    const touchPresence = useMutation(api.users.touchPresence);
    const goOffline = useMutation(api.users.goOffline);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const wasEnabledRef = useRef(false);

    const stopHeartbeat = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const startHeartbeat = useCallback((touch: () => void) => {
        if (!intervalRef.current) {
            intervalRef.current = setInterval(touch, HEARTBEAT_INTERVAL_MS);
        }
    }, []);

    const touch = useCallback(() => {
        void touchPresence().catch(() => {});
    }, [touchPresence]);

    const offline = useCallback(() => {
        void goOffline().catch(() => {});
    }, [goOffline]);

    useEffect(() => {
        if (!enabled) {
            if (wasEnabledRef.current) {
                offline();
            }
            wasEnabledRef.current = false;
            stopHeartbeat();
            return;
        }

        wasEnabledRef.current = true;
        touch();
        startHeartbeat(touch);

        const handleAppState = (nextState: AppStateStatus) => {
            if (nextState === "active") {
                touch();
                startHeartbeat(touch);
                return;
            }

            if (nextState === "background") {
                offline();
                stopHeartbeat();
            }
        };

        const subscription = AppState.addEventListener("change", handleAppState);

        return () => {
            subscription.remove();
            stopHeartbeat();
        };
    }, [enabled, offline, startHeartbeat, stopHeartbeat, touch]);
}
