import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  View,
} from "react-native";

import AppHeader from "../../../src/components/AppHeader";
import { AppCard, StatusPill } from "../../../src/components/AppPrimitives";
import ReportTimeline from "../../../src/components/ReportTimeline";
import Screen from "../../../src/components/Screen";
import { useRouteLogger } from "../../../src/hooks/useRouteLogger";
import { AppReport, getMyReportById } from "../../../src/services/convex/reportService";
import { COLORS } from "../../../src/theme";
import { getReportStatusLabel } from "../../../src/utils/statusLabels";
import styles from "./report-detail.styles";

function formatDate(value?: number) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

const formatType = (value?: string) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getReportTone = (status: string) => {
  if (status === "resolved") return "success";
  if (status === "reviewed") return "info";
  return "warning";
};

export default function PlayerReportDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const reportId = String(params.id || "");
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<AppReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  useRouteLogger("PlayerReportDetailScreen", { reportId });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!reportId) {
        setError("Report not found.");
        setLoading(false);
        return;
      }
      const result = await getMyReportById(reportId);
      if (cancelled) return;
      if (result.ok) {
        setReport(result.data);
        setError(null);
      } else {
        setError(result.message);
      }
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  return (
    <Screen style={styles.screen} scroll={false}>
      <AppHeader title="Report Detail" onBack={() => router.back()} inlineTitle />

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : error || !report ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>{error || "Report not found."}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <AppCard style={styles.detailCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.reason}>{report.reason}</Text>
              <StatusPill tone={getReportTone(report.status)} label={getReportStatusLabel(report.status)} />
            </View>
            <Text style={styles.meta}>Type: {formatType(report.type)}</Text>
            <Text style={styles.meta}>Created: {formatDate(report.createdAt)}</Text>
            <Text style={styles.meta}>Updated: {formatDate(report.updatedAt)}</Text>
            {report.game ? <Text style={styles.meta}>Game: {report.game.toUpperCase()}</Text> : null}
            {report.matchroomTitle ? (
              <Text style={styles.meta}>Matchroom: {report.matchroomTitle}</Text>
            ) : report.matchroomId ? (
              <Text style={styles.meta}>Matchroom: {report.matchroomId}</Text>
            ) : null}
            {report.zoneName ? (
              <Text style={styles.meta}>Zone: {report.zoneName}</Text>
            ) : report.zoneId ? (
              <Text style={styles.meta}>Zone: {report.zoneId}</Text>
            ) : null}
            {report.reportedUserName ? (
              <Text style={styles.meta}>Reported User: {report.reportedUserName}</Text>
            ) : report.reportedUserId ? (
              <Text style={styles.meta}>Reported User: {report.reportedUserId}</Text>
            ) : null}
            {report.reviewedAt ? <Text style={styles.meta}>Reviewed: {formatDate(report.reviewedAt)}</Text> : null}
            {report.resolvedAt ? <Text style={styles.meta}>Resolved: {formatDate(report.resolvedAt)}</Text> : null}
            {report.description ? (
              <Text style={styles.description}>{report.description}</Text>
            ) : (
              <Text style={styles.placeholder}>No extra details were included.</Text>
            )}
          </AppCard>

          <ReportTimeline
            title="Report Timeline"
            items={[
              { key: "submitted", label: "Submitted", date: report.createdAt, active: true },
              { key: "reviewed", label: "Reviewed", date: report.reviewedAt, active: Boolean(report.reviewedAt) },
              { key: "resolved", label: "Resolved", date: report.resolvedAt, active: Boolean(report.resolvedAt) },
            ]}
          />

          <AppCard>
            <Text style={styles.noteTitle}>Status Meaning</Text>
            <Text style={styles.noteText}>
              `Pending` means the report is waiting for review. `Reviewed` means it has been triaged by the zone or admin team. `Resolved` means final moderation handling is complete.
            </Text>
          </AppCard>

          {report.reviewerNote || report.resolutionSummary ? (
            <AppCard>
              <Text style={styles.noteTitle}>Moderation Update</Text>
              {report.reviewerNote ? (
                <>
                  <Text style={styles.updateLabel}>Review Note</Text>
                  <Text style={styles.noteText}>{report.reviewerNote}</Text>
                </>
              ) : null}
              {report.resolutionSummary ? (
                <>
                  <Text style={styles.updateLabel}>Resolution Summary</Text>
                  <Text style={styles.noteText}>{report.resolutionSummary}</Text>
                </>
              ) : null}
            </AppCard>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}
