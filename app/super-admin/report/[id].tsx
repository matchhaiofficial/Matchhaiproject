import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  addReportModerationNote,
  cancelReportedMatchroom,
  flagReportedZone,
  getReportById,
  markReportedMatchroomForReview,
  reactivateReportedUser,
  reactivateReportedZone,
  suspendReportedUser,
  suspendReportedZone,
  SuperAdminReport,
  updateReportStatus,
  warnReportedUser,
  warnReportedZoneAdmin,
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

function isChatMessageReport(report: SuperAdminReport) {
  return report.type === "friend_chat_message_report"
    || report.type === "matchroom_chat_message_report"
    || report.type === "team_challenge_chat_message_report";
}

type ReportStatus = "pending" | "reviewed" | "resolved";

type ActionResult = { ok: true } | { ok: false; message: string };

type ModAction = {
  key: string;
  label: string;
  variant: "secondary" | "primary" | "danger";
  destructive?: boolean;
  reasonRequired?: boolean;
  reasonOptional?: boolean;
  composerTitle: string;
  composerHint: string;
  placeholder?: string;
  confirmLabel: string;
  confirmMessage?: string;
  successMessage: string;
  run: (text: string) => Promise<ActionResult>;
};

export default function SuperAdminReportDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const reportId = String(params.id || "");
  const [loading, setLoading] = useState(true);
  const [busyStatus, setBusyStatus] = useState<ReportStatus | null>(null);
  const [report, setReport] = useState<SuperAdminReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<ReportStatus | null>(null);
  const [reviewerNote, setReviewerNote] = useState("");
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [activeAction, setActiveAction] = useState<ModAction | null>(null);
  const [actionText, setActionText] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
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
    setNotice(null);
    setActiveAction(null);
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
      setNotice("Report status updated.");
      await loadReport();
    } else {
      setError(result.message);
    }
  };

  const openAction = (action: ModAction) => {
    setError(null);
    setNotice(null);
    setDraftStatus(null);
    setActionText("");
    setActiveAction(action);
  };

  const closeAction = () => {
    setActiveAction(null);
    setActionText("");
  };

  const runActiveAction = async () => {
    if (!activeAction) return;
    const text = actionText.trim();
    if (activeAction.reasonRequired && !text) {
      setError("A reason is required for this action.");
      return;
    }

    const execute = async () => {
      setBusyAction(activeAction.key);
      const result = await activeAction.run(text);
      setBusyAction(null);
      if (result.ok) {
        closeAction();
        setError(null);
        setNotice(activeAction.successMessage);
        await loadReport();
      } else {
        setError(result.message);
      }
    };

    if (activeAction.destructive) {
      Alert.alert(
        activeAction.composerTitle,
        activeAction.confirmMessage || "This action cannot be undone from here. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          { text: activeAction.confirmLabel, style: "destructive", onPress: () => { void execute(); } },
        ],
      );
      return;
    }

    await execute();
  };

  const openRelatedRecord = () => {
    if (!report) return;
    if ((report.type === "matchroom_complaint" || report.type === "matchroom_chat_message_report") && report.matchroomId) {
      router.push(`/super-admin/matchroom/${report.matchroomId}`);
      return;
    }
    if (report.type === "zone_complaint" && report.zoneId) {
      router.push(`/super-admin/request/${report.zoneId}`);
      return;
    }
    if (report.type === "user_report" || report.type === "team_report" || isChatMessageReport(report)) {
      router.push("/super-admin/users");
      return;
    }
    setError("There is no linked record to open for this report.");
  };

  const relatedRecordLabel = useMemo(() => {
    if (!report) return null;
    if (report.type === "matchroom_complaint" || report.type === "matchroom_chat_message_report") return report.matchroomId ? "Open Matchroom" : null;
    if (report.type === "zone_complaint") return report.zoneId ? "Open Zone" : null;
    if (report.type === "user_report" || report.type === "team_report" || isChatMessageReport(report)) return report.reportedUserId ? "Open Users List" : null;
    return null;
  }, [report]);

  const moderationActions = useMemo<ModAction[]>(() => {
    if (!report) return [];
    const actions: ModAction[] = [];
    const hasReportedUser = Boolean(report.reportedUserId);

    if (report.type === "user_report" || report.type === "team_report" || (isChatMessageReport(report) && hasReportedUser) || (report.type === "matchroom_complaint" && hasReportedUser)) {
      actions.push({
        key: "warn_user",
        label: "Warn User",
        variant: "secondary",
        reasonRequired: true,
        composerTitle: "Warn Reported User",
        composerHint: "Sends a professional warning notification to the reported user. This does NOT suspend the account. A short message is required.",
        placeholder: "Warning message / reason for the moderation trail.",
        confirmLabel: "Send Warning",
        successMessage: "Warning sent to the reported user.",
        run: (text) => warnReportedUser(report.id, text),
      });
      if (report.reportedUserStatus === "suspended") {
        actions.push({
          key: "reactivate_user",
          label: "Reactivate User",
          variant: "secondary",
          composerTitle: "Reactivate User",
          composerHint: "Restores the reported user's account to active.",
          confirmLabel: "Reactivate",
          successMessage: "User reactivated.",
          run: () => reactivateReportedUser(report.id),
        });
      } else {
        actions.push({
          key: "suspend_user_7d",
          label: "Suspend 7 Days",
          variant: "danger",
          destructive: true,
          reasonRequired: true,
          composerTitle: "Suspend User (7 days)",
          composerHint: "Temporarily suspends the reported user for 7 days. A reason is required.",
          placeholder: "Reason for the 7-day suspension.",
          confirmLabel: "Suspend 7 Days",
          confirmMessage: "The user will be suspended for 7 days and notified. You can reactivate them from this report. Continue?",
          successMessage: "User suspended for 7 days.",
          run: (text) => suspendReportedUser(report.id, "temporary", text),
        });
        actions.push({
          key: "suspend_user_perm",
          label: "Suspend Permanently",
          variant: "danger",
          destructive: true,
          reasonRequired: true,
          composerTitle: "Suspend User (permanent)",
          composerHint: "Permanently suspends the reported user. A reason is required.",
          placeholder: "Reason for the permanent suspension.",
          confirmLabel: "Suspend Permanently",
          confirmMessage: "The user will be suspended indefinitely and notified. You can reactivate them from this report. Continue?",
          successMessage: "User suspended permanently.",
          run: (text) => suspendReportedUser(report.id, "permanent", text),
        });
      }
    }

    if (report.type === "zone_complaint") {
      actions.push({
        key: "warn_zone_admin",
        label: "Warn Zone Admin",
        variant: "secondary",
        reasonRequired: true,
        composerTitle: "Warn Zone Admin",
        composerHint: "Sends a professional warning notification to the zone owner. This does NOT suspend the zone. A short message is required.",
        placeholder: "Warning message / reason for the moderation trail.",
        confirmLabel: "Send Warning",
        successMessage: "Warning sent to the zone admin.",
        run: (text) => warnReportedZoneAdmin(report.id, text),
      });
      actions.push({
        key: "flag_zone",
        label: "Flag Zone For Review",
        variant: "secondary",
        reasonOptional: true,
        composerTitle: "Flag Zone For Review",
        composerHint: "Marks this venue for follow-up and notifies the zone admin. Add an optional note.",
        placeholder: "Optional note about what to review.",
        confirmLabel: "Flag Zone",
        successMessage: "Zone flagged for review.",
        run: (text) => flagReportedZone(report.id, text || undefined),
      });
      if (report.zoneStatus === "suspended") {
        actions.push({
          key: "reactivate_zone",
          label: "Reactivate Zone",
          variant: "secondary",
          composerTitle: "Reactivate Zone",
          composerHint: "Restores the suspended zone to active.",
          confirmLabel: "Reactivate",
          successMessage: "Zone reactivated.",
          run: () => reactivateReportedZone(report.id),
        });
      } else {
        actions.push({
          key: "suspend_zone",
          label: "Suspend Zone",
          variant: "danger",
          destructive: true,
          reasonRequired: true,
          composerTitle: "Suspend Zone",
          composerHint: "Suspends the venue so it is no longer bookable. A reason is required.",
          placeholder: "Reason for suspending the zone.",
          confirmLabel: "Suspend Zone",
          confirmMessage: "The zone will be set to suspended and the zone admin notified. You can reactivate it from this report. Continue?",
          successMessage: "Zone suspended.",
          run: (text) => suspendReportedZone(report.id, text),
        });
      }
    }

    if (report.type === "matchroom_complaint") {
      actions.push({
        key: "flag_matchroom",
        label: "Mark For Admin Review",
        variant: "secondary",
        reasonOptional: true,
        composerTitle: "Mark Matchroom For Review",
        composerHint: "Flags this matchroom for follow-up. Add an optional note.",
        placeholder: "Optional note about what to review.",
        confirmLabel: "Mark For Review",
        successMessage: "Matchroom flagged for review.",
        run: (text) => markReportedMatchroomForReview(report.id, text || undefined),
      });
      if (report.matchroomStatus !== "cancelled") {
        actions.push({
          key: "cancel_matchroom",
          label: "Cancel Matchroom",
          variant: "danger",
          destructive: true,
          reasonRequired: true,
          composerTitle: "Cancel Matchroom",
          composerHint: "Uses the existing admin cancellation path. A reason is required.",
          placeholder: "Reason for cancelling the matchroom.",
          confirmLabel: "Cancel Matchroom",
          confirmMessage:
            "This will:\n• Cancel and lock the matchroom\n• Notify players (and zone, where applicable)\n• Run the existing refund / hold-release logic for any captured payments\n\nThis cannot be undone. Continue?",
          successMessage: "Matchroom cancelled and players notified.",
          run: (text) => cancelReportedMatchroom(report.id, text),
        });
      }
    }

    // Always available: append an internal moderation note.
    actions.push({
      key: "add_note",
      label: "Add Internal Note",
      variant: "secondary",
      reasonRequired: true,
      composerTitle: "Add Internal Note",
      composerHint: "Adds a private, timestamped note to the moderation trail. Not shared with users.",
      placeholder: "Internal moderation note.",
      confirmLabel: "Save Note",
      successMessage: "Internal note added.",
      run: (text) => addReportModerationNote(report.id, text),
    });

    return actions;
  }, [report]);

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

  const moderationNotes = report?.moderationNotes || [];

  return (
    <Screen style={styles.screen} scroll={false} keyboardAvoiding>
      <AppHeader title="Report Detail" onBack={() => router.back()} inlineTitle />

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : error && !report ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>{error || "Report not found."}</Text>
        </View>
      ) : !report ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Report not found.</Text>
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
            {report.reviewedByName ? (
              <Text style={styles.meta}>Reviewed By: {report.reviewedByName} | {formatDate(report.reviewedAt)}</Text>
            ) : null}
            {report.resolvedByName ? (
              <Text style={styles.meta}>Resolved By: {report.resolvedByName} | {formatDate(report.resolvedAt)}</Text>
            ) : null}
            {report.description ? <Text style={styles.description}>{report.description}</Text> : null}
          </View>

          {/* Target record */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Reported Target</Text>
            <Text style={styles.meta}>Type: {formatType(report.type)}</Text>
            {report.targetType ? <Text style={styles.meta}>Target Type: {formatType(report.targetType)}</Text> : null}
            {report.targetReference ? <Text style={styles.meta}>Reference: {report.targetReference}</Text> : null}
            {report.chatContextLabel ? <Text style={styles.meta}>Source: {report.chatContextLabel}</Text> : null}
            {report.source === "support_chatbot_moderation_report" ? (
              <Text style={styles.meta}>Support Source: Chatbot moderation report</Text>
            ) : null}
            {report.chatMessageId ? <Text style={styles.meta}>Chat Message ID: {report.chatMessageId}</Text> : null}
            {report.teamChallengeChatId ? <Text style={styles.meta}>Team Challenge Chat: {report.teamChallengeChatId}</Text> : null}
            {report.teamChallengeChatMessageId ? <Text style={styles.meta}>Team Challenge Message ID: {report.teamChallengeChatMessageId}</Text> : null}
            {report.supportTicketId ? <Text style={styles.meta}>Support Ticket ID: {report.supportTicketId}</Text> : null}
            {report.supportConversationId ? <Text style={styles.meta}>Support Conversation ID: {report.supportConversationId}</Text> : null}
            {report.reportedUserName ? (
              <Text style={styles.meta}>
                User: {report.reportedUserName}
                {report.reportedUserStatus ? ` (${formatType(report.reportedUserStatus)})` : ""}
              </Text>
            ) : null}
            {report.zoneName ? (
              <Text style={styles.meta}>
                Zone: {report.zoneName}
                {report.zoneStatus ? ` (${formatType(report.zoneStatus)})` : ""}
              </Text>
            ) : null}
            {report.branchLabel ? <Text style={styles.meta}>Branch: {report.branchLabel}</Text> : null}
            {report.matchroomTitle ? (
              <Text style={styles.meta}>
                Matchroom: {report.matchroomTitle}
                {report.matchroomStatus ? ` (${formatType(report.matchroomStatus)})` : ""}
              </Text>
            ) : null}
            {report.game ? <Text style={styles.meta}>Game: {report.game.toUpperCase()}</Text> : null}
            {report.messagePreview ? (
              <>
                <Text style={styles.contextLabel}>Message Preview</Text>
                <Text style={styles.contextValue}>{report.messagePreview}</Text>
              </>
            ) : null}
            {report.targetMissing ? (
              <View style={styles.banner}>
                <Text style={styles.bannerText}>Record no longer available</Text>
              </View>
            ) : null}
            {report.flaggedForReview ? (
              <View style={styles.flagPill}>
                <Text style={styles.flagText}>Flagged for review</Text>
              </View>
            ) : null}
            {relatedRecordLabel ? (
              <Pressable style={[styles.secondaryButton, styles.openButton]} onPress={openRelatedRecord}>
                <Text style={styles.secondaryButtonText}>{relatedRecordLabel}</Text>
              </Pressable>
            ) : null}
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

          {moderationNotes.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Moderation Notes</Text>
              {moderationNotes.map((entry) => (
                <View key={entry.id} style={styles.noteItem}>
                  <Text style={styles.noteMeta}>
                    {entry.authorName || "Super Admin"}
                    {entry.action ? ` · ${formatType(entry.action)}` : ""} · {formatDate(entry.createdAt)}
                  </Text>
                  <Text style={styles.contextValue}>{entry.note}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {notice ? (
            <View style={[styles.banner, styles.bannerSuccess]}>
              <Text style={styles.bannerText}>{notice}</Text>
            </View>
          ) : null}
          {error && report ? (
            <View style={[styles.banner, styles.bannerError]}>
              <Text style={styles.bannerText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Moderation Actions</Text>
            <Text style={styles.helperText}>
              Context-aware actions for this report. Destructive actions require a reason and a confirmation.
            </Text>
            <View style={styles.actionRow}>
              {moderationActions.map((action) => (
                <Pressable
                  key={action.key}
                  style={[
                    action.variant === "danger"
                      ? styles.dangerButton
                      : action.variant === "primary"
                        ? styles.primaryButton
                        : styles.secondaryButton,
                    activeAction && activeAction.key === action.key ? styles.activeAction : null,
                  ]}
                  onPress={() => openAction(action)}
                  disabled={busyAction !== null || busyStatus !== null}
                >
                  <Text style={action.variant === "danger" || action.variant === "primary" ? styles.dangerButtonText : styles.secondaryButtonText}>
                    {action.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.divider} />

            <View style={styles.actionRow}>
              {report.status !== "reviewed" ? (
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => openStatusComposer("reviewed")}
                  disabled={busyStatus !== null || busyAction !== null}
                >
                  <Text style={styles.secondaryButtonText}>Mark Reviewed</Text>
                </Pressable>
              ) : null}
              {report.status !== "resolved" ? (
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => openStatusComposer("resolved")}
                  disabled={busyStatus !== null || busyAction !== null}
                >
                  <Text style={styles.primaryButtonText}>Resolve</Text>
                </Pressable>
              ) : null}
              {report.status !== "pending" ? (
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => openStatusComposer("pending")}
                  disabled={busyStatus !== null || busyAction !== null}
                >
                  <Text style={styles.secondaryButtonText}>Reopen</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {activeAction ? (
            <View style={[styles.card, activeAction.destructive ? styles.dangerCard : null]}>
              <Text style={styles.sectionTitle}>{activeAction.composerTitle}</Text>
              <Text style={styles.helperText}>{activeAction.composerHint}</Text>
              {activeAction.destructive ? (
                <Text style={styles.warningText}>This is a destructive action.</Text>
              ) : null}

              {activeAction.reasonRequired || activeAction.reasonOptional ? (
                <>
                  <Text style={styles.inputLabel}>
                    {activeAction.reasonRequired ? "Reason / Note (required)" : "Note (optional)"}
                  </Text>
                  <TextInput
                    value={actionText}
                    onChangeText={setActionText}
                    placeholder={activeAction.placeholder || "Add context for the moderation trail."}
                    placeholderTextColor={COLORS.textSecondary}
                    style={[styles.input, styles.multilineInput]}
                    multiline
                    textAlignVertical="top"
                  />
                </>
              ) : null}

              <View style={styles.actionRow}>
                <Pressable style={styles.secondaryButton} onPress={closeAction} disabled={busyAction !== null}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={activeAction.destructive ? styles.dangerButton : styles.primaryButton}
                  onPress={runActiveAction}
                  disabled={busyAction !== null}
                >
                  {busyAction === activeAction.key ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.dangerButtonText}>{activeAction.confirmLabel}</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}

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
  dangerCard: {
    borderColor: COLORS.error,
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
  flagPill: {
    alignSelf: "flex-start",
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.error,
    backgroundColor: COLORS.overlayLight,
  },
  flagText: {
    color: COLORS.error,
    fontFamily: FONTS.interSemiBold,
    fontSize: 11,
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
  warningText: {
    color: COLORS.error,
    fontFamily: FONTS.interSemiBold,
    fontSize: 13,
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
  noteItem: {
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    paddingTop: SPACING.sm,
    gap: 4,
  },
  noteMeta: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interSemiBold,
    fontSize: 11,
  },
  banner: {
    borderRadius: RADII.lg,
    borderWidth: 1,
    padding: SPACING.md,
  },
  bannerSuccess: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.overlayLight,
  },
  bannerError: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.overlayLight,
  },
  bannerText: {
    color: COLORS.text,
    fontFamily: FONTS.martelRegular,
    fontSize: 13,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.cardBorder,
    marginTop: SPACING.md,
  },
  openButton: {
    alignSelf: "flex-start",
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
  activeAction: {
    borderColor: COLORS.accent,
    borderWidth: 1,
  },
});
