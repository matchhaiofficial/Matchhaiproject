import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import AppHeader from "../../../src/components/AppHeader";
import { AppButton, AppCard } from "../../../src/components/AppPrimitives";
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

const REPORT_REASONS = [
  "Staff Behavior",
  "Booking/Payment Issue",
  "Unsafe Environment",
  "Equipment/Facility Issue",
  "Misleading Information",
  "Other",
];

export default function PlayerVenueDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { showToast } = useToast();

  const [venue, setVenue] = useState<PlayerVenueViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reporting, setReporting] = useState(false);

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
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void loadVenue();
  }, [loadVenue]);

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
    if (!venue) return;
    const result = await handleOpenGoogleMaps({
      mapUrl: venue.selectedBranch.googleMapsUrl,
      address: venue.selectedBranch.formattedAddress,
    });
    if (!result.ok) {
      showToast({
        type: "warning",
        title: "Map unavailable",
        message: result.message,
      });
    }
  }, [showToast, venue]);

  const onCopyAddress = useCallback(async () => {
    if (!venue) return;
    await withToastFeedback(
      () => handleCopyAddress(venue.selectedBranch.formattedAddress),
      "The venue address is now on your clipboard.",
      "Address copied",
    );
  }, [venue, withToastFeedback]);

  const onCallVenue = useCallback(async () => {
    if (!venue) return;
    const result = await handleCallVenue(venue.selectedBranch.phone);
    if (!result.ok) {
      showToast({
        type: "warning",
        title: "Call unavailable",
        message: result.message,
      });
    }
  }, [showToast, venue]);

  const onCreateMatchroom = useCallback(() => {
    if (!venue) return;
    router.push({
      pathname: "/matchrooms/create",
      params: venue.createMatchroomParams,
    });
  }, [router, venue]);

  const onSubmitReport = useCallback(async () => {
    if (!venue?.id || !reportReason) return;
    setReporting(true);

    const result = await submitZoneComplaint({
      zoneId: venue.id,
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
  }, [reportDescription, reportReason, showToast, venue?.id]);

  return (
    <Screen style={styles.screen} scroll={false} contentStyle={styles.screenContent} edges={["top", "bottom"]}>
      <AppHeader
        title="Venue Details"
        onBack={() => router.back()}
        inlineTitle
        style={styles.header}
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
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: 28 },
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
              branchName={venue.selectedBranch.displayName}
              address={venue.selectedBranch.formattedAddress}
              areaCityLabel={venue.selectedBranch.areaCityLabel}
              branchCountLabel={venue.branchCountLabel}
              hasMap={venue.selectedBranch.hasMap}
              hasPhone={venue.selectedBranch.hasPhone}
              onOpenMaps={() => void onOpenMaps()}
              onCopyAddress={() => void onCopyAddress()}
              onCallVenue={() => void onCallVenue()}
            />

            <VenueGamesResourcesSection
              gameLabels={venue.supportedGameLabels}
              resources={venue.resources}
            />

            <VenuePricingSection
              startingPriceLabel={venue.startingPriceLabel}
              pricingGroups={venue.pricingGroups}
            />

            <VenueInfoSection
              infoItems={venue.infoItems}
              hasContactInfo={venue.hasContactInfo}
              onReportVenue={() => setShowReportModal(true)}
            />

            <VenuePrimaryActionBar
              onCreateMatchroom={onCreateMatchroom}
            />
          </ScrollView>
        </>
      )}

      <ReportIssueModal
        visible={showReportModal}
        title="Report Venue"
        subtitle="Share issues related to this venue or branch."
        reasons={REPORT_REASONS}
        reason={reportReason}
        description={reportDescription}
        onChangeReason={setReportReason}
        onChangeDescription={setReportDescription}
        onSubmit={() => void onSubmitReport()}
        onClose={() => setShowReportModal(false)}
        loading={reporting}
        submitLabel="Submit Report"
      />
    </Screen>
  );
}
