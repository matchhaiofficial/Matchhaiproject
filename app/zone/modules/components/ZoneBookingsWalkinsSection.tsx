import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Matchroom } from "../../../../src/services/convex/matchService";
import { SPACING } from "../../../../src/theme";
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
      <View style={styles.walkinCard}>
        <Text style={styles.walkinTitle}>Create Walk-in Matchroom</Text>
        <Text style={styles.walkinSubtitle}>
          Use the same Create Matchroom flow as player dashboard, with admin walk-in controls.
        </Text>
        <Pressable
          style={[styles.actionButton, styles.walkinCreateButton]}
          onPress={onCreateWalkIn}
          disabled={processingAction !== null}
        >
          <Text style={styles.walkinCreateText}>Create Walk-in Matchroom</Text>
        </Pressable>
      </View>

      <View style={[styles.counterHeader, { marginTop: SPACING.lg }]}>
        <Text style={styles.detailsTitle}>Existing Walk-ins</Text>
        <Text style={styles.emptyText}>{walkInRooms.length}</Text>
      </View>
      {walkInRooms.length === 0 ? (
        <Text style={styles.emptyText}>No walk-in matchrooms yet.</Text>
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
