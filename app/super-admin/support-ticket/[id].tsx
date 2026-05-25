import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import AppHeader from "../../../src/components/AppHeader";
import { AdminInfoLine } from "../../../src/components/AdminSurface";
import Screen from "../../../src/components/Screen";
import { useToast } from "../../../src/hooks/useToast";
import {
  addSupportTicketInternalNote,
  assignSupportTicket,
  getSupportTicketById,
  replyToSupportTicketUser,
  resolveSupportTicket,
  type SuperAdminSupportTicket,
  type SuperAdminSupportTicketStatus,
  updateSupportTicketStatus,
} from "../../../src/services/convex/superAdminService";
import { COLORS, FONTS, RADII, SPACING } from "../../../src/theme";

function formatDate(value?: number) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

function formatValue(value?: string | null) {
  return String(value || "N/A").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusLabel(status?: SuperAdminSupportTicketStatus) {
  if (status === "in_review") return "In Review";
  if (status === "resolved") return "Resolved";
  return "Open";
}

function MetadataBlock({ title, rows }: { title: string; rows?: Array<Record<string, unknown>> }) {
  if (!rows?.length) return null;
  return (
    <View style={styles.metadataBlock}>
      <Text style={styles.contextLabel}>{title}</Text>
      {rows.map((row, index) => (
        <View key={`${title}-${index}`} style={styles.metadataItem}>
          {Object.entries(row).map(([key, value]) => (
            value === undefined || value === null || value === "" ? null : (
              <Text key={key} style={styles.metadataText}>
                {formatValue(key)}: {String(value)}
              </Text>
            )
          ))}
        </View>
      ))}
    </View>
  );
}

export default function SuperAdminSupportTicketDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const ticketId = String(params.id || "");
  const { showToast } = useToast();
  const [ticket, setTicket] = useState<SuperAdminSupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyStatus, setBusyStatus] = useState<SuperAdminSupportTicketStatus | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [resolutionText, setResolutionText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadTicket = async () => {
    if (!ticketId) {
      setError("Support ticket not found.");
      setLoading(false);
      return;
    }

    setLoading(true);
    const result = await getSupportTicketById(ticketId);
    if (result.ok) {
      setTicket(result.data);
      setError(result.data ? null : "Support ticket not found.");
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadTicket();
  }, [ticketId]);

  const updateStatus = async (status: SuperAdminSupportTicketStatus) => {
    if (!ticket) return;
    setBusyStatus(status);
    const result = await updateSupportTicketStatus(ticket.id, status);
    setBusyStatus(null);
    if (result.ok) {
      showToast({ type: "success", title: "Ticket updated", message: `Marked ${statusLabel(status)}.` });
      await loadTicket();
    } else {
      showToast({ type: "error", title: "Update failed", message: result.message });
    }
  };

  const submitInternalNote = async () => {
    if (!ticket || !noteText.trim()) return;
    setBusyAction("note");
    const result = await addSupportTicketInternalNote(ticket.id, noteText.trim());
    setBusyAction(null);
    if (result.ok) {
      setNoteText("");
      showToast({ type: "success", title: "Note added", message: "Internal note saved." });
      await loadTicket();
    } else {
      showToast({ type: "error", title: "Note failed", message: result.message });
    }
  };

  const submitReply = async () => {
    if (!ticket || !replyText.trim()) return;
    setBusyAction("reply");
    const result = await replyToSupportTicketUser(ticket.id, replyText.trim());
    setBusyAction(null);
    if (result.ok) {
      setReplyText("");
      showToast({ type: "success", title: "Reply sent", message: "The user will see this in Help & Support." });
      await loadTicket();
    } else {
      showToast({ type: "error", title: "Reply failed", message: result.message });
    }
  };

  const assignToMe = async () => {
    if (!ticket) return;
    setBusyAction("assign");
    const result = await assignSupportTicket(ticket.id);
    setBusyAction(null);
    if (result.ok) {
      showToast({ type: "success", title: "Assigned", message: "Ticket assigned to you." });
      await loadTicket();
    } else {
      showToast({ type: "error", title: "Assign failed", message: result.message });
    }
  };

  const submitResolution = async () => {
    if (!ticket || !resolutionText.trim()) return;
    setBusyAction("resolve");
    const result = await resolveSupportTicket(ticket.id, resolutionText.trim());
    setBusyAction(null);
    if (result.ok) {
      setResolutionText("");
      showToast({ type: "success", title: "Ticket resolved", message: "Resolution summary saved." });
      await loadTicket();
    } else {
      showToast({ type: "error", title: "Resolve failed", message: result.message });
    }
  };

  const knownDetails = useMemo(() => {
    const details = ticket?.metadataSummary?.knownNonSensitiveDetails || {};
    return Object.entries(details).filter(([, value]) => value !== undefined && value !== null && value !== "");
  }, [ticket]);

  return (
    <Screen style={styles.screen} scroll={false} keyboardAvoiding>
      <AppHeader title="Support Ticket" onBack={() => router.back()} inlineTitle />

      {loading ? (
        <View style={styles.loaderWrap}><ActivityIndicator color={COLORS.accent} /></View>
      ) : error || !ticket ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>{error || "Support ticket not found."}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={styles.titleWrap}>
                <Text style={styles.reference}>{ticket.reference}</Text>
                <Text style={styles.issueSummary}>{ticket.issueSummary}</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>{statusLabel(ticket.status)}</Text>
              </View>
            </View>
            <AdminInfoLine label="User" value={ticket.userDisplayName || "Unknown user"} />
            {ticket.userEmail ? <AdminInfoLine label="Email" value={ticket.userEmail} /> : null}
            <AdminInfoLine label="User role" value={formatValue(ticket.userRole)} />
            <AdminInfoLine label="Category" value={formatValue(ticket.category)} />
            {ticket.subcategory ? <AdminInfoLine label="Subcategory" value={formatValue(ticket.subcategory)} /> : null}
            {ticket.intent ? <AdminInfoLine label="AI intent" value={formatValue(ticket.intent)} /> : null}
            {ticket.priority ? <AdminInfoLine label="Priority" value={formatValue(ticket.priority)} /> : null}
            <AdminInfoLine label="Source" value={formatValue(ticket.source)} />
            <AdminInfoLine label="Email status" value={formatValue(ticket.metadataSummary?.emailStatus || "not_configured")} />
            {ticket.assignedAdminName ? <AdminInfoLine label="Assigned admin" value={ticket.assignedAdminName} /> : null}
            {ticket.lastAdminResponseAt ? <AdminInfoLine label="Last admin reply" value={formatDate(ticket.lastAdminResponseAt)} /> : null}
            {ticket.lastUserResponseAt ? <AdminInfoLine label="Last user response" value={formatDate(ticket.lastUserResponseAt)} /> : null}
            {ticket.resolutionSummary ? <AdminInfoLine label="Resolution" value={ticket.resolutionSummary} /> : null}
            <AdminInfoLine label="Created" value={formatDate(ticket.createdAt)} />
            <AdminInfoLine label="Updated" value={formatDate(ticket.updatedAt)} />
          </View>

          {(ticket.suggestedAdminAction || ticket.relatedMatchroomId || ticket.relatedPaymentId || ticket.relatedBookingId || ticket.relatedZoneId || ticket.metadataSummary?.aiSummary) ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>AI Triage</Text>
              {ticket.metadataSummary?.aiSummary ? <AdminInfoLine label="Summary" value={String(ticket.metadataSummary.aiSummary)} /> : null}
              {ticket.suggestedAdminAction ? <AdminInfoLine label="Suggested action" value={ticket.suggestedAdminAction} /> : null}
              {ticket.relatedMatchroomId ? <AdminInfoLine label="Matchroom ID" value={ticket.relatedMatchroomId} /> : null}
              {ticket.relatedPaymentId ? <AdminInfoLine label="Payment ID" value={ticket.relatedPaymentId} /> : null}
              {ticket.relatedBookingId ? <AdminInfoLine label="Booking ID" value={ticket.relatedBookingId} /> : null}
              {ticket.relatedTeamId ? <AdminInfoLine label="Team ID" value={ticket.relatedTeamId} /> : null}
              {ticket.relatedZoneId ? <AdminInfoLine label="Zone ID" value={ticket.relatedZoneId} /> : null}
              {ticket.internalTags?.length ? <AdminInfoLine label="Internal tags" value={ticket.internalTags.join(", ")} /> : null}
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Conversation Excerpt</Text>
            <Text style={styles.helperText}>Rendered as stored after support-chat redaction.</Text>
            {(ticket.conversationMessages?.length ? ticket.conversationMessages : ticket.conversationExcerpt)?.length ? (
              (ticket.conversationMessages?.length ? ticket.conversationMessages : ticket.conversationExcerpt || []).map((message: any, index) => (
                <View key={`${message.role}-${index}`} style={styles.messageRow}>
                  <Text style={styles.messageRole}>{message.role === "user" ? "User" : message.role === "admin" ? "Admin Reply" : "Support"}</Text>
                  <Text style={styles.messageText}>{message.text}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No conversation excerpt available.</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Safe Context</Text>
            {knownDetails.length ? (
              <View style={styles.metadataItem}>
                {knownDetails.map(([key, value]) => (
                  <Text key={key} style={styles.metadataText}>{formatValue(key)}: {String(value)}</Text>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>No extra issue details captured.</Text>
            )}
            {ticket.metadataSummary?.user ? (
              <View style={styles.metadataBlock}>
                <Text style={styles.contextLabel}>User Summary</Text>
                {Object.entries(ticket.metadataSummary.user).map(([key, value]) => (
                  value === undefined || value === null || value === "" ? null : (
                    <Text key={key} style={styles.metadataText}>{formatValue(key)}: {String(value)}</Text>
                  )
                ))}
              </View>
            ) : null}
            <MetadataBlock title="Recent Payments" rows={ticket.metadataSummary?.recentPayments} />
            <MetadataBlock title="Recent Matchrooms" rows={ticket.metadataSummary?.recentMatchrooms} />
            <MetadataBlock title="Zones" rows={ticket.metadataSummary?.zones} />
            <MetadataBlock title="Recent Reports" rows={ticket.metadataSummary?.recentReports} />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Ticket Actions</Text>
            <Text style={styles.helperText}>Replies are sent into the user's Help & Support conversation. Internal notes stay admin-only.</Text>
            {!ticket.assignedAdminId ? (
              <Pressable style={styles.secondaryButton} onPress={assignToMe} disabled={busyAction !== null || busyStatus !== null}>
                {busyAction === "assign" ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.secondaryButtonText}>Assign To Me</Text>}
              </Pressable>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.contextLabel}>Reply to user</Text>
              <TextInput
                value={replyText}
                onChangeText={setReplyText}
                placeholder="Write a user-facing support reply"
                placeholderTextColor={COLORS.textSecondary}
                multiline
                style={styles.textArea}
              />
              <Pressable style={[styles.primaryButton, !replyText.trim() && styles.disabledButton]} onPress={submitReply} disabled={!replyText.trim() || busyAction !== null || busyStatus !== null}>
                {busyAction === "reply" ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Send Reply</Text>}
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.contextLabel}>Internal note</Text>
              <TextInput
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Add an admin-only note"
                placeholderTextColor={COLORS.textSecondary}
                multiline
                style={styles.textArea}
              />
              <Pressable style={[styles.secondaryButton, !noteText.trim() && styles.disabledButton]} onPress={submitInternalNote} disabled={!noteText.trim() || busyAction !== null || busyStatus !== null}>
                {busyAction === "note" ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.secondaryButtonText}>Add Note</Text>}
              </Pressable>
            </View>

            {ticket.internalNotes?.length ? (
              <View style={styles.metadataBlock}>
                <Text style={styles.contextLabel}>Internal Notes</Text>
                {ticket.internalNotes.map((note) => (
                  <View key={note.id} style={styles.metadataItem}>
                    <Text style={styles.metadataText}>{formatDate(note.createdAt)}</Text>
                    <Text style={styles.messageText}>{note.text}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.contextLabel}>Resolution summary</Text>
              <TextInput
                value={resolutionText}
                onChangeText={setResolutionText}
                placeholder="Summarize how this ticket was resolved"
                placeholderTextColor={COLORS.textSecondary}
                multiline
                style={styles.textArea}
              />
              <Pressable style={[styles.primaryButton, !resolutionText.trim() && styles.disabledButton]} onPress={submitResolution} disabled={!resolutionText.trim() || busyAction !== null || busyStatus !== null}>
                {busyAction === "resolve" ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Resolve With Summary</Text>}
              </Pressable>
            </View>

            <View style={styles.actionRow}>
              {ticket.status !== "in_review" ? (
                <Pressable style={styles.secondaryButton} onPress={() => updateStatus("in_review")} disabled={busyStatus !== null}>
                  {busyStatus === "in_review" ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.secondaryButtonText}>Mark In Review</Text>}
                </Pressable>
              ) : null}
              {ticket.status !== "resolved" ? (
                <Pressable style={styles.primaryButton} onPress={() => updateStatus("resolved")} disabled={busyStatus !== null}>
                  {busyStatus === "resolved" ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Mark Resolved</Text>}
                </Pressable>
              ) : null}
              {ticket.status !== "open" ? (
                <Pressable style={styles.secondaryButton} onPress={() => updateStatus("open")} disabled={busyStatus !== null}>
                  {busyStatus === "open" ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.secondaryButtonText}>Reopen</Text>}
                </Pressable>
              ) : null}
            </View>
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.backgroundDark },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  emptyTitle: { color: COLORS.text, fontFamily: FONTS.heading, fontSize: 18, textAlign: "center" },
  emptyText: { color: COLORS.textSecondary, fontFamily: FONTS.martelRegular, fontSize: 13, lineHeight: 20 },
  content: { paddingBottom: SPACING.xxl, gap: SPACING.md },
  card: { backgroundColor: COLORS.cardDark, borderRadius: RADII.xl, borderWidth: 1, borderColor: COLORS.cardBorder, padding: SPACING.lg, gap: SPACING.sm },
  rowBetween: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: SPACING.md },
  titleWrap: { flex: 1, minWidth: 0 },
  reference: { color: COLORS.accent, fontFamily: FONTS.interSemiBold, fontSize: 12 },
  issueSummary: { color: COLORS.text, fontFamily: FONTS.heading, fontSize: 18, lineHeight: 24, marginTop: 4 },
  statusPill: { paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: RADII.pill, borderWidth: 1, borderColor: COLORS.overlayMedium, backgroundColor: COLORS.overlayLight },
  statusText: { color: COLORS.text, fontFamily: FONTS.interSemiBold, fontSize: 11 },
  sectionTitle: { color: COLORS.text, fontFamily: FONTS.heading, fontSize: 16 },
  helperText: { color: COLORS.textSecondary, fontFamily: FONTS.martelRegular, fontSize: 13, lineHeight: 20 },
  messageRow: { gap: 4, paddingVertical: SPACING.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.cardBorder },
  messageRole: { color: COLORS.accent, fontFamily: FONTS.interSemiBold, fontSize: 12 },
  messageText: { color: COLORS.text, fontFamily: FONTS.martelRegular, fontSize: 14, lineHeight: 22 },
  metadataBlock: { gap: 6, marginTop: SPACING.sm },
  metadataItem: { borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: RADII.lg, backgroundColor: COLORS.overlayLight, padding: SPACING.md, gap: 4 },
  contextLabel: { color: COLORS.text, fontFamily: FONTS.interSemiBold, fontSize: 13 },
  metadataText: { color: COLORS.textSecondary, fontFamily: FONTS.martelRegular, fontSize: 13, lineHeight: 20 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginTop: SPACING.sm },
  inputGroup: { gap: SPACING.sm, marginTop: SPACING.md },
  textArea: {
    minHeight: 96,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.overlayLight,
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    padding: SPACING.md,
    textAlignVertical: "top",
  },
  primaryButton: { minHeight: 44, minWidth: 124, paddingHorizontal: SPACING.lg, borderRadius: RADII.lg, backgroundColor: COLORS.accent, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: "#fff", fontFamily: FONTS.interSemiBold, fontSize: 14 },
  secondaryButton: { minHeight: 44, minWidth: 124, paddingHorizontal: SPACING.lg, borderRadius: RADII.lg, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.overlayLight, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: COLORS.text, fontFamily: FONTS.interSemiBold, fontSize: 14 },
  disabledButton: { opacity: 0.45 },
});
