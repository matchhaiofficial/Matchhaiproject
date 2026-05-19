import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { AppIcon } from "../../../../src/components/AppIcon";
import { COLORS } from "../../../../src/theme";
import styles from "../bookings.styles";

type BroadcastHistoryRow = {
  id: string;
  requestId: string;
  matchroomId?: string | null;
  zoneId?: string | null;
  title?: string | null;
  gameKey?: string | null;
  status?: string | null;
  lifecycleStatus?: string | null;
  closedReason?: string | null;
  preferredDate?: number | string | null;
  preferredTime?: string | null;
  targetAreaLabel?: string | null;
  preferredAreas?: string[];
  budgetPerPlayer?: number | null;
  currency?: string | null;
  updatedAt?: number | null;
  createdAt?: number | null;
  offer?: {
    status?: string | null;
    offerType?: string | null;
    expiresAt?: number | null;
    zoneName?: string | null;
    branchName?: string | null;
    resolvedMatchroomId?: string | null;
  } | null;
  matchroom?: {
    broadcastRequestStatus?: string | null;
    confirmedZoneId?: string | null;
    venueConfirmedAt?: number | null;
    location?: string | null;
  } | null;
};

type DerivedHistoryStatus = {
  label:
    | "Confirmed"
    | "Lost to another venue"
    | "Rejected"
    | "Expired"
    | "Counter-offer rejected"
    | "Counter-offer expired"
    | "Closed"
    | "Unknown";
  tone: "success" | "warning" | "error" | "muted" | "accent";
};

const humanize = (value?: string | null) =>
  String(value || "")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();

export const deriveBroadcastHistoryStatus = (row: BroadcastHistoryRow): DerivedHistoryStatus => {
  const requestStatus = String(row.status || "").toLowerCase();
  const lifecycleStatus = String(row.lifecycleStatus || "").toLowerCase();
  const closedReason = String(row.closedReason || "").toLowerCase();
  const offerStatus = String(row.offer?.status || "").toLowerCase();
  const offerType = String(row.offer?.offerType || "").toLowerCase();
  const broadcastStatus = String(row.matchroom?.broadcastRequestStatus || "").toLowerCase();
  const confirmedZoneId = String(row.matchroom?.confirmedZoneId || "").trim();
  const rowZoneId = String(row.zoneId || "").trim();
  const confirmedThisZone =
    broadcastStatus === "zone_confirmed" && rowZoneId && confirmedZoneId === rowZoneId;

  if (
    confirmedThisZone ||
    lifecycleStatus === "zone_confirmed" ||
    lifecycleStatus === "selected" ||
    (offerStatus === "accepted" && (row.offer?.resolvedMatchroomId || broadcastStatus === "zone_confirmed"))
  ) {
    return { label: "Confirmed", tone: "success" };
  }
  if (closedReason === "closed_elsewhere" || lifecycleStatus === "closed_elsewhere") {
    return { label: "Lost to another venue", tone: "muted" };
  }
  if (closedReason === "counter_offer_rejected" || lifecycleStatus.includes("counter_offer_rejected")) {
    return { label: "Counter-offer rejected", tone: "error" };
  }
  if (closedReason === "counter_offer_expired" || lifecycleStatus.includes("counter_offer_expired")) {
    return { label: "Counter-offer expired", tone: "warning" };
  }
  if (
    closedReason === "rejected_by_zone" ||
    lifecycleStatus === "broadcast_rejected" ||
    offerStatus === "rejected"
  ) {
    return { label: offerType === "counter_offer" ? "Counter-offer rejected" : "Rejected", tone: "error" };
  }
  if (
    requestStatus === "expired" ||
    offerStatus === "expired" ||
    closedReason === "offer_expired" ||
    closedReason === "no_zone_response" ||
    lifecycleStatus.includes("expired")
  ) {
    return { label: "Expired", tone: "warning" };
  }
  if (requestStatus === "cancelled" || closedReason || lifecycleStatus) {
    return { label: "Closed", tone: "muted" };
  }
  return { label: "Unknown", tone: "muted" };
};

const formatDate = (value?: number | string | null) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};

const formatTimestamp = (value?: number | null) => {
  if (!value) return "Updated recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Updated recently";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const getStatusToneStyle = (tone: DerivedHistoryStatus["tone"]) => {
  if (tone === "success") return styles.historyStatusSuccess;
  if (tone === "warning") return styles.historyStatusWarning;
  if (tone === "error") return styles.historyStatusError;
  if (tone === "accent") return styles.historyStatusAccent;
  return styles.historyStatusMuted;
};

type Props = {
  loading: boolean;
  rows: BroadcastHistoryRow[];
};

export function ZoneBookingsHistorySection({ loading, rows }: Props) {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {loading ? (
        <ActivityIndicator size="small" color={COLORS.accent} />
      ) : rows.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <Text style={styles.emptyStateTitle}>No broadcast history yet.</Text>
          <Text style={styles.emptyText}>Closed broadcast requests and venue outcomes will appear here.</Text>
        </View>
      ) : (
        rows.map((row) => {
          const derived = deriveBroadcastHistoryStatus(row);
          const date = formatDate(row.preferredDate);
          const area = row.offer?.branchName || row.matchroom?.location || row.targetAreaLabel || row.preferredAreas?.[0];
          const rawStatus = [
            row.closedReason ? `Reason: ${humanize(row.closedReason)}` : null,
            row.lifecycleStatus ? `Lifecycle: ${humanize(row.lifecycleStatus)}` : null,
            row.offer?.status ? `Offer: ${humanize(row.offer.status)}` : null,
          ].filter(Boolean);

          return (
            <View key={row.id} style={styles.historyCard}>
              <View style={styles.historyCardHeader}>
                <View style={styles.historyTitleWrap}>
                  <Text style={styles.historyTitle} numberOfLines={1}>
                    {row.title || "Broadcast booking request"}
                  </Text>
                  <Text style={styles.historyTimestamp}>{formatTimestamp(row.updatedAt || row.createdAt || null)}</Text>
                </View>
                <View style={[styles.historyStatusChip, getStatusToneStyle(derived.tone)]}>
                  <Text style={styles.historyStatusText}>{derived.label}</Text>
                </View>
              </View>

              <View style={styles.historyMetaRow}>
                <Text style={styles.historyMetaText}>{humanize(row.gameKey) || "Game"}</Text>
                {date ? <Text style={styles.historyMetaText}>{date}</Text> : null}
                {row.preferredTime ? <Text style={styles.historyMetaText}>{row.preferredTime}</Text> : null}
              </View>

              {area ? <Text style={styles.historyDetailText}>Venue area: {area}</Text> : null}
              {row.offer?.offerType ? <Text style={styles.historyDetailText}>Offer type: {humanize(row.offer.offerType)}</Text> : null}
              {rawStatus.length > 0 ? <Text style={styles.historyRawText}>{rawStatus.join(" | ")}</Text> : null}

              {row.matchroomId ? (
                <Pressable
                  style={({ pressed }) => [styles.historyLinkButton, pressed && styles.historyLinkButtonPressed]}
                  onPress={() => router.push({ pathname: "/matchrooms/[id]" as any, params: { id: row.matchroomId } })}
                >
                  <AppIcon name="launch" size="sm" color={COLORS.accent} />
                  <Text style={styles.historyLinkText}>View matchroom</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
