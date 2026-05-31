import React from "react";
import { ActivityIndicator, Dimensions, FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
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
  type ZoneMatchroomListItem,
} from "../../../../src/services/convex/zoneAdminBookingService";
import MatchroomCard from "../../../matchrooms/components/MatchroomCard";
import styles from "../bookings.styles";

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
  loadingMatchrooms: boolean;
  matchrooms: ZoneMatchroomListItem[];
  loadingMore?: boolean;
  onLoadMore?: () => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  filterGroups: FilterGroup[];
  searchQuery: string;
  activeFilterCount: number;
  onSearchQueryChange: (query: string) => void;
  onResetFilters: () => void;
  focusedMatchroomId: string | null;
  buildMatchroomCardData: (item: ZoneMatchroomListItem) => Matchroom;
};

export function ZoneBookingsMatchroomsSection({
  loadingMatchrooms,
  matchrooms,
  loadingMore = false,
  onLoadMore,
  showFilters,
  onToggleFilters,
  filterGroups,
  searchQuery,
  activeFilterCount,
  onSearchQueryChange,
  onResetFilters,
  focusedMatchroomId,
  buildMatchroomCardData,
}: Props) {
  const insets = useSafeAreaInsets();

  const header = (
    <>
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

      {!loadingMatchrooms && matchrooms.length > 0 ? (
        <View style={styles.resultsCount}>
          <Text style={styles.resultsCountText}>
            {matchrooms.length} matchroom{matchrooms.length !== 1 ? "s" : ""} found
          </Text>
        </View>
      ) : null}
    </>
  );

  return (
    <FlatList
      data={loadingMatchrooms ? [] : matchrooms}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
      initialNumToRender={8}
      windowSize={11}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      ListEmptyComponent={
        loadingMatchrooms ? (
          <ActivityIndicator size="small" color={COLORS.accent} />
        ) : (
          <Text style={styles.emptyText}>No matchrooms found for this zone.</Text>
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
        <MatchroomRow
          item={item}
          focused={focusedMatchroomId === item.id}
          buildMatchroomCardData={buildMatchroomCardData}
        />
      )}
    />
  );
}

const MatchroomRow = React.memo(function MatchroomRow({
  item,
  focused,
  buildMatchroomCardData,
}: {
  item: ZoneMatchroomListItem;
  focused: boolean;
  buildMatchroomCardData: (item: ZoneMatchroomListItem) => Matchroom;
}) {
  return (
    <View style={focused ? styles.matchroomFocusedWrap : styles.walkinMatchroomItem}>
      <MatchroomCard
        room={buildMatchroomCardData(item)}
        containerStyle={focused ? { marginBottom: 0 } : undefined}
      />
    </View>
  );
});
