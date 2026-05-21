import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import {
  AppBottomSheet,
  AppModalBody,
  AppModalFooter,
  AppModalHeader,
} from "../../../src/components/AppModalPrimitives";
import { AppIcon } from "../../../src/components/AppIcon";
import { AppButton } from "../../../src/components/AppPrimitives";
import { COLORS, FONTS, RADII, SPACING, TEXT_SIZES } from "../../../src/theme";

type TeamOption = {
  team: "A" | "B";
  availableCount: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  joining: boolean;
  styles: any;
  teamA: TeamOption;
  teamB: TeamOption;
  onSelectTeam: (team: "A" | "B") => void;
};

function TeamChoice({
  option,
  joining,
  onSelect,
}: {
  option: TeamOption;
  joining: boolean;
  onSelect: (team: "A" | "B") => void;
}) {
  const disabled = joining || option.availableCount <= 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onSelect(option.team)}
      style={({ pressed }) => [
        localStyles.teamChoice,
        disabled && localStyles.teamChoiceDisabled,
        pressed && localStyles.teamChoicePressed,
      ]}
    >
      <View style={localStyles.teamIcon}>
        <AppIcon name="groups" size={22} color={COLORS.accent} />
      </View>
      <View style={localStyles.teamTextWrap}>
        <Text style={localStyles.teamTitle}>Join Team {option.team}</Text>
        <Text style={localStyles.teamMeta}>
          {option.availableCount > 0
            ? `${option.availableCount} empty slot${option.availableCount === 1 ? "" : "s"} available`
            : "No empty slots available"}
        </Text>
      </View>
      {joining ? (
        <ActivityIndicator color={COLORS.accent} />
      ) : (
        <AppIcon name="chevron-right" size={22} color={disabled ? COLORS.muted : COLORS.accent} />
      )}
    </Pressable>
  );
}

export function MatchroomJoinTeamSheet({
  visible,
  onClose,
  joining,
  styles,
  teamA,
  teamB,
  onSelectTeam,
}: Props) {
  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      dismissDisabled={joining}
      sheetStyle={styles.modalContent}
    >
      <AppModalHeader
        title="Choose Team"
        subtitle="Pick which side you want to request."
        onClose={onClose}
      />
      <AppModalBody contentContainerStyle={localStyles.bodyContent}>
        <View style={localStyles.options}>
          <TeamChoice option={teamA} joining={joining} onSelect={onSelectTeam} />
          <TeamChoice option={teamB} joining={joining} onSelect={onSelectTeam} />
        </View>
      </AppModalBody>
      <AppModalFooter style={styles.modalFooter}>
        <AppButton variant="secondary" onPress={onClose}>
          Cancel
        </AppButton>
      </AppModalFooter>
    </AppBottomSheet>
  );
}

const localStyles = StyleSheet.create({
  bodyContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  options: {
    gap: SPACING.md,
  },
  teamChoice: {
    minHeight: 78,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.overlayLight,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  teamChoicePressed: {
    opacity: 0.9,
    transform: [{ scale: 0.992 }],
  },
  teamChoiceDisabled: {
    opacity: 0.5,
  },
  teamIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(66, 165, 245, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(66, 165, 245, 0.28)",
  },
  teamTextWrap: {
    flex: 1,
  },
  teamTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.body,
    fontWeight: "700",
  },
  teamMeta: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
    marginTop: 4,
  },
});
