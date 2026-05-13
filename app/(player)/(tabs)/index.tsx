import { router, useFocusEffect } from "expo-router";
import { useQuery } from "convex/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import AppHeader from "../../../src/components/AppHeader";
import { AppIcon, type AppIconName } from "../../../src/components/AppIcon";
import { AppImage } from "../../../src/components/AppImage";
import { AppButton, AppCard, StatusPill } from "../../../src/components/AppPrimitives";
import { BlockingLoader } from "../../../src/components/BlockingLoader";
import Screen from "../../../src/components/Screen";
import SidebarMenu from "../../../src/components/SidebarMenu";
import { useAuth } from "../../../src/context/AuthContext";
import { useSessionRefreshPolling } from "../../../src/hooks/useSessionRefreshPolling";
import { useTabBarClearance } from "../../../src/hooks/useTabBarClearance";
import { useRouteLogger } from "../../../src/hooks/useRouteLogger";
import { useEntrance } from "../../../src/motion/useEntrance";
import { Matchroom } from "../../../src/services/convex/matchService";
import { Team } from "../../../src/services/convex/teamService";
import { formatSupportedGameLabels, Zone } from "../../../src/services/convex/zoneService";
import { signOutUser } from "../../../src/services/convex/authService";
import { COLORS, SPACING } from "../../../src/theme";
import {
  EMAIL_VERIFICATION_DASHBOARD_DETAIL_MESSAGE,
  hasVerifiedEmail,
  resendVerificationEmailWithAlert,
} from "../../../src/utils/emailVerificationGate";
import { isPhysicalGameDisabled } from "../../../constants/gameAvailability";
import { getCanonicalGameLabel } from "../../../src/utils/gameLabels";
import Logger from "../../../src/utils/logger";
import { recordCountMetric } from "../../../src/utils/perfInstrumentation";
import { getZoneStatusLabel } from "../../../src/utils/statusLabels";
import { getTeamMainDisplayRoster } from "../../../src/utils/teamRosterDisplay";
import DashboardAlertRow from "../components/dashboard/DashboardAlertRow";
import DashboardAtGlancePanel from "../components/dashboard/DashboardAtGlancePanel";
import DashboardQuickActionTile from "../components/dashboard/DashboardQuickActionTile";
import DashboardTeamCard from "../components/dashboard/DashboardTeamCard";
import DashboardVenueCard from "../components/dashboard/DashboardVenueCard";
import { PlayerEmptyStateCard, PlayerSectionHeader } from "../components/PlayerSurface";
import MatchroomCard from "../../matchrooms/components/MatchroomCard";
import styles from "./_dashboard.styles";

type DashboardNotification = {
  id: string;
  message: string;
  icon: AppIconName;
  createdAtMs: number;
  href?: string | null;
};

type ZoneGamesKeys =
  | "supportsCs2"
  | "supportsCs16"
  | "supportsValorant"
  | "supportsFc25"
  | "supportsTekken8";

const ZONE_GAME_TAGS: Array<{ key: ZoneGamesKeys; label: string }> = [
  { key: "supportsCs2", label: "CS2" },
  { key: "supportsCs16", label: "CS 1.6" },
  { key: "supportsValorant", label: "Valorant" },
  { key: "supportsFc25", label: "FC26" },
  { key: "supportsTekken8", label: "Tekken 8" },
  // Physical sports are temporarily disabled.
  // { key: "supportsFutsal", label: "Futsal" },
  // { key: "supportsIndoorCricket", label: "Indoor Cricket" },
  // { key: "supportsPadel", label: "Padel" },
  // { key: "supportsPickleball", label: "Pickleball" },
];

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

const notificationIcon = (type?: string): AppIconName => {
  if (!type) return "notifications";
  if (type.includes("team")) return "teams";
  if (type.includes("friend")) return "invite";
  if (type.includes("match")) return "matchroom";
  if (type.includes("booking")) return "bookings";
  return "notifications";
};

const toTitleCase = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");

const normalizeReasonLabel = (reason?: string | null) => {
  const key = String(reason || "").trim().toLowerCase();
  if (!key) return "";
  if (REASON_LABELS[key]) return REASON_LABELS[key];
  return toTitleCase(key.replace(/[_-]+/g, " "));
};

const normalizeAlertMessage = (raw: unknown) => {
  const text = String(raw || "").trim();
  if (!text) return "New update";

  const reasonMatch = text.match(/reason:\s*([a-z0-9_-]+)/i);
  const altMatch = text.match(/alternative:\s*(.+)$/i);
  const reasonCode = (reasonMatch?.[1] || "").trim();
  const reasonLabel = normalizeReasonLabel(reasonCode);

  if (/^reason:/i.test(text)) {
    const alt = (altMatch?.[1] || "").trim();
    if (reasonLabel) {
      return alt ? `${reasonLabel}. Alternative: ${alt}.` : `${reasonLabel}.`;
    }
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

const getZoneTypeLabel = (zoneType?: Zone["type"]) => {
  if (zoneType === "sports") return "Sports Venue";
  if (zoneType === "hybrid") return "Hybrid Venue";
  return "Gaming Venue";
};

const getZoneLocationLabel = (zone: Zone) => {
  const branch = (zone.primaryBranch?.branchDisplayName || "").trim();
  const area = (zone.primaryBranch?.areaLabel || "").trim();
  const city = (zone.primaryBranch?.city || "").trim();

  if (branch && area) return `${branch} | ${area}`;
  if (branch && city) return `${branch} | ${city}`;
  return branch || area || city || "Location available on open";
};

const getZoneGameLabels = (zone: Zone) =>
  formatSupportedGameLabels(zone.games).map((item) => item.label);

const getZonePricingSources = (zone: Zone) => [
  zone.pricing,
  ...(Array.isArray(zone.branches) ? zone.branches.map((branch: any) => branch?.pricing) : []),
].filter(Boolean);

const sumCountMap = (value?: Record<string, { count: number; price: number }>) =>
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
  const pricingSources = getZonePricingSources(zone);
  const branchPcSeats = pricingSources.reduce((sum, pricing: any) => {
    const pc = pricing?.pc || {};
    return sum
      + Number(pc?.regular?.count || 0)
      + Number(pc?.premium?.count || 0)
      + Number(pc?.elite?.count || 0);
  }, 0);
  const branchConsoleSeats = pricingSources.reduce((sum, pricing: any) => {
    const consolePricing = pricing?.console || {};
    return sum
      + Number(consolePricing?.regular?.count || 0)
      + Number(consolePricing?.premium?.count || 0)
      + Number(consolePricing?.elite?.count || 0)
      + Number(consolePricing?.ps5?.count || 0)
      + Number(consolePricing?.xbox?.count || 0);
  }, 0);
  // Physical sports are temporarily disabled.
  // const futsalCourts = sumCountMap(zone.pricing?.futsal);
  // const indoorCricketNets = sumCountMap((zone.pricing as any)?.indoorCricket);
  // const padelCourts = sumCountMap(zone.pricing?.padel);
  // const pickleballCourts = sumCountMap(zone.pricing?.pickleball);

  if (Math.max(pcSeats, branchPcSeats) > 0) chunks.push(`${Math.max(pcSeats, branchPcSeats)} PCs`);
  if (Math.max(consoleSeats, branchConsoleSeats) > 0) {
    const label =
      consolePlatform === "ps5"
        ? "PS5"
        : consolePlatform === "xbox"
          ? "Xbox"
          : "Consoles";
    chunks.push(`${Math.max(consoleSeats, branchConsoleSeats)} ${label}`);
  }
  // Physical sports are temporarily disabled.
  // if (futsalCourts > 0) chunks.push(`${futsalCourts} Futsal courts`);
  // if (indoorCricketNets > 0) chunks.push(`${indoorCricketNets} Cricket nets`);
  // if (padelCourts > 0) chunks.push(`${padelCourts} Padel courts`);
  // if (pickleballCourts > 0) chunks.push(`${pickleballCourts} Pickleball courts`);

  return chunks.length > 0 ? chunks.slice(0, 2).join(" | ") : "Capacity on open";
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
  getZonePricingSources(zone).forEach((pricing: any) => {
    pushRate(pricing?.pc?.regular?.price);
    pushRate(pricing?.pc?.premium?.price);
    pushRate(pricing?.pc?.elite?.price);
    pushRate(pricing?.console?.regular?.price1v1);
    pushRate(pricing?.console?.regular?.price2v2);
    pushRate(pricing?.console?.premium?.price1v1);
    pushRate(pricing?.console?.premium?.price2v2);
    pushRate(pricing?.console?.elite?.price1v1);
    pushRate(pricing?.console?.elite?.price2v2);
    pushRate(pricing?.console?.ps5?.price1v1);
    pushRate(pricing?.console?.ps5?.price2v2);
    pushRate(pricing?.console?.xbox?.price1v1);
    pushRate(pricing?.console?.xbox?.price2v2);
  });

  // Physical sports are temporarily disabled.
  // [zone.pricing?.futsal, (zone.pricing as any)?.indoorCricket, zone.pricing?.padel, zone.pricing?.pickleball]
  //   .filter(Boolean)
  //   .forEach((bucket: any) => {
  //     Object.values(bucket || {}).forEach((entry: any) =>
  //       pushRate(entry?.price as number | undefined),
  //     );
  //   });

  return rates;
};

const getZoneRateLabel = (zone: Zone) => {
  const explicit = (zone.effectiveRateLabel || "").trim();
  if (explicit) {
    return explicit.toLowerCase().startsWith("from ") ? explicit : `From ${explicit}`;
  }

  const rates = collectPositiveRates(zone);
  if (!rates.length) return "Rate on open";
  return `From ${Math.min(...rates)} PKR/hr`;
};

const getZoneStatusTone = (
  statusLabel?: string | null,
): "neutral" | "info" | "success" | "warning" | "danger" => {
  const status = String(statusLabel || "").toLowerCase();
  if (status.includes("active") || status.includes("approved")) return "success";
  if (status.includes("pending") || status.includes("review")) return "warning";
  if (status.includes("suspend") || status.includes("reject")) return "danger";
  return "info";
};

const getTeamGameLabel = (game?: string) => {
  const label = getCanonicalGameLabel(game);
  if (!game) return "TEAM";
  if (label === "Tekken 8") return "TEKKEN 8";
  if (label === "Indoor Cricket") return "CRICKET";
  return label.toUpperCase();
};

export default function PlayerDashboard() {
  useRouteLogger("PlayerDashboard");

  const { user, authUser, refreshSession } = useAuth();
  const bottomContentPadding = useTabBarClearance(SPACING.lg);
  const { animatedStyle: entranceStyle } = useEntrance({
    axis: "y",
    distance: 10,
    initialScale: 0.995,
  });

  const emailVerified = hasVerifiedEmail(authUser);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const didLogInitialQueryCountRef = useRef(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const dashboardSummary = useQuery(
    api.dashboard.getPlayerHomeSummary,
    user?._id ? { userId: user._id as Id<"users"> } : "skip",
  );

  const notificationCount =
    useQuery(
      api.notifications.countUnreadFast,
      user?._id ? { userId: user._id as Id<"users"> } : "skip",
    ) ?? 0;

  const pendingNotifications = useQuery(
    api.notifications.listInboxPage,
    user?._id
      ? { userId: user._id as Id<"users">, tab: "pending" as const, limit: 10 }
      : "skip",
  );

  const latestNotifications = useMemo<DashboardNotification[]>(
    () =>
      (pendingNotifications || [])
        .map((notification: any) => ({
          id: notification._id,
          message: normalizeAlertMessage(
            notification.body || notification.title || "New update",
          ),
          icon: notificationIcon(notification.type),
          createdAtMs: notification.createdAt || 0,
          href: notification.href || null,
        }))
        .sort((a, b) => b.createdAtMs - a.createdAtMs)
        .slice(0, 2),
    [pendingNotifications],
  );

  const tags = dashboardSummary?.tags || [];
  const upcomingRooms = ((dashboardSummary?.upcomingRooms || []) as Matchroom[])
    .filter((room) => !isPhysicalGameDisabled(room.game));
  const recommendedRooms = ((dashboardSummary?.recommendedRooms || []) as Matchroom[])
    .filter((room) => !isPhysicalGameDisabled(room.game));
  const myTeams = ((dashboardSummary?.myTeams || []) as Team[])
    .filter((team) => !isPhysicalGameDisabled(team.game));
  const nearbyZones = ((dashboardSummary?.nearbyZones || []) as Zone[])
    .filter((zone) => zone.type !== "sports" && getZoneGameLabels(zone).length > 0);
  const requestStats = dashboardSummary?.requestStats || { myRequests: 0, myOffers: 0 };
  const friendCount = dashboardSummary?.friendCount || 0;
  const walletStats = dashboardSummary?.walletStats || {
    balance: Number(user?.walletBalance || 0),
    totalSpent: 0,
    pendingAmount: 0,
    transactions: 0,
  };

  const teamCards = useMemo(
    () =>
      myTeams.map((team) => {
        const rosterDisplay = getTeamMainDisplayRoster(team);
        const currentMembers = rosterDisplay.currentMembers;
        const maxMembers = Math.max(1, rosterDisplay.maxMembers);

        return {
          team,
          currentMembers,
          maxMembers,
          fillPercent: rosterDisplay.fillPercent,
          wins: Number(team.stats?.wins || 0),
          losses: Number(team.stats?.losses || 0),
          matchesPlayed: Number(team.stats?.matchesPlayed || 0),
        };
      }),
    [myTeams],
  );

  useFocusEffect(
    useCallback(() => {
      void refreshSession();
    }, [refreshSession]),
  );

  useSessionRefreshPolling({
    enabled: Boolean(authUser?.id) && !emailVerified,
    refreshSession,
  });

  useEffect(() => {
    if (didLogInitialQueryCountRef.current || !dashboardSummary || !pendingNotifications) {
      return;
    }

    didLogInitialQueryCountRef.current = true;
    recordCountMetric("dashboard.initial_query_count", 3, {
      userId: user?._id,
    });
  }, [dashboardSummary, pendingNotifications, user?._id]);

  const handleLogout = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const result = await signOutUser();
      if (!result.ok) {
        Logger.error("Dashboard", "Logout failed", result.message);
        return;
      }
      router.replace("/auth/login");
    } finally {
      setLoggingOut(false);
    }
  }, [loggingOut]);

  const handleResendVerification = useCallback(async () => {
    await resendVerificationEmailWithAlert();
  }, []);

  return (
    <Screen
      style={styles.screen}
      scroll={false}
      contentStyle={styles.screenContent}
      edges={["top"]}
    >
      <BlockingLoader visible={loggingOut} label="Logging out..." />
      <AppHeader
        title="Home"
        inlineTitle
        style={styles.headerBar}
        leftAction={
          <Pressable style={styles.menuButton} onPress={() => setSidebarOpen(true)}>
            <AppIcon name="menu" size={24} color={COLORS.text} />
          </Pressable>
        }
        rightAction={
          <View style={styles.headerActionsRow}>
            <Pressable
              style={[
                styles.friendBell,
                !emailVerified && styles.headerActionDisabled,
              ]}
              onPress={emailVerified ? () => router.push("/(player)/friends" as any) : undefined}
              disabled={!emailVerified}
            >
              <AppIcon name="players" size={22} color={COLORS.text} />
              {friendCount > 0 ? (
                <View style={styles.friendBadge}>
                  <Text style={styles.friendBadgeText}>
                    {friendCount > 9 ? "9+" : friendCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              style={[
                styles.notificationBell,
                !emailVerified && styles.headerActionDisabled,
              ]}
              onPress={emailVerified ? () => router.push("/(player)/inbox") : undefined}
              disabled={!emailVerified}
            >
              <AppIcon name="notifications" size={24} color={COLORS.text} />
              {notificationCount > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable style={styles.notificationBell} onPress={handleLogout}>
              <AppIcon name="logout" size={22} color={COLORS.error} />
            </Pressable>
          </View>
        }
      />

      <SidebarMenu
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        items={
          emailVerified
            ? [
                {
                  label: "Discover",
                  icon: "discover" as const,
                  onPress: () => router.push("/(player)/(tabs)/discover"),
                },
                {
                  label: "Matchrooms",
                  icon: "matchroom" as const,
                  onPress: () =>
                    router.push({
                      pathname: "/(player)/(tabs)/discover",
                      params: { segment: "matchrooms", t: Date.now().toString() },
                    } as any),
                },
                {
                  label: "Players",
                  icon: "players" as const,
                  onPress: () =>
                    router.push({
                      pathname: "/(player)/(tabs)/discover",
                      params: { segment: "players", t: Date.now().toString() },
                    } as any),
                },
                {
                  label: "Zones",
                  icon: "business" as const,
                  onPress: () =>
                    router.push({
                      pathname: "/(player)/(tabs)/discover",
                      params: { segment: "zones", t: Date.now().toString() },
                    } as any),
                },
                {
                  label: "Schedule",
                  icon: "schedule" as const,
                  onPress: () => router.push("/(player)/schedule" as any),
                },
                {
                  label: "Wallet",
                  icon: "wallet" as const,
                  onPress: () => router.push("/(player)/wallet" as any),
                },
                {
                  label: "My Challenges",
                  icon: "challenge" as const,
                  onPress: () => router.push("/teams/challenges" as any),
                },
                {
                  label: "My Friends",
                  icon: "players" as const,
                  onPress: () => router.push("/(player)/friends" as any),
                },
                {
                  label: "My Reports",
                  icon: "reports" as const,
                  onPress: () => router.push("/(player)/reports" as any),
                },
              ]
            : [
                {
                  label: "Profile Settings",
                  icon: "settings" as const,
                  onPress: () => router.push("/profile/edit" as any),
                },
                {
                  label: "My Reports",
                  icon: "reports" as const,
                  onPress: () => router.push("/(player)/reports" as any),
                },
                {
                  label: "Logout",
                  icon: "logout" as const,
                  onPress: handleLogout,
                },
              ]
        }
      />

      <Animated.View style={[styles.contentWrap, entranceStyle]}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[
            styles.container,
            { paddingBottom: bottomContentPadding },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {!emailVerified ? (
            <AppCard style={styles.verificationBanner}>
              <View style={styles.verificationBannerHeader}>
                <AppIcon name="mailVerified" size={20} color={COLORS.warning} />
                <Text style={styles.verificationBannerTitle}>Verify your email</Text>
              </View>
              <Text style={styles.verificationBannerText}>
                {EMAIL_VERIFICATION_DASHBOARD_DETAIL_MESSAGE}
              </Text>
              <View style={styles.verificationBannerActions}>
                <AppButton
                  style={styles.verificationPrimaryButton}
                  onPress={handleResendVerification}
                >
                  Resend Email
                </AppButton>
                <AppButton
                  variant="secondary"
                  style={styles.verificationSecondaryButton}
                  onPress={() => router.push("/profile/edit" as any)}
                >
                  Profile Settings
                </AppButton>
              </View>
            </AppCard>
          ) : null}

          <View
            style={!emailVerified ? styles.dashboardLocked : undefined}
            pointerEvents={!emailVerified ? "none" : "auto"}
          >
            {!emailVerified ? (
              <View style={styles.dashboardLockState}>
                <AppIcon name="password" size={16} color={COLORS.textSecondary} />
                <Text style={styles.dashboardLockStateText}>
                  Dashboard locked until your email is verified
                </Text>
              </View>
            ) : null}

            <View style={styles.header}>
              <AppCard style={styles.profileCard}>
                <View style={styles.profileAccentBar} />
                <View style={styles.profileTopRow}>
                  <View style={styles.avatarContainer}>
                    <AppImage
                      source={{
                        uri:
                          user?.photoURL ||
                          `https://ui-avatars.com/api/?name=${
                            user?.fullName || "Player"
                          }&background=42a5f5&color=fff&size=112`,
                      }}
                      containerStyle={styles.avatar}
                    />
                    <View style={styles.onlineIndicator} />
                  </View>
                  <View style={styles.profileTextWrap}>
                    <Text style={styles.welcomeText}>Player dashboard</Text>
                    <Text style={styles.username}>{user?.fullName || "Guest"}</Text>
                  </View>
                </View>
                <View style={styles.tagsRow}>
                  {tags.map((tag, index) => (
                    <StatusPill
                      key={`${tag}-${index}`}
                      tone="neutral"
                      label={tag}
                      caps={false}
                      style={styles.tag}
                      textStyle={styles.tagText}
                    />
                  ))}
                </View>
              </AppCard>
            </View>

            <View style={styles.section}>
              <PlayerSectionHeader title="Quick Actions" />
              <View style={styles.quickActionsGrid}>
                <DashboardQuickActionTile
                  icon="add-circle"
                  label="Create Room"
                  color={COLORS.accent}
                  onPress={() => router.push("/matchrooms/create" as any)}
                />
                <DashboardQuickActionTile
                  icon="event"
                  label="My Schedule"
                  color={COLORS.successBright}
                  onPress={() => router.push("/(player)/schedule" as any)}
                />
                <DashboardQuickActionTile
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
                <DashboardQuickActionTile
                  icon="inbox"
                  label="Inbox"
                  color="#26A69A"
                  onPress={() => router.push("/(player)/inbox" as any)}
                />
              </View>
            </View>

            {/* <View style={styles.section}>
              <PlayerSectionHeader
                title="Latest Alerts"
                actionLabel="View All"
                onPress={() => router.push("/(player)/inbox" as any)}
              />
              {latestNotifications.length > 0 ? (
                <View style={styles.alertsSectionBody}>
                  {latestNotifications.map((item) => (
                    <DashboardAlertRow
                      key={item.id}
                      icon={item.icon}
                      message={item.message}
                      time={toRelativeTime(item.createdAtMs)}
                      color={COLORS.accent}
                      onPress={() => router.push((item.href || "/(player)/inbox") as any)}
                    />
                  ))}
                </View>
              ) : (
                <PlayerEmptyStateCard title="No pending alerts right now." />
              )}
            </View> */}

            <View style={styles.section}>
              <PlayerSectionHeader
                title="Upcoming Matches"
                actionLabel="View All"
                onPress={() => router.push("/(player)/schedule" as any)}
              />
              {upcomingRooms.length > 0 ? (
                upcomingRooms.map((room) => <MatchroomCard key={room.id} room={room} />)
              ) : (
                <PlayerEmptyStateCard
                  title="No upcoming matches found."
                  description="Create one from Discover or Quick Actions."
                />
              )}
            </View>

            <View style={styles.section}>
              <PlayerSectionHeader
                title="For You"
                actionLabel="Browse"
                onPress={() =>
                  router.push({
                    pathname: "/(player)/(tabs)/discover",
                    params: { segment: "matchrooms", t: Date.now().toString() },
                  } as any)
                }
              />
              {recommendedRooms.length > 0 ? (
                recommendedRooms.map((room) => <MatchroomCard key={room.id} room={room} />)
              ) : (
                <PlayerEmptyStateCard title="No recommendations available yet." />
              )}
            </View>

            <View style={styles.section}>
              <PlayerSectionHeader
                title="My Teams"
                actionLabel="See All"
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
              />
              {teamCards.length > 0 ? (
                teamCards.map(
                  ({
                    team,
                    currentMembers,
                    maxMembers,
                    fillPercent,
                    wins,
                    losses,
                    matchesPlayed,
                  }) => (
                    <DashboardTeamCard
                      key={team.id}
                      name={team.name}
                      gameLabel={getTeamGameLabel(team.game)}
                      matchesPlayed={matchesPlayed}
                      currentMembers={currentMembers}
                      maxMembers={maxMembers}
                      fillPercent={fillPercent}
                      wins={wins}
                      losses={losses}
                      onPress={() => router.push(`/teams/${team.id}` as any)}
                    />
                  ),
                )
              ) : (
                <PlayerEmptyStateCard title="You are not in any team yet." />
              )}
            </View>

            <View style={styles.section}>
              <PlayerSectionHeader
                title="Nearby Venues"
                actionLabel="See All"
                onPress={() =>
                  router.push({
                    pathname: "/(player)/(tabs)/discover",
                    params: { segment: "zones", t: Date.now().toString() },
                  } as any)
                }
              />
              {nearbyZones.length > 0 ? (
                nearbyZones.map((zone) => {
                  const statusLabel = getZoneStatusLabel(zone.status);

                  return (
                    <DashboardVenueCard
                      key={zone.id}
                      typeLabel={getZoneTypeLabel(zone.type)}
                      statusLabel={statusLabel}
                      statusTone={getZoneStatusTone(statusLabel)}
                      title={zone.venueBrandName}
                      location={getZoneLocationLabel(zone)}
                      gameLabels={getZoneGameLabels(zone)}
                      capacityLabel={getZoneCapacityLabel(zone)}
                      rateLabel={getZoneRateLabel(zone)}
                      onPress={() => router.push(`/(player)/zones/${zone.id}` as any)}
                    />
                  );
                })
              ) : (
                <PlayerEmptyStateCard title="No active venues found." />
              )}
            </View>

            <View style={styles.section}>
              <PlayerSectionHeader
                title="At a Glance"
                actionLabel="Open Wallet"
                onPress={() => router.push("/(player)/wallet" as any)}
              />
              <DashboardAtGlancePanel
                walletValue={`Rs ${Math.round(Number(walletStats.balance || 0))}`}
                walletDetail={`Pending Rs ${walletStats.pendingAmount} | ${walletStats.transactions} transactions`}
                walletOnPress={() => router.push("/(player)/wallet" as any)}
                requestsValue={String(requestStats.myRequests)}
                requestsDetail={`Offers received ${requestStats.myOffers}`}
                requestsOnPress={() => router.push("/(player)/inbox" as any)}
                upcomingCount={upcomingRooms.length}
                teamCount={myTeams.length}
                alertCount={notificationCount}
              />
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    </Screen>
  );
}
