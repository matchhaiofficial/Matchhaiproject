import React from "react";
import { Text, View } from "react-native";

import { AppButton, AppCard } from "../../../components/AppPrimitives";
import { AppIcon } from "../../../components/AppIcon";
import styles from "./VenueDetails.styles";
import VenueSection from "./VenueSection";

export default function VenueInfoSection({
  infoItems,
  hasContactInfo,
  onReportVenue,
}: {
  infoItems: Array<{
    key: string;
    label: string;
    value: string;
    icon: "verified" | "email" | "phone" | "storefront" | "location-on";
  }>;
  hasContactInfo: boolean;
  onReportVenue: () => void;
}) {
  return (
    <VenueSection
      title="Venue Info"
      helperText="A quick trust layer so you know what this branch exposes publicly before you continue."
    >
      <AppCard style={styles.infoCard}>
        {infoItems.map((item) => (
          <View key={item.key} style={styles.infoRow}>
            <AppIcon name={item.icon} size="md" tone="muted" />
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoValue}>{item.value}</Text>
            </View>
          </View>
        ))}

        {!hasContactInfo ? (
          <View style={styles.helperRow}>
            <AppIcon name="info-outline" size="sm" tone="muted" />
            <Text style={styles.helperText}>
              Public phone and email details have not been added for this venue yet.
            </Text>
          </View>
        ) : null}

        <View style={styles.supportRow}>
          <View style={styles.supportCopy}>
            <Text style={styles.supportTitle}>Need to flag a problem?</Text>
            <Text style={styles.supportText}>
              Report inaccurate details, safety issues, or contact problems for moderation review.
            </Text>
          </View>
          <AppButton variant="danger" size="sm" onPress={onReportVenue}>
            Report Venue
          </AppButton>
        </View>
      </AppCard>
    </VenueSection>
  );
}
