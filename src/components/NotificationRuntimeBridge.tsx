import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "convex/react";
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
import { ensureLocalNotificationsConfigured, requestLocalNotificationPermissions, clearAllMatchroomReminders } from "../services/localNotifications";
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

async function routeFromResponse(response: any) {
  const data: any = response?.notification?.request?.content?.data || {};
  const href = typeof data?.route === "string" && data.route
    ? data.route
    : typeof data?.href === "string"
      ? data.href
      : "";
  if (href) {
    router.push(href as any);
  }
}

async function handleNotificationResponse(response: any) {
  const key = getResponseKey(response);
  if (!key) {
    await routeFromResponse(response);
    return;
  }

  const lastHandled = await AsyncStorage.getItem(LAST_HANDLED_RESPONSE_KEY);
  if (lastHandled === key) return;

  await AsyncStorage.setItem(LAST_HANDLED_RESPONSE_KEY, key);
  await routeFromResponse(response);
}

export default function NotificationRuntimeBridge() {
  const { user } = useAuth();
  const [appStateTick, setAppStateTick] = useState(0);
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

    const responseSub = addNotificationResponseReceivedListener((response) => {
      void handleNotificationResponse(response);
    });

    void getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          return handleNotificationResponse(response);
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
    if (!user?._id) {
      void clearAllMatchroomReminders();
      return;
    }

    void reconcileUpcomingMatchReminders({
      userId: String(user._id),
      upcomingRooms,
      minutesBefore: 15,
    }).catch(() => null);
  }, [appStateTick, upcomingRooms, user?._id]);

  return null;
}
