import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import React, { memo, useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import AppHeader from "../../../src/components/AppHeader";
import {
    AdminEmptyStateCard,
    AdminInfoLine,
    AdminListCard,
    AdminSectionHeader,
} from "../../../src/components/AdminSurface";
import { AppButton } from "../../../src/components/AppPrimitives";
import Screen from "../../../src/components/Screen";
import SegmentedTabs from "../../../src/components/SegmentedTabs";
import { useAuth } from "../../../src/context/AuthContext";
import { useRouteLogger } from "../../../src/hooks/useRouteLogger";
import { useToast } from "../../../src/hooks/useToast";
import { respondToMatchJoinRequest } from "../../../src/services/convex/matchService";
import {
    rejectZoneBookingRequest,
} from "../../../src/services/convex/zoneAdminBookingService";
import { COLORS } from "../../../src/theme";
import Logger from "../../../src/utils/logger";
import {
    getNotificationStatusLabel,
    getNotificationStatusTone,
} from "../../../src/utils/statusLabels";
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
    fromUid?: string;
    fromUsername?: string;
    toUid?: string;
    data?: Record<string, any>;
    matchroomId?: string;
};

const formatTime = (value: any) => {
    if (!value) return "Now";
    if (typeof value === "number") return new Date(value).toLocaleString();
    if (value instanceof Date) return value.toLocaleString();
    return "Now";
};

const getTypeLabel = (value?: string) =>
    String(value || "notification")
        .replace(/_/g, " ")
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
    const status = String(item.status || "new").toLowerCase();
    const typeLabel = getTypeLabel(item.type);
    const isMatchRequest = String(item.type || "").toLowerCase().includes("match");
    const title = item.title || item.message || "Admin Alert";
    const message = item.message && item.message !== item.title ? item.message : "";
    const requestId = String(meta.requestId || meta.requestRef || "").trim();
    const matchroomId = String(meta.matchroomId || item.matchroomId || "").trim();
    const matchroomLabel = String(meta.matchroomTitle || matchroomId || "").trim();
    const hasResourceContext = !!meta.resourceId || !!meta.branchId;
    const resourceLabel = String(meta.resourceName || meta.resourceId || "Resources").trim();
    const playerLabel = String(meta.userName || meta.playerName || meta.requesterName || "").trim();
    const needsDecision =
        ZONE_DECISION_TYPES.has(item.type) &&
        status !== "accepted" &&
        status !== "rejected";

    return (
        <AdminListCard
            title={ZONE_MATCH_REQUEST_TYPES.has(item.type) ? `${item.fromUsername || "Player"} wants to join` : title}
            subtitle={`${typeLabel} • ${formatTime(item.createdAt)}`}
            statusLabel={getNotificationStatusLabel(status)}
            statusTone={getNotificationStatusTone(status)}
            onPress={() => onOpen(item)}
            actions={
                needsDecision ? (
                    <>
                        <AppButton
                            variant="success"
                            size="sm"
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
                                onPress={(event) => {
                                    event.stopPropagation();
                                    onMarkSeen(item);
                                }}
                            >
                                Mark Seen
                            </AppButton>
                        ) : null}
                    </>
                )
            }
        >
            <View style={styles.infoStack}>
                {isMatchRequest ? (
                    <>
                        <AdminInfoLine
                            label="Room"
                            value={`${meta.matchroomTitle || meta.matchroomId || item.matchroomId || "Unknown"} • ${meta.game || "--"}`}
                        />
                        <AdminInfoLine
                            label="Seat request"
                            value={`Role: ${meta.role || "Flex"} • Team: ${meta.targetTeam || "Any"}`}
                        />
                    </>
                ) : message ? (
                    <Text style={styles.messageText}>{message}</Text>
                ) : null}
                {!!playerLabel ? <AdminInfoLine label="Player" value={playerLabel} /> : null}
                {!!requestId ? <AdminInfoLine label="Request" value={requestId} /> : null}
                {!!matchroomId ? <AdminInfoLine label="Matchroom" value={matchroomLabel} /> : null}
                {hasResourceContext ? <AdminInfoLine label="Resource" value={resourceLabel} /> : null}
            </View>
        </AdminListCard>
    );
});

export default function ZoneNotificationsModule() {
    const router = useRouter();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "read">("all");
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [clearing, setClearing] = useState(false);
    useRouteLogger("ZoneNotificationsModule", {
        statusFilter,
        userId: user?._id,
    });

    const markAsReadMutation = useMutation(api.notifications.markAsRead);
    const markAllAsReadMutation = useMutation(api.notifications.markAllAsReadFast);
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
                status: notification.status === "read" ? "seen" : notification.status,
                createdAt: notification.createdAt,
                fromUid: notification.fromUid,
                fromUsername: notification.fromUsername,
                toUid: notification.toUid,
                data: notification.data || {},
                matchroomId: notification.matchroomId,
            }))
            .filter((item: AdminNotification) => {
                const type = String(item.type || "").toLowerCase();
                return type.includes("booking") || type.includes("resource") || type.includes("admin") || type.includes("match");
            })
            .sort((left: AdminNotification, right: AdminNotification) => (right.createdAt || 0) - (left.createdAt || 0));
    }, [rawNotifications]);

    const pendingCount = useMemo(() => items.filter((item) => item.status !== "seen").length, [items]);
    const seenCount = useMemo(() => items.filter((item) => item.status === "seen").length, [items]);
    const filteredItems = useMemo(
        () =>
            items.filter((item) => {
                if (statusFilter === "all") return true;
                if (statusFilter === "pending") return item.status === "pending";
                if (statusFilter === "read") return item.status === "seen";
                return true;
            }),
        [items, statusFilter],
    );

    const markSeenIfPending = useCallback(async (item: AdminNotification) => {
        try {
            if (item.status === "pending") {
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

    const openResources = useCallback((params: Record<string, any>) => {
        router.push({
            pathname: "/zone/modules/resources",
            params,
        } as any);
    }, [router]);

    const handleClearAll = useCallback(async () => {
        if (!user?._id || items.length === 0) return;

        const hasPending = pendingCount > 0;
        const alertTitle = hasPending ? "Mark All as Seen" : "Clear Notification History";
        const alertMsg = hasPending
            ? "This will mark all notifications as seen."
            : "This will archive all seen notifications.";

        Alert.alert(
            alertTitle,
            alertMsg,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: hasPending ? "Mark Seen" : "Archive History",
                    style: "default",
                    onPress: async () => {
                        setClearing(true);
                        try {
                            if (hasPending) {
                                await markAllAsReadMutation({
                                    userId: user._id as Id<"users">,
                                });
                            } else {
                                const seenIds = items
                                    .filter((item) => item.status === "seen")
                                    .map((item) => item._id as Id<"notifications">);
                                if (seenIds.length) {
                                    await archiveManyMutation({
                                        notificationIds: seenIds,
                                    });
                                }
                            }
                        } catch (error) {
                            Logger.error("ZoneNotifications", "Clear all failed", error);
                        } finally {
                            setClearing(false);
                        }
                    },
                },
            ],
        );
    }, [archiveManyMutation, items, markAllAsReadMutation, pendingCount, user?._id]);

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
                router.push({
                    pathname: "/zone/modules/bookings",
                    params: {
                        segment: "requests",
                        requestId,
                    },
                } as any);
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
                await markAsReadMutation({
                    notificationId: item._id as Id<"notifications">,
                });
                showToast({
                    type: "success",
                    title: "Rejected",
                    message: "Booking request rejected.",
                });
            } else {
                showToast({ type: "error", title: "Error", message: result.message });
            }
        } catch (error) {
            Logger.error("ZoneNotifications", "Booking Action failed", error);
        } finally {
            setProcessingId(null);
        }
    }, [markAsReadMutation, showToast, user]);

    const handleAcceptReject = useCallback(async (item: AdminNotification, decision: "accept" | "reject") => {
        if (!user?._id) return;
        setProcessingId(item.id);
        try {
            const result = await respondToMatchJoinRequest(item.id, decision, user._id);
            if (result.ok) {
                if (decision === "accept") {
                    showToast({
                        type: "success",
                        title: "Accepted",
                        message: `${item.fromUsername || "Player"} has been added to the room.`,
                    });
                } else {
                    showToast({ type: "success", title: "Rejected", message: "Request has been rejected." });
                }
            } else {
                showToast({ type: "error", title: "Error", message: result.message });
            }
        } catch (error) {
            Logger.error("ZoneNotifications", "Accept/Reject failed", error);
        } finally {
            setProcessingId(null);
        }
    }, [showToast, user?._id]);

    const openNotification = useCallback(async (item: AdminNotification) => {
        await markSeenIfPending(item);

        const meta = item.data || {};
        const type = String(item.type || "").toLowerCase();

        if (type.includes("match") && (meta.matchroomId || item.matchroomId)) {
            router.push(`/matchrooms/${meta.matchroomId || item.matchroomId}` as any);
            return;
        }

        if (meta.requestId || meta.matchroomId || item.matchroomId || type.includes("booking")) {
            openBookings({
                segment: (meta.matchroomId || item.matchroomId) ? "matchrooms" : "requests",
                requestId: meta.requestId,
                matchroomId: meta.matchroomId || item.matchroomId,
            });
            return;
        }

        if (meta.branchId || meta.resourceId || type.includes("resource")) {
            openResources({
                branchId: meta.branchId,
                requestId: meta.requestId,
                resourceId: meta.resourceId,
            });
            return;
        }

        openBookings({});
    }, [markSeenIfPending, openBookings, openResources, router]);

    const handleAccept = useCallback((item: AdminNotification) => {
        if (item.type === "admin_booking_request") {
            void handleAcceptRejectBooking(item, "accept");
            return;
        }
        void handleAcceptReject(item, "accept");
    }, [handleAcceptReject, handleAcceptRejectBooking]);

    const handleReject = useCallback((item: AdminNotification) => {
        if (item.type === "admin_booking_request") {
            void handleAcceptRejectBooking(item, "reject");
            return;
        }
        void handleAcceptReject(item, "reject");
    }, [handleAcceptReject, handleAcceptRejectBooking]);

    return (
        <Screen style={styles.screen} scroll={false}>
            <AppHeader
                title="Notifications Center"
                subtitle={`Pending alerts: ${pendingCount}`}
                onBack={() => router.back()}
                inlineTitle
            />
            <SegmentedTabs
                items={[
                    { key: "all", label: "All", badge: items.length },
                    { key: "pending", label: "Pending", badge: pendingCount },
                    { key: "read", label: "Seen", badge: seenCount },
                ]}
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as "all" | "pending" | "read")}
                style={styles.segmentTabs}
            />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {items.length > 0 ? (
                    <View style={styles.clearActionRow}>
                        <AdminSectionHeader
                            title="Queue Actions"
                            subtitle="Mark active alerts seen or clear the resolved history."
                            compact
                            accessory={(
                                <AppButton
                                    variant={pendingCount > 0 ? "secondary" : "danger"}
                                    size="sm"
                                    loading={clearing}
                                    onPress={handleClearAll}
                                >
                                    {pendingCount > 0 ? "Mark All Seen" : "Clear History"}
                                </AppButton>
                            )}
                        />
                    </View>
                ) : null}

                {loading ? (
                    <ActivityIndicator size="small" color={COLORS.accent} />
                ) : filteredItems.length === 0 ? (
                    <AdminEmptyStateCard
                        title="No admin notifications yet"
                        description="Booking, resource, and moderation alerts will appear here."
                        icon="notifications-active"
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
