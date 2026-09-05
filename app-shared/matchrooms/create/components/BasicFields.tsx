import React, { useMemo, useState } from "react";
import {
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from "react-native";
import styles from "../create.styles";

interface BasicFieldsProps {
    formData: Record<string, any>;
    onChange: (field: string, value: any) => void;
    selectedGame?: string;
    minimumDate?: Date;
    dateHelperText?: string;
}

export default function BasicFields({ formData, onChange, selectedGame, minimumDate, dateHelperText }: BasicFieldsProps) {
    const { height: windowHeight } = useWindowDimensions();
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [dateDraft, setDateDraft] = useState<Date | null>(null);
    const [monthCursor, setMonthCursor] = useState<Date>(() => {
        const base = minimumDate ? new Date(minimumDate) : new Date();
        base.setDate(1);
        base.setHours(0, 0, 0, 0);
        return base;
    });
    const [timeDraft, setTimeDraft] = useState<{ hour: number; minute: number; period: "AM" | "PM" }>({
        hour: 12,
        minute: 0,
        period: "AM",
    });

    const parseDate = (dateStr: string) => {
        if (!dateStr) return null;
        const parsed = new Date(`${dateStr}T00:00`);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const formatTimeForDisplay = (time24: string) => {
        if (!time24) return "";
        const [hours, minutes] = time24.split(":").map(Number);
        const period = hours >= 12 ? "PM" : "AM";
        const hours12 = hours % 12 || 12;
        return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
    };

    const minDate = useMemo(() => {
        const base = minimumDate ? new Date(minimumDate) : new Date();
        base.setHours(0, 0, 0, 0);
        return base;
    }, [minimumDate]);

    const parseTimeToDraft = (timeStr: string | undefined) => {
        if (!timeStr) return { hour: 12, minute: 0, period: "AM" as const };
        const [h24, m] = timeStr.split(":").map(Number);
        const period: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
        const hour12 = h24 % 12 || 12;
        return { hour: hour12, minute: m || 0, period };
    };

    const draftToTimeString = (draft: { hour: number; minute: number; period: "AM" | "PM" }) => {
        const h12 = draft.hour % 12;
        const h24 = draft.period === "PM" ? h12 + 12 : h12;
        const hours = String(h24).padStart(2, "0");
        const minutes = String(draft.minute).padStart(2, "0");
        return `${hours}:${minutes}`;
    };

    const hours12 = useMemo(() => Array.from({ length: 12 }).map((_, i) => i + 1), []);
    const minutes = useMemo(() => [0, 30], []);
    const periods: Array<"AM" | "PM"> = ["AM", "PM"];

    const monthYearLabel = useMemo(
        () => monthCursor.toLocaleString("en-US", { month: "long", year: "numeric" }),
        [monthCursor]
    );

    const daysInMonth = useMemo(
        () => new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate(),
        [monthCursor]
    );

    const firstWeekday = useMemo(
        () => new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1).getDay(),
        [monthCursor]
    );
    const calendarRows = useMemo(
        () => Math.ceil((firstWeekday + daysInMonth) / 7),
        [daysInMonth, firstWeekday]
    );

    const isBeforeMin = (date: Date) => date.getTime() < minDate.getTime();
    const isSameDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
    const pickerSheetMaxHeight = Math.floor(
        Math.min(windowHeight * 0.9, windowHeight - 24)
    );
    const timePickerSheetHeight = Math.min(
        pickerSheetMaxHeight,
        Math.max(340, 164 + calendarRows * 40)
    );
    const timeColumnMaxHeight = Math.max(144, timePickerSheetHeight - 116);

    return (
        <>
            <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                    Match Title<Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <View style={styles.inputBox}>
                    <TextInput
                        style={styles.input}
                        placeholder="Competitive 5v5"
                        placeholderTextColor="#757575"
                        value={formData.title || ""}
                        onChangeText={(text) => onChange("title", text)}
                    />
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionLabel}>Description (Optional)</Text>
                <View style={styles.inputBox}>
                    <TextInput
                        style={[styles.input, { minHeight: 60 }]}
                        placeholder="Special rules and requirements"
                        placeholderTextColor="#757575"
                        value={formData.description || ""}
                        onChangeText={(text) => onChange("description", text)}
                        multiline
                        numberOfLines={3}
                    />
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                    Date & Time<Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <View style={styles.tabContainer}>
                    <View style={[styles.inputBox, styles.flex1]}>
                        <Pressable
                            onPress={() => {
                                const current = parseDate(formData.date) || minDate;
                                setDateDraft(current);
                                const monthStart = new Date(current);
                                monthStart.setDate(1);
                                monthStart.setHours(0, 0, 0, 0);
                                setMonthCursor(monthStart);
                                setShowDatePicker(true);
                            }}
                            style={styles.flex1Center}
                        >
                            <Text style={[styles.input, !formData.date && styles.mutedText]}>
                                {formData.date
                                    ? (() => {
                                        const [y, m, d] = formData.date.split("-");
                                        return d && m && y ? `${d}/${m}/${y}` : formData.date;
                                    })()
                                    : "DD/MM/YYYY"}
                            </Text>
                        </Pressable>
                    </View>
                    <View style={[styles.inputBox, styles.flex1]}>
                        <Pressable
                            onPress={() => {
                                setTimeDraft(parseTimeToDraft(formData.time));
                                setShowTimePicker(true);
                            }}
                            style={styles.flex1Center}
                        >
                            <Text style={[styles.input, !formData.time && styles.mutedText]}>
                                {formData.time ? formatTimeForDisplay(formData.time) : "HH:MM"}
                            </Text>
                        </Pressable>
                    </View>
                </View>
                {!!dateHelperText && (
                    <Text style={styles.helperTextTiny}>{dateHelperText}</Text>
                )}
            </View>

            {/* ── DATE PICKER ── */}
            <Modal
                visible={showDatePicker}
                transparent
                animationType="slide"
                statusBarTranslucent={Platform.OS === "android"}
                navigationBarTranslucent={false}
                onRequestClose={() => setShowDatePicker(false)}
            >
                <View style={pickerSharedStyles.overlay}>
                    <Pressable
                        style={pickerSharedStyles.backdrop}
                        onPress={() => setShowDatePicker(false)}
                    />
                    <View style={[styles.pickerSheet, pickerSharedStyles.sheet, { maxHeight: pickerSheetMaxHeight }]}>
                        <View style={pickerSharedStyles.handle} />
                        <View style={styles.pickerHeader}>
                            <Pressable onPress={() => setShowDatePicker(false)}>
                                <Text style={styles.pickerAction}>Cancel</Text>
                            </Pressable>
                            <Text style={styles.pickerTitle}>Select Date</Text>
                            <Pressable
                                onPress={() => {
                                    if (dateDraft) {
                                        const day = String(dateDraft.getDate()).padStart(2, "0");
                                        const month = String(dateDraft.getMonth() + 1).padStart(2, "0");
                                        const year = dateDraft.getFullYear();
                                        onChange("date", `${year}-${month}-${day}`);
                                    }
                                    setShowDatePicker(false);
                                }}
                            >
                                <Text style={styles.pickerAction}>Done</Text>
                            </Pressable>
                        </View>
                        <ScrollView
                            bounces={false}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ flexGrow: 1 }}
                        >
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
                                        <Text key={label} style={styles.weekdayLabel}>{label}</Text>
                                    ))}
                                </View>
                                <View style={styles.calendarGrid}>
                                    {Array.from({ length: firstWeekday }).map((_, idx) => (
                                        <View key={`empty-${idx}`} style={styles.dayCell} />
                                    ))}
                                    {Array.from({ length: daysInMonth }).map((_, idx) => {
                                        const dayNumber = idx + 1;
                                        const date = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), dayNumber);
                                        const disabled = isBeforeMin(date);
                                        const selected = dateDraft ? isSameDay(dateDraft, date) : false;
                                        return (
                                            <Pressable
                                                key={`day-${dayNumber}`}
                                                style={[
                                                    styles.dayCell,
                                                    selected && styles.dayCellSelected,
                                                    disabled && styles.dayCellDisabled,
                                                ]}
                                                onPress={() => {
                                                    if (disabled) return;
                                                    setDateDraft(date);
                                                }}
                                            >
                                                <Text
                                                    style={[
                                                        styles.dayText,
                                                        selected && styles.dayTextSelected,
                                                        disabled && styles.dayTextDisabled,
                                                    ]}
                                                >
                                                    {dayNumber}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ── TIME PICKER — same Modal shell as date picker ── */}
            <Modal
                visible={showTimePicker}
                transparent
                animationType="slide"
                statusBarTranslucent={Platform.OS === "android"}
                navigationBarTranslucent={false}
                onRequestClose={() => setShowTimePicker(false)}
            >
                <View style={pickerSharedStyles.overlay}>
                    <Pressable
                        style={pickerSharedStyles.backdrop}
                        onPress={() => setShowTimePicker(false)}
                    />
                    <View
                        style={[
                            styles.pickerSheet,
                            pickerSharedStyles.sheet,
                            { height: timePickerSheetHeight, maxHeight: pickerSheetMaxHeight },
                        ]}
                    >
                        <View style={pickerSharedStyles.handle} />
                        <View style={styles.pickerHeader}>
                            <Pressable onPress={() => setShowTimePicker(false)}>
                                <Text style={styles.pickerAction}>Cancel</Text>
                            </Pressable>
                            <Text style={styles.pickerTitle}>Select Time</Text>
                            <Pressable
                                onPress={() => {
                                    onChange("time", draftToTimeString(timeDraft));
                                    setShowTimePicker(false);
                                }}
                            >
                                <Text style={styles.pickerAction}>Done</Text>
                            </Pressable>
                        </View>

                        {/*
                         * Each column gets its own ScrollView so long lists (hours = 12 rows)
                         * never overflow the sheet. The sheet is capped by the visible window
                         * after reserving the device navigation bar.
                         */}
                        <View style={[styles.timePickerRow, pickerSharedStyles.timePickerRow]}>
                            {/* Hours */}
                            <ScrollView
                                style={[pickerSharedStyles.timeColumnScroll, { maxHeight: timeColumnMaxHeight }]}
                                showsVerticalScrollIndicator={false}
                                bounces={false}
                                contentContainerStyle={pickerSharedStyles.timeColumnContent}
                            >
                                {hours12.map((h) => {
                                    const selected = timeDraft.hour === h;
                                    return (
                                        <Pressable
                                            key={`h-${h}`}
                                            style={[styles.timeOption, selected && styles.timeOptionActive]}
                                            onPress={() => setTimeDraft((prev) => ({ ...prev, hour: h }))}
                                        >
                                            <Text style={[styles.timeOptionText, selected && styles.timeOptionTextActive]}>
                                                {String(h).padStart(2, "0")}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>

                            {/* Minutes */}
                            <ScrollView
                                style={[pickerSharedStyles.timeColumnScroll, { maxHeight: timeColumnMaxHeight }]}
                                showsVerticalScrollIndicator={false}
                                bounces={false}
                                contentContainerStyle={pickerSharedStyles.timeColumnContent}
                            >
                                {minutes.map((m) => {
                                    const selected = timeDraft.minute === m;
                                    return (
                                        <Pressable
                                            key={`m-${m}`}
                                            style={[styles.timeOption, selected && styles.timeOptionActive]}
                                            onPress={() => setTimeDraft((prev) => ({ ...prev, minute: m }))}
                                        >
                                            <Text style={[styles.timeOptionText, selected && styles.timeOptionTextActive]}>
                                                {String(m).padStart(2, "0")}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>

                            {/* AM / PM */}
                            <ScrollView
                                style={[pickerSharedStyles.timeColumnScroll, { maxHeight: timeColumnMaxHeight }]}
                                showsVerticalScrollIndicator={false}
                                bounces={false}
                                contentContainerStyle={pickerSharedStyles.timeColumnContent}
                            >
                                {periods.map((p) => {
                                    const selected = timeDraft.period === p;
                                    return (
                                        <Pressable
                                            key={`p-${p}`}
                                            style={[styles.timeOption, selected && styles.timeOptionActive]}
                                            onPress={() => setTimeDraft((prev) => ({ ...prev, period: p }))}
                                        >
                                            <Text style={[styles.timeOptionText, selected && styles.timeOptionTextActive]}>
                                                {p}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    </View>
                </View>
            </Modal>

            {selectedGame !== "cs2" && selectedGame !== "fc26" && selectedGame !== "tekken8" && (
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>
                        Max Players<Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <View style={styles.inputBox}>
                        <TextInput
                            style={styles.input}
                            placeholder="10"
                            placeholderTextColor="#757575"
                            value={formData.maxPlayers ? String(formData.maxPlayers) : ""}
                            onChangeText={(text) => onChange("maxPlayers", text ? parseInt(text, 10) : "")}
                            keyboardType="number-pad"
                        />
                    </View>
                </View>
            )}
        </>
    );
}

/**
 * Shared shell styles used by both the date picker and time picker modals.
 * Both modals are visually identical: backdrop + bottom sheet capped at 90%.
 */
const pickerSharedStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(0,0,0,0.5)",
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    sheet: {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingBottom: 24,
    },
    handle: {
        alignSelf: "center",
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: "#555",
        marginTop: 8,
        marginBottom: 4,
    },
    /**
     * Each time column scrolls independently so 12 hour-rows never overflow.
     * maxHeight is derived from the real screen height so it scales on every
     * device: 90% sheet cap minus ~120 px for the handle + header + padding.
     */
    timeColumnScroll: {
        flex: 1,
    },
    timePickerRow: {
        flex: 1,
        minHeight: 0,
    },
    timeColumnContent: {
        gap: 8,
        paddingBottom: 4,
    },
});
