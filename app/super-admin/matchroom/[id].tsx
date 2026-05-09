import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import AppHeader from "../../../src/components/AppHeader";
import { AdminInfoLine } from "../../../src/components/AdminSurface";
import { AppButton, AppCard, StatusPill } from "../../../src/components/AppPrimitives";
import Screen from "../../../src/components/Screen";
import { getSuperAdminMatchroomById, SuperAdminMatchroom } from "../../../src/services/convex/superAdminService";
import { COLORS, FONTS, RADII, SPACING } from "../../../src/theme";

function lifecycleLabel(value?: string | null) {
  switch (value) {
    case "waiting_lobby_fill": return "Waiting lobby fill";
    case "waiting_zone_approval": return "Waiting zone approval";
    case "confirmed": return "Confirmed";
    case "in-progress": return "In-progress";
    case "completed": return "Completed";
    case "cancelled_expired": return "Cancelled / Expired";
    default: return "Created / Open";
  }
}

function formatDate(value?: number | null) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

export default function SuperAdminMatchroomDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const matchroomId = String(params.id || "");
  const [room, setRoom] = useState<SuperAdminMatchroom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const result = await getSuperAdminMatchroomById(matchroomId);
      if (cancelled) return;
      if (result.ok) {
        setRoom(result.data);
        setError(result.data ? null : "Matchroom not found.");
      } else {
        setError(result.message);
      }
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [matchroomId]);

  return (
    <Screen style={styles.screen} scroll={false}>
      <AppHeader title="Lobby Details" onBack={() => router.back()} inlineTitle />
      {loading ? (
        <View style={styles.loaderWrap}><ActivityIndicator color={COLORS.accent} /></View>
      ) : error || !room ? (
        <View style={styles.emptyWrap}><Text style={styles.emptyTitle}>{error || "Matchroom not found."}</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <AppCard style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{room.title}</Text>
              <StatusPill tone="info" label={lifecycleLabel(room.lifecycleStatus)} />
            </View>
            {room.description ? <Text style={styles.description}>{room.description}</Text> : null}
            <View style={styles.infoStack}>
              <AdminInfoLine label="Game" value={String(room.game || "N/A").toUpperCase()} />
              <AdminInfoLine label="Date/time" value={[room.scheduledDate, room.scheduledTime].filter(Boolean).join(" ") || "N/A"} />
              <AdminInfoLine label="Location" value={room.location || "N/A"} />
              <AdminInfoLine label="Zone" value={room.zoneName || "N/A"} />
              <AdminInfoLine label="Host" value={room.hostUserName || room.hostName || "N/A"} />
              <AdminInfoLine label="Players" value={`${room.currentPlayers || 0}/${room.maxPlayers || 0}`} />
              <AdminInfoLine label="Payment" value={room.paymentStatus || "N/A"} />
              <AdminInfoLine label="Zone approval" value={room.zoneAdminApproved === true ? "Approved" : "Pending / not required"} />
              <AdminInfoLine label="Broadcast request" value={room.broadcastRequestStatus || "N/A"} />
              <AdminInfoLine label="Result verification" value={room.resultVerificationStatus || "N/A"} />
              <AdminInfoLine label="Match code" value={room.matchCode || "N/A"} />
              <AdminInfoLine label="Created" value={formatDate(room.createdAt)} />
            </View>
          </AppCard>

          <AppCard style={styles.card}>
            <Text style={styles.sectionTitle}>Moderation</Text>
            <Text style={styles.helperText}>
              Read-only visibility is enabled. Matchroom cancellation and flagging require backend support before they can be safely wired.
            </Text>
            <View style={styles.actionsRow}>
              <AppButton variant="secondary" disabled>Flag matchroom - Coming soon</AppButton>
              <AppButton variant="danger" disabled>Cancel matchroom - Requires backend support</AppButton>
            </View>
          </AppCard>
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
  content: { gap: SPACING.md, paddingBottom: SPACING.xxl },
  card: { gap: SPACING.md },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.md },
  title: { flex: 1, color: COLORS.text, fontFamily: FONTS.heading, fontSize: 20 },
  description: { color: COLORS.textSecondary, fontFamily: FONTS.martelRegular, fontSize: 14, lineHeight: 22 },
  infoStack: { gap: SPACING.sm },
  sectionTitle: { color: COLORS.text, fontFamily: FONTS.heading, fontSize: 16 },
  helperText: { color: COLORS.textSecondary, fontFamily: FONTS.martelRegular, fontSize: 13, lineHeight: 20 },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
});

