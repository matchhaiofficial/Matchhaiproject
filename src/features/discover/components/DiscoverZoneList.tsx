import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";

import { api } from "../../../../convex/_generated/api";
import { AppIcon } from "../../../../src/components/AppIcon";
import { convex } from "../../../../src/lib/convex";
import { COLORS } from "../../../../src/theme";
import Logger from "../../../../src/utils/logger";
import { recordPayloadMetric } from "../../../../src/utils/perfInstrumentation";
import { deriveZoneRate, formatSupportedGameLabels, Zone } from "../../../services/convex/zoneService";
import type { ZoneFilters } from "../filterConfig";
import {
  DiscoverEmptyState,
  DiscoverPressableCard,
  DiscoverResultsCount,
  DiscoverTag,
  discoverSharedStyles,
} from "./DiscoverShared";
import styles from "../styles/zones.styles";

const ZoneRow = React.memo(function ZoneRow({
  zone,
  selectedGameOrSport,
  onPressZone,
}: {
  zone: Zone;
  selectedGameOrSport: string;
  onPressZone: (zoneId: string) => void;
}) {
  const address = [zone.primaryBranch?.areaLabel, zone.primaryBranch?.city]
    .filter(Boolean)
    .join(", ");
  const isSportsCourt = zone.type === "sports";
  const isHybrid = zone.type === "hybrid";
  const supportedGames = formatSupportedGameLabels(zone.games);
  const visibleGames =
    selectedGameOrSport === "all"
      ? supportedGames
      : supportedGames.filter((game) => game.key === selectedGameOrSport);
  const gameTags = visibleGames.length > 0 ? visibleGames : supportedGames;

  const handlePress = useCallback(() => {
    onPressZone(zone.id);
  }, [onPressZone, zone.id]);

  return (
    <DiscoverPressableCard onPress={handlePress} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={isSportsCourt ? styles.cardIconSports : styles.cardIcon}>
          <AppIcon
            name={isSportsCourt ? "sports-soccer" : "sports-esports"}
            size={24}
            color={isSportsCourt ? COLORS.success : COLORS.accent}
          />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1} ellipsizeMode="tail">
            {zone.venueBrandName}
          </Text>
          {gameTags.length > 0 ? (
            <View style={styles.gameTags}>
              {gameTags.slice(0, 2).map((game) => (
                <DiscoverTag key={game.key} label={game.label.toUpperCase()} tone="accent" />
              ))}
              {gameTags.length > 2 ? (
                <DiscoverTag label={`+${gameTags.length - 2}`} tone="ghost" />
              ) : null}
            </View>
          ) : null}
          <View style={styles.cardSubtitleRow}>
            <AppIcon name="location-on" size={12} tone="muted" />
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              {address || "Location unavailable"}
            </Text>
          </View>
        </View>
        {zone.effectiveRateLabel ? (
          <DiscoverTag label={zone.effectiveRateLabel} tone="success" style={styles.priceTag} />
        ) : null}
      </View>

      <View style={styles.tagsRow}>
        <DiscoverTag
          label={isHybrid ? "Hybrid" : isSportsCourt ? "Court" : "Zone"}
          tone={isSportsCourt ? "success" : "neutral"}
        />
      </View>
    </DiscoverPressableCard>
  );
});

interface DiscoverZoneListProps {
  filters: ZoneFilters;
  searchQuery: string;
  bottomPadding?: number;
}

export default function DiscoverZoneList({
  filters,
  searchQuery,
  bottomPadding,
}: DiscoverZoneListProps) {
  const router = useRouter();
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const userArea = null;
  const userCity = "Karachi";

  const fetchZones = useCallback(async () => {
    try {
      const rows = await convex.query(api.discover.listDiscoverZones, {
        selectedVenueType: filters.venueType,
        selectedGame: filters.gameOrSport,
        searchQuery,
        selectedProximity: filters.proximity,
        selectedArea: filters.area,
        selectedPriceRange: filters.priceRange,
        selectedPlatform: filters.platform,
        userArea: userArea || undefined,
        userCity: userCity || undefined,
        limit: 200,
      });

      const mapped = (rows as Zone[]).map((zone) => {
        if (filters.gameOrSport !== "all") {
          const derivation = deriveZoneRate(zone, filters.gameOrSport);
          return {
            ...zone,
            effectiveRate: derivation.rate,
            effectiveRateLabel: derivation.label,
          };
        }
        return zone;
      });

      setZones(mapped);
      recordPayloadMetric("discover.zones_payload", mapped, {
        venueType: filters.venueType,
        game: filters.gameOrSport,
        query: searchQuery,
      });
    } catch (error) {
      Logger.error("DiscoverZones", "Failed to fetch zones", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, searchQuery]);

  useEffect(() => {
    setLoading(true);
    fetchZones();
  }, [fetchZones]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchZones();
  }, [fetchZones]);

  const contentContainerStyle = useMemo(
    () => [styles.listContent, { paddingBottom: bottomPadding ?? 24 }],
    [bottomPadding],
  );

  const onPressZone = useCallback(
    (zoneId: string) => {
      router.push(`/(player)/zones/${zoneId}` as any);
    },
    [router],
  );

  const renderZoneItem = useCallback(
    ({ item }: { item: Zone }) => {
      return (
        <ZoneRow
          zone={item}
          selectedGameOrSport={filters.gameOrSport}
          onPressZone={onPressZone}
        />
      );
    },
    [filters.gameOrSport, onPressZone],
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <View style={discoverSharedStyles.shell}>
      <DiscoverResultsCount
        label={`${zones.length} venue${zones.length !== 1 ? "s" : ""} found`}
      />

      <FlatList
        data={zones}
        renderItem={renderZoneItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
          />
        }
        ListEmptyComponent={
          <DiscoverEmptyState
            icon="store-mall-directory"
            title="No Venues Found"
            description="Try adjusting your search or filters."
          />
        }
      />
    </View>
  );
}
