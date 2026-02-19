import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
    Text,
    TouchableOpacity,
    View,
    ScrollView
} from "react-native";
import { useConvex, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { useAuth } from "../../../../src/context/AuthContext";
import { COLORS } from "../../../../src/theme";
import Logger from "../../../../src/utils/logger";
import SegmentedTabs from "../../../../src/components/SegmentedTabs";
import { GameKey } from "../types";
import { normalizeGameKey } from "../utils/gameKeys";

// Reuse styles
import styles from "../styles/teams.styles";

interface DiscoverTeamListProps {
    selectedGame: GameKey;
    searchQuery: string;
    initialMode?: 'my' | 'discover'; // NEW: allow initial mode selection
    intentTime?: string; // NEW: force sync on re-navigation
    edgePadding?: number;
    bottomPadding?: number;
}

type TeamRow = Doc<"teams"> & { id: string };

export default function DiscoverTeamList({ selectedGame, searchQuery, initialMode = 'discover', intentTime, edgePadding, bottomPadding }: DiscoverTeamListProps) {
    const router = useRouter();
    const { user } = useAuth();
    const convex = useConvex();

    // NEW: Mode State
    const [mode, setMode] = useState<'my' | 'discover'>(initialMode);

    const gameFilter = selectedGame === 'all' ? 'all' : selectedGame;
    const searchTerm = searchQuery.trim();
    const publicTeamsQuery = useQuery(api.teams.listPublicTeams, {
        game: gameFilter,
        search: searchTerm || undefined,
        limit: 200,
    });
    const myTeamsQuery = useQuery(api.teams.listTeamsForUser, user && mode === 'my' ? {} : "skip");
    const outgoingRequestsQuery = useQuery(
        api.notifications.listOutgoingByType,
        user && mode === 'discover' ? { type: "team_join_request", status: "pending" } : "skip",
    );
    const requestToJoinTeam = useMutation(api.teams.requestToJoinTeam);

    const publicTeams = useMemo<TeamRow[]>(
        () =>
            (publicTeamsQuery ?? [])
                .map((team: any) => ({ ...team, id: String(team._id) }))
                .filter((team: any) => !user?.uid || !team.memberUids?.includes(user.uid)),
        [publicTeamsQuery, user?.uid],
    );
    const myTeams = useMemo<TeamRow[]>(
        () => (myTeamsQuery ?? []).map((team: any) => ({ ...team, id: String(team._id) })),
        [myTeamsQuery],
    );

    const loading = mode === 'my' ? myTeamsQuery === undefined : publicTeamsQuery === undefined;
    const [refreshing, setRefreshing] = useState(false);

    // Filter State
    const [filtersExpanded, setFiltersExpanded] = useState(true);
    const [selectedTeamFilter, setSelectedTeamFilter] = useState('All'); // 'All' | 'Open Slots'
    const [selectedTeamSize, setSelectedTeamSize] = useState('Any');
    const [selectedCompetitiveLevel, setSelectedCompetitiveLevel] = useState('Any');

    // Social State
    const [requestedTeamIds, setRequestedTeamIds] = useState<Set<string>>(new Set());

    // Sync mode with prop (needed because segments are persisted with display:none)
    useEffect(() => {
        if (initialMode) {
            Logger.info("DiscoverTeams", "Syncing mode from URL", { initialMode, intentTime });
            setMode(initialMode);
        }
    }, [initialMode, intentTime]);

    useEffect(() => {
        if (!outgoingRequestsQuery) return;
        const requested = new Set<string>();
        outgoingRequestsQuery.forEach((notif: any) => {
            const teamId = notif?.meta?.teamId;
            if (teamId) requested.add(String(teamId));
        });
        setRequestedTeamIds(requested);
    }, [outgoingRequestsQuery]);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await Promise.all([
                convex.query(api.teams.listPublicTeams, {
                    game: gameFilter,
                    search: searchTerm || undefined,
                    limit: 200,
                }),
                user && mode === 'my' ? convex.query(api.teams.listTeamsForUser, {}) : Promise.resolve(),
                user && mode === 'discover'
                    ? convex.query(api.notifications.listOutgoingByType, {
                        type: "team_join_request",
                        status: "pending",
                    })
                    : Promise.resolve(),
            ]);
        } catch (error) {
            Logger.error("DiscoverTeams", "Refresh failed", error);
        } finally {
            setRefreshing(false);
        }
    };

    const handleRequestToJoin = async (teamId: any) => {
        try {
            const res = await requestToJoinTeam({ teamId });
            if (res?.ok !== false) {
                Alert.alert("Success", "Join request sent to captain.");
                setRequestedTeamIds(prev => new Set(prev).add(String(teamId)));
            } else {
                Alert.alert("Error", res.message || "Failed to send request.");
            }
        } catch (e) {
            Logger.error("DiscoverTeams", "Join request error", e);
            Alert.alert("Error", "An unexpected error occurred.");
        }
    };

    const renderTeamItem = ({ item }: { item: TeamRow }) => {
        const isMyTeam = mode === 'my';
        const isRequested = requestedTeamIds.has(item.id || "");
        const rawMemberCount = item.memberUids?.length ?? item.memberCount ?? 0;
        const maxMembers = item.maxMembers || 0;
        const memberCount = maxMembers > 0 ? Math.min(rawMemberCount, maxMembers) : rawMemberCount;
        const isFull = maxMembers > 0 ? memberCount >= maxMembers : false;

        return (
            <Pressable
                style={({ pressed }) => [
                    styles.teamCard,
                    pressed && { opacity: 0.9 }
                ]}
                onPress={() => router.push(`/teams/${item.id || ""}` as any)}
            >
                <View style={styles.teamTopRow}>
                    <Text style={styles.teamGame}>{(item.game || '???').toUpperCase()}</Text>
                    <View style={styles.memberCountRow}>
                        <MaterialIcons name="people" size={12} color={COLORS.muted} />
                        <Text style={styles.memberCountText}>
                            {memberCount} / {maxMembers}
                        </Text>
                    </View>
                </View>

                <View style={styles.teamTitleRow}>
                    <Text style={styles.teamName} numberOfLines={1}>{item.name}</Text>
                    {isMyTeam ? (
                        <TouchableOpacity
                            style={styles.viewBtn}
                            onPress={() => router.push(`/teams/${item.id || ""}` as any)}
                        >
                            <Text style={styles.viewBtnText}>View</Text>
                        </TouchableOpacity>
                    ) : (
                        isRequested ? (
                            <View style={styles.requestedBtn}>
                                <Text style={styles.requestedBtnText}>Requested</Text>
                            </View>
                        ) : isFull ? (
                            <View style={styles.fullBtn}>
                                <Text style={styles.fullBtnText}>Full</Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={styles.requestBtn}
                                onPress={() => handleRequestToJoin(item._id)}
                            >
                                <Text style={styles.requestBtnText}>Request to Join</Text>
                            </TouchableOpacity>
                        )
                    )}
                </View>

                <View style={styles.teamBottomRow}>
                    <View style={styles.captainRow}>
                        <MaterialIcons name="person" size={12} color={COLORS.muted} />
                        <Text style={styles.captainText}>
                            Cap: {item.captainUsername || "Unknown"}
                        </Text>
                    </View>

                    {isMyTeam && (
                        <View style={styles.statsTag}>
                            <Text style={styles.statsText}>
                                {(item.stats?.wins || 0) + (item.stats?.losses || 0)} MATCHES
                            </Text>
                        </View>
                    )}
                </View>
            </Pressable>
        );
    };

    // Client-side filtering check
    const displayedTeams = (mode === 'my' ? myTeams : publicTeams).filter(t => {
        const applySearchFilter = mode === 'my' || searchTerm.length === 0;
        // Search query filter (for My Teams especially since it's fetched all at once)
        if (applySearchFilter && searchTerm) {
            const queryContent = searchTerm.toLowerCase();
            const matchesSearch =
                t.name.toLowerCase().includes(queryContent) ||
                (t.game || '').toLowerCase().includes(queryContent);
            if (!matchesSearch) return false;
        }

        // Game filter
        if (selectedGame !== 'all') {
            if ((t.game || '').toLowerCase() !== normalizeGameKey(selectedGame)?.toLowerCase()) return false;
        }

        if (mode === 'discover') {
            // Existing Open Slots filter
            if (selectedTeamFilter === 'Open Slots') {
                const memberCount = t.memberUids?.length ?? t.memberCount ?? 0;
                if (memberCount >= (t.maxMembers || 0)) return false;
            }

            // Team Size filter
            if (selectedTeamSize !== 'Any') {
                const memberCount = t.memberUids?.length ?? t.memberCount ?? 0;
                if (selectedTeamSize === '1-2 players') {
                    if (memberCount < 1 || memberCount > 2) return false;
                } else if (selectedTeamSize === '3-5 players') {
                    if (memberCount < 3 || memberCount > 5) return false;
                } else if (selectedTeamSize === 'Full Team') {
                    if (memberCount !== (t.maxMembers || 0)) return false;
                }
            }

            // Competitive Level filter (placeholder field)
            if (selectedCompetitiveLevel !== 'Any') {
                const teamLevel = (t as any).competitiveLevel || 'Casual';
                if (!teamLevel.toLowerCase().includes(selectedCompetitiveLevel.toLowerCase().replace('-focused', ''))) return false;
            }
        }

        return true;
    });

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    const filterBleedStyle = edgePadding ? { marginHorizontal: -edgePadding, paddingHorizontal: edgePadding } : null;
    const filterScrollStyle = edgePadding ? { marginHorizontal: -edgePadding } : null;
    const filterContentStyle = edgePadding ? { paddingHorizontal: edgePadding } : null;

    const renderFilterRow = (label: string, options: string[], selected: string, onSelect: (val: string) => void) => (
        <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>{label}</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterOptionsScroll}
                contentContainerStyle={styles.filterOptionsContent}
            >
                {options.map(opt => (
                    <TouchableOpacity
                        key={opt}
                        onPress={() => onSelect(opt)}
                        style={[styles.optionChip, selected === opt && styles.optionChipActive]}
                    >
                        <Text style={[styles.optionChipText, selected === opt && styles.optionChipTextActive]}>
                            {opt}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );

    // Filter options
    const TEAM_SIZE_OPTIONS = ['Any', '1-2 players', '3-5 players', 'Full Team'];
    const COMPETITIVE_LEVEL_OPTIONS = ['Any', 'Casual', 'Competitive', 'Tournament-focused'];

    return (
        <View style={{ flex: 1 }}>
            {/* NEW: Mode Toggle (Browse Teams vs My Teams) */}
            <SegmentedTabs
                items={[
                    { key: 'discover', label: 'Browse' },
                    { key: 'my', label: 'My Teams' },
                ]}
                value={mode}
                onChange={setMode}
                style={styles.segmentTabs}
                compact
            />

            {/* Contextual Filters - Only for Discover mode */}
            {mode === 'discover' && selectedGame !== 'all' && (
                <View>
                    <TouchableOpacity
                        onPress={() => setFiltersExpanded(!filtersExpanded)}
                        activeOpacity={0.7}
                        style={[styles.filterToggleRow, filterBleedStyle]}
                    >
                        <Text style={styles.filterToggleText}>Filters</Text>
                        <MaterialIcons
                            name={filtersExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                            size={20}
                            color={COLORS.muted}
                        />
                    </TouchableOpacity>

                    {filtersExpanded && (
                        <View style={{ maxHeight: 300 }}>
                            <ScrollView
                                showsVerticalScrollIndicator={true}
                                style={filterScrollStyle || undefined}
                                contentContainerStyle={[styles.filtersPanel, filterContentStyle || undefined]}
                            >
                                {renderFilterRow(
                                    'Availability',
                                    ['All', 'Open Slots'],
                                    selectedTeamFilter,
                                    setSelectedTeamFilter
                                )}
                                {renderFilterRow('Team Size', TEAM_SIZE_OPTIONS, selectedTeamSize, setSelectedTeamSize)}
                                {renderFilterRow('Competitive Level', COMPETITIVE_LEVEL_OPTIONS, selectedCompetitiveLevel, setSelectedCompetitiveLevel)}
                            </ScrollView>
                        </View>
                    )}
                </View>
            )}

            <View style={styles.resultsCount}>
                <Text style={styles.resultsCountText}>
                    {`${displayedTeams.length} public team${displayedTeams.length !== 1 ? 's' : ''} found`}
                </Text>
            </View>

            <FlatList
                data={displayedTeams}
                renderItem={renderTeamItem}
                keyExtractor={(item) => item.id || Math.random().toString()}
                contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding ?? 24 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <MaterialIcons name="search-off" size={64} color={COLORS.muted} style={styles.emptyIcon} />
                        <Text style={styles.emptyTitle}>No Teams Found</Text>
                        <Text style={styles.emptyText}>
                            No public teams match your criteria.
                        </Text>
                    </View>
                }
            />

        </View>
    );
}
