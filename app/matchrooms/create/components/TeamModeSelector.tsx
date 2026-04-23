import React from "react";
import { Text, View } from "react-native";

import { AppIcon } from "../../../../src/components/AppIcon";
import { COLORS } from "../../../../src/theme";
import { MotionPressable } from "./MotionPressable";
import styles from "../create.styles";

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
                <MotionPressable
                    style={[styles.optionChip, teamMode === 'team' && styles.optionChipActive]}
                    onPress={() => onModeChange('team')}
                >
                    <AppIcon
                        name="groups"
                        size={16}
                        color={teamMode === 'team' ? COLORS.text : COLORS.muted}
                        style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.optionChipText, teamMode === 'team' && styles.optionChipTextActive]}>
                        My Team
                    </Text>
                </MotionPressable>

                <MotionPressable
                    style={[styles.optionChip, teamMode === 'solo' && styles.optionChipActive]}
                    onPress={() => onModeChange('solo')}
                >
                    <AppIcon
                        name="person"
                        size={16}
                        color={teamMode === 'solo' ? COLORS.text : COLORS.muted}
                        style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.optionChipText, teamMode === 'solo' && styles.optionChipTextActive]}>
                        Solo / Ad-Hoc Stack
                    </Text>
                </MotionPressable>
            </View>
        </View>
    );
}
