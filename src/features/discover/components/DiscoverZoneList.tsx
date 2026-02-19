import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from "react-native";

import { useConvex, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { COLORS } from "../../../../src/theme";
import Logger from "../../../../src/utils/logger";
import { GameKey } from "../types";
import styles, { filterStyles } from "../styles/zones.styles";

interface DiscoverZoneListProps {
    selectedGame: GameKey;
    searchQuery: string;
    selectedVenueType: 'all' | 'zones' | 'courts';
    edgePadding?: number;
    bottomPadding?: number;
}

type ZoneRow = Doc<"zones"> & { id: string; effectiveRateLabel?: string | null };

export default function DiscoverZoneList({ selectedGame: _selectedGame, searchQuery, selectedVenueType, edgePadding, bottomPadding }: DiscoverZoneListProps) {
    const router = useRouter();
    const convex = useConvex();
    const searchTerm = searchQuery.trim();
    const zonesQuery = useQuery(api.zones.listActiveZones, {
        limit: 200,
        search: searchTerm || undefined,
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filter state
    const [filtersExpanded, setFiltersExpanded] = useState(true);
    const [selectedProximity, setSelectedProximity] = useState('Any');
    const [internalSelectedGame, setInternalSelectedGame] = useState<string>('all');

    // User's area/city for proximity filtering (could be from context/profile)
    const [userArea, setUserArea] = useState<string | null>(null);
    const [userCity, setUserCity] = useState<string | null>('Karachi'); // Default to Karachi

    // Game categorization
    const ESPORTS_GAMES = [
        { key: 'all', label: 'All' },
        { key: 'cs2', label: 'CS2' },
        { key: 'fc26', label: 'FC26' },
        { key: 'tekken8', label: 'Tekken 8' },
    ];
    const SPORTS_GAMES = [
        { key: 'all', label: 'All' },
        { key: 'futsal', label: 'Futsal' },
        { key: 'indoor_cricket', label: 'Cricket' },
        { key: 'padel', label: 'Padel' },
        { key: 'pickleball', label: 'Pickleball' },
    ];

    // Get available games based on venue type
    const getGamesForVenueType = () => {
        if (selectedVenueType === 'zones') return ESPORTS_GAMES;
        if (selectedVenueType === 'courts') return SPORTS_GAMES;
        return [];
    };

    const zones = useMemo<ZoneRow[]>(() => {
        const source = zonesQuery ?? [];
        return source.map((zone: any) => ({
            ...zone,
            id: String(zone._id),
        }));
    }, [zonesQuery]);

    useEffect(() => {
        if (zonesQuery === undefined) return;
        setLoading(false);
    }, [zonesQuery]);

    useEffect(() => {
        setInternalSelectedGame('all');
    }, [selectedVenueType]);

    useEffect(() => {
        setSelectedProximity('Any');
    }, [internalSelectedGame]);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await convex.query(api.zones.listActiveZones, {
                limit: 200,
                search: searchTerm || undefined,
            });
        } catch (e) {
            Logger.error("DiscoverZones", "Failed to refresh zones", e);
        } finally {
            setRefreshing(false);
        }
    };

    const normalizeSupportKey = (gameKey: string) => {
        if (gameKey === 'fc26') return 'fc25';
        if (gameKey === 'indoor_cricket') return 'indoorCricket';
        return gameKey;
    };

    const supportsGame = (zone: ZoneRow, gameKey: string) => {
        if (gameKey === 'all') return true;
        const normalized = normalizeSupportKey(gameKey);
        const field = `supports${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
        const supports = (zone.games as any)?.[field] === true;
        if (!supports) return false;

        if (gameKey === 'cs2') {
            const pcSeats = zone.capacity?.pcSeats ?? 0;
            return pcSeats > 0;
        }

        if (['fc25', 'fc26', 'tekken8'].includes(gameKey)) {
            const consoleSeats = zone.capacity?.consoleSeats ?? 0;
            return consoleSeats > 0;
        }

        return true;
    };

    const getEffectiveRateLabel = (zone: ZoneRow) => {
        if (internalSelectedGame === 'all') return zone.effectiveRateLabel ?? null;
        const pricing = (zone.branches?.[0]?.pricing ?? zone.pricing) as any;
        if (!pricing) return null;

        const labelFor = (rate: number | null, suffix: string) =>
            rate ? `${rate} PKR/hr (${suffix})` : null;

        switch (internalSelectedGame) {
            case 'cs2': {
                const rate =
                    pricing.pc?.regular?.price ||
                    pricing.pc?.premium?.price ||
                    pricing.pc?.elite?.price ||
                    null;
                return labelFor(rate, 'Regular');
            }
            case 'fc26':
            case 'fc25':
            case 'tekken8': {
                const ps5 = pricing.console?.ps5 || {};
                const xbox = pricing.console?.xbox || {};
                const ps5Rate = ps5.price1v1 || ps5.price || ps5.price2v2 || null;
                const xboxRate = xbox.price1v1 || xbox.price || xbox.price2v2 || null;
                const rate = ps5Rate || xboxRate || null;
                return rate ? `${rate} PKR/hr (${ps5Rate ? 'PS5' : 'Xbox'})` : null;
            }
            case 'futsal': {
                const futsal = pricing.futsal;
                if (!futsal) return null;
                const keys = Object.keys(futsal);
                if (keys.length === 0) return null;
                const key = futsal["5v5"] ? "5v5" : keys[0];
                const rate = futsal[key]?.price || null;
                return labelFor(rate, key);
            }
            case 'indoor_cricket': {
                const indoor = pricing.indoorCricket || pricing.indoor_cricket;
                if (!indoor) return null;
                const keys = Object.keys(indoor);
                if (keys.length === 0) return null;
                const key = keys[0];
                const rate = indoor[key]?.price || null;
                return labelFor(rate, key);
            }
            case 'padel': {
                const padel = pricing.padel;
                if (!padel) return null;
                const keys = Object.keys(padel);
                if (keys.length === 0) return null;
                const key = keys[0];
                const rate = padel[key]?.price || null;
                return labelFor(rate, key);
            }
            case 'pickleball': {
                const pickleball = pricing.pickleball;
                if (!pickleball) return null;
                const keys = Object.keys(pickleball);
                if (keys.length === 0) return null;
                const key = keys[0];
                const rate = pickleball[key]?.price || null;
                return labelFor(rate, key);
            }
            default:
                return null;
        }
    };

    // Filter zones based on venue type and other filters
    const filteredZones = zones.filter(zone => {
        // Venue type filter
        if (selectedVenueType !== 'all') {
            const zoneType = zone.type || 'gaming'; // Default to gaming
            if (selectedVenueType === 'zones' && zoneType === 'sports') return false;
            if (selectedVenueType === 'courts' && zoneType === 'gaming') return false;
            // Hybrid zones show in both
        }

        if (internalSelectedGame !== 'all' && !supportsGame(zone, internalSelectedGame)) {
            return false;
        }

        if (searchTerm.length === 0 && searchQuery) {
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

    const renderZoneItem = ({ item }: { item: ZoneRow }) => {
        const address = [item.primaryBranch?.areaLabel, item.primaryBranch?.city].filter(Boolean).join(", ");
        const isSportsCourt = item.type === 'sports';
        const isHybrid = item.type === 'hybrid';
        const effectiveRateLabel = getEffectiveRateLabel(item as ZoneRow);

        return (
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => router.push(`/(player)/zones/${item.id}` as any)}
                style={styles.card}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.cardIcon, isSportsCourt && { backgroundColor: 'rgba(0, 230, 118, 0.1)' }]}>
                        <MaterialIcons
                            name={isSportsCourt ? "sports-soccer" : "sports-esports"}
                            size={24}
                            color={isSportsCourt ? COLORS.success : COLORS.accent}
                        />
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
                    {effectiveRateLabel && (
                        <View style={styles.priceTag}>
                            <Text style={styles.priceText}>{effectiveRateLabel}</Text>
                        </View>
                    )}
                </View>

                {/* Tags */}
                <View style={styles.tagsRow}>
                    {/* Venue type badge */}
                    <View style={[styles.tag, isSportsCourt && { borderColor: 'rgba(0, 230, 118, 0.3)', backgroundColor: 'rgba(0, 230, 118, 0.05)' }]}>
                        <Text style={[styles.tagText, isSportsCourt && { color: COLORS.success }]}>
                            {isHybrid ? 'Hybrid' : isSportsCourt ? 'Court' : 'Zone'}
                        </Text>
                    </View>
                    {/* Show selected game if filtered */}
                    {internalSelectedGame !== 'all' && (
                        <View style={styles.tag}>
                            <Text style={styles.tagText}>{internalSelectedGame.toUpperCase()}</Text>
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
    const filterBleedStyle = edgePadding ? { marginHorizontal: -edgePadding, paddingHorizontal: edgePadding } : null;
    const filterScrollStyle = edgePadding ? { marginHorizontal: -edgePadding } : null;
    const filterContentStyle = edgePadding ? { paddingHorizontal: edgePadding } : null;

    // Render filter row helper (consistent with other tabs)
    const renderFilterRow = (label: string, options: string[], selected: string, onSelect: (val: string) => void) => (
        <View style={filterStyles.filterSection}>
            <Text style={filterStyles.filterLabel}>{label}</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={filterStyles.filterOptionsScroll}
                contentContainerStyle={filterStyles.filterOptionsContent}
            >
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
            {/* Collapsible Filters - Always show venue type filter */}
            <View>
                <TouchableOpacity
                    onPress={() => setFiltersExpanded(!filtersExpanded)}
                    activeOpacity={0.7}
                    style={[filterStyles.filterToggleRow, filterBleedStyle]}
                >
                    <Text style={filterStyles.filterToggleText}>Filters</Text>
                    <MaterialIcons
                        name={filtersExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                        size={20}
                        color={COLORS.muted}
                    />
                </TouchableOpacity>

                {filtersExpanded && (
                    <View style={{ maxHeight: 350 }}>
                        <ScrollView
                            showsVerticalScrollIndicator={true}
                            style={filterScrollStyle || undefined}
                            contentContainerStyle={[filterStyles.filtersPanel, filterContentStyle || undefined]}
                        >
                            {renderFilterRow('Location', PROXIMITY_OPTIONS, selectedProximity, setSelectedProximity)}

                            {selectedVenueType !== 'all' && (
                                <View style={filterStyles.filterSection}>
                                    <Text style={filterStyles.filterLabel}>
                                        {selectedVenueType === 'zones' ? 'Game' : 'Sport'}
                                    </Text>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        style={filterStyles.filterOptionsScroll}
                                        contentContainerStyle={filterStyles.filterOptionsContent}
                                    >
                                        {getGamesForVenueType().map(game => (
                                            <TouchableOpacity
                                                key={game.key}
                                                onPress={() => setInternalSelectedGame(game.key)}
                                                style={[filterStyles.optionChip, internalSelectedGame === game.key && filterStyles.optionChipActive]}
                                            >
                                                <Text style={[filterStyles.optionChipText, internalSelectedGame === game.key && filterStyles.optionChipTextActive]}>
                                                    {game.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                )}
            </View>

            <View style={styles.resultsCount}>
                <Text style={styles.resultsCountText}>
                    {filteredZones.length} venue{filteredZones.length !== 1 ? 's' : ''} found
                </Text>
            </View>

            <FlatList
                data={filteredZones}
                renderItem={renderZoneItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding ?? 24 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <MaterialIcons name="store-mall-directory" size={48} color={COLORS.muted} style={styles.emptyIcon} />
                        <Text style={styles.emptyTitle}>No Venues Found</Text>
                        <Text style={styles.emptySubtitle}>
                            Try adjusting your filters or search query.
                        </Text>
                    </View>
                }
            />
        </View>
    );
}
