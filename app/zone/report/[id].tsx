import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import AppHeader from "../../../src/components/AppHeader";
import ReportTimeline from "../../../src/components/ReportTimeline";
import Screen from "../../../src/components/Screen";
import { useRouteLogger } from "../../../src/hooks/useRouteLogger";
import { useToast } from "../../../src/hooks/useToast";
import {
  AppReport,
  getZoneReportById,
  markZoneReportReviewed,
} from "../../../src/services/convex/reportService";
import { COLORS, FONTS, RADII, SPACING } from "../../../src/theme";
import { getReportStatusLabel } from "../../../src/utils/statusLabels";

function formatDate(value?: number) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

const formatType = (value?: string) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

export default function ZoneReportDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const reportId = String(params.id || "");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [report, setReport] = useState<AppReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewerNote, setReviewerNote] = useState("");
  const { showToast } = useToast();
  useRouteLogger("ZoneReportDetailScreen", { reportId });

  const loadReport = async () => {
    if (!reportId) {
      setError("Report not found.");
      setLoading(false);
      return;
    }

    setLoading(true);
    const result = await getZoneReportById(reportId);
    if (result.ok) {
      setReport(result.data);
      setError(null);
    } else {
      setReport(null);
      setError(result.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadReport();
  }, [reportId]);

  const handleMarkReviewed = async () => {
    if (!report || report.status !== "pending") return;
    const note = reviewerNote.trim();
    if (!note) {
      showToast({
        type: "warning",
        title: "Review note required",
        message: "Add a short note describing what your venue team verified.",
      });
      return;
    }

    setProcessing(true);
    const result = await markZoneReportReviewed(report.id, note);
    setProcessing(false);

    if (!result.ok) {
      showToast({
        type: "error",
        title: "Update failed",
        message: result.message,
      });
      return;
    }

    setReviewerNote("");
    await loadReport();
  };

  return (
    <Screen style={styles.screen} scroll={false} keyboardAvoiding>
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
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.reason}>{report.reason}</Text>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>{getReportStatusLabel(report.status)}</Text>
              </View>
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
            {report.reviewedAt ? <Text style={styles.meta}>Reviewed: {formatDate(report.reviewedAt)}</Text> : null}
            {report.resolvedAt ? <Text style={styles.meta}>Resolved: {formatDate(report.resolvedAt)}</Text> : null}
            {report.description ? (
              <Text style={styles.description}>{report.description}</Text>
            ) : (
              <Text style={styles.placeholder}>No extra details were included.</Text>
            )}
          </View>

          <ReportTimeline
            title="Report Timeline"
            items={[
              { key: "submitted", label: "Submitted", date: report.createdAt, active: true },
              { key: "reviewed", label: "Reviewed", date: report.reviewedAt, active: Boolean(report.reviewedAt) },
              { key: "resolved", label: "Resolved", date: report.resolvedAt, active: Boolean(report.resolvedAt) },
            ]}
          />

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Zone Actions</Text>
            <Text style={styles.noteText}>
              Zone admins can review complaints tied to their venue. Final resolution stays with MatchHai admin.
            </Text>
            {report.reviewerNote ? (
              <>
                <Text style={styles.inputLabel}>Review Note</Text>
                <Text style={styles.savedNote}>{report.reviewerNote}</Text>
              </>
            ) : null}
            {report.status === "pending" ? (
              <>
                <Text style={styles.inputLabel}>Review Note</Text>
                <TextInput
                  value={reviewerNote}
                  onChangeText={setReviewerNote}
                  placeholder="Describe what your venue team checked or confirmed."
                  placeholderTextColor={COLORS.textSecondary}
                  style={[styles.input, styles.multilineInput]}
                  multiline
                  textAlignVertical="top"
                />
                <Pressable
                  style={[styles.primaryButton, processing && styles.buttonDisabled]}
                  onPress={handleMarkReviewed}
                  disabled={processing}
                >
                  {processing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Mark Reviewed</Text>
                  )}
                </Pressable>
              </>
            ) : null}
          </View>
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
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
  },
  emptyTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 18,
    textAlign: "center",
  },
  content: {
    paddingBottom: SPACING.xxl,
    gap: SPACING.md,
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
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  reason: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 18,
  },
  statusPill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.overlayMedium,
    backgroundColor: COLORS.overlayLight,
  },
  statusText: {
    color: COLORS.text,
    fontFamily: FONTS.interSemiBold,
    fontSize: 11,
    textTransform: "capitalize",
  },
  meta: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.martelRegular,
    fontSize: 13,
  },
  description: {
    marginTop: SPACING.sm,
    color: COLORS.text,
    fontFamily: FONTS.martelRegular,
    fontSize: 14,
    lineHeight: 22,
  },
  placeholder: {
    marginTop: SPACING.sm,
    color: COLORS.textSecondary,
    fontFamily: FONTS.martelRegular,
    fontSize: 13,
  },
  sectionTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 16,
  },
  noteText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.martelRegular,
    fontSize: 13,
    lineHeight: 20,
  },
  inputLabel: {
    marginTop: SPACING.sm,
    color: COLORS.text,
    fontFamily: FONTS.interSemiBold,
    fontSize: 13,
  },
  input: {
    marginTop: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.overlayLight,
    color: COLORS.text,
    fontFamily: FONTS.martelRegular,
    fontSize: 14,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  multilineInput: {
    minHeight: 96,
  },
  savedNote: {
    marginTop: SPACING.xs,
    color: COLORS.textSecondary,
    fontFamily: FONTS.martelRegular,
    fontSize: 14,
    lineHeight: 22,
  },
  primaryButton: {
    marginTop: SPACING.sm,
    minHeight: 44,
    borderRadius: RADII.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accent,
  },
  primaryButtonText: {
    color: "#fff",
    fontFamily: FONTS.interSemiBold,
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
