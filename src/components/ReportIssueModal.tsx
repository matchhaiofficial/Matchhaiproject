import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
}: ReportIssueModalProps) {
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
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
      >
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

      <AppModalFooter style={styles.footer}>
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
    maxHeight: 480,
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
