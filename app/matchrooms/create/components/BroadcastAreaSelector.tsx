// app/matchrooms/create/components/BroadcastAreaSelector.tsx
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { UserProfile } from '../../../../src/services/userService';
import { COLORS, FONTS } from '../../../../src/theme';
import styles from '../create.styles';

interface BroadcastAreaSelectorProps {
    profile: UserProfile | null;
    selectedAreas?: string[];
    onAreasChange?: (areas: string[]) => void;
}

export default function BroadcastAreaSelector({
    profile,
    selectedAreas = [],
    onAreasChange,
}: BroadcastAreaSelectorProps) {
    const preferredAreas = profile?.areasPreferred || [];
    const [localSelectedAreas, setLocalSelectedAreas] = useState<string[]>(selectedAreas);
    const [newArea, setNewArea] = useState('');

    // Initialize with preferred areas if no areas are selected
    useEffect(() => {
        if (localSelectedAreas.length === 0 && preferredAreas.length > 0) {
            const initialAreas = [...preferredAreas];
            setLocalSelectedAreas(initialAreas);
            onAreasChange?.(initialAreas);
        }
    }, []);

    const toggleArea = (area: string) => {
        const updated = localSelectedAreas.includes(area)
            ? localSelectedAreas.filter(a => a !== area)
            : [...localSelectedAreas, area];
        setLocalSelectedAreas(updated);
        onAreasChange?.(updated);
    };

    const addTemporaryArea = () => {
        const trimmed = newArea.trim();
        if (trimmed && !localSelectedAreas.includes(trimmed)) {
            const updated = [...localSelectedAreas, trimmed];
            setLocalSelectedAreas(updated);
            onAreasChange?.(updated);
            setNewArea('');
        }
    };

    return (
        <>
            <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                    Broadcasting To Areas
                </Text>

                {preferredAreas.length > 0 ? (
                    <>
                        <Text style={{ color: COLORS.muted, fontSize: 12, marginBottom: 8, fontFamily: FONTS.interRegular }}>
                            Tap to toggle areas for this broadcast
                        </Text>
                        <View style={styles.chipRow}>
                            {preferredAreas.map((area: string, index: number) => {
                                const isSelected = localSelectedAreas.includes(area);
                                return (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.optionChip,
                                            isSelected && styles.optionChipActive
                                        ]}
                                        onPress={() => toggleArea(area)}
                                    >
                                        <MaterialIcons
                                            name={isSelected ? "check-circle" : "place"}
                                            size={14}
                                            color={isSelected ? COLORS.accent : COLORS.muted}
                                            style={{ marginRight: 4 }}
                                        />
                                        <Text style={[
                                            styles.optionChipText,
                                            isSelected && styles.optionChipTextActive
                                        ]}>
                                            {area}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </>
                ) : (
                    <Text style={[styles.optionChipText, { marginTop: 8 }]}>
                        No preferred areas set in your profile
                    </Text>
                )}

                {/* Add temporary area */}
                <View style={{ marginTop: 12 }}>
                    <Text style={{ color: COLORS.muted, fontSize: 12, marginBottom: 8, fontFamily: FONTS.interRegular }}>
                        Add a temporary area (for this match only)
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <View style={[styles.inputBox, { flex: 1 }]}>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g., Bahria Town"
                                placeholderTextColor="#757575"
                                value={newArea}
                                onChangeText={setNewArea}
                                onSubmitEditing={addTemporaryArea}
                            />
                        </View>
                        <TouchableOpacity
                            style={[
                                styles.optionChip,
                                styles.optionChipActive,
                                { paddingHorizontal: 16 }
                            ]}
                            onPress={addTemporaryArea}
                        >
                            <MaterialIcons name="add" size={18} color={COLORS.text} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Show additional areas if any */}
                {localSelectedAreas.some(a => !preferredAreas.includes(a)) && (
                    <View style={{ marginTop: 12 }}>
                        <Text style={{ color: COLORS.muted, fontSize: 11, marginBottom: 6 }}>
                            Additional areas:
                        </Text>
                        <View style={styles.chipRow}>
                            {localSelectedAreas
                                .filter(a => !preferredAreas.includes(a))
                                .map((area, index) => (
                                    <View key={index} style={[styles.optionChip, styles.optionChipActive]}>
                                        <Text style={[styles.optionChipText, styles.optionChipTextActive]}>
                                            {area}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => toggleArea(area)}
                                            style={{ marginLeft: 4 }}
                                        >
                                            <MaterialIcons name="close" size={14} color={COLORS.text} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                        </View>
                    </View>
                )}
            </View>

            <View style={styles.section}>
                <View style={{
                    backgroundColor: 'rgba(66, 165, 245, 0.1)',
                    padding: 12,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: 'rgba(66, 165, 245, 0.3)',
                    marginTop: 8
                }}>
                    <Text style={{ color: COLORS.text, fontSize: 13, fontFamily: FONTS.interMedium, lineHeight: 18 }}>
                        <Text style={{ fontWeight: 'bold' }}>Note: </Text>
                        Broadcast sent! Please wait for zone/court admins to send you offers.
                    </Text>
                </View>
            </View>
        </>
    );
}
