import React from "react";
import { Text, View } from "react-native";

import { AppCard, StatusPill } from "../../../components/AppPrimitives";
import { AppIcon } from "../../../components/AppIcon";
import styles from "./VenueDetails.styles";
import VenueEmptyCard from "./VenueEmptyCard";
import VenueSection from "./VenueSection";

export default function VenueGamesResourcesSection({
  gameLabels,
  resources,
}: {
  gameLabels: string[];
  resources: Array<{
    key: string;
    label: string;
    countLabel: string;
    icon: "sports-esports" | "sports" | "videogame-asset" | "sports-soccer" | "sports-cricket" | "sports-tennis";
  }>;
}) {
  return (
    <VenueSection
      title="Games & Resources"
      helperText="What you can actually play here, plus the capacity that matters before you create a room."
    >
      <AppCard>
        <View style={styles.chipsWrap}>
          {gameLabels.length > 0 ? (
            gameLabels.map((label) => (
              <StatusPill key={label} tone="neutral" label={label} caps={false} />
            ))
          ) : (
            <Text style={styles.helperText}>Supported games will appear here once the venue finishes setup.</Text>
          )}
        </View>
      </AppCard>

      {resources.length > 0 ? (
        <View style={styles.resourcesGrid}>
          {resources.map((resource) => (
            <View key={resource.key} style={styles.resourceCard}>
              <View style={styles.resourceIconWrap}>
                <AppIcon name={resource.icon} size="md" tone="accent" />
              </View>
              <View style={styles.resourceTextWrap}>
                <Text style={styles.resourceLabel}>{resource.label}</Text>
                <Text style={styles.resourceCount}>{resource.countLabel}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <VenueEmptyCard
          title="Capacity details are still being updated"
          description="You can still open this venue in Matchroom Create, but the equipment breakdown has not been added yet."
        />
      )}
    </VenueSection>
  );
}
