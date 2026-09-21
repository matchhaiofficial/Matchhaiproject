import React from "react";
import { Text, View } from "react-native";

import { AppIcon } from "../../../../src/components/AppIcon";
import { AppModalBody, AppModalHeader, AppPickerSheet } from "../../../../src/components/AppModalPrimitives";
import { Team } from "../../../../src/services/convex/teamService";
import { COLORS, FONTS } from "../../../../src/theme";
import { MotionPressable } from "./MotionPressable";
import styles from "../create.styles";

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

    const selectedTeam = teams.find((t) => t.id === selectedTeamId);

    return (
        <View style={styles.section}>
            <Text style={styles.sectionLabel}>Select Team</Text>

            <MotionPressable
                style={styles.inputBox}
                onPress={() => setShowModal(true)}
            >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 }}>
                    <Text style={[styles.input, { paddingVertical: 0 }]}>
                        {selectedTeam ? selectedTeam.name : "Choose a team..."}
                    </Text>
                    <AppIcon name="arrow-drop-down" size={24} color={COLORS.muted} />
                </View>
            </MotionPressable>

            {selectedTeam && (
                <View style={{ marginTop: 8 }}>
                    <Text style={[styles.optionChipText, { fontSize: 12 }]}>
                        {selectedTeam.captainUid === currentUserId ? "You are Captain" : "You are Member"} • {selectedTeam.memberCount || 0} members
                    </Text>
                </View>
            )}

            <AppPickerSheet
                visible={showModal}
                onClose={() => setShowModal(false)}
                sheetStyle={{ maxHeight: "72%" }}
            >
                <AppModalHeader title="Select Team" onClose={() => setShowModal(false)} compact />

                <AppModalBody scroll contentContainerStyle={{ paddingTop: 12, paddingBottom: 8 }}>
                    {teams.map((team) => (
                        <MotionPressable
                            key={team.id}
                            style={{
                                padding: 16,
                                borderBottomWidth: 1,
                                borderBottomColor: COLORS.inputBorder,
                                backgroundColor: selectedTeamId === team.id ? COLORS.overlayLight : "transparent",
                            }}
                            onPress={() => {
                                onSelectTeam(team.id!);
                                setShowModal(false);
                            }}
                        >
                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontFamily: FONTS.montserratBold, fontSize: 16, color: COLORS.text }}>
                                        {team.name}
                                    </Text>
                                    <Text style={{ fontFamily: FONTS.martelRegular, fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
                                        {team.captainUid === currentUserId ? "Captain" : "Member"} • {team.memberCount || 0} members
                                    </Text>
                                </View>
                                {selectedTeamId === team.id && (
                                    <AppIcon name="check-circle" size={24} color={COLORS.accent} />
                                )}
                            </View>
                        </MotionPressable>
                    ))}
                </AppModalBody>
            </AppPickerSheet>
        </View>
    );
}
