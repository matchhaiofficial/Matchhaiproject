import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import AppHeader from "../../../src/components/AppHeader";
import { AdminInfoLine } from "../../../src/components/AdminSurface";
import Screen from "../../../src/components/Screen";
import { useToast } from "../../../src/hooks/useToast";
import {
  getSupportTicketById,
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

  const knownDetails = useMemo(() => {
    const details = ticket?.metadataSummary?.knownNonSensitiveDetails || {};
    return Object.entries(details).filter(([, value]) => value !== undefined && value !== null && value !== "");
  }, [ticket]);

  return (
    <Screen style={styles.screen} scroll={false}>
      <AppHeader title="Support Ticket" onBack={() => router.back()} inlineTitle />

      {loading ? (
        <View style={styles.loaderWrap}><ActivityIndicator color={COLORS.accent} /></View>
      ) : error || !ticket ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>{error || "Support ticket not found."}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
            <AdminInfoLine label="Source" value={formatValue(ticket.source)} />
            <AdminInfoLine label="Created" value={formatDate(ticket.createdAt)} />
            <AdminInfoLine label="Updated" value={formatDate(ticket.updatedAt)} />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Conversation Excerpt</Text>
            <Text style={styles.helperText}>Rendered as stored after support-chat redaction.</Text>
            {ticket.conversationExcerpt?.length ? (
              ticket.conversationExcerpt.map((message, index) => (
                <View key={`${message.role}-${index}`} style={styles.messageRow}>
                  <Text style={styles.messageRole}>{message.role === "assistant" ? "Support" : "User"}</Text>
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
            <Text style={styles.helperText}>No reply or email sending is wired yet. These actions only update ticket status.</Text>
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
  primaryButton: { minHeight: 44, minWidth: 124, paddingHorizontal: SPACING.lg, borderRadius: RADII.lg, backgroundColor: COLORS.accent, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: "#fff", fontFamily: FONTS.interSemiBold, fontSize: 14 },
  secondaryButton: { minHeight: 44, minWidth: 124, paddingHorizontal: SPACING.lg, borderRadius: RADII.lg, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.overlayLight, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: COLORS.text, fontFamily: FONTS.interSemiBold, fontSize: 14 },
});
