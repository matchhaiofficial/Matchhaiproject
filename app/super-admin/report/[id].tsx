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
import {
  getReportById,
  setUserSuspension,
  SuperAdminReport,
  updateReportStatus,
} from "../../../src/services/convex/superAdminService";
import { COLORS, FONTS, RADII, SPACING } from "../../../src/theme";
import { getReportStatusLabel } from "../../../src/utils/statusLabels";

function formatDate(value?: number | null) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

const formatType = (value?: string | null) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

type ReportStatus = "pending" | "reviewed" | "resolved";

export default function SuperAdminReportDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const reportId = String(params.id || "");
  const [loading, setLoading] = useState(true);
  const [busyStatus, setBusyStatus] = useState<ReportStatus | null>(null);
  const [report, setReport] = useState<SuperAdminReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<ReportStatus | null>(null);
  const [reviewerNote, setReviewerNote] = useState("");
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [busyModerationAction, setBusyModerationAction] = useState<string | null>(null);
  useRouteLogger("SuperAdminReportDetail", { reportId });

  const loadReport = async () => {
    if (!reportId) {
      setError("Report not found.");
      setLoading(false);
      return;
    }

    setLoading(true);
    const result = await getReportById(reportId);
    if (result.ok) {
      setReport(result.data);
      setError(result.data ? null : "Report not found.");
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadReport();
  }, [reportId]);

  const openStatusComposer = (status: ReportStatus) => {
    setError(null);
    setDraftStatus(status);
    setReviewerNote(report?.reviewerNote || "");
    setResolutionSummary(report?.resolutionSummary || "");
  };

  const closeStatusComposer = () => {
    setDraftStatus(null);
    setReviewerNote("");
    setResolutionSummary("");
  };

  const handleStatusChange = async () => {
    if (!report || !draftStatus) return;
    const nextReviewerNote = reviewerNote.trim();
    const nextResolutionSummary = resolutionSummary.trim();

    if (draftStatus === "reviewed" && !nextReviewerNote) {
      setError("Add a short review note so the triage context is preserved.");
      return;
    }

    if (draftStatus === "resolved" && !nextResolutionSummary) {
      setError("Add a short resolution summary before resolving the report.");
      return;
    }

    setBusyStatus(draftStatus);
    const result = await updateReportStatus(report.id, draftStatus, {
      reviewerNote: draftStatus === "pending" ? undefined : nextReviewerNote,
      resolutionSummary: draftStatus === "resolved" ? nextResolutionSummary : undefined,
    });
    setBusyStatus(null);
    if (result.ok) {
      closeStatusComposer();
      await loadReport();
    } else {
      setError(result.message);
    }
  };

  const handleReportedUserSuspension = async (mode: "temporary" | "permanent") => {
    const reportedUserId = report?.reportedUserId;
    if (!report || !reportedUserId) {
      setError("This report does not include a reported user to suspend.");
      return;
    }

    const suspendedUntil = mode === "temporary" ? Date.now() + 7 * 24 * 60 * 60 * 1000 : null;
    const reason = `${mode === "temporary" ? "7-day suspension" : "Permanent suspension"} from report ${report.id}: ${report.reason}`;
    setBusyModerationAction(mode);
    const result = await setUserSuspension(reportedUserId, {
      status: "suspended",
      reason,
      suspendedUntil,
    });
    setBusyModerationAction(null);
    if (result.ok) {
      setError(null);
      await updateReportStatus(report.id, "reviewed", {
        reviewerNote: reason,
      });
      await loadReport();
    } else {
      setError(result.message);
    }
  };

  const composerTitle =
    draftStatus === "reviewed"
      ? "Mark As Reviewed"
      : draftStatus === "resolved"
        ? "Resolve Report"
        : draftStatus === "pending"
          ? "Reopen Report"
          : "";

  const composerHint =
    draftStatus === "reviewed"
      ? "Capture what was verified so the next admin and the reporter can follow the triage step."
      : draftStatus === "resolved"
        ? "Add the final moderation outcome. Resolving from pending will also stamp the review milestone."
        : draftStatus === "pending"
          ? "Reopening clears previous review and resolution markers so the timeline matches the active state."
          : "";

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
            <Text style={styles.meta}>{formatType(report.type)}</Text>
            <Text style={styles.meta}>Created: {formatDate(report.createdAt)}</Text>
            <Text style={styles.meta}>Updated: {formatDate(report.updatedAt)}</Text>
            <Text style={styles.meta}>Reporter: {report.reporterName}</Text>
            {report.reportedUserName ? <Text style={styles.meta}>Reported User: {report.reportedUserName}</Text> : null}
            {report.zoneName ? <Text style={styles.meta}>Zone: {report.zoneName}</Text> : null}
            {report.branchLabel ? <Text style={styles.meta}>Branch: {report.branchLabel}</Text> : null}
            {report.matchroomTitle ? <Text style={styles.meta}>Matchroom: {report.matchroomTitle}</Text> : null}
            {report.game ? <Text style={styles.meta}>Game: {report.game.toUpperCase()}</Text> : null}
            {report.reviewedByName ? (
              <Text style={styles.meta}>Reviewed By: {report.reviewedByName} | {formatDate(report.reviewedAt)}</Text>
            ) : null}
            {report.resolvedByName ? (
              <Text style={styles.meta}>Resolved By: {report.resolvedByName} | {formatDate(report.resolvedAt)}</Text>
            ) : null}
            {report.description ? <Text style={styles.description}>{report.description}</Text> : null}
          </View>

          <ReportTimeline
            title="Moderation Timeline"
            items={[
              { key: "submitted", label: "Submitted", date: report.createdAt, actor: report.reporterName, active: true },
              { key: "reviewed", label: "Reviewed", date: report.reviewedAt, actor: report.reviewedByName, active: Boolean(report.reviewedAt) },
              { key: "resolved", label: "Resolved", date: report.resolvedAt, actor: report.resolvedByName, active: Boolean(report.resolvedAt) },
            ]}
          />

          {(report.reviewerNote || report.resolutionSummary) ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Moderation Context</Text>
              {report.reviewerNote ? (
                <>
                  <Text style={styles.contextLabel}>Review Note</Text>
                  <Text style={styles.contextValue}>{report.reviewerNote}</Text>
                </>
              ) : null}
              {report.resolutionSummary ? (
                <>
                  <Text style={styles.contextLabel}>Resolution Summary</Text>
                  <Text style={styles.contextValue}>{report.resolutionSummary}</Text>
                </>
              ) : null}
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Moderation Actions</Text>
            <Text style={styles.helperText}>
              Reviewed reports should capture triage context. Resolved reports should include the final moderation outcome.
            </Text>
            {report.type === "user_report" ? (
              <View style={styles.actionRow}>
                <Pressable style={[styles.secondaryButton, styles.disabledAction]} disabled>
                  <Text style={styles.secondaryButtonText}>Warning - Coming soon</Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => handleReportedUserSuspension("temporary")}
                  disabled={busyModerationAction !== null}
                >
                  {busyModerationAction === "temporary" ? (
                    <ActivityIndicator color={COLORS.text} />
                  ) : (
                    <Text style={styles.secondaryButtonText}>Suspend 7 Days</Text>
                  )}
                </Pressable>
                <Pressable
                  style={styles.dangerButton}
                  onPress={() => handleReportedUserSuspension("permanent")}
                  disabled={busyModerationAction !== null}
                >
                  {busyModerationAction === "permanent" ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.dangerButtonText}>Suspend Permanently</Text>
                  )}
                </Pressable>
              </View>
            ) : null}
            {report.type === "zone_complaint" ? (
              <View style={styles.actionRow}>
                <Pressable style={[styles.secondaryButton, styles.disabledAction]} disabled>
                  <Text style={styles.secondaryButtonText}>Flag venue - Coming soon</Text>
                </Pressable>
                <Pressable style={[styles.secondaryButton, styles.disabledAction]} disabled>
                  <Text style={styles.secondaryButtonText}>Suspend zone - Use zone request screen</Text>
                </Pressable>
              </View>
            ) : null}
            {report.type === "matchroom_complaint" ? (
              <View style={styles.actionRow}>
                <Pressable style={[styles.secondaryButton, styles.disabledAction]} disabled>
                  <Text style={styles.secondaryButtonText}>Flag matchroom - Coming soon</Text>
                </Pressable>
                <Pressable style={[styles.secondaryButton, styles.disabledAction]} disabled>
                  <Text style={styles.secondaryButtonText}>Cancel matchroom - Requires backend support</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.actionRow}>
              {report.status !== "reviewed" ? (
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => openStatusComposer("reviewed")}
                  disabled={busyStatus !== null}
                >
                  <Text style={styles.secondaryButtonText}>Mark Reviewed</Text>
                </Pressable>
              ) : null}
              {report.status !== "resolved" ? (
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => openStatusComposer("resolved")}
                  disabled={busyStatus !== null}
                >
                  <Text style={styles.primaryButtonText}>Resolve</Text>
                </Pressable>
              ) : null}
              {report.status !== "pending" ? (
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => openStatusComposer("pending")}
                  disabled={busyStatus !== null}
                >
                  <Text style={styles.secondaryButtonText}>Reopen</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {draftStatus ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{composerTitle}</Text>
              <Text style={styles.helperText}>{composerHint}</Text>

              {draftStatus !== "pending" ? (
                <>
                  <Text style={styles.inputLabel}>Review Note</Text>
                  <TextInput
                    value={reviewerNote}
                    onChangeText={setReviewerNote}
                    placeholder="Summarize what was checked or confirmed."
                    placeholderTextColor={COLORS.textSecondary}
                    style={[styles.input, styles.multilineInput]}
                    multiline
                    textAlignVertical="top"
                  />
                </>
              ) : null}

              {draftStatus === "resolved" ? (
                <>
                  <Text style={styles.inputLabel}>Resolution Summary</Text>
                  <TextInput
                    value={resolutionSummary}
                    onChangeText={setResolutionSummary}
                    placeholder="Explain the final moderation outcome."
                    placeholderTextColor={COLORS.textSecondary}
                    style={[styles.input, styles.multilineInput]}
                    multiline
                    textAlignVertical="top"
                  />
                </>
              ) : null}

              <View style={styles.actionRow}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={closeStatusComposer}
                  disabled={busyStatus !== null}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.primaryButton}
                  onPress={handleStatusChange}
                  disabled={busyStatus !== null}
                >
                  {busyStatus === draftStatus ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Save Status Update</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}
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
  sectionTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 16,
  },
  helperText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.martelRegular,
    fontSize: 13,
    lineHeight: 20,
  },
  contextLabel: {
    marginTop: SPACING.xs,
    color: COLORS.text,
    fontFamily: FONTS.interSemiBold,
    fontSize: 13,
  },
  contextValue: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.martelRegular,
    fontSize: 14,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  inputLabel: {
    color: COLORS.text,
    fontFamily: FONTS.interSemiBold,
    fontSize: 13,
    marginTop: SPACING.sm,
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
  primaryButton: {
    minHeight: 44,
    minWidth: 120,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontFamily: FONTS.interSemiBold,
    fontSize: 14,
  },
  dangerButton: {
    minHeight: 44,
    minWidth: 120,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.error,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButtonText: {
    color: "#fff",
    fontFamily: FONTS.interSemiBold,
    fontSize: 14,
  },
  secondaryButton: {
    minHeight: 44,
    minWidth: 120,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.overlayLight,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontFamily: FONTS.interSemiBold,
    fontSize: 14,
  },
  disabledAction: {
    opacity: 0.55,
  },
});
