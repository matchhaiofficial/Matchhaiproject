import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import AppHeader from "../../../src/components/AppHeader";
import { AdminEmptyStateCard, AdminSectionHeader } from "../../../src/components/AdminSurface";
import { AppIcon, type AppIconName } from "../../../src/components/AppIcon";
import { AppCard, StatusPill } from "../../../src/components/AppPrimitives";
import Screen from "../../../src/components/Screen";
import SidebarMenu from "../../../src/components/SidebarMenu";
import { useTabBarClearance } from "../../../src/hooks/useTabBarClearance";
import { useToast } from "../../../src/hooks/useToast";
import { useEntrance } from "../../../src/motion/useEntrance";
import {
  getDashboardSummary,
  getSuperAdminMatchrooms,
  getSuperAdminUnreadNotificationCount,
  getSupportTickets,
  SuperAdminMatchroom,
  SuperAdminSupportTicket,
  SuperAdminSummary,
} from "../../../src/services/convex/superAdminService";
import { signOutUser } from "../../../src/services/convex/authService";
import { COLORS, SPACING } from "../../../src/theme";
import styles from "./index.styles";

type MetricConfig = {
  label: string;
  value: string | number;
  detail: string;
  icon: AppIconName;
  tone: string;
};

function formatMoney(value?: number, currency = "PKR") {
  return `${currency} ${Math.round(Number(value || 0)).toLocaleString("en-US")}`;
}

function formatDateTime(room: SuperAdminMatchroom) {
  return [room.scheduledDate, room.scheduledTime].filter(Boolean).join(" ") || "Date/time TBD";
}

function lifecycleLabel(value: SuperAdminMatchroom["lifecycleStatus"]) {
  switch (value) {
    case "waiting_lobby_fill":
      return "Waiting lobby fill";
    case "waiting_zone_approval":
      return "Waiting zone approval";
    case "confirmed":
      return "Confirmed";
    case "in-progress":
      return "In-progress";
    case "completed":
      return "Completed";
    case "cancelled_expired":
      return "Cancelled / Expired";
    case "created_open":
    default:
      return "Created / Open";
  }
}

function lifecycleTone(value: SuperAdminMatchroom["lifecycleStatus"]) {
  if (value === "confirmed" || value === "completed") return "success" as const;
  if (value === "cancelled_expired") return "danger" as const;
  if (value === "in-progress") return "info" as const;
  return "warning" as const;
}

function SuperAdminMetricCard({ metric }: { metric: MetricConfig }) {
  return (
    <AppCard variant="elevated" style={styles.metricCard}>
      <View style={[styles.metricIconWrap, { backgroundColor: `${metric.tone}18`, borderColor: `${metric.tone}44` }]}>
        <AppIcon name={metric.icon} size={18} color={metric.tone} />
      </View>
      <View style={styles.metricTextWrap}>
        <Text style={styles.metricLabel}>{metric.label}</Text>
        <Text style={styles.metricDetail} numberOfLines={2}>{metric.detail}</Text>
      </View>
      <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
        {metric.value}
      </Text>
    </AppCard>
  );
}

function OperationTile({
  badgeLabel,
  icon,
  iconColor,
  onPress,
  title,
}: {
  badgeLabel?: string;
  icon: AppIconName;
  iconColor: string;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.operationTilePressable, pressed && styles.pressed]}>
      <AppCard variant="elevated" style={styles.operationTile}>
        <View style={[styles.operationIconWrap, { backgroundColor: `${iconColor}18`, borderColor: `${iconColor}44` }]}>
          <AppIcon name={icon} size={22} color={iconColor} />
        </View>
        {badgeLabel ? (
          <View style={styles.operationBadge}>
            <Text style={styles.operationBadgeText}>{badgeLabel}</Text>
          </View>
        ) : null}
        <Text style={styles.operationTitle} numberOfLines={2}>{title}</Text>
      </AppCard>
    </Pressable>
  );
}

function MatchroomPreviewCard({ room }: { room: SuperAdminMatchroom }) {
  return (
    <Pressable
      onPress={() => router.push(`/super-admin/matchroom/${room.id}` as any)}
      style={({ pressed }) => [styles.matchCardPressable, pressed && styles.pressed]}
    >
      <AppCard variant="soft" style={styles.matchCard}>
        <View style={styles.matchCardTop}>
          <View style={styles.matchTitleWrap}>
            <Text style={styles.matchGame}>{String(room.game || "Match").toUpperCase()}</Text>
            <Text style={styles.matchTitle} numberOfLines={1}>{room.title || "Untitled matchroom"}</Text>
          </View>
          <StatusPill tone={lifecycleTone(room.lifecycleStatus)} label={lifecycleLabel(room.lifecycleStatus)} />
        </View>
        <View style={styles.matchMetaRow}>
          <View style={styles.matchMetaItem}>
            <AppIcon name="schedule" size={13} color={COLORS.textSecondary} />
            <Text style={styles.matchMetaText} numberOfLines={1}>{formatDateTime(room)}</Text>
          </View>
          <View style={styles.matchMetaItem}>
            <AppIcon name="location-on" size={13} color={COLORS.textSecondary} />
            <Text style={styles.matchMetaText} numberOfLines={1}>{room.location || "Location TBD"}</Text>
          </View>
        </View>
        <View style={styles.matchFooterRow}>
          <Text style={styles.matchFooterText}>{room.currentPlayers || 0}/{room.maxPlayers || 0} players</Text>
          {room.paymentStatus ? <Text style={styles.matchFooterText}>Payment: {room.paymentStatus}</Text> : null}
        </View>
      </AppCard>
    </Pressable>
  );
}

export default function SuperAdminDashboardTab() {
  const { showToast } = useToast();
  const bottomContentPadding = useTabBarClearance(SPACING.lg);
  const { animatedStyle: entranceStyle } = useEntrance({ axis: "y", distance: 10, initialScale: 0.995 });
  const [summary, setSummary] = useState<SuperAdminSummary | null>(null);
  const [rooms, setRooms] = useState<SuperAdminMatchroom[]>([]);
  const [openTickets, setOpenTickets] = useState<SuperAdminSupportTicket[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigationGuardRef = useRef<{ route: string; at: number } | null>(null);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    try {
      const [summaryResult, roomsResult, ticketsResult, notificationCountResult] = await Promise.all([
        getDashboardSummary(),
        getSuperAdminMatchrooms(),
        getSupportTickets("open"),
        getSuperAdminUnreadNotificationCount(),
      ]);
      if (!summaryResult.ok) throw new Error(summaryResult.message);
      if (!roomsResult.ok) throw new Error(roomsResult.message);
      if (!ticketsResult.ok) throw new Error(ticketsResult.message);
      setSummary(summaryResult.data);
      setRooms(roomsResult.data);
      setOpenTickets(ticketsResult.data);
      setNotificationCount(notificationCountResult.ok ? notificationCountResult.data : 0);
    } catch (error: any) {
      showToast({ type: "error", title: "Dashboard failed", message: error?.message || "Unable to load dashboard." });
    } finally {
      if (mode === "initial") setLoading(false);
      else setRefreshing(false);
    }
  }, [showToast]);

  useFocusEffect(useCallback(() => {
    void load("initial");
  }, [load]));

  const upcomingRooms = useMemo(
    () => rooms
      .filter((room) => !["completed", "cancelled_expired"].includes(room.lifecycleStatus))
      .slice(0, 5),
    [rooms],
  );

  const metrics = useMemo<MetricConfig[]>(() => [
    {
      label: "Active users",
      value: summary?.users.active30d ?? 0,
      detail: summary?.users.activeSource === "totalUsersFallback" ? "Using total users until activity data is populated." : "Active in the last 30 days.",
      icon: "players",
      tone: COLORS.accent,
    },
    {
      label: "Active Zones",
      value: summary?.zones.active ?? 0,
      detail: "Approved zones currently active.",
      icon: "business",
      tone: COLORS.success,
    },
    {
      label: "Total Revenue",
      value: formatMoney(summary?.revenue?.total, summary?.revenue?.currency),
      detail: "Successful paid transactions only.",
      icon: "paymentWallet",
      tone: COLORS.warning,
    },
    {
      label: "Zones Pending",
      value: summary?.zones.pending ?? 0,
      detail: "Waiting for super-admin approval.",
      icon: "pending",
      tone: COLORS.error,
    },
  ], [summary]);

  const navigateTo = useCallback((route: string) => {
    const now = Date.now();
    const previous = navigationGuardRef.current;
    if (previous?.route === route && now - previous.at < 900) return;
    navigationGuardRef.current = { route, at: now };

    try {
      router.push(route as any);
    } catch (error: any) {
      showToast({
        type: "error",
        title: "Navigation failed",
        message: error?.message || "Unable to open that Super Admin screen.",
      });
    }
  }, [showToast]);

  const handleLogout = useCallback(() => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await signOutUser();
            router.replace("/auth/login");
          } catch (error: any) {
            showToast({
              type: "error",
              title: "Logout failed",
              message: error?.message || "Please try again.",
            });
          }
        },
      },
    ]);
  }, [showToast]);

  const sidebarItems = useMemo(() => [
    { label: "Dashboard", icon: "dashboard" as const, onPress: () => navigateTo("/super-admin") },
    { label: "Payments", icon: "paymentWallet" as const, onPress: () => navigateTo("/super-admin/payments") },
    { label: "Withdrawals", icon: "wallet" as const, onPress: () => navigateTo("/super-admin/withdrawals") },
    { label: "Reports", icon: "reports" as const, onPress: () => navigateTo("/super-admin/reports") },
    { label: "Matchrooms", icon: "matchroom" as const, onPress: () => navigateTo("/super-admin/matchrooms") },
    { label: "Support Tickets", icon: "support" as const, onPress: () => navigateTo("/super-admin/support-tickets") },
    { label: "Notifications", icon: "notifications" as const, onPress: () => navigateTo("/super-admin/notifications") },
    { label: "Users", icon: "players" as const, onPress: () => navigateTo("/super-admin/users") },
    { label: "Identity Verifications", icon: "verified-user" as const, onPress: () => navigateTo("/super-admin/identity-verifications") },
    { label: "Audit Logs", icon: "reports" as const, onPress: () => navigateTo("/super-admin/audit-logs") },
    { label: "Logout", icon: "logout" as const, onPress: handleLogout },
  ], [handleLogout, navigateTo]);

  return (
    <Screen style={styles.screen} contentStyle={styles.screenContent} scroll={false} edges={["top"]}>
      <AppHeader
        title="Super Admin"
        subtitle="Operations dashboard"
        inlineTitle
        style={styles.headerBar}
        leftAction={
          <Pressable style={styles.headerIconButton} onPress={() => setSidebarOpen(true)}>
            <AppIcon name="menu" size={24} color={COLORS.text} />
          </Pressable>
        }
        rightAction={
          <Pressable style={styles.headerIconButton} onPress={handleLogout}>
            <AppIcon name="logout" size={22} color={COLORS.error} />
          </Pressable>
        }
      />

      <SidebarMenu visible={sidebarOpen} onClose={() => setSidebarOpen(false)} items={sidebarItems} />

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : (
        <Animated.View style={[styles.contentWrap, entranceStyle]}>
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={[styles.container, { paddingBottom: bottomContentPadding }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} tintColor={COLORS.accent} />}
            showsVerticalScrollIndicator={false}
          >
            <AppCard style={styles.profileCard}>
              <View style={styles.profileAccentBar} />
              <View style={styles.profileTopRow}>
                <View style={styles.avatarContainer}>
                  <Text style={styles.avatarText}>SA</Text>
                  <View style={styles.onlineIndicator} />
                </View>
                <View style={styles.profileTextWrap}>
                  <Text style={styles.welcomeText}>Super Admin dashboard</Text>
                  <Text style={styles.username}>MatchHai operations</Text>
                  <Text style={styles.profileSubtitle}>Monitor matchrooms, payments, reports, and zone approvals.</Text>
                </View>
              </View>
              <View style={styles.tagsRow}>
                <StatusPill tone="info" label={`${summary?.counts.matchrooms || 0} matchrooms`} />
                <StatusPill tone="warning" label={`${summary?.reports.pending || 0} pending reports`} />
                <StatusPill tone="neutral" label={`${summary?.counts.teams || 0} teams`} />
              </View>
            </AppCard>

            <View style={styles.section}>
              <AdminSectionHeader title="Quick Actions" compact />
              <View style={styles.operationsGrid}>
                <OperationTile title="Payments" icon="paymentWallet" iconColor={COLORS.warning} onPress={() => navigateTo("/super-admin/payments")} />
                <OperationTile title="Withdrawals" icon="wallet" iconColor={COLORS.success} onPress={() => navigateTo("/super-admin/withdrawals")} />
                <OperationTile title="Reports" icon="reports" iconColor={COLORS.error} onPress={() => navigateTo("/super-admin/reports")} />
                <OperationTile title="Matchrooms" icon="matchroom" iconColor={COLORS.accent} onPress={() => navigateTo("/super-admin/matchrooms")} />
                <OperationTile title="Notifications" icon="notifications" badgeLabel={notificationCount ? String(notificationCount) : undefined} iconColor={COLORS.warning} onPress={() => navigateTo("/super-admin/notifications")} />
                <OperationTile title="Support" icon="support" badgeLabel={String(openTickets.length)} iconColor={COLORS.success} onPress={() => navigateTo("/super-admin/support-tickets")} />
                <OperationTile title="Users" icon="players" iconColor={COLORS.successBright} onPress={() => navigateTo("/super-admin/users")} />
                <OperationTile title="Identity" icon="verified-user" iconColor={COLORS.accent} onPress={() => navigateTo("/super-admin/identity-verifications")} />
                <OperationTile title="Audit Logs" icon="reports" iconColor={COLORS.textSecondary} onPress={() => navigateTo("/super-admin/audit-logs")} />
              </View>
            </View>

            <View style={styles.section}>
              <AdminSectionHeader title="At a Glance" compact />
            <View style={styles.snapshotPanel}>
              {metrics.map((metric) => (
                <SuperAdminMetricCard key={metric.label} metric={metric} />
              ))}
            </View>
            </View>

            <View style={styles.section}>
            <AdminSectionHeader
              title="Upcoming matches"
              actionLabel="View all"
              onAction={() => navigateTo("/super-admin/matchrooms")}
            />

            {upcomingRooms.length === 0 ? (
              <AdminEmptyStateCard title="No upcoming matchrooms" description="New or active matchrooms will appear here." icon="matchroom" />
            ) : (
              <View style={styles.matchList}>
                {upcomingRooms.map((room) => (
                  <MatchroomPreviewCard key={room.id} room={room} />
                ))}
              </View>
            )}
            </View>
          </ScrollView>
        </Animated.View>
      )}
    </Screen>
  );
}
