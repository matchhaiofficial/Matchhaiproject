import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import {
  AdminEmptyStateCard,
  AdminMetricCard,
  AdminPageHeader,
  AdminQuickActionCard,
  AdminSectionHeader,
  AdminStatusBadge,
} from "../../../src/components/AdminSurface";
import { AppIcon, type AppIconName } from "../../../src/components/AppIcon";
import {
  AppDialog,
  AppModalBody,
  AppModalFooter,
  AppModalHeader,
} from "../../../src/components/AppModalPrimitives";
import { AppButton, AppCard } from "../../../src/components/AppPrimitives";
import Screen from "../../../src/components/Screen";
import SidebarMenu from "../../../src/components/SidebarMenu";
import { useTabBarClearance } from "../../../src/hooks/useTabBarClearance";
import { useToast } from "../../../src/hooks/useToast";
import { useEntrance } from "../../../src/motion/useEntrance";
import {
  getDashboardSummary,
  getSuperAdminMatchrooms,
  SuperAdminMatchroom,
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

function formatBadgeCount(value?: number, capped?: boolean) {
  const count = Number(value || 0);
  if (count <= 0) return undefined;
  return capped ? `${count}+` : String(count);
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
          <AdminStatusBadge tone={lifecycleTone(room.lifecycleStatus)} label={lifecycleLabel(room.lifecycleStatus)} />
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const navigationGuardRef = useRef<{ route: string; at: number } | null>(null);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    try {
      const [summaryResult, roomsResult] = await Promise.all([
        getDashboardSummary({ forceRefresh: true }),
        getSuperAdminMatchrooms(),
      ]);
      if (!summaryResult.ok) throw new Error(summaryResult.message);
      if (!roomsResult.ok) throw new Error(roomsResult.message);
      setSummary(summaryResult.data);
      setRooms(roomsResult.data);
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

  const badgeLabels = useMemo(() => ({
    zones: formatBadgeCount(summary?.badges?.pendingZones, summary?.badges?.pendingZonesCapped),
    reports: formatBadgeCount(summary?.badges?.pendingReports),
    withdrawals: formatBadgeCount(summary?.badges?.pendingWithdrawals, summary?.badges?.pendingWithdrawalsCapped),
  }), [summary]);

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
    setShowLogoutDialog(true);
  }, []);

  const confirmLogout = useCallback(async () => {
    setShowLogoutDialog(false);
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
  }, [showToast]);

  const sidebarItems = useMemo(() => [
    { label: "Dashboard", icon: "dashboard" as const, onPress: () => navigateTo("/super-admin") },
    { label: "Zones", icon: "business" as const, onPress: () => navigateTo("/super-admin/zones") },
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
      <AdminPageHeader
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

      <AppDialog visible={showLogoutDialog} onClose={() => setShowLogoutDialog(false)}>
        <AppModalHeader title="Logout" onClose={() => setShowLogoutDialog(false)} />
        <AppModalBody contentContainerStyle={{ gap: SPACING.md }}>
          <Text style={styles.profileSubtitle}>Are you sure you want to logout?</Text>
        </AppModalBody>
        <AppModalFooter>
          <View style={{ flexDirection: "row", gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md }}>
            <AppButton variant="secondary" style={{ flex: 1 }} onPress={() => setShowLogoutDialog(false)}>
              Cancel
            </AppButton>
            <AppButton variant="danger" style={{ flex: 1 }} onPress={confirmLogout}>
              Logout
            </AppButton>
          </View>
        </AppModalFooter>
      </AppDialog>

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
                <AdminStatusBadge tone="info" label={`${summary?.counts.matchrooms || 0} matchrooms`} />
                <AdminStatusBadge tone="warning" label={`${summary?.reports.pending || 0} pending reports`} />
                <AdminStatusBadge tone="neutral" label={`${summary?.counts.teams || 0} teams`} />
              </View>
            </AppCard>

            <View style={styles.section}>
              <AdminSectionHeader title="Quick Actions" actionLabel="More" onAction={() => setSidebarOpen(true)} compact />
              <View style={styles.operationsGrid}>
                <AdminQuickActionCard
                  title="Payments"
                  description="Review payment activity"
                  icon="paymentWallet"
                  iconColor={COLORS.warning}
                  cardStyle={styles.quickActionCard}
                  iconStyle={styles.quickActionPaymentsIcon}
                  onPress={() => navigateTo("/super-admin/payments")}
                />
                <AdminQuickActionCard
                  title="Withdrawals"
                  description="Process payout requests"
                  icon="wallet"
                  badgeLabel={badgeLabels.withdrawals}
                  iconColor={COLORS.success}
                  cardStyle={styles.quickActionCard}
                  iconStyle={styles.quickActionWithdrawalsIcon}
                  onPress={() => navigateTo("/super-admin/withdrawals")}
                />
                <AdminQuickActionCard
                  title="Reports"
                  description="Triage player reports"
                  icon="reports"
                  badgeLabel={badgeLabels.reports}
                  iconColor={COLORS.error}
                  cardStyle={styles.quickActionCard}
                  iconStyle={styles.quickActionReportsIcon}
                  onPress={() => navigateTo("/super-admin/reports")}
                />
                <AdminQuickActionCard
                  title="Zones"
                  description="Approve zone requests"
                  icon="business"
                  badgeLabel={badgeLabels.zones}
                  iconColor={COLORS.warning}
                  cardStyle={styles.quickActionCard}
                  iconStyle={styles.quickActionZonesIcon}
                  onPress={() => navigateTo("/super-admin/zones")}
                />
              </View>
            </View>

            <View style={styles.section}>
              <AdminSectionHeader title="At a Glance" compact />
              <View style={styles.snapshotPanel}>
                {metrics.map((metric) => (
                  <AdminMetricCard
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                    subtitle={metric.detail}
                    icon={metric.icon}
                    iconColor={metric.tone}
                    iconStyle={{ backgroundColor: `${metric.tone}18`, borderColor: `${metric.tone}44` }}
                    style={styles.metricCard}
                  />
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
