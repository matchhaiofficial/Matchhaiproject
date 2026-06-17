import AsyncStorage from "@react-native-async-storage/async-storage";
import { useConvexAuth, useQuery } from "convex/react";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  addNotificationResponseReceivedListener,
  clearLastNotificationResponseAsync,
  getLastNotificationResponseAsync,
} from "expo-notifications/build/NotificationsEmitter";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "../context/AuthContext";
import { loadFirebaseMessaging } from "../services/firebaseMessaging";
import { isVisibleZoneAdminNotification } from "../features/zoneAdmin/notificationFilters";
import { buildNotificationRoute } from "../navigation/routes";
import { resolvePublicAppHref } from "../navigation/publicLinks";
import {
  ensureLocalNotificationsConfigured,
  requestLocalNotificationPermissions,
  clearAllMatchroomReminders,
  runOneTimeReminderCleanupIfNeeded,
  clearLocalBadgeCount,
  setLocalBadgeCount,
  presentImmediateLocalNotification,
} from "../services/localNotifications";
import { reconcileUpcomingMatchReminders } from "../services/reminderManager";
import { isSuperAdminProfile, isZoneAccount } from "../utils/accountRouting";
import { isAuthenticatedProfileReady } from "../utils/authReadiness";
import { getNotificationResponseKey } from "../utils/notificationResponse";

const LAST_HANDLED_RESPONSE_KEY = "notifications.lastHandledResponse.v1";
const responsesBeingHandled = new Set<string>();
const MAX_HANDLED_RESPONSE_KEYS = 25;

function parseHandledResponseKeys(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {}
  return [value];
}

function getHrefFromNotificationData(data: any) {
  const hasRoutingSignal = [
    data?.type,
    data?.canonicalType,
    data?.route,
    data?.href,
    data?.matchroomId,
    data?.teamId,
    data?.requestId,
    data?.requestRef,
    data?.intentId,
    data?.offerId,
    data?.challengeId,
    data?.reportId,
    data?.ticketId,
    data?.supportTicketId,
  ].some((value) => String(value ?? "").trim().length > 0);
  if (!hasRoutingSignal) return null;

  return buildNotificationRoute({
    type: data?.type,
    route: data?.route,
    href: data?.href,
    recipientRole: data?.recipientRole,
    matchroomId: data?.matchroomId,
    teamId: data?.teamId,
    data,
  });
}

function getNotificationEventKey(data: any, fallbackKey?: string | null) {
  const candidate = [
    fallbackKey,
    data?.notificationId,
    data?.dedupeKey,
    data?.route,
    data?.href,
    data?.matchroomId,
    data?.teamId,
    data?.challengeId,
    data?.requestId,
    data?.requestRef,
    data?.intentId,
    data?.offerId,
    data?.reportId,
    data?.ticketId,
    data?.supportTicketId,
  ]
    .map((value) => String(value ?? "").trim())
    .find((value) => value.length > 0);
  return candidate || null;
}

async function handleNotificationData(
  data: any,
  onHref: (href: string) => void,
  key?: string | null
) {
  const eventKey = getNotificationEventKey(data, key);
  const href = getHrefFromNotificationData(data);
  if (!eventKey || responsesBeingHandled.has(eventKey)) return;

  responsesBeingHandled.add(eventKey);
  try {
    const stored = await AsyncStorage.getItem(LAST_HANDLED_RESPONSE_KEY);
    const handledKeys = parseHandledResponseKeys(stored);
    if (handledKeys.includes(eventKey)) return;

    await AsyncStorage.setItem(
      LAST_HANDLED_RESPONSE_KEY,
      JSON.stringify([...handledKeys, eventKey].slice(-MAX_HANDLED_RESPONSE_KEYS)),
    );
    if (href) onHref(href);
  } finally {
    responsesBeingHandled.delete(eventKey);
  }
}

async function handleNotificationResponse(response: any, onHref: (href: string) => void) {
  const data: any = response?.notification?.request?.content?.data || {};
  const key = getNotificationResponseKey(response);
  await handleNotificationData(data, onHref, key);
}

async function handleFirebaseNotification(message: any, onHref: (href: string) => void) {
  const data: any = message?.data || {};
  const key = String(message?.messageId || message?.message_id || data?.notificationId || "").trim() || null;
  await handleNotificationData(data, onHref, key);
}

async function handleRemoteForegroundMessage(message: any) {
  const data: any = message?.data || {};
  const title = String(message?.notification?.title || data?.title || "New update");
  const body = String(message?.notification?.body || data?.body || "Open MatchHai to view details.");
  const href = getHrefFromNotificationData(data) || "/(player)/inbox";
  await presentImmediateLocalNotification({
    title,
    body,
    data: {
      ...data,
      href,
      route: href,
    },
  }).catch(() => null);
}

export default function NotificationRuntimeBridge() {
  const { user, authUser, loading } = useAuth();
  const { isLoading: convexAuthLoading, isAuthenticated } = useConvexAuth();
  const [appStateTick, setAppStateTick] = useState(0);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [cleanupReady, setCleanupReady] = useState(false);
  const lastBadgeUserIdRef = useRef<string | null>(null);
  const userId = user?._id as Id<"users"> | undefined;
  const accountRole = String((user as any)?.role || (user as any)?.accountType || "").toLowerCase();
  const isZoneAdmin = accountRole === "zone" || accountRole === "zone_admin";
  const isSuperAdmin = isSuperAdminProfile(user);
  const authenticatedProfileReady = isAuthenticatedProfileReady({
    authLoading: loading,
    convexAuthLoading,
    isAuthenticated,
    authUserId: authUser?.id,
    profileAuthId: user?.authId,
    profileUserId: userId,
  });
  const playerQueriesReady = authenticatedProfileReady && !isZoneAdmin && !isSuperAdmin;
  const dashboardSummary = useQuery(
    api.dashboard.getPlayerHomeSummary,
    playerQueriesReady && userId ? { userId } : "skip"
  );
  const unreadBadgeCount = useQuery(
    api.notifications.countUnreadFast,
    playerQueriesReady && userId ? { userId } : "skip"
  );
  const zoneUnreadNotifications = useQuery(
    api.notifications.listUnreadForUser,
    authenticatedProfileReady && userId && isZoneAdmin ? { userId, limit: 100 } : "skip"
  );

  const upcomingRooms = useMemo(() => dashboardSummary?.upcomingRooms || [], [dashboardSummary?.upcomingRooms]);
  const effectiveBadgeCount = useMemo(() => {
    if (isZoneAdmin) {
      if (!zoneUnreadNotifications) return undefined;
      return zoneUnreadNotifications.filter(isVisibleZoneAdminNotification).length;
    }
    return typeof unreadBadgeCount === "number" ? unreadBadgeCount : undefined;
  }, [isZoneAdmin, unreadBadgeCount, zoneUnreadNotifications]);

  useEffect(() => {
    ensureLocalNotificationsConfigured()
      .then(() => requestLocalNotificationPermissions())
      .catch(() => null);

    // One-time flush of legacy/bad reminders before reconciliation recreates
    // valid future ones. Gate reconciliation until this resolves so we don't
    // immediately wipe freshly scheduled reminders.
    void runOneTimeReminderCleanupIfNeeded().finally(() => setCleanupReady(true));

    let active = true;
    let unsubscribeMessageOpened: (() => void) | null = null;
    let unsubscribeForegroundMessage: (() => void) | null = null;

    const responseSub = addNotificationResponseReceivedListener((response) => {
      void handleNotificationResponse(response, (href) => setPendingHref(href))
        .finally(() => clearLastNotificationResponseAsync().catch(() => null));
    });

    void getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          return handleNotificationResponse(response, (href) => setPendingHref(href))
            .finally(() => clearLastNotificationResponseAsync().catch(() => null));
        }
        return null;
      })
      .catch(() => null);

    void loadFirebaseMessaging()
      .then((module) => {
        if (!active || !module?.default) return null;
        try {
          const messaging = module.default();
          unsubscribeForegroundMessage = messaging.onMessage((message: any) => {
            void handleRemoteForegroundMessage(message);
          });
          unsubscribeMessageOpened = messaging.onNotificationOpenedApp((message: any) => {
            void handleFirebaseNotification(message, (href) => {
              if (active) setPendingHref(href);
            });
          });
          const initialNotification = messaging.getInitialNotification?.();
          if (initialNotification && typeof initialNotification.then === "function") {
            void initialNotification.then((message: any) => {
              if (!message) return null;
              return handleFirebaseNotification(message, (href) => {
                if (active) setPendingHref(href);
              });
            });
          }
        } catch {
          // No-op: Firebase is best-effort and may not be configured in every build.
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
      active = false;
      responseSub.remove();
      unsubscribeForegroundMessage?.();
      unsubscribeMessageOpened?.();
      appStateSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!pendingHref) return;
    if (!authenticatedProfileReady) return;

    const accountKind = isSuperAdminProfile(user)
      ? "super_admin"
      : isZoneAccount(user)
        ? "zone"
        : "player";
    router.push(resolvePublicAppHref(pendingHref, accountKind) as any);
    setPendingHref(null);
  }, [authenticatedProfileReady, pendingHref, user]);

  useEffect(() => {
    if (!cleanupReady) return;
    if (!user?._id) {
      void clearAllMatchroomReminders();
      void clearLocalBadgeCount();
      return;
    }

    void reconcileUpcomingMatchReminders({
      userId: String(user._id),
      upcomingRooms,
      minutesBefore: 15,
    }).catch(() => null);
  }, [appStateTick, upcomingRooms, user?._id, cleanupReady]);

  useEffect(() => {
    const currentUserId = user?._id ? String(user._id) : null;
    if (lastBadgeUserIdRef.current !== currentUserId) {
      lastBadgeUserIdRef.current = currentUserId;
      void clearLocalBadgeCount();
    }

    if (!authenticatedProfileReady) {
      void clearLocalBadgeCount();
      return;
    }
    if (typeof effectiveBadgeCount !== "number") return;

    void setLocalBadgeCount(effectiveBadgeCount);
  }, [appStateTick, authenticatedProfileReady, effectiveBadgeCount, user?._id]);

  return null;
}
