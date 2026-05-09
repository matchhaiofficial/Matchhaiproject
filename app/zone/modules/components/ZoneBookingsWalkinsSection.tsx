import React from "react";
import { ScrollView, Text, View } from "react-native";

import {
  AdminEmptyStateCard,
  AdminSectionHeader,
} from "../../../../src/components/AdminSurface";
import { AppButton, AppCard } from "../../../../src/components/AppPrimitives";
import { Matchroom } from "../../../../src/services/convex/matchService";
import {
  type ZoneMatchroomListItem,
} from "../../../../src/services/convex/zoneAdminBookingService";
import MatchroomCard from "../../../matchrooms/components/MatchroomCard";
import styles from "../bookings.styles";

type Props = {
  walkInRooms: ZoneMatchroomListItem[];
  processingAction: "accept" | "reject" | "counter" | null;
  onCreateWalkIn: () => void;
  buildMatchroomCardData: (item: ZoneMatchroomListItem) => Matchroom;
};

export function ZoneBookingsWalkinsSection({
  walkInRooms,
  processingAction,
  onCreateWalkIn,
  buildMatchroomCardData,
}: Props) {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <AppCard style={styles.walkinCard}>
        <Text style={styles.walkinTitle}>Create Walk-in Matchroom</Text>
        <Text style={styles.walkinSubtitle}>
          Start a venue-created session for players on-site.
        </Text>
        <AppButton
          style={styles.walkinCreateButton}
          onPress={onCreateWalkIn}
          disabled={processingAction !== null}
        >
          Create Walk-in Matchroom
        </AppButton>
      </AppCard>

      <AdminSectionHeader title="Existing Walk-ins" subtitle={`${walkInRooms.length}`} compact />
      {walkInRooms.length === 0 ? (
        <AdminEmptyStateCard
          title="No walk-in matchrooms yet."
          description="Created walk-in sessions will appear here."
          icon="matchroom"
        />
      ) : (
        walkInRooms.map((item) => (
          <View key={`walkin-${item.id}`} style={styles.walkinMatchroomItem}>
            <MatchroomCard room={buildMatchroomCardData(item)} />
          </View>
        ))
      )}
    </ScrollView>
  );
}
