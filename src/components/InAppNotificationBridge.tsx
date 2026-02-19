import { useQuery } from "convex/react";
import React, { useEffect, useRef } from "react";
import scheduleNotificationAsync from "expo-notifications/build/scheduleNotificationAsync";

import { useAuth } from "../context/AuthContext";
import { api } from "../../convex/_generated/api";
import Logger from "../utils/logger";

const toMillis = (value: any) => {
    if (!value) return 0;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    return 0;
};

const inferHref = (data: any): string => {
    const meta = data?.meta || {};
    if (meta.matchroomId) return `/matchrooms/${meta.matchroomId}`;
    if (meta.teamId) return `/teams/${meta.teamId}`;
    return "/(player)/inbox";
};

export default function InAppNotificationBridge() {
    const { user, isAuthenticated } = useAuth();
    const seenIdsRef = useRef<Set<string>>(new Set());
    const primedRef = useRef(false);
    const notificationData = useQuery(
        api.notifications.listNotifications,
        isAuthenticated ? { limit: 50 } : "skip",
    );

    useEffect(() => {
        primedRef.current = false;
        seenIdsRef.current = new Set();
    }, [user?.uid]);

    useEffect(() => {
        if (!notificationData?.items) return;

        const incoming = notificationData.items.map((item: any) => ({
            id: String(item._id),
            data: item,
        }));

        if (!primedRef.current) {
            incoming.forEach((item) => seenIdsRef.current.add(item.id));
            primedRef.current = true;
            return;
        }

        const run = async () => {
            for (const item of incoming) {
                if (seenIdsRef.current.has(item.id)) continue;
                seenIdsRef.current.add(item.id);

                const data = item.data || {};
                if (data.status && String(data.status) !== "pending") continue;
                if (data.expiresAt && toMillis(data.expiresAt) < Date.now()) continue;

                const title = String(data.title || "New update");
                const body = String(data.message || data.body || "Open inbox to view details.");
                const href = inferHref(data);

                try {
                    await scheduleNotificationAsync({
                        content: {
                            title,
                            body,
                            data: { href, notificationId: item.id },
                        },
                        trigger: null,
                    });
                } catch (error) {
                    Logger.debug("InAppNotificationBridge", "Failed to present local notification", { error });
                }
            }
        };

        run().catch((error) => {
            Logger.error("InAppNotificationBridge", "Notifications listener failed", error);
        });
    }, [notificationData]);

    return null;
}
