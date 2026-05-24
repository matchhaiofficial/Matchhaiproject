import AsyncStorage from "@react-native-async-storage/async-storage";
import { useConvexAuth, useQuery } from "convex/react";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import {
  addNotificationResponseReceivedListener,
  getLastNotificationResponseAsync,
} from "expo-notifications/build/NotificationsEmitter";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "../context/AuthContext";
import { ensureLocalNotificationsConfigured, requestLocalNotificationPermissions, clearAllMatchroomReminders, runOneTimeReminderCleanupIfNeeded } from "../services/localNotifications";
import { reconcileUpcomingMatchReminders } from "../services/reminderManager";

const LAST_HANDLED_RESPONSE_KEY = "notifications.lastHandledResponse.v1";

function getResponseKey(response: any) {
  const identifier = String(
    response?.notification?.request?.identifier ||
    response?.notification?.request?.content?.data?.reminderKey ||
    response?.notification?.request?.content?.data?.notificationId ||
    ""
  ).trim();
  return identifier;
}

function getHrefFromResponse(response: any) {
  const data: any = response?.notification?.request?.content?.data || {};
  const href = typeof data?.route === "string" && data.route
    ? data.route
    : typeof data?.href === "string"
      ? data.href
      : "";
  return typeof href === "string" ? href : "";
}

async function handleNotificationResponse(response: any, onHref: (href: string) => void) {
  const key = getResponseKey(response);
  const href = getHrefFromResponse(response);
  if (!key) {
    if (href) onHref(href);
    return;
  }

  const lastHandled = await AsyncStorage.getItem(LAST_HANDLED_RESPONSE_KEY);
  if (lastHandled === key) return;

  await AsyncStorage.setItem(LAST_HANDLED_RESPONSE_KEY, key);
  if (href) onHref(href);
}

export default function NotificationRuntimeBridge() {
  const { user } = useAuth();
  const { isLoading: convexAuthLoading, isAuthenticated } = useConvexAuth();
  const [appStateTick, setAppStateTick] = useState(0);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [cleanupReady, setCleanupReady] = useState(false);
  const userId = user?._id as Id<"users"> | undefined;
  const dashboardSummary = useQuery(
    api.dashboard.getPlayerHomeSummary,
    userId ? { userId } : "skip"
  );

  const upcomingRooms = useMemo(() => dashboardSummary?.upcomingRooms || [], [dashboardSummary?.upcomingRooms]);

  useEffect(() => {
    ensureLocalNotificationsConfigured()
      .then(() => requestLocalNotificationPermissions())
      .catch(() => null);

    // One-time flush of legacy/bad reminders before reconciliation recreates
    // valid future ones. Gate reconciliation until this resolves so we don't
    // immediately wipe freshly scheduled reminders.
    void runOneTimeReminderCleanupIfNeeded().finally(() => setCleanupReady(true));

    const responseSub = addNotificationResponseReceivedListener((response) => {
      void handleNotificationResponse(response, (href) => setPendingHref(href));
    });

    void getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          return handleNotificationResponse(response, (href) => setPendingHref(href));
        }
        return null;
      })
      .catch(() => null);

    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setAppStateTick((value) => value + 1);
      }
    });

    return () => {
      responseSub.remove();
      appStateSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!pendingHref) return;
    if (!user?._id) return;
    if (convexAuthLoading) return;
    if (!isAuthenticated) return;

    router.push(pendingHref as any);
    setPendingHref(null);
  }, [convexAuthLoading, isAuthenticated, pendingHref, user?._id]);

  useEffect(() => {
    if (!cleanupReady) return;
    if (!user?._id) {
      void clearAllMatchroomReminders();
      return;
    }

    void reconcileUpcomingMatchReminders({
      userId: String(user._id),
      upcomingRooms,
      minutesBefore: 15,
    }).catch(() => null);
  }, [appStateTick, upcomingRooms, user?._id, cleanupReady]);

  return null;
}
