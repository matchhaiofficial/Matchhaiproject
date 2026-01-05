import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../../../src/config/firebaseConfig";
import { useAuth } from "../../../src/context/AuthContext";
import { COLORS } from "../../../src/theme";
import Logger from "../../../src/utils/logger";
import styles from "./find-players.styles";

interface Player {
    uid: string;
    username: string;
    primaryGames: string[];
    skillLevel: string;
    isOnline: boolean;
    roles?: Record<string, string>;
    faceitElo?: number;
    skillScores?: Record<string, { rating: number; tier: string }>;
    fcTeam?: string; // FC26 favorite team
    tekkenFavorites?: string[]; // Tekken 8 favorite characters
}

const GAMES = [
    { key: 'padel', label: 'Padel' },
    { key: 'pickleball', label: 'Pickleball' },
    { key: 'futsal', label: 'Futsal' },
    { key: 'indoor_cricket', label: 'Cricket' },
    { key: 'tekken8', label: 'Tekken 8' },
    { key: 'cs2', label: 'CS2' },
    { key: 'fc26', label: 'FC26' },
];

// Helper function to abbreviate long role/position names
const abbreviateRole = (role: string): string => {
    const abbreviations: Record<string, string> = {
        'Goalkeeper': 'GK',
        'Defender': 'DEF',
        'Midfielder': 'MID',
        'Forward': 'FWD',
        'Striker': 'ST',
        'All-rounder': 'AR',
        'Wicket Keeper': 'WK',
        'Entry Fragger': 'Entry',
        'Aggressive / Front': 'Front',
        'Defensive / Back': 'Back',
    };
    return abbreviations[role] || role;
};

// Faceit Level Icons
const faceitLevelIcons: Record<number, any> = {
    1: require("../../../assets/images/faceit-levels/Level 1.png"),
    2: require("../../../assets/images/faceit-levels/Level 2.png"),
    3: require("../../../assets/images/faceit-levels/Level 3.png"),
    4: require("../../../assets/images/faceit-levels/Level 4.png"),
    5: require("../../../assets/images/faceit-levels/Level 5.png"),
    6: require("../../../assets/images/faceit-levels/Level 6.png"),
    7: require("../../../assets/images/faceit-levels/Level 7.png"),
    8: require("../../../assets/images/faceit-levels/Level 8.png"),
    9: require("../../../assets/images/faceit-levels/Level 9.png"),
    10: require("../../../assets/images/faceit-levels/Level 10.png"),
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

export default function FindPlayers() {
    const router = useRouter(); // Used to verify router exists, though not navigating yet
    const { user } = useAuth();
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedGame, setSelectedGame] = useState<string | null>(null);

    // Social State
    const [friendUids, setFriendUids] = useState<Set<string>>(new Set());
    const [pendingUids, setPendingUids] = useState<Set<string>>(new Set()); // Outgoing requests
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchSocialState = async () => {
        if (!user) return;
        try {
            // 1. Fetch Friends
            const friendsSnap = await getDocs(collection(db, "users", user.uid, "friends"));
            const friends = new Set<string>();
            friendsSnap.forEach(doc => friends.add(doc.id));
            setFriendUids(friends);

            // 2. Fetch Pending Outgoing Requests
            // This requires an index usually: notifications where fromUid == me && type == friend_request && status == pending
            const q = query(
                collection(db, "notifications"),
                where("fromUid", "==", user.uid),
                where("type", "==", "friend_request"),
                where("status", "==", "pending")
            );
            const pendingSnap = await getDocs(q);
            const pending = new Set<string>();
            pendingSnap.forEach(doc => pending.add(doc.data().toUid));
            setPendingUids(pending);

        } catch (e) {
            console.error("Error fetching social state", e);
        }
    };

    const fetchPlayers = async () => {
        if (!user) return;
        try {
            let q = query(collection(db, "users"), where("accountType", "==", "player"));

            const snapshot = await getDocs(q);
            const loadedPlayers: Player[] = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                // Exclude self
                if (doc.id === user?.uid) return;

                // Construct roles object from flattened fields
                const roles: Record<string, string> = {};
                if (data.cs2Role) roles.cs2Role = data.cs2Role;
                if (data.fc26Role) roles.fc26Role = data.fc26Role;
                if (data.padelRole) roles.padelRole = data.padelRole;
                if (data.pickleballRole) roles.pickleballRole = data.pickleballRole;
                if (data.futsalPosition) roles.futsalRole = data.futsalPosition; // Futsal uses 'position'
                if (data.indoorCricketRole) roles.indoor_cricketRole = data.indoorCricketRole;
                // Add other roles as needed

                loadedPlayers.push({
                    uid: doc.id,
                    username: data.username || "Unknown",
                    primaryGames: data.primaryGames || [],
                    skillLevel: data.skillLevel || "Beginner",
                    isOnline: data.isOnline || false,
                    roles: roles,
                    faceitElo: data.faceitElo,
                    skillScores: data.skillScores || {},
                    fcTeam: data.fcTeam,
                    tekkenFavorites: data.tekkenFavorites || []
                });
            });

            setPlayers(loadedPlayers);
        } catch (error) {
            Logger.error("FindPlayers", "Error fetching players", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchPlayers();
        fetchSocialState();
    }, [user]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchPlayers();
        fetchSocialState();
    };

    const handleAddFriend = async (targetUid: string) => {
        if (actionLoading) return;
        setActionLoading(targetUid);
        try {
            const { sendFriendRequest } = require("../../../src/services/functions");
            const res = await sendFriendRequest({ toUid: targetUid });
            if (res.ok) {
                // Optimistic update
                const newPending = new Set(pendingUids);
                newPending.add(targetUid);
                setPendingUids(newPending);
            } else {
                alert(res.message);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setActionLoading(null);
        }
    };

    const filteredPlayers = players.filter(player => {
        const matchesSearch = player.username.toLowerCase().includes(searchQuery.toLowerCase());

        // Normalize game keys for comparison (handle both snake_case and camelCase)
        const normalizeKey = (key: string) => key.toLowerCase().replace(/_/g, '');
        const matchesGame = selectedGame
            ? player.primaryGames.some(game => normalizeKey(game) === normalizeKey(selectedGame))
            : true;

        return matchesSearch && matchesGame;
    });

    const renderPlayerItem = ({ item }: { item: Player }) => {
        const isFriend = friendUids.has(item.uid);
        const isPending = pendingUids.has(item.uid);
        const isLoading = actionLoading === item.uid;

        // Condition 1: Default View (All) - Show Name + Games
        if (!selectedGame) {
            return (
                <TouchableOpacity
                    key={item.uid}
                    activeOpacity={0.7}
                    onPress={() => router.push({
                        pathname: '/(player)/profile/[uid]',
                        params: { uid: item.uid }
                    })}
                >
                    <View style={styles.playerCard}>
                        <View style={styles.playerAvatar}>
                            <Text style={styles.playerAvatarText}>
                                {item.username.charAt(0).toUpperCase()}
                            </Text>
                            {item.isOnline && <View style={styles.onlineIndicator} />}
                        </View>
                        <View style={styles.playerInfo}>
                            <Text style={styles.playerName}>{item.username}</Text>
                            <View style={styles.gameTags}>
                                {item.primaryGames.slice(0, 2).map((game, index) => {
                                    // Normalize keys to match (indoor_cricket -> indoorcricket)
                                    const normalizeKey = (key: string) => key.toLowerCase().replace(/_/g, '');
                                    const gameObj = GAMES.find(g => normalizeKey(g.key) === normalizeKey(game));
                                    const gameLabel = gameObj?.label || game;
                                    return (
                                        <View key={index} style={styles.gameTag}>
                                            <Text style={styles.gameTagText}>
                                                {gameLabel.toUpperCase()}
                                            </Text>
                                        </View>
                                    );
                                })}
                                {item.primaryGames.length > 2 && (
                                    <View style={[styles.gameTag, { backgroundColor: COLORS.surface, paddingHorizontal: 8 }]}>
                                        <Text style={[styles.gameTagText, { color: COLORS.textSecondary }]}>
                                            +{item.primaryGames.length - 2}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* Action Button */}
                        {isFriend ? (
                            <View style={{
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 20,
                                backgroundColor: COLORS.success + '15',
                                borderWidth: 1,
                                borderColor: COLORS.success + '40',
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4
                            }}>
                                <MaterialIcons name="check-circle" size={14} color={COLORS.success} />
                                <Text style={{ color: COLORS.success, fontSize: 12, fontWeight: '600' }}>Friends</Text>
                            </View>
                        ) : isPending ? (
                            <View style={{
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 20,
                                backgroundColor: COLORS.warning + '15',
                                borderWidth: 1,
                                borderColor: COLORS.warning + '40',
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4
                            }}>
                                <MaterialIcons name="schedule" size={14} color={COLORS.warning} />
                                <Text style={{ color: COLORS.warning, fontSize: 12, fontWeight: '600' }}>Pending</Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={() => handleAddFriend(item.uid)}
                                disabled={isLoading}
                                style={{
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 20,
                                    backgroundColor: isLoading ? COLORS.accent + '20' : COLORS.accent,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4,
                                    opacity: isLoading ? 0.7 : 1
                                }}
                            >
                                {isLoading ? (
                                    <>
                                        <MaterialIcons name="person-add" size={14} color="#FFF" />
                                        <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>Adding...</Text>
                                    </>
                                ) : (
                                    <>
                                        <MaterialIcons name="person-add" size={14} color="#FFF" />
                                        <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>Add</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                </TouchableOpacity>
            );
        }

        // Condition 2: Filtered View - Show game-specific info + MatchHai skill rating
        const skillData = item.skillScores?.[selectedGame];

        // Determine what to display based on game type
        let gameSpecificInfo = null;

        if (selectedGame === 'fc26' || selectedGame === 'fc25') {
            // FC26: Show favorite team
            gameSpecificInfo = item.fcTeam;
        } else if (selectedGame === 'tekken8') {
            // Tekken 8: Show first favorite character
            gameSpecificInfo = item.tekkenFavorites?.[0];
        } else {
            // CS2, Sports: Show role
            gameSpecificInfo = item.roles?.[`${selectedGame}Role`];
        }

        return (
            <TouchableOpacity
                key={item.uid}
                activeOpacity={0.7}
                onPress={() => router.push({
                    pathname: '/(player)/profile/[uid]',
                    params: { uid: item.uid }
                })}
            >
                <View style={styles.playerCard}>
                    <View style={styles.playerAvatar}>
                        <Text style={styles.playerAvatarText}>
                            {item.username.charAt(0).toUpperCase()}
                        </Text>
                        {item.isOnline && <View style={styles.onlineIndicator} />}
                    </View>
                    <View style={styles.playerInfo}>
                        <Text style={styles.playerName}>{item.username}</Text>

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
                            {/* Game Tag */}
                            <View style={styles.gameTag}>
                                <Text style={styles.gameTagText}>
                                    {GAMES.find(g => g.key === selectedGame)?.label.toUpperCase() || selectedGame.toUpperCase()}
                                </Text>
                            </View>

                            {/* Game-Specific Info (Role/Team/Character) */}
                            {gameSpecificInfo && (
                                <View style={[styles.gameTag, { backgroundColor: COLORS.surface }]}>
                                    <Text style={[styles.gameTagText, { color: COLORS.text }]}>
                                        {abbreviateRole(gameSpecificInfo)}
                                    </Text>
                                </View>
                            )}

                            {/* MatchHai Skill Tier Badge */}
                            {skillData && (
                                <View style={[styles.gameTag, { backgroundColor: '#e0f2fe' }]}>
                                    <Text style={[styles.gameTagText, { color: '#0369a1', fontWeight: 'bold' }]}>
                                        {skillData.tier} ({skillData.rating})
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                    {/* Action Button */}
                    {isFriend ? (
                        <View style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 20,
                            backgroundColor: COLORS.success + '15',
                            borderWidth: 1,
                            borderColor: COLORS.success + '40',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4
                        }}>
                            <MaterialIcons name="check-circle" size={14} color={COLORS.success} />
                            <Text style={{ color: COLORS.success, fontSize: 12, fontWeight: '600' }}>Friends</Text>
                        </View>
                    ) : isPending ? (
                        <View style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 20,
                            backgroundColor: COLORS.warning + '15',
                            borderWidth: 1,
                            borderColor: COLORS.warning + '40',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4
                        }}>
                            <MaterialIcons name="schedule" size={14} color={COLORS.warning} />
                            <Text style={{ color: COLORS.warning, fontSize: 12, fontWeight: '600' }}>Pending</Text>
                        </View>
                    ) : (
                        <TouchableOpacity
                            onPress={() => handleAddFriend(item.uid)}
                            disabled={isLoading}
                            style={{
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 20,
                                backgroundColor: isLoading ? COLORS.accent + '20' : COLORS.accent,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                opacity: isLoading ? 0.7 : 1
                            }}
                        >
                            {isLoading ? (
                                <>
                                    <MaterialIcons name="person-add" size={14} color="#FFF" />
                                    <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>Adding...</Text>
                                </>
                            ) : (
                                <>
                                    <MaterialIcons name="person-add" size={14} color="#FFF" />
                                    <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>Add</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity>
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
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.headerTitle}>Find Players</Text>
                    <TouchableOpacity onPress={() => router.push("/(player)/inbox")}>
                        <MaterialIcons name="notifications" size={24} color={COLORS.text} style={{ marginRight: 8 }} />
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={styles.searchBox}>
                    <MaterialIcons name="search" size={20} color={COLORS.muted} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by username..."
                        placeholderTextColor={COLORS.muted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery("")}>
                            <MaterialIcons name="close" size={20} color={COLORS.muted} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Game Filters */}
                <View style={styles.filterContainer}>
                    <TouchableOpacity
                        onPress={() => setSelectedGame(null)}
                        style={[
                            styles.optionChip,
                            !selectedGame && styles.optionChipActive
                        ]}
                    >
                        <Text style={[
                            styles.optionChipText,
                            !selectedGame && styles.optionChipTextActive
                        ]}>All</Text>
                    </TouchableOpacity>
                    {GAMES.map(game => (
                        <TouchableOpacity
                            key={game.key}
                            onPress={() => setSelectedGame(selectedGame === game.key ? null : game.key)}
                            style={[
                                styles.optionChip,
                                selectedGame === game.key && styles.optionChipActive
                            ]}
                        >
                            <Text style={[
                                styles.optionChipText,
                                selectedGame === game.key && styles.optionChipTextActive
                            ]}>
                                {game.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <FlatList
                data={filteredPlayers}
                renderItem={renderPlayerItem}
                keyExtractor={item => item.uid}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <MaterialIcons name="search-off" size={48} color={COLORS.muted} style={styles.emptyIcon} />
                        <Text style={styles.emptyTitle}>No Players Found</Text>
                        <Text style={styles.emptyText}>
                            Try adjusting your search or filters to find more players.
                        </Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}
