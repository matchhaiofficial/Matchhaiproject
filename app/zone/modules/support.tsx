import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import AppHeader from "../../../src/components/AppHeader";
import { AppCard, StatusPill } from "../../../src/components/AppPrimitives";
import Screen from "../../../src/components/Screen";
import SegmentedTabs from "../../../src/components/SegmentedTabs";
import { useRouteLogger } from "../../../src/hooks/useRouteLogger";
import {
  AppReport,
  getZoneReports,
  ReportStatus,
} from "../../../src/services/convex/reportService";
import { COLORS } from "../../../src/theme";
import { getReportStatusLabel } from "../../../src/utils/statusLabels";
import styles from "./support.styles";

type SupportTab = "pending" | "reviewed" | "resolved";

function formatDate(value?: number) {
  if (!value) return "Now";
  return new Date(value).toLocaleString();
}

const formatType = (value: string) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

export default function ZoneSupportModule() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SupportTab>("pending");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reports, setReports] = useState<AppReport[]>([]);
  useRouteLogger("ZoneSupportModule", { activeTab });

  const loadReports = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);

    const result = await getZoneReports(activeTab as ReportStatus);
    if (result.ok) setReports(result.data);
    else setReports([]);

    if (mode === "initial") setLoading(false);
    else setRefreshing(false);
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      loadReports("initial");
    }, [loadReports]),
  );

  const footerHint = useMemo(() => {
    if (activeTab === "pending") return "Open a report to add a review note before moving it to reviewed.";
    return "Final resolution remains a MatchHai admin action.";
  }, [activeTab]);

  return (
    <Screen style={styles.screen} scroll={false}>
      <AppHeader
        title="Support & Safety"
        subtitle="Reports tied to your zone."
        onBack={() => router.back()}
      />

      <SegmentedTabs
        items={[
          { key: "pending", label: "Pending" },
          { key: "reviewed", label: "Reviewed" },
          { key: "resolved", label: "Resolved" },
        ]}
        value={activeTab}
        onChange={(value) => setActiveTab(value as SupportTab)}
        style={styles.tabs}
      />

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
              onRefresh={() => loadReports("refresh")}
              tintColor={COLORS.accent}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <AppCard>
            <Text style={styles.infoTitle}>Zone Review Scope</Text>
            <Text style={styles.infoText}>{footerHint}</Text>
          </AppCard>

          {reports.length === 0 ? (
            <AppCard variant="empty">
              <Text style={styles.emptyTitle}>No reports in this queue</Text>
              <Text style={styles.emptyText}>
                Reports linked to your zone will appear here as players submit them.
              </Text>
            </AppCard>
          ) : null}

          {reports.map((report) => (
            <Pressable
              key={report.id}
              style={({ pressed }) => [pressed && styles.cardPressed]}
              onPress={() =>
                router.push({
                  pathname: "/zone/report/[id]",
                  params: { id: report.id },
                })
              }
            >
              <AppCard style={styles.reportCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.reason}>{report.reason}</Text>
                  <StatusPill
                    tone={
                      report.status === "resolved"
                        ? "success"
                        : report.status === "reviewed"
                          ? "info"
                          : "warning"
                    }
                    label={getReportStatusLabel(report.status)}
                  />
                </View>

                <Text style={styles.meta}>
                  {formatType(report.type)} • {formatDate(report.createdAt)}
                </Text>
                {report.game ? <Text style={styles.meta}>Game: {report.game.toUpperCase()}</Text> : null}
                {report.matchroomTitle ? (
                  <Text style={styles.meta}>Matchroom: {report.matchroomTitle}</Text>
                ) : report.matchroomId ? (
                  <Text style={styles.meta}>Matchroom: {report.matchroomId}</Text>
                ) : null}
                {report.description ? <Text style={styles.description}>{report.description}</Text> : null}
                {report.reviewerNote ? <Text style={styles.meta}>Review Note: {report.reviewerNote}</Text> : null}
                <Text style={styles.linkHint}>Open report details</Text>
              </AppCard>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
