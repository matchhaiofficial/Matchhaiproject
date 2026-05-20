import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  AdminInfoLine,
  AdminPageHeader,
  AdminSectionHeader,
  AdminStatusBadge,
} from "../../../src/components/AdminSurface";
import { AppCard } from "../../../src/components/AppPrimitives";
import Screen from "../../../src/components/Screen";
import {
  getReports,
  getSuperAdminMatchroomById,
  SuperAdminMatchroom,
  SuperAdminReport,
} from "../../../src/services/convex/superAdminService";
import { COLORS, FONTS, SPACING } from "../../../src/theme";

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

function formatValue(value?: string | number | boolean | null) {
  if (value === undefined || value === null || value === "") return "N/A";
  return String(value).replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatSchedule(room: SuperAdminMatchroom) {
  return [room.scheduledDate, room.scheduledTime].filter(Boolean).join(" ") || "N/A";
}

function toneForStatus(value?: string | null) {
  const normalized = String(value || "").toLowerCase();
  if (["paid", "confirmed", "completed", "resolved", "approved", "zone_confirmed"].includes(normalized)) return "success" as const;
  if (["pending", "waiting_lobby_fill", "waiting_zone_approval", "participant_vote", "admin_review", "in_review"].includes(normalized)) return "warning" as const;
  if (["cancelled", "expired", "cancelled_expired", "failed", "rejected", "refunded"].includes(normalized)) return "danger" as const;
  if (["in-progress", "created_open", "open", "reviewed"].includes(normalized)) return "info" as const;
  return "neutral" as const;
}

function getAny(source: unknown, keys: string[]) {
  const record = (source || {}) as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function formatMoney(value: unknown, currency?: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return `${currency ? String(currency).toUpperCase() : "PKR"} ${value.toLocaleString()}`;
}

function pricingSummary(pricing: unknown) {
  if (!pricing || typeof pricing !== "object") return "Not available";
  const record = pricing as Record<string, unknown>;
  const currency = getAny(record, ["currency", "currencyCode"]);
  const perPlayer = getAny(record, ["perPlayerAmount", "amountPerPlayer", "pricePerPlayer", "perPlayerPrice"]);
  const total = getAny(record, ["totalAmount", "amount", "price"]);
  return formatMoney(perPlayer, currency) || formatMoney(total, currency) || "Present (summary unavailable)";
}

function statusSummary(value: unknown) {
  return value === undefined || value === null || value === "" ? "Not available" : formatValue(String(value));
}

function slotDisplayName(slot: any) {
  return (
    slot?.user?.username ||
    slot?.user?.displayName ||
    slot?.reservedFor?.username ||
    slot?.reservedFor?.displayName ||
    slot?.username ||
    null
  );
}

function slotStatusLabel(slot: any) {
  const status = String(slot?.status || "").toLowerCase();
  if (!slotDisplayName(slot) && (!status || status === "open")) return "Available";
  return formatValue(status || "N/A");
}

function rosterFlags(item: any) {
  return [
    item?.paymentStatus ? `Payment: ${formatValue(item.paymentStatus)}` : null,
    item?.verificationStatus ? `Verification: ${formatValue(item.verificationStatus)}` : null,
    item?.resultVerificationStatus ? `Result: ${formatValue(item.resultVerificationStatus)}` : null,
    item?.skillTier ? `Skill: ${formatValue(item.skillTier)}` : null,
    item?.user?.skillTier ? `Skill: ${formatValue(item.user.skillTier)}` : null,
  ].filter(Boolean).join(" | ");
}

function roleLabel(item: any, hostName?: string | null) {
  const role = item?.role ? formatValue(item.role) : "";
  const name = slotDisplayName(item) || item?.username;
  const host = hostName && name && String(name).toLowerCase() === String(hostName).toLowerCase();
  return [role, host ? "Host" : null].filter(Boolean).join(" | ");
}

function TeamSlotRows({
  title,
  slots,
  hostName,
}: {
  title: string;
  slots?: any[];
  hostName?: string | null;
}) {
  return (
    <View style={styles.teamBlock}>
      <Text style={styles.teamTitle}>{title}</Text>
      {slots?.length ? (
        slots.map((slot, index) => {
          const displayName = slotDisplayName(slot);
          const subtitle = [roleLabel(slot, hostName), rosterFlags(slot)].filter(Boolean).join(" | ");
          return (
            <View key={slot?.slotId || `${title}-${index}`} style={styles.rosterRow}>
              <View style={styles.rosterTextWrap}>
                <Text style={styles.rosterName}>{displayName || `Slot ${slot?.slotId || index + 1}`}</Text>
                {subtitle ? <Text style={styles.rosterMeta}>{subtitle}</Text> : null}
              </View>
              <AdminStatusBadge tone={toneForStatus(slot?.status)} label={slotStatusLabel(slot)} />
            </View>
          );
        })
      ) : (
        <AdminInfoLine label={title} value="No slot data available" />
      )}
    </View>
  );
}

function PlayerFallbackRows({
  players,
  hostName,
}: {
  players?: any[];
  hostName?: string | null;
}) {
  if (!players?.length) return <AdminInfoLine label="Players array" value="No fallback player list available" />;
  return (
    <View style={styles.teamBlock}>
      <Text style={styles.teamTitle}>Players fallback</Text>
      {players.map((player, index) => {
        const subtitle = [roleLabel(player, hostName), rosterFlags(player)].filter(Boolean).join(" | ");
        return (
          <View key={player?.uid || `player-${index}`} style={styles.rosterRow}>
            <View style={styles.rosterTextWrap}>
              <Text style={styles.rosterName}>{player?.username || `Player ${index + 1}`}</Text>
              {subtitle ? <Text style={styles.rosterMeta}>{subtitle}</Text> : null}
            </View>
            {player?.joinedAt ? <Text style={styles.rosterMeta}>{formatDate(player.joinedAt)}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

export default function SuperAdminMatchroomDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const matchroomId = String(params.id || "");
  const [room, setRoom] = useState<SuperAdminMatchroom | null>(null);
  const [linkedReports, setLinkedReports] = useState<SuperAdminReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLinkedReports([]);
      setReportsError(null);
      setReportsLoading(false);
      const result = await getSuperAdminMatchroomById(matchroomId);
      if (cancelled) return;
      if (result.ok) {
        setRoom(result.data);
        setError(result.data ? null : "Matchroom not found.");
      } else {
        setError(result.message);
      }
      setLoading(false);

      if (result.ok && result.data) {
        setReportsLoading(true);
        const reportsResult = await getReports();
        if (cancelled) return;
        if (reportsResult.ok) {
          setLinkedReports(reportsResult.data.filter((report) => String(report.matchroomId || "") === matchroomId));
          setReportsError(null);
        } else {
          setReportsError(reportsResult.message);
        }
        setReportsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [matchroomId]);

  const roomAny = (room || {}) as Record<string, any>;
  const hostName = room?.hostUserName || room?.hostName || null;
  const hasSlots = Boolean(room?.slotsA?.length || room?.slotsB?.length);
  const linkedReportStatuses = linkedReports.length
    ? linkedReports.reduce<Record<string, number>>((acc, report) => {
        acc[report.status] = (acc[report.status] || 0) + 1;
        return acc;
      }, {})
    : null;

  return (
    <Screen style={styles.screen} scroll={false}>
      <AdminPageHeader title="Lobby Details" subtitle="Read-only operational review" onBack={() => router.back()} inlineTitle />
      {loading ? (
        <View style={styles.loaderWrap}><ActivityIndicator color={COLORS.accent} /></View>
      ) : error || !room ? (
        <View style={styles.emptyWrap}><Text style={styles.emptyTitle}>{error || "Matchroom not found."}</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <AppCard variant="elevated" style={styles.card}>
            <AdminSectionHeader
              title="Overview"
              subtitle={room.title}
              compact
              accessory={<AdminStatusBadge tone={toneForStatus(room.lifecycleStatus)} label={lifecycleLabel(room.lifecycleStatus)} />}
            />
            {room.description ? <Text style={styles.description}>{room.description}</Text> : null}
            <View style={styles.infoStack}>
              <AdminInfoLine label="Game" value={String(room.game || "N/A").toUpperCase()} />
              <AdminInfoLine label="Schedule" value={formatSchedule(room)} />
              <AdminInfoLine label="Scheduled start" value={formatDate(room.scheduledStartAt)} />
              <AdminInfoLine label="Status" value={formatValue(room.status)} />
              <AdminInfoLine label="Location" value={room.location || "N/A"} />
              <AdminInfoLine label="Zone" value={room.zoneName || "N/A"} />
              <AdminInfoLine label="Host" value={hostName || "N/A"} />
            </View>
          </AppCard>

          <AppCard variant="elevated" style={styles.card}>
            <AdminSectionHeader
              title="Teams & players"
              subtitle={`${room.currentPlayers || 0}/${room.maxPlayers || 0} players`}
              compact
            />
            <View style={styles.infoStack}>
              <AdminInfoLine label="Players" value={`${room.currentPlayers || 0}/${room.maxPlayers || 0}`} />
              <AdminInfoLine label="Slot data" value={hasSlots ? "Available" : "Not available"} />
            </View>
            <TeamSlotRows title="Team A" slots={room.slotsA} hostName={hostName} />
            <TeamSlotRows title="Team B" slots={room.slotsB} hostName={hostName} />
            {!hasSlots ? <PlayerFallbackRows players={room.players} hostName={hostName} /> : null}
          </AppCard>

          <AppCard variant="elevated" style={styles.card}>
            <AdminSectionHeader title="Booking / venue" compact />
            <View style={styles.infoStack}>
              <AdminInfoLine label="Mode" value={statusSummary(roomAny.locationMode)} />
              <AdminInfoLine label="Broadcast request" value={formatValue(room.broadcastRequestStatus)} />
              <AdminInfoLine label="Zone approval" value={room.zoneAdminApproved === true ? "Approved" : "Pending / not required"} />
              <AdminInfoLine label="Confirmed zone" value={statusSummary(roomAny.confirmedZoneName || roomAny.confirmedZoneId)} />
              <AdminInfoLine label="Confirmed branch" value={statusSummary(roomAny.confirmedBranchName || roomAny.confirmedBranchId || roomAny.branchLabel)} />
              <AdminInfoLine label="Venue confirmed" value={formatDate(roomAny.venueConfirmedAt)} />
              <AdminInfoLine label="Offer / counter-offer" value={statusSummary(roomAny.offerStatus || roomAny.counterOfferStatus || roomAny.bookingOfferStatus)} />
              <AdminInfoLine label="Lock state" value={statusSummary(roomAny.lockStatus || roomAny.lockedAt || roomAny.lockAt)} />
            </View>
          </AppCard>

          <AppCard variant="elevated" style={styles.card}>
            <AdminSectionHeader
              title="Payments"
              compact
              accessory={<AdminStatusBadge tone={toneForStatus(room.paymentStatus)} label={formatValue(room.paymentStatus)} />}
            />
            <View style={styles.infoStack}>
              <AdminInfoLine label="Payment status" value={formatValue(room.paymentStatus)} />
              <AdminInfoLine label="Pricing summary" value={pricingSummary(room.pricing)} />
              <AdminInfoLine label="Held / captured / refunded" value={statusSummary(roomAny.paymentHoldStatus || roomAny.captureStatus || roomAny.refundStatus)} />
              <AdminInfoLine label="Booking intent" value={statusSummary(roomAny.bookingIntentStatus || roomAny.bookingIntentCount)} />
              <AdminInfoLine label="Venue payout" value={statusSummary(roomAny.venuePayoutStatus)} />
            </View>
          </AppCard>

          <AppCard variant="elevated" style={styles.card}>
            <AdminSectionHeader title="Chat review" compact />
            <View style={styles.infoStack}>
              <AdminInfoLine label="Preview" value="Chat preview not available yet" />
              <AdminInfoLine label="Backend follow-up" value="Expose Super Admin-safe read-only latest messages" />
            </View>
          </AppCard>

          <AppCard variant="elevated" style={styles.card}>
            <AdminSectionHeader
              title="Reports & disputes"
              subtitle={reportsLoading ? "Loading linked reports" : `${linkedReports.length} linked reports`}
              compact
            />
            <View style={styles.infoStack}>
              <AdminInfoLine label="Linked reports" value={reportsLoading ? "Loading..." : String(linkedReports.length)} />
              <AdminInfoLine label="Report statuses" value={linkedReportStatuses ? Object.entries(linkedReportStatuses).map(([status, count]) => `${formatValue(status)}: ${count}`).join(", ") : "None linked"} />
              <AdminInfoLine label="Result verification" value={formatValue(room.resultVerificationStatus)} />
              <AdminInfoLine label="Dispute / admin review" value={room.resultVerificationStatus === "admin_review" ? "Admin review required" : "No admin review flag in payload"} />
              {reportsError ? <AdminInfoLine label="Reports load" value={reportsError} /> : null}
            </View>
          </AppCard>

          <AppCard variant="elevated" style={styles.card}>
            <AdminSectionHeader
              title="Result / completion"
              compact
              accessory={<AdminStatusBadge tone={toneForStatus(room.lifecycleStatus)} label={lifecycleLabel(room.lifecycleStatus)} />}
            />
            <View style={styles.infoStack}>
              <AdminInfoLine label="Lifecycle" value={lifecycleLabel(room.lifecycleStatus)} />
              <AdminInfoLine label="Completion status" value={room.lifecycleStatus === "completed" || room.status === "completed" ? "Completed" : "Not completed"} />
              <AdminInfoLine label="Result verification" value={formatValue(room.resultVerificationStatus)} />
              <AdminInfoLine label="Issues detected" value={linkedReports.length || room.resultVerificationStatus === "admin_review" ? "Review linked reports / result state" : "No linked issues in available payload"} />
            </View>
          </AppCard>

          <AppCard variant="elevated" style={styles.card}>
            <AdminSectionHeader title="Metadata" compact />
            <View style={styles.infoStack}>
              <AdminInfoLine label="Match code" value={room.matchCode || "N/A"} />
              <AdminInfoLine label="Matchroom ID" value={matchroomId} />
              <AdminInfoLine label="Created" value={formatDate(room.createdAt)} />
              <AdminInfoLine label="Updated" value={formatDate(room.updatedAt)} />
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
  description: { color: COLORS.textSecondary, fontFamily: FONTS.martelRegular, fontSize: 14, lineHeight: 22 },
  infoStack: { gap: SPACING.sm },
  teamBlock: { gap: SPACING.sm },
  teamTitle: { color: COLORS.text, fontFamily: FONTS.heading, fontSize: 15 },
  rosterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    paddingVertical: SPACING.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
  },
  rosterTextWrap: { flex: 1, minWidth: 0 },
  rosterName: { color: COLORS.text, fontFamily: FONTS.body, fontSize: 14 },
  rosterMeta: { color: COLORS.textSecondary, fontFamily: FONTS.body, fontSize: 12, lineHeight: 17, marginTop: 2 },
});

