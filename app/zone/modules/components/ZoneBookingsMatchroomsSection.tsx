import React from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { Matchroom } from "../../../../src/services/convex/matchService";
import { COLORS } from "../../../../src/theme";
import {
  type ZoneMatchroomListItem,
} from "../../../../src/services/convex/zoneAdminBookingService";
import MatchroomCard from "../../../matchrooms/components/MatchroomCard";
import styles from "../bookings.styles";

type Props = {
  loadingMatchrooms: boolean;
  matchrooms: ZoneMatchroomListItem[];
  focusedMatchroomId: string | null;
  buildMatchroomCardData: (item: ZoneMatchroomListItem) => Matchroom;
};

export function ZoneBookingsMatchroomsSection({
  loadingMatchrooms,
  matchrooms,
  focusedMatchroomId,
  buildMatchroomCardData,
}: Props) {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {loadingMatchrooms ? (
        <ActivityIndicator size="small" color={COLORS.accent} />
      ) : matchrooms.length === 0 ? (
        <Text style={styles.emptyText}>No matchrooms found for this zone.</Text>
      ) : (
        <>
          <View style={styles.resultsCount}>
            <Text style={styles.resultsCountText}>
              {matchrooms.length} matchroom{matchrooms.length !== 1 ? "s" : ""} found
            </Text>
          </View>
          {matchrooms.map((item) => (
            <View
              key={item.id}
              style={
                focusedMatchroomId === item.id
                  ? styles.matchroomFocusedWrap
                  : styles.walkinMatchroomItem
              }
            >
              <MatchroomCard
                room={buildMatchroomCardData(item)}
                containerStyle={focusedMatchroomId === item.id ? { marginBottom: 0 } : undefined}
              />
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}
