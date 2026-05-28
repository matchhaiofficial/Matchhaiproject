import React from "react";
import { FlatList, Text, View } from "react-native";

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

const WalkinRow = React.memo(function WalkinRow({
  item,
  buildMatchroomCardData,
}: {
  item: ZoneMatchroomListItem;
  buildMatchroomCardData: (item: ZoneMatchroomListItem) => Matchroom;
}) {
  return (
    <View style={styles.walkinMatchroomItem}>
      <MatchroomCard room={buildMatchroomCardData(item)} />
    </View>
  );
});

export function ZoneBookingsWalkinsSection({
  walkInRooms,
  processingAction,
  onCreateWalkIn,
  buildMatchroomCardData,
}: Props) {
  return (
    <FlatList
      data={walkInRooms}
      keyExtractor={(item) => `walkin-${item.id}`}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
      initialNumToRender={8}
      windowSize={11}
      ListHeaderComponent={
        <>
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
        </>
      }
      ListEmptyComponent={
        <AdminEmptyStateCard
          title="No walk-in matchrooms yet."
          description="Created walk-in sessions will appear here."
          icon="matchroom"
        />
      }
      renderItem={({ item }) => (
        <WalkinRow item={item} buildMatchroomCardData={buildMatchroomCardData} />
      )}
    />
  );
}
