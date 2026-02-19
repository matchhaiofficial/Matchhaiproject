import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useConvex, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Doc } from "../../../../convex/_generated/dataModel";
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
    const convex = useConvex();
    const searchTerm = searchQuery.trim();
    const playersQuery = useQuery(api.users.listPlayers, { limit: 200, search: searchTerm || undefined });
    const friendsQuery = useQuery(api.users.listFriends, user ? {} : "skip");
    const outgoingRequestsQuery = useQuery(
        api.notifications.listOutgoingByType,
        user ? { type: "friend_request", status: "pending" } : "skip",
    );
    const sendFriendRequest = useMutation(api.users.sendFriendRequest);

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

    const players = useMemo<Player[]>(() => {
        const source = playersQuery ?? [];
        return source
            .filter((doc: Doc<"users">) => {
                const docUid = doc.uid || String(doc._id);
                return user?.uid ? docUid !== user.uid : true;
            })
            .map((doc: Doc<"users">) => {
                const roles: Record<string, string> = {};
                if (doc.cs2Role) roles.cs2Role = doc.cs2Role;
                if (doc.padelRole) roles.padelRole = doc.padelRole;
                if (doc.pickleballRole) roles.pickleballRole = doc.pickleballRole;
                const futsalPositions = Array.isArray(doc.futsalPositions) ? doc.futsalPositions.filter(Boolean) : [];
                const futsalRole = futsalPositions[0] || doc.futsalPosition;
                if (futsalRole) roles.futsalRole = futsalRole;
                if (doc.indoorCricketRole) roles.indoor_cricketRole = doc.indoorCricketRole;

                const primaryGames: string[] = [];
                if (doc.playsCs2) primaryGames.push("cs2");
                if (doc.playsFc) primaryGames.push("fc26");
                if (doc.playsTekken) primaryGames.push("tekken8");
                if (doc.playsFutsal) primaryGames.push("futsal");
                if (doc.playsIndoorCricket) primaryGames.push("indoor_cricket");
                if (doc.playsPadel) primaryGames.push("padel");
                if (doc.playsPickleball) primaryGames.push("pickleball");

                return {
                    uid: doc.uid || String(doc._id),
                    username: doc.username || doc.displayName || doc.fullName || "Unknown",
                    primaryGames,
                    skillLevel: "Beginner",
                    isOnline: doc.isOnline || false,
                    roles,
                    faceitElo: doc.faceitElo,
                    skillScores: doc.skillScores || {},
                    fcTeam: doc.fcTeam,
                    tekkenFavorites: doc.tekkenFavorites || [],
                };
            });
    }, [playersQuery, user?.uid]);

    useEffect(() => {
        if (playersQuery === undefined) return;
        setLoading(false);
    }, [playersQuery]);

    useEffect(() => {
        if (!friendsQuery) return;
        const friends = new Set<string>();
        friendsQuery.forEach((friend: any) => {
            if (friend?.friendId) friends.add(String(friend.friendId));
        });
        setFriendUids(friends);
    }, [friendsQuery]);

    useEffect(() => {
        if (!outgoingRequestsQuery) return;
        const pending = new Set<string>();
        outgoingRequestsQuery.forEach((notif: any) => {
            if (notif?.toUid) pending.add(String(notif.toUid));
        });
        setPendingUids(pending);
    }, [outgoingRequestsQuery]);

    // Reset filters
    useEffect(() => {
        setSelectedRole('Any');
        setSelectedSkill('Any');
        setSelectedAvailability('Any');
        if (selectedGame !== 'all') {
            setFiltersExpanded(true);
        }
    }, [selectedGame]);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await Promise.all([
                convex.query(api.users.listPlayers, { limit: 200, search: searchTerm || undefined }),
                user ? convex.query(api.users.listFriends, {}) : Promise.resolve(),
                user
                    ? convex.query(api.notifications.listOutgoingByType, {
                        type: "friend_request",
                        status: "pending",
                    })
                    : Promise.resolve(),
            ]);
        } catch (error) {
            Logger.error("DiscoverPlayers", "Refresh failed", error);
        } finally {
            setRefreshing(false);
        }
    };

    const handleAddFriend = async (targetUid: string) => {
        if (actionLoading) return;
        setActionLoading(targetUid);
        try {
            const res = await sendFriendRequest({ toUid: targetUid });
            if (res?.ok !== false) {
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
        const applySearchFilter = searchTerm.length === 0;
        const matchesSearch = applySearchFilter
            ? player.username.toLowerCase().includes(searchTerm.toLowerCase())
            : true;

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
