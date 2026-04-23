import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Text, TextInput, View } from "react-native";

import { getGameFields } from "../../../../constants/matchConfig";
import {
  FC_FORMATIONS,
  FC_LEAGUES,
  INDOOR_CRICKET_COMPOSITIONS,
  TEKKEN_CHARACTERS,
} from "../../../../constants/profileOptions";
import { AppIcon } from "../../../../src/components/AppIcon";
import {
  AppModalHeader,
  AppPickerSheet,
} from "../../../../src/components/AppModalPrimitives";
import { COLORS, FONTS } from "../../../../src/theme";
import { MotionPressable } from "./MotionPressable";
import styles from "../create.styles";

interface GameDynamicFieldsProps {
  gameKey: string;
  formData: Record<string, any>;
  onChange: (field: string, value: any) => void;
  scope?: "global" | "player";
}

type ModalType =
  | "formation"
  | "club_league"
  | "club_team"
  | "tekken_character"
  | "futsal_formation"
  | "indoorCricketComposition"
  | null;

const INPUT_PICKER_ROW_STYLE = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
};

const START_ALIGNED_CHIP_ROW_STYLE = { justifyContent: "flex-start" as const };
const COMPOSITION_INFO_STYLE = {
  marginTop: 12,
  padding: 12,
  backgroundColor: "rgba(66, 165, 245, 0.1)",
  borderRadius: 8,
  borderWidth: 1,
  borderColor: "rgba(66, 165, 245, 0.3)",
};
const COMPOSITION_TITLE_STYLE = {
  color: COLORS.text,
  fontSize: 12,
  fontFamily: FONTS.interMedium,
  marginBottom: 4,
};
const COMPOSITION_TEXT_STYLE = {
  color: COLORS.muted,
  fontSize: 11,
  fontFamily: FONTS.interRegular,
};
const COMPOSITION_HELPER_STYLE = {
  color: COLORS.muted,
  fontSize: 12,
  marginBottom: 8,
  fontFamily: FONTS.interRegular,
};
const MUTED_PLACEHOLDER_STYLE = { color: "#757575" };

const SelectionChip = React.memo(function SelectionChip({
  label,
  isSelected,
  onPress,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <MotionPressable
      style={[styles.optionChip, isSelected && styles.optionChipActive]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.optionChipText,
          isSelected && styles.optionChipTextActive,
        ]}
      >
        {label}
      </Text>
    </MotionPressable>
  );
});

const ModalRow = React.memo(function ModalRow({
  label,
  subtitle,
  selected,
  onPress,
  showChevron = false,
}: {
  label: string;
  subtitle?: string | null;
  selected?: boolean;
  onPress: () => void;
  showChevron?: boolean;
}) {
  return (
    <MotionPressable style={styles.modalItem} onPress={onPress}>
      <View style={styles.flex1}>
        <Text
          style={[
            styles.modalItemText,
            selected && styles.modalItemTextActive,
          ]}
        >
          {label}
        </Text>
        {subtitle ? <Text style={styles.modalItemSubtitle}>{subtitle}</Text> : null}
      </View>
      {showChevron ? (
        <AppIcon name="chevron-right" size={24} color={COLORS.muted} />
      ) : selected ? (
        <AppIcon name="check" size={20} color={COLORS.accent} />
      ) : null}
    </MotionPressable>
  );
});

export default function GameDynamicFields({
  gameKey,
  formData,
  onChange,
  scope = "global",
}: GameDynamicFieldsProps) {
  const fields: any = getGameFields(gameKey as any);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const listKeyExtractor = useCallback(
    (item: any, index: number) =>
      typeof item === "string" ? item : String(item?.id ?? item?.name ?? index),
    [],
  );

  const openModal = useCallback((type: ModalType) => {
    setModalType(type);
    setSearchQuery("");
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setModalType(null);
  }, []);

  const selectedComposition = useMemo(
    () =>
      INDOOR_CRICKET_COMPOSITIONS.find(
        (composition) => composition.name === formData.composition,
      ),
    [formData.composition],
  );

  const renderChips = useCallback(
    (
      label: string,
      fieldKey: string,
      options: string[],
      multiSelect = false,
    ) => {
      if (!options) return null;
      return (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {label}
            {fieldKey === "format" ? (
              <Text style={styles.requiredAsterisk}>*</Text>
            ) : null}
          </Text>
          <View style={styles.chipRow}>
            {options.map((option) => {
              const isSelected = multiSelect
                ? (formData[fieldKey] || []).includes(option)
                : formData[fieldKey] === option;
              return (
                <SelectionChip
                  key={option}
                  label={option}
                  isSelected={isSelected}
                  onPress={() => {
                    if (multiSelect) {
                      const current = formData[fieldKey] || [];
                      onChange(
                        fieldKey,
                        current.includes(option)
                          ? current.filter((value: string) => value !== option)
                          : [...current, option],
                      );
                      return;
                    }
                    onChange(fieldKey, option);
                  }}
                />
              );
            })}
          </View>
        </View>
      );
    },
    [formData, onChange],
  );

  if (!fields) return null;

  const renderModalContent = () => {
    let title = "";
    let data: readonly any[] = [];
    let renderItem:
      | ((info: { item: any; index: number }) => React.ReactElement)
      | null = null;

    if (modalType === "formation") {
      title = "Select Formation";
      data = [...FC_FORMATIONS];
      renderItem = ({ item }: { item: string; index: number }) => (
        <ModalRow
          label={item}
          selected={formData.formation === item}
          onPress={() => {
            onChange("formation", item);
            closeModal();
          }}
        />
      );
    } else if (modalType === "club_league") {
      title = "Select League";
      data = [...FC_LEAGUES];
      renderItem = ({ item }: { item: any; index: number }) => (
        <ModalRow
          label={item.name}
          showChevron
          onPress={() => {
            setSelectedLeagueId(item.id);
            setModalType("club_team");
          }}
        />
      );
    } else if (modalType === "club_team") {
      const league = FC_LEAGUES.find((item) => item.id === selectedLeagueId);
      title = league ? `${league.name} Teams` : "Select Team";
      data = league ? [...league.teams] : [];

      if (searchQuery) {
        data = data.filter((team: string) =>
          team.toLowerCase().includes(searchQuery.toLowerCase()),
        );
      }

      renderItem = ({ item }: { item: string; index: number }) => (
        <ModalRow
          label={item}
          selected={formData.favouriteClub === item}
          onPress={() => {
            onChange("favouriteClub", item);
            closeModal();
          }}
        />
      );
    } else if (modalType === "indoorCricketComposition") {
      title = "Select Team Composition";
      data = [...INDOOR_CRICKET_COMPOSITIONS];
      renderItem = ({ item }: { item: any; index: number }) => (
        <ModalRow
          label={item.name}
          subtitle={item.description}
          selected={formData.composition === item.name}
          onPress={() => {
            onChange("composition", item.name);
            closeModal();
          }}
        />
      );
    } else if (modalType === "tekken_character") {
      title = "Select Character";
      data = [...TEKKEN_CHARACTERS];

      if (searchQuery) {
        data = data.filter((character: string) =>
          character.toLowerCase().includes(searchQuery.toLowerCase()),
        );
      }

      renderItem = ({ item }: { item: string; index: number }) => (
        <ModalRow
          label={item}
          selected={formData.character === item}
          onPress={() => {
            onChange("character", item);
            closeModal();
          }}
        />
      );
    }

    return (
      <>
        <AppModalHeader title={title} onClose={closeModal} compact />

        {(modalType === "club_team" || modalType === "tekken_character") && (
          <View style={styles.modalSearchBox}>
            <AppIcon name="search" size={20} color={COLORS.muted} />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search..."
              placeholderTextColor={COLORS.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        )}

        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={listKeyExtractor}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      </>
    );
  };

  const modalSheet = (
    <AppPickerSheet
      visible={modalVisible}
      onClose={closeModal}
      sheetStyle={styles.modalContainer}
    >
      {renderModalContent()}
    </AppPickerSheet>
  );

  if (gameKey === "fc26") {
    return (
      <>
        {scope === "global" && renderChips("Format", "format", fields.formats, false)}

        {scope === "player" && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                Favourite Club <Text style={styles.helperTextTiny}>(Optional)</Text>
              </Text>
              <MotionPressable
                style={[styles.inputBox, styles.inputPicker]}
                onPress={() => openModal("club_league")}
              >
                <Text
                  style={[
                    styles.input,
                    !formData.favouriteClub && styles.mutedText,
                  ]}
                >
                  {formData.favouriteClub || "Select Club"}
                </Text>
                <AppIcon name="arrow-drop-down" size={24} color={COLORS.muted} />
              </MotionPressable>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                Preferred Formation{" "}
                <Text style={styles.helperTextTiny}>(Optional)</Text>
              </Text>
              <MotionPressable
                style={[styles.inputBox, INPUT_PICKER_ROW_STYLE]}
                onPress={() => openModal("formation")}
              >
                <Text
                  style={[styles.input, !formData.formation && MUTED_PLACEHOLDER_STYLE]}
                >
                  {formData.formation || "Select Formation"}
                </Text>
                <AppIcon name="arrow-drop-down" size={24} color={COLORS.muted} />
              </MotionPressable>
            </View>
          </>
        )}

        {modalSheet}
      </>
    );
  }

  if (gameKey === "tekken8") {
    return (
      <>
        {scope === "global" && renderChips("Format", "format", fields.formats, false)}

        {scope === "player" && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              Preferred Character{" "}
              <Text style={styles.helperTextTiny}>(Optional)</Text>
            </Text>
            <MotionPressable
              style={[styles.inputBox, INPUT_PICKER_ROW_STYLE]}
              onPress={() => openModal("tekken_character")}
            >
              <Text
                style={[styles.input, !formData.character && MUTED_PLACEHOLDER_STYLE]}
              >
                {formData.character || "Select Character"}
              </Text>
              <AppIcon name="arrow-drop-down" size={24} color={COLORS.muted} />
            </MotionPressable>
          </View>
        )}

        {modalSheet}
      </>
    );
  }

  if (gameKey === "indoor_cricket") {
    return (
      <>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Format</Text>
          <View style={[styles.chipRow, START_ALIGNED_CHIP_ROW_STYLE]}>
            <View style={[styles.optionChip, styles.optionChipActive]}>
              <Text style={[styles.optionChipText, styles.optionChipTextActive]}>
                8-a-side (16 players)
              </Text>
            </View>
          </View>
        </View>

        {renderChips("Overs", "overs", fields.overs.map(String), false)}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Series Type</Text>
          <View style={[styles.chipRow, START_ALIGNED_CHIP_ROW_STYLE]}>
            <View style={[styles.optionChip, styles.optionChipActive]}>
              <Text style={[styles.optionChipText, styles.optionChipTextActive]}>
                Best of 3
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Team Composition</Text>
          <Text style={COMPOSITION_HELPER_STYLE}>
            Define the team structure to ensure balanced matches
          </Text>

          <MotionPressable
            style={[styles.inputBox, INPUT_PICKER_ROW_STYLE]}
            onPress={() => openModal("indoorCricketComposition")}
          >
            <Text
              style={[styles.input, !formData.composition && MUTED_PLACEHOLDER_STYLE]}
            >
              {formData.composition || "Select Composition"}
            </Text>
            <AppIcon name="arrow-drop-down" size={24} color={COLORS.muted} />
          </MotionPressable>

          {selectedComposition && (
            <View style={COMPOSITION_INFO_STYLE}>
              <Text style={COMPOSITION_TITLE_STYLE}>
                {selectedComposition.description}
              </Text>
              <Text style={COMPOSITION_TEXT_STYLE}>
                Required{" "}
                {Object.entries(selectedComposition.positions || {})
                  .filter(([_, count]) => (count as number) > 0)
                  .map(
                    ([position, count]) =>
                      `${count as number} ${position}${(count as number) > 1 ? "s" : ""}`,
                  )
                  .join(", ")}
              </Text>
            </View>
          )}
        </View>

        {modalSheet}
      </>
    );
  }

  if (gameKey === "padel") {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>
          Format<Text style={styles.requiredAsterisk}>*</Text>
        </Text>
        <View style={[styles.chipRow, START_ALIGNED_CHIP_ROW_STYLE]}>
          <View style={[styles.optionChip, styles.optionChipActive]}>
            <Text style={[styles.optionChipText, styles.optionChipTextActive]}>
              2v2 (Doubles)
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (gameKey === "pickleball") {
    return <>{renderChips("Format", "format", fields.formats, false)}</>;
  }

  return null;
}
