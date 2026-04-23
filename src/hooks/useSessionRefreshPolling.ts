import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

type UseSessionRefreshPollingArgs = {
  enabled: boolean;
  intervalMs?: number;
  refreshSession: () => Promise<unknown>;
};

export function useSessionRefreshPolling({
  enabled,
  intervalMs = 5000,
  refreshSession,
}: UseSessionRefreshPollingArgs) {
  const appIsActiveRef = useRef(AppState.currentState === "active");

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      appIsActiveRef.current = state === "active";
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        return undefined;
      }

      if (appIsActiveRef.current) {
        void refreshSession();
      }

      const interval = setInterval(() => {
        if (!appIsActiveRef.current) return;
        void refreshSession();
      }, intervalMs);

      return () => clearInterval(interval);
    }, [enabled, intervalMs, refreshSession]),
  );
}
