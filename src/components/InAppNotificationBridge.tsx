import React, { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import scheduleNotificationAsync from "expo-notifications/build/scheduleNotificationAsync";

import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "../context/AuthContext";
import Logger from "../utils/logger";

const inferHref = (data: any): string => {
    const meta = data?.data || {};
    if (meta.matchroomId) return `/matchrooms/${meta.matchroomId}`;
    if (meta.teamId) return `/teams/${meta.teamId}`;
    return "/(player)/inbox";
};

export default function InAppNotificationBridge() {
    const { user } = useAuth();
    const seenIdsRef = useRef<Set<string>>(new Set());
    const primedRef = useRef(false);

    useEffect(() => {
        primedRef.current = false;
        seenIdsRef.current = new Set();
    }, [user?._id]);

    const notifications = useQuery(
        api.notifications.listForUser,
        user?._id ? { userId: user._id as Id<"users">, limit: 50 } : "skip",
    );

    useEffect(() => {
        if (!notifications || !user?._id) return;

        const incoming = notifications.map((n: any) => ({
            id: n._id,
            data: n,
        }));

        if (!primedRef.current) {
            incoming.forEach((item: any) => seenIdsRef.current.add(item.id));
            primedRef.current = true;
            return;
        }

        (async () => {
            for (const item of incoming) {
                if (seenIdsRef.current.has(item.id)) continue;
                seenIdsRef.current.add(item.id);

                const data = item.data || {};
                if (data.status && String(data.status) !== "pending") continue;
                if (data.expiresAt && data.expiresAt < Date.now()) continue;

                const title = String(data.title || "New update");
                const body = String(data.body || "Open inbox to view details.");
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
        })();
    }, [notifications, user?._id]);

    return null;
}
