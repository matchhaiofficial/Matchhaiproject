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
import Animated from "react-native-reanimated";

import AppHeader from "../../../src/components/AppHeader";
import {
    AdminEmptyStateCard,
    AdminQuickActionCard,
    AdminSectionHeader,
} from "../../../src/components/AdminSurface";
import { AppIcon, type AppIconName } from "../../../src/components/AppIcon";
import { AppButton, StatusPill } from "../../../src/components/AppPrimitives";
import Screen from "../../../src/components/Screen";
import SidebarMenu from "../../../src/components/SidebarMenu";
import { useEntrance } from "../../../src/motion/useEntrance";
import { useToast } from "../../../src/hooks/useToast";
import { useTabBarClearance } from "../../../src/hooks/useTabBarClearance";
import MatchroomCard from "../../matchrooms/components/MatchroomCard";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useAuth } from "../../../src/context/AuthContext";
import { ZONE_ADMIN_MODULES } from "../../../src/features/zoneAdmin/modules";
import { isPendingZoneAdminNotification } from "../../../src/features/zoneAdmin/notificationFilters";
import { useRouteLogger } from "../../../src/hooks/useRouteLogger";
import { useZoneData } from "../../../src/hooks/useZoneData";
import { signOutUser } from "../../../src/services/authService";
import { useStartDiditKyc } from "../../../src/hooks/useDiditKyc";
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
import { isUserFullyVerified } from "../../../src/utils/verificationGate";
import styles from "./dashboard.styles";

const ZONE_KYC_VERIFICATION_MESSAGE = "Please complete CNIC & face verification to unlock MatchHai features.";

const MODULE_ICON_COLORS = [
    COLORS.accent,
    COLORS.successBright,
    COLORS.warning,
    COLORS.textSecondary,
];

const DASHBOARD_MODULE_IDS = new Set([
    "bookings_matchrooms",
    "resources",
    "pricing_promotions",
    "insights_security",
]);

const SIDEBAR_MODULE_IDS = new Set([
    "bookings_matchrooms",
    "resources",
    "pricing_promotions",
    "insights_security",
    "notifications_center",
]);

const subtleIconStyle = (color: string) => ({
    backgroundColor: `${color}12`,
    borderColor: `${color}38`,
});

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
    const { zone, loading } = useZoneData();
    const { user, authUser } = useAuth();
    const { showToast } = useToast();
    const startDiditKyc = useStartDiditKyc();
    const kycVerified = isUserFullyVerified(authUser, user);
    const bottomContentPadding = useTabBarClearance(16);

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

    const dashboardNotifications = useQuery(
        api.notifications.listForUser,
        user?._id ? { userId: user._id as Id<"users">, limit: 100 } : "skip",
    );
    const notificationCount = useMemo(
        () => (dashboardNotifications || []).filter(isPendingZoneAdminNotification).length,
        [dashboardNotifications],
    );

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
                (module) => DASHBOARD_MODULE_IDS.has(module.id),
            ),
        [],
    );

    const sidebarModules = useMemo(
        () =>
            ZONE_ADMIN_MODULES.filter(
                (module) => SIDEBAR_MODULE_IDS.has(module.id),
            ),
        [],
    );

    const snapshotMetrics = useMemo(
        () => [
            {
                key: "queue",
                label: "Queue",
                value: `${summary.pendingQueue}`,
                icon: "pending" as AppIconName,
                color: COLORS.warning,
            },
            {
                key: "live",
                label: "Live Rooms",
                value: `${summary.liveRooms}`,
                icon: "matchroom" as AppIconName,
                color: COLORS.accent,
            },
            {
                key: "utilization",
                label: "Utilization",
                value: `${summary.utilization}%`,
                icon: "status" as AppIconName,
                color: COLORS.successBright,
            },
            {
                key: "walkins",
                label: "Walk-ins",
                value: `${summary.walkins}`,
                icon: "business" as AppIconName,
                color: COLORS.textSecondary,
            },
        ],
        [summary.liveRooms, summary.pendingQueue, summary.utilization, summary.walkins],
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

    const handleStartVerification = async () => {
        const result = await startDiditKyc("zone_owner");
        showToast({
            type: result.ok ? "info" : "error",
            title: result.ok ? "Verification opened" : "Could not start verification",
            message: result.ok ? "Complete CNIC & face verification to unlock Zone Admin features." : result.message,
        });
    };

    const handleLockedAction = () => {
        showToast({
            type: "info",
            title: "Verify your identity",
            message: ZONE_KYC_VERIFICATION_MESSAGE,
        });
    };

    const sidebarItems = useMemo(
        () =>
            kycVerified
                ? [
                    { label: "Dashboard", icon: "dashboard" as const, onPress: () => router.push("/zone/(tabs)" as any) },
                    { label: "Branches", icon: "branch" as const, onPress: () => router.push("/zone/(tabs)/branches" as any) },
                    ...sidebarModules.map((module) => ({
                        label: module.title,
                        icon: module.icon,
                        onPress: () => router.push(module.route as any),
                    })),
                    { label: "Withdraw Request", icon: "wallet" as const, onPress: () => router.push({ pathname: "/zone/(tabs)/profile", params: { withdraw: "1" } } as any) },
                    { label: "Logout", icon: "logout" as const, onPress: handleLogout },
                ]
                : [
                    { label: "Dashboard", icon: "dashboard" as const, onPress: () => router.push("/zone/(tabs)" as any) },
                    { label: "Profile Settings", icon: "settings" as const, onPress: () => router.push("/zone/profile/edit" as any) },
                    { label: "Start Verification", icon: "status" as const, onPress: handleStartVerification },
                    { label: "Logout", icon: "logout" as const, onPress: handleLogout },
                ],
        [kycVerified, router, sidebarModules],
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
                onPress={kycVerified ? () => router.push("/zone/modules/notifications" as any) : handleLockedAction}
                style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
            >
                <AppIcon name="notifications" size="lg" />
                {notificationCount > 0 ? (
                    <View style={styles.notificationBadge}>
                        <Text style={styles.notificationBadgeText}>{notificationCount > 9 ? "9+" : notificationCount}</Text>
                    </View>
                ) : null}
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
                    contentInsetAdjustmentBehavior="automatic"
                    contentContainerStyle={[
                        styles.zoneAdmincontainer,
                        { paddingBottom: bottomContentPadding },
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    {!kycVerified ? (
                        <View style={styles.verificationBanner}>
                            <View style={styles.verificationBannerHeader}>
                                <AppIcon name="mailVerified" size={20} color={COLORS.warning} />
                                <Text style={styles.verificationBannerTitle}>Verify your identity</Text>
                            </View>
                            <Text style={styles.verificationBannerText}>
                                {ZONE_KYC_VERIFICATION_MESSAGE}
                            </Text>
                            <View style={styles.verificationBannerActions}>
                                <AppButton style={styles.verificationActionButton} onPress={handleStartVerification}>
                                    Start Verification
                                </AppButton>
                                <AppButton
                                    variant="secondary"
                                    style={styles.verificationActionButton}
                                    onPress={() => router.push("/zone/profile/edit" as any)}
                                >
                                    Profile Settings
                                </AppButton>
                            </View>
                        </View>
                    ) : null}

                    <View
                        style={!kycVerified ? styles.dashboardLocked : undefined}
                        pointerEvents={!kycVerified ? "none" : "auto"}
                    >
                        {!kycVerified ? (
                            <View style={styles.dashboardLockState}>
                                <AppIcon name="password" size={16} color={COLORS.textSecondary} />
                                <Text style={styles.dashboardLockStateText}>
                                    Zone Admin features locked until identity verification is complete
                                </Text>
                            </View>
                        ) : null}

                        <View style={styles.heroCard}>
                            <View style={styles.heroRow}>
                                <View style={styles.avatarIconWrap}>
                                    <AppIcon
                                        name={zone.type === "sports" ? "zone" : zone.type === "hybrid" ? "business" : "matchroom"}
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

                        <View style={styles.snapshotPanel}>
                            {snapshotMetrics.map((metric, index) => (
                                <View
                                    key={metric.key}
                                    style={[
                                        styles.snapshotItem,
                                        index % 2 === 0 && styles.snapshotItemLeft,
                                        index < 2 && styles.snapshotItemTop,
                                    ]}
                                >
                                    <View style={[styles.snapshotIconWrap, subtleIconStyle(metric.color)]}>
                                        <AppIcon name={metric.icon} size={16} color={metric.color} />
                                    </View>
                                    <View style={styles.snapshotTextWrap}>
                                        <Text style={styles.snapshotLabel}>{metric.label}</Text>
                                        <Text style={styles.snapshotValue}>{metric.value}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>

                        <View style={styles.section}>
                            <AdminSectionHeader title="Admin Modules" subtitle="Core flows" compact />
                            <View style={styles.moduleGrid}>
                                {dashboardModules.map((module, index) => {
                                    const iconColor = MODULE_ICON_COLORS[index % MODULE_ICON_COLORS.length];
                                    return (
                                        <AdminQuickActionCard
                                            key={module.id}
                                            title={module.title}
                                            description={module.description}
                                            icon={module.icon}
                                            badgeLabel={module.tag}
                                            iconColor={iconColor}
                                            onPress={() => router.push(module.route as any)}
                                            cardStyle={styles.moduleCard}
                                            iconStyle={subtleIconStyle(iconColor)}
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
                                        icon="matchroom"
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
