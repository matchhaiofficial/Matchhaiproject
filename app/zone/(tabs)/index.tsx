import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";

import AppHeader from "../../../src/components/AppHeader";
import {
    AdminEmptyStateCard,
    AdminMetricCard,
    AdminQuickActionCard,
    AdminSectionHeader,
} from "../../../src/components/AdminSurface";
import { AppIcon } from "../../../src/components/AppIcon";
import { StatusPill } from "../../../src/components/AppPrimitives";
import Screen from "../../../src/components/Screen";
import SidebarMenu from "../../../src/components/SidebarMenu";
import { useEntrance } from "../../../src/motion/useEntrance";
import { useToast } from "../../../src/hooks/useToast";
import MatchroomCard from "../../matchrooms/components/MatchroomCard";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useAuth } from "../../../src/context/AuthContext";
import { ZONE_ADMIN_MODULES } from "../../../src/features/zoneAdmin/modules";
import { useRouteLogger } from "../../../src/hooks/useRouteLogger";
import { useZoneData } from "../../../src/hooks/useZoneData";
import { signOutUser } from "../../../src/services/authService";
import {
    subscribeZoneBookingQueue,
    subscribeZoneMatchrooms,
    type ZoneBookingQueueItem,
    type ZoneMatchroomListItem,
} from "../../../src/services/convex/zoneAdminBookingService";
import {
    subscribeBranchResources,
    subscribeZoneBranches,
    type ZoneBranch,
    type ZoneBranchResource,
} from "../../../src/services/convex/zoneAdminResourceService";
import { type Matchroom } from "../../../src/services/convex/matchService";
import { COLORS } from "../../../src/theme";
import { getZoneLifecycleLabel } from "../../../src/utils/zoneLifecycle";
import { getZoneStatusTone } from "../../../src/utils/statusLabels";
import styles from "./dashboard.styles";

const HIDE_ZONE_TAB_BAR = process.env.EXPO_PUBLIC_HIDE_TAB_BAR === "1";

const MODULE_COLORS = [
    {
        cardStyle: { backgroundColor: "rgba(66,165,245,0.14)", borderColor: "rgba(66,165,245,0.45)" },
        iconStyle: { borderColor: "rgba(66,165,245,0.45)" },
        iconColor: "#64B5F6",
    },
    {
        cardStyle: { backgroundColor: "rgba(0,230,118,0.12)", borderColor: "rgba(0,230,118,0.4)" },
        iconStyle: { borderColor: "rgba(0,230,118,0.4)" },
        iconColor: "#00E676",
    },
    {
        cardStyle: { backgroundColor: "rgba(255,193,7,0.14)", borderColor: "rgba(255,193,7,0.45)" },
        iconStyle: { borderColor: "rgba(255,193,7,0.45)" },
        iconColor: "#FFCA28",
    },
    {
        cardStyle: { backgroundColor: "rgba(239,83,80,0.12)", borderColor: "rgba(239,83,80,0.45)" },
        iconStyle: { borderColor: "rgba(239,83,80,0.45)" },
        iconColor: "#EF5350",
    },
    {
        cardStyle: { backgroundColor: "rgba(171,71,188,0.15)", borderColor: "rgba(171,71,188,0.45)" },
        iconStyle: { borderColor: "rgba(171,71,188,0.45)" },
        iconColor: "#BA68C8",
    },
    {
        cardStyle: { backgroundColor: "rgba(38,198,218,0.14)", borderColor: "rgba(38,198,218,0.45)" },
        iconStyle: { borderColor: "rgba(38,198,218,0.45)" },
        iconColor: "#4DD0E1",
    },
    {
        cardStyle: { backgroundColor: "rgba(255,112,67,0.14)", borderColor: "rgba(255,112,67,0.45)" },
        iconStyle: { borderColor: "rgba(255,112,67,0.45)" },
        iconColor: "#FF8A65",
    },
    {
        cardStyle: { backgroundColor: "rgba(124,179,66,0.14)", borderColor: "rgba(124,179,66,0.45)" },
        iconStyle: { borderColor: "rgba(124,179,66,0.45)" },
        iconColor: "#9CCC65",
    },
];

const toMillis = (value: any) => {
    if (!value) return 0;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    return 0;
};

const toMatchroomDateMs = (room: ZoneMatchroomListItem) => {
    if (room.scheduledDate && room.scheduledTime) {
        const parsed = new Date(`${room.scheduledDate}T${room.scheduledTime}`);
        if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
    }
    return toMillis(room.createdAt);
};

const mapZoneRoomToMatchroom = (room: ZoneMatchroomListItem, fallbackLocation?: string): Matchroom => ({
    id: room.id,
    hostUid: room.zoneOwnerUid || "",
    hostName: "Zone Host",
    game: room.game,
    title: room.title,
    description: "Zone booking",
    status: room.status as any,
    maxPlayers: room.maxPlayers || 0,
    currentPlayers: room.currentPlayers || 0,
    players: [],
    playerUids: [],
    createdAt: room.createdAt || new Date(),
    location: room.location || fallbackLocation || "Zone Venue",
    pricing: {
        perPlayer: 0,
        currency: "PKR",
    },
    scheduledDate: room.scheduledDate,
    scheduledTime: room.scheduledTime,
    slotsA: [],
    slotsB: [],
    paymentStatus: (room.paymentStatus || "unpaid") as any,
});

export default function ZoneDashboardHome() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { zone, loading } = useZoneData();
    const { user } = useAuth();
    const { showToast } = useToast();
    useRouteLogger("ZoneDashboardHome", {
        zoneId: zone?.id,
        userId: user?._id,
    });

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [queue, setQueue] = useState<ZoneBookingQueueItem[]>([]);
    const [matchrooms, setMatchrooms] = useState<ZoneMatchroomListItem[]>([]);
    const [branches, setBranches] = useState<ZoneBranch[]>([]);
    const [resourcesByBranch, setResourcesByBranch] = useState<Record<string, ZoneBranchResource[]>>({});

    const { animatedStyle: entranceStyle } = useEntrance({ axis: "y", distance: 14 });

    // Use Convex query for notification count (real-time)
    const notificationCount = useQuery(
        api.notifications.countPendingFast,
        user?._id ? { userId: user._id as Id<"users"> } : "skip",
    ) ?? 0;

    const branchAreas = useMemo(() => {
        const areas = new Set<string>();
        if (zone?.primaryBranch?.areaLabel) {
            areas.add(String(zone.primaryBranch.areaLabel));
        }
        (zone?.branches || []).forEach((branch: any) => {
            if (branch?.areaLabel) areas.add(String(branch.areaLabel));
        });
        return Array.from(areas);
    }, [zone?.branches, zone?.primaryBranch?.areaLabel]);

    const branchIdsKey = useMemo(
        () => branches.map((branch) => branch.id).sort().join("|"),
        [branches],
    );

    useEffect(() => {
        if (!zone?.id) return;
        const unsub = subscribeZoneBranches(
            zone.id,
            (rows) => setBranches(rows),
            () => setBranches([]),
        );
        return () => unsub();
    }, [zone?.id]);

    useEffect(() => {
        if (!zone?.id || branches.length === 0) {
            setResourcesByBranch({});
            return;
        }
        const unsubs: Array<() => void> = [];
        branches.forEach((branch) => {
            unsubs.push(
                subscribeBranchResources(
                    zone.id,
                    branch.id,
                    (rows) => {
                        setResourcesByBranch((prev) => ({ ...prev, [branch.id]: rows }));
                    },
                    () => {
                        setResourcesByBranch((prev) => ({ ...prev, [branch.id]: [] }));
                    },
                ),
            );
        });
        return () => unsubs.forEach((unsub) => unsub());
    }, [branchIdsKey, branches, zone?.id]);

    useEffect(() => {
        if (!zone?.id) return;
        const unsubQueue = subscribeZoneBookingQueue(
            zone.id,
            branchAreas,
            (rows) => setQueue(rows),
            () => setQueue([]),
        );
        const unsubMatchrooms = subscribeZoneMatchrooms(
            zone.id,
            user?._id,
            (rows) => setMatchrooms(rows),
            () => setMatchrooms([]),
            {
                locationHints: [
                    zone.venueBrandName || "",
                    zone.primaryBranch?.branchDisplayName || "",
                    zone.primaryBranch?.areaLabel || "",
                    ...branchAreas,
                ],
            },
        );

        return () => {
            unsubQueue();
            unsubMatchrooms();
        };
    }, [branchAreas, user?._id, zone?.id, zone?.primaryBranch?.areaLabel, zone?.primaryBranch?.branchDisplayName, zone?.venueBrandName]);

    const allResources = useMemo(
        () => Object.values(resourcesByBranch).flat(),
        [resourcesByBranch],
    );

    const summary = useMemo(() => {
        const branchCount = Array.isArray(zone?.branches) ? zone.branches.length : branches.length;
        const gameCount = zone?.games
            ? Object.values(zone.games).filter((value) => value === true).length
            : 0;
        const zoneType = zone?.type === "sports" ? "Sports" : zone?.type === "hybrid" ? "Hybrid" : "Gaming";
        const status = getZoneLifecycleLabel(zone);
        const ownerName = zone?.ownerFullName || user?.fullName || "Zone Owner";
        const venueName = zone?.venueBrandName || "Zone Venue";
        const busy = allResources.filter((item) => item.lifecycleStatus === "booked" || item.lifecycleStatus === "held").length;
        const utilization = allResources.length ? Math.round((busy / allResources.length) * 100) : 0;
        const liveRooms = matchrooms.filter((item) => ["open", "in-progress"].includes(String(item.status || "").toLowerCase())).length;
        const pendingQueue = queue.filter((item) => item.status === "open" || item.status === "pending_payment").length;
        const walkins = matchrooms.filter((item) => item.bookingSource === "walkin").length;
        const now = Date.now();
        const upcomingCount = matchrooms.filter((item) => {
            const startMs = toMillis(item.createdAt);
            if (!startMs) return false;
            const delta = startMs - now;
            return delta > 0 && delta <= 2 * 60 * 60 * 1000;
        }).length;

        return {
            branchCount,
            gameCount,
            zoneType,
            status,
            ownerName,
            venueName,
            utilization,
            liveRooms,
            pendingQueue,
            walkins,
            upcomingCount,
            maintenanceCount: allResources.filter((item) => item.lifecycleStatus === "maintenance").length,
        };
    }, [allResources, branches.length, matchrooms, queue, user?.fullName, zone]);

    const dashboardModules = useMemo(
        () =>
            ZONE_ADMIN_MODULES.filter(
                (module) =>
                    !["notifications_center", "support_safety"].includes(module.id),
            ),
        [],
    );

    const upcomingMatchrooms = useMemo(
        () =>
            [...matchrooms]
                .filter((room) => {
                    const dateMs = toMatchroomDateMs(room);
                    return !dateMs || dateMs >= Date.now();
                })
                .sort((a, b) => toMatchroomDateMs(a) - toMatchroomDateMs(b))
                .slice(0, 5),
        [matchrooms],
    );

    const operationsCards = useMemo(
        () => [
            {
                key: "ops_queue",
                title: "Queue Pressure",
                value: `${summary.pendingQueue}`,
                subtitle: "Pending approvals right now",
                icon: "pending-actions" as const,
                cardStyle: { backgroundColor: "rgba(255,193,7,0.16)", borderColor: "rgba(255,193,7,0.4)" },
                iconStyle: { borderColor: "rgba(255,193,7,0.4)" },
            },
            {
                key: "ops_live",
                title: "Live Matchrooms",
                value: `${summary.liveRooms}`,
                subtitle: "Open or in-progress sessions",
                icon: "sports-esports" as const,
                cardStyle: { backgroundColor: "rgba(66,165,245,0.16)", borderColor: "rgba(66,165,245,0.4)" },
                iconStyle: { borderColor: "rgba(66,165,245,0.4)" },
            },
            {
                key: "ops_util",
                title: "Utilization",
                value: `${summary.utilization}%`,
                subtitle: "Held + booked resource load",
                icon: "bolt" as const,
                cardStyle: { backgroundColor: "rgba(0,230,118,0.14)", borderColor: "rgba(0,230,118,0.4)" },
                iconStyle: { borderColor: "rgba(0,230,118,0.4)" },
            },
            {
                key: "ops_maint",
                title: "Maintenance",
                value: `${summary.maintenanceCount}`,
                subtitle: "Resources under maintenance",
                icon: "build-circle" as const,
                cardStyle: { backgroundColor: "rgba(239,83,80,0.14)", borderColor: "rgba(239,83,80,0.42)" },
                iconStyle: { borderColor: "rgba(239,83,80,0.42)" },
            },
        ],
        [summary.liveRooms, summary.maintenanceCount, summary.pendingQueue, summary.utilization],
    );

    const handleLogout = async () => {
        const result = await signOutUser();
        if (!result.ok) {
            showToast({
                type: "error",
                title: "Logout failed",
                message: result.message,
            });
            return;
        }
        router.replace("/auth/login");
    };

    const sidebarItems = useMemo(
        () => [
            { label: "Dashboard", icon: "home" as const, onPress: () => router.push("/zone/(tabs)" as any) },
            ...dashboardModules.map((module) => ({
                label: module.title,
                icon: module.icon as any,
                onPress: () => router.push(module.route as any),
            })),
            { label: "Logout", icon: "logout" as const, onPress: handleLogout },
        ],
        [dashboardModules, router],
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    if (!zone) {
        return (
            <Screen style={styles.screen} scroll={false} edges={['top']} contentStyle={styles.screenContent}>
                <AppHeader title="Zone Dashboard" />
                <View style={styles.noZoneContainer}>
                    <AdminEmptyStateCard
                        title="Zone Not Found"
                        description="We could not find a zone linked to this account yet."
                        icon="hourglass-empty"
                        style={styles.noZoneCard}
                    />
                </View>
            </Screen>
        );
    }

    if (zone.status === "rejected") {
        return (
            <Screen style={styles.screen} scroll={false} edges={['top']} contentStyle={styles.screenContent}>
                <AppHeader title="Zone Dashboard" />
                <View style={styles.noZoneContainer}>
                    <AdminEmptyStateCard
                        title="Registration Rejected"
                        description="Update your details and contact support before retrying."
                        icon="report-gmailerrorred"
                        style={styles.noZoneCard}
                    />
                    <View style={styles.rejectedReasonWrap}>
                        {zone.rejectionReason ? (
                            <Text style={styles.rejectReason} numberOfLines={4}>
                                Reason: {zone.rejectionReason}
                            </Text>
                        ) : null}
                    </View>
                </View>
            </Screen>
        );
    }

    const leftAction = (
        <Pressable
            onPress={() => setSidebarOpen(true)}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
        >
            <AppIcon name="menu" size="lg" />
        </Pressable>
    );

    const rightAction = (
        <View style={styles.headerActionsRow}>
            <Pressable
                onPress={() => router.push("/zone/modules/notifications" as any)}
                style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
            >
                <AppIcon name="notifications-none" size="lg" />
                {notificationCount > 0 ? (
                    <View style={styles.notificationBadge}>
                        <Text style={styles.notificationBadgeText}>{notificationCount > 9 ? "9+" : notificationCount}</Text>
                    </View>
                ) : null}
            </Pressable>
            <Pressable
                onPress={handleLogout}
                style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
            >
                <AppIcon name="logout" size={22} tone="danger" />
            </Pressable>
        </View>
    );

    return (
        <Screen style={styles.screen} scroll={false} edges={['top']} contentStyle={styles.screenContent}>
            <AppHeader
                title="Dashboard"
                leftAction={leftAction}
                rightAction={rightAction}
                inlineTitle
            />
            <Animated.View style={[styles.screenContent, entranceStyle]}>
                <ScrollView
                    contentContainerStyle={[
                        styles.container,
                        { paddingBottom: HIDE_ZONE_TAB_BAR ? insets.bottom + 16 : 0 },
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.heroCard}>
                        <View style={styles.heroRow}>
                            <View style={styles.avatarIconWrap}>
                                <AppIcon
                                    name={zone.type === "sports" ? "sports-soccer" : zone.type === "hybrid" ? "sports" : "sports-esports"}
                                    size="lg"
                                    tone="accent"
                                />
                            </View>
                            <View style={styles.heroTextWrap}>
                                <Text style={styles.heroEyebrow}>Venue Profile</Text>
                                <Text style={styles.heroTitle}>{summary.venueName}</Text>
                                <Text style={styles.heroSubtitle}>{summary.ownerName}</Text>
                            </View>
                        </View>
                        <View style={styles.tagsRow}>
                            <StatusPill tone="neutral" label={summary.zoneType} />
                            <StatusPill tone={getZoneStatusTone(zone.status)} label={summary.status} />
                            <StatusPill tone="neutral" label={`${summary.branchCount} branches`} />
                        </View>
                    </View>

                    <View style={styles.coreGrid}>
                        <AdminMetricCard label="Queue" value={summary.pendingQueue} icon="pending-actions" style={styles.coreCard} />
                        <AdminMetricCard label="Live Rooms" value={summary.liveRooms} icon="sports-esports" style={styles.coreCard} />
                        <AdminMetricCard label="Utilization" value={`${summary.utilization}%`} icon="bolt" style={styles.coreCard} />
                        <AdminMetricCard label="Walk-ins" value={summary.walkins} icon="storefront" style={styles.coreCard} />
                    </View>

                    <View style={styles.section}>
                        <AdminSectionHeader title="Admin Modules" subtitle="Core flows" compact />
                        <View style={styles.moduleGrid}>
                            {dashboardModules.map((module, index) => {
                                const theme = MODULE_COLORS[index % MODULE_COLORS.length];
                                return (
                                    <AdminQuickActionCard
                                        key={module.id}
                                        title={module.title}
                                        description={module.description}
                                        icon={module.icon as any}
                                        badgeLabel={module.tag}
                                        iconColor={theme.iconColor}
                                        onPress={() => router.push(module.route as any)}
                                        cardStyle={[styles.moduleCard, theme.cardStyle]}
                                        iconStyle={theme.iconStyle}
                                    />
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <AdminSectionHeader
                            title="Upcoming Matchrooms"
                            subtitle={`${upcomingMatchrooms.length} in queue`}
                            compact
                        />
                        <View style={styles.matchroomsWrap}>
                            {upcomingMatchrooms.length === 0 ? (
                                <AdminEmptyStateCard
                                    title="No upcoming matchrooms"
                                    description="Zone-created and approved sessions will appear here."
                                    icon="sports-esports"
                                />
                            ) : (
                                upcomingMatchrooms.map((room) => (
                                    <MatchroomCard
                                        key={room.id}
                                        room={mapZoneRoomToMatchroom(
                                            room,
                                            zone.primaryBranch?.areaLabel || zone.venueBrandName || "Zone Venue",
                                        )}
                                    />
                                ))
                            )}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <AdminSectionHeader
                            title="Operations"
                            actionLabel="Detailed Analytics"
                            onAction={() => router.push("/zone/modules/insights" as any)}
                            compact
                        />
                        <View style={styles.opsGrid}>
                            {operationsCards.map((card) => (
                                <AdminQuickActionCard
                                    key={card.key}
                                    title={card.title}
                                    description={card.subtitle}
                                    icon={card.icon}
                                    badgeLabel={card.value}
                                    iconColor={COLORS.text}
                                    onPress={() => router.push("/zone/modules/insights" as any)}
                                    cardStyle={[styles.opsTile, card.cardStyle]}
                                    iconStyle={card.iconStyle}
                                />
                            ))}
                        </View>
                    </View>
                </ScrollView>
            </Animated.View>

            <SidebarMenu
                visible={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                items={sidebarItems}
            />
        </Screen>
    );
}
