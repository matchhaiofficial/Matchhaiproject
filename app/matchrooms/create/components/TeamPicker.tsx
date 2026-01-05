// app/matchrooms/create/components/TeamPicker.tsx
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Team } from '../../../../src/services/teamService';
import { COLORS } from '../../../../src/theme';
import styles from '../create.styles';

interface TeamPickerProps {
    teams: Team[];
    selectedTeamId: string | null;
    onSelectTeam: (teamId: string) => void;
    currentUserId: string;
}

export default function TeamPicker({ teams, selectedTeamId, onSelectTeam, currentUserId }: TeamPickerProps) {
    const [showModal, setShowModal] = React.useState(false);

    if (teams.length === 0) {
        return (
            <View style={styles.section}>
                <Text style={styles.sectionLabel}>Select Team</Text>
                <Text style={[styles.optionChipText, { marginTop: 8 }]}>
                    You don't have any teams for this game yet.
                </Text>
            </View>
        );
    }

    const selectedTeam = teams.find(t => t.id === selectedTeamId);

    return (
        <View style={styles.section}>
            <Text style={styles.sectionLabel}>Select Team</Text>

            <TouchableOpacity
                style={styles.inputBox}
                onPress={() => setShowModal(true)}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}>
                    <Text style={[styles.input, { paddingVertical: 0 }]}>
                        {selectedTeam ? selectedTeam.name : 'Choose a team...'}
                    </Text>
                    <MaterialIcons name="arrow-drop-down" size={24} color={COLORS.muted} />
                </View>
            </TouchableOpacity>

            {selectedTeam && (
                <View style={{ marginTop: 8 }}>
                    <Text style={[styles.optionChipText, { fontSize: 12 }]}>
                        {selectedTeam.captainUid === currentUserId ? '👑 You are Captain' : '👤 You are Member'} • {selectedTeam.memberCount || 0} members
                    </Text>
                </View>
            )}

            {/* Team Selection Modal */}
            <Modal
                visible={showModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowModal(false)}
            >
                <Pressable
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
                    onPress={() => setShowModal(false)}
                >
                    <View style={{ backgroundColor: COLORS.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%' }}>
                        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.inputBorder }}>
                            <Text style={{ fontFamily: 'Montserrat_700Bold', fontSize: 18, color: COLORS.text }}>
                                Select Team
                            </Text>
                        </View>

                        <ScrollView>
                            {teams.map((team) => (
                                <TouchableOpacity
                                    key={team.id}
                                    style={{
                                        padding: 16,
                                        borderBottomWidth: 1,
                                        borderBottomColor: COLORS.inputBorder,
                                        backgroundColor: selectedTeamId === team.id ? COLORS.overlayLight : 'transparent',
                                    }}
                                    onPress={() => {
                                        onSelectTeam(team.id!);
                                        setShowModal(false);
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontFamily: 'Montserrat_700Bold', fontSize: 16, color: COLORS.text }}>
                                                {team.name}
                                            </Text>
                                            <Text style={{ fontFamily: 'Martel_400Regular', fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
                                                {team.captainUid === currentUserId ? '👑 Captain' : '👤 Member'} • {team.memberCount || 0} members
                                            </Text>
                                        </View>
                                        {selectedTeamId === team.id && (
                                            <MaterialIcons name="check-circle" size={24} color={COLORS.accent} />
                                        )}
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}
