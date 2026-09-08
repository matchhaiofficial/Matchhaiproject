import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  BRANCH_WEEKDAYS,
  type BranchOperatingHours,
  createDefaultBranchOperatingHours,
  validateBranchOperatingHours,
} from "../../../../constants/branchOperatingHours";
import { COLORS, FONTS, RADII, SPACING } from "../../../../src/theme";
import { AppButton } from "../../../../src/components/AppPrimitives";

type Props = {
  value: BranchOperatingHours | null;
  onChange: (value: BranchOperatingHours) => void;
};

const normalizeClockInput = (value: string) =>
  value.replace(/[^0-9:]/g, "").slice(0, 5);

function getNextKarachiDate(existingDates: Set<string>) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).map((part) => [part.type, part.value]),
  );
  const cursor = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`);
  do cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (existingDates.has(cursor.toISOString().slice(0, 10)));
  return cursor.toISOString().slice(0, 10);
}

export default function BranchOperatingHoursEditor({ value, onChange }: Props) {
  if (!value) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Operating hours</Text>
        <Text style={styles.description}>
          Not configured. Existing bookings remain unrestricted until you add a schedule.
        </Text>
        <AppButton onPress={() => onChange(createDefaultBranchOperatingHours())}>
          Configure Hours
        </AppButton>
      </View>
    );
  }

  const validationError = validateBranchOperatingHours(value);
  const updateDay = (dayOfWeek: number, updates: Record<string, unknown>) => {
    onChange({
      ...value,
      weekly: value.weekly.map((day) =>
        day.dayOfWeek === dayOfWeek ? { ...day, ...updates } : day,
      ),
    });
  };
  const updateException = (index: number, updates: Record<string, unknown>) => {
    onChange({
      ...value,
      exceptions: (value.exceptions || []).map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...updates } : item,
      ),
    });
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Operating hours</Text>
      <Text style={styles.description}>
        Timezone: Asia/Karachi. Equal opening and closing times mean open 24 hours; an earlier closing time means overnight.
      </Text>

      {value.weekly.map((day) => (
        <View key={day.dayOfWeek} style={styles.dayRow}>
          <Text style={styles.dayLabel}>{BRANCH_WEEKDAYS[day.dayOfWeek].slice(0, 3)}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => updateDay(day.dayOfWeek, { isClosed: !day.isClosed })}
            style={[styles.statusChip, day.isClosed && styles.closedChip]}
          >
            <Text style={styles.statusText}>{day.isClosed ? "Closed" : "Open"}</Text>
          </Pressable>
          {!day.isClosed ? (
            <>
              <TextInput
                accessibilityLabel={`${BRANCH_WEEKDAYS[day.dayOfWeek]} opening time`}
                style={styles.timeInput}
                value={day.openTime}
                onChangeText={(openTime) => updateDay(day.dayOfWeek, { openTime: normalizeClockInput(openTime) })}
                placeholder="09:00"
                placeholderTextColor={COLORS.muted}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
              <Text style={styles.toLabel}>to</Text>
              <TextInput
                accessibilityLabel={`${BRANCH_WEEKDAYS[day.dayOfWeek]} closing time`}
                style={styles.timeInput}
                value={day.closeTime}
                onChangeText={(closeTime) => updateDay(day.dayOfWeek, { closeTime: normalizeClockInput(closeTime) })}
                placeholder="23:00"
                placeholderTextColor={COLORS.muted}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </>
          ) : null}
        </View>
      ))}

      <View style={styles.exceptionHeader}>
        <View style={styles.flex1}>
          <Text style={styles.subtitle}>Exceptional closures</Text>
          <Text style={styles.description}>Add holidays, maintenance, or private-event dates.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            const exceptions = value.exceptions || [];
            if (exceptions.length >= 31) return;
            onChange({
              ...value,
              exceptions: [
                ...exceptions,
                {
                  date: getNextKarachiDate(new Set(exceptions.map((item) => item.date))),
                  isClosed: true,
                  label: "Closed",
                },
              ],
            });
          }}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>Add date</Text>
        </Pressable>
      </View>

      {(value.exceptions || []).map((exception, index) => (
        <View key={`${exception.date}-${index}`} style={styles.exceptionRow}>
          <TextInput
            accessibilityLabel="Closure date"
            style={[styles.timeInput, styles.dateInput]}
            value={exception.date}
            onChangeText={(date) => updateException(index, { date: date.slice(0, 10) })}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={COLORS.muted}
            maxLength={10}
          />
          <TextInput
            accessibilityLabel="Closure reason"
            style={[styles.timeInput, styles.flex1]}
            value={exception.label || ""}
            onChangeText={(label) => updateException(index, { label: label.slice(0, 60) })}
            placeholder="Reason"
            placeholderTextColor={COLORS.muted}
            maxLength={60}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove closure on ${exception.date}`}
            onPress={() => onChange({
              ...value,
              exceptions: (value.exceptions || []).filter((_, itemIndex) => itemIndex !== index),
            })}
            style={styles.removeButton}
          >
            <Text style={styles.removeButtonText}>Remove</Text>
          </Pressable>
        </View>
      ))}

      {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardDark,
    borderColor: COLORS.cardBorder,
    borderRadius: RADII.lg,
    borderWidth: 1,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
    padding: SPACING.md,
  },
  title: { color: COLORS.text, fontFamily: FONTS.heading, fontSize: 17 },
  subtitle: { color: COLORS.text, fontFamily: FONTS.heading, fontSize: 14 },
  description: { color: COLORS.muted, fontFamily: FONTS.body, fontSize: 12, lineHeight: 18 },
  dayRow: { alignItems: "center", flexDirection: "row", gap: 8, minHeight: 42 },
  dayLabel: { color: COLORS.text, fontFamily: FONTS.heading, width: 34 },
  statusChip: { backgroundColor: COLORS.success, borderRadius: RADII.md, paddingHorizontal: 9, paddingVertical: 7, width: 62 },
  closedChip: { backgroundColor: COLORS.inputBackground },
  statusText: { color: COLORS.text, fontFamily: FONTS.body, fontSize: 12, textAlign: "center" },
  timeInput: { backgroundColor: COLORS.inputBackground, borderColor: COLORS.inputBorder, borderRadius: RADII.md, borderWidth: 1, color: COLORS.text, minHeight: 38, paddingHorizontal: 9 },
  toLabel: { color: COLORS.muted, fontSize: 12 },
  exceptionHeader: { alignItems: "center", flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md },
  exceptionRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  addButton: { borderColor: COLORS.accent, borderRadius: RADII.md, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  addButtonText: { color: COLORS.accent, fontFamily: FONTS.heading, fontSize: 12 },
  removeButton: { paddingHorizontal: 4, paddingVertical: 8 },
  removeButtonText: { color: COLORS.error, fontFamily: FONTS.body, fontSize: 11 },
  dateInput: { width: 108 },
  flex1: { flex: 1 },
  errorText: { color: COLORS.error, fontFamily: FONTS.body, fontSize: 12 },
});
