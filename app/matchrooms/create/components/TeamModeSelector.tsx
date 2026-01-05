// app/matchrooms/create/components/TeamModeSelector.tsx
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../../../src/theme';
import styles from '../create.styles';

interface TeamModeSelectorProps {
    hasTeams: boolean;
    teamMode: 'team' | 'solo';
    onModeChange: (mode: 'team' | 'solo') => void;
}

export default function TeamModeSelector({ hasTeams, teamMode, onModeChange }: TeamModeSelectorProps) {
    if (!hasTeams) return null; // Don't show if user has no teams

    return (
        <View style={styles.section}>
            <Text style={styles.sectionLabel}>Play As</Text>
            <View style={styles.chipRow}>
                <TouchableOpacity
                    style={[styles.optionChip, teamMode === 'team' && styles.optionChipActive]}
                    onPress={() => onModeChange('team')}
                >
                    <MaterialIcons
                        name="groups"
                        size={16}
                        color={teamMode === 'team' ? COLORS.text : COLORS.muted}
                        style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.optionChipText, teamMode === 'team' && styles.optionChipTextActive]}>
                        My Team
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.optionChip, teamMode === 'solo' && styles.optionChipActive]}
                    onPress={() => onModeChange('solo')}
                >
                    <MaterialIcons
                        name="person"
                        size={16}
                        color={teamMode === 'solo' ? COLORS.text : COLORS.muted}
                        style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.optionChipText, teamMode === 'solo' && styles.optionChipTextActive]}>
                        Solo / Ad-Hoc Stack
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
