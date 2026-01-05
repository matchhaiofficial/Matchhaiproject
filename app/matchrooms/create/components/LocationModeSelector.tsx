// app/matchrooms/create/components/LocationModeSelector.tsx
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../../../src/theme';
import styles from '../create.styles';

interface LocationModeSelectorProps {
    locationMode: 'zone' | 'broadcast';
    onModeChange: (mode: 'zone' | 'broadcast') => void;
}

export default function LocationModeSelector({ locationMode, onModeChange }: LocationModeSelectorProps) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionLabel}>Location Mode</Text>
            <View style={styles.chipRow}>
                <TouchableOpacity
                    style={[styles.optionChip, locationMode === 'zone' && styles.optionChipActive]}
                    onPress={() => onModeChange('zone')}
                >
                    <MaterialIcons
                        name="place"
                        size={16}
                        color={locationMode === 'zone' ? COLORS.text : COLORS.muted}
                        style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.optionChipText, locationMode === 'zone' && styles.optionChipTextActive]}>
                        Specific Zone
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.optionChip, locationMode === 'broadcast' && styles.optionChipActive]}
                    onPress={() => onModeChange('broadcast')}
                >
                    <MaterialIcons
                        name="broadcast-on-personal"
                        size={16}
                        color={locationMode === 'broadcast' ? COLORS.text : COLORS.muted}
                        style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.optionChipText, locationMode === 'broadcast' && styles.optionChipTextActive]}>
                        Broadcast to Areas
                    </Text>
                </TouchableOpacity>
            </View>

            {locationMode === 'broadcast' && (
                <Text style={[styles.optionChipText, { marginTop: 8, fontSize: 12 }]}>
                    Zone admins in your preferred areas will send you offers
                </Text>
            )}
        </View>
    );
}
