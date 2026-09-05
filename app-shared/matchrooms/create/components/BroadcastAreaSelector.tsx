import React from "react";
import { Text, View } from "react-native";

import { COLORS, FONTS } from "../../../../src/theme";
import { MotionPressable } from "./MotionPressable";
import styles from "../create.styles";

interface BroadcastAreaSelectorProps {
  availableAreas: string[];
  loading?: boolean;
  preferredAreas?: string[];
  selectedAreas: string[];
  onToggleArea: (area: string) => void;
}

export default function BroadcastAreaSelector({
  availableAreas,
  loading = false,
  preferredAreas = [],
  selectedAreas,
  onToggleArea,
}: BroadcastAreaSelectorProps) {
  const selectedSet = new Set(selectedAreas);
  const hasAvailableAreas = availableAreas.length > 0;
  const hasPreferredAreas = preferredAreas.length > 0;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>
        Broadcast Areas<Text style={styles.requiredAsterisk}>*</Text>
      </Text>
      <Text
        style={{
          color: COLORS.muted,
          fontFamily: FONTS.interRegular,
          fontSize: 12,
          marginBottom: 10,
        }}
      >
        {loading
          ? "Loading eligible areas..."
          : "Select the areas where MatchHai should request venue confirmation when the room becomes full."}
      </Text>

      {!loading && !hasAvailableAreas ? (
        <View
          style={{
            backgroundColor: COLORS.cardBackground,
            borderColor: COLORS.inputBorder,
            borderRadius: 12,
            borderWidth: 1,
            padding: 12,
          }}
        >
          <Text style={styles.helperText}>
            No active venues are currently available for this game. Try another game or switch to direct zone selection.
          </Text>
        </View>
      ) : null}

      {!loading && hasAvailableAreas ? (
        <View style={styles.chipRow}>
          {availableAreas.map((area) => {
            const isSelected = selectedSet.has(area);
            return (
              <MotionPressable
                key={area}
                style={[
                  styles.broadcastAreaChip,
                  isSelected && styles.broadcastAreaChipActive,
                ]}
                onPress={() => onToggleArea(area)}
              >
                <Text
                  style={[
                    styles.broadcastAreaChipText,
                    isSelected && styles.broadcastAreaChipTextActive,
                  ]}
                >
                  {area}
                </Text>
              </MotionPressable>
            );
          })}
        </View>
      ) : null}

      {!loading && hasAvailableAreas && !hasPreferredAreas ? (
        <Text style={[styles.helperText, styles.marginTop8]}>
          You have no preferred areas saved yet, so start by selecting the areas you want to broadcast to.
        </Text>
      ) : null}

      {!loading && hasAvailableAreas && hasPreferredAreas && selectedAreas.length === 0 ? (
        <Text style={[styles.helperText, styles.marginTop8]}>
          Your saved preferred areas are not currently available for this game. Choose from the active areas above.
        </Text>
      ) : null}
    </View>
  );
}
