import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { setNotificationHandler } from "expo-notifications/build/NotificationsHandler";
import { getPermissionsAsync, requestPermissionsAsync } from "expo-notifications/build/NotificationPermissions";
import setNotificationChannelAsync from "expo-notifications/build/setNotificationChannelAsync";
import { AndroidImportance } from "expo-notifications/build/NotificationChannelManager.types";
import scheduleNotificationAsync from "expo-notifications/build/scheduleNotificationAsync";
import cancelScheduledNotificationAsync from "expo-notifications/build/cancelScheduledNotificationAsync";
import getAllScheduledNotificationsAsync from "expo-notifications/build/getAllScheduledNotificationsAsync";

const ANDROID_CHANNEL_ID = "default";
const STORAGE_KEY = "local_notifications.matchroom_reminders.v1";

type StoredReminderRecord = {
    notificationId: string;
    triggerAtMs: number;
    title: string;
    minutesBefore: number;
};

type StoredReminderMap = Record<string, StoredReminderRecord>;

const roomOps = new Map<string, Promise<unknown>>();

const runSerializedForRoom = async <T>(roomId: string, task: () => Promise<T>): Promise<T> => {
    const previous = roomOps.get(roomId) || Promise.resolve();
    const next = previous.catch(() => undefined).then(task);
    roomOps.set(roomId, next);
    return next.finally(() => {
        if (roomOps.get(roomId) === next) {
            roomOps.delete(roomId);
        }
    });
};

const normalizeStoredEntry = (entry: any): StoredReminderRecord | null => {
    if (typeof entry === "string" && entry) {
        return {
            notificationId: entry,
            triggerAtMs: 0,
            title: "",
            minutesBefore: 15,
        };
    }

    if (!entry || typeof entry !== "object") return null;

    const notificationId = typeof entry.notificationId === "string" ? entry.notificationId : "";
    if (!notificationId) return null;

    return {
        notificationId,
        triggerAtMs: Number(entry.triggerAtMs) || 0,
        title: typeof entry.title === "string" ? entry.title : "",
        minutesBefore: Number(entry.minutesBefore) || 15,
    };
};

const cancelDuplicateRemindersForRoom = async (roomId: string, keepNotificationId?: string) => {
    try {
        const scheduled = await getAllScheduledNotificationsAsync();
        const targets = scheduled.filter((item: any) => {
            const identifier = String(item?.identifier || item?.id || "");
            if (!identifier || (keepNotificationId && identifier === keepNotificationId)) return false;
            const scheduledRoomId = String(
                item?.content?.data?.roomId ||
                item?.request?.content?.data?.roomId ||
                "",
            );
            return scheduledRoomId === roomId;
        });

        await Promise.all(
            targets.map((item: any) =>
                cancelScheduledNotificationAsync(String(item?.identifier || item?.id || "")).catch(() => null),
            ),
        );
    } catch {
        // noop
    }
};

const readReminderMap = async (): Promise<StoredReminderMap> => {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return {};

        const normalized: StoredReminderMap = {};
        for (const [roomId, entry] of Object.entries(parsed)) {
            const next = normalizeStoredEntry(entry);
            if (next) normalized[roomId] = next;
        }
        return normalized;
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
    return runSerializedForRoom(roomId, async () => {
        const map = await readReminderMap();
        const existing = map[roomId];
        try {
            if (existing?.notificationId) {
                await cancelScheduledNotificationAsync(existing.notificationId);
            }
        } finally {
            delete map[roomId];
            await writeReminderMap(map);
        }

        await cancelDuplicateRemindersForRoom(roomId);
    });
}

export async function scheduleMatchroomReminder(input: {
    roomId: string;
    title: string;
    startAt: Date;
    minutesBefore?: number;
    href?: string;
}) {
    return runSerializedForRoom(input.roomId, async () => {
        const minutesBefore = Math.max(0, Math.min(120, input.minutesBefore ?? 15));
        const triggerAtMs = input.startAt.getTime() - minutesBefore * 60 * 1000;
        const now = Date.now();
        const map = await readReminderMap();
        const existing = map[input.roomId];

        // Too late to schedule (or already started).
        if (!Number.isFinite(triggerAtMs) || triggerAtMs <= now + 30 * 1000) {
            try {
                if (existing?.notificationId) {
                    await cancelScheduledNotificationAsync(existing.notificationId);
                }
            } catch {
                // noop
            } finally {
                delete map[input.roomId];
                await writeReminderMap(map);
            }
            await cancelDuplicateRemindersForRoom(input.roomId);
            return { ok: false as const, reason: "too_late" as const };
        }

        // Idempotent scheduling: keep existing reminder when trigger stays the same.
        if (existing?.notificationId && existing.triggerAtMs === triggerAtMs) {
            await cancelDuplicateRemindersForRoom(input.roomId, existing.notificationId);
            return { ok: true as const, notificationId: existing.notificationId, skipped: true as const };
        }

        if (existing?.notificationId) {
            try {
                await cancelScheduledNotificationAsync(existing.notificationId);
            } catch {
                // noop
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

        map[input.roomId] = {
            notificationId,
            triggerAtMs,
            title: input.title,
            minutesBefore,
        };
        await writeReminderMap(map);
        await cancelDuplicateRemindersForRoom(input.roomId, notificationId);
        return { ok: true as const, notificationId };
    });
}
