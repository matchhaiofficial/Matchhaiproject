// app/matchrooms/create/components/ZonePicker.tsx
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getActiveZones, Zone } from '../../../../src/services/zoneService';
import { COLORS } from '../../../../src/theme';
import styles from '../create.styles';

interface ZonePickerProps {
    gameKey: string | null;
    selectedZoneId?: string | null;
    onZoneSelect: (zone: Zone) => void;
    userPreferredAreas?: string[];
}

export default function ZonePicker({ gameKey, selectedZoneId, onZoneSelect, userPreferredAreas = [] }: ZonePickerProps) {
    const [zones, setZones] = useState<Zone[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (gameKey) {
            loadZones();
        }
    }, [gameKey]);

    const loadZones = async () => {
        setLoading(true);
        const result = await getActiveZones(gameKey || undefined);
        if (result.ok) {
            // Deduplicate zones based on venue name and area label
            const uniqueZones = result.data.filter((zone, index, self) =>
                index === self.findIndex((t) => (
                    t.venueBrandName === zone.venueBrandName &&
                    t.primaryBranch.areaLabel === zone.primaryBranch.areaLabel
                ))
            );

            // Sort zones: Preferred areas first, then alphabetical
            const sortedZones = uniqueZones.sort((a, b) => {
                const aPreferred = userPreferredAreas.some(area => a.primaryBranch.areaLabel?.includes(area));
                const bPreferred = userPreferredAreas.some(area => b.primaryBranch.areaLabel?.includes(area));
                if (aPreferred && !bPreferred) return -1;
                if (!aPreferred && bPreferred) return 1;
                return a.venueBrandName.localeCompare(b.venueBrandName);
            });
            setZones(sortedZones);
        }
        setLoading(false);
    };

    const filteredZones = zones.filter(zone => {
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesName = zone.venueBrandName.toLowerCase().includes(query);
            const matchesArea = zone.primaryBranch.areaLabel?.toLowerCase().includes(query);
            return matchesName || matchesArea;
        }
        return true;
    });

    const getStartingPrice = (zone: Zone) => {
        if (typeof zone.effectiveRate === 'number' && zone.effectiveRate > 0) {
            return zone.effectiveRate;
        }

        const pricing: any = zone.pricing || (zone.branches?.[0] as any)?.pricing;
        if (!pricing) return null;

        const prices: number[] = [];

        if (gameKey === 'cs2') {
            const pc: any = pricing.pc || {};
            (['regular', 'premium', 'elite'] as const).forEach((key) => {
                const price = pc?.[key]?.price;
                if (typeof price === 'number' && price > 0) prices.push(price);
            });
        } else if (gameKey === 'fc26' || gameKey === 'tekken8' || gameKey === 'fc25') {
            const consolePricing: any = pricing.console || {};
            const ps5: any = consolePricing.ps5 || null;
            const xbox: any = consolePricing.xbox || null;
            [ps5?.price1v1, ps5?.price2v2, xbox?.price1v1, xbox?.price2v2].forEach((price) => {
                if (typeof price === 'number' && price > 0) prices.push(price);
            });
        } else if (gameKey === 'futsal') {
            Object.values(pricing.futsal || {}).forEach((entry: any) => {
                if (typeof entry?.price === 'number' && entry.price > 0) prices.push(entry.price);
            });
        } else if (gameKey === 'indoor_cricket') {
            const cricket = pricing.indoorCricket || pricing.indoor_cricket || (pricing as any).indoor_cricket || {};
            Object.values(cricket).forEach((entry: any) => {
                if (typeof entry?.price === 'number' && entry.price > 0) prices.push(entry.price);
            });
        } else if (gameKey === 'padel') {
            Object.values(pricing.padel || {}).forEach((entry: any) => {
                if (typeof entry?.price === 'number' && entry.price > 0) prices.push(entry.price);
            });
        } else if (gameKey === 'pickleball') {
            Object.values(pricing.pickleball || {}).forEach((entry: any) => {
                if (typeof entry?.price === 'number' && entry.price > 0) prices.push(entry.price);
            });
        }

        if (prices.length === 0) return null;
        return Math.min(...prices);
    };

    if (!gameKey) {
        return null;
    }

    if (loading) {
        return (
            <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                    Select Zone<Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <ActivityIndicator color={COLORS.accent} style={styles.marginTop12} />
            </View>
        );
    }

    return (
        <View style={styles.section}>
            <Text style={styles.sectionLabel}>
                Select Zone<Text style={styles.requiredAsterisk}>*</Text>
            </Text>

            {/* Search Input */}
            <View style={[styles.inputBox, { marginBottom: 12, flexDirection: 'row', alignItems: 'center' }]}>
                <MaterialIcons name="search" size={20} color={COLORS.muted} style={{ marginRight: 8 }} />
                <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Search zones..."
                    placeholderTextColor="#757575"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {/* Zone List - Card Style */}
            {filteredZones.length === 0 ? (
                <Text style={styles.noResultsText}>
                    {searchQuery ? 'No zones found' : 'No zones available'}
                </Text>
            ) : (
                <ScrollView style={styles.zoneListScroll} nestedScrollEnabled>
                    {filteredZones.map((zone) => {
                        const isSelected = zone.id === selectedZoneId;
                        return (
                            <TouchableOpacity
                                key={zone.id}
                                style={[
                                    styles.zoneCard,
                                    isSelected && styles.zoneCardActive,
                                ]}
                                onPress={() => onZoneSelect(zone)}
                            >
                                <View style={styles.zoneInfoWrapper}>
                                    <Text style={styles.zoneName} numberOfLines={1} ellipsizeMode="tail">
                                        {zone.venueBrandName}
                                    </Text>
                                    <Text style={styles.zoneDetail} numberOfLines={1} ellipsizeMode="tail">
                                        {zone.primaryBranch.areaLabel}
                                    </Text>
                                </View>
                                <View style={styles.zonePriceWrapper}>
                                    {(() => {
                                        const startPrice = getStartingPrice(zone);
                                        return startPrice ? (
                                            <Text style={styles.zonePrice}>
                                                {`From ₨ ${startPrice}/hr`}
                                            </Text>
                                        ) : (
                                            <Text style={styles.zoneDetail}>Rate TBD</Text>
                                        );
                                    })()}
                                    {isSelected && (
                                        <MaterialIcons name="check-circle" size={16} color={COLORS.accent} style={styles.marginTop4} />
                                    )}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            )}
        </View>
    );
}
