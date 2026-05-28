import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";

import AppHeader from "../../src/components/AppHeader";
import { AppCard, StatusPill } from "../../src/components/AppPrimitives";
import Screen from "../../src/components/Screen";
import SegmentedTabs from "../../src/components/SegmentedTabs";
import { useRouteLogger } from "../../src/hooks/useRouteLogger";
import { AppReport, getMyReports, ReportStatus } from "../../src/services/convex/reportService";
import { COLORS } from "../../src/theme";
import { getReportStatusLabel } from "../../src/utils/statusLabels";
import styles from "./reports.styles";

type ReportTab = "pending" | "reviewed" | "resolved";

const formatType = (value: string) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

function formatDate(value?: number) {
  if (!value) return "Now";
  return new Date(value).toLocaleString();
}

const getReportTone = (status: string) => {
  if (status === "resolved") return "success";
  if (status === "reviewed") return "info";
  return "warning";
};

const ReportRow = React.memo(function ReportRow({
  report,
  onPress,
}: {
  report: AppReport;
  onPress: (id: string) => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [pressed && styles.cardPressed]}
      onPress={() => onPress(report.id)}
    >
      <AppCard style={styles.reportCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.reason}>{report.reason}</Text>
          <StatusPill tone={getReportTone(report.status)} label={getReportStatusLabel(report.status)} />
        </View>
        <Text style={styles.meta}>
          {formatType(report.type)} • {formatDate(report.createdAt)}
        </Text>
        {report.game ? <Text style={styles.meta}>Game: {report.game.toUpperCase()}</Text> : null}
        {report.description ? (
          <Text style={styles.description}>{report.description}</Text>
        ) : null}
        <Text style={styles.linkHint}>Open report details</Text>
      </AppCard>
    </Pressable>
  );
});

export default function PlayerReportsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ReportTab>("pending");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reports, setReports] = useState<AppReport[]>([]);
  useRouteLogger("PlayerReportsScreen", { activeTab });

  const loadReports = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);

    const result = await getMyReports(activeTab as ReportStatus);
    if (result.ok) {
      setReports(result.data);
    } else {
      setReports([]);
    }

    if (mode === "initial") setLoading(false);
    else setRefreshing(false);
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      loadReports("initial");
    }, [loadReports]),
  );

  const emptyCopy = useMemo(() => {
    if (activeTab === "pending") return "No pending reports.";
    if (activeTab === "reviewed") return "No reviewed reports yet.";
    return "No resolved reports yet.";
  }, [activeTab]);

  const handleOpenReport = useCallback(
    (id: string) => {
      router.push({
        pathname: "/(player)/report/[id]",
        params: { id },
      });
    },
    [router],
  );

  return (
    <Screen style={styles.screen} scroll={false}>
      <AppHeader title="My Reports" onBack={() => router.back()} inlineTitle />

      <SegmentedTabs
        items={[
          { key: "pending", label: "Pending" },
          { key: "reviewed", label: "Reviewed" },
          { key: "resolved", label: "Resolved" },
        ]}
        value={activeTab}
        onChange={(value) => setActiveTab(value as ReportTab)}
        style={styles.tabs}
      />

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(report) => report.id}
          renderItem={({ item }) => (
            <ReportRow report={item} onPress={handleOpenReport} />
          )}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadReports("refresh")}
              tintColor={COLORS.accent}
            />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <AppCard variant="empty">
              <Text style={styles.emptyTitle}>{emptyCopy}</Text>
              <Text style={styles.emptyText}>
                Reports you submit from matchrooms, player profiles, and venue pages will appear here.
              </Text>
            </AppCard>
          }
          removeClippedSubviews
          initialNumToRender={10}
          windowSize={11}
        />
      )}
    </Screen>
  );
}
