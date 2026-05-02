import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";

import { api } from "../../../../convex/_generated/api";
import { AppIcon } from "../../../../src/components/AppIcon";
import SegmentedTabs from "../../../../src/components/SegmentedTabs";
import { useAuth } from "../../../../src/context/AuthContext";
import { useToast } from "../../../../src/hooks/useToast";
import { convex } from "../../../../src/lib/convex";
import {
  requestToJoinTeam,
  Team,
} from "../../../../src/services/convex/teamService";
import { COLORS } from "../../../../src/theme";
import {
  hasVerifiedEmail,
  showEmailVerificationRequiredAlert,
} from "../../../../src/utils/emailVerificationGate";
import Logger from "../../../../src/utils/logger";
import { recordPayloadMetric } from "../../../../src/utils/perfInstrumentation";
import { getTeamMainDisplayRoster } from "../../../../src/utils/teamRosterDisplay";
import type { TeamFilters } from "../filterConfig";
import {
  DiscoverActionChip,
  DiscoverEmptyState,
  DiscoverPressableCard,
  DiscoverResultsCount,
  DiscoverTag,
  discoverSharedStyles,
} from "./DiscoverShared";
import styles from "../styles/teams.styles";

const isActiveTeam = (team: Team) =>
  team.status !== "deleted" && !team.deletedAt;

const TeamRow = React.memo(function TeamRow({
  team,
  mode,
  actionLoadingTeamId,
  onPressTeam,
  onRequestToJoin,
}: {
  team: Team;
  mode: "my" | "discover";
  actionLoadingTeamId: string | null;
  onPressTeam: (teamId: string) => void;
  onRequestToJoin: (teamId: string) => void;
}) {
  const isMyTeam = mode === "my";
  const isRequested = Boolean((team as any).isRequested);
  const isLoading = actionLoadingTeamId === team.id;
  const rawMemberCount = team.memberUids?.length ?? team.memberCount ?? 0;
  const totalMaxMembers = team.maxMembers || 0;
  const { currentMembers, maxMembers } = getTeamMainDisplayRoster(team);
  const isFull = totalMaxMembers > 0 ? rawMemberCount >= totalMaxMembers : false;

  const handlePress = useCallback(() => {
    onPressTeam(team.id || "");
  }, [onPressTeam, team.id]);

  const handleRequestJoin = useCallback(() => {
    onRequestToJoin(team.id || "");
  }, [onRequestToJoin, team.id]);

  return (
    <DiscoverPressableCard style={styles.teamCard} onPress={handlePress}>
      <View style={styles.teamTopRow}>
        <Text style={styles.teamGame}>{(team.game || "???").toUpperCase()}</Text>
        <DiscoverTag label={`${currentMembers} / ${maxMembers}`} tone="neutral" />
      </View>

      <View style={styles.teamTitleRow}>
        <Text style={styles.teamName} numberOfLines={1}>
          {team.name}
        </Text>
        {isMyTeam ? (
          <DiscoverActionChip label="View" tone="accent" onPress={handlePress} />
        ) : isRequested ? (
          <DiscoverActionChip label="Requested" tone="warning" />
        ) : isFull ? (
          <DiscoverActionChip label="Full" tone="danger" />
        ) : (
          <DiscoverActionChip
            label={isLoading ? "Requesting..." : "Request to Join"}
            tone="accent"
            onPress={handleRequestJoin}
            disabled={isLoading}
          />
        )}
      </View>

      <View style={styles.teamBottomRow}>
        <View style={styles.captainRow}>
          <AppIcon name="person" size={12} tone="muted" />
          <Text style={styles.captainText}>
            Cap: {team.captainUsername || "Unknown"}
          </Text>
        </View>

        {isMyTeam ? (
          <DiscoverTag
            label={`${(team.stats?.wins || 0) + (team.stats?.losses || 0)} Matches`}
            tone="neutral"
          />
        ) : null}
      </View>
    </DiscoverPressableCard>
  );
});

interface DiscoverTeamListProps {
  filters: TeamFilters;
  searchQuery: string;
  onModeChange: (mode: TeamFilters["mode"]) => void;
  bottomPadding?: number;
}

export default function DiscoverTeamList({
  filters,
  searchQuery,
  onModeChange,
  bottomPadding,
}: DiscoverTeamListProps) {
  const router = useRouter();
  const { user, authUser } = useAuth();
  const { showToast } = useToast();
  const [publicTeams, setPublicTeams] = useState<Team[]>([]);
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchTeams = useCallback(async () => {
    if (!user) {
      setPublicTeams([]);
      setMyTeams([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      const rows = await convex.query(api.discover.listDiscoverTeams, {
        viewerUserId: user._id as any,
        mode: filters.mode,
        selectedGame: filters.game,
        searchQuery,
        selectedTeamFilter: filters.availability,
        selectedTeamSize: filters.teamSize,
        selectedArea: filters.area,
        selectedCompetitiveIntent: filters.competitiveIntent,
        limit: 200,
      });
      const activeRows = (rows as Team[]).filter(isActiveTeam);

      if (filters.mode === "my") {
        setMyTeams(activeRows);
      } else {
        setPublicTeams(activeRows);
      }

      recordPayloadMetric("discover.teams_payload", activeRows, {
        game: filters.game,
        mode: filters.mode,
        query: searchQuery,
      });
    } catch (error) {
      Logger.error("DiscoverTeams", "Error fetching teams", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, searchQuery, user]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTeams();
  }, [fetchTeams]);

  const handleRequestToJoin = useCallback(
    async (teamId: string) => {
      if (actionLoading || !teamId) return;
      if (!hasVerifiedEmail(authUser)) {
        showEmailVerificationRequiredAlert();
        return;
      }

      setActionLoading(teamId);
      try {
        const response = await requestToJoinTeam(teamId);
        if (response.ok) {
          showToast({
            type: "success",
            title: "Success",
            message: "Join request sent to captain.",
          });
          setPublicTeams((previous) =>
            previous.map((team) =>
              team.id === teamId ? ({ ...team, isRequested: true } as any) : team,
            ),
          );
        } else {
          showToast({
            type: "error",
            title: "Error",
            message: response.message || "Failed to send request.",
          });
        }
      } catch (error) {
        Logger.error("DiscoverTeams", "Join request error", error);
        showToast({
          type: "error",
          title: "Error",
          message: "An unexpected error occurred.",
        });
      } finally {
        setActionLoading(null);
      }
    },
    [actionLoading, authUser, showToast],
  );

  const contentContainerStyle = useMemo(
    () => [styles.listContent, { paddingBottom: bottomPadding ?? 24 }],
    [bottomPadding],
  );

  const onPressTeam = useCallback(
    (teamId: string) => {
      router.push(`/teams/${teamId}` as any);
    },
    [router],
  );

  const renderTeamItem = useCallback(
    ({ item }: { item: Team }) => {
      return (
        <TeamRow
          team={item}
          mode={filters.mode}
          actionLoadingTeamId={actionLoading}
          onPressTeam={onPressTeam}
          onRequestToJoin={handleRequestToJoin}
        />
      );
    },
    [actionLoading, filters.mode, handleRequestToJoin, onPressTeam],
  );

  const displayedTeams = filters.mode === "my" ? myTeams : publicTeams;
  const keyExtractor = useCallback(
    (item: Team, index: number) => {
      return item.id || `${filters.mode}-${item.name || "team"}-${index}`;
    },
    [filters.mode],
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
      <SegmentedTabs
        items={[
          { key: "discover", label: "Browse" },
          { key: "my", label: "My Teams" },
        ]}
        value={filters.mode}
        onChange={(value) => onModeChange(value as TeamFilters["mode"])}
        style={styles.segmentTabs}
        compact
      />

      <DiscoverResultsCount
        label={
          filters.mode === "my"
            ? `${displayedTeams.length} team${displayedTeams.length !== 1 ? "s" : ""} found`
            : `${displayedTeams.length} public team${displayedTeams.length !== 1 ? "s" : ""} found`
        }
      />

      <FlatList
        data={displayedTeams}
        renderItem={renderTeamItem}
        keyExtractor={keyExtractor}
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
            icon="search-off"
            iconSize={64}
            title="No Teams Found"
            description={
              filters.mode === "my"
                ? "You are not part of any teams yet."
                : "No public teams match your search or filters."
            }
          />
        }
      />
    </View>
  );
}
