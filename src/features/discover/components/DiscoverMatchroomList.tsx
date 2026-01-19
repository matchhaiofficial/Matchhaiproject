import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
    StyleSheet
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GAME_FIELDS } from "../../../../constants/matchConfig";
import {
    CS2_ROLES,
    FUTSAL_POSITIONS,
    INDOOR_CRICKET_ROLES,
    KARACHI_AREAS,
    PADEL_ROLES,
    PICKLEBALL_ROLES
} from "../../../../constants/profileOptions";
import { getMatchrooms, Matchroom } from "../../../../src/services/matchService";
import { COLORS, FONTS } from "../../../../src/theme";
import Logger from "../../../../src/utils/logger";
import MatchroomCard from "../../../../app/matchrooms/components/MatchroomCard";
import { GameKey } from "../types";
import { normalizeGameKey } from "../utils/gameKeys";

// Reuse styles from matchrooms.styles but import implicitly or copy relevant parts?
// For now, let's assume we can reuse the existing styles or I'll inline/create new for specific parts.
// Actually, I should create a local style or import. Let's import from the app folder for now to save duplication,
// but usually feature folders should be self-contained.
// I will copy the styles logic to avoiding deep imports of app-level styles if possible, or just use inline for the layout structure.
import styles from "../../../../app/(player)/(tabs)/matchrooms.styles";

// CS2 FACEIT skill levels
const CS2_SKILL_LEVELS = ['Any', 'FACEIT 1-3', 'FACEIT 4-6', 'FACEIT 7-10'];

// Overs for Cricket
const OVERS_OPTIONS = ['Any', '5', '6'];

// Location options
const LOCATION_OPTIONS = ['Any', ...KARACHI_AREAS.filter(a => a !== 'Other (Karachi)')];

interface DiscoverMatchroomListProps {
    selectedGame: GameKey;
    searchQuery: string;
}

export default function DiscoverMatchroomList({ selectedGame, searchQuery }: DiscoverMatchroomListProps) {
    const router = useRouter();
    const [rooms, setRooms] = useState<Matchroom[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Contextual filter states
    const [showFilters, setShowFilters] = useState(false);
    const [filtersExpanded, setFiltersExpanded] = useState(true);
    const [selectedSkill, setSelectedSkill] = useState<string>('Any');
    const [selectedFormat, setSelectedFormat] = useState<string>('Any');
    const [selectedRole, setSelectedRole] = useState<string>('Any');
    const [selectedSeries, setSelectedSeries] = useState<string>('Any');
    const [selectedOvers, setSelectedOvers] = useState<string>('Any');
    const [selectedLocation, setSelectedLocation] = useState<string>('Any');

    // Location Modal
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [locationSearch, setLocationSearch] = useState('');

    const fetchRooms = async () => {
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

    useEffect(() => {
        // Initial fetch
        setLoading(true);
        fetchRooms();
    }, []);

    // Reset contextual filters when game changes
    useEffect(() => {
        setSelectedSkill('Any');
        setSelectedFormat('Any');
        setSelectedRole('Any');
        setSelectedSeries('Any');
        setSelectedOvers('Any');
        // Keep location? Usually yes, but let's reset to be safe or keep consistent with old behavior
        setSelectedLocation('Any');

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

    // List filtering logic
    const filteredRooms = rooms.filter(room => {
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
            // Allow loose matching if normalization isn't perfect, but normalization is preferred
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
                room.slotsA?.some(s => s.status === 'open' && s.role === selectedRole) ||
                room.slotsB?.some(s => s.status === 'open' && s.role === selectedRole)
            );
            if (!hasSlotWithRole) return false;
        }

        if (selectedSeries !== 'Any') {
            if (!room.format?.toUpperCase().includes(selectedSeries)) return false;
        }

        if (selectedLocation !== 'Any') {
            if (!room.location?.toLowerCase().includes(selectedLocation.toLowerCase())) return false;
        }

        return true;
    });

    // Get contextual options based on selected game
    const getFormatOptions = () => {
        if (selectedGame === 'all') return [];
        const fields = GAME_FIELDS[selectedGame as keyof typeof GAME_FIELDS];
        // Special case handling if GAME_FIELDS keys don't strictly match all normalized keys (e.g. indoor_cricket vs indoorCricket)
        // We know GAME_FIELDS uses 'indoorCricket'.
        // So we might need to map back if GAME_FIELDS uses distinct keys.
        let lookupKey = selectedGame as string;
        if (selectedGame === 'indoor_cricket') lookupKey = 'indoorCricket';

        const fieldsObj = GAME_FIELDS[lookupKey as keyof typeof GAME_FIELDS];
        if (!fieldsObj) return [];
        return ['Any', ...(fieldsObj.formats || [])];
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

    const renderItem = ({ item }: { item: Matchroom }) => (
        <MatchroomCard room={item} />
    );

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
                contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
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
            <View style={[styles.fabWrapper, { bottom: 20 }]}>
                <TouchableOpacity
                    onPress={() => router.push("/matchrooms/create" as any)}
                    activeOpacity={0.8}
                    style={styles.fab}
                >
                    <MaterialIcons name="add" size={28} color="#FFF" />
                </TouchableOpacity>
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
        </View>
    );
}
