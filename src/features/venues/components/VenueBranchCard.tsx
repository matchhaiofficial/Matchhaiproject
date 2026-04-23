import React from "react";
import { Text, View } from "react-native";

import { AppButton, AppCard, StatusPill } from "../../../components/AppPrimitives";
import { AppIcon } from "../../../components/AppIcon";
import styles from "./VenueDetails.styles";

export default function VenueBranchCard({
  branchName,
  address,
  areaCityLabel,
  branchCountLabel,
  hasMap,
  hasPhone,
  onOpenMaps,
  onCopyAddress,
  onCallVenue,
}: {
  branchName: string;
  address: string;
  areaCityLabel: string;
  branchCountLabel: string;
  hasMap: boolean;
  hasPhone: boolean;
  onOpenMaps: () => void;
  onCopyAddress: () => void;
  onCallVenue: () => void;
}) {
  return (
    <AppCard style={styles.branchCard}>
      <View style={styles.branchHeaderRow}>
        <View style={styles.branchTitleWrap}>
          <Text style={styles.branchLabel}>Selected Branch</Text>
          <Text style={styles.branchTitle}>{branchName}</Text>
          <Text style={styles.branchMeta}>{areaCityLabel}</Text>
        </View>
        <StatusPill tone="neutral" label={branchCountLabel} caps={false} />
      </View>

      <View style={styles.addressRow}>
        <AppIcon name="location-on" size="md" tone="muted" />
        <View style={styles.branchTitleWrap}>
          <Text style={styles.addressText}>{address}</Text>
          <Text style={styles.subAddressText}>{areaCityLabel}</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <AppButton
          variant="secondary"
          size="sm"
          style={[styles.actionButton, styles.actionButtonCompact]}
          leadingIcon="map"
          onPress={onOpenMaps}
          disabled={!hasMap}
        >
          Open in Google Maps
        </AppButton>
        <AppButton
          variant="secondary"
          size="sm"
          style={[styles.actionButton, styles.actionButtonCompact]}
          leadingIcon="content-copy"
          onPress={onCopyAddress}
        >
          Copy address
        </AppButton>
        <AppButton
          variant="secondary"
          size="sm"
          style={[styles.actionButton, styles.actionButtonCompact]}
          leadingIcon="call"
          onPress={onCallVenue}
          disabled={!hasPhone}
        >
          Call Venue
        </AppButton>
      </View>

      {!hasMap ? (
        <View style={styles.helperRow}>
          <AppIcon name="info-outline" size="sm" tone="muted" />
          <Text style={styles.helperText}>
            Google Maps link has not been added for this branch yet.
          </Text>
        </View>
      ) : null}

      {!hasPhone ? (
        <View style={styles.helperRow}>
          <AppIcon name="info-outline" size="sm" tone="muted" />
          <Text style={styles.helperText}>
            Phone support has not been added for this venue yet.
          </Text>
        </View>
      ) : null}
    </AppCard>
  );
}
