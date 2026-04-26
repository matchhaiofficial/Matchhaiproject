import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { api } from "../../convex/_generated/api";
import AppHeader from "../../src/components/AppHeader";
import { AppCard, StatusPill } from "../../src/components/AppPrimitives";
import Screen from "../../src/components/Screen";
import SegmentedTabs from "../../src/components/SegmentedTabs";
import { useAuth } from "../../src/context/AuthContext";
import { useRouteLogger } from "../../src/hooks/useRouteLogger";
import { convex } from "../../src/lib/convex";
import { Matchroom, getUserMatchrooms } from "../../src/services/convex/matchService";
import { getMyReports } from "../../src/services/convex/reportService";
import { COLORS } from "../../src/theme";
import Logger from "../../src/utils/logger";
import { getReportStatusLabel } from "../../src/utils/statusLabels";
import { getRoomStartDate } from "../../src/utils/timeFilters";
import styles from "./schedule.styles";

type ScheduleTab = "upcoming" | "actions" | "history";

type TimelineActionItem = {
  key: string;
  title: string;
  subtitle: string;
  status: string;
  cta: string;
  onPress: () => void;
};

const dedupeRooms = (rooms: Matchroom[]) => {
  const byId = new Map<string, Matchroom>();
  rooms.forEach((room) => {
    if (room.id) byId.set(room.id, room);
  });
  return Array.from(byId.values());
};

const formatGameLabel = (value?: string | null) =>
  String(value || "Match")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatStatusLabel = (value?: string | null) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getTimelineTone = (value?: string | null) => {
  const status = String(value || "").toLowerCase();
  if (status.includes("resolved") || status.includes("completed")) return "success";
  if (status.includes("pending") || status.includes("reviewed")) return "warning";
  if (status.includes("rejected") || status.includes("cancelled") || status.includes("expired")) return "danger";
  return "info";
};

export default function ScheduleScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ScheduleTab>("upcoming");
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Matchroom[]>([]);
  const [actionItems, setActionItems] = useState<TimelineActionItem[]>([]);
  const [historyItems, setHistoryItems] = useState<TimelineActionItem[]>([]);
  useRouteLogger("ScheduleScreen", { activeTab, userId: user?._id });

  const fetchTimeline = useCallback(async () => {
    if (!user?._id) {
      setRooms([]);
      setActionItems([]);
      setHistoryItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [matchroomResult, activeIntents, inboxPending, reportsResult] = await Promise.all([
        getUserMatchrooms(user._id),
        convex.query(api.bookings.listActiveIntentsByUser, { userId: user._id }),
        convex.query(api.notifications.listInboxPage, { userId: user._id, tab: "pending", limit: 40 }),
        getMyReports(),
      ]);
      const reports = reportsResult.ok ? reportsResult.data : [];

      if (matchroomResult.ok && matchroomResult.data) {
        setRooms(dedupeRooms([...(matchroomResult.data.hosted || []), ...(matchroomResult.data.joined || [])]));
      } else {
        setRooms([]);
      }

      const pendingActions: TimelineActionItem[] = [];
      const history: TimelineActionItem[] = [];

      for (const intent of activeIntents || []) {
        pendingActions.push({
          key: `intent-${intent._id}`,
          title: `${formatGameLabel(intent.game)} booking payment`,
          subtitle: `Seat hold for ${intent.side} side • Rs ${Math.round(intent.pricing?.totalCost || 0)}`,
          status: formatStatusLabel(intent.status),
          cta: "Open payment status",
          onPress: () => router.push(`/matchrooms/book/status/${intent._id}` as any),
        });
      }

      for (const notification of inboxPending || []) {
        const title = notification.title || formatStatusLabel(notification.type);
        const body = notification.body || "You have a pending action waiting in Inbox.";
        pendingActions.push({
          key: `notification-${notification._id}`,
          title,
          subtitle: body,
          status: "Pending",
          cta: "Open inbox",
          onPress: () => router.push("/(player)/inbox" as any),
        });
      }

      for (const report of reports || []) {
        const unresolved = report.status !== "resolved";
        const item: TimelineActionItem = {
          key: `report-${report._id}`,
          title: report.reason,
          subtitle: unresolved
            ? "Your report is still in progress. Open it to review the moderation timeline."
            : "This report is resolved and saved in your report history.",
          status: getReportStatusLabel(report.status),
          cta: unresolved ? "Open report" : "View report",
          onPress: () => router.push(`/(player)/report/${report._id}` as any),
        };

        if (unresolved) {
          pendingActions.push(item);
        } else {
          history.push(item);
        }
      }

      setActionItems(pendingActions);
      setHistoryItems(history);
    } catch (error) {
      Logger.error("Schedule", "Failed to fetch player timeline", error);
      setRooms([]);
      setActionItems([]);
      setHistoryItems([]);
    } finally {
      setLoading(false);
    }
  }, [router, user?._id]);

  useFocusEffect(useCallback(() => {
    fetchTimeline();
  }, [fetchTimeline]));

  const categorizedRooms = useMemo(() => {
    const now = Date.now();
    const upcoming: Matchroom[] = [];
    const previous: Matchroom[] = [];

    rooms.forEach((room) => {
      const start = getRoomStartDate(room);
      if (room.status === "completed") {
        previous.push(room);
        return;
      }
      if (!start) {
        if (room.status === "in-progress") {
          upcoming.push(room);
        }
        return;
      }
      if (start.getTime() >= now - 15 * 60 * 1000) {
        upcoming.push(room);
      } else {
        previous.push(room);
      }
    });

    upcoming.sort((a, b) => (getRoomStartDate(a)?.getTime() || 0) - (getRoomStartDate(b)?.getTime() || 0));
    previous.sort((a, b) => (getRoomStartDate(b)?.getTime() || 0) - (getRoomStartDate(a)?.getTime() || 0));

    return { upcoming, previous };
  }, [rooms]);

  const visibleRooms = activeTab === "upcoming" ? categorizedRooms.upcoming : categorizedRooms.previous;
  const visibleActions = activeTab === "actions" ? actionItems : historyItems;

  return (
    <Screen style={styles.screen} scroll={false}>
      <AppHeader title="Schedule" onBack={() => router.back()} inlineTitle />

      <SegmentedTabs
        items={[
          { key: "upcoming", label: `Upcoming (${categorizedRooms.upcoming.length})` },
          { key: "actions", label: `Pending Actions (${actionItems.length})` },
          { key: "history", label: `History (${categorizedRooms.previous.length + historyItems.length})` },
        ]}
        value={activeTab}
        onChange={(value) => setActiveTab(value as ScheduleTab)}
        style={styles.tabs}
      />

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {activeTab === "upcoming" || activeTab === "history" ? (
            visibleRooms.length > 0 ? (
              visibleRooms.map((room) => (
                <Pressable key={room.id} onPress={() => router.push(`/matchrooms/${room.id}` as any)}>
                  <AppCard style={styles.timelineCard}>
                    <Text style={styles.timelineTitle}>{room.title}</Text>
                    <Text style={styles.timelineSubtitle}>
                      {formatGameLabel(room.game)} • {formatStatusLabel(room.status)}
                    </Text>
                    <Text style={styles.timelineMeta}>
                      {room.scheduledDate || "Date TBA"} {room.scheduledTime || ""}
                    </Text>
                    <Text style={styles.timelineCta}>Open lobby</Text>
                  </AppCard>
                </Pressable>
              ))
            ) : activeTab === "upcoming" ? (
              <AppCard variant="empty" style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No upcoming matches</Text>
                <Text style={styles.emptyText}>
                  Your upcoming rooms appear here once you create, join, or confirm one.
                </Text>
              </AppCard>
            ) : null
          ) : null}

          {visibleActions.length > 0 ? (
            visibleActions.map((item) => (
              <Pressable key={item.key} onPress={item.onPress}>
                <AppCard style={styles.timelineCard}>
                  <View style={styles.timelineTopRow}>
                    <Text style={styles.timelineTitle}>{item.title}</Text>
                    <StatusPill tone={getTimelineTone(item.status)} label={item.status} />
                  </View>
                  <Text style={styles.timelineSubtitle}>{item.subtitle}</Text>
                  <Text style={styles.timelineCta}>{item.cta}</Text>
                </AppCard>
              </Pressable>
            ))
          ) : activeTab === "actions" ? (
            <AppCard variant="empty" style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nothing is waiting on you</Text>
              <Text style={styles.emptyText}>
                Booking payments, invites, approvals, and report updates will surface here.
              </Text>
            </AppCard>
          ) : activeTab === "history" && categorizedRooms.previous.length === 0 ? (
            <AppCard variant="empty" style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No history yet</Text>
              <Text style={styles.emptyText}>
                Completed matches and resolved moderation items will build your timeline history.
              </Text>
            </AppCard>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}
