import React from "react";
import { Text, View } from "react-native";

import { AppCard, StatusPill } from "../../../components/AppPrimitives";
import styles from "./VenueDetails.styles";

export default function VenueHeroCard({
  title,
  subtitle,
  subtitleFallbackLabel,
  typeLabel,
  branchCountLabel,
  statusLabel,
  statusTone,
  showStatus,
}: {
  title: string;
  subtitle: string;
  subtitleFallbackLabel: string;
  typeLabel: string;
  branchCountLabel: string;
  statusLabel: string;
  statusTone: "neutral" | "info" | "success" | "warning" | "danger";
  showStatus: boolean;
}) {
  return (
    <AppCard style={styles.heroCard}>
      <View style={styles.heroTopRow}>
        <View style={styles.heroTitleWrap}>
          <Text style={styles.heroEyebrow}>Venue Details</Text>
          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.heroSubtitle}>
            {subtitle || subtitleFallbackLabel}
          </Text>
        </View>
        {showStatus ? <StatusPill tone={statusTone} label={statusLabel} caps={false} /> : null}
      </View>

      <View style={styles.heroChipRow}>
        <StatusPill tone="info" label={typeLabel} caps={false} />
        <StatusPill tone="neutral" label={branchCountLabel} caps={false} />
      </View>
    </AppCard>
  );
}
