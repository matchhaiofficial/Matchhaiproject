import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { AppIcon } from "../../../../src/components/AppIcon";
import { Matchroom } from "../../../../src/services/convex/matchService";
import { COLORS } from "../../../../src/theme";
import {
  type ZoneBookingQueueItem,
} from "../../../../src/services/convex/zoneAdminBookingService";
import { formatEnumLabel, getZoneBookingQueueStatusLabel } from "../../../../src/utils/statusLabels";
import MatchroomCard from "../../../matchrooms/components/MatchroomCard";
import styles from "../bookings.styles";

type ProcessingAction = "accept" | "reject" | "counter" | null;

type Props = {
  loadingQueue: boolean;
  showFilters: boolean;
  onToggleFilters: () => void;
  requestFilters: readonly string[];
  assetFilters: readonly string[];
  requestFilter: string;
  assetFilter: string;
  onSelectRequestFilter: (filter: string) => void;
  onSelectAssetFilter: (filter: string) => void;
  filteredQueue: ZoneBookingQueueItem[];
  selectedRequestId: string | null;
  processingAction: ProcessingAction;
  onSelectRequest: (requestId: string | null) => void;
  onOpenCounterModal: () => void;
  onAccept: (item?: ZoneBookingQueueItem) => void;
  onReject: () => void;
  buildRequestMatchroom: (item: ZoneBookingQueueItem) => Matchroom;
};

export function ZoneBookingsRequestsSection({
  loadingQueue,
  showFilters,
  onToggleFilters,
  requestFilters,
  assetFilters,
  requestFilter,
  assetFilter,
  onSelectRequestFilter,
  onSelectAssetFilter,
  filteredQueue,
  selectedRequestId,
  processingAction,
  onSelectRequest,
  onOpenCounterModal,
  onAccept,
  onReject,
  buildRequestMatchroom,
}: Props) {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable style={styles.filtersToggle} onPress={onToggleFilters}>
        <View style={styles.filtersToggleLeft}>
          <AppIcon name="tune" size="sm" tone="accent" />
          <Text style={styles.filtersToggleText}>Filters</Text>
        </View>
        <AppIcon
          name={showFilters ? "expand-less" : "expand-more"}
          size={18}
          tone="muted"
        />
      </Pressable>

      {showFilters ? (
        <View style={styles.filtersWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {requestFilters.map((filter) => (
              <Pressable
                key={filter}
                onPress={() => onSelectRequestFilter(filter)}
                style={[
                  styles.filterChip,
                  requestFilter === filter && styles.filterChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    requestFilter === filter && styles.filterChipTextActive,
                  ]}
                >
                  {getZoneBookingQueueStatusLabel(filter)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {assetFilters.map((filter) => (
              <Pressable
                key={filter}
                onPress={() => onSelectAssetFilter(filter)}
                style={[
                  styles.filterChip,
                  assetFilter === filter && styles.filterChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    assetFilter === filter && styles.filterChipTextActive,
                  ]}
                >
                  {formatEnumLabel(filter)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {loadingQueue ? (
        <ActivityIndicator size="small" color={COLORS.accent} />
      ) : filteredQueue.length === 0 ? (
        <Text style={styles.emptyText}>No requests found for selected filters.</Text>
      ) : (
        filteredQueue.map((item) => {
          const selected = selectedRequestId === item.id;

          return (
            <View key={item.id} style={selected ? styles.matchroomFocusedWrap : undefined}>
              <MatchroomCard
                room={buildRequestMatchroom(item)}
                onAcceptPress={() => {
                  onSelectRequest(item.id);
                onAccept(item);
              }}
                onPress={() => onSelectRequest(selected ? null : item.id)}
                acceptLabel="Accept"
                containerStyle={selected ? styles.matchroomCardCollapsed : undefined}
              />
              {selected ? (
                <View style={styles.inlineActionsCard}>
                  <View style={styles.actionsRow}>
                    <Pressable
                      style={[styles.actionButton, styles.counterButton]}
                      onPress={onOpenCounterModal}
                      disabled={processingAction !== null}
                    >
                      <AppIcon name="edit" size="sm" color="#FFF" />
                      <Text numberOfLines={1} style={styles.actionText}>
                        Alternative
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionButton, styles.acceptButton]}
                      onPress={() => onAccept()}
                      disabled={processingAction !== null}
                    >
                      {processingAction === "accept" ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <AppIcon name="check" size="sm" color="#FFF" />
                          <Text numberOfLines={1} style={styles.actionText}>
                            Accept
                          </Text>
                        </>
                      )}
                    </Pressable>
                    <Pressable
                      style={[styles.actionButton, styles.rejectButton]}
                      onPress={onReject}
                      disabled={processingAction !== null}
                    >
                      {processingAction === "reject" ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <AppIcon name="close" size="sm" color="#FFF" />
                          <Text numberOfLines={1} style={styles.actionText}>
                            Reject
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
