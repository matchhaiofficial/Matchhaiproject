import React from "react";
import { Text, View } from "react-native";

import { AppCard, StatusPill } from "../../../components/AppPrimitives";
import styles from "./VenueDetails.styles";
import VenueEmptyCard from "./VenueEmptyCard";
import VenueSection from "./VenueSection";

export default function VenuePricingSection({
  startingPriceLabel,
  pricingGroups,
}: {
  startingPriceLabel?: string;
  pricingGroups: Array<{
    key: string;
    title: string;
    rows: Array<{
      label: string;
      priceLabel: string;
      countLabel?: string;
    }>;
  }>;
}) {
  return (
    <VenueSection
      title="Pricing"
      helperText="Current player-visible rates for this selected branch. Final game, date, and slot details are chosen in Matchroom Create."
    >
      <View style={styles.pricingTitleRow}>
        <Text style={styles.sectionHelper}>
          {startingPriceLabel ? `Starting from ${startingPriceLabel}` : "No published pricing yet"}
        </Text>
        {startingPriceLabel ? <StatusPill tone="success" label={startingPriceLabel} caps={false} /> : null}
      </View>

      {pricingGroups.length > 0 ? (
        pricingGroups.map((group) => (
          <AppCard key={group.key} style={styles.pricingGroupCard}>
            <Text style={styles.pricingGroupTitle}>{group.title}</Text>
            {group.rows.map((row, index) => (
              <View
                key={`${group.key}-${row.label}`}
                style={[styles.pricingRow, index === 0 && styles.pricingRowFirst]}
              >
                <View style={styles.pricingRowLabelWrap}>
                  <Text style={styles.pricingRowLabel}>{row.label}</Text>
                  {row.countLabel ? <Text style={styles.pricingRowMeta}>{row.countLabel}</Text> : null}
                </View>
                <Text style={styles.pricingValue}>{row.priceLabel}</Text>
              </View>
            ))}
          </AppCard>
        ))
      ) : (
        <VenueEmptyCard
          title="Pricing hasn’t been published yet"
          description="This venue can still be selected, but you’ll confirm the playable setup in Matchroom Create after the venue updates its rates."
        />
      )}
    </VenueSection>
  );
}
