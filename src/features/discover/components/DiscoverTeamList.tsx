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
    StyleSheet,
    ScrollView
} from "react-native";
import { db } from "../../../../src/config/firebaseConfig";
import { useAuth } from "../../../../src/context/AuthContext";
import { getPublicTeams, requestToJoinTeam, Team } from "../../../../src/services/teamService";
import { COLORS, SPACING, FONTS } from "../../../../src/theme";
import Logger from "../../../../src/utils/logger";
import { GameKey } from "../types";
import { normalizeGameKey } from "../utils/gameKeys";

// Reuse styles
import styles from "../../../../app/(player)/(tabs)/teams.styles";

interface DiscoverTeamListProps {
    selectedGame: GameKey;
    searchQuery: string;
}

export default function DiscoverTeamList({ selectedGame, searchQuery }: DiscoverTeamListProps) {
    const router = useRouter();
    const { user } = useAuth();

    // Data State
    const [publicTeams, setPublicTeams] = useState<Team[]>([]);
    const [lastVisible, setLastVisible] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // UI State
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filter State
    const [filtersExpanded, setFiltersExpanded] = useState(true);
    const [selectedTeamFilter, setSelectedTeamFilter] = useState('All'); // 'All' | 'Open Slots'

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

    const fetchPublicTeams = async (isLoadMore = false) => {
        if (!user) return;
        try {
            if (isLoadMore) setLoadingMore(true);
            else setLoading(true);

            // Pass 'all' if selectedGame is 'all', otherwise the specific game key
            // The service expects 'all' or specific game string
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

    // Refetch when filters change
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchPublicTeams(false);
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [user, selectedGame, searchQuery]);

    useEffect(() => {
        fetchSocialState();
    }, [user]);

    // Reset filters
    useEffect(() => {
        setSelectedTeamFilter('All');
        if (selectedGame !== 'all') {
            setFiltersExpanded(true);
        }
    }, [selectedGame]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchPublicTeams(); // Reset
        fetchSocialState();
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
        const isRequested = requestedTeamIds.has(item.id!);
        const isFull = (item.memberCount || 0) >= (item.maxMembers || 0);

        return (
            <Pressable
                style={({ pressed }) => [
                    styles.teamCard,
                    pressed && { opacity: 0.9 }
                ]}
                onPress={() => router.push(`/teams/${item.id}` as any)}
            >
                <View style={styles.teamTopRow}>
                    <Text style={styles.teamGame}>{(item.game || '???').toUpperCase()}</Text>
                    <View style={styles.memberCountRow}>
                        <MaterialIcons name="people" size={12} color={COLORS.muted} />
                        <Text style={styles.memberCountText}>
                            {item.memberCount || 0} / {item.maxMembers || 0}
                        </Text>
                    </View>
                </View>

                <View style={styles.teamTitleRow}>
                    <Text style={styles.teamName} numberOfLines={1}>{item.name}</Text>
                    {isRequested ? (
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
                    )}
                </View>

                <View style={styles.teamBottomRow}>
                    <View style={styles.captainRow}>
                        <MaterialIcons name="person" size={12} color={COLORS.muted} />
                        <Text style={styles.captainText}>
                            Cap: {item.captainUsername || "Unknown"}
                        </Text>
                    </View>
                    {/* Stats or other info */}
                </View>
            </Pressable>
        );
    };

    // Client-side filtering check
    const displayedTeams = publicTeams.filter(t => {
        if (selectedTeamFilter === 'Open Slots') {
            return (t.memberCount || 0) < (t.maxMembers || 0);
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

    const renderFilterRow = (label: string, options: string[], selected: string, onSelect: (val: string) => void) => (
        <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>{label}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterOptionsScroll}>
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

    return (
        <View style={{ flex: 1 }}>
            {/* Contextual Filters */}
            {selectedGame !== 'all' && (
                <View>
                    <TouchableOpacity
                        onPress={() => setFiltersExpanded(!filtersExpanded)}
                        activeOpacity={0.7}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingHorizontal: 16,
                            paddingBottom: 8,
                            paddingTop: 8,
                            backgroundColor: COLORS.background
                        }}
                    >
                        <Text style={{ fontFamily: FONTS.heading, fontSize: 14, color: COLORS.textSecondary }}>
                            Filters
                        </Text>
                        <MaterialIcons
                            name={filtersExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                            size={20}
                            color={COLORS.muted}
                        />
                    </TouchableOpacity>

                    {filtersExpanded && (
                        <View style={[styles.filtersPanel, { marginTop: 0 }]}>
                            {renderFilterRow(
                                'Availability',
                                ['All', 'Open Slots'],
                                selectedTeamFilter,
                                setSelectedTeamFilter
                            )}
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
                keyExtractor={(item) => item.id!}
                contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
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
