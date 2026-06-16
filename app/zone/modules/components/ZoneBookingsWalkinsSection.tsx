import React from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";

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
import { COLORS } from "../../../../src/theme";

type Props = {
  walkInRooms: ZoneMatchroomListItem[];
  total: number;
  loading?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
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
  total,
  loading = false,
  loadingMore = false,
  onLoadMore,
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

          <AdminSectionHeader title="Existing Walk-ins" subtitle={`${total}`} compact />
        </>
      }
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator size="small" color={COLORS.accent} />
        ) : (
          <AdminEmptyStateCard
            title="No walk-in matchrooms yet."
            description="Created walk-in sessions will appear here."
            icon="matchroom"
          />
        )
      }
      ListFooterComponent={
        loadingMore ? (
          <View style={styles.listFooterLoader}>
            <ActivityIndicator size="small" color={COLORS.accent} />
          </View>
        ) : null
      }
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.4}
      renderItem={({ item }) => (
        <WalkinRow item={item} buildMatchroomCardData={buildMatchroomCardData} />
      )}
    />
  );
}
