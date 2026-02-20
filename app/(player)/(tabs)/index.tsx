import { MaterialIcons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { router, useFocusEffect } from "expo-router";
import { fetchDocs, subscribeDocs } from "../../../src/services/firestoreService";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Image,
    Pressable,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppHeader from "../../../src/components/AppHeader";
import Screen from "../../../src/components/Screen";
import SidebarMenu from "../../../src/components/SidebarMenu";
import { useAuth } from "../../../src/context/AuthContext";
import { normalizeGameKey } from "../../../src/features/discover/utils/gameKeys";
import {
    getOffersForUser,
    getUserRequests,
} from "../../../src/services/bookingRequestService";
import { scheduleMatchroomReminder } from "../../../src/services/localNotifications";
import {
    Matchroom,
    getMatchrooms,
    getUserMatchrooms,
} from "../../../src/services/matchService";
import { Team, getUserTeams } from "../../../src/services/teamService";
import { UserProfile, getUserProfile } from "../../../src/services/userService";
import { Zone, getActiveZones } from "../../../src/services/zoneService";
import { COLORS } from "../../../src/theme";
import Logger from "../../../src/utils/logger";
import {
    isRoomExpired,
    isRoomLocked,
} from "../../../src/utils/matchroomLifecycle";
import { getRoomStartDate } from "../../../src/utils/timeFilters";
import MatchroomCard from "../../matchrooms/components/MatchroomCard";
import styles from "./_dashboard.styles";

type DashboardNotification = {
  id: string;
  message: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  createdAtMs: number;
  href?: string | null;
};

type DashboardRequestStats = {
  myRequests: number;
  myOffers: number;
};

type DashboardWalletStats = {
  totalSpent: number;
  pendingAmount: number;
  transactions: number;
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

const notificationIcon = (
  type?: string,
): keyof typeof MaterialIcons.glyphMap => {
  if (!type) return "notifications";
  if (type.includes("team")) return "groups";
  if (type.includes("friend")) return "person-add";
  if (type.includes("match")) return "sports-esports";
  if (type.includes("booking")) return "event";
  return "notifications";
};

const REASON_LABELS: Record<string, string> = {
  full_booked: "Venue is fully booked",
  fully_booked: "Venue is fully booked",
  team_full: "Team is full",
  room_full: "Room is full",
  room_locked: "Room is locked",
  room_expired: "Room has expired",
  slot_unavailable: "Selected slot is unavailable",
  time_conflict: "Schedule conflict",
};

const toTitleCase = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map(
      (token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase(),
    )
    .join(" ");

const normalizeReasonLabel = (reason?: string | null) => {
  const key = String(reason || "")
    .trim()
    .toLowerCase();
  if (!key) return "";
  if (REASON_LABELS[key]) return REASON_LABELS[key];
  return toTitleCase(key.replace(/[_-]+/g, " "));
};

const normalizeAlertMessage = (raw: any) => {
  const text = String(raw || "").trim();
  if (!text) return "New update";

  const reasonMatch = text.match(/reason:\s*([a-z0-9_-]+)/i);
  const altMatch = text.match(/alternative:\s*(.+)$/i);
  const reasonCode = (reasonMatch?.[1] || "").trim();
  const reasonLabel = normalizeReasonLabel(reasonCode);

  if (/^reason:/i.test(text)) {
    const alt = (altMatch?.[1] || "").trim();
    if (reasonLabel)
      return alt ? `${reasonLabel}. Alternative: ${alt}.` : `${reasonLabel}.`;
    return alt ? `Update received. Alternative: ${alt}.` : "Update received.";
  }

  if (reasonMatch) {
    const replaced = text.replace(
      /reason:\s*[a-z0-9_-]+/i,
      `Reason: ${reasonLabel || normalizeReasonLabel(reasonCode)}`,
    );
    return /[.!?]$/.test(replaced) ? replaced : `${replaced}.`;
  }

  return /[.!?]$/.test(text) ? text : `${text}.`;
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

const ZONE_GAME_TAGS: Array<{ key: keyof Zone["games"]; label: string }> = [
  { key: "supportsCs2", label: "CS2" },
  { key: "supportsFc25", label: "FC26" },
  { key: "supportsTekken8", label: "Tekken 8" },
  { key: "supportsFutsal", label: "Futsal" },
  { key: "supportsIndoorCricket", label: "Indoor Cricket" },
  { key: "supportsPadel", label: "Padel" },
  { key: "supportsPickleball", label: "Pickleball" },
];

const getZoneTypeLabel = (zoneType?: Zone["type"]) => {
  if (zoneType === "sports") return "Sports Venue";
  if (zoneType === "hybrid") return "Hybrid Venue";
  return "Gaming Venue";
};

const getZoneStatusLabel = (status?: Zone["status"]) => {
  if (!status) return "Active";
  if (status === "active") return "Active";
  return toTitleCase(status.replace(/[-_]+/g, " "));
};

const getZoneLocationLabel = (zone: Zone) => {
  const branch = (zone.primaryBranch?.branchDisplayName || "").trim();
  const area = (zone.primaryBranch?.areaLabel || "").trim();
  const city = (zone.primaryBranch?.city || "").trim();

  if (branch && area) return `${branch} · ${area}`;
  if (branch && city) return `${branch} · ${city}`;
  return branch || area || city || "Location available on open";
};

const getZoneGameLabels = (zone: Zone) =>
  ZONE_GAME_TAGS.filter((item) => zone.games?.[item.key]).map(
    (item) => item.label,
  );

const sumCountMap = (
  value?: Record<string, { count: number; price: number }>,
) =>
  value
    ? Object.values(value).reduce(
        (sum, item) => sum + (Number(item?.count) || 0),
        0,
      )
    : 0;

const getZoneCapacityLabel = (zone: Zone) => {
  const chunks: string[] = [];
  const pcSeats = Number(zone.capacity?.pcSeats || 0);
  const consoleSeats = Number(zone.capacity?.consoleSeats || 0);
  const consolePlatform = (zone.capacity?.consolePlatform || "").toLowerCase();
  const futsalCourts = sumCountMap(zone.pricing?.futsal);
  const indoorCricketNets = sumCountMap((zone.pricing as any)?.indoorCricket);
  const padelCourts = sumCountMap(zone.pricing?.padel);
  const pickleballCourts = sumCountMap(zone.pricing?.pickleball);

  if (pcSeats > 0) chunks.push(`${pcSeats} PCs`);
  if (consoleSeats > 0) {
    const label =
      consolePlatform === "ps5"
        ? "PS5"
        : consolePlatform === "xbox"
          ? "Xbox"
          : "Consoles";
    chunks.push(`${consoleSeats} ${label}`);
  }
  if (futsalCourts > 0) chunks.push(`${futsalCourts} Futsal courts`);
  if (indoorCricketNets > 0) chunks.push(`${indoorCricketNets} Cricket nets`);
  if (padelCourts > 0) chunks.push(`${padelCourts} Padel courts`);
  if (pickleballCourts > 0)
    chunks.push(`${pickleballCourts} Pickleball courts`);

  return chunks.length > 0
    ? chunks.slice(0, 2).join(" • ")
    : "Capacity on open";
};

const collectPositiveRates = (zone: Zone) => {
  const rates: number[] = [];
  const pushRate = (value?: number | null) => {
    const parsed = Number(value || 0);
    if (parsed > 0) rates.push(parsed);
  };

  pushRate(zone.effectiveRate);
  pushRate(zone.pricing?.pc?.regular?.price);
  pushRate(zone.pricing?.pc?.premium?.price);
  pushRate(zone.pricing?.pc?.elite?.price);
  pushRate(zone.pricing?.console?.ps5?.price1v1);
  pushRate(zone.pricing?.console?.ps5?.price2v2);
  pushRate(zone.pricing?.console?.xbox?.price1v1);
  pushRate(zone.pricing?.console?.xbox?.price2v2);

  [
    zone.pricing?.futsal,
    (zone.pricing as any)?.indoorCricket,
    zone.pricing?.padel,
    zone.pricing?.pickleball,
  ]
    .filter(Boolean)
    .forEach((bucket: any) => {
      Object.values(bucket || {}).forEach((entry: any) =>
        pushRate(entry?.price as number | undefined),
      );
    });

  return rates;
};

const getZoneRateLabel = (zone: Zone) => {
  const explicit = (zone.effectiveRateLabel || "").trim();
  if (explicit) {
    return explicit.toLowerCase().startsWith("from ")
      ? explicit
      : `From ${explicit}`;
  }

  const rates = collectPositiveRates(zone);
  if (!rates.length) return "Rate on open";
  return `From ${Math.min(...rates)} PKR/hr`;
};

const getTeamGameLabel = (game?: string) => {
  const normalized = String(game || "").trim().toLowerCase();
  if (!normalized) return "TEAM";
  const labels: Record<string, string> = {
    cs2: "CS2",
    fc26: "FC26",
    fc25: "FC",
    tekken8: "TEKKEN 8",
    futsal: "FUTSAL",
    indoor_cricket: "CRICKET",
    padel: "PADEL",
    pickleball: "PICKLEBALL",
  };
  return labels[normalized] || normalized.toUpperCase();
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
  const [latestNotifications, setLatestNotifications] = useState<
    DashboardNotification[]
  >([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [upcomingRooms, setUpcomingRooms] = useState<Matchroom[]>([]);
  const [recommendedRooms, setRecommendedRooms] = useState<Matchroom[]>([]);
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [nearbyZones, setNearbyZones] = useState<Zone[]>([]);
  const [requestStats, setRequestStats] = useState<DashboardRequestStats>({
    myRequests: 0,
    myOffers: 0,
  });
  const [friendCount, setFriendCount] = useState(0);
  const [walletStats, setWalletStats] = useState<DashboardWalletStats>({
    totalSpent: 0,
    pendingAmount: 0,
    transactions: 0,
  });
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
        intentsSnapshot,
        friendsSnapshot,
      ] = await Promise.all([
        getUserProfile(user.uid),
        getUserMatchrooms(user.uid),
        getMatchrooms(40),
        getUserTeams(user.uid),
        getActiveZones(),
        getUserRequests(user.uid),
        getOffersForUser(user.uid),
        fetchDocs({
          collectionPath: ["booking_intents"],
          where: [{ field: "createdByUid", op: "==", value: user.uid }],
        }),
        fetchDocs({
          collectionPath: ["users", user.uid, "friends"],
        }),
      ]);

      const profileData = profileResult.ok ? profileResult.data : null;
      setTags(gameTagsFromProfile(profileData));
      const preferredGames = preferredGameKeysFromProfile(profileData);
      let myRoomIds = new Set<string>();

      if (userRoomsResult.ok) {
        const allMyRooms = dedupeRooms([
          ...userRoomsResult.data.hosted,
          ...userRoomsResult.data.joined,
        ]);
        myRoomIds = new Set(
          allMyRooms.map((room) => room.id).filter(Boolean) as string[],
        );
        const now = Date.now();
        const upcoming = allMyRooms
          .filter((room) => {
            const start = getRoomStartDate(room);
            if (!start) return false;
            return (
              start.getTime() >= now - 15 * 60 * 1000 &&
              room.status !== "completed"
            );
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
            if (
              room.hostUid === user.uid ||
              room.playerUids?.includes(user.uid)
            )
              return false;
            if (!preferredGames.length) return true;
            const normalized = normalizeGameKey(room.game);
            return normalized ? preferredGames.includes(normalized) : true;
          })
          .slice(0, 4);
        setRecommendedRooms(recommended);
      } else {
        setRecommendedRooms([]);
      }

      setMyTeams(
        teamsResult.ok && teamsResult.data ? teamsResult.data.slice(0, 3) : [],
      );
      setNearbyZones(
        zonesResult.ok && zonesResult.data ? zonesResult.data.slice(0, 3) : [],
      );
      setRequestStats({
        myRequests:
          requestsResult.ok && requestsResult.data
            ? requestsResult.data.length
            : 0,
        myOffers:
          offersResult.ok && offersResult.data ? offersResult.data.length : 0,
      });
      const totals = intentsSnapshot.reduce(
        (acc: { totalSpent: number; pendingAmount: number }, docSnap: any) => {
          const data = docSnap.data || {};
          const total = Number(data?.pricing?.total || 0);
          if (total <= 0) return acc;
          if (data.paymentStatus === "paid") {
            acc.totalSpent += total;
          } else {
            acc.pendingAmount += total;
          }
          return acc;
        },
        { totalSpent: 0, pendingAmount: 0 },
      );
      setWalletStats({
        totalSpent: Math.round(totals.totalSpent),
        pendingAmount: Math.round(totals.pendingAmount),
        transactions: intentsSnapshot.length,
      });
      const friendUids = friendsSnapshot.map((docSnap: any) => docSnap.id);
      if (friendUids.length > 0) {
        const profileResults = await Promise.all(
          friendUids.map((friendUid: string) => getUserProfile(friendUid)),
        );
        const onlineFriends = profileResults.reduce(
          (count, result) =>
            count + (result.ok && result.data?.isOnline ? 1 : 0),
          0,
        );
        setFriendCount(onlineFriends);
      } else {
        setFriendCount(0);
      }
    } catch (error) {
      Logger.error("Dashboard", "Failed loading dashboard feed", error);
      setWalletStats({ totalSpent: 0, pendingAmount: 0, transactions: 0 });
      setFriendCount(0);
    }
  }, [user?.uid]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData]),
  );

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeDocs(
      {
        collectionPath: ["notifications"],
        where: [{ field: "toUid", op: "==", value: user.uid }],
      },
      (docs) => {
        const items: DashboardNotification[] = [];
        let count = 0;
        docs.forEach((docSnap: any) => {
          const data = docSnap.data;

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
      },
    );

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
      <View
        style={[
          styles.quickActionIconContainer,
          { backgroundColor: color + "15" },
        ]}
      >
        <MaterialIcons name={icon} size={28} color={color} />
      </View>
      <Text style={styles.quickActionText}>{label}</Text>
    </Pressable>
  );

  const NotificationCard = ({ icon, message, time, color, href }: any) => (
    <Pressable
      onPress={() => router.push((href || "/(player)/inbox") as any)}
      style={({ pressed }) => [
        styles.notificationCard,
        { borderLeftColor: color, borderLeftWidth: 3 },
        pressed && styles.notificationCardPressed,
      ]}
    >
      <View
        style={[
          styles.notificationIconBox,
          { backgroundColor: color + "10", borderColor: color + "30" },
        ]}
      >
        <MaterialIcons name={icon} size={20} color={color} />
      </View>
      <View style={styles.notificationContent}>
        <Text style={styles.notificationText} numberOfLines={2}>
          {message}
        </Text>
        <View style={styles.notificationMetaRow}>
          <Text style={styles.notificationTime}>{time}</Text>
          <View style={styles.notificationCta}>
            <Text style={styles.notificationCtaText}>View</Text>
            <MaterialIcons
              name="arrow-forward"
              size={14}
              color="#FFF"
            />
          </View>
        </View>
      </View>
    </Pressable>
  );

  const NearbyCard = ({
    typeLabel,
    statusLabel,
    title,
    location,
    gameLabels,
    capacityLabel,
    rateLabel,
    onPress,
  }: any) => (
    <Pressable
      style={({ pressed }) => [styles.nearbyCard, pressed && { opacity: 0.85 }]}
      onPress={onPress}
    >
      <View style={styles.nearbyMetaRow}>
        <Text style={styles.nearbyGame}>{typeLabel}</Text>
        <View style={styles.nearbyStatusTag}>
          <Text style={styles.nearbyStatusText}>{statusLabel}</Text>
        </View>
      </View>
      <View style={styles.nearbyTitleRow}>
        <Text style={styles.nearbyTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.bookSlotBtn}>
          <Text style={styles.bookSlotText}>View Venue</Text>
        </View>
      </View>
      <View style={styles.nearbyInfoRow}>
        <View style={styles.nearbyDistance}>
          <MaterialIcons
            name="location-on"
            size={12}
            color={COLORS.textSecondary}
          />
          <Text style={styles.nearbyDistanceText}>{location}</Text>
        </View>
      </View>
      <View style={styles.nearbyGamesRow}>
        {gameLabels.length > 0 ? (
          gameLabels.map((label: string) => (
            <View key={`${title}-${label}`} style={styles.nearbyGameChip}>
              <Text style={styles.nearbyGameChipText}>{label}</Text>
            </View>
          ))
        ) : (
          <View style={styles.nearbyGameChip}>
            <Text style={styles.nearbyGameChipText}>Games listed on open</Text>
          </View>
        )}
      </View>
      <View style={styles.nearbyBottomRow}>
        <Text style={styles.nearbyCapacityText} numberOfLines={1}>
          {capacityLabel}
        </Text>
        <View style={styles.priceTag}>
          <Text style={styles.priceTagText}>{rateLabel}</Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <Screen
      style={styles.screen}
      scroll={false}
      contentStyle={styles.screenContent}
      edges={["top"]}
    >
      <AppHeader
        title="Home"
        inlineTitle
        leftAction={
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setSidebarOpen(true)}
          >
            <MaterialIcons name="menu" size={24} color={COLORS.text} />
          </TouchableOpacity>
        }
        rightAction={
          <View style={styles.headerActionsRow}>
            <TouchableOpacity
              style={styles.friendBell}
              onPress={() => router.push("/(player)/friends" as any)}
            >
              <MaterialIcons name="groups-2" size={22} color={COLORS.text} />
              {friendCount > 0 && (
                <View style={styles.friendBadge}>
                  <Text style={styles.friendBadgeText}>
                    {friendCount > 9 ? "9+" : friendCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.notificationBell}
              onPress={() => router.push("/(player)/inbox")}
            >
              <MaterialIcons
                name="notifications-none"
                size={24}
                color={COLORS.text}
              />
              {notificationCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        }
      />

      <SidebarMenu
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        title="Quick Links"
        items={[
          {
            label: "Discover",
            icon: "explore",
            onPress: () => router.push("/(player)/(tabs)/discover"),
          },
          {
            label: "Matchrooms",
            icon: "sports-esports",
            onPress: () =>
              router.push({
                pathname: "/(player)/(tabs)/discover",
                params: { segment: "matchrooms", t: Date.now().toString() },
              } as any),
          },
          {
            label: "Players",
            icon: "people",
            onPress: () =>
              router.push({
                pathname: "/(player)/(tabs)/discover",
                params: { segment: "players", t: Date.now().toString() },
              } as any),
          },
          {
            label: "Zones",
            icon: "storefront",
            onPress: () =>
              router.push({
                pathname: "/(player)/(tabs)/discover",
                params: { segment: "zones", t: Date.now().toString() },
              } as any),
          },
          {
            label: "Schedule",
            icon: "event",
            onPress: () => router.push("/(player)/schedule" as any),
          },
          {
            label: "Wallet",
            icon: "account-balance-wallet",
            onPress: () => router.push("/(player)/wallet" as any),
          },
          {
            label: "My Friends",
            icon: "groups",
            onPress: () => router.push("/(player)/friends" as any),
          },
        ]}
      />

      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingBottom:
              process.env.EXPO_PUBLIC_HIDE_TAB_BAR === "1"
                ? insets.bottom + 16
                : 16,
          },
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
                <Text style={styles.username}>
                  {user?.displayName || "Guest"}
                </Text>
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
            <QuickAction
              icon="add-circle"
              label="Create Room"
              color={COLORS.accent}
              onPress={() => router.push("/matchrooms/create" as any)}
            />
            <QuickAction
              icon="event"
              label="My Schedule"
              color={COLORS.successBright}
              onPress={() => router.push("/(player)/schedule" as any)}
            />
            <QuickAction
              icon="search"
              label="Find Match"
              color={COLORS.warning}
              onPress={() =>
                router.push({
                  pathname: "/(player)/(tabs)/discover",
                  params: { segment: "matchrooms", t: Date.now().toString() },
                } as any)
              }
            />
            <QuickAction
              icon="inbox"
              label="Inbox"
              color="#26A69A"
              onPress={() => router.push("/(player)/inbox" as any)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
              Latest Alerts
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(player)/inbox" as any)}
            >
              <Text style={styles.seeAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          {latestNotifications.length > 0 ? (
            latestNotifications.map((item) => (
              <NotificationCard
                key={item.id}
                icon={item.icon}
                message={item.message}
                time={toRelativeTime(item.createdAtMs)}
                color={COLORS.accent}
                href={item.href}
              />
            ))
          ) : (
            <View style={styles.nearbyCard}>
              <Text style={styles.notificationTime}>
                No pending alerts right now.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Upcoming Matches</Text>
            <TouchableOpacity
              onPress={() => router.push("/(player)/schedule" as any)}
            >
              <Text style={styles.seeAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          {upcomingRooms.length > 0 ? (
            upcomingRooms.map((room) => (
              <MatchroomCard key={room.id} room={room} />
            ))
          ) : (
            <View style={styles.nearbyCard}>
              <Text style={styles.notificationText}>
                No upcoming matches found.
              </Text>
              <Text style={styles.notificationTime}>
                Create one from Discover or Quick Actions.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>For You</Text>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/(player)/(tabs)/discover",
                  params: { segment: "matchrooms", t: Date.now().toString() },
                } as any)
              }
            >
              <Text style={styles.seeAllText}>Browse</Text>
            </TouchableOpacity>
          </View>
          {recommendedRooms.length > 0 ? (
            recommendedRooms.map((room) => (
              <MatchroomCard key={room.id} room={room} />
            ))
          ) : (
            <View style={styles.nearbyCard}>
              <Text style={styles.notificationTime}>
                No recommendations available yet.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>My Teams</Text>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/(player)/(tabs)/discover",
                  params: {
                    segment: "teams",
                    mode: "my",
                    t: Date.now().toString(),
                  },
                } as any)
              }
            >
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          {myTeams.length > 0 ? (
            myTeams.map((team) => (
              (() => {
                const currentMembers =
                  team.memberUids?.length ?? team.memberCount ?? 0;
                const maxMembers = Math.max(1, Number(team.maxMembers || 1));
                const fillPercent = Math.min(
                  100,
                  Math.round((currentMembers / maxMembers) * 100),
                );
                const wins = Number(team.stats?.wins || 0);
                const losses = Number(team.stats?.losses || 0);
                const matchesPlayed = Number(team.stats?.matchesPlayed || 0);

                return (
                  <Pressable
                    key={team.id}
                    onPress={() => router.push(`/teams/${team.id}` as any)}
                    style={({ pressed }) => [
                      styles.teamCard,
                      pressed && styles.teamCardPressed,
                    ]}
                  >
                    <View style={styles.teamTopRow}>
                      <View style={styles.teamIdentityWrap}>
                        <View style={styles.teamAvatarWrap}>
                          <MaterialIcons
                            name="groups"
                            size={18}
                            color={COLORS.accent}
                          />
                        </View>
                        <View style={styles.teamTextWrap}>
                          <Text style={styles.teamName} numberOfLines={1}>
                            {team.name}
                          </Text>
                          <Text style={styles.teamSubtext} numberOfLines={1}>
                            {matchesPlayed} matches played
                          </Text>
                        </View>
                      </View>
                      <View style={styles.teamGamePill}>
                        <Text style={styles.teamGamePillText}>
                          {getTeamGameLabel(team.game)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.teamMembersRow}>
                      <Text style={styles.teamMembersText}>Team Capacity</Text>
                      <Text style={styles.teamMembersCount}>
                        {currentMembers}/{maxMembers}
                      </Text>
                    </View>
                    <View style={styles.teamProgressTrack}>
                      <View
                        style={[styles.teamProgressFill, { width: `${fillPercent}%` }]}
                      />
                    </View>

                    <View style={styles.teamBottomRow}>
                      <Text style={styles.teamStatsText}>
                        W {wins} · L {losses}
                      </Text>
                      <View style={styles.teamOpenPill}>
                        <Text style={styles.teamOpenPillText}>
                          {currentMembers < maxMembers ? "Open Slots" : "Full"}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })()
            ))
          ) : (
            <View style={styles.nearbyCard}>
              <Text style={styles.notificationTime}>
                You are not in any team yet.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Nearby Venues</Text>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/(player)/(tabs)/discover",
                  params: { segment: "zones", t: Date.now().toString() },
                } as any)
              }
            >
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          {nearbyZones.length > 0 ? (
            nearbyZones.map((zone) => (
              <NearbyCard
                key={zone.id}
                typeLabel={getZoneTypeLabel(zone.type)}
                statusLabel={getZoneStatusLabel(zone.status)}
                title={zone.venueBrandName}
                location={getZoneLocationLabel(zone)}
                gameLabels={getZoneGameLabels(zone)}
                capacityLabel={getZoneCapacityLabel(zone)}
                rateLabel={getZoneRateLabel(zone)}
                onPress={() => router.push(`/(player)/zones/${zone.id}` as any)}
              />
            ))
          ) : (
            <View style={styles.nearbyCard}>
              <Text style={styles.notificationTime}>
                No active venues found.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Wallet</Text>
            <TouchableOpacity
              onPress={() => router.push("/(player)/wallet" as any)}
            >
              <Text style={styles.seeAllText}>Open Wallet</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.walletCard}>
            <View style={styles.walletContent}>
              <Text style={styles.walletLabel}>Total Spent</Text>
              <Text style={styles.walletBalance}>
                Rs {walletStats.totalSpent}
              </Text>
              <Text style={styles.notificationTime}>
                Pending: Rs {walletStats.pendingAmount} • Transactions:{" "}
                {walletStats.transactions}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.walletIconContainer}
              onPress={() => router.push("/(player)/wallet" as any)}
            >
              <MaterialIcons
                name="chevron-right"
                size={24}
                color={COLORS.accent}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Requests & Offers</Text>
            <TouchableOpacity
              onPress={() => router.push("/(player)/inbox" as any)}
            >
              <Text style={styles.seeAllText}>Open Inbox</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.walletCard}>
            <View style={styles.walletContent}>
              <Text style={styles.walletLabel}>My Booking Requests</Text>
              <Text style={styles.walletBalance}>
                {requestStats.myRequests}
              </Text>
              <Text style={styles.notificationTime}>
                Offers received: {requestStats.myOffers}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.walletIconContainer}
              onPress={() => router.push("/(player)/inbox" as any)}
            >
              <MaterialIcons
                name="chevron-right"
                size={24}
                color={COLORS.accent}
              />
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

