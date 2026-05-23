import React from "react";
import { ActivityIndicator, Dimensions, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "../../../../src/components/AppIcon";
import {
  AppDrawer,
  AppModalBody,
  AppModalFooter,
  AppModalHeader,
} from "../../../../src/components/AppModalPrimitives";
import { AppButton } from "../../../../src/components/AppPrimitives";
import { Matchroom } from "../../../../src/services/convex/matchService";
import { COLORS } from "../../../../src/theme";
import {
  type ZoneBookingQueueItem,
} from "../../../../src/services/convex/zoneAdminBookingService";
import MatchroomCard from "../../../matchrooms/components/MatchroomCard";
import styles from "../bookings.styles";

type ProcessingAction = "accept" | "reject" | "counter" | null;
const DRAWER_WIDTH = Math.min(420, Math.round(Dimensions.get("window").width * 0.94));

type FilterOption = { key: string; label: string };
type FilterGroup = {
  key: string;
  label: string;
  options: readonly FilterOption[];
  value: string;
  onSelect: (value: string) => void;
};

function FilterChipGroup({ label, options, value, onSelect }: FilterGroup) {
  return (
    <>
      <Text style={styles.filterSectionLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {options.map((option) => (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            style={[styles.filterChip, value === option.key && styles.filterChipActive]}
          >
            <Text
              style={[styles.filterChipText, value === option.key && styles.filterChipTextActive]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </>
  );
}

type Props = {
  mode?: "requests" | "pending";
  loadingQueue: boolean;
  showFilters: boolean;
  onToggleFilters: () => void;
  filterGroups: FilterGroup[];
  searchQuery: string;
  activeFilterCount: number;
  onSearchQueryChange: (query: string) => void;
  onResetFilters: () => void;
  filteredQueue: ZoneBookingQueueItem[];
  pendingOffers?: any[];
  selectedRequestId: string | null;
  processingAction: ProcessingAction;
  onSelectRequest: (requestId: string | null) => void;
  onOpenCounterModal: (item?: ZoneBookingQueueItem) => void;
  onAccept: (item?: ZoneBookingQueueItem) => void;
  onReject: () => void;
  buildRequestMatchroom: (item: ZoneBookingQueueItem) => Matchroom;
};

export function ZoneBookingsRequestsSection({
  mode = "requests",
  loadingQueue,
  showFilters,
  onToggleFilters,
  filterGroups,
  searchQuery,
  activeFilterCount,
  onSearchQueryChange,
  onResetFilters,
  filteredQueue,
  pendingOffers = [],
  selectedRequestId,
  processingAction,
  onSelectRequest,
  onOpenCounterModal,
  onAccept,
  onReject,
  buildRequestMatchroom,
}: Props) {
  const insets = useSafeAreaInsets();
  const offerByRequestId = new Map(pendingOffers.map((offer) => [String(offer.requestId), offer]));

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {mode === "requests" ? (
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <AppIcon name="search" size={20} color={COLORS.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search requests..."
              placeholderTextColor={COLORS.muted}
              value={searchQuery}
              onChangeText={onSearchQueryChange}
            />
            {searchQuery.length > 0 ? (
              <Pressable onPress={() => onSearchQueryChange("")} hitSlop={8}>
                <AppIcon name="close" size={18} color={COLORS.muted} />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            onPress={onToggleFilters}
            style={({ pressed }) => [
              styles.filterButton,
              pressed && styles.filterButtonPressed,
            ]}
          >
            <AppIcon name="filters" size={22} color={COLORS.text} />
            {activeFilterCount > 0 ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>
                  {activeFilterCount > 9 ? "9+" : activeFilterCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      ) : null}

      <AppDrawer visible={showFilters} onClose={onToggleFilters} drawerStyle={[styles.filterDrawer, { width: DRAWER_WIDTH }]}>
        <View style={[styles.filterDrawerContent, { paddingTop: Math.max(insets.top, 16) }]}>
          <AppModalHeader title="Filters" subtitle="Requests" onClose={onToggleFilters} compact />
          <AppModalBody scroll contentContainerStyle={styles.filtersDrawerBody}>
            <View style={styles.filtersWrap}>
              {filterGroups.map((group) => (
                <FilterChipGroup
                  key={group.key}
                  label={group.label}
                  options={group.options}
                  value={group.value}
                  onSelect={group.onSelect}
                />
              ))}
            </View>
          </AppModalBody>
          <AppModalFooter style={styles.filterDrawerFooter}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <AppButton
                variant="ghost"
                disabled={activeFilterCount === 0}
                style={{ flex: 1 }}
                onPress={onResetFilters}
              >
                Reset
              </AppButton>
              <AppButton style={{ flex: 1 }} onPress={onToggleFilters}>
                Done
              </AppButton>
            </View>
          </AppModalFooter>
        </View>
      </AppDrawer>

      {loadingQueue ? (
        <ActivityIndicator size="small" color={COLORS.accent} />
      ) : filteredQueue.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <Text style={styles.emptyStateTitle}>
            {mode === "pending" ? "No pending alternatives" : "No requests found"}
          </Text>
          <Text style={styles.emptyText}>
            {mode === "pending"
              ? "Alternative time requests waiting for captain response will appear here."
              : "No requests found for selected filters."}
          </Text>
        </View>
      ) : (
        filteredQueue.map((item) => {
          const selected = selectedRequestId === item.id;
          const offer = offerByRequestId.get(String(item.id));

          const integrated = selected || (mode === "pending" && !!offer);

          return (
            <View key={item.id} style={integrated ? styles.requestExpandedCard : undefined}>
              <MatchroomCard
                room={buildRequestMatchroom(item)}
                onAcceptPress={() => {
                  onSelectRequest(item.id);
                onAccept(item);
                }}
                onPress={() => onSelectRequest(selected ? null : item.id)}
                acceptLabel="Accept"
                containerStyle={integrated ? styles.requestEmbeddedMatchroomCard : undefined}
              />
              {mode === "pending" && offer ? (
                <View style={styles.pendingOfferPanel}>
                  <Text style={styles.pendingOfferTitle}>Waiting for response</Text>
                  <Text style={styles.pendingOfferText}>
                    Original: {item.preferredTime || "Requested time"}
                  </Text>
                  <Text style={styles.pendingOfferText}>
                    Suggested: {offer.scheduleOptions?.[0]?.time || offer.proposedTime || "--"}
                    {offer.scheduleOptions?.[0]?.endTime ? ` - ${offer.scheduleOptions[0].endTime}` : ""}
                  </Text>
                  {offer.expiresAt ? (
                    <Text style={styles.pendingOfferExpiry}>
                      Expires {new Date(offer.expiresAt).toLocaleString()}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {selected && mode === "requests" ? (
                <View style={styles.inlineActionsCard}>
                  <View style={styles.actionsRow}>
                    <Pressable
                      style={[styles.actionButton, styles.counterButton]}
                      onPress={() => onOpenCounterModal(item)}
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
