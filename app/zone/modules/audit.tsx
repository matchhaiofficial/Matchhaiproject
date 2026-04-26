import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import AppHeader from "../../../src/components/AppHeader";
import Screen from "../../../src/components/Screen";
import SegmentedTabs from "../../../src/components/SegmentedTabs";
import { useRouteLogger } from "../../../src/hooks/useRouteLogger";
import { useZoneData } from "../../../src/hooks/useZoneData";
import {
  listZoneAuditEvents,
  type ZoneAuditEvent,
  type ZoneAuditModule,
} from "../../../src/services/convex/zoneAuditService";
import { COLORS, FONTS, RADII, SPACING } from "../../../src/theme";

type DateFilter = "24h" | "7d" | "30d" | "all";

const MODULE_TABS: Array<{ key: "all" | ZoneAuditModule; label: string }> = [
  { key: "all", label: "All" },
  { key: "bookings", label: "Bookings" },
  { key: "resources", label: "Resources" },
  { key: "pricing", label: "Pricing" },
  { key: "migration", label: "Migration" },
];

const DATE_TABS: Array<{ key: DateFilter; label: string }> = [
  { key: "24h", label: "24H" },
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "all", label: "All" },
];

function formatDateTime(value: number) {
  if (!value) return "Unknown time";
  return new Date(value).toLocaleString();
}

function formatAction(value: string) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatTarget(value: string) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getDateCutoff(filter: DateFilter) {
  const now = Date.now();
  if (filter === "24h") return now - 24 * 60 * 60 * 1000;
  if (filter === "7d") return now - 7 * 24 * 60 * 60 * 1000;
  if (filter === "30d") return now - 30 * 24 * 60 * 60 * 1000;
  return 0;
}

export default function ZoneAuditModuleScreen() {
  const router = useRouter();
  const { zone } = useZoneData();
  useRouteLogger("ZoneAuditModule", { zoneId: zone?.id });

  const [events, setEvents] = useState<ZoneAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [moduleFilter, setModuleFilter] = useState<"all" | ZoneAuditModule>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("7d");
  const [actorQuery, setActorQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const loadAuditEvents = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (!zone?.id) {
        setEvents([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (mode === "initial") setLoading(true);
      else setRefreshing(true);

      try {
        const rows = await listZoneAuditEvents({
          zoneId: zone.id,
          module: moduleFilter,
          limit: 200,
        });
        setEvents(rows);
      } catch {
        setEvents([]);
      } finally {
        if (mode === "initial") setLoading(false);
        else setRefreshing(false);
      }
    },
    [moduleFilter, zone?.id],
  );

  useFocusEffect(
    useCallback(() => {
      loadAuditEvents("initial");
    }, [loadAuditEvents]),
  );

  const actionOptions = useMemo(() => {
    const values = Array.from(new Set(events.map((event) => event.action))).sort();
    return ["all", ...values];
  }, [events]);

  const filteredEvents = useMemo(() => {
    const actorNeedle = actorQuery.trim().toLowerCase();
    const cutoff = getDateCutoff(dateFilter);

    return events.filter((event) => {
      if (cutoff && event.createdAt < cutoff) return false;
      if (actionFilter !== "all" && event.action !== actionFilter) return false;
      if (!actorNeedle) return true;

      const haystack = `${event.actorLabel || ""} ${event.actorUid || ""}`.toLowerCase();
      return haystack.includes(actorNeedle);
    });
  }, [actionFilter, actorQuery, dateFilter, events]);

  const summary = useMemo(() => {
    const byModule = filteredEvents.reduce<Record<string, number>>((acc, event) => {
      acc[event.module] = (acc[event.module] || 0) + 1;
      return acc;
    }, {});

    return {
      total: filteredEvents.length,
      bookings: byModule.bookings || 0,
      pricing: byModule.pricing || 0,
      resources: byModule.resources || 0,
      migration: byModule.migration || 0,
    };
  }, [filteredEvents]);

  return (
    <Screen style={styles.screen} scroll={false}>
      <AppHeader
        title="Audit & Security"
        subtitle="Zone-admin change history across operational modules."
        onBack={() => router.back()}
      />

      <SegmentedTabs
        items={MODULE_TABS}
        value={moduleFilter}
        onChange={(value) => {
          setModuleFilter(value as "all" | ZoneAuditModule);
          setActionFilter("all");
        }}
        style={styles.tabs}
      />

      <SegmentedTabs
        items={DATE_TABS}
        value={dateFilter}
        onChange={(value) => setDateFilter(value as DateFilter)}
        style={styles.tabsCompact}
      />

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{summary.total}</Text>
          <Text style={styles.summaryLabel}>Visible events</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{summary.bookings + summary.resources}</Text>
          <Text style={styles.summaryLabel}>Ops actions</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{summary.pricing + summary.migration}</Text>
          <Text style={styles.summaryLabel}>System actions</Text>
        </View>
      </View>

      <View style={styles.filtersCard}>
        <Text style={styles.filtersTitle}>Filters</Text>
        <TextInput
          value={actorQuery}
          onChangeText={setActorQuery}
          placeholder="Filter by actor"
          placeholderTextColor={COLORS.textSecondary}
          style={styles.input}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {actionOptions.map((action) => {
            const active = actionFilter === action;
            return (
              <Pressable
                key={action}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setActionFilter(action)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {action === "all" ? "All actions" : formatAction(action)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadAuditEvents("refresh")}
              tintColor={COLORS.accent}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {filteredEvents.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No audit events for these filters</Text>
              <Text style={styles.emptyText}>
                Booking decisions, pricing changes, resource updates, and migration runs will appear here.
              </Text>
            </View>
          ) : null}

          {filteredEvents.map((event) => (
            <View key={event.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={styles.metaStack}>
                  <Text style={styles.moduleLabel}>{formatTarget(event.module)}</Text>
                  <Text style={styles.actionText}>{formatAction(event.action)}</Text>
                </View>
                <Text style={styles.timestamp}>{formatDateTime(event.createdAt)}</Text>
              </View>

              <Text style={styles.summaryText}>{event.summary}</Text>
              <Text style={styles.metaText}>
                Actor: {event.actorLabel || event.actorUid || "Unknown"}
              </Text>
              <Text style={styles.metaText}>
                Target: {formatTarget(event.targetType)}
                {event.targetId ? ` (${event.targetId})` : ""}
              </Text>

              {event.details ? (
                <View style={styles.detailsBlock}>
                  {Object.entries(event.details)
                    .filter(([, value]) => value != null && value !== "")
                    .slice(0, 6)
                    .map(([key, value]) => (
                      <Text key={key} style={styles.detailText}>
                        {formatTarget(key)}: {typeof value === "object" ? JSON.stringify(value) : String(value)}
                      </Text>
                    ))}
                </View>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.backgroundDark,
  },
  tabs: {
    marginBottom: SPACING.md,
  },
  tabsCompact: {
    marginBottom: SPACING.md,
  },
  summaryRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.cardDark,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.md,
  },
  summaryValue: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 22,
  },
  summaryLabel: {
    marginTop: SPACING.xs,
    color: COLORS.textSecondary,
    fontFamily: FONTS.interRegular,
    fontSize: 12,
  },
  filtersCard: {
    backgroundColor: COLORS.cardDark,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  filtersTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 16,
  },
  input: {
    backgroundColor: COLORS.inputBackground,
    borderColor: COLORS.inputBorder,
    borderWidth: 1,
    borderRadius: RADII.lg,
    color: COLORS.text,
    fontFamily: FONTS.interRegular,
    fontSize: 14,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  chipRow: {
    gap: SPACING.sm,
    paddingRight: SPACING.md,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.overlayLight,
  },
  chipActive: {
    borderColor: COLORS.accent,
    backgroundColor: "rgba(66,165,245,0.16)",
  },
  chipText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interMedium,
    fontSize: 12,
  },
  chipTextActive: {
    color: COLORS.text,
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingBottom: SPACING.xxl,
    gap: SPACING.md,
  },
  emptyCard: {
    backgroundColor: COLORS.cardDark,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.xl,
    alignItems: "center",
  },
  emptyTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 18,
    textAlign: "center",
  },
  emptyText: {
    marginTop: SPACING.sm,
    color: COLORS.textSecondary,
    fontFamily: FONTS.martelRegular,
    fontSize: 13,
    textAlign: "center",
  },
  card: {
    backgroundColor: COLORS.cardDark,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  metaStack: {
    flex: 1,
    gap: 2,
  },
  moduleLabel: {
    color: COLORS.accent,
    fontFamily: FONTS.interSemiBold,
    fontSize: 12,
    textTransform: "uppercase",
  },
  actionText: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 16,
  },
  timestamp: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interRegular,
    fontSize: 11,
    textAlign: "right",
  },
  summaryText: {
    color: COLORS.text,
    fontFamily: FONTS.martelRegular,
    fontSize: 13,
    lineHeight: 20,
  },
  metaText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interRegular,
    fontSize: 12,
  },
  detailsBlock: {
    marginTop: SPACING.xs,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    gap: 4,
  },
  detailText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interRegular,
    fontSize: 11,
  },
});
