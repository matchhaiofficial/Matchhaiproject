import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { AppBottomSheet, AppModalBody, AppModalFooter, AppModalHeader } from "./AppModalPrimitives";
import { AppButton } from "./AppPrimitives";
import { COLORS, FONTS, RADII, SPACING } from "../theme";

type ReportIssueModalProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  reasons: string[];
  reason: string;
  description: string;
  onChangeReason: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  loading?: boolean;
  submitLabel?: string;
  descriptionPlaceholder?: string;
  maxDescriptionLength?: number;
  targetLabel?: string;
  targetOptions?: Array<{ value: string; label: string; description?: string }>;
  targetValue?: string;
  onChangeTarget?: (value: string) => void;
};

export default function ReportIssueModal({
  visible,
  title,
  subtitle,
  reasons,
  reason,
  description,
  onChangeReason,
  onChangeDescription,
  onSubmit,
  onClose,
  loading = false,
  submitLabel = "Submit Report",
  descriptionPlaceholder = "Provide more context to help our moderators...",
  maxDescriptionLength = 1000,
  targetLabel,
  targetOptions,
  targetValue,
  onChangeTarget,
}: ReportIssueModalProps) {
  const showTargetSelector = Boolean(targetLabel && targetOptions?.length && onChangeTarget);
  const { height: windowHeight } = useWindowDimensions();
  // Leave space for header/footer so the ScrollView always has visible height.
  const maxBodyHeight = Math.max(220, Math.floor(windowHeight * 0.55));

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      dismissDisabled={loading}
      sheetStyle={styles.content}
    >
      <AppModalHeader
        title={title}
        subtitle={subtitle}
        onClose={onClose}
        closeDisabled={loading}
      />

      <AppModalBody
        scroll
        style={[styles.body, { maxHeight: maxBodyHeight }]}
        contentContainerStyle={styles.bodyContent}
      >
        {showTargetSelector ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>{targetLabel}</Text>
            <Text style={styles.sectionHint}>Choose the specific branch this report is about.</Text>
            <View style={styles.reasonWrap}>
              {targetOptions!.map((item) => {
                const active = targetValue === item.value;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => onChangeTarget!(item.value)}
                    style={[styles.targetChip, active && styles.targetChipActive]}
                    disabled={loading}
                  >
                    <Text style={[styles.reasonText, active && styles.reasonTextActive]}>
                      {item.label}
                    </Text>
                    {item.description ? (
                      <Text style={[styles.targetDescription, active && styles.targetDescriptionActive]}>
                        {item.description}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Reason</Text>
          <Text style={styles.sectionHint}>Choose the issue that best matches what happened.</Text>
          <View style={styles.reasonWrap}>
            {reasons.map((item) => {
              const active = reason === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => onChangeReason(item)}
                  style={[styles.reasonChip, active && styles.reasonChipActive]}
                  disabled={loading}
                >
                  <Text style={[styles.reasonText, active && styles.reasonTextActive]}>
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>Details</Text>
            <Text style={styles.counter}>
              {description.length}/{maxDescriptionLength}
            </Text>
          </View>
          <Text style={styles.sectionHint}>Add relevant context so moderation can review it faster.</Text>
          <TextInput
            value={description}
            onChangeText={(value) => onChangeDescription(value.slice(0, maxDescriptionLength))}
            placeholder={descriptionPlaceholder}
            placeholderTextColor={COLORS.muted}
            style={styles.input}
            editable={!loading}
            multiline
            textAlignVertical="top"
            maxLength={maxDescriptionLength}
          />
        </View>
      </AppModalBody>

      <AppModalFooter style={styles.footer} compactBottomInset>
        <View style={styles.actionsRow}>
          <AppButton
            onPress={onClose}
            variant="secondary"
            style={styles.actionButton}
            disabled={loading}
          >
            Cancel
          </AppButton>
          <AppButton
            onPress={onSubmit}
            variant="danger"
            style={[styles.actionButton, styles.submitBtn, (!reason || loading) && styles.submitBtnDisabled]}
            disabled={!reason || loading}
            loading={loading}
          >
            {submitLabel}
          </AppButton>
        </View>
      </AppModalFooter>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    maxHeight: "90%",
  },
  body: {
    // Height is capped inline to keep footer visible while allowing scroll.
  },
  bodyContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.md,
  },
  sectionCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  sectionLabel: {
    color: COLORS.text,
    fontFamily: FONTS.interSemiBold,
    fontSize: 13,
  },
  sectionHint: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interRegular,
    fontSize: 12,
    lineHeight: 18,
  },
  reasonWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: 2,
  },
  reasonChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.overlayLight,
  },
  reasonChipActive: {
    backgroundColor: "rgba(239,83,80,0.16)",
    borderColor: "rgba(239,83,80,0.55)",
  },
  targetChip: {
    maxWidth: "100%",
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.overlayLight,
    gap: 2,
  },
  targetChipActive: {
    backgroundColor: "rgba(239,83,80,0.16)",
    borderColor: "rgba(239,83,80,0.55)",
  },
  targetDescription: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interRegular,
    fontSize: 11,
  },
  targetDescriptionActive: {
    color: COLORS.text,
  },
  reasonText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interMedium,
    fontSize: 13,
  },
  reasonTextActive: {
    color: COLORS.text,
  },
  input: {
    minHeight: 140,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.backgroundDark,
    color: COLORS.text,
    padding: SPACING.md,
    fontFamily: FONTS.martelRegular,
    fontSize: 14,
    marginTop: 2,
  },
  counter: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interRegular,
    fontSize: 11,
  },
  footer: {
    paddingHorizontal: SPACING.xl,
  },
  actionsRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  actionButton: {
    flex: 1,
  },
  submitBtn: {
    minHeight: 50,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
});
