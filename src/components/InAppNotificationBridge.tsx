import { collection, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useRef } from "react";
import scheduleNotificationAsync from "expo-notifications/build/scheduleNotificationAsync";

import { db } from "../config/firebaseConfig";
import { useAuth } from "../context/AuthContext";
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
    const { user } = useAuth();
    const seenIdsRef = useRef<Set<string>>(new Set());
    const primedRef = useRef(false);

    useEffect(() => {
        primedRef.current = false;
        seenIdsRef.current = new Set();
    }, [user?.uid]);

    useEffect(() => {
        if (!user?.uid) return;

        const q = query(
            collection(db, "notifications"),
            where("toUid", "==", user.uid),
        );

        const unsub = onSnapshot(
            q,
            async (snapshot: any) => {
                const incoming: Array<{ id: string; data: any }> = [];
                snapshot.forEach((docSnap: any) => incoming.push({ id: docSnap.id, data: docSnap.data() }));

                if (!primedRef.current) {
                    incoming.forEach((item) => seenIdsRef.current.add(item.id));
                    primedRef.current = true;
                    return;
                }

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
            },
            (error: any) => {
                Logger.error("InAppNotificationBridge", "Notifications listener failed", error);
            },
        );

        return () => unsub();
    }, [user?.uid]);

    return null;
}
