import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { setNotificationHandler } from "expo-notifications/build/NotificationsHandler";
import { getPermissionsAsync, requestPermissionsAsync } from "expo-notifications/build/NotificationPermissions";
import setNotificationChannelAsync from "expo-notifications/build/setNotificationChannelAsync";
import { AndroidImportance } from "expo-notifications/build/NotificationChannelManager.types";
import scheduleNotificationAsync from "expo-notifications/build/scheduleNotificationAsync";
import cancelScheduledNotificationAsync from "expo-notifications/build/cancelScheduledNotificationAsync";
import getAllScheduledNotificationsAsync from "expo-notifications/build/getAllScheduledNotificationsAsync";
import { SchedulableTriggerInputTypes } from "expo-notifications/build/Notifications.types";
import setBadgeCountAsync from "expo-notifications/build/setBadgeCountAsync";
import getBadgeCountAsync from "expo-notifications/build/getBadgeCountAsync";

const ANDROID_CHANNEL_ID = "default";
const STORAGE_KEY = "local_notifications.matchroom_reminders.v2";
// One-time cleanup flag: clears any reminders scheduled by the pre-fix (malformed
// trigger) builds exactly once, then lets corrected logic recreate valid reminders.
const ONE_TIME_CLEANUP_FLAG_KEY = "local_notifications.matchroom_reminders.cleanup.v2";

export type ReminderPlan = {
  reminderKey: string;
  roomId: string;
  title: string;
  triggerAtMs: number;
  minutesBefore: number;
  href?: string;
};

type StoredReminderRecord = ReminderPlan & {
  notificationId: string;
};

type StoredReminderMap = Record<string, StoredReminderRecord>;

const reminderOps = new Map<string, Promise<unknown>>();

function normalizeBadgeCount(count: number) {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.max(0, Math.floor(count));
}

export async function setLocalBadgeCount(count: number) {
  try {
    return await setBadgeCountAsync(normalizeBadgeCount(count));
  } catch {
    return false;
  }
}

export async function clearLocalBadgeCount() {
  return setLocalBadgeCount(0);
}

export async function adjustLocalBadgeCount(delta: number) {
  if (!Number.isFinite(delta) || delta === 0) return false;
  try {
    const current = await getBadgeCountAsync();
    return await setLocalBadgeCount(normalizeBadgeCount(Number(current || 0) + delta));
  } catch {
    return false;
  }
}

const runSerializedForKey = async <T>(key: string, task: () => Promise<T>): Promise<T> => {
  const previous = reminderOps.get(key) || Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  reminderOps.set(key, next);
  return next.finally(() => {
    if (reminderOps.get(key) === next) {
      reminderOps.delete(key);
    }
  });
};

function normalizeStoredEntry(entry: any): StoredReminderRecord | null {
  if (!entry || typeof entry !== "object") return null;
  const notificationId = typeof entry.notificationId === "string" ? entry.notificationId : "";
  const reminderKey = typeof entry.reminderKey === "string" ? entry.reminderKey : "";
  const roomId = typeof entry.roomId === "string" ? entry.roomId : "";
  if (!notificationId || !reminderKey || !roomId) return null;

  return {
    notificationId,
    reminderKey,
    roomId,
    title: typeof entry.title === "string" ? entry.title : "",
    triggerAtMs: Number(entry.triggerAtMs) || 0,
    minutesBefore: Number(entry.minutesBefore) || 15,
    href: typeof entry.href === "string" ? entry.href : undefined,
  };
}

async function readReminderMap(): Promise<StoredReminderMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    const normalized: StoredReminderMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      const record = normalizeStoredEntry(value);
      if (record) normalized[key] = record;
    }
    return normalized;
  } catch {
    return {};
  }
}

async function writeReminderMap(map: StoredReminderMap) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

async function cancelScheduledNotification(notificationId?: string) {
  if (!notificationId) return;
  try {
    await cancelScheduledNotificationAsync(notificationId);
  } catch {
    // noop
  }
}

async function cancelUnknownScheduledReminderDuplicates(params: {
  desiredKeys: Set<string>;
  desiredRoomIds?: Set<string>;
}) {
  try {
    const scheduled = await getAllScheduledNotificationsAsync();
    const obsolete = scheduled.filter((item: any) => {
      const contentData = item?.content?.data || item?.request?.content?.data || {};
      const reminderKey = String(contentData?.reminderKey || "");
      if (reminderKey) return !params.desiredKeys.has(reminderKey);

      // Legacy/unknown scheduled notifications: best-effort cleanup so reminders
      // don't linger forever if older builds scheduled without a reminderKey.
      const roomId = String(contentData?.roomId || "");
      if (roomId && params.desiredRoomIds) {
        return !params.desiredRoomIds.has(roomId);
      }
      return false;
    });

    await Promise.all(
      obsolete.map((item: any) =>
        cancelScheduledNotification(String(item?.identifier || item?.id || "")).catch(() => null)
      )
    );
  } catch {
    // noop
  }
}

async function schedulePlan(plan: ReminderPlan): Promise<StoredReminderRecord | null> {
  const now = Date.now();
  if (!Number.isFinite(plan.triggerAtMs) || plan.triggerAtMs <= now + 30_000) {
    return null;
  }

  const notificationId = await scheduleNotificationAsync({
    content: {
      title: plan.title,
      body:
        plan.minutesBefore > 0
          ? `Starts in ${plan.minutesBefore} minutes.`
          : "Starting soon.",
      sound: true,
      data: {
        href: plan.href || `/matchrooms/${plan.roomId}`,
        route: plan.href || `/matchrooms/${plan.roomId}`,
        roomId: plan.roomId,
        reminderKey: plan.reminderKey,
      },
    },
    // Expo requires `type` on object triggers; without it Android can treat the
    // trigger as "immediate", causing reminders to fire right after scheduling.
    trigger: (Platform.OS === "android"
      ? {
          type: SchedulableTriggerInputTypes.DATE,
          date: new Date(plan.triggerAtMs),
          channelId: ANDROID_CHANNEL_ID,
        }
      : {
          type: SchedulableTriggerInputTypes.DATE,
          date: new Date(plan.triggerAtMs),
        }) as any,
  });

  return {
    notificationId,
    ...plan,
  };
}

export function buildMatchroomReminderKey(input: {
  userId: string;
  roomId: string;
  startAtMs: number;
  minutesBefore?: number;
}) {
  const minutesBefore = Math.max(0, Math.min(120, input.minutesBefore ?? 15));
  return `match_start_15m:${input.userId}:${input.roomId}:${Math.floor(input.startAtMs)}:${minutesBefore}`;
}

export async function ensureLocalNotificationsConfigured() {
  setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === "android") {
    await setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: "Default",
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#42a5f5",
    });
  }
}

export async function requestLocalNotificationPermissions() {
  const current = await getPermissionsAsync();
  if (current.granted) return { granted: true };

  const next = await requestPermissionsAsync();
  return { granted: Boolean(next.granted) };
}

export async function clearAllMatchroomReminders() {
  const map = await readReminderMap();
  await Promise.all(Object.values(map).map((entry) => cancelScheduledNotification(entry.notificationId)));
  await writeReminderMap({});
  await cancelUnknownScheduledReminderDuplicates({ desiredKeys: new Set() });
}

// Runs once per install: cancels every locally-scheduled matchroom reminder so
// reminders queued by older builds (which used a malformed trigger and could fire
// immediately) are flushed. After this, normal reconciliation recreates only the
// valid future reminders. Subsequent launches no-op via the persisted flag.
export async function runOneTimeReminderCleanupIfNeeded() {
  try {
    const done = await AsyncStorage.getItem(ONE_TIME_CLEANUP_FLAG_KEY);
    if (done === "done") return false;
    await clearAllMatchroomReminders();
    await AsyncStorage.setItem(ONE_TIME_CLEANUP_FLAG_KEY, "done");
    return true;
  } catch {
    return false;
  }
}

export async function cancelMatchroomReminder(roomId: string) {
  const map = await readReminderMap();
  const nextMap: StoredReminderMap = {};

  await Promise.all(
    Object.entries(map).map(async ([key, entry]) => {
      if (entry.roomId === roomId) {
        await cancelScheduledNotification(entry.notificationId);
        return;
      }
      nextMap[key] = entry;
    })
  );

  await writeReminderMap(nextMap);
}

export async function reconcileMatchroomReminders(plans: ReminderPlan[]) {
  return runSerializedForKey("global_matchroom_reconcile", async () => {
    const desiredPlans = plans.filter(
      (plan) => plan && plan.reminderKey && plan.roomId && Number.isFinite(plan.triggerAtMs)
    );
    const desiredKeySet = new Set(desiredPlans.map((plan) => plan.reminderKey));
    const desiredRoomIdSet = new Set(desiredPlans.map((plan) => plan.roomId));
    const stored = await readReminderMap();
    const nextMap: StoredReminderMap = {};

    for (const [key, entry] of Object.entries(stored)) {
      if (!desiredKeySet.has(key)) {
        await cancelScheduledNotification(entry.notificationId);
        continue;
      }
      nextMap[key] = entry;
    }

    for (const plan of desiredPlans) {
      const existing = nextMap[plan.reminderKey];
      if (
        existing &&
        existing.triggerAtMs === plan.triggerAtMs &&
        existing.roomId === plan.roomId &&
        existing.minutesBefore === plan.minutesBefore
      ) {
        continue;
      }

      if (existing?.notificationId) {
        await cancelScheduledNotification(existing.notificationId);
      }

      const scheduled = await schedulePlan(plan);
      if (scheduled) {
        nextMap[plan.reminderKey] = scheduled;
      } else {
        delete nextMap[plan.reminderKey];
      }
    }

    await writeReminderMap(nextMap);
    await cancelUnknownScheduledReminderDuplicates({
      desiredKeys: new Set(Object.keys(nextMap)),
      desiredRoomIds: desiredRoomIdSet,
    });
    return nextMap;
  });
}

export async function scheduleMatchroomReminder(input: {
  roomId: string;
  title: string;
  startAt: Date;
  minutesBefore?: number;
  href?: string;
  userId?: string;
}) {
  const startAtMs = input.startAt.getTime();
  const reminderKey = buildMatchroomReminderKey({
    userId: input.userId || "legacy",
    roomId: input.roomId,
    startAtMs,
    minutesBefore: input.minutesBefore,
  });

  const result = await reconcileMatchroomReminders([
    {
      reminderKey,
      roomId: input.roomId,
      title: input.title,
      triggerAtMs: startAtMs - (Math.max(0, Math.min(120, input.minutesBefore ?? 15)) * 60 * 1000),
      minutesBefore: Math.max(0, Math.min(120, input.minutesBefore ?? 15)),
      href: input.href,
    },
  ]);

  const scheduled = result[reminderKey];
  if (!scheduled) {
    return { ok: false as const, reason: "too_late" as const };
  }

  return { ok: true as const, notificationId: scheduled.notificationId };
}
