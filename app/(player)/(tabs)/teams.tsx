import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
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
import { SafeAreaView } from "react-native-safe-area-context";

import { db } from "../../../src/config/firebaseConfig";
import { useAuth } from "../../../src/context/AuthContext";
import { getPublicTeams, getUserTeams, requestToJoinTeam, Team } from "../../../src/services/teamService";
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
    { key: 'indoorCricket', label: 'Cricket' },
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

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedGame, setSelectedGame] = useState<string>('all');

    const repairTeams = async () => {
        if (!user) return;
        try {
            setRefreshing(true);
            const q = query(
                collection(db, 'teams'),
                where('captainUid', '==', user.uid)
            );
            const snap = await getDocs(q);
            const batchPromises = [];

            for (const teamDoc of snap.docs) {
                const data = teamDoc.data();
                if (!data.memberUids) {
                    batchPromises.push(updateDoc(doc(db, 'teams', teamDoc.id), {
                        memberUids: [user.uid]
                    }));
                }
            }

            if (batchPromises.length > 0) {
                await Promise.all(batchPromises);
                Alert.alert("Success", `Repaired ${batchPromises.length} teams.`);
                fetchTeams();
            } else {
                Alert.alert("Info", "All your teams are healthy.");
            }
        } catch (e) {
            Logger.error("Teams", "Repair error", e);
            Alert.alert("Error", "Failed to repair teams.");
        } finally {
            setRefreshing(false);
        }
    };

    const fetchTeams = async () => {
        if (!user) return;
        try {
            const result = await getUserTeams(user.uid);
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
                lastDoc: isLoadMore ? lastVisible : null,
                limitCount: 10
            });

            if (result.ok && result.data) {
                if (isLoadMore) {
                    setPublicTeams(prev => {
                        const existingIds = new Set(prev.map(t => t.id));
                        const newUniqueTeams = result.data!.filter(t => !existingIds.has(t.id));
                        return [...prev, ...newUniqueTeams];
                    });
                } else {
                    setPublicTeams(result.data);
                }
                setLastVisible(result.lastVisible);
                setHasMore(result.data.length === 10);
            }
        } catch (error) {
            Logger.error("Teams", "Error fetching public teams", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    };

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
            Logger.error("Teams", "Error fetching social state", e);
        }
    };

    useEffect(() => {
        if (mode === 'my') {
            fetchTeams();
        } else {
            fetchPublicTeams();
            fetchSocialState();
        }
    }, [user, mode, selectedGame]); // Intentionally not including searchQuery here to prevent instant fetch spam

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
            Logger.error("Teams", "Join request error", e);
            Alert.alert("Error", "An unexpected error occurred.");
        }
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
        const isFull = (item.memberCount || 0) >= (item.maxMembers || 0);

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
                            {item.memberCount || 0} / {item.maxMembers || 0}
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
            <SafeAreaView style={styles.screen}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.screen}>
            {/* Header Area */}
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md }}>
                    <Text style={styles.headerTitle}>{mode === 'my' ? 'My Teams' : 'Discover Teams'}</Text>
                    {mode === 'my' && (
                        <TouchableOpacity onPress={repairTeams} style={{ padding: 8 }}>
                            <MaterialIcons name="build" size={18} color={COLORS.muted} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Mode Toggle */}
                <View style={styles.segmentToggle}>
                    <TouchableOpacity
                        style={[styles.toggleButton, mode === 'my' && styles.toggleButtonActive]}
                        onPress={() => setMode('my')}
                    >
                        <Text style={[styles.toggleButtonText, mode === 'my' && styles.toggleButtonTextActive]}>My Teams</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleButton, mode === 'discover' && styles.toggleButtonActive]}
                        onPress={() => setMode('discover')}
                    >
                        <Text style={[styles.toggleButtonText, mode === 'discover' && styles.toggleButtonTextActive]}>Discover</Text>
                    </TouchableOpacity>
                </View>

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
        </SafeAreaView>
    );
}
