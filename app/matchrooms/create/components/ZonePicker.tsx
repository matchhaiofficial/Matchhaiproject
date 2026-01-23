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
    onZoneSelect: (zoneId: string, zoneName: string, hourlyRate: number, ps5HourlyRate?: number) => void;
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

    if (!gameKey) {
        return null;
    }

    if (loading) {
        return (
            <View style={styles.section}>
                <Text style={styles.sectionLabel}>Select Zone</Text>
                <ActivityIndicator color={COLORS.accent} style={styles.marginTop12} />
            </View>
        );
    }

    return (
        <View style={styles.section}>
            <Text style={styles.sectionLabel}>Select Zone</Text>

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
                                onPress={() => onZoneSelect(zone.id, zone.venueBrandName, zone.hourlyRate || 0, zone.ps5HourlyRate)}
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
                                    {zone.effectiveRateLabel ? (
                                        <Text style={styles.zonePrice}>
                                            {zone.effectiveRateLabel}
                                        </Text>
                                    ) : (
                                        <Text style={styles.zoneDetail}>Rate TBD</Text>
                                    )}
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
