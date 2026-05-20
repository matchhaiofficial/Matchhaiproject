import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { AdminEmptyStateCard, AdminListCard, AdminPageHeader } from "../../src/components/AdminSurface";
import Screen from "../../src/components/Screen";
import SegmentedTabs from "../../src/components/SegmentedTabs";
import { useTabBarClearance } from "../../src/hooks/useTabBarClearance";
import { useToast } from "../../src/hooks/useToast";
import { getZones } from "../../src/services/convex/superAdminService";
import type { Zone } from "../../src/services/convex/zoneService";
import { COLORS, FONTS, SPACING } from "../../src/theme";
import { getZoneStatusTone } from "../../src/utils/statusLabels";
import { getZoneLifecycleLabel, getZoneMigrationLabel } from "../../src/utils/zoneLifecycle";

type ZoneReviewStatus = "pending-review" | "approved_pending_migration";

function formatDate(value?: number) {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString();
}

function statusTitle(status: ZoneReviewStatus) {
  return status === "approved_pending_migration" ? "Approved Pending Migration" : "Pending Review";
}

function ZoneReviewCard({ zone }: { zone: Zone }) {
  const legacyZone = zone as Zone & {
    city?: string;
    name?: string;
    ownerUsername?: string;
  };
  const city = zone.primaryBranch?.city || legacyZone.city || "City not set";
  const area = zone.primaryBranch?.areaLabel || "Area not set";

  return (
    <AdminListCard
      title={zone.venueBrandName || legacyZone.name || "Untitled venue"}
      subtitle={zone.ownerFullName || legacyZone.ownerUsername || "Unknown owner"}
      statusLabel={getZoneLifecycleLabel(zone)}
      statusTone={getZoneStatusTone(zone.status)}
      onPress={() => router.push(`/super-admin/request/${zone.id}` as any)}
    >
      <View style={styles.cardBody}>
        <View style={styles.metaRow}>
          <Text style={styles.metaText} numberOfLines={1}>{city}</Text>
          <Text style={styles.metaDot}>|</Text>
          <Text style={styles.metaText} numberOfLines={1}>{area}</Text>
        </View>
        <View style={styles.footerRow}>
          <Text style={styles.metaText}>Submitted: {formatDate(zone.createdAt)}</Text>
          <Text style={styles.linkHint}>{getZoneMigrationLabel(zone)}</Text>
        </View>
      </View>
    </AdminListCard>
  );
}

export default function SuperAdminZonesScreen() {
  const { showToast } = useToast();
  const bottomContentPadding = useTabBarClearance(SPACING.lg);
  const [tab, setTab] = useState<ZoneReviewStatus>("pending-review");
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);

    const result = await getZones(tab, { forceRefresh: true });
    if (result.ok) {
      setZones(result.data);
    } else {
      showToast({ type: "error", title: "Zones failed", message: result.message });
    }

    if (mode === "initial") setLoading(false);
    else setRefreshing(false);
  }, [showToast, tab]);

  useFocusEffect(useCallback(() => {
    void load("initial");
  }, [load]));

  return (
    <Screen style={styles.screen} contentStyle={styles.screenContent} scroll={false} edges={["top"]}>
      <AdminPageHeader title="Zones" subtitle="Review venue onboarding queues." onBack={() => router.back()} inlineTitle />

      <SegmentedTabs
        items={[
          { key: "pending-review", label: "Pending" },
          { key: "approved_pending_migration", label: "Migration" },
        ]}
        value={tab}
        onChange={(value) => setTab(value as ZoneReviewStatus)}
        style={styles.tabs}
      />

      {loading ? (
        <View style={styles.loaderWrap}><ActivityIndicator color={COLORS.accent} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} tintColor={COLORS.accent} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>{zones.length} {statusTitle(tab).toLowerCase()}</Text>
          </View>
          {zones.map((zone) => <ZoneReviewCard key={zone.id} zone={zone} />)}
          {zones.length === 0 ? (
            <AdminEmptyStateCard title={`No ${statusTitle(tab).toLowerCase()} zones`} description="Zone registration requests in this state will appear here." icon="business" />
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.backgroundDark },
  screenContent: { paddingTop: 0 },
  tabs: { marginBottom: SPACING.md },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { gap: SPACING.md },
  summaryRow: {
    minHeight: 32,
    justifyContent: "center",
  },
  summaryText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: 13,
  },
  cardBody: { gap: SPACING.sm },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { color: COLORS.textSecondary, fontFamily: FONTS.martelRegular, fontSize: 13 },
  metaDot: { color: COLORS.muted, fontFamily: FONTS.body, fontSize: 13 },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.sm },
  linkHint: { color: COLORS.accent, fontFamily: FONTS.interSemiBold, fontSize: 12 },
});
