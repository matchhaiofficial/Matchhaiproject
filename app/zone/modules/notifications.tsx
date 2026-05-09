import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import React, { memo, useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import AppHeader from "../../../src/components/AppHeader";
import { AdminEmptyStateCard } from "../../../src/components/AdminSurface";
import { AppIcon } from "../../../src/components/AppIcon";
import { AppButton } from "../../../src/components/AppPrimitives";
import Screen from "../../../src/components/Screen";
import SegmentedTabs from "../../../src/components/SegmentedTabs";
import { useAuth } from "../../../src/context/AuthContext";
import {
    getZoneAdminNotificationStatus,
    isPendingZoneAdminNotification,
    isVisibleZoneAdminNotification,
} from "../../../src/features/zoneAdmin/notificationFilters";
import { useRouteLogger } from "../../../src/hooks/useRouteLogger";
import { useToast } from "../../../src/hooks/useToast";
import { respondToMatchJoinRequest } from "../../../src/services/convex/matchService";
import { rejectZoneBookingRequest } from "../../../src/services/convex/zoneAdminBookingService";
import { COLORS } from "../../../src/theme";
import Logger from "../../../src/utils/logger";
import { getNotificationStatusLabel } from "../../../src/utils/statusLabels";
import styles from "./notifications.styles";

type AdminNotification = {
    id: string;
    _id: string;
    type: string;
    title?: string;
    message?: string;
    body?: string;
    status?: string;
    createdAt?: any;
    isRead?: boolean;
    fromUid?: string;
    fromUsername?: string;
    toUid?: string;
    data?: Record<string, any>;
    matchroomId?: string;
};

const getTimeAgo = (timestamp: any): string => {
    if (!timestamp) return "Just now";
    const then =
        typeof timestamp === "number"
            ? new Date(timestamp)
            : timestamp?.toDate
                ? timestamp.toDate()
                : new Date(timestamp);
    const diffMs = Date.now() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
};

const getTypeLabel = (value?: string) =>
    String(value || "notification")
        .replace(/[_.]/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());

const ZONE_DECISION_TYPES = new Set([
    "match.join_request",
    "match_join_request",
    "booking.request_submitted",
    "admin_booking_request",
]);

const ZONE_MATCH_REQUEST_TYPES = new Set([
    "match.join_request",
    "match_join_request",
]);

const NotificationRow = memo(function NotificationRow({
    item,
    processingId,
    onOpen,
    onAccept,
    onReject,
    onMarkSeen,
}: {
    item: AdminNotification;
    processingId: string | null;
    onOpen: (item: AdminNotification) => void;
    onAccept: (item: AdminNotification) => void;
    onReject: (item: AdminNotification) => void;
    onMarkSeen: (item: AdminNotification) => void;
}) {
    const meta = item.data || {};
    const status = getZoneAdminNotificationStatus(item);
    const isMatchRequest = String(item.type || "").toLowerCase().includes("match");
    const title = ZONE_MATCH_REQUEST_TYPES.has(item.type)
        ? `${item.fromUsername || "Player"} wants to join`
        : item.title || item.message || "Admin Alert";
    const message = item.message && item.message !== item.title ? item.message : item.body || "";
    const requestId = String(meta.requestId || meta.requestRef || "").trim();
    const matchroomId = String(meta.matchroomId || item.matchroomId || "").trim();
    const matchroomLabel = String(meta.matchroomTitle || matchroomId || "").trim();
    const playerLabel = String(meta.userName || meta.playerName || meta.requesterName || "").trim();
    const resourceLabel = String(meta.resourceName || meta.resourceId || "").trim();
    const needsDecision =
        ZONE_DECISION_TYPES.has(item.type) &&
        status !== "accepted" &&
        status !== "rejected";

    return (
        <Pressable style={styles.notificationCard} onPress={() => onOpen(item)}>
            <View style={styles.cardHeader}>
                <View style={styles.iconContainer}>
                    <AppIcon name={isMatchRequest ? "matchroom" : "notifications"} size={20} color={COLORS.accent} />
                </View>
                {item.isRead === false ? <View style={styles.unreadDot} /> : null}
                <View style={styles.headerInfo}>
                    <Text style={styles.typeText}>{title}</Text>
                    <Text style={styles.timeText}>{getTypeLabel(item.type)} • {getTimeAgo(item.createdAt)}</Text>
                </View>
                {status !== "pending" ? (
                    <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>{getNotificationStatusLabel(status)}</Text>
                    </View>
                ) : null}
            </View>

            <View style={styles.cardBody}>
                <Text style={styles.messageText}>
                    {isMatchRequest
                        ? `${matchroomLabel || "Matchroom"} • ${meta.game || "--"}`
                        : message || "New admin notification."}
                </Text>
                {playerLabel ? <Text style={styles.metaText}>Player: {playerLabel}</Text> : null}
                {matchroomId ? <Text style={styles.metaText}>Matchroom: {matchroomLabel}</Text> : null}
                {resourceLabel ? <Text style={styles.metaText}>Resource: {resourceLabel}</Text> : null}
            </View>

            <View style={styles.actionRow}>
                {needsDecision ? (
                    <>
                        <AppButton
                            variant="success"
                            size="sm"
                            style={styles.actionButton}
                            loading={processingId === item.id}
                            onPress={(event) => {
                                event.stopPropagation();
                                onAccept(item);
                            }}
                        >
                            Accept
                        </AppButton>
                        <AppButton
                            variant="danger"
                            size="sm"
                            style={styles.actionButton}
                            loading={processingId === item.id}
                            onPress={(event) => {
                                event.stopPropagation();
                                onReject(item);
                            }}
                        >
                            Reject
                        </AppButton>
                    </>
                ) : (
                    <>
                        <AppButton
                            size="sm"
                            style={styles.actionButton}
                            onPress={(event) => {
                                event.stopPropagation();
                                onOpen(item);
                            }}
                        >
                            Open Context
                        </AppButton>
                        {status === "pending" ? (
                            <AppButton
                                variant="secondary"
                                size="sm"
                                style={styles.actionButton}
                                onPress={(event) => {
                                    event.stopPropagation();
                                    onMarkSeen(item);
                                }}
                            >
                                Mark Seen
                            </AppButton>
                        ) : null}
                    </>
                )}
            </View>
        </Pressable>
    );
});

export default function ZoneNotificationsModule() {
    const router = useRouter();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [statusFilter, setStatusFilter] = useState<"pending" | "resolved">("pending");
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [clearing, setClearing] = useState(false);
    useRouteLogger("ZoneNotificationsModule", {
        statusFilter,
        userId: user?._id,
    });

    const markAsReadMutation = useMutation(api.notifications.markAsRead);
    const markManyAsReadMutation = useMutation(api.notifications.markManyAsRead);
    const archiveManyMutation = useMutation(api.notifications.archiveMany);

    const rawNotifications = useQuery(
        api.notifications.listForUser,
        user?._id ? { userId: user._id as Id<"users">, limit: 100 } : "skip",
    );

    const loading = rawNotifications === undefined;

    const items: AdminNotification[] = useMemo(() => {
        if (!rawNotifications) return [];
        return rawNotifications
            .map((notification: any) => ({
                id: notification._id,
                _id: notification._id,
                type: notification.type || "general",
                title: notification.title,
                message: notification.body || notification.title,
                body: notification.body,
                status: getZoneAdminNotificationStatus(notification),
                isRead: notification.isRead === true,
                createdAt: notification.createdAt,
                fromUid: notification.fromUid,
                fromUsername: notification.fromUsername,
                toUid: notification.toUid,
                data: notification.data || {},
                matchroomId: notification.matchroomId,
            }))
            .filter(isVisibleZoneAdminNotification)
            .sort((left: AdminNotification, right: AdminNotification) => (right.createdAt || 0) - (left.createdAt || 0));
    }, [rawNotifications]);

    const pendingCount = useMemo(() => items.filter(isPendingZoneAdminNotification).length, [items]);
    const resolvedCount = useMemo(() => items.filter((item) => item.status !== "pending").length, [items]);
    const filteredItems = useMemo(
        () =>
            statusFilter === "pending"
                ? items.filter((item) => item.status === "pending")
                : items.filter((item) => item.status !== "pending"),
        [items, statusFilter],
    );

    const markSeenIfPending = useCallback(async (item: AdminNotification) => {
        try {
            if (getZoneAdminNotificationStatus(item) !== "seen") {
                await markAsReadMutation({
                    notificationId: item._id as Id<"notifications">,
                });
            }
        } catch (error) {
            Logger.warn("ZoneNotifications", "Unable to mark notification seen", error);
        }
    }, [markAsReadMutation]);

    const openBookings = useCallback((params: Record<string, any>) => {
        router.push({
            pathname: "/zone/modules/bookings",
            params,
        } as any);
    }, [router]);

    const openNotification = useCallback(async (item: AdminNotification) => {
        await markSeenIfPending(item);
        const meta = item.data || {};
        const type = String(item.type || "").toLowerCase();
        const requestId = String(meta.requestId || meta.requestRef || "").trim();
        if (requestId && (ZONE_DECISION_TYPES.has(type) || type.includes("booking"))) {
            openBookings({
                segment: "requests",
                requestId,
                expandedRequestId: requestId,
                focusRequestId: requestId,
            });
            return;
        }
        if (type.includes("match") && (meta.matchroomId || item.matchroomId)) {
            router.push(`/matchrooms/${meta.matchroomId || item.matchroomId}` as any);
            return;
        }
        openBookings({
            segment: (meta.matchroomId || item.matchroomId) ? "matchrooms" : "requests",
            requestId,
            expandedRequestId: requestId || undefined,
            matchroomId: meta.matchroomId || item.matchroomId,
        });
    }, [markSeenIfPending, openBookings, router]);

    const handleClearAll = useCallback(async () => {
        if (!user?._id || items.length === 0) return;
        const hasPending = pendingCount > 0;
        Alert.alert(
            hasPending ? "Mark all as read" : "Clear history",
            hasPending ? "This will mark all pending notifications as read." : "This will archive resolved notifications.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: hasPending ? "Mark Read" : "Clear",
                    onPress: async () => {
                        setClearing(true);
                        try {
                            if (hasPending) {
                                await markManyAsReadMutation({
                                    notificationIds: items
                                        .filter(isPendingZoneAdminNotification)
                                        .map((item) => item._id as Id<"notifications">),
                                });
                            } else {
                                await archiveManyMutation({
                                    notificationIds: items
                                        .filter((item) => item.status !== "pending")
                                        .map((item) => item._id as Id<"notifications">),
                                });
                            }
                        } finally {
                            setClearing(false);
                        }
                    },
                },
            ],
        );
    }, [archiveManyMutation, items, markManyAsReadMutation, pendingCount, user?._id]);

    const handleAcceptRejectBooking = useCallback(async (item: AdminNotification, decision: "accept" | "reject") => {
        if (!user?._id || !item.data?.requestId) return;
        setProcessingId(item.id);
        try {
            const requestId = item.data.requestId;
            const zoneId = item.data.zoneId || (user as any).zoneId;
            if (!zoneId) {
                showToast({ type: "error", title: "Error", message: "Zone ID not found. Cannot process request." });
                return;
            }
            if (decision === "accept") {
                openBookings({ segment: "requests", requestId });
                showToast({
                    type: "info",
                    title: "Allocation required",
                    message: "Open the booking request and allocate resources before accepting.",
                });
                return;
            }
            const result = await rejectZoneBookingRequest({
                requestId,
                adminUid: user._id,
                zoneId,
                requestOwnerUid: item.fromUid,
                reason: "Declined by admin",
            });
            if (result.ok) {
                await markAsReadMutation({ notificationId: item._id as Id<"notifications"> });
                showToast({ type: "success", title: "Rejected", message: "Booking request rejected." });
            } else {
                showToast({ type: "error", title: "Error", message: result.message });
            }
        } catch (error) {
            Logger.error("ZoneNotifications", "Booking Action failed", error);
        } finally {
            setProcessingId(null);
        }
    }, [markAsReadMutation, openBookings, showToast, user]);

    const handleAcceptReject = useCallback(async (item: AdminNotification, decision: "accept" | "reject") => {
        if (!user?._id) return;
        setProcessingId(item.id);
        try {
            const result = await respondToMatchJoinRequest(item.id, decision, user._id);
            showToast({
                type: result.ok ? "success" : "error",
                title: result.ok ? (decision === "accept" ? "Accepted" : "Rejected") : "Error",
                message: result.ok ? "Request updated." : result.message,
            });
        } catch (error) {
            Logger.error("ZoneNotifications", "Accept/Reject failed", error);
        } finally {
            setProcessingId(null);
        }
    }, [showToast, user?._id]);

    const handleAccept = useCallback((item: AdminNotification) => {
        if (item.type === "admin_booking_request") void handleAcceptRejectBooking(item, "accept");
        else void handleAcceptReject(item, "accept");
    }, [handleAcceptReject, handleAcceptRejectBooking]);

    const handleReject = useCallback((item: AdminNotification) => {
        if (item.type === "admin_booking_request") void handleAcceptRejectBooking(item, "reject");
        else void handleAcceptReject(item, "reject");
    }, [handleAcceptReject, handleAcceptRejectBooking]);

    const headerRightAction = pendingCount > 0 || resolvedCount > 0 ? (
        <Pressable onPress={handleClearAll} style={styles.markAllReadButton} disabled={clearing}>
            {clearing ? (
                <ActivityIndicator size="small" color={COLORS.accent} />
            ) : (
                <Text style={styles.markAllReadText}>{pendingCount > 0 ? "Mark all read" : "Clear history"}</Text>
            )}
        </Pressable>
    ) : undefined;

    return (
        <Screen style={styles.screen} scroll={false}>
            <AppHeader
                title="Notifications Center"
                onBack={() => router.back()}
                inlineTitle
                rightAction={headerRightAction}
            />
            <SegmentedTabs
                items={[
                    { key: "pending", label: "Pending", badge: pendingCount || undefined },
                    { key: "resolved", label: "History", badge: resolvedCount || undefined },
                ]}
                value={statusFilter}
                onChange={setStatusFilter}
                style={styles.segmentTabs}
            />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {loading ? (
                    <ActivityIndicator size="small" color={COLORS.accent} />
                ) : filteredItems.length === 0 ? (
                    <AdminEmptyStateCard
                        title="No admin notifications yet"
                        description="Booking, resource, and moderation alerts will appear here."
                        icon="notifications"
                    />
                ) : (
                    filteredItems.map((item) => (
                        <NotificationRow
                            key={item.id}
                            item={item}
                            processingId={processingId}
                            onOpen={(notification) => void openNotification(notification)}
                            onAccept={handleAccept}
                            onReject={handleReject}
                            onMarkSeen={(notification) => void markSeenIfPending(notification)}
                        />
                    ))
                )}
            </ScrollView>
        </Screen>
    );
}
