// app/matchrooms/create/components/SlotReservation.tsx
import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { getGameConfig } from '../../../../constants/matchConfig';
import { Team } from '../../../../src/services/convex/teamService';
import styles from '../create.styles';

interface SlotReservationProps {
    gameKey: string;
    selectedTeam: Team | null;
    currentUserId: string;
    reservedSlots: number;
    onSlotsChange: (slots: number) => void;
}

export default function SlotReservation({
    gameKey,
    selectedTeam,
    currentUserId,
    reservedSlots,
    onSlotsChange,
}: SlotReservationProps) {
    if (!selectedTeam) return null;

    const gameConfig = getGameConfig(gameKey as any);
    if (!gameConfig) return null;

    const isCaptain = selectedTeam.captainUid === currentUserId;
    const maxSlots = isCaptain ? gameConfig.captainMaxSlots : gameConfig.memberMaxSlots;

    return (
        <View style={styles.section}>
            <Text style={styles.sectionLabel}>
                Reserved Slots for Team {isCaptain && '(Captain)'}
            </Text>
            <Text style={[styles.optionChipText, { marginBottom: 8, fontSize: 12 }]}>
                {isCaptain
                    ? `As captain, you can reserve up to ${maxSlots} slots for your team.`
                    : `As a member, you can reserve up to ${maxSlots} slots for your team.`
                }
            </Text>

            <View style={styles.inputBox}>
                <TextInput
                    style={styles.input}
                    placeholder={`Max ${maxSlots} slots`}
                    placeholderTextColor="#757575"
                    value={reservedSlots ? String(reservedSlots) : ''}
                    onChangeText={(text) => {
                        const num = parseInt(text, 10);
                        if (isNaN(num)) {
                            onSlotsChange(0);
                        } else {
                            onSlotsChange(Math.min(num, maxSlots));
                        }
                    }}
                    keyboardType="number-pad"
                />
            </View>

            <Text style={[styles.optionChipText, { marginTop: 4, fontSize: 11 }]}>
                Remaining slots will be open to public
            </Text>
        </View>
    );
}
