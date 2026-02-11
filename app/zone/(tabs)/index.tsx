import { MaterialIcons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppHeader from "../../../src/components/AppHeader";
import Screen from "../../../src/components/Screen";
import SidebarMenu from "../../../src/components/SidebarMenu";
import MatchroomCard from "../../matchrooms/components/MatchroomCard";
import { db } from "../../../src/config/firebaseConfig";
import { useAuth } from "../../../src/context/AuthContext";
import { ZONE_ADMIN_MODULES } from "../../../src/features/zoneAdmin/modules";
import { useZoneData } from "../../../src/hooks/useZoneData";
import { signOutUser } from "../../../src/services/authService";
import {
    subscribeZoneBookingQueue,
    subscribeZoneMatchrooms,
    type ZoneBookingQueueItem,
    type ZoneMatchroomListItem,
} from "../../../src/services/zoneAdminBookingService";
import {
    subscribeBranchResources,
    subscribeZoneBranches,
    type ZoneBranch,
    type ZoneBranchResource,
} from "../../../src/services/zoneAdminResourceService";
import { type Matchroom } from "../../../src/services/matchService";
import { COLORS } from "../../../src/theme";
import styles from "./dashboard.styles";

const HIDE_ZONE_TAB_BAR = process.env.EXPO_PUBLIC_HIDE_TAB_BAR === "1";

const MODULE_COLORS = [
    { bg: "rgba(66,165,245,0.14)", border: "rgba(66,165,245,0.45)", icon: "#64B5F6" },
    { bg: "rgba(0,230,118,0.12)", border: "rgba(0,230,118,0.4)", icon: "#00E676" },
    { bg: "rgba(255,193,7,0.14)", border: "rgba(255,193,7,0.45)", icon: "#FFCA28" },
    { bg: "rgba(239,83,80,0.12)", border: "rgba(239,83,80,0.45)", icon: "#EF5350" },
    { bg: "rgba(171,71,188,0.15)", border: "rgba(171,71,188,0.45)", icon: "#BA68C8" },
    { bg: "rgba(38,198,218,0.14)", border: "rgba(38,198,218,0.45)", icon: "#4DD0E1" },
    { bg: "rgba(255,112,67,0.14)", border: "rgba(255,112,67,0.45)", icon: "#FF8A65" },
    { bg: "rgba(124,179,66,0.14)", border: "rgba(124,179,66,0.45)", icon: "#9CCC65" },
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
    const tabBarHeight = useBottomTabBarHeight();
    const { zone, loading } = useZoneData();
    const { user } = useAuth();

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [notificationCount, setNotificationCount] = useState(0);
    const [queue, setQueue] = useState<ZoneBookingQueueItem[]>([]);
    const [matchrooms, setMatchrooms] = useState<ZoneMatchroomListItem[]>([]);
    const [branches, setBranches] = useState<ZoneBranch[]>([]);
    const [resourcesByBranch, setResourcesByBranch] = useState<Record<string, ZoneBranchResource[]>>({});

    const entrance = useRef(new Animated.Value(0)).current;

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
        Animated.timing(entrance, {
            toValue: 1,
            duration: 360,
            useNativeDriver: true,
        }).start();
    }, [entrance]);

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
            user?.uid,
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
    }, [branchAreas, user?.uid, zone?.id, zone?.primaryBranch?.areaLabel, zone?.primaryBranch?.branchDisplayName, zone?.venueBrandName]);

    useEffect(() => {
        if (!user?.uid) return;
        const q = query(
            collection(db, "notifications"),
            where("toUid", "==", user.uid),
            where("status", "==", "pending"),
        );
        const unsub = onSnapshot(
            q,
            (snapshot: any) => setNotificationCount(snapshot.size || 0),
            () => setNotificationCount(0),
        );
        return () => unsub();
    }, [user?.uid]);

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
        const status = zone?.status === "active" ? "Active" : zone?.status === "rejected" ? "Rejected" : "Pending";
        const ownerName = zone?.ownerFullName || user?.displayName || "Zone Owner";
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
            utilization,
            liveRooms,
            pendingQueue,
            walkins,
            upcomingCount,
            maintenanceCount: allResources.filter((item) => item.lifecycleStatus === "maintenance").length,
        };
    }, [allResources, branches.length, matchrooms, queue, user?.displayName, zone]);

    const dashboardModules = useMemo(
        () =>
            ZONE_ADMIN_MODULES.filter(
                (module) =>
                    !["notifications_center", "support_safety", "audit_security", "venue_settings"].includes(module.id),
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
                tint: "rgba(255,193,7,0.16)",
                border: "rgba(255,193,7,0.4)",
            },
            {
                key: "ops_live",
                title: "Live Matchrooms",
                value: `${summary.liveRooms}`,
                subtitle: "Open or in-progress sessions",
                icon: "sports-esports" as const,
                tint: "rgba(66,165,245,0.16)",
                border: "rgba(66,165,245,0.4)",
            },
            {
                key: "ops_util",
                title: "Utilization",
                value: `${summary.utilization}%`,
                subtitle: "Held + booked resource load",
                icon: "bolt" as const,
                tint: "rgba(0,230,118,0.14)",
                border: "rgba(0,230,118,0.4)",
            },
            {
                key: "ops_maint",
                title: "Maintenance",
                value: `${summary.maintenanceCount}`,
                subtitle: "Resources under maintenance",
                icon: "build-circle" as const,
                tint: "rgba(239,83,80,0.14)",
                border: "rgba(239,83,80,0.42)",
            },
        ],
        [summary.liveRooms, summary.maintenanceCount, summary.pendingQueue, summary.utilization],
    );

    const handleLogout = async () => {
        const result = await signOutUser();
        if (!result.ok) {
            Alert.alert("Logout failed", result.message);
        }
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

    if (!zone || zone.status === "pending-review") {
        return (
            <Screen style={styles.screen} scroll={false} edges={['top']}>
                <AppHeader title="Zone Dashboard" />
                <View style={styles.noZoneContainer}>
                    <View style={styles.noZoneCard}>
                        <View style={styles.noZoneIconWrap}>
                            <MaterialIcons name="hourglass-empty" size={26} color={COLORS.accent} />
                        </View>
                        <Text style={styles.noZoneTitle}>Registration Pending</Text>
                        <Text style={styles.noZoneText}>
                            Your venue is under review. Admin modules unlock after approval.
                        </Text>
                    </View>
                </View>
            </Screen>
        );
    }

    if (zone.status === "rejected") {
        return (
            <Screen style={styles.screen} scroll={false} edges={['top']}>
                <AppHeader title="Zone Dashboard" />
                <View style={styles.noZoneContainer}>
                    <View style={styles.noZoneCard}>
                        <View style={[styles.noZoneIconWrap, styles.noZoneIconDanger]}>
                            <MaterialIcons name="report-gmailerrorred" size={26} color={COLORS.error} />
                        </View>
                        <Text style={styles.noZoneTitle}>Registration Rejected</Text>
                        <Text style={styles.noZoneText}>
                            Update your details and contact support before retrying.
                        </Text>
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
            <MaterialIcons name="menu" size={20} color={COLORS.text} />
        </Pressable>
    );

    const rightAction = (
        <Pressable
            onPress={() => router.push("/zone/modules/notifications" as any)}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
        >
            <MaterialIcons name="notifications-none" size={20} color={COLORS.text} />
            {notificationCount > 0 ? (
                <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>{notificationCount > 9 ? "9+" : notificationCount}</Text>
                </View>
            ) : null}
        </Pressable>
    );

    return (
        <Screen style={styles.screen} scroll={false} edges={['top']}>
            <AppHeader
                title="Dashboard"
                subtitle={zone.venueBrandName}
                leftAction={leftAction}
                rightAction={rightAction}
                inlineTitle
            />
            <Animated.View
                style={{
                    flex: 1,
                    opacity: entrance,
                    transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
                }}
            >
                <ScrollView
                    contentContainerStyle={[
                        styles.container,
                        { paddingBottom: HIDE_ZONE_TAB_BAR ? insets.bottom + 16 : tabBarHeight + 16 },
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.heroCard}>
                        <View style={styles.heroRow}>
                            <View style={styles.avatarIconWrap}>
                                <MaterialIcons
                                    name={zone.type === "sports" ? "sports-soccer" : zone.type === "hybrid" ? "sports" : "sports-esports"}
                                    size={24}
                                    color={COLORS.accent}
                                />
                            </View>
                            <View style={styles.heroTextWrap}>
                                <Text style={styles.heroEyebrow}>Zone Owner</Text>
                                <Text style={styles.heroTitle}>{summary.ownerName}</Text>
                                <Text style={styles.heroSubtitle}>{zone.venueBrandName}</Text>
                            </View>
                        </View>
                        <View style={styles.tagsRow}>
                            <View style={styles.tag}>
                                <Text style={styles.tagText}>{summary.zoneType}</Text>
                            </View>
                            <View style={[styles.tag, summary.status === "Active" ? styles.tagSuccess : styles.tagDanger]}>
                                <Text style={[styles.tagText, summary.status === "Active" ? styles.tagSuccessText : styles.tagDangerText]}>
                                    {summary.status}
                                </Text>
                            </View>
                            <View style={styles.tag}>
                                <Text style={styles.tagText}>{summary.branchCount} branches</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.coreGrid}>
                        <View style={styles.coreCard}>
                            <Text style={styles.coreValue}>{summary.pendingQueue}</Text>
                            <Text style={styles.coreLabel}>Queue</Text>
                        </View>
                        <View style={styles.coreCard}>
                            <Text style={styles.coreValue}>{summary.liveRooms}</Text>
                            <Text style={styles.coreLabel}>Live Rooms</Text>
                        </View>
                        <View style={styles.coreCard}>
                            <Text style={styles.coreValue}>{summary.utilization}%</Text>
                            <Text style={styles.coreLabel}>Utilization</Text>
                        </View>
                        <View style={styles.coreCard}>
                            <Text style={styles.coreValue}>{summary.walkins}</Text>
                            <Text style={styles.coreLabel}>Walk-ins</Text>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>Admin Modules</Text>
                            <Text style={styles.sectionMuted}>Core flows</Text>
                        </View>
                        <View style={styles.moduleGrid}>
                            {dashboardModules.map((module, index) => {
                                const theme = MODULE_COLORS[index % MODULE_COLORS.length];
                                return (
                                    <Pressable
                                        key={module.id}
                                        style={({ pressed }) => [
                                            styles.moduleCard,
                                            { backgroundColor: theme.bg, borderColor: theme.border },
                                            pressed && styles.moduleCardPressed,
                                        ]}
                                        onPress={() => router.push(module.route as any)}
                                    >
                                        <View style={styles.moduleTop}>
                                            <View style={[styles.moduleIconWrap, { borderColor: theme.border }]}>
                                                <MaterialIcons name={module.icon as any} size={20} color={theme.icon} />
                                            </View>
                                            {module.tag ? (
                                                <View style={styles.moduleTag}>
                                                    <Text style={styles.moduleTagText}>{module.tag}</Text>
                                                </View>
                                            ) : null}
                                        </View>
                                        <Text style={styles.moduleTitle}>{module.title}</Text>
                                        <Text style={styles.moduleDescription}>{module.description}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>Upcoming Matchrooms</Text>
                            <Text style={styles.sectionMuted}>{upcomingMatchrooms.length}</Text>
                        </View>
                        <View style={styles.matchroomsWrap}>
                            {upcomingMatchrooms.length === 0 ? (
                                <Text style={styles.emptyText}>No upcoming matchrooms yet.</Text>
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
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>Operations</Text>
                            <Pressable onPress={() => router.push("/zone/modules/insights" as any)}>
                                <Text style={styles.sectionLink}>Detailed Analytics</Text>
                            </Pressable>
                        </View>
                        <View style={styles.opsGrid}>
                            {operationsCards.map((card) => (
                                <Pressable
                                    key={card.key}
                                    style={({ pressed }) => [
                                        styles.opsTile,
                                        { backgroundColor: card.tint, borderColor: card.border },
                                        pressed && styles.moduleCardPressed,
                                    ]}
                                    onPress={() => router.push("/zone/modules/insights" as any)}
                                >
                                    <View style={styles.opsTileTop}>
                                        <MaterialIcons name={card.icon} size={18} color={COLORS.text} />
                                        <Text style={styles.opsTileValue}>{card.value}</Text>
                                    </View>
                                    <Text style={styles.opsTileTitle}>{card.title}</Text>
                                    <Text style={styles.opsTileSubtitle}>{card.subtitle}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                </ScrollView>
            </Animated.View>

            <SidebarMenu
                visible={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                items={sidebarItems}
                title="Zone Modules"
            />
        </Screen>
    );
}
