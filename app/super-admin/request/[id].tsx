import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import AppHeader from "../../../src/components/AppHeader";
import { AdminEmptyStateCard, AdminSectionHeader } from "../../../src/components/AdminSurface";
import { AppIcon } from "../../../src/components/AppIcon";
import { AppButton, AppCard, StatusPill } from "../../../src/components/AppPrimitives";
import {
  DetailKeyValueRow,
  DetailSectionCard,
} from "../../../src/components/DetailSurface";
import Screen from "../../../src/components/Screen";
import { useToast } from "../../../src/hooks/useToast";
import { useEntrance } from "../../../src/motion/useEntrance";
import {
  approveZone,
  getAdminZoneById,
  reactivateZone,
  rejectZone,
  retryZoneMigration,
  suspendZone,
} from "../../../src/services/convex/superAdminService";
import type { Zone } from "../../../src/services/convex/zoneService";
import { COLORS, FONTS, RADII, SPACING } from "../../../src/theme";
import { getZoneStatusTone } from "../../../src/utils/statusLabels";
import { getZoneLifecycleLabel, getZoneMigrationLabel } from "../../../src/utils/zoneLifecycle";

function formatDate(value?: number) {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString();
}

function inventorySummary(zone: Zone) {
  const items: string[] = [];
  if (zone.games?.supportsCs2) items.push("PC Gaming (CS2 support)");
  if (zone.games?.supportsCs16) items.push("PC Gaming (CS 1.6 support)");
  if (zone.games?.supportsFc25 || zone.games?.supportsTekken8) items.push("Console Gaming (FC/Tekken support)");
  // Physical sports are temporarily disabled.
  // if (zone.games?.supportsFutsal) items.push("Futsal courts");
  // if (zone.games?.supportsIndoorCricket) items.push("Indoor cricket nets");
  // if (zone.games?.supportsPadel) items.push("Padel courts");
  // if (zone.games?.supportsPickleball) items.push("Pickleball courts");
  return items;
}

export default function RequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [request, setRequest] = useState<Zone | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showRejectComposer, setShowRejectComposer] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const { showToast } = useToast();
  const { animatedStyle: entranceStyle } = useEntrance({ axis: "y", distance: 12 });

  useEffect(() => {
    async function fetchRequest() {
      if (!id) return;
      try {
        const result = await getAdminZoneById(id, { forceRefresh: true });
        if (result.ok && result.data) {
          setRequest(result.data);
        }
      } catch (error) {
        console.error("Error fetching request detail:", error);
      } finally {
        setLoading(false);
      }
    }

    void fetchRequest();
  }, [id]);

  const closeWithResult = (title: string, message: string) => {
    showToast({ type: "success", title, message });
    router.back();
  };

  const handleApprove = async () => {
    if (!id) return;

    Alert.alert(
      "Approve Venue",
      "This approves the venue and starts migration. The venue goes live only after migration succeeds.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: async () => {
            setProcessing(true);
            const res = await approveZone(id);
            setProcessing(false);

            if (!res.ok) {
              showToast({ type: "error", title: "Error", message: res.message });
              return;
            }

            closeWithResult("Approved", "Venue approval saved. Migration status has been updated.");
          },
        },
      ],
    );
  };

  const handleReject = () => {
    setShowRejectComposer(true);
    setRejectionReason(request?.rejectionReason || "");
  };

  const closeRejectComposer = () => {
    setShowRejectComposer(false);
    setRejectionReason("");
  };

  const submitReject = async () => {
    if (!id) return;

    const reason = rejectionReason.trim();
    if (!reason) {
      showToast({
        type: "error",
        title: "Reason required",
        message: "Add a rejection reason before rejecting the venue.",
      });
      return;
    }

    setProcessing(true);
    const res = await rejectZone(id, reason);
    setProcessing(false);

    if (!res.ok) {
      showToast({ type: "error", title: "Error", message: res.message });
      return;
    }

    closeWithResult("Rejected", "Zone registration has been rejected.");
  };

  const handleSuspend = async () => {
    if (!id) return;
    setProcessing(true);
    const res = await suspendZone(id);
    setProcessing(false);

    if (!res.ok) {
      showToast({ type: "error", title: "Error", message: res.message });
      return;
    }

    closeWithResult("Suspended", "Zone is now hidden from discovery.");
  };

  const handleReactivate = async () => {
    if (!id) return;
    setProcessing(true);
    const res = await reactivateZone(id);
    setProcessing(false);

    if (!res.ok) {
      showToast({ type: "error", title: "Error", message: res.message });
      return;
    }

    closeWithResult("Reactivated", "Venue lifecycle has been updated.");
  };

  const handleRetryMigration = async () => {
    if (!id) return;
    setProcessing(true);
    const res = await retryZoneMigration(id);
    setProcessing(false);

    if (!res.ok) {
      showToast({ type: "error", title: "Error", message: res.message });
      return;
    }

    closeWithResult("Migration Retried", "Venue migration has been retried.");
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  if (!request) {
    return (
      <Screen style={styles.screen} scroll={false}>
        <AppHeader title="Venue Detail" onBack={() => router.back()} inlineTitle />
        <View style={styles.emptyWrap}>
          <AdminEmptyStateCard title="Request not found" description="This venue request no longer exists." icon="storefront" />
        </View>
      </Screen>
    );
  }

  const inventory = inventorySummary(request);

  return (
    <Screen style={styles.screen} scroll={false}>
      <AppHeader title="Venue Detail" onBack={() => router.back()} inlineTitle />

      <ScrollView style={entranceStyle} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppCard variant="elevated" style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.heroIconWrap}>
              <AppIcon name="storefront" size={22} tone="accent" />
            </View>
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroEyebrow}>Venue moderation</Text>
              <Text style={styles.heroTitle}>{request.venueBrandName}</Text>
              <Text style={styles.heroSubtitle}>{request.ownerFullName || "Unknown owner"}</Text>
            </View>
            <StatusPill
              tone={getZoneStatusTone(request.status)}
              label={getZoneLifecycleLabel(request)}
            />
          </View>
        </AppCard>

        <DetailSectionCard title="Account Details" subtitle="Moderation context and lifecycle state.">
          <DetailKeyValueRow label="Owner name" value={request.ownerFullName || "N/A"} />
          <DetailKeyValueRow label="Contact email" value={request.contactEmail || "N/A"} />
          <DetailKeyValueRow label="Contact phone" value={request.contactPhone || "N/A"} />
          <DetailKeyValueRow label="Submitted" value={formatDate(request.createdAt)} />
          <DetailKeyValueRow label="Lifecycle" value={getZoneLifecycleLabel(request)} />
          <DetailKeyValueRow label="Migration" value={getZoneMigrationLabel(request)} />
          {request.rejectionReason ? (
            <DetailKeyValueRow label="Rejection reason" value={request.rejectionReason} valueTone="danger" />
          ) : null}
          {request.migration?.lastError ? (
            <DetailKeyValueRow label="Last error" value={request.migration.lastError} valueTone="danger" last />
          ) : null}
        </DetailSectionCard>

        <DetailSectionCard
          title={`Branches (${request.branches?.length ?? 0})`}
          subtitle="Submitted branch and location data."
        >
          {(request.branches?.length ?? 0) > 0 ? (
            <View style={styles.branchStack}>
              {request.branches!.map((branch: any, idx: number) => (
                <AppCard key={branch.id || idx} variant="soft" style={styles.branchCard}>
                  <Text style={styles.branchTitle}>{branch.branchDisplayName || branch.name || "Branch"}</Text>
                  <View style={styles.branchInfoStack}>
                    <DetailKeyValueRow label="Address" value={branch.addressLine1 || branch.address || "N/A"} />
                    <DetailKeyValueRow label="Area" value={branch.areaLabel || "N/A"} />
                    <DetailKeyValueRow label="City" value={branch.city || "N/A"} last />
                  </View>
                </AppCard>
              ))}
            </View>
          ) : (
            <View>
              <DetailKeyValueRow label="Address" value={request.primaryBranch?.addressLine1 || "N/A"} />
              <DetailKeyValueRow label="Area" value={request.primaryBranch?.areaLabel || "N/A"} />
              <DetailKeyValueRow label="City" value={request.primaryBranch?.city || "N/A"} last />
            </View>
          )}
        </DetailSectionCard>

        <DetailSectionCard title="Inventory Summary" subtitle="Supported venue inventory from the registration payload.">
          {inventory.length ? (
            inventory.map((item) => (
              <View key={item} style={styles.inventoryRow}>
                <AppIcon name="check-circle" size="sm" color={COLORS.successBright} />
                <Text style={styles.inventoryText}>{item}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.helperText}>No supported inventory flags were submitted.</Text>
          )}
        </DetailSectionCard>

        {showRejectComposer ? (
          <DetailSectionCard title="Reject Venue" subtitle="Save a clear reason for the venue owner and later moderation review.">
            <Text style={styles.helperText}>
              Add a clear rejection reason for the venue owner. This keeps the lifecycle and follow-up guidance explicit.
            </Text>
            <TextInput
              value={rejectionReason}
              onChangeText={setRejectionReason}
              placeholder="Explain why this venue cannot be approved yet."
              placeholderTextColor={COLORS.muted}
              style={styles.rejectionInput}
              multiline
              textAlignVertical="top"
              editable={!processing}
            />
            <View style={styles.actionRow}>
              <AppButton variant="secondary" onPress={closeRejectComposer} disabled={processing}>
                Cancel
              </AppButton>
              <AppButton variant="danger" loading={processing} onPress={submitReject}>
                Confirm Reject
              </AppButton>
            </View>
          </DetailSectionCard>
        ) : null}

        <AppCard variant="elevated">
          <AdminSectionHeader
            title="Moderation Actions"
            subtitle="These actions update lifecycle state and migration handling without changing the venue payload."
            compact
          />
          <View style={styles.actionRow}>
            {request.status !== "rejected" ? (
              <AppButton variant="danger" onPress={showRejectComposer ? closeRejectComposer : handleReject} disabled={processing}>
                {showRejectComposer ? "Close Reject" : "Reject"}
              </AppButton>
            ) : null}

            {request.status === "active" ? (
              <AppButton variant="secondary" onPress={handleSuspend} loading={processing}>
                Suspend
              </AppButton>
            ) : null}

            {request.status === "approved_pending_migration" ? (
              <AppButton onPress={handleRetryMigration} loading={processing}>
                Retry Migration
              </AppButton>
            ) : (
              <AppButton onPress={request.status === "suspended" ? handleReactivate : handleApprove} loading={processing}>
                {request.status === "suspended" ? "Reactivate" : "Approve"}
              </AppButton>
            )}
          </View>
        </AppCard>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.backgroundDark,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.backgroundDark,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: SPACING.screenPadding,
  },
  content: {
    paddingBottom: SPACING.xxl,
    gap: SPACING.md,
  },
  heroCard: {
    gap: SPACING.md,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: `${COLORS.accent}44`,
    backgroundColor: `${COLORS.accent}14`,
  },
  heroTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  heroEyebrow: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interSemiBold,
    fontSize: 11,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 24,
    marginTop: 4,
  },
  heroSubtitle: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: 13,
    marginTop: 4,
  },
  branchStack: {
    gap: SPACING.sm,
  },
  branchCard: {
    padding: SPACING.md,
  },
  branchTitle: {
    color: COLORS.accent,
    fontFamily: FONTS.interSemiBold,
    fontSize: 14,
    marginBottom: SPACING.sm,
  },
  branchInfoStack: {
    gap: 0,
  },
  inventoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  inventoryText: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
  },
  helperText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 20,
  },
  rejectionInput: {
    minHeight: 120,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.divider,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontFamily: FONTS.body,
    fontSize: 14,
    marginTop: SPACING.md,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
});
