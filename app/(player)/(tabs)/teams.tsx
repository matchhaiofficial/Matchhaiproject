import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import AppHeader from "../../../src/components/AppHeader";
import Screen from "../../../src/components/Screen";
import SegmentedTabs from "../../../src/components/SegmentedTabs";

import { useAuth } from "../../../src/context/AuthContext";
import { getPublicTeams, getUserTeams, requestToJoinTeam, Team } from "../../../src/services/convex/teamService";
import { COLORS, SPACING } from "../../../src/theme";
import Logger from "../../../src/utils/logger";
import styles from "./teams.styles";

// Game filter options (Sync with Matchrooms)
const GAMES = [
    { key: 'all', label: 'All' },
    { key: 'cs2', label: 'CS2' },
    { key: 'fc26', label: 'FC26' },
    { key: 'tekken8', label: 'Tekken 8' },
    { key: 'futsal', label: 'Futsal' },
    { key: 'indoor_cricket', label: 'Cricket' },
    { key: 'padel', label: 'Padel' },
    { key: 'pickleball', label: 'Pickleball' },
];

export default function Teams() {
    const router = useRouter();
    const { user } = useAuth();
    const [mode, setMode] = useState<'my' | 'discover'>('my');

    // My Teams State
    const [teams, setTeams] = useState<Team[]>([]);

    // Discover State
    const [publicTeams, setPublicTeams] = useState<Team[]>([]);
    const [lastVisible, setLastVisible] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [requestedTeamIds, setRequestedTeamIds] = useState<Set<string>>(new Set());
    const [captainedTeams, setCaptainedTeams] = useState<Team[]>([]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedGame, setSelectedGame] = useState<string>('all');

    // Convex real-time query for captained teams (replaces getCaptainedTeams from teamMatchService)
    const captainedTeamsData = useQuery(
        api.teams.listByCaptain,
        user?._id ? { captainUid: user._id as Id<"users"> } : "skip"
    );

    // Convex real-time query for pending join requests (replaces fetchSocialState Firebase query)
    const pendingJoinRequests = useQuery(
        api.notifications.listByFromUid,
        user?._id ? {
            fromUid: user._id as Id<"users">,
            type: "team_join_request",
            status: "pending",
        } : "skip"
    );

    // Derive captained teams from query
    useEffect(() => {
        if (captainedTeamsData) {
            setCaptainedTeams(captainedTeamsData.map((t: any) => ({ ...t, id: t._id })) as Team[]);
        }
    }, [captainedTeamsData]);

    // Derive requested team IDs from notifications query
    useEffect(() => {
        if (pendingJoinRequests) {
            const requested = new Set<string>();
            pendingJoinRequests.forEach((notif: any) => {
                if (notif.teamId) requested.add(notif.teamId);
            });
            setRequestedTeamIds(requested);
        }
    }, [pendingJoinRequests]);

    const fetchTeams = async () => {
        if (!user) return;
        try {
            const result = await getUserTeams(user._id);
            if (result.ok && result.data) {
                setTeams(result.data);
            }
        } catch (error) {
            Logger.error("Teams", "Error fetching teams", error);
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

            const result = await getPublicTeams({
                game: selectedGame,
                searchQuery: searchQuery,
                limitCount: isLoadMore ? publicTeams.length + 10 : 10
            });

            if (result.ok && result.data) {
                // Filter out teams where current user is already a member/captain
                const filteredData = result.data.filter(t => !t.memberUids?.includes(user._id));

                if (isLoadMore) {
                    setPublicTeams(prev => {
                        const existingIds = new Set(prev.map(t => t.id));
                        const newUniqueTeams = filteredData.filter(t => !existingIds.has(t.id));
                        return [...prev, ...newUniqueTeams];
                    });
                } else {
                    setPublicTeams(filteredData);
                }
                setHasMore(result.data.length >= 10);
            }
        } catch (error) {
            Logger.error("Teams", "Error fetching public teams", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        if (mode === 'my') {
            fetchTeams();
        } else {
            fetchPublicTeams();
        }
    }, [user, mode, selectedGame]); // Intentionally not including searchQuery here to prevent instant fetch spam
    // Note: captainedTeams and social state (requestedTeamIds) are now driven by Convex real-time queries above

    const handleSearch = () => {
        if (mode === 'discover') {
            fetchPublicTeams();
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        if (mode === 'my') fetchTeams();
        else {
            fetchPublicTeams();
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
            Logger.error("Teams", "Join request error", e);
            Alert.alert("Error", "An unexpected error occurred.");
        }
    };

    const handleChallengeTeam = async (opponent: Team) => {
        if (!opponent.id || !user?._id) return;
        const captainedForGame = captainedTeams.filter(
            (team) => String(team.game || "").toLowerCase() === String(opponent.game || "").toLowerCase(),
        );
        if (captainedForGame.length === 0) {
            Alert.alert("Captain team required", `Create or captain a ${String(opponent.game || "").toUpperCase()} team first.`);
            return;
        }

        router.push({
            pathname: "/teams/challenge-create" as any,
            params: { opponentTeamId: opponent.id },
        } as any);
    };

    const handleOpenChallenges = () => {
        router.push("/teams/challenges" as any);
    };

    const filteredTeams = useMemo(() => {
        return teams.filter(team => {
            if (searchQuery) {
                const queryContent = searchQuery.toLowerCase();
                const matchesSearch =
                    team.name.toLowerCase().includes(queryContent) ||
                    (team.game || '').toLowerCase().includes(queryContent);
                if (!matchesSearch) return false;
            }

            if (selectedGame !== 'all') {
                if ((team.game || '').toLowerCase() !== selectedGame.toLowerCase()) return false;
            }

            return true;
        });
    }, [teams, searchQuery, selectedGame]);

    const renderTeamItem = ({ item }: { item: Team }) => {
        const isMyTeam = mode === 'my';
        const isRequested = requestedTeamIds.has(item.id!);
        const maxMembers = item.maxMembers || 0;
        const rawMemberCount = item.memberUids?.length ?? item.memberCount ?? 0;
        const memberCount = maxMembers > 0 ? Math.min(rawMemberCount, maxMembers) : rawMemberCount;
        const isFull = maxMembers > 0 ? rawMemberCount >= maxMembers : false;

        return (
            <Pressable
                style={({ pressed }) => [
                    styles.teamCard,
                    pressed && { opacity: 0.9 }
                ]}
                onPress={() => router.push(`/teams/${item.id}`)}
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
                            onPress={() => router.push(`/teams/${item.id}`)}
                        >
                            <Text style={styles.viewBtnText}>View</Text>
                        </TouchableOpacity>
                    ) : (
                        captainedTeams.some((team) => String(team.game || "").toLowerCase() === String(item.game || "").toLowerCase()) ? (
                            <TouchableOpacity
                                style={styles.challengeBtn}
                                onPress={() => handleChallengeTeam(item)}
                            >
                                <Text style={styles.challengeBtnText}>Challenge</Text>
                            </TouchableOpacity>
                        ) : isRequested ? (
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
                                onPress={() => handleRequestToJoin(item.id!)}
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

    if (loading) {
        return (
            <Screen style={styles.screen} scroll={false} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            </Screen>
        );
    }

    return (
        <Screen style={styles.screen} scroll={false} edges={['top']}>
            <AppHeader title={mode === 'my' ? 'My Teams' : 'Discover Teams'} />

            {/* Header Area */}
            <View style={styles.header}>

                {/* Mode Toggle */}
                <SegmentedTabs
                    items={[
                        { key: 'my', label: 'My Teams' },
                        { key: 'discover', label: 'Discover' },
                    ]}
                    value={mode}
                    onChange={setMode}
                    style={styles.segmentTabs}
                    compact
                />

                {captainedTeams.length > 0 && (
                    <TouchableOpacity
                        onPress={handleOpenChallenges}
                        style={styles.challengeHubButton}
                        activeOpacity={0.85}
                    >
                        <MaterialIcons name="sports-esports" size={16} color={COLORS.successBright} />
                        <Text style={styles.challengeHubButtonText}>My Challenges</Text>
                    </TouchableOpacity>
                )}

                {/* Search Bar */}
                <View style={styles.searchBar}>
                    <MaterialIcons name="search" size={20} color={COLORS.muted} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={mode === 'my' ? "Search my teams..." : "Search public teams..."}
                        placeholderTextColor={COLORS.muted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => { setSearchQuery(""); if (mode === 'discover') fetchPublicTeams(); }}>
                            <MaterialIcons name="close" size={20} color={COLORS.muted} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Game Filters - Horizontal Scroll */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginTop: SPACING.sm }}
                    contentContainerStyle={{ paddingRight: SPACING.md }}
                >
                    {GAMES.map(game => (
                        <TouchableOpacity
                            key={game.key}
                            onPress={() => setSelectedGame(game.key)}
                            style={[styles.optionChip, selectedGame === game.key && styles.optionChipActive]}
                        >
                            <Text style={[styles.optionChipText, selectedGame === game.key && styles.optionChipTextActive]}>
                                {game.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Results Count Section */}
            <View style={styles.resultsCount}>
                <Text style={styles.resultsCountText}>
                    {mode === 'my'
                        ? `${filteredTeams.length} team${filteredTeams.length !== 1 ? 's' : ''} found`
                        : `${publicTeams.length} public team${publicTeams.length !== 1 ? 's' : ''} found`
                    }
                </Text>
            </View>

            <FlatList
                data={mode === 'my' ? filteredTeams : publicTeams}
                renderItem={renderTeamItem}
                keyExtractor={(item) => item.id!}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
                }
                onEndReached={() => mode === 'discover' && hasMore && !loadingMore && fetchPublicTeams(true)}
                onEndReachedThreshold={0.5}
                ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={COLORS.accent} style={{ padding: 20 }} /> : null}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <MaterialIcons name={mode === 'my' ? "group-off" : "search-off"} size={64} color={COLORS.muted} style={styles.emptyIcon} />
                        <Text style={styles.emptyTitle}>{mode === 'my' ? "No Teams Yet" : "No Teams Found"}</Text>
                        <Text style={styles.emptyText}>
                            {mode === 'my'
                                ? (searchQuery || selectedGame !== "all"
                                    ? "No teams match your search criteria."
                                    : "You haven't joined or created any teams. Create a team to start competing!")
                                : "No public teams found for these filters."
                            }
                        </Text>
                    </View>
                }
            />

            {/* Create Team FAB */}
            <View
                style={{
                    position: 'absolute',
                    bottom: 140,
                    right: 24,
                    zIndex: 1000,
                    elevation: 10,
                }}
                pointerEvents="box-none"
            >
                <TouchableOpacity
                    onPress={() => router.push('/teams/create' as any)}
                    activeOpacity={0.8}
                    style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor: COLORS.accent,
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 8,
                    }}
                >
                    <MaterialIcons name="add" size={28} color="#FFF" />
                </TouchableOpacity>
            </View>
        </Screen>
    );
}
