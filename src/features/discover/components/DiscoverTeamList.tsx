import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
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
import { db } from "../../../../src/config/firebaseConfig";
import { useAuth } from "../../../../src/context/AuthContext";
import { getPublicTeams, getUserTeams, requestToJoinTeam, Team } from "../../../../src/services/teamService";
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

export default function DiscoverTeamList({ selectedGame, searchQuery, initialMode = 'discover', intentTime, edgePadding, bottomPadding }: DiscoverTeamListProps) {
    const router = useRouter();
    const { user } = useAuth();

    // NEW: Mode State
    const [mode, setMode] = useState<'my' | 'discover'>(initialMode);

    // Data State
    const [publicTeams, setPublicTeams] = useState<Team[]>([]);
    const [myTeams, setMyTeams] = useState<Team[]>([]); // NEW: My Teams state
    const [lastVisible, setLastVisible] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // UI State
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filter State
    const [filtersExpanded, setFiltersExpanded] = useState(true);
    const [selectedTeamFilter, setSelectedTeamFilter] = useState('All'); // 'All' | 'Open Slots'
    const [selectedTeamSize, setSelectedTeamSize] = useState('Any');
    const [selectedCompetitiveLevel, setSelectedCompetitiveLevel] = useState('Any');

    // Social State
    const [requestedTeamIds, setRequestedTeamIds] = useState<Set<string>>(new Set());

    const fetchSocialState = async () => {
        if (!user) return;
        try {
            const q = query(
                collection(db, "notifications"),
                where("fromUid", "==", user.uid),
                where("type", "==", "team_join_request"),
                where("status", "==", "pending")
            );
            const snap = await getDocs(q);
            const requested = new Set<string>();
            snap.forEach(doc => {
                const data = doc.data();
                if (data.meta?.teamId) requested.add(data.meta.teamId);
            });
            setRequestedTeamIds(requested);
        } catch (e) {
            Logger.error("DiscoverTeams", "Error fetching social state", e);
        }
    };

    const fetchMyTeams = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const result = await getUserTeams(user.uid);
            if (result.ok && result.data) {
                setMyTeams(result.data);
            }
        } catch (error) {
            Logger.error("DiscoverTeams", "Error fetching my teams", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchPublicTeams = async (isLoadMore = false) => {
        if (!user) return;
        try {
            if (isLoadMore) setLoadingMore(true);
            else setLoading(true);

            // Pass 'all' if selectedGame is 'all', otherwise the specific game key
            const gameFilter = selectedGame === 'all' ? 'all' : selectedGame;

            const result = await getPublicTeams({
                game: gameFilter,
                searchQuery: searchQuery,
                lastDoc: isLoadMore ? lastVisible : null,
                limitCount: 10
            });

            if (result.ok && result.data) {
                // Filter out where user is already member/captain
                const filteredData = result.data.filter(t => !t.memberUids?.includes(user.uid));

                if (isLoadMore) {
                    setPublicTeams(prev => {
                        const existingIds = new Set(prev.map(t => t.id));
                        const newUniqueTeams = filteredData.filter(t => !existingIds.has(t.id));
                        return [...prev, ...newUniqueTeams];
                    });
                } else {
                    setPublicTeams(filteredData);
                }
                setLastVisible(result.lastVisible);
                setHasMore(result.data.length === 10);
            }
        } catch (error) {
            Logger.error("DiscoverTeams", "Error fetching public teams", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    };

    // Sync mode with prop (needed because segments are persisted with display:none)
    useEffect(() => {
        if (initialMode) {
            Logger.info("DiscoverTeams", "Syncing mode from URL", { initialMode, intentTime });
            setMode(initialMode);
        }
    }, [initialMode, intentTime]);

    // Refetch when mode, filters change
    useEffect(() => {
        if (mode === 'my') {
            fetchMyTeams();
        } else {
            fetchPublicTeams(false);
        }
    }, [user, mode, selectedGame, searchQuery]);

    useEffect(() => {
        if (mode === 'discover') {
            fetchSocialState();
        }
    }, [user, mode]);

    const onRefresh = () => {
        setRefreshing(true);
        if (mode === 'my') {
            fetchMyTeams();
        } else {
            fetchPublicTeams(); // Reset
            fetchSocialState();
        }
    };

    const handleRequestToJoin = async (teamId: string) => {
        try {
            const res = await requestToJoinTeam(teamId);
            if (res.ok) {
                Alert.alert("Success", "Join request sent to captain.");
                setRequestedTeamIds(prev => new Set(prev).add(teamId));
            } else {
                Alert.alert("Error", res.message || "Failed to send request.");
            }
        } catch (e) {
            Logger.error("DiscoverTeams", "Join request error", e);
            Alert.alert("Error", "An unexpected error occurred.");
        }
    };

    const renderTeamItem = ({ item }: { item: Team }) => {
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
                                onPress={() => handleRequestToJoin(item.id || "")}
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
        // Search query filter (for My Teams especially since it's fetched all at once)
        if (searchQuery) {
            const queryContent = searchQuery.toLowerCase();
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
                onEndReached={() => hasMore && !loadingMore && fetchPublicTeams(true)}
                onEndReachedThreshold={0.5}
                ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={COLORS.accent} style={{ padding: 20 }} /> : null}
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
