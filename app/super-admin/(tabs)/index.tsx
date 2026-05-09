import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import AppHeader from "../../../src/components/AppHeader";
import { AppIcon, type AppIconName } from "../../../src/components/AppIcon";
import { AppButton, AppCard, StatusPill } from "../../../src/components/AppPrimitives";
import Screen from "../../../src/components/Screen";
import { useTabBarClearance } from "../../../src/hooks/useTabBarClearance";
import { useToast } from "../../../src/hooks/useToast";
import { useEntrance } from "../../../src/motion/useEntrance";
import {
  getDashboardSummary,
  getSuperAdminMatchrooms,
  getSupportTickets,
  SuperAdminMatchroom,
  SuperAdminSupportTicket,
  SuperAdminSummary,
} from "../../../src/services/convex/superAdminService";
import { COLORS, SPACING } from "../../../src/theme";
import { PlayerEmptyStateCard, PlayerSectionHeader } from "../../(player)/components/PlayerSurface";
import DashboardQuickActionTile from "../../(player)/components/dashboard/DashboardQuickActionTile";
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
    <AppCard variant="soft" style={styles.metricCard}>
      <View style={styles.metricTopRow}>
        <View style={[styles.metricIconWrap, { backgroundColor: `${metric.tone}18`, borderColor: `${metric.tone}44` }]}>
          <AppIcon name={metric.icon} size={18} color={metric.tone} />
        </View>
        <Text style={styles.metricValue}>{metric.value}</Text>
      </View>
      <Text style={styles.metricLabel}>{metric.label}</Text>
      <Text style={styles.metricDetail} numberOfLines={2}>{metric.detail}</Text>
    </AppCard>
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    try {
      const [summaryResult, roomsResult, ticketsResult] = await Promise.all([
        getDashboardSummary(),
        getSuperAdminMatchrooms(),
        getSupportTickets("open"),
      ]);
      if (!summaryResult.ok) throw new Error(summaryResult.message);
      if (!roomsResult.ok) throw new Error(roomsResult.message);
      if (!ticketsResult.ok) throw new Error(ticketsResult.message);
      setSummary(summaryResult.data);
      setRooms(roomsResult.data);
      setOpenTickets(ticketsResult.data);
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

  return (
    <Screen style={styles.screen} contentStyle={styles.screenContent} scroll={false} edges={["top"]}>
      <AppHeader title="Super Admin" subtitle="Operations dashboard" inlineTitle style={styles.headerBar} />

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
            <AppCard variant="soft" style={styles.heroCard}>
              <View style={styles.heroAccent} />
              <View style={styles.heroMain}>
                <View style={styles.heroAvatar}>
                  <Text style={styles.heroAvatarText}>SA</Text>
                </View>
                <View style={styles.heroTextWrap}>
                  <Text style={styles.heroLabel}>Super Admin dashboard</Text>
                  <Text style={styles.heroTitle}>MatchHai operations</Text>
                  <Text style={styles.heroSubtitle}>Monitor matchrooms, payments, reports, and zone approvals from one place.</Text>
                </View>
              </View>
              <View style={styles.heroStatusRow}>
                <StatusPill tone="info" label={`${summary?.counts.matchrooms || 0} matchrooms`} />
                <StatusPill tone="warning" label={`${summary?.reports.pending || 0} pending reports`} />
                <StatusPill tone="neutral" label={`${summary?.counts.teams || 0} teams`} />
              </View>
            </AppCard>

            <View style={styles.metricGrid}>
              {metrics.map((metric) => (
                <SuperAdminMetricCard key={metric.label} metric={metric} />
              ))}
            </View>

            <PlayerSectionHeader title="Quick actions" />
            <View style={styles.quickActionGrid}>
              <DashboardQuickActionTile icon="paymentWallet" label="Payments" color={COLORS.warning} onPress={() => router.push("/super-admin/payments" as any)} />
              <DashboardQuickActionTile icon="reports" label="Reports" color={COLORS.error} onPress={() => router.push("/super-admin/reports" as any)} />
              <DashboardQuickActionTile icon="matchroom" label="Matchrooms" color={COLORS.accent} onPress={() => router.push("/super-admin/matchrooms" as any)} />
              <DashboardQuickActionTile icon="support" label={`Support Tickets (${openTickets.length})`} color={COLORS.success} onPress={() => router.push("/super-admin/support-tickets" as any)} />
            </View>

            <PlayerSectionHeader
              title="Upcoming matches"
              actionLabel="View all"
              onPress={() => router.push("/super-admin/matchrooms" as any)}
            />

            {upcomingRooms.length === 0 ? (
              <PlayerEmptyStateCard title="No upcoming matchrooms" description="New or active matchrooms will appear here." />
            ) : (
              <View style={styles.matchList}>
                {upcomingRooms.map((room) => (
                  <MatchroomPreviewCard key={room.id} room={room} />
                ))}
              </View>
            )}

            <AppButton variant="secondary" onPress={() => router.push("/super-admin/support" as any)} leadingIcon="support">
              Help & Support
            </AppButton>
          </ScrollView>
        </Animated.View>
      )}
    </Screen>
  );
}
