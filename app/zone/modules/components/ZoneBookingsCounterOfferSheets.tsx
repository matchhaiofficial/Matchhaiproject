import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { AppIcon } from "../../../../src/components/AppIcon";
import {
  AppBottomSheet,
  AppModalBody,
  AppModalFooter,
  AppModalHeader,
  AppPickerSheet,
} from "../../../../src/components/AppModalPrimitives";
import { isSameDay } from "../hooks/useZoneBookingsViewModel";
import { AppButton } from "../../../../src/components/AppPrimitives";
import styles from "../bookings.styles";

type CounterOption = {
  date: string;
  time: string;
  endTime?: string;
};

type TimeDraft = {
  hour: number;
  minute: number;
  period: "AM" | "PM";
};

const HOURS_12 = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = [0, 15, 30, 45];
const PERIODS = ["AM", "PM"] as const;

const draftToTimeString = (draft: TimeDraft) =>
  `${String(draft.hour).padStart(2, "0")}:${String(draft.minute).padStart(2, "0")} ${draft.period}`;

const formatDateForDisplay = (value?: string) => {
  if (!value) return "DD/MM/YYYY";
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
};

const formatTimeForDisplay = (value?: string) => value || "HH:MM";

type Props = {
  showCounterModal: boolean;
  setShowCounterModal: React.Dispatch<React.SetStateAction<boolean>>;
  processingAction: "accept" | "reject" | "counter" | null;
  counterOptions: CounterOption[];
  setCounterOptions: React.Dispatch<React.SetStateAction<CounterOption[]>>;
  createDefaultScheduleOption: () => CounterOption;
  removeCounterOption: (index: number) => void;
  handleCounterOffer: () => void;
  showDatePicker: boolean;
  setShowDatePicker: React.Dispatch<React.SetStateAction<boolean>>;
  showTimePicker: boolean;
  setShowTimePicker: React.Dispatch<React.SetStateAction<boolean>>;
  editingOptionIndex: number | null;
  setEditingOptionIndex: React.Dispatch<React.SetStateAction<number | null>>;
  dateDraft: Date | null;
  setDateDraft: React.Dispatch<React.SetStateAction<Date | null>>;
  monthCursor: Date;
  setMonthCursor: React.Dispatch<React.SetStateAction<Date>>;
  timeDraft: TimeDraft;
  setTimeDraft: React.Dispatch<React.SetStateAction<TimeDraft>>;
  updateCounterOption: (index: number, patch: Partial<CounterOption>) => void;
  minDate: Date;
  firstWeekday: number;
  daysInMonth: number;
  monthYearLabel: string;
  parseTimeToDraft: (value?: string | null) => TimeDraft;
  editingTimeField: "start" | "end";
  setEditingTimeField: React.Dispatch<React.SetStateAction<"start" | "end">>;
  validationMessage?: string;
};

export function ZoneBookingsCounterOfferSheets({
  showCounterModal,
  setShowCounterModal,
  processingAction,
  counterOptions,
  setCounterOptions,
  createDefaultScheduleOption,
  removeCounterOption,
  handleCounterOffer,
  showDatePicker,
  setShowDatePicker,
  showTimePicker,
  setShowTimePicker,
  editingOptionIndex,
  setEditingOptionIndex,
  dateDraft,
  setDateDraft,
  monthCursor,
  setMonthCursor,
  timeDraft,
  setTimeDraft,
  updateCounterOption,
  minDate,
  firstWeekday,
  daysInMonth,
  monthYearLabel,
  parseTimeToDraft,
  editingTimeField,
  setEditingTimeField,
  validationMessage,
}: Props) {
  const option = counterOptions[0] || createDefaultScheduleOption();
  const canSend = processingAction === null && !validationMessage;

  return (
    <>
      <AppBottomSheet
        visible={showCounterModal}
        onClose={() => setShowCounterModal(false)}
        dismissDisabled={processingAction !== null}
        sheetStyle={styles.modalContent}
      >
        <AppModalHeader
          title="Suggest Alternative"
          subtitle="Send one adjusted booking time"
          onClose={() => setShowCounterModal(false)}
          closeDisabled={processingAction !== null}
        />

        <AppModalBody
          scroll
          style={styles.counterForm}
          contentContainerStyle={styles.counterFormContent}
        >
            <View style={styles.scheduleOptionCard}>
              <Text style={styles.formLabel}>Date</Text>
                <Pressable
                  style={styles.dateField}
                  onPress={() => {
                    setEditingOptionIndex(0);
                    const nextDate = option.date ? new Date(`${option.date}T00:00:00`) : new Date();
                    setDateDraft(nextDate);
                    setMonthCursor(nextDate);
                    setShowDatePicker(true);
                  }}
                >
                  <AppIcon name="calendar-month" size="sm" tone="accent" />
                  <Text style={styles.dateFieldText}>{formatDateForDisplay(option.date)}</Text>
                </Pressable>

              <View style={styles.dateRow}>
                <View style={styles.halfInput}>
                  <Text style={styles.formLabel}>Starting booking time</Text>
                <Pressable
                  style={styles.dateField}
                  onPress={() => {
                    setEditingOptionIndex(0);
                    setEditingTimeField("start");
                    setTimeDraft(parseTimeToDraft(option.time));
                    setShowTimePicker(true);
                  }}
                >
                  <AppIcon name="schedule" size="sm" tone="accent" />
                  <Text style={styles.dateFieldText}>{formatTimeForDisplay(option.time)}</Text>
                </Pressable>
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.formLabel}>Ending booking time</Text>
                  <Pressable
                    style={styles.dateField}
                    onPress={() => {
                      setEditingOptionIndex(0);
                      setEditingTimeField("end");
                      setTimeDraft(parseTimeToDraft(option.endTime));
                      setShowTimePicker(true);
                    }}
                  >
                    <AppIcon name="clock" size="sm" tone="accent" />
                    <Text style={styles.dateFieldText}>{formatTimeForDisplay(option.endTime)}</Text>
                  </Pressable>
                </View>
              </View>
            </View>

          <Text style={styles.emptyText}>
            Captains will get this alternative in their inbox and have 2 hours to respond.
          </Text>
          {validationMessage ? (
            <Text style={styles.validationText}>{validationMessage}</Text>
          ) : null}
        </AppModalBody>

        <AppModalFooter style={styles.counterFooter}>
          <View style={styles.modalActionsRow}>
            <AppButton
              variant="secondary"
              style={styles.modalActionButton}
              onPress={() => setShowCounterModal(false)}
              disabled={processingAction !== null}
            >
              Cancel
            </AppButton>
            <AppButton
              style={styles.modalActionButton}
              loading={processingAction === "counter"}
              disabled={!canSend}
              onPress={handleCounterOffer}
            >
              Send
            </AppButton>
          </View>
        </AppModalFooter>
      </AppBottomSheet>

      <AppPickerSheet
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        sheetStyle={styles.pickerSheet}
      >
        <View style={styles.pickerHeader}>
          <Pressable onPress={() => setShowDatePicker(false)}>
            <Text style={styles.pickerAction}>Cancel</Text>
          </Pressable>
          <Text style={styles.pickerTitle}>Select Date</Text>
          <Pressable
            onPress={() => {
              if (editingOptionIndex !== null && dateDraft) {
                const day = String(dateDraft.getDate()).padStart(2, "0");
                const month = String(dateDraft.getMonth() + 1).padStart(2, "0");
                const year = dateDraft.getFullYear();
                updateCounterOption(editingOptionIndex, { date: `${year}-${month}-${day}` });
              }
              setShowDatePicker(false);
            }}
          >
            <Text style={styles.pickerAction}>Done</Text>
          </Pressable>
        </View>
        <View style={styles.calendarContainer}>
          <View style={styles.calendarHeader}>
            <Pressable
              style={styles.calendarNavButton}
              onPress={() => {
                const prev = new Date(monthCursor);
                prev.setMonth(prev.getMonth() - 1);
                const minMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
                if (prev.getTime() >= minMonth.getTime()) {
                  setMonthCursor(prev);
                }
              }}
            >
              <Text style={styles.calendarNavText}>{"<"}</Text>
            </Pressable>
            <Text style={styles.calendarTitle}>{monthYearLabel}</Text>
            <Pressable
              style={styles.calendarNavButton}
              onPress={() => {
                const next = new Date(monthCursor);
                next.setMonth(next.getMonth() + 1);
                setMonthCursor(next);
              }}
            >
              <Text style={styles.calendarNavText}>{">"}</Text>
            </Pressable>
          </View>
          <View style={styles.weekdayRow}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
              <Text key={label} style={styles.weekdayLabel}>
                {label}
              </Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {Array.from({ length: firstWeekday }).map((_, index) => (
              <View key={`empty-${index}`} style={styles.dayCell} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, index) => {
              const dayNumber = index + 1;
              const date = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), dayNumber);
              const disabled = date.getTime() < minDate.getTime();
              const selected = isSameDay(dateDraft, date);
              return (
                <Pressable
                  key={`day-${dayNumber}`}
                  style={[
                    styles.dayCell,
                    selected && styles.dayCellSelected,
                    disabled && { opacity: 0.35 },
                  ]}
                  onPress={() => {
                    if (disabled) return;
                    setDateDraft(date);
                  }}
                >
                  <Text style={[styles.dayText, selected && styles.dayTextSelected]}>
                    {dayNumber}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </AppPickerSheet>

      <AppPickerSheet
        visible={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        sheetStyle={styles.pickerSheet}
      >
        <View style={styles.pickerHeader}>
          <Pressable onPress={() => setShowTimePicker(false)}>
            <Text style={styles.pickerAction}>Cancel</Text>
          </Pressable>
          <Text style={styles.pickerTitle}>Select Time</Text>
          <Pressable
            onPress={() => {
              if (editingOptionIndex !== null) {
                updateCounterOption(
                  editingOptionIndex,
                  editingTimeField === "start"
                    ? { time: draftToTimeString(timeDraft) }
                    : { endTime: draftToTimeString(timeDraft) },
                );
              }
              setShowTimePicker(false);
            }}
          >
            <Text style={styles.pickerAction}>Done</Text>
          </Pressable>
        </View>
        <ScrollView
          style={styles.timePickerScroll}
          contentContainerStyle={styles.timePickerScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.timePickerRow}>
            <View style={styles.timeColumn}>
              {HOURS_12.map((hour) => {
                const selected = timeDraft.hour === hour;
                return (
                  <Pressable
                    key={`h-${hour}`}
                    style={[styles.timeOption, selected && styles.timeOptionActive]}
                    onPress={() => setTimeDraft((prev) => ({ ...prev, hour }))}
                  >
                    <Text style={[styles.timeOptionText, selected && styles.timeOptionTextActive]}>
                      {String(hour).padStart(2, "0")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.timeColumn}>
              {MINUTES.map((minute) => {
                const selected = timeDraft.minute === minute;
                return (
                  <Pressable
                    key={`m-${minute}`}
                    style={[styles.timeOption, selected && styles.timeOptionActive]}
                    onPress={() => setTimeDraft((prev) => ({ ...prev, minute }))}
                  >
                    <Text style={[styles.timeOptionText, selected && styles.timeOptionTextActive]}>
                      {String(minute).padStart(2, "0")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.timeColumn}>
              {PERIODS.map((period) => {
                const selected = timeDraft.period === period;
                return (
                  <Pressable
                    key={`p-${period}`}
                    style={[styles.timeOption, selected && styles.timeOptionActive]}
                    onPress={() => setTimeDraft((prev) => ({ ...prev, period }))}
                  >
                    <Text style={[styles.timeOptionText, selected && styles.timeOptionTextActive]}>
                      {period}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </AppPickerSheet>
    </>
  );
}
