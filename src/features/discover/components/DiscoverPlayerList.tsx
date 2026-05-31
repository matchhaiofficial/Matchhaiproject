import { useFocusEffect } from "expo-router";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";

import { api } from "../../../../convex/_generated/api";
import { AppImage } from "../../../../src/components/AppImage";
import { useAuth } from "../../../../src/context/AuthContext";
import { useToast } from "../../../../src/hooks/useToast";
import { convex } from "../../../../src/lib/convex";
import { sendFriendRequestToUser } from "../../../../src/services/convex/socialService";
import { COLORS } from "../../../../src/theme";
import Logger from "../../../../src/utils/logger";
import { recordPayloadMetric } from "../../../../src/utils/perfInstrumentation";
import { GameKey } from "../types";
import type { PlayerFilters } from "../filterConfig";
import {
  DiscoverActionChip,
  DiscoverEmptyState,
  DiscoverPressableCard,
  DiscoverResultsCount,
  DiscoverTag,
  discoverSharedStyles,
} from "./DiscoverShared";
import styles from "../styles/players.styles";

interface Player {
  uid: string;
  username: string;
  primaryGames: string[];
  isOnline: boolean;
  roles?: Record<string, string>;
  faceitElo?: number;
  faceitSkillLevel?: number;
  skillScores?: Record<string, { rating: number; tier: string }>;
  fcTeam?: string;
  tekkenFavorites?: string[];
  playsCs2?: boolean;
  playsCs16?: boolean;
  playsValorant?: boolean;
  playsFc?: boolean;
  playsTekken?: boolean;
  playsFutsal?: boolean;
  playsIndoorCricket?: boolean;
  playsPadel?: boolean;
  playsPickleball?: boolean;
  isFriend?: boolean;
  hasPendingRequest?: boolean;
}

const PROFILE_GAME_BADGES: Array<{
  key: Exclude<GameKey, "all">;
  label: string;
  enabled: (player: Player) => boolean;
}> = [
    { key: "cs2", label: "CS2", enabled: (player) => !!player.playsCs2 },
    { key: "cs16", label: "CS 1.6", enabled: (player) => !!player.playsCs16 },
    { key: "valorant", label: "Valorant", enabled: (player) => !!player.playsValorant },
    { key: "fc26", label: "FC26", enabled: (player) => !!player.playsFc },
    { key: "tekken8", label: "Tekken 8", enabled: (player) => !!player.playsTekken },
    // Physical sports are temporarily disabled.
    // { key: "futsal", label: "Futsal", enabled: (player) => !!player.playsFutsal },
    // { key: "indoor_cricket", label: "Cricket", enabled: (player) => !!player.playsIndoorCricket },
    // { key: "padel", label: "Padel", enabled: (player) => !!player.playsPadel },
    // { key: "pickleball", label: "Pickleball", enabled: (player) => !!player.playsPickleball },
  ];

const abbreviateRole = (role: string): string => {
  const abbreviations: Record<string, string> = {
    Goalkeeper: "GK",
    Defender: "DEF",
    Midfielder: "MID",
    Forward: "FWD",
    Striker: "ST",
    "All-rounder": "AR",
    "Wicket Keeper": "WK",
    "Entry Fragger": "Entry",
    "Aggressive / Front": "Front",
    "Defensive / Back": "Back",
  };
  return abbreviations[role] || role;
};

const faceitLevelIcons: Record<number, any> = {
  1: require("../../../../assets/images/faceit-levels/Level 1.png"),
  2: require("../../../../assets/images/faceit-levels/Level 2.png"),
  3: require("../../../../assets/images/faceit-levels/Level 3.png"),
  4: require("../../../../assets/images/faceit-levels/Level 4.png"),
  5: require("../../../../assets/images/faceit-levels/Level 5.png"),
  6: require("../../../../assets/images/faceit-levels/Level 6.png"),
  7: require("../../../../assets/images/faceit-levels/Level 7.png"),
  8: require("../../../../assets/images/faceit-levels/Level 8.png"),
  9: require("../../../../assets/images/faceit-levels/Level 9.png"),
  10: require("../../../../assets/images/faceit-levels/Level 10.png"),
};

const getFaceitLevel = (elo: number): number => {
  if (elo < 801) return 1;
  if (elo < 951) return 2;
  if (elo < 1101) return 3;
  if (elo < 1251) return 4;
  if (elo < 1401) return 5;
  if (elo < 1551) return 6;
  if (elo < 1701) return 7;
  if (elo < 1851) return 8;
  if (elo < 2001) return 9;
  return 10;
};

const getEnabledProfileGames = (player: Player) =>
  PROFILE_GAME_BADGES.filter((game) => game.enabled(player));

const getSelectedGameTier = (
  player: Player,
  selectedGame: Exclude<GameKey, "all">,
) => {
  if (selectedGame === "cs2") return player.skillScores?.cs2?.tier || null;
  if (selectedGame === "fc26") return player.skillScores?.fc26?.tier || null;
  if (selectedGame === "tekken8") {
    return player.skillScores?.tekken8?.tier || player.skillScores?.tekken?.tier || null;
  }
  if (selectedGame === "futsal") return player.skillScores?.futsal?.tier || null;
  if (selectedGame === "indoor_cricket") {
    return (
      player.skillScores?.indoor_cricket?.tier ||
      player.skillScores?.cricket?.tier ||
      null
    );
  }
  if (selectedGame === "padel") return player.skillScores?.padel?.tier || null;
  if (selectedGame === "pickleball") {
    return player.skillScores?.pickleball?.tier || null;
  }
  if (selectedGame === "cs16") return player.skillScores?.cs16?.tier || null;
  if (selectedGame === "valorant") return player.skillScores?.valorant?.tier || null;
  return null;
};

const PlayerRow = React.memo(function PlayerRow({
  player,
  selectedGame,
  actionLoadingUid,
  onPressProfile,
  onAddFriend,
}: {
  player: Player;
  selectedGame: GameKey;
  actionLoadingUid: string | null;
  onPressProfile: (uid: string) => void;
  onAddFriend: (uid: string) => void;
}) {
  const isFriend = player.isFriend === true;
  const isPending = player.hasPendingRequest === true;
  const isLoading = actionLoadingUid === player.uid;

  const handlePress = useCallback(() => {
    onPressProfile(player.uid);
  }, [onPressProfile, player.uid]);

  const handleAddFriend = useCallback(() => {
    onAddFriend(player.uid);
  }, [onAddFriend, player.uid]);

  const actionNode = isFriend ? (
    <DiscoverActionChip label="Friends" tone="success" icon="check-circle" />
  ) : isPending ? (
    <DiscoverActionChip label="Pending" tone="warning" icon="schedule" />
  ) : (
    <DiscoverActionChip
      label={isLoading ? "Adding..." : "Add"}
      icon="person-add"
      tone="accent"
      onPress={handleAddFriend}
      disabled={isLoading}
    />
  );

  if (selectedGame === "all") {
    const enabledGames = getEnabledProfileGames(player);
    return (
      <DiscoverPressableCard onPress={handlePress} style={styles.playerCard}>
        <View style={styles.playerCardBody}>
          <View style={styles.playerAvatar}>
            <Text style={styles.playerAvatarText}>
              {player.username.charAt(0).toUpperCase()}
            </Text>
            {player.isOnline ? <View style={styles.onlineIndicator} /> : null}
          </View>
          <View style={styles.playerInfo}>
            <Text style={styles.playerName}>{player.username}</Text>
            <View style={styles.gameTags}>
              {enabledGames.slice(0, 2).map((game, index) => (
                <DiscoverTag key={index} label={game.label.toUpperCase()} tone="accent" />
              ))}
              {enabledGames.length > 2 ? (
                <DiscoverTag label={`+${enabledGames.length - 2}`} tone="ghost" />
              ) : null}
            </View>
          </View>
          {actionNode}
        </View>
      </DiscoverPressableCard>
    );
  }

  const gameLevel = getSelectedGameTier(player, selectedGame);
  const faceitLevel =
    typeof player.faceitSkillLevel === "number"
      ? player.faceitSkillLevel
      : typeof player.faceitElo === "number"
        ? getFaceitLevel(player.faceitElo)
        : null;
  const gameSpecificInfo =
    selectedGame === "fc26"
      ? player.fcTeam
      : selectedGame === "tekken8"
        ? player.tekkenFavorites?.[0]
        : player.roles?.[`${selectedGame}Role`];

  return (
    <DiscoverPressableCard onPress={handlePress} style={styles.playerCard}>
      <View style={styles.playerCardBody}>
        <View style={styles.playerAvatar}>
          <Text style={styles.playerAvatarText}>
            {player.username.charAt(0).toUpperCase()}
          </Text>
          {player.isOnline ? <View style={styles.onlineIndicator} /> : null}
        </View>
        <View style={styles.playerInfo}>
          <Text style={styles.playerName}>{player.username}</Text>

          <View style={styles.playerMetaRow}>
            {gameLevel ? (
              <DiscoverTag label={gameLevel.toUpperCase()} tone="accent" />
            ) : null}
            {gameSpecificInfo ? (
              <DiscoverTag label={abbreviateRole(gameSpecificInfo)} tone="ghost" />
            ) : null}
            {selectedGame === "cs2" && faceitLevel !== null ? (
              <AppImage
                source={faceitLevelIcons[faceitLevel]}
                containerStyle={styles.faceitIcon}
                contentFit="contain"
              />
            ) : null}
          </View>
        </View>

        {actionNode}
      </View>
    </DiscoverPressableCard>
  );
});

interface DiscoverPlayerListProps {
  filters: PlayerFilters;
  searchQuery: string;
  bottomPadding?: number;
}

const PAGE_SIZE = 50;
const MAX_DISCOVER_LIMIT = 1000;

export default function DiscoverPlayerList({
  filters,
  searchQuery,
  bottomPadding,
}: DiscoverPlayerListProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(true);

  // Tracks the last fetch params so silent refocus fetches are skipped
  // when nothing has actually changed.
  const lastFetchKey = useRef<string>("");

  const fetchPlayers = useCallback(async (silent = false, nextLimit = PAGE_SIZE) => {
    if (!user) {
      setPlayers([]);
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      setHasMore(false);
      return;
    }

    // silent=false → show loading spinner (filter/search changes)
    // silent=true  → no spinner but always hits the network (focus refetch)
    if (!silent) setLoading(true);

    try {
      const playerDocs = await convex.query(api.discover.listDiscoverPlayers, {
        viewerUserId: user._id as any,
        selectedGame: filters.game,
        searchQuery,
        selectedRole: filters.role,
        selectedSkill: filters.skill,
        selectedAvailability: filters.availability,
        selectedArea: filters.area,
        selectedPlatform: filters.platform,
        selectedCompetitiveIntent: filters.competitiveIntent,
        limit: nextLimit,
      });
      setPlayers(playerDocs as Player[]);
      setLimit(nextLimit);
      setHasMore(playerDocs.length >= nextLimit && nextLimit < MAX_DISCOVER_LIMIT);
      recordPayloadMetric("discover.players_payload", playerDocs, {
        game: filters.game,
        query: searchQuery,
      });
    } catch (error) {
      Logger.error("DiscoverPlayers", "Error fetching players", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [filters, searchQuery, user]);

  // Filter/search changes → fetch with spinner
  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // Back navigation → silent fetch, no spinner, always runs
  useFocusEffect(
    useCallback(() => {
      fetchPlayers(true);
    }, [fetchPlayers]),
  );
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPlayers(false, PAGE_SIZE);
  }, [fetchPlayers]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || refreshing || !hasMore) return;
    const nextLimit = Math.min(limit + PAGE_SIZE, MAX_DISCOVER_LIMIT);
    if (nextLimit <= limit) return;
    setLoadingMore(true);
    fetchPlayers(true, nextLimit);
  }, [fetchPlayers, hasMore, limit, loading, loadingMore, refreshing]);

  const handleAddFriend = useCallback(
    async (targetUid: string) => {
      if (actionLoading) return;
      setActionLoading(targetUid);

      try {
        const response = await sendFriendRequestToUser({ toUid: targetUid });
        if (response.ok) {
          setPlayers((previous) =>
            previous.map((player) =>
              player.uid === targetUid
                ? { ...player, hasPendingRequest: true }
                : player,
            ),
          );
        } else {
          showToast({
            type: "error",
            title: "Error",
            message: response.message || "Failed to send friend request.",
          });
        }
      } catch (error) {
        Logger.error("DiscoverPlayers", "Add friend error", error);
        showToast({
          type: "error",
          title: "Error",
          message: "An unexpected error occurred.",
        });
      } finally {
        setActionLoading(null);
      }
    },
    [actionLoading, showToast],
  );

  const onPressProfile = useCallback(
    (uid: string) => {
      router.push({
        pathname: "/(player)/profile/[uid]" as any,
        params: { uid },
      });
    },
    [router],
  );

  const contentContainerStyle = useMemo(
    () => [styles.listContent, { paddingBottom: bottomPadding ?? 24 }],
    [bottomPadding],
  );

  const renderPlayerItem = useCallback(
    ({ item }: { item: Player }) => {
      return (
        <PlayerRow
          player={item}
          selectedGame={filters.game}
          actionLoadingUid={actionLoading}
          onPressProfile={onPressProfile}
          onAddFriend={handleAddFriend}
        />
      );
    },
    [actionLoading, filters.game, handleAddFriend, onPressProfile],
  );

  const keyExtractor = useCallback((item: Player) => item.uid, []);

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
        label={`${players.length} player${players.length !== 1 ? "s" : ""} found`}
      />

      <FlatList
        data={players}
        renderItem={renderPlayerItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={7}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
          />
        }
        ListEmptyComponent={
          <DiscoverEmptyState
            icon="search-off"
            title="No Players Found"
            description="Try adjusting your search or filters to find more players."
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 16 }}>
              <ActivityIndicator size="small" color={COLORS.accent} />
            </View>
          ) : null
        }
      />
    </View>
  );
}
