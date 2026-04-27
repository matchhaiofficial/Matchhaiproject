import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";

import AppHeader from "../../../src/components/AppHeader";
import { AppIcon } from "../../../src/components/AppIcon";
import Screen from "../../../src/components/Screen";
import SegmentedTabs from "../../../src/components/SegmentedTabs";
import DiscoverFilterDrawer from "../../../src/features/discover/components/DiscoverFilterDrawer";
import DiscoverMatchroomList from "../../../src/features/discover/components/DiscoverMatchroomList";
import DiscoverPlayerList from "../../../src/features/discover/components/DiscoverPlayerList";
import DiscoverTeamList from "../../../src/features/discover/components/DiscoverTeamList";
import DiscoverZoneList from "../../../src/features/discover/components/DiscoverZoneList";
import {
  DEFAULT_DISCOVER_FILTERS,
  DEFAULT_MATCHROOM_FILTERS,
  DEFAULT_PLAYER_FILTERS,
  DEFAULT_TEAM_FILTERS,
  DEFAULT_ZONE_FILTERS,
  getActiveFilterCount,
  SEGMENT_LABELS,
  type DiscoverFiltersState,
} from "../../../src/features/discover/filterConfig";
import { DiscoverSegment } from "../../../src/features/discover/types";
import { useRouteLogger } from "../../../src/hooks/useRouteLogger";
import { useEntrance } from "../../../src/motion/useEntrance";
import { usePressScale } from "../../../src/motion/usePressScale";
import { COLORS } from "../../../src/theme";
import Logger from "../../../src/utils/logger";
import styles from "./discover.styles";

const ALLOWED_SEGMENTS: DiscoverSegment[] = [
  "matchrooms",
  "players",
  "teams",
  "zones",
];
const SEGMENT_ITEMS: { key: DiscoverSegment; label: string }[] = [
  { key: "matchrooms", label: "Rooms" },
  { key: "players", label: "Players" },
  { key: "teams", label: "Teams" },
  { key: "zones", label: "Venues" },
];
const HIDE_PLAYER_TAB_BAR = process.env.EXPO_PUBLIC_HIDE_TAB_BAR === "1";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function IconButton({
  icon,
  color,
  onPress,
  hitSlop,
}: {
  icon: React.ComponentProps<typeof AppIcon>["name"];
  color: string;
  onPress: () => void;
  hitSlop?: { top: number; bottom: number; left: number; right: number };
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale({
    activeScale: 0.98,
  });

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={hitSlop}
      style={animatedStyle}
    >
      <AppIcon name={icon} size={20} color={color} />
    </AnimatedPressable>
  );
}

function Fab({
  onPress,
  onPressIn,
}: {
  onPress: () => void;
  onPressIn?: () => void;
}) {
  const { animatedStyle, onPressIn: motionPressIn, onPressOut } = usePressScale({
    activeScale: 0.985,
  });

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        motionPressIn();
        onPressIn?.();
      }}
      onPressOut={onPressOut}
      style={[styles.fab, animatedStyle]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <AppIcon name="add" size={28} color="#FFF" />
    </AnimatedPressable>
  );
}

const getValidSegment = (segment?: string): DiscoverSegment | null => {
  if (!segment) return null;
  return ALLOWED_SEGMENTS.includes(segment as DiscoverSegment)
    ? (segment as DiscoverSegment)
    : null;
};

export default function DiscoverScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    segment?: string;
    mode?: string;
    t?: string;
  }>();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const touchDebugEnabled =
    __DEV__ && process.env.EXPO_PUBLIC_TOUCH_DEBUG === "1";
  const bottomPadding = HIDE_PLAYER_TAB_BAR ? insets.bottom + 16 : tabBarHeight + 16;

  const [searchQuery, setSearchQuery] = useState("");
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [filters, setFilters] = useState<DiscoverFiltersState>(
    DEFAULT_DISCOVER_FILTERS,
  );
  const [activeSegment, setActiveSegment] = useState<DiscoverSegment>(
    getValidSegment(params.segment) || "matchrooms",
  );
  const [visitedSegments, setVisitedSegments] = useState<Set<DiscoverSegment>>(
    new Set([activeSegment]),
  );

  const { animatedStyle: contentEntranceStyle } = useEntrance({
    axis: "y",
    distance: 10,
    initialScale: 0.995,
  });

  const activeFilterCount = useMemo(
    () => getActiveFilterCount(activeSegment, filters),
    [activeSegment, filters],
  );
  const activePrimaryLabel = useMemo(() => {
    if (activeSegment === "zones") {
      return filters.zones.venueType;
    }
    return filters[activeSegment].game;
  }, [activeSegment, filters]);

  useRouteLogger("DiscoverScreen", {
    segment: activeSegment,
    primaryContext: activePrimaryLabel,
    activeFilterCount,
    searchQueryLength: searchQuery.trim().length,
  });

  useEffect(() => {
    const validSegment = getValidSegment(params.segment);
    Logger.info("Discover", "Sync Effect", {
      paramSegment: params.segment,
      validSegment,
      currentActive: activeSegment,
      intentTime: params.t,
      mode: params.mode,
    });

    if (validSegment && validSegment !== activeSegment) {
      Logger.info("Discover", "Updating activeSegment from param", {
        newSegment: validSegment,
      });
      setActiveSegment(validSegment);
    } else if (params.mode === "my" && activeSegment !== "teams") {
      Logger.info("Discover", "Switching to teams for mode=my");
      setActiveSegment("teams");
    }

    if (params.mode === "my") {
      setFilters((previous) => ({
        ...previous,
        teams: {
          ...previous.teams,
          mode: "my",
        },
      }));
    }
  }, [activeSegment, params.mode, params.segment, params.t]);

  useEffect(() => {
    Logger.info("Discover", "activeSegment state changed", { activeSegment });
  }, [activeSegment]);

  useEffect(() => {
    setVisitedSegments((previous) => {
      if (previous.has(activeSegment)) return previous;
      const next = new Set(previous);
      next.add(activeSegment);
      return next;
    });
  }, [activeSegment]);

  const handleSegmentChange = useCallback(
    (segment: DiscoverSegment) => {
      setActiveSegment(segment);
      router.setParams({ segment, mode: undefined } as any);
    },
    [router],
  );

  const updateMatchrooms = useCallback(
    (patch: Partial<DiscoverFiltersState["matchrooms"]>) => {
      setFilters((previous) => {
        if (
          patch.game &&
          patch.game !== previous.matchrooms.game
        ) {
          return {
            ...previous,
            matchrooms: {
              ...DEFAULT_MATCHROOM_FILTERS,
              game: patch.game,
            },
          };
        }

        return {
          ...previous,
          matchrooms: {
            ...previous.matchrooms,
            ...patch,
          },
        };
      });
    },
    [],
  );

  const updatePlayers = useCallback(
    (patch: Partial<DiscoverFiltersState["players"]>) => {
      setFilters((previous) => {
        if (patch.game && patch.game !== previous.players.game) {
          return {
            ...previous,
            players: {
              ...DEFAULT_PLAYER_FILTERS,
              game: patch.game,
            },
          };
        }

        return {
          ...previous,
          players: {
            ...previous.players,
            ...patch,
          },
        };
      });
    },
    [],
  );

  const updateTeams = useCallback(
    (patch: Partial<DiscoverFiltersState["teams"]>) => {
      setFilters((previous) => {
        if (patch.game && patch.game !== previous.teams.game) {
          return {
            ...previous,
            teams: {
              ...DEFAULT_TEAM_FILTERS,
              game: patch.game,
              mode: previous.teams.mode,
            },
          };
        }

        return {
          ...previous,
          teams: {
            ...previous.teams,
            ...patch,
          },
        };
      });
    },
    [],
  );

  const updateZones = useCallback(
    (patch: Partial<DiscoverFiltersState["zones"]>) => {
      setFilters((previous) => {
        if (patch.venueType && patch.venueType !== previous.zones.venueType) {
          return {
            ...previous,
            zones: {
              ...DEFAULT_ZONE_FILTERS,
              venueType: patch.venueType,
            },
          };
        }

        return {
          ...previous,
          zones: {
            ...previous.zones,
            ...patch,
          },
        };
      });
    },
    [],
  );

  const handleTeamsModeChange = useCallback((mode: DiscoverFiltersState["teams"]["mode"]) => {
    updateTeams({ mode });
  }, [updateTeams]);

  const handleResetActiveFilters = useCallback(() => {
    setFilters((previous) => {
      if (activeSegment === "matchrooms") {
        return {
          ...previous,
          matchrooms: {
            ...DEFAULT_MATCHROOM_FILTERS,
            game: previous.matchrooms.game,
          },
        };
      }

      if (activeSegment === "players") {
        return {
          ...previous,
          players: {
            ...DEFAULT_PLAYER_FILTERS,
            game: previous.players.game,
          },
        };
      }

      if (activeSegment === "teams") {
        return {
          ...previous,
          teams: {
            ...DEFAULT_TEAM_FILTERS,
            game: previous.teams.game,
            mode: previous.teams.mode,
          },
        };
      }

      return {
        ...previous,
        zones: {
          ...DEFAULT_ZONE_FILTERS,
          venueType: previous.zones.venueType,
        },
      };
    });
  }, [activeSegment]);

  const currentSearchLabel = useMemo(
    () => SEGMENT_LABELS[activeSegment].toLowerCase(),
    [activeSegment],
  );

  return (
    <Screen
      style={styles.screen}
      scroll={false}
      contentStyle={styles.screenContent}
      edges={["top"]}
    >
      <AppHeader
        title="Discover"
        inlineTitle
        rightAction={<View style={styles.headerGhostAction} />}
      />

      <View style={styles.header}>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <AppIcon name="search" size={20} color={COLORS.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder={`Search ${currentSearchLabel}...`}
              placeholderTextColor={COLORS.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 ? (
              <IconButton
                icon="close"
                color={COLORS.muted}
                onPress={() => setSearchQuery("")}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              />
            ) : null}
          </View>

          <Pressable
            onPress={() => setFilterDrawerOpen(true)}
            style={({ pressed }) => [
              styles.filterButton,
              pressed && styles.filterButtonPressed,
            ]}
          >
            <AppIcon name="tune" size={22} color={COLORS.text} />
            {activeFilterCount > 0 ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>
                  {activeFilterCount > 9 ? "9+" : activeFilterCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <SegmentedTabs
          items={SEGMENT_ITEMS}
          value={activeSegment}
          onChange={handleSegmentChange}
          style={styles.segmentTabs}
        />
      </View>

      <Animated.View style={[styles.contentArea, contentEntranceStyle]}>
        {visitedSegments.has("matchrooms") ? (
          <View
            style={[
              styles.segmentPanel,
              activeSegment !== "matchrooms" && styles.segmentPanelHidden,
            ]}
          >
            <DiscoverMatchroomList
              filters={filters.matchrooms}
              searchQuery={searchQuery}
              bottomPadding={bottomPadding}
            />
          </View>
        ) : null}

        {visitedSegments.has("players") ? (
          <View
            style={[
              styles.segmentPanel,
              activeSegment !== "players" && styles.segmentPanelHidden,
            ]}
          >
            <DiscoverPlayerList
              filters={filters.players}
              searchQuery={searchQuery}
              bottomPadding={bottomPadding}
            />
          </View>
        ) : null}

        {visitedSegments.has("teams") ? (
          <View
            style={[
              styles.segmentPanel,
              activeSegment !== "teams" && styles.segmentPanelHidden,
            ]}
          >
            <DiscoverTeamList
              filters={filters.teams}
              searchQuery={searchQuery}
              onModeChange={handleTeamsModeChange}
              bottomPadding={bottomPadding}
            />
          </View>
        ) : null}

        {visitedSegments.has("zones") ? (
          <View
            style={[
              styles.segmentPanel,
              activeSegment !== "zones" && styles.segmentPanelHidden,
            ]}
          >
            <DiscoverZoneList
              filters={filters.zones}
              searchQuery={searchQuery}
              bottomPadding={bottomPadding}
            />
          </View>
        ) : null}
      </Animated.View>

      {(activeSegment === "matchrooms" || activeSegment === "teams") ? (
        <View
          style={[
            styles.fabWrapper,
            {
              bottom: HIDE_PLAYER_TAB_BAR
                ? insets.bottom + 16
                : tabBarHeight + 16,
            },
          ]}
        >
          <Fab
            onPressIn={() => {
              if (!touchDebugEnabled) return;
              Logger.debug("TouchDebug", "pressIn", {
                tag: `discover_fab_${activeSegment}`,
              });
            }}
            onPress={() => {
              if (touchDebugEnabled) {
                Logger.debug("TouchDebug", "press", {
                  tag: `discover_fab_${activeSegment}`,
                });
              }

              if (activeSegment === "matchrooms") {
                router.push("/matchrooms/create" as any);
              } else {
                router.push("/teams/create" as any);
              }
            }}
          />
        </View>
      ) : null}

      <DiscoverFilterDrawer
        visible={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        activeSegment={activeSegment}
        filters={filters}
        activeCount={activeFilterCount}
        onReset={handleResetActiveFilters}
        onUpdateMatchrooms={updateMatchrooms}
        onUpdatePlayers={updatePlayers}
        onUpdateTeams={updateTeams}
        onUpdateZones={updateZones}
      />
    </Screen>
  );
}
