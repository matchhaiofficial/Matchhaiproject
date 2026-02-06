import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";

import { GAME_FIELDS } from "../../../../constants/matchConfig";
import {
    CS2_ROLES,
    FUTSAL_POSITIONS,
    INDOOR_CRICKET_ROLES,
    KARACHI_AREAS,
    PADEL_ROLES,
    PICKLEBALL_ROLES
} from "../../../../constants/profileOptions";
import { TIMELINE_FILTERS, TimelineFilterKey } from "../../../../src/constants/timelineFilters";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../../src/config/firebaseConfig";
import { useAuth } from "../../../../src/context/AuthContext";
import { getMatchrooms, Matchroom, Slot, requestJoinMatchroom, cancelMatchJoinRequest, isUserInActiveMatchroom } from "../../../../src/services/matchService";
import { COLORS } from "../../../../src/theme";
import Logger from "../../../../src/utils/logger";
import { matchesTimeline } from "../../../../src/utils/timeFilters";
import { isRoomExpired } from "../../../../src/utils/matchroomLifecycle";
import MatchroomCard from "../../../../app/matchrooms/components/MatchroomCard";
import { GameKey } from "../types";
import { normalizeGameKey } from "../utils/gameKeys";

import styles from "../styles/matchrooms.styles";

// CS2 FACEIT skill levels
const CS2_SKILL_LEVELS = ['Any', 'FACEIT 1-3', 'FACEIT 4-6', 'FACEIT 7-10'];

// Generic Skill Level options (applies to all games)
const SKILL_LEVEL_OPTIONS = ['Any', 'Casual', 'Competitive', 'Pro / Tournament'];

// Overs for Cricket
const OVERS_OPTIONS = ['Any', '5', '6'];

// Location options
const LOCATION_OPTIONS = ['Any', ...KARACHI_AREAS.filter(a => a !== 'Other (Karachi)')];

interface DiscoverMatchroomListProps {
    selectedGame: GameKey;
    searchQuery: string;
    edgePadding?: number;
    bottomPadding?: number;
}

export default function DiscoverMatchroomList({ selectedGame, searchQuery, edgePadding, bottomPadding }: DiscoverMatchroomListProps) {
    const { user } = useAuth();
    const [rooms, setRooms] = useState<Matchroom[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Social State
    const [requestedRoomIds, setRequestedRoomIds] = useState<Set<string>>(new Set());

    // Contextual filter states
    const [showFilters, setShowFilters] = useState(false);
    const [filtersExpanded, setFiltersExpanded] = useState(true);
    const [selectedSkill, setSelectedSkill] = useState<string>('Any');
    const [selectedFormat, setSelectedFormat] = useState<string>('Any');
    const [selectedRole, setSelectedRole] = useState<string>('Any');
    const [selectedSeries, setSelectedSeries] = useState<string>('Any');
    const [selectedOvers, setSelectedOvers] = useState<string>('Any');
    const [selectedLocation, setSelectedLocation] = useState<string>('Any');

    // New filters
    const [selectedSkillLevel, setSelectedSkillLevel] = useState<string>('Any');
    const [selectedTimeline, setSelectedTimeline] = useState<TimelineFilterKey>('any');

    // Location Modal
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [locationSearch, setLocationSearch] = useState('');

    const fetchRooms = async () => {
        if (!user) {
            setRooms([]);
            setLoading(false);
            setRefreshing(false);
            return;
        }
        try {
            const res = await getMatchrooms();
            if (res.ok && res.data) {
                setRooms(res.data);
            }
        } catch (e) {
            Logger.error("DiscoverMatchrooms", "Failed to fetch rooms", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchSocialState = async () => {
        if (!user) return;
        try {
            const q = query(
                collection(db, "notifications"),
                where("fromUid", "==", user.uid),
                where("type", "==", "match_join_request"),
                where("status", "==", "pending")
            );
            const snap = await getDocs(q);
            const requested = new Set<string>();
            snap.forEach(doc => {
                const data = doc.data();
                if (data.meta?.matchroomId) requested.add(data.meta.matchroomId);
            });
            setRequestedRoomIds(requested);
        } catch (e) {
            Logger.error("DiscoverMatchrooms", "Error fetching social state", e);
        }
    };

    const handleRequestToJoin = async (room: Matchroom) => {
        if (!user) {
            Alert.alert("Login Required", "Please login to join matchrooms.");
            return;
        }
        try {
            // BUSY CHECK
            const busyCheck = await isUserInActiveMatchroom(user.uid, room as any);
            if (busyCheck.inRoom && busyCheck.roomId !== room.id) {
                Alert.alert("Already Busy", busyCheck.message);
                return;
            }

            const res = await requestJoinMatchroom(room, {
                uid: user.uid,
                username: user.displayName || 'Player',
            });
            if (res.ok) {
                Alert.alert("Success", "Join request sent to host.");
                setRequestedRoomIds(prev => new Set(prev).add(room.id!));
            } else {
                Alert.alert("Error", res.message || "Failed to send request.");
            }
        } catch (e) {
            Logger.error("DiscoverMatchrooms", "Join request error", e);
            Alert.alert("Error", "An unexpected error occurred.");
        }
    };

    const handleCancelRequestToJoin = async (room: Matchroom) => {
        if (!user) return;
        try {
            const res = await cancelMatchJoinRequest(room.id!, user.uid);
            if (res.ok) {
                setRequestedRoomIds(prev => {
                    const next = new Set(prev);
                    next.delete(room.id!);
                    return next;
                });
            } else {
                Alert.alert("Error", res.message || "Failed to cancel request.");
            }
        } catch (e) {
            Logger.error("DiscoverMatchrooms", "Cancel request error", e);
        }
    };

    useEffect(() => {
        // Initial fetch
        setLoading(true);
        fetchRooms();
        fetchSocialState();
    }, [user]);

    // Refetch social state on focus to catch host rejections or external cancellations
    useFocusEffect(
        useCallback(() => {
            if (user) {
                fetchSocialState();
            }
        }, [user])
    );

    // Reset contextual filters when game changes
    useEffect(() => {
        setSelectedSkill('Any');
        setSelectedFormat('Any');
        setSelectedRole('Any');
        setSelectedSeries('Any');
        setSelectedOvers('Any');
        setSelectedLocation('Any');
        setSelectedSkillLevel('Any');
        setSelectedTimeline('any');

        // Auto-show filters if specific game selected? 
        if (selectedGame !== 'all') {
            setShowFilters(true);
        } else {
            setShowFilters(false);
        }
    }, [selectedGame]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchRooms();
    };

    const getRoomOvers = (room: Matchroom) => {
        if (room.overs != null) return String(room.overs);
        const match = room.format?.match(/(\d+)\s*overs?/i);
        return match ? match[1] : null;
    };

    const filteredRooms = useMemo(() => {
        return rooms.filter((room: Matchroom) => {
            // Filter out expired rooms
            if (isRoomExpired(room)) return false;

            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesSearch =
                    room.title.toLowerCase().includes(query) ||
                    room.game.toLowerCase().includes(query) ||
                    room.location?.toLowerCase().includes(query);
                if (!matchesSearch) return false;
            }

            if (selectedGame !== 'all') {
                const roomGameKey = normalizeGameKey(room.game);
                if (roomGameKey !== selectedGame) return false;
            }

            if (selectedGame === 'cs2' && selectedSkill !== 'Any') {
                const roomSkill = room.skillLevel || 'Any';
                if (!roomSkill.includes(selectedSkill.replace('FACEIT ', ''))) return false;
            }

            if (selectedFormat !== 'Any') {
                if (!room.format?.toLowerCase().includes(selectedFormat.toLowerCase())) return false;
            }

            // Role filter - Atomic slot-based check
            if (selectedRole !== 'Any') {
                const hasSlotWithRole = (
                    room.slotsA?.some((s: Slot) => s.status === 'open' && s.role === selectedRole) ||
                    room.slotsB?.some((s: Slot) => s.status === 'open' && s.role === selectedRole)
                );
                if (!hasSlotWithRole) return false;
            }

            if (selectedSeries !== 'Any') {
                const series = (room as any).seriesType;
                if (series) {
                    if (!String(series).toUpperCase().includes(selectedSeries)) return false;
                } else {
                    if (!room.format?.toUpperCase().includes(selectedSeries)) return false;
                }
            }

            if (selectedOvers !== 'Any') {
                const overs = getRoomOvers(room);
                if (!overs || overs !== selectedOvers) return false;
            }

            if (selectedLocation !== 'Any') {
                if (!room.location?.toLowerCase().includes(selectedLocation.toLowerCase())) return false;
            }

            // Generic Skill Level filter
            if (selectedSkillLevel !== 'Any') {
                const roomSkillLevel = room.skillLevel || 'Casual';
                if (selectedSkillLevel === 'Pro / Tournament') {
                    if (!roomSkillLevel.toLowerCase().includes('pro') && !roomSkillLevel.toLowerCase().includes('tournament')) return false;
                } else if (!roomSkillLevel.toLowerCase().includes(selectedSkillLevel.toLowerCase())) return false;
            }

            // Timeline filter (using shared helper)
            if (!matchesTimeline(room, selectedTimeline)) return false;

            return true;
        });
    }, [rooms, searchQuery, selectedGame, selectedSkill, selectedFormat, selectedRole, selectedSeries, selectedOvers, selectedLocation, selectedSkillLevel, selectedTimeline]);

    // Get contextual options based on selected game
    const getFormatOptions = () => {
        if (selectedGame === 'all') return [];
        const fields = GAME_FIELDS[selectedGame as keyof typeof GAME_FIELDS];
        if (!fields) return [];
        return ['Any', ...(fields.formats || [])];
    };

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

    const getSeriesOptions = () => {
        switch (selectedGame) {
            case 'cs2': return ['Any', 'BO1', 'BO3', 'BO5'];
            case 'fc26':
            case 'tekken8': return ['Any', 'BO3', 'BO5', 'BO7', 'BO10'];
            case 'padel':
            case 'pickleball': return ['Any', 'BO3', 'BO5', 'BO10'];
            case 'indoor_cricket': return ['Any', 'BO3'];
            case 'futsal': return [];
            default: return [];
        }
    };

    const hasFormatFilter = () => ['fc26', 'tekken8', 'futsal', 'pickleball'].includes(selectedGame);
    const hasRoleFilter = () => ['cs2', 'futsal', 'indoor_cricket', 'padel', 'pickleball'].includes(selectedGame);
    const hasSeriesFilter = () => getSeriesOptions().length > 0;
    const hasOversFilter = () => selectedGame === 'indoor_cricket';
    const hasCS2SkillFilter = () => selectedGame === 'cs2';

    const renderItem = ({ item }: { item: Matchroom }) => {
        const isJoined = item.playerUids?.includes(user?.uid || "") || (item.players || []).some(p => p.uid === user?.uid);
        return (
            <MatchroomCard
                room={item}
                isRequested={requestedRoomIds.has(item.id!)}
                isJoined={isJoined}
                onJoinPress={() => handleRequestToJoin(item)}
                onCancelJoinPress={() => handleCancelRequestToJoin(item)}
            />
        );
    };

    const filterBleedStyle = edgePadding ? { marginHorizontal: -edgePadding, paddingHorizontal: edgePadding } : null;
    const filterScrollStyle = edgePadding ? { marginHorizontal: -edgePadding } : null;
    const filterContentStyle = edgePadding ? { paddingHorizontal: edgePadding } : null;

    // Render filter row helper
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

    // Filtered locations for dropdown
    const filteredLocations = LOCATION_OPTIONS.filter(loc =>
        loc.toLowerCase().includes(locationSearch.toLowerCase())
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            {/* Contextual Filters */}
            {showFilters && selectedGame !== 'all' && (
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
                                {/* New universal filters */}
                                {renderFilterRow('Skill Level', SKILL_LEVEL_OPTIONS, selectedSkillLevel, setSelectedSkillLevel)}

                                {/* Timeline filter - use TIMELINE_FILTERS */}
                                <View style={styles.filterSection}>
                                    <Text style={styles.filterLabel}>Timeline</Text>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        style={styles.filterOptionsScroll}
                                        contentContainerStyle={styles.filterOptionsContent}
                                    >
                                        {TIMELINE_FILTERS.map(filter => (
                                            <TouchableOpacity
                                                key={filter.key}
                                                onPress={() => setSelectedTimeline(filter.key)}
                                                style={[styles.optionChip, selectedTimeline === filter.key && styles.optionChipActive]}
                                            >
                                                <Text style={[styles.optionChipText, selectedTimeline === filter.key && styles.optionChipTextActive]}>
                                                    {filter.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>

                                {/* Game-specific filters */}
                                {hasCS2SkillFilter() && renderFilterRow('FACEIT Level', CS2_SKILL_LEVELS, selectedSkill, setSelectedSkill)}
                                {hasFormatFilter() && renderFilterRow('Format', getFormatOptions(), selectedFormat, setSelectedFormat)}
                                {hasRoleFilter() && renderFilterRow(
                                    selectedGame === 'futsal' ? 'Position' : 'Role',
                                    getRoleOptions(),
                                    selectedRole,
                                    setSelectedRole
                                )}
                                {hasSeriesFilter() && renderFilterRow('Series', getSeriesOptions(), selectedSeries, setSelectedSeries)}
                                {hasOversFilter() && renderFilterRow('Overs', OVERS_OPTIONS, selectedOvers, setSelectedOvers)}

                                {/* Location Dropdown */}
                                <View style={styles.filterSection}>
                                    <Text style={styles.filterLabel}>Location</Text>
                                    <TouchableOpacity
                                        onPress={() => setShowLocationModal(true)}
                                        style={[styles.locationDropdown, selectedLocation !== 'Any' && styles.locationDropdownActive]}
                                    >
                                        <Text style={[styles.locationDropdownText, selectedLocation !== 'Any' && styles.locationDropdownTextActive]}>
                                            {selectedLocation}
                                        </Text>
                                        <MaterialIcons name="arrow-drop-down" size={24} color={COLORS.muted} />
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </View>
                    )}
                </View>
            )}

            {/* Results Count */}
            <View style={styles.resultsCount}>
                <Text style={styles.resultsCountText}>
                    {filteredRooms.length} matchroom{filteredRooms.length !== 1 ? 's' : ''} found
                </Text>
            </View>

            {/* Content */}
            <FlatList
                data={filteredRooms}
                renderItem={renderItem}
                keyExtractor={(item) => item.id!}
                contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding ?? 24 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <MaterialIcons name="sports-esports" size={48} color={COLORS.muted} style={styles.emptyStateIcon} />
                        <Text style={styles.emptyStateTitle}>No matchrooms found</Text>
                        <Text style={styles.emptyStateSubtitle}>
                            Try adjusting your filters or be the first to create a matchroom!
                        </Text>
                    </View>
                }
            />

            {/* Location Selection Modal */}
            <Modal
                visible={showLocationModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowLocationModal(false)}
            >
                <TouchableWithoutFeedback onPress={() => setShowLocationModal(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.modalContent}>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>Select Location</Text>
                                    <TouchableOpacity onPress={() => setShowLocationModal(false)}>
                                        <MaterialIcons name="close" size={24} color={COLORS.muted} />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.modalSearchContainer}>
                                    <MaterialIcons name="search" size={20} color={COLORS.muted} />
                                    <TextInput
                                        style={styles.modalSearchInput}
                                        placeholder="Search areas..."
                                        placeholderTextColor={COLORS.muted}
                                        value={locationSearch}
                                        onChangeText={setLocationSearch}
                                    />
                                </View>

                                <FlatList
                                    data={filteredLocations}
                                    keyExtractor={(item) => item}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            onPress={() => {
                                                setSelectedLocation(item);
                                                setShowLocationModal(false);
                                                setLocationSearch('');
                                            }}
                                            style={styles.modalListItem}
                                        >
                                            <Text style={[
                                                styles.modalListItemText,
                                                selectedLocation === item && styles.modalListItemTextActive
                                            ]}>
                                                {item}
                                            </Text>
                                            {selectedLocation === item && (
                                                <MaterialIcons name="check" size={20} color={COLORS.accent} />
                                            )}
                                        </TouchableOpacity>
                                    )}
                                />
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
}
