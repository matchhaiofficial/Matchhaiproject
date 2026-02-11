import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { setNotificationHandler } from "expo-notifications/build/NotificationsHandler";
import { getPermissionsAsync, requestPermissionsAsync } from "expo-notifications/build/NotificationPermissions";
import setNotificationChannelAsync from "expo-notifications/build/setNotificationChannelAsync";
import { AndroidImportance } from "expo-notifications/build/NotificationChannelManager.types";
import scheduleNotificationAsync from "expo-notifications/build/scheduleNotificationAsync";
import cancelScheduledNotificationAsync from "expo-notifications/build/cancelScheduledNotificationAsync";

const ANDROID_CHANNEL_ID = "default";
const STORAGE_KEY = "local_notifications.matchroom_reminders.v1";

type StoredReminderMap = Record<string, string>;

const readReminderMap = async (): Promise<StoredReminderMap> => {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return {};
        return parsed as StoredReminderMap;
    } catch {
        return {};
    }
};

const writeReminderMap = async (map: StoredReminderMap) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
};

export async function ensureLocalNotificationsConfigured() {
    setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
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

export async function cancelMatchroomReminder(roomId: string) {
    const map = await readReminderMap();
    const notificationId = map[roomId];
    if (!notificationId) return;
    try {
        await cancelScheduledNotificationAsync(notificationId);
    } finally {
        delete map[roomId];
        await writeReminderMap(map);
    }
}

export async function scheduleMatchroomReminder(input: {
    roomId: string;
    title: string;
    startAt: Date;
    minutesBefore?: number;
    href?: string;
}) {
    const minutesBefore = Math.max(0, Math.min(120, input.minutesBefore ?? 15));
    const triggerAtMs = input.startAt.getTime() - minutesBefore * 60 * 1000;
    const now = Date.now();

    // Too late to schedule (or already started).
    if (!Number.isFinite(triggerAtMs) || triggerAtMs <= now + 30 * 1000) {
        await cancelMatchroomReminder(input.roomId);
        return { ok: false as const, reason: "too_late" as const };
    }

    const map = await readReminderMap();
    const existingId = map[input.roomId];
    if (existingId) {
        try {
            await cancelScheduledNotificationAsync(existingId);
        } catch {
            // ignore
        }
    }

    const notificationId = await scheduleNotificationAsync({
        content: {
            title: input.title,
            body: minutesBefore > 0 ? `Starts in ${minutesBefore} minutes.` : "Starting soon.",
            sound: true,
            data: {
                href: input.href || `/matchrooms/${input.roomId}`,
                roomId: input.roomId,
            },
        },
        trigger: {
            date: new Date(triggerAtMs),
            channelId: Platform.OS === "android" ? ANDROID_CHANNEL_ID : undefined,
        } as any,
    });

    map[input.roomId] = notificationId;
    await writeReminderMap(map);
    return { ok: true as const, notificationId };
}
