import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Share, ScrollView, Text, View } from "react-native";

import AppHeader from "../../../src/components/AppHeader";
import { AppButton, AppCard } from "../../../src/components/AppPrimitives";
import BottomActionBar from "../../../src/components/BottomActionBar";
import { AppIcon } from "../../../src/components/AppIcon";
import ReportIssueModal from "../../../src/components/ReportIssueModal";
import Screen from "../../../src/components/Screen";
import VenueBranchCard from "../../../src/features/venues/components/VenueBranchCard";
import VenueGamesResourcesSection from "../../../src/features/venues/components/VenueGamesResourcesSection";
import VenueHeroCard from "../../../src/features/venues/components/VenueHeroCard";
import VenueInfoSection from "../../../src/features/venues/components/VenueInfoSection";
import VenuePricingSection from "../../../src/features/venues/components/VenuePricingSection";
import VenuePrimaryActionBar from "../../../src/features/venues/components/VenuePrimaryActionBar";
import styles from "../../../src/features/venues/components/VenueDetails.styles";
import {
  handleCallVenue,
  handleCopyAddress,
  handleOpenGoogleMaps,
} from "../../../src/features/venues/venueDetails.helpers";
import { useToast } from "../../../src/hooks/useToast";
import { submitZoneComplaint } from "../../../src/services/convex/reportService";
import {
  PlayerVenueViewModel,
  getPlayerVenueDetails,
} from "../../../src/services/convex/zoneService";
import { COLORS } from "../../../src/theme";
import { formatVenueShare } from "../../../src/utils/shareContent";

const REPORT_REASONS = [
  "Staff Behavior",
  "Booking/Payment Issue",
  "Unsafe Environment",
  "Equipment/Facility Issue",
  "Misleading Information",
  "Other",
];

export default function PlayerVenueDetailsScreen() {
  const { id, branchId } = useLocalSearchParams<{ id?: string; branchId?: string }>();
  const router = useRouter();
  const { showToast } = useToast();

  const [venue, setVenue] = useState<PlayerVenueViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportBranchKey, setReportBranchKey] = useState("");
  const [reporting, setReporting] = useState(false);
  const [selectedBranchKey, setSelectedBranchKey] = useState("");

  const loadVenue = useCallback(async () => {
    if (!id) {
      setVenue(null);
      setErrorMessage("Venue details are unavailable because the route is missing a venue id.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    const result = await getPlayerVenueDetails(id);

    if (!result.ok || !result.data) {
      setVenue(null);
      setErrorMessage(result.message || "We couldn't load this venue right now.");
      setLoading(false);
      return;
    }

    setVenue(result.data);
    const requestedBranchId = String(branchId || "").trim();
    const requestedBranch = requestedBranchId
      ? result.data.branches.find(
          (branch) => branch.id === requestedBranchId || branch.uiKey === requestedBranchId,
        )
      : null;
    setSelectedBranchKey((requestedBranch || result.data.selectedBranch).uiKey);
    setLoading(false);
  }, [branchId, id]);

  useEffect(() => {
    void loadVenue();
  }, [loadVenue]);

  const selectedBranch = useMemo(() => {
    if (!venue) return null;
    return venue.branches.find((branch) => branch.uiKey === selectedBranchKey) || venue.selectedBranch;
  }, [selectedBranchKey, venue]);

  const selectedInfoItems = useMemo(() => {
    if (!venue || !selectedBranch) return [];
    return venue.infoItems.map((item) =>
      item.key === "location"
        ? { ...item, value: selectedBranch.locationSummary }
        : item,
    );
  }, [selectedBranch, venue]);

  const withToastFeedback = useCallback(async (
    action: () => Promise<{ ok: true } | { ok: false; message: string }>,
    successMessage: string,
    successTitle: string,
  ) => {
    const result = await action();
    if (!result.ok) {
      showToast({
        type: "warning",
        title: "Action unavailable",
        message: result.message,
      });
      return;
    }

    showToast({
      type: "success",
      title: successTitle,
      message: successMessage,
    });
  }, [showToast]);

  const onOpenMaps = useCallback(async () => {
    if (!selectedBranch) return;
    const result = await handleOpenGoogleMaps({
      mapUrl: selectedBranch.googleMapsUrl,
      address: selectedBranch.formattedAddress,
    });
    if (!result.ok) {
      showToast({
        type: "warning",
        title: "Map unavailable",
        message: result.message,
      });
    }
  }, [selectedBranch, showToast]);

  const onCopyAddress = useCallback(async () => {
    if (!selectedBranch) return;
    await withToastFeedback(
      () => handleCopyAddress(selectedBranch.formattedAddress),
      "The venue address is now on your clipboard.",
      "Address copied",
    );
  }, [selectedBranch, withToastFeedback]);

  const onCallVenue = useCallback(async () => {
    if (!selectedBranch) return;
    const result = await handleCallVenue(selectedBranch.phone);
    if (!result.ok) {
      showToast({
        type: "warning",
        title: "Call unavailable",
        message: result.message,
      });
    }
  }, [selectedBranch, showToast]);

  const onShareVenue = useCallback(async () => {
    if (!venue) return;
    try {
      const message = formatVenueShare({
        id: String(venue.id),
        name: venue.venueBrandName,
        areaCity: selectedBranch?.areaCityLabel,
        games: venue.supportedGameLabels,
        startingPriceLabel: selectedBranch?.startingPriceLabel,
      });
      await Share.share({ message });
    } catch {
      // ignore
    }
  }, [venue, selectedBranch]);

  const onCreateMatchroom = useCallback(() => {
    if (!selectedBranch) return;
    router.push({
      pathname: "/matchrooms/create",
      params: selectedBranch.createMatchroomParams,
    });
  }, [router, selectedBranch]);

  const openReportModal = useCallback(() => {
    if (!selectedBranch) return;
    setReportBranchKey(selectedBranch.uiKey);
    setShowReportModal(true);
  }, [selectedBranch]);

  const onSubmitReport = useCallback(async () => {
    if (!venue?.id || !reportReason || !selectedBranch) return;
    const reportBranch =
      venue.branches.find((branch) => branch.uiKey === reportBranchKey) || selectedBranch;
    setReporting(true);

    const result = await submitZoneComplaint({
      zoneId: venue.id,
      branchId: reportBranch.id,
      branchLabel: reportBranch.displayName,
      reason: reportReason,
      description: reportDescription,
    });

    setReporting(false);

    if (!result.ok) {
      showToast({
        type: "error",
        title: "Report failed",
        message: result.message,
      });
      return;
    }

    showToast({
      type: result.data.created ? "success" : "warning",
      title: result.data.created ? "Report submitted" : "Already reported",
      message: result.message || "Our moderation team will review this report.",
    });
    setShowReportModal(false);
    setReportReason("");
    setReportDescription("");
  }, [reportBranchKey, reportDescription, reportReason, selectedBranch, showToast, venue]);

  return (
    <Screen style={styles.screen} scroll={false} contentStyle={styles.screenContent} edges={["top", "bottom"]}>
      <AppHeader
        title="Venue Details"
        onBack={() => router.back()}
        inlineTitle
        style={styles.header}
        rightAction={
          venue ? (
            <Pressable
              onPress={() => void onShareVenue()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Share venue"
            >
              <AppIcon name="share" size="lg" tone="accent" />
            </Pressable>
          ) : undefined
        }
      />

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading venue details...</Text>
        </View>
      ) : errorMessage || !venue ? (
        <View style={styles.errorWrap}>
          <AppCard style={styles.errorCard}>
            <AppIcon name="error-outline" size="xl" tone="warning" />
            <Text style={styles.stateTitle}>Venue details unavailable</Text>
            <Text style={styles.stateText}>
              {errorMessage || "We couldn't find this venue."}
            </Text>
            <AppButton variant="secondary" onPress={() => void loadVenue()}>
              Try Again
            </AppButton>
          </AppCard>
        </View>
      ) : selectedBranch ? (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              styles.scrollContentWithBottomAction,
            ]}
          >
            <VenueHeroCard
              title={venue.venueBrandName}
              subtitle={venue.subtitle}
              subtitleFallbackLabel={venue.subtitleFallbackLabel}
              typeLabel={venue.typeLabel}
              branchCountLabel={venue.branchCountLabel}
              statusLabel={venue.statusLabel}
              statusTone={venue.statusTone}
              showStatus={venue.showStatus}
            />

            <VenueBranchCard
              branchName={selectedBranch.displayName}
              address={selectedBranch.formattedAddress}
              areaCityLabel={selectedBranch.areaCityLabel}
              branchCountLabel={venue.branchCountLabel}
              hasMap={selectedBranch.hasMap}
              hasPhone={selectedBranch.hasPhone}
              branches={venue.branches}
              selectedBranchKey={selectedBranch.uiKey}
              onSelectBranch={setSelectedBranchKey}
              onOpenMaps={() => void onOpenMaps()}
              onCopyAddress={() => void onCopyAddress()}
              onCallVenue={() => void onCallVenue()}
            />

            <VenueGamesResourcesSection
              gameLabels={venue.supportedGameLabels}
              resources={selectedBranch.resources}
            />

            <VenuePricingSection
              startingPriceLabel={selectedBranch.startingPriceLabel}
              pricingGroups={selectedBranch.pricingGroups}
            />

            <VenueInfoSection
              infoItems={selectedInfoItems}
              hasContactInfo={venue.hasContactInfo}
              onReportVenue={openReportModal}
            />
          </ScrollView>

          <BottomActionBar>
            <VenuePrimaryActionBar onCreateMatchroom={onCreateMatchroom} />
          </BottomActionBar>
        </>
      ) : null}

      <ReportIssueModal
        visible={showReportModal}
        title="Report Venue"
        subtitle="Share issues related to this venue or branch."
        reasons={REPORT_REASONS}
        reason={reportReason}
        description={reportDescription}
        onChangeReason={setReportReason}
        onChangeDescription={setReportDescription}
        targetLabel="Branch"
        targetOptions={(venue?.branches || []).map((branch) => ({
          value: branch.uiKey,
          label: branch.displayName,
          description: branch.areaCityLabel,
        }))}
        targetValue={reportBranchKey}
        onChangeTarget={setReportBranchKey}
        onSubmit={() => void onSubmitReport()}
        onClose={() => setShowReportModal(false)}
        loading={reporting}
        submitLabel="Submit Report"
      />
    </Screen>
  );
}
