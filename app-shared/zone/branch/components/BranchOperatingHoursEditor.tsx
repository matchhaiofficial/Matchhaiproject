import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

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

type ActivePicker =
  | { kind: "time"; dayOfWeek: number; field: "openTime" | "closeTime" }
  | { kind: "date"; exceptionIndex: number }
  | null;

const dateForClock = (clock: string) => {
  const [hours, minutes] = String(clock || "09:00").split(":").map(Number);
  const date = new Date();
  date.setHours(Number.isFinite(hours) ? hours : 9, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return date;
};

const formatClock = (date: Date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

const displayClock = (clock: string) => dateForClock(clock).toLocaleTimeString([], {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

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
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);
  const [pickerValue, setPickerValue] = useState(new Date());
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
  const openTimePicker = (dayOfWeek: number, field: "openTime" | "closeTime", clock: string) => {
    setPickerValue(dateForClock(clock));
    setActivePicker({ kind: "time", dayOfWeek, field });
  };
  const openDatePicker = (exceptionIndex: number, date: string) => {
    const parsed = new Date(`${date}T12:00:00`);
    setPickerValue(Number.isNaN(parsed.getTime()) ? new Date() : parsed);
    setActivePicker({ kind: "date", exceptionIndex });
  };
  const commitPicker = (selected: Date) => {
    if (!activePicker) return;
    if (activePicker.kind === "time") {
      updateDay(activePicker.dayOfWeek, { [activePicker.field]: formatClock(selected) });
    } else {
      updateException(activePicker.exceptionIndex, { date: selected.toISOString().slice(0, 10) });
    }
    setActivePicker(null);
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
              <Pressable
                accessibilityLabel={`${BRANCH_WEEKDAYS[day.dayOfWeek]} opening time`}
                style={styles.timeInput}
                accessibilityRole="button"
                onPress={() => openTimePicker(day.dayOfWeek, "openTime", day.openTime)}
              ><Text style={styles.timeText}>{displayClock(day.openTime)}</Text></Pressable>
              <Text style={styles.toLabel}>to</Text>
              <Pressable
                accessibilityLabel={`${BRANCH_WEEKDAYS[day.dayOfWeek]} closing time`}
                style={styles.timeInput}
                accessibilityRole="button"
                onPress={() => openTimePicker(day.dayOfWeek, "closeTime", day.closeTime)}
              ><Text style={styles.timeText}>{displayClock(day.closeTime)}</Text></Pressable>
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
          <Pressable
            accessibilityLabel="Closure date"
            style={[styles.timeInput, styles.dateInput]}
            accessibilityRole="button"
            onPress={() => openDatePicker(index, exception.date)}
          ><Text style={styles.timeText}>{exception.date}</Text></Pressable>
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

      <Modal visible={Boolean(activePicker)} transparent animationType="fade" onRequestClose={() => setActivePicker(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setActivePicker(null)}>
          <Pressable style={styles.pickerCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.subtitle}>{activePicker?.kind === "date" ? "Select closure date" : "Select time"}</Text>
            <DateTimePicker
              value={pickerValue}
              mode={activePicker?.kind === "date" ? "date" : "time"}
              display={Platform.OS === "ios" ? "spinner" : "default"}
              minimumDate={activePicker?.kind === "date" ? new Date() : undefined}
              onChange={(_event, selected) => {
                if (!selected) {
                  if (Platform.OS === "android") setActivePicker(null);
                  return;
                }
                setPickerValue(selected);
                if (Platform.OS === "android") commitPicker(selected);
              }}
            />
            {Platform.OS === "ios" ? (
              <View style={styles.pickerActions}>
                <AppButton variant="secondary" onPress={() => setActivePicker(null)}>Cancel</AppButton>
                <AppButton onPress={() => commitPicker(pickerValue)}>Done</AppButton>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
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
  timeText: { color: COLORS.text, fontFamily: FONTS.body, fontSize: 12, lineHeight: 36, textAlign: "center" },
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
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "center", padding: SPACING.lg },
  pickerCard: { backgroundColor: COLORS.cardDark, borderColor: COLORS.cardBorder, borderRadius: RADII.lg, borderWidth: 1, padding: SPACING.lg },
  pickerActions: { flexDirection: "row", justifyContent: "flex-end", gap: SPACING.sm, marginTop: SPACING.md },
});
