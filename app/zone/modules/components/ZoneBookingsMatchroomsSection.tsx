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
import { formatEnumLabel } from "../../../../src/utils/statusLabels";
import {
  type ZoneMatchroomListItem,
} from "../../../../src/services/convex/zoneAdminBookingService";
import MatchroomCard from "../../../matchrooms/components/MatchroomCard";
import styles from "../bookings.styles";

const DRAWER_WIDTH = Math.min(420, Math.round(Dimensions.get("window").width * 0.94));

type Props = {
  loadingMatchrooms: boolean;
  matchrooms: ZoneMatchroomListItem[];
  showFilters: boolean;
  onToggleFilters: () => void;
  statusFilters: readonly string[];
  statusFilter: string;
  searchQuery: string;
  activeFilterCount: number;
  onSearchQueryChange: (query: string) => void;
  onSelectStatusFilter: (filter: string) => void;
  focusedMatchroomId: string | null;
  buildMatchroomCardData: (item: ZoneMatchroomListItem) => Matchroom;
};

export function ZoneBookingsMatchroomsSection({
  loadingMatchrooms,
  matchrooms,
  showFilters,
  onToggleFilters,
  statusFilters,
  statusFilter,
  searchQuery,
  activeFilterCount,
  onSearchQueryChange,
  onSelectStatusFilter,
  focusedMatchroomId,
  buildMatchroomCardData,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <AppIcon name="search" size={20} color={COLORS.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search matchrooms..."
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

      <AppDrawer visible={showFilters} onClose={onToggleFilters} drawerStyle={[styles.filterDrawer, { width: DRAWER_WIDTH }]}>
        <View style={[styles.filterDrawerContent, { paddingTop: Math.max(insets.top, 16) }]}>
          <AppModalHeader title="Filters" subtitle="Matchrooms" onClose={onToggleFilters} compact />
          <AppModalBody scroll contentContainerStyle={styles.filtersDrawerBody}>
            <Text style={styles.filterSectionLabel}>Matchroom status</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {statusFilters.map((filter) => (
                <Pressable
                  key={filter}
                  onPress={() => onSelectStatusFilter(filter)}
                  style={[
                    styles.filterChip,
                    statusFilter === filter && styles.filterChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      statusFilter === filter && styles.filterChipTextActive,
                    ]}
                  >
                    {formatEnumLabel(filter)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </AppModalBody>
          <AppModalFooter style={styles.filterDrawerFooter}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <AppButton
                variant="ghost"
                disabled={activeFilterCount === 0}
                style={{ flex: 1 }}
                onPress={() => onSelectStatusFilter("all")}
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
