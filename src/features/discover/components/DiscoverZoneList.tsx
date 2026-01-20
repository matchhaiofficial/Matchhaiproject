import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
    StyleSheet
} from "react-native";

import { getActiveZones, Zone } from "../../../../src/services/zoneService";
import { COLORS, SPACING, RADII, FONTS, SHADOWS, TEXT_SIZES } from "../../../../src/theme";
import Logger from "../../../../src/utils/logger";
import { GameKey } from "../types";
import { normalizeGameKey } from "../utils/gameKeys";

interface DiscoverZoneListProps {
    selectedGame: GameKey;
    searchQuery: string;
}

export default function DiscoverZoneList({ selectedGame, searchQuery }: DiscoverZoneListProps) {
    const router = useRouter();
    const [zones, setZones] = useState<Zone[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filter state
    const [filtersExpanded, setFiltersExpanded] = useState(true);
    const [selectedProximity, setSelectedProximity] = useState('Any');

    // User's area/city for proximity filtering (could be from context/profile)
    const [userArea, setUserArea] = useState<string | null>(null);
    const [userCity, setUserCity] = useState<string | null>('Karachi'); // Default to Karachi

    const fetchZones = async () => {
        try {
            // If selectedGame is 'all', pass undefined to fetch all active zones
            // If selectedGame is specific, pass it to get filtered and simpler rate derivation
            const gameParam = selectedGame === 'all' ? undefined : selectedGame;

            const res = await getActiveZones(gameParam);
            if (res.ok && res.data) {
                setZones(res.data);
            }
        } catch (e) {
            Logger.error("DiscoverZones", "Failed to fetch zones", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        setSelectedProximity('Any');
        fetchZones();
    }, [selectedGame]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchZones();
    };

    const filteredZones = zones.filter(zone => {
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesName = zone.venueBrandName?.toLowerCase().includes(query);
            const matchesCity = zone.primaryBranch?.city?.toLowerCase().includes(query);
            const matchesArea = zone.primaryBranch?.areaLabel?.toLowerCase().includes(query);

            if (!matchesName && !matchesCity && !matchesArea) return false;
        }

        // Proximity filter
        if (selectedProximity !== 'Any') {
            const zoneArea = zone.primaryBranch?.areaLabel?.toLowerCase();
            const zoneCity = zone.primaryBranch?.city?.toLowerCase();

            if (selectedProximity === 'Same Area') {
                // Match area if user has set their area
                if (userArea && zoneArea && !zoneArea.includes(userArea.toLowerCase())) return false;
            } else if (selectedProximity === 'Same City') {
                // Match city
                if (userCity && zoneCity && !zoneCity.includes(userCity.toLowerCase())) return false;
            }
        }

        return true;
    });

    const renderZoneItem = ({ item }: { item: Zone }) => {
        const address = [item.primaryBranch?.areaLabel, item.primaryBranch?.city].filter(Boolean).join(", ");

        return (
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => router.push(`/(player)/zones/${item.id}` as any)}
                style={styles.card}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.cardIcon}>
                        <MaterialIcons name="store" size={24} color={COLORS.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>{item.venueBrandName}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                            <MaterialIcons name="location-on" size={12} color={COLORS.muted} />
                            <Text style={styles.cardSubtitle} numberOfLines={1}>
                                {address || "Location unavailable"}
                            </Text>
                        </View>
                    </View>
                    {item.effectiveRateLabel && (
                        <View style={styles.priceTag}>
                            <Text style={styles.priceText}>{item.effectiveRateLabel}</Text>
                        </View>
                    )}
                </View>

                {/* Tags */}
                <View style={styles.tagsRow}>
                    {/* Show supported games chips if 'all' selected, or just general info */}
                    {selectedGame === 'all' && (
                        Object.entries(item.games || {}).filter(([k, v]) => v).slice(0, 3).map(([key, val]) => (
                            <View key={key} style={styles.tag}>
                                <Text style={styles.tagText}>{key.replace('supports', '')}</Text>
                            </View>
                        ))
                    )}
                    {selectedGame !== 'all' && (
                        <View style={styles.tag}>
                            <Text style={styles.tagText}>Supports {selectedGame.toUpperCase()}</Text>
                        </View>
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

    // Filter options
    const PROXIMITY_OPTIONS = ['Any', 'Same Area', 'Same City'];

    // Render filter row helper (consistent with other tabs)
    const renderFilterRow = (label: string, options: string[], selected: string, onSelect: (val: string) => void) => (
        <View style={filterStyles.filterSection}>
            <Text style={filterStyles.filterLabel}>{label}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={filterStyles.filterOptionsScroll}>
                {options.map(opt => (
                    <TouchableOpacity
                        key={opt}
                        onPress={() => onSelect(opt)}
                        style={[filterStyles.optionChip, selected === opt && filterStyles.optionChipActive]}
                    >
                        <Text style={[filterStyles.optionChipText, selected === opt && filterStyles.optionChipTextActive]}>
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
                        <View style={{ maxHeight: 300 }}>
                            <ScrollView
                                showsVerticalScrollIndicator={true}
                                contentContainerStyle={[filterStyles.filtersPanel, { marginTop: 0, paddingBottom: 20 }]}
                            >
                                {renderFilterRow('Location', PROXIMITY_OPTIONS, selectedProximity, setSelectedProximity)}
                            </ScrollView>
                        </View>
                    )}
                </View>
            )}

            <View style={styles.resultsCount}>
                <Text style={styles.resultsCountText}>
                    {filteredZones.length} zone{filteredZones.length !== 1 ? 's' : ''} found
                </Text>
            </View>

            <FlatList
                data={filteredZones}
                renderItem={renderZoneItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[styles.listContent]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <MaterialIcons name="store-mall-directory" size={48} color={COLORS.muted} style={styles.emptyIcon} />
                        <Text style={styles.emptyTitle}>No Zones Found</Text>
                        <Text style={styles.emptySubtitle}>
                            Try adjusting your filters or search query.
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        paddingHorizontal: SPACING.screenPadding,
        paddingBottom: 100,
    },
    resultsCount: {
        paddingHorizontal: SPACING.screenPadding,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.sm,
    },
    resultsCountText: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
    },
    card: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: RADII.lg,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        ...SHADOWS.cardElevated,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: SPACING.sm,
    },
    cardIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(66, 165, 245, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    cardTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 16,
        fontWeight: 'bold',
    },
    cardSubtitle: {
        color: COLORS.textSecondary,
        fontSize: 12,
        marginLeft: 4,
        flex: 1,
    },
    priceTag: {
        backgroundColor: 'rgba(0, 230, 118, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(0, 230, 118, 0.3)',
    },
    priceText: {
        color: COLORS.success,
        fontSize: 10,
        fontWeight: 'bold',
    },
    tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 4,
        gap: 8,
    },
    tag: {
        backgroundColor: COLORS.background,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: COLORS.divider,
    },
    tagText: {
        color: COLORS.textSecondary,
        fontSize: 10,
        fontFamily: FONTS.body,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
    emptyIcon: {
        marginBottom: SPACING.md,
        opacity: 0.5,
    },
    emptyTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 18,
        marginBottom: SPACING.sm,
    },
    emptySubtitle: {
        color: COLORS.muted,
        textAlign: 'center',
    },
});

// Filter styles (consistent with other tabs)
const filterStyles = StyleSheet.create({
    filtersPanel: {
        backgroundColor: COLORS.cardBackground,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
        paddingVertical: 12,
    },
    filterSection: {
        marginBottom: 12,
        paddingHorizontal: 16,
    },
    filterLabel: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.heading,
        fontSize: 12,
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    filterOptionsScroll: {
        flexGrow: 0,
    },
    optionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        backgroundColor: COLORS.cardBackground,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm - 1,
        marginRight: SPACING.sm,
        marginBottom: 5,
    },
    optionChipActive: {
        backgroundColor: '#1e2a38',
        borderColor: COLORS.accent,
    },
    optionChipText: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.label - 1,
    },
    optionChipTextActive: {
        color: COLORS.text,
    },
});
