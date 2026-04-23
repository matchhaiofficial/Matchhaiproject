import React from "react";
import { Text, View } from "react-native";

import { AppIcon } from "../../../../src/components/AppIcon";
import { COLORS } from "../../../../src/theme";
import { MotionPressable } from "./MotionPressable";
import styles from "../create.styles";

interface LocationModeSelectorProps {
    locationMode: 'zone' | 'broadcast';
    onModeChange: (mode: 'zone' | 'broadcast') => void;
}

export default function LocationModeSelector({ locationMode, onModeChange }: LocationModeSelectorProps) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionLabel}>Location Mode</Text>
            <View style={styles.chipRow}>
                <MotionPressable
                    style={[styles.optionChip, locationMode === 'zone' && styles.optionChipActive]}
                    onPress={() => onModeChange('zone')}
                >
                    <View style={styles.inlineChipContent}>
                        <AppIcon
                            name="place"
                            size={16}
                            color={locationMode === 'zone' ? COLORS.text : COLORS.muted}
                        />
                        <Text
                            style={[styles.optionChipText, styles.inlineChipText, locationMode === 'zone' && styles.optionChipTextActive]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                        >
                            Specific Zone
                        </Text>
                    </View>
                </MotionPressable>

                <MotionPressable
                    style={[styles.optionChip, locationMode === 'broadcast' && styles.optionChipActive]}
                    onPress={() => onModeChange('broadcast')}
                >
                    <View style={styles.inlineChipContent}>
                        <AppIcon
                            name="broadcast-on-personal"
                            size={16}
                            color={locationMode === 'broadcast' ? COLORS.text : COLORS.muted}
                        />
                        <Text
                            style={[styles.optionChipText, styles.inlineChipText, locationMode === 'broadcast' && styles.optionChipTextActive]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                        >
                            Broadcast to Areas
                        </Text>
                    </View>
                </MotionPressable>
            </View>

            {locationMode === 'broadcast' && (
                <Text style={[styles.optionChipText, { marginTop: 8, fontSize: 12 }]}>
                    Zone admins in your preferred areas will send you offers
                </Text>
            )}
        </View>
    );
}
