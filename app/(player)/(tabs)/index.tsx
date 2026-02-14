import { MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import MatchroomCard from "../../matchrooms/components/MatchroomCard";
import AppHeader from "../../../src/components/AppHeader";
import Screen from "../../../src/components/Screen";
import SidebarMenu from "../../../src/components/SidebarMenu";
import { db } from "../../../src/config/firebaseConfig";
import { useAuth } from "../../../src/context/AuthContext";
import { normalizeGameKey } from "../../../src/features/discover/utils/gameKeys";
import { getOffersForUser, getUserRequests } from "../../../src/services/bookingRequestService";
import { getMatchrooms, getUserMatchrooms, Matchroom } from "../../../src/services/matchService";
import { Team, getUserTeams } from "../../../src/services/teamService";
import { UserProfile, getUserProfile } from "../../../src/services/userService";
import { Zone, getActiveZones } from "../../../src/services/zoneService";
import { COLORS } from "../../../src/theme";
import { isRoomExpired, isRoomLocked } from "../../../src/utils/matchroomLifecycle";
import { getRoomStartDate } from "../../../src/utils/timeFilters";
import Logger from "../../../src/utils/logger";
import { scheduleMatchroomReminder } from "../../../src/services/localNotifications";
import styles from "./_dashboard.styles";

type DashboardNotification = {
    id: string;
    message: string;
    icon: keyof typeof MaterialIcons.glyphMap;
    createdAtMs: number;
};

type DashboardRequestStats = {
    myRequests: number;
    myOffers: number;
};

const getMillis = (value: any) => {
    if (!value) return 0;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    return 0;
};

const toRelativeTime = (ms: number) => {
    if (!ms) return "Just now";
    const diff = Date.now() - ms;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
};

const notificationIcon = (type?: string): keyof typeof MaterialIcons.glyphMap => {
    if (!type) return "notifications";
    if (type.includes("team")) return "groups";
    if (type.includes("friend")) return "person-add";
    if (type.includes("match")) return "sports-esports";
    if (type.includes("booking")) return "event";
    return "notifications";
};

const gameTagsFromProfile = (profile?: UserProfile | null) => {
    if (!profile) return [];
    const result: string[] = [];
    if (profile.playsCs2) result.push("CS2");
    if (profile.playsFc) result.push("FC26");
    if (profile.playsTekken) result.push("Tekken 8");
    if (profile.playsFutsal) result.push("Futsal");
    if (profile.playsIndoorCricket) result.push("Cricket");
    if (profile.playsPadel) result.push("Padel");
    if (profile.playsPickleball) result.push("Pickleball");
    return result;
};

const preferredGameKeysFromProfile = (profile?: UserProfile | null) => {
    if (!profile) return [];
    const games: string[] = [];
    if (profile.playsCs2) games.push("cs2");
    if (profile.playsFc) games.push("fc26");
    if (profile.playsTekken) games.push("tekken8");
    if (profile.playsFutsal) games.push("futsal");
    if (profile.playsIndoorCricket) games.push("indoor_cricket");
    if (profile.playsPadel) games.push("padel");
    if (profile.playsPickleball) games.push("pickleball");
    return games;
};

const dedupeRooms = (rooms: Matchroom[]) => {
    const byId = new Map<string, Matchroom>();
    rooms.forEach((room) => {
        if (room.id) byId.set(room.id, room);
    });
    return Array.from(byId.values());
};

export default function PlayerDashboard() {
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const tabBarHeight = useBottomTabBarHeight();
    const [tags, setTags] = useState<string[]>([]);
    const [notificationCount, setNotificationCount] = useState(0);
    const [latestNotifications, setLatestNotifications] = useState<DashboardNotification[]>([]);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [upcomingRooms, setUpcomingRooms] = useState<Matchroom[]>([]);
    const [recommendedRooms, setRecommendedRooms] = useState<Matchroom[]>([]);
    const [myTeams, setMyTeams] = useState<Team[]>([]);
    const [nearbyZones, setNearbyZones] = useState<Zone[]>([]);
    const [requestStats, setRequestStats] = useState<DashboardRequestStats>({ myRequests: 0, myOffers: 0 });
    const lastReminderSignatureRef = useRef("");

    const loadDashboardData = useCallback(async () => {
        if (!user?.uid) return;

        try {
            const [
                profileResult,
                userRoomsResult,
                allRoomsResult,
                teamsResult,
                zonesResult,
                requestsResult,
                offersResult,
            ] = await Promise.all([
                getUserProfile(user.uid),
                getUserMatchrooms(user.uid),
                getMatchrooms(40),
                getUserTeams(user.uid),
                getActiveZones(),
                getUserRequests(user.uid),
                getOffersForUser(user.uid),
            ]);

            const profileData = profileResult.ok ? profileResult.data : null;
            setTags(gameTagsFromProfile(profileData));
            const preferredGames = preferredGameKeysFromProfile(profileData);
            let myRoomIds = new Set<string>();

            if (userRoomsResult.ok) {
                const allMyRooms = dedupeRooms([...userRoomsResult.data.hosted, ...userRoomsResult.data.joined]);
                myRoomIds = new Set(allMyRooms.map((room) => room.id).filter(Boolean) as string[]);
                const now = Date.now();
                const upcoming = allMyRooms
                    .filter((room) => {
                        const start = getRoomStartDate(room);
                        if (!start) return false;
                        return start.getTime() >= now - 15 * 60 * 1000 && room.status !== "completed";
                    })
                    .sort((a, b) => {
                        const aStart = getRoomStartDate(a)?.getTime() || 0;
                        const bStart = getRoomStartDate(b)?.getTime() || 0;
                        return aStart - bStart;
                    })
                    .slice(0, 3);
                setUpcomingRooms(upcoming);
            } else {
                setUpcomingRooms([]);
            }

            if (allRoomsResult.ok) {
                const recommended = allRoomsResult.data
                    .filter((room) => !isRoomExpired(room) && !isRoomLocked(room))
                    .filter((room) => {
                        if (!room.id || myRoomIds.has(room.id)) return false;
                        if (room.hostUid === user.uid || room.playerUids?.includes(user.uid)) return false;
                        if (!preferredGames.length) return true;
                        const normalized = normalizeGameKey(room.game);
                        return normalized ? preferredGames.includes(normalized) : true;
                    })
                    .slice(0, 4);
                setRecommendedRooms(recommended);
            } else {
                setRecommendedRooms([]);
            }

            setMyTeams(teamsResult.ok && teamsResult.data ? teamsResult.data.slice(0, 3) : []);
            setNearbyZones(zonesResult.ok && zonesResult.data ? zonesResult.data.slice(0, 3) : []);
            setRequestStats({
                myRequests: requestsResult.ok && requestsResult.data ? requestsResult.data.length : 0,
                myOffers: offersResult.ok && offersResult.data ? offersResult.data.length : 0,
            });
        } catch (error) {
            Logger.error("Dashboard", "Failed loading dashboard feed", error);
        }
    }, [user?.uid]);

    useFocusEffect(useCallback(() => {
        loadDashboardData();
    }, [loadDashboardData]));

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, "notifications"),
            where("toUid", "==", user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot: any) => {
            const items: DashboardNotification[] = [];
            let count = 0;
            snapshot.forEach((docSnap: any) => {
                const data = docSnap.data();

                // Count unread notifications
                if (data.isRead === false) {
                    count += 1;
                }

                // Logic for showing latest notifications in the dashboard
                if (data.status !== "pending") return;
                if (data.expiresAt && getMillis(data.expiresAt) < Date.now()) {
                    return;
                }

                items.push({
                    id: docSnap.id,
                    message: data.message || data.title || "New update",
                    icon: notificationIcon(data.type),
                    createdAtMs: getMillis(data.createdAt),
                });
            });
            items.sort((a, b) => b.createdAtMs - a.createdAtMs);
            setNotificationCount(count);
            setLatestNotifications(items.slice(0, 2));
        });

        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        if (!user?.uid) {
            lastReminderSignatureRef.current = "";
            return;
        }
        if (!upcomingRooms.length) {
            lastReminderSignatureRef.current = "";
            return;
        }

        const next = upcomingRooms[0];
        if (!next?.id) return;
        const startAt = getRoomStartDate(next);
        if (!startAt) return;
        const signature = `${next.id}:${startAt.getTime()}:15`;
        if (lastReminderSignatureRef.current === signature) return;
        lastReminderSignatureRef.current = signature;

        scheduleMatchroomReminder({
            roomId: next.id,
            title: next.title || "Matchroom reminder",
            startAt,
            minutesBefore: 15,
            href: `/matchrooms/${next.id}`,
        }).catch(() => null);
    }, [upcomingRooms, user?.uid]);

    const QuickAction = ({ icon, label, onPress, color, shadowColor }: any) => (
        <Pressable
            style={({ pressed }) => [
                styles.quickActionBtn,
                { borderColor: color + "40", shadowColor: shadowColor || color },
                pressed && { opacity: 0.82 },
            ]}
            onPress={onPress}
        >
            <View style={[styles.quickActionIconContainer, { backgroundColor: color + "15" }]}>
                <MaterialIcons name={icon} size={28} color={color} />
            </View>
            <Text style={styles.quickActionText}>{label}</Text>
        </Pressable>
    );

    const NotificationCard = ({ icon, message, time, color }: any) => (
        <View style={[styles.notificationCard, { borderLeftColor: color, borderLeftWidth: 3 }]}>
            <View style={[styles.notificationIconBox, { backgroundColor: color + "10", borderColor: color + "30" }]}>
                <MaterialIcons name={icon} size={20} color={color} />
            </View>
            <View style={styles.notificationContent}>
                <Text style={styles.notificationText} numberOfLines={2}>
                    {message}
                </Text>
                <Text style={styles.notificationTime}>{time}</Text>
            </View>
        </View>
    );

    const NearbyCard = ({ game, title, location, rateLabel, onPress }: any) => (
        <Pressable
            style={({ pressed }) => [styles.nearbyCard, pressed && { opacity: 0.85 }]}
            onPress={onPress}
        >
            <Text style={styles.nearbyGame}>{game}</Text>
            <View style={styles.nearbyTitleRow}>
                <Text style={styles.nearbyTitle} numberOfLines={1}>{title}</Text>
                <View style={styles.bookSlotBtn}>
                    <Text style={styles.bookSlotText}>Open</Text>
                </View>
            </View>
            <View style={styles.nearbyInfoRow}>
                <View style={styles.nearbyDistance}>
                    <MaterialIcons name="location-on" size={12} color={COLORS.textSecondary} />
                    <Text style={styles.nearbyDistanceText}>{location}</Text>
                </View>
            </View>
            <View style={styles.nearbyBottomRow}>
                <View style={styles.roleRow}>
                    <View style={styles.roleTag}>
                        <Text style={styles.roleText}>ACTIVE</Text>
                    </View>
                </View>
                <View style={styles.priceTag}>
                    <Text style={styles.priceTagText}>{rateLabel}</Text>
                </View>
            </View>
        </Pressable>
    );

    return (
        <Screen style={styles.screen} scroll={false} contentStyle={styles.screenContent} edges={['top']}>
            <AppHeader
                title="Home"
                inlineTitle
                leftAction={(
                    <TouchableOpacity style={styles.menuButton} onPress={() => setSidebarOpen(true)}>
                        <MaterialIcons name="menu" size={24} color={COLORS.text} />
                    </TouchableOpacity>
                )}
                rightAction={(
                    <TouchableOpacity style={styles.notificationBell} onPress={() => router.push("/(player)/inbox")}>
                        <MaterialIcons name="notifications-none" size={24} color={COLORS.text} />
                        {notificationCount > 0 && (
                            <View style={styles.notificationBadge}>
                                <Text style={styles.notificationBadgeText}>
                                    {notificationCount > 9 ? "9+" : notificationCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                )}
            />

            <SidebarMenu
                visible={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                title="Quick Links"
                items={[
                    { label: "Discover", icon: "explore", onPress: () => router.push("/(player)/(tabs)/discover") },
                    { label: "Matchrooms", icon: "sports-esports", onPress: () => router.push({ pathname: "/(player)/(tabs)/discover", params: { segment: "matchrooms", t: Date.now().toString() } } as any) },
                    { label: "Players", icon: "people", onPress: () => router.push({ pathname: "/(player)/(tabs)/discover", params: { segment: "players", t: Date.now().toString() } } as any) },
                    { label: "Zones", icon: "storefront", onPress: () => router.push({ pathname: "/(player)/(tabs)/discover", params: { segment: "zones", t: Date.now().toString() } } as any) },
                    { label: "Schedule", icon: "event", onPress: () => router.push("/(player)/schedule" as any) },
                ]}
            />

            <ScrollView
                contentContainerStyle={[
                    styles.container,
                    { paddingBottom: (process.env.EXPO_PUBLIC_HIDE_TAB_BAR === '1') ? (insets.bottom + 16) : 16 },
                ]}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <View style={styles.profileCard}>
                        <View style={styles.profileTopRow}>
                            <View style={styles.avatarContainer}>
                                <Image
                                    source={{
                                        uri:
                                            user?.photoURL ||
                                            `https://ui-avatars.com/api/?name=${user?.displayName || "Player"}&background=42a5f5&color=fff&size=112`,
                                    }}
                                    style={styles.avatar}
                                />
                                <View style={styles.onlineIndicator} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.welcomeText}>PLAYER DASHBOARD</Text>
                                <Text style={styles.username}>{user?.displayName || "Guest"}</Text>
                            </View>
                        </View>
                        <View style={styles.tagsRow}>
                            {tags.length > 0
                                ? tags.map((tag, index) => (
                                    <View key={index} style={styles.tag}>
                                        <Text style={styles.tagText}>{tag}</Text>
                                    </View>
                                ))
                                : null}
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                    <View style={styles.quickActionsGrid}>
                        <QuickAction icon="add-circle" label="Create Room" color={COLORS.accent} onPress={() => router.push("/matchrooms/create" as any)} />
                        <QuickAction icon="event" label="My Schedule" color={COLORS.successBright} onPress={() => router.push("/(player)/schedule" as any)} />
                        <QuickAction icon="search" label="Find Match" color={COLORS.warning} onPress={() => router.push({ pathname: "/(player)/(tabs)/discover", params: { segment: "matchrooms", t: Date.now().toString() } } as any)} />
                        <QuickAction icon="inbox" label="Inbox" color="#26A69A" onPress={() => router.push("/(player)/inbox" as any)} />
                    </View>
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Latest Alerts</Text>
                    </View>
                    {latestNotifications.length > 0 ? latestNotifications.map((item) => (
                        <NotificationCard
                            key={item.id}
                            icon={item.icon}
                            message={item.message}
                            time={toRelativeTime(item.createdAtMs)}
                            color={COLORS.accent}
                        />
                    )) : (
                        <View style={styles.nearbyCard}>
                            <Text style={styles.notificationTime}>No pending alerts right now.</Text>
                        </View>
                    )}
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Upcoming Matches</Text>
                        <TouchableOpacity onPress={() => router.push("/(player)/schedule" as any)}>
                            <Text style={styles.seeAllText}>View All</Text>
                        </TouchableOpacity>
                    </View>
                    {upcomingRooms.length > 0 ? upcomingRooms.map((room) => (
                        <MatchroomCard key={room.id} room={room} />
                    )) : (
                        <View style={styles.nearbyCard}>
                            <Text style={styles.notificationText}>No upcoming matches found.</Text>
                            <Text style={styles.notificationTime}>Create one from Discover or Quick Actions.</Text>
                        </View>
                    )}
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Recommended Matchrooms</Text>
                        <TouchableOpacity onPress={() => router.push({ pathname: "/(player)/(tabs)/discover", params: { segment: "matchrooms", t: Date.now().toString() } } as any)}>
                            <Text style={styles.seeAllText}>Browse</Text>
                        </TouchableOpacity>
                    </View>
                    {recommendedRooms.length > 0 ? recommendedRooms.map((room) => (
                        <MatchroomCard key={room.id} room={room} />
                    )) : (
                        <View style={styles.nearbyCard}>
                            <Text style={styles.notificationTime}>No recommendations available yet.</Text>
                        </View>
                    )}
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>My Teams</Text>
                        <TouchableOpacity onPress={() => router.push({ pathname: "/(player)/(tabs)/discover", params: { segment: "teams", mode: "my", t: Date.now().toString() } } as any)}>
                            <Text style={styles.seeAllText}>See All</Text>
                        </TouchableOpacity>
                    </View>
                    {myTeams.length > 0 ? myTeams.map((team) => (
                        <Pressable
                            key={team.id}
                            onPress={() => router.push(`/teams/${team.id}` as any)}
                            style={({ pressed }) => [styles.nearbyCard, pressed && { opacity: 0.85 }]}
                        >
                            <View style={styles.nearbyTitleRow}>
                                <Text style={styles.nearbyTitle} numberOfLines={1}>{team.name}</Text>
                                <View style={styles.priceTag}>
                                    <Text style={styles.priceTagText}>{(team.game || "").toUpperCase()}</Text>
                                </View>
                            </View>
                            <Text style={styles.notificationTime}>
                                {(team.memberUids?.length ?? team.memberCount ?? 0)}/{team.maxMembers} members
                            </Text>
                        </Pressable>
                    )) : (
                        <View style={styles.nearbyCard}>
                            <Text style={styles.notificationTime}>You are not in any team yet.</Text>
                        </View>
                    )}
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Nearby Venues</Text>
                        <TouchableOpacity onPress={() => router.push({ pathname: "/(player)/(tabs)/discover", params: { segment: "zones", t: Date.now().toString() } } as any)}>
                            <Text style={styles.seeAllText}>See All</Text>
                        </TouchableOpacity>
                    </View>
                    {nearbyZones.length > 0 ? nearbyZones.map((zone) => (
                        <NearbyCard
                            key={zone.id}
                            game={zone.type === "sports" ? "Sports Court" : zone.type === "hybrid" ? "Hybrid Venue" : "Gaming Zone"}
                            title={zone.venueBrandName}
                            location={zone.primaryBranch?.areaLabel || zone.primaryBranch?.city || "Karachi"}
                            rateLabel={zone.effectiveRateLabel || "Starting rate"}
                            onPress={() => router.push(`/(player)/zones/${zone.id}` as any)}
                        />
                    )) : (
                        <View style={styles.nearbyCard}>
                            <Text style={styles.notificationTime}>No active venues found.</Text>
                        </View>
                    )}
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Requests & Offers</Text>
                        <TouchableOpacity onPress={() => router.push("/(player)/inbox" as any)}>
                            <Text style={styles.seeAllText}>Open Inbox</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.walletCard}>
                        <View style={styles.walletContent}>
                            <Text style={styles.walletLabel}>My Booking Requests</Text>
                            <Text style={styles.walletBalance}>{requestStats.myRequests}</Text>
                            <Text style={styles.notificationTime}>Offers received: {requestStats.myOffers}</Text>
                        </View>
                        <TouchableOpacity style={styles.walletIconContainer} onPress={() => router.push("/(player)/inbox" as any)}>
                            <MaterialIcons name="chevron-right" size={24} color={COLORS.accent} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Snapshot</Text>
                    </View>
                    <View style={styles.statsRow}>
                        <View style={styles.statCard}>
                            <Text style={styles.statValue}>{upcomingRooms.length}</Text>
                            <Text style={styles.statLabel}>Upcoming</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={styles.statValue}>{myTeams.length}</Text>
                            <Text style={styles.statLabel}>Teams</Text>
                        </View>
                        <View style={[styles.statCard, { marginRight: 0 }]}>
                            <Text style={styles.statValue}>{notificationCount}</Text>
                            <Text style={styles.statLabel}>Alerts</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </Screen>
    );
}
