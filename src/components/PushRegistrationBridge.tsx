import { useConvexAuth } from "convex/react";
import React, { useEffect } from "react";
import { AppState } from "react-native";

import { useAuth } from "../context/AuthContext";
import {
  cancelPendingPushRegistrationSync,
  syncPushRegistration,
} from "../services/pushRegistration";
import { isAuthenticatedProfileReady } from "../utils/authReadiness";
import Logger from "../utils/logger";
import { getPushRegistrationRetryDelayMs } from "../utils/pushRegistrationRetry";

export default function PushRegistrationBridge() {
  const { user, authUser, loading } = useAuth();
  const { isLoading: convexAuthLoading, isAuthenticated } = useConvexAuth();
  const registrationReady = isAuthenticatedProfileReady({
    authLoading: loading,
    convexAuthLoading,
    isAuthenticated,
    authUserId: authUser?.id,
    profileAuthId: user?.authId,
    profileUserId: user?._id,
  });

  useEffect(() => {
    if (!registrationReady || !user?._id) return;

    let active = true;
    let syncInFlight = false;
    let retryAttempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const clearRetryTimer = () => {
      if (!retryTimer) return;
      clearTimeout(retryTimer);
      retryTimer = null;
    };

    const scheduleRetry = () => {
      if (!active || retryTimer) return;
      const delayMs = getPushRegistrationRetryDelayMs(retryAttempt);
      retryAttempt += 1;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void runSync();
      }, delayMs);
    };

    const runSync = async () => {
      if (!active || syncInFlight) return;
      syncInFlight = true;
      try {
        const result = await syncPushRegistration({ userId: user._id });
        if (!active) return;
        if (result.retryable) {
          Logger.warn(
            "PushRegistrationBridge",
            "Push registration is inactive; scheduling retry",
            { permissionStatus: result.permissionStatus, registrationError: result.registrationError },
          );
          scheduleRetry();
          return;
        }
        clearRetryTimer();
        retryAttempt = 0;
      } catch (error) {
        if (!active) return;
        Logger.warn("PushRegistrationBridge", "Push registration sync failed", error);
        scheduleRetry();
      } finally {
        syncInFlight = false;
      }
    };

    void runSync();
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      clearRetryTimer();
      void runSync();
    });

    return () => {
      active = false;
      clearRetryTimer();
      appStateSubscription.remove();
      cancelPendingPushRegistrationSync();
    };
  }, [registrationReady, user?._id]);

  return null;
}
