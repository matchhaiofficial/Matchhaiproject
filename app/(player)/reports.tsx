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
import { AppReport, getMyReportsPage, ReportStatus } from "../../src/services/convex/reportService";
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

const PAGE_SIZE = 25;

export default function PlayerReportsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ReportTab>("pending");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reports, setReports] = useState<AppReport[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  useRouteLogger("PlayerReportsScreen", { activeTab });

  const mergeReports = useCallback((current: AppReport[], next: AppReport[]) => {
    const seen = new Set(current.map((r) => r.id));
    return [...current, ...next.filter((r) => !seen.has(r.id))];
  }, []);

  const loadReports = useCallback(async (mode: "initial" | "refresh" | "more" = "initial") => {
    if (mode === "more" && (loadingMore || isDone)) return;
    if (mode === "initial") setLoading(true);
    else if (mode === "refresh") setRefreshing(true);
    else setLoadingMore(true);

    const result = await getMyReportsPage({
      status: activeTab as ReportStatus,
      limit: PAGE_SIZE,
      cursor: mode === "more" ? cursor : null,
    });
    if (result.ok) {
      setReports((previous) => mode === "more" ? mergeReports(previous, result.data.page) : result.data.page);
      setCursor(result.data.continueCursor);
      setIsDone(result.data.isDone);
    } else if (mode !== "more") {
      setReports([]);
      setCursor(null);
      setIsDone(true);
    }

    if (mode === "initial") setLoading(false);
    else if (mode === "refresh") setRefreshing(false);
    else setLoadingMore(false);
  }, [activeTab, cursor, isDone, loadingMore, mergeReports]);

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
          onEndReached={() => loadReports("more")}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <AppCard variant="empty">
              <Text style={styles.emptyTitle}>{emptyCopy}</Text>
              <Text style={styles.emptyText}>
                Reports you submit from matchrooms, player profiles, and venue pages will appear here.
              </Text>
            </AppCard>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator color={COLORS.accent} />
              </View>
            ) : null
          }
          removeClippedSubviews
          initialNumToRender={10}
          windowSize={11}
        />
      )}
    </Screen>
  );
}
