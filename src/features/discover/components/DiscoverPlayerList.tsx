import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { db } from "../../../../src/config/firebaseConfig";
import { useAuth } from "../../../../src/context/AuthContext";
import { COLORS } from "../../../../src/theme";
import Logger from "../../../../src/utils/logger";
import { GameKey } from "../types";
import { normalizeGameKey } from "../utils/gameKeys";

import {
    CS2_ROLES,
    FUTSAL_POSITIONS,
    INDOOR_CRICKET_ROLES,
    PADEL_ROLES,
    PICKLEBALL_ROLES
} from "../../../../constants/profileOptions";

import styles from "../styles/players.styles";

interface Player {
    // ... (keep interface same)
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
    // ... (keep games same)
    { key: 'padel', label: 'Padel' },
    { key: 'pickleball', label: 'Pickleball' },
    { key: 'futsal', label: 'Futsal' },
    { key: 'indoor_cricket', label: 'Cricket' },
    { key: 'tekken8', label: 'Tekken 8' },
    { key: 'cs2', label: 'CS2' },
    { key: 'fc26', label: 'FC26' },
];

// ... (helpers)
const abbreviateRole = (role: string): string => {
    // ... (keep same)
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

// ... (faceit icons same)
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

interface DiscoverPlayerListProps {
    selectedGame: GameKey;
    searchQuery: string;
    edgePadding?: number;
    bottomPadding?: number;
}

export default function DiscoverPlayerList({ selectedGame, searchQuery, edgePadding, bottomPadding }: DiscoverPlayerListProps) {
    const router = useRouter();
    const { user } = useAuth();
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filter State
    const [filtersExpanded, setFiltersExpanded] = useState(true);
    const [selectedRole, setSelectedRole] = useState('Any');
    const [selectedSkill, setSelectedSkill] = useState('Any');
    const [selectedAvailability, setSelectedAvailability] = useState('Any');

    // Social State
    const [friendUids, setFriendUids] = useState<Set<string>>(new Set());
    const [pendingUids, setPendingUids] = useState<Set<string>>(new Set()); // Outgoing requests
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchSocialState = async () => {
        if (!user) return;
        try {
            // 1. Fetch Friends
            const friendsSnap = await getDocs(collection(db, "users", user._id, "friends"));
            const friends = new Set<string>();
            friendsSnap.forEach(doc => friends.add(doc.id));
            setFriendUids(friends);

            // 2. Fetch Pending Outgoing Requests
            const q = query(
                collection(db, "notifications"),
                where("fromUid", "==", user._id),
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
                if (doc.id === user?._id) return;

                // Construct roles object from flattened fields
                const roles: Record<string, string> = {};
                if (data.cs2Role) roles.cs2Role = data.cs2Role;
                if (data.fc26Role) roles.fc26Role = data.fc26Role;
                if (data.padelRole) roles.padelRole = data.padelRole;
                if (data.pickleballRole) roles.pickleballRole = data.pickleballRole;
                const futsalPositions = Array.isArray(data.futsalPositions) ? data.futsalPositions.filter(Boolean) : [];
                const futsalRole = futsalPositions[0] || data.futsalPosition;
                if (futsalRole) roles.futsalRole = futsalRole; // Futsal uses 'position(s)'
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
            Logger.error("DiscoverPlayers", "Error fetching players", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchPlayers();
        fetchSocialState();
    }, [user]);

    // Reset filters
    useEffect(() => {
        setSelectedRole('Any');
        setSelectedSkill('Any');
        setSelectedAvailability('Any');
        if (selectedGame !== 'all') {
            setFiltersExpanded(true);
        }
    }, [selectedGame]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchPlayers();
        fetchSocialState();
    };

    const handleAddFriend = async (targetUid: string) => {
        if (actionLoading) return;
        setActionLoading(targetUid);
        try {
            // Dynamic import to avoid cycles or ensure freshness
            const { sendFriendRequest } = require("../../../../src/services/functions");
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

        // Game Match
        const matchesGame = selectedGame !== 'all'
            ? player.primaryGames.some(game => normalizeGameKey(game) === selectedGame)
            : true;

        if (!matchesSearch || !matchesGame) return false;

        // Contextual Filters
        if (selectedGame !== 'all') {
            // Role Filter
            if (selectedRole !== 'Any') {
                const roleKey = `${selectedGame}Role`; // e.g. cs2Role
                // Special case for futsal which uses 'futsalPosition' in data but mapped to 'futsalRole' in fetch
                const playerRole = player.roles?.[roleKey];
                if (!playerRole || playerRole !== selectedRole) return false;
            }

            // Skill Filter (CS2 only for now)
            if (selectedGame === 'cs2' && selectedSkill !== 'Any') {
                const elo = player.faceitElo || 0;
                const level = getFaceitLevel(elo);
                const skillStr = selectedSkill.replace('FACEIT ', ''); // "1-3" layout?
                // Actually let's assume CS2_SKILL_LEVELS format: 'FACEIT 1-3', 'FACEIT 4-6', 'FACEIT 7-10'
                if (skillStr === '1-3' && (level < 1 || level > 3)) return false;
                if (skillStr === '4-6' && (level < 4 || level > 6)) return false;
                if (skillStr === '7-10' && (level < 7 || level > 10)) return false;
            }
        }

        // Availability filter
        if (selectedAvailability !== 'Any') {
            if (selectedAvailability === 'Online Now') {
                if (!player.isOnline) return false;
            } else if (selectedAvailability === 'Available Today') {
                // Best-effort: use isOnline until lastActiveAt is added
                if (!player.isOnline) return false;
            }
        }

        return true;
    });

    const renderPlayerItem = ({ item }: { item: Player }) => {
        const isFriend = friendUids.has(item.uid);
        const isPending = pendingUids.has(item.uid);
        const isLoading = actionLoading === item.uid;

        const handlePress = () => {
            router.push({
                pathname: '/(player)/profile/[uid]' as any,
                params: { uid: item.uid }
            });
        };

        // Condition 1: Default View (All) - Show Name + Games
        if (selectedGame === 'all') {
            return (
                <TouchableOpacity key={item.uid} activeOpacity={0.8} onPress={handlePress}>
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
                                    <View style={[styles.gameTag, { backgroundColor: 'transparent' }]}>
                                        <Text style={[styles.gameTagText, { color: COLORS.textSecondary }]}>
                                            +{item.primaryGames.length - 2}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* Action Buttons */}
                        {isFriend ? (
                            <View style={[styles.actionBtn, styles.friendBtn]}>
                                <MaterialIcons name="check-circle" size={14} color={COLORS.success} />
                                <Text style={[styles.actionBtnText, styles.friendBtnText]}>Friends</Text>
                            </View>
                        ) : isPending ? (
                            <View style={[styles.actionBtn, styles.pendingBtn]}>
                                <MaterialIcons name="schedule" size={14} color={COLORS.warning} />
                                <Text style={[styles.actionBtnText, styles.pendingBtnText]}>Pending</Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={() => handleAddFriend(item.uid)}
                                disabled={isLoading}
                                style={[styles.actionBtn, isLoading && { opacity: 0.7 }]}
                            >
                                <MaterialIcons name="person-add" size={14} color={COLORS.accent} />
                                <Text style={styles.actionBtnText}>{isLoading ? 'Adding...' : 'Add'}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </TouchableOpacity>
            );
        }

        // Condition 2: Filtered View - Show game-specific info
        let gameSpecificInfo = null;

        if (selectedGame === 'fc26') {
            gameSpecificInfo = item.fcTeam;
        } else if (selectedGame === 'tekken8') {
            gameSpecificInfo = item.tekkenFavorites?.[0];
        } else {
            // For roles, we rely on the normalized key prop, but data might be stored slightly differently
            // Our normalizeGameKey return matches 'all'|'cs2'|'fc26'|'tekken8'|'futsal'|'indoor_cricket'|'padel'|'pickleball'
            // The role keys in `item` construction above:
            // cs2Role, fc26Role, padelRole, pickleballRole, futsalRole, indoor_cricketRole
            gameSpecificInfo = item.roles?.[`${selectedGame}Role`];
        }

        return (
            <TouchableOpacity key={item.uid} activeOpacity={0.8} onPress={handlePress}>
                <View style={styles.playerCard}>
                    <View style={styles.playerAvatar}>
                        <Text style={styles.playerAvatarText}>
                            {item.username.charAt(0).toUpperCase()}
                        </Text>
                        {item.isOnline && <View style={styles.onlineIndicator} />}
                    </View>
                    <View style={styles.playerInfo}>
                        <Text style={styles.playerName}>{item.username}</Text>

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 }}>
                            {/* Game Tag - Label */}
                            <View style={styles.gameTag}>
                                <Text style={styles.gameTagText}>
                                    {GAMES.find(g => normalizeGameKey(g.key) === selectedGame)?.label.toUpperCase() || selectedGame.toUpperCase()}
                                </Text>
                            </View>

                            {/* Game-Specific Info */}
                            {gameSpecificInfo && (
                                <View style={[styles.gameTag, { backgroundColor: 'transparent', borderColor: COLORS.divider }]}>
                                    <Text style={[styles.gameTagText, { color: COLORS.textSecondary }]}>
                                        {abbreviateRole(gameSpecificInfo)}
                                    </Text>
                                </View>
                            )}

                            {/* Faceit Level Icon (CS2 only) */}
                            {selectedGame === 'cs2' && item.faceitElo !== undefined && (
                                <Image
                                    source={faceitLevelIcons[getFaceitLevel(item.faceitElo)]}
                                    style={styles.faceitIcon}
                                    resizeMode="contain"
                                />
                            )}
                        </View>
                    </View>

                    {/* Action Buttons */}
                    {isFriend ? (
                        <View style={[styles.actionBtn, styles.friendBtn]}>
                            <MaterialIcons name="check-circle" size={14} color={COLORS.success} />
                            <Text style={[styles.actionBtnText, styles.friendBtnText]}>Friends</Text>
                        </View>
                    ) : isPending ? (
                        <View style={[styles.actionBtn, styles.pendingBtn]}>
                            <MaterialIcons name="schedule" size={14} color={COLORS.warning} />
                            <Text style={[styles.actionBtnText, styles.pendingBtnText]}>Pending</Text>
                        </View>
                    ) : (
                        <TouchableOpacity
                            onPress={() => handleAddFriend(item.uid)}
                            disabled={isLoading}
                            style={[styles.actionBtn, isLoading && { opacity: 0.7 }]}
                        >
                            <MaterialIcons name="person-add" size={14} color={COLORS.accent} />
                            <Text style={styles.actionBtnText}>{isLoading ? 'Adding...' : 'Add'}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

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

    // Render filter row helper (Copied from matchrooms to avoid bad re-use, or extract to shared component later)
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

    const getRoleOptions = () => {
        switch (selectedGame) {
            case 'cs2': return ['Any', ...CS2_ROLES];
            case 'futsal': return ['Any', ...FUTSAL_POSITIONS];
            case 'indoor_cricket': return ['Any', ...INDOOR_CRICKET_ROLES];
            case 'padel': return ['Any', ...PADEL_ROLES];
            case 'pickleball': return ['Any', ...PICKLEBALL_ROLES];
            default: return [];
        }
    };

    // CS2 FACEIT skill levels
    const CS2_SKILL_LEVELS = ['Any', 'FACEIT 1-3', 'FACEIT 4-6', 'FACEIT 7-10'];

    // Availability options
    const AVAILABILITY_OPTIONS = ['Any', 'Online Now', 'Available Today'];

    return (
        <View style={{ flex: 1 }}>
            {/* Contextual Filters */}
            {selectedGame !== 'all' && (
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
                                {/* Availability filter - show for all games */}
                                {renderFilterRow('Availability', AVAILABILITY_OPTIONS, selectedAvailability, setSelectedAvailability)}

                                {selectedGame === 'cs2' && renderFilterRow('Skill (FACEIT)', CS2_SKILL_LEVELS, selectedSkill, setSelectedSkill)}

                                {/* Role Filter for games that have roles */}
                                {['cs2', 'futsal', 'indoor_cricket', 'padel', 'pickleball'].includes(selectedGame) &&
                                    renderFilterRow(
                                        selectedGame === 'futsal' ? 'Position' : 'Role',
                                        getRoleOptions(),
                                        selectedRole,
                                        setSelectedRole
                                    )
                                }
                            </ScrollView>
                        </View>
                    )}
                </View>
            )}

            {/* Results Count is handled by list component now, but header handled by parent */}
            <View style={styles.resultsCount}>
                <Text style={styles.resultsCountText}>
                    {filteredPlayers.length} player{filteredPlayers.length !== 1 ? 's' : ''} found
                </Text>
            </View>

            <FlatList
                data={filteredPlayers}
                renderItem={renderPlayerItem}
                keyExtractor={item => item.uid}
                contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding ?? 24 }]}
                showsVerticalScrollIndicator={false}
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
        </View>
    );
}
