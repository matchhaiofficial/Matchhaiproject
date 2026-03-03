import { MaterialIcons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    Pressable,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppHeader from "../../../src/components/AppHeader";
import Screen from "../../../src/components/Screen";

import { GAME_FIELDS } from "../../../constants/matchConfig";
import {
    CS2_ROLES,
    FUTSAL_POSITIONS,
    INDOOR_CRICKET_ROLES,
    KARACHI_AREAS,
    PADEL_ROLES,
    PICKLEBALL_ROLES
} from "../../../constants/profileOptions";
import { TIMELINE_FILTERS, TimelineFilterKey } from "../../../src/constants/timelineFilters";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../src/config/firebaseConfig";
import { useAuth } from "../../../src/context/AuthContext";
import { getMatchrooms, Matchroom, Slot, requestJoinMatchroom, cancelMatchJoinRequest, isUserInActiveMatchroom } from "../../../src/services/convex/matchService";
import { COLORS } from "../../../src/theme";
import Logger from "../../../src/utils/logger";
import { isRoomExpired } from "../../../src/utils/matchroomLifecycle";
import { matchesTimeline } from "../../../src/utils/timeFilters";
import MatchroomCard from "../../matchrooms/components/MatchroomCard";
import styles from "./matchrooms.styles";
import { Alert } from "react-native";

// Game filter options
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

// CS2 FACEIT skill levels
const CS2_SKILL_LEVELS = ['Any', 'FACEIT 1-3', 'FACEIT 4-6', 'FACEIT 7-10'];

// Overs for Cricket
const OVERS_OPTIONS = ['Any', '5', '6'];

// Location options
const LOCATION_OPTIONS = ['Any', ...KARACHI_AREAS.filter(a => a !== 'Other (Karachi)')];

export default function MatchroomsIndex() {
    const { user } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const tabBarHeight = useBottomTabBarHeight();
    const [rooms, setRooms] = useState<Matchroom[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Social State
    const [requestedRoomIds, setRequestedRoomIds] = useState<Set<string>>(new Set());

    // Filter states
    const [selectedGame, setSelectedGame] = useState<string>('all');
    const [showFilters, setShowFilters] = useState(false);

    // Contextual filter states
    const [selectedSkill, setSelectedSkill] = useState<string>('Any');
    const [selectedFormat, setSelectedFormat] = useState<string>('Any');
    const [selectedRole, setSelectedRole] = useState<string>('Any');
    const [selectedSeries, setSelectedSeries] = useState<string>('Any');
    const [selectedOvers, setSelectedOvers] = useState<string>('Any');
    const [selectedLocation, setSelectedLocation] = useState<string>('Any');

    // Location Modal
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [locationSearch, setLocationSearch] = useState('');

    // Timeline filter state
    const [selectedTimeline, setSelectedTimeline] = useState<TimelineFilterKey>('any');
    const touchDebugEnabled = __DEV__ && process.env.EXPO_PUBLIC_TOUCH_DEBUG === '1';

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
            Logger.error("MatchroomsIndex", "Failed to fetch rooms", e);
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
                where("fromUid", "==", user._id),
                where("type", "==", "match_join_request"),
                where("status", "==", "pending")
            );
            const snap = await getDocs(q);
            const requested = new Set<string>();
            snap.forEach((doc: any) => {
                const data = doc.data();
                if (data.meta?.matchroomId) requested.add(data.meta.matchroomId);
            });
            setRequestedRoomIds(requested);
        } catch (e) {
            Logger.error("MatchroomsIndex", "Error fetching social state", e);
        }
    };

    const handleRequestToJoin = async (room: Matchroom) => {
        if (!user) {
            Alert.alert("Login Required", "Please login to join matchrooms.");
            return;
        }
        try {
            // BUSY CHECK
            const busyCheck = await isUserInActiveMatchroom(user._id, room as any);
            if (busyCheck.inRoom && busyCheck.roomId !== room.id) {
                Alert.alert("Already Busy", busyCheck.message);
                return;
            }

            const res = await requestJoinMatchroom(room, {
                uid: user._id,
                username: user.fullName || 'Player',
            });
            if (res.ok) {
                Alert.alert("Success", "Join request sent to host.");
                setRequestedRoomIds(prev => new Set(prev).add(room.id!));
            } else {
                Alert.alert("Error", res.message || "Failed to send request.");
            }
        } catch (e) {
            Logger.error("MatchroomsIndex", "Join request error", e);
            Alert.alert("Error", "An unexpected error occurred.");
        }
    };

    const handleCancelRequestToJoin = async (room: Matchroom) => {
        if (!user) return;
        try {
            const res = await cancelMatchJoinRequest(room.id!, user._id);
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
            Logger.error("MatchroomsIndex", "Cancel request error", e);
        }
    };

    useEffect(() => {
        if (!user) {
            setRooms([]);
            setLoading(false);
            setRefreshing(false);
            return;
        }
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
        setSelectedTimeline('any');
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
                if (room.game.toLowerCase() !== selectedGame.toLowerCase()) return false;
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

            // Timeline filter (using shared helper)
            if (!matchesTimeline(room, selectedTimeline)) return false;

            return true;
        });
    }, [rooms, searchQuery, selectedGame, selectedSkill, selectedFormat, selectedRole, selectedSeries, selectedOvers, selectedLocation, selectedTimeline]);

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

    const renderItem = useCallback(({ item }: { item: Matchroom }) => {
        const isJoined = item.playerUids?.includes(user?._id || "") || (item.players || []).some(p => p.uid === user?._id);
        return (
            <MatchroomCard
                room={item}
                isRequested={requestedRoomIds.has(item.id!)}
                isJoined={isJoined}
                onJoinPress={() => handleRequestToJoin(item)}
                onCancelJoinPress={() => handleCancelRequestToJoin(item)}
            />
        );
    }, [user, requestedRoomIds]);

    // Render filter row helper
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

    // Filtered locations for dropdown
    const filteredLocations = LOCATION_OPTIONS.filter(loc =>
        loc.toLowerCase().includes(locationSearch.toLowerCase())
    );

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
            <AppHeader title="Matchrooms" />

            {/* Header Section (matching Find Players layout) */}
            <View style={styles.header}>

                {/* Search Bar */}
                <View style={styles.searchBar}>
                    <MaterialIcons name="search" size={20} color={COLORS.muted} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search matchrooms..."
                        placeholderTextColor={COLORS.muted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery("")}>
                            <MaterialIcons name="close" size={20} color={COLORS.muted} />
                        </TouchableOpacity>
                    )}
                    {selectedGame !== 'all' && (
                        <TouchableOpacity
                            onPress={() => setShowFilters(!showFilters)}
                            style={styles.filterToggle}
                        >
                            <MaterialIcons
                                name={showFilters ? "expand-less" : "tune"}
                                size={22}
                                color={showFilters ? COLORS.accent : COLORS.muted}
                            />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Game Filters - Horizontal Scroll */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.gameFiltersScroll}
                    contentContainerStyle={styles.gameFiltersContent}
                >
                    {GAMES.map(game => (
                        <TouchableOpacity
                            key={game.key}
                            onPress={() => {
                                setSelectedGame(game.key);
                                if (game.key !== 'all') setShowFilters(true);
                                else setShowFilters(false);
                            }}
                            style={[styles.optionChip, selectedGame === game.key && styles.optionChipActive]}
                        >
                            <Text style={[styles.optionChipText, selectedGame === game.key && styles.optionChipTextActive]}>
                                {game.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Contextual Filters */}
            {showFilters && selectedGame !== 'all' && (
                <View style={styles.filtersPanel}>
                    {hasCS2SkillFilter() && renderFilterRow('Skill (FACEIT)', CS2_SKILL_LEVELS, selectedSkill, setSelectedSkill)}
                    {hasFormatFilter() && renderFilterRow('Format', getFormatOptions(), selectedFormat, setSelectedFormat)}
                    {hasRoleFilter() && renderFilterRow(
                        selectedGame === 'futsal' ? 'Position' : 'Role',
                        getRoleOptions(),
                        selectedRole,
                        setSelectedRole
                    )}
                    {hasSeriesFilter() && renderFilterRow('Series', getSeriesOptions(), selectedSeries, setSelectedSeries)}
                    {hasOversFilter() && renderFilterRow('Overs', OVERS_OPTIONS, selectedOvers, setSelectedOvers)}

                    {/* Timeline filter */}
                    <View style={styles.filterSection}>
                        <Text style={styles.filterLabel}>Timeline</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterOptionsScroll}>
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
                contentContainerStyle={styles.listContent}
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

            {/* Create Matchroom FAB */}
            <View style={[styles.fabWrapper, { bottom: Math.max(insets.bottom + 16, tabBarHeight + 12) }]}>
                <Pressable
                    onPressIn={() => {
                        if (touchDebugEnabled) {
                            Logger.debug("TouchDebug", "pressIn", { tag: "matchrooms_fab_create" });
                        }
                    }}
                    onPress={() => {
                        if (touchDebugEnabled) {
                            Logger.debug("TouchDebug", "press", { tag: "matchrooms_fab_create" });
                        }
                        router.push("/matchrooms/create" as any);
                    }}
                    style={({ pressed }) => [styles.fab, pressed && { opacity: 0.88 }]}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <MaterialIcons name="add" size={28} color="#FFF" />
                </Pressable>
            </View>

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
        </Screen>
    );
}
