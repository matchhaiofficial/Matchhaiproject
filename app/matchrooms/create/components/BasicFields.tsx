import React, { useMemo, useState } from 'react';
import { Modal, Pressable, Text, TextInput, TouchableWithoutFeedback, View } from 'react-native';
import styles from '../create.styles';

interface BasicFieldsProps {
    formData: Record<string, any>;
    onChange: (field: string, value: any) => void;
    selectedGame?: string;
    minimumDate?: Date;
    dateHelperText?: string;
}

export default function BasicFields({ formData, onChange, selectedGame, minimumDate, dateHelperText }: BasicFieldsProps) {
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [dateDraft, setDateDraft] = useState<Date | null>(null);
    const [monthCursor, setMonthCursor] = useState<Date>(() => {
        const base = minimumDate ? new Date(minimumDate) : new Date();
        base.setDate(1);
        base.setHours(0, 0, 0, 0);
        return base;
    });
    const [timeDraft, setTimeDraft] = useState<{ hour: number; minute: number; period: 'AM' | 'PM' }>({
        hour: 12,
        minute: 0,
        period: 'AM',
    });

    // Helper to parse ISO date string YYYY-MM-DD to Date object
    const parseDate = (dateStr: string) => {
        if (!dateStr) return null;
        const parsed = new Date(`${dateStr}T00:00`);
        return isNaN(parsed.getTime()) ? null : parsed;
    };

    // Helper to format 24h HH:mm to 12h HH:mm AM/PM
    const formatTimeForDisplay = (time24: string) => {
        if (!time24) return '';
        const [hours, minutes] = time24.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;
        return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
    };

    const minDate = useMemo(() => {
        const base = minimumDate ? new Date(minimumDate) : new Date();
        base.setHours(0, 0, 0, 0);
        return base;
    }, [minimumDate]);

    const parseTimeToDraft = (timeStr: string | undefined) => {
        if (!timeStr) return { hour: 12, minute: 0, period: 'AM' as const };
        const [h24, m] = timeStr.split(':').map(Number);
        const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
        const hour12 = h24 % 12 || 12;
        return { hour: hour12, minute: m || 0, period };
    };

    const draftToTimeString = (draft: { hour: number; minute: number; period: 'AM' | 'PM' }) => {
        const h12 = draft.hour % 12;
        const h24 = draft.period === 'PM' ? h12 + 12 : h12;
        const hours = String(h24).padStart(2, '0');
        const minutes = String(draft.minute).padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    const hours12 = useMemo(() => Array.from({ length: 12 }).map((_, i) => i + 1), []);
    const minutes = useMemo(() => [0, 30], []);
    const periods: Array<'AM' | 'PM'> = ['AM', 'PM'];

    const monthYearLabel = useMemo(() => {
        return monthCursor.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    }, [monthCursor]);

    const daysInMonth = useMemo(() => {
        return new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
    }, [monthCursor]);

    const firstWeekday = useMemo(() => {
        return new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1).getDay();
    }, [monthCursor]);

    const isBeforeMin = (date: Date) => date.getTime() < minDate.getTime();
    const isSameDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();

    return (
        <>
            {/* Title */}
            <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                    Match Title<Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <View style={styles.inputBox}>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g., Competitive 5v5"
                        placeholderTextColor="#757575"
                        value={formData.title || ''}
                        onChangeText={(text) => onChange('title', text)}
                    />
                </View>
            </View>

            {/* Description */}
            <View style={styles.section}>
                <Text style={styles.sectionLabel}>Description (Optional)</Text>
                <View style={styles.inputBox}>
                    <TextInput
                        style={[styles.input, { minHeight: 60 }]}
                        placeholder="Add any special rules or requirements..."
                        placeholderTextColor="#757575"
                        value={formData.description || ''}
                        onChangeText={(text) => onChange('description', text)}
                        multiline
                        numberOfLines={3}
                    />
                </View>
            </View>

            {/* Date and Time */}
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
                                        const [y, m, d] = formData.date.split('-');
                                        return d && m && y ? `${d}/${m}/${y}` : formData.date;
                                    })()
                                    : 'DD/MM/YYYY'}
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
                                {formData.time ? formatTimeForDisplay(formData.time) : 'HH:MM'}
                            </Text>
                        </Pressable>
                    </View>
                </View>
                {!!dateHelperText && (
                    <Text style={styles.helperTextTiny}>{dateHelperText}</Text>
                )}
            </View>

            <Modal
                visible={showDatePicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDatePicker(false)}
            >
                <View style={styles.pickerOverlay}>
                    <TouchableWithoutFeedback onPress={() => setShowDatePicker(false)}>
                        <View style={styles.pickerBackdrop} />
                    </TouchableWithoutFeedback>
                    <View style={styles.pickerSheet}>
                        <View style={styles.pickerHandle} />
                        <View style={styles.pickerHeader}>
                            <Pressable onPress={() => setShowDatePicker(false)}>
                                <Text style={styles.pickerAction}>Cancel</Text>
                            </Pressable>
                            <Text style={styles.pickerTitle}>Select Date</Text>
                            <Pressable
                                onPress={() => {
                                    if (dateDraft) {
                                        const day = String(dateDraft.getDate()).padStart(2, '0');
                                        const month = String(dateDraft.getMonth() + 1).padStart(2, '0');
                                        const year = dateDraft.getFullYear();
                                        onChange('date', `${year}-${month}-${day}`);
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
                                    <Text style={styles.calendarNavText}>{'‹'}</Text>
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
                                    <Text style={styles.calendarNavText}>{'›'}</Text>
                                </Pressable>
                            </View>
                            <View style={styles.weekdayRow}>
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
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
                    </View>
                </View>
            </Modal>

            <Modal
                visible={showTimePicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowTimePicker(false)}
            >
                <View style={styles.pickerOverlay}>
                    <TouchableWithoutFeedback onPress={() => setShowTimePicker(false)}>
                        <View style={styles.pickerBackdrop} />
                    </TouchableWithoutFeedback>
                    <View style={styles.pickerSheet}>
                        <View style={styles.pickerHandle} />
                        <View style={styles.pickerHeader}>
                            <Pressable onPress={() => setShowTimePicker(false)}>
                                <Text style={styles.pickerAction}>Cancel</Text>
                            </Pressable>
                            <Text style={styles.pickerTitle}>Select Time</Text>
                            <Pressable
                                onPress={() => {
                                    onChange('time', draftToTimeString(timeDraft));
                                    setShowTimePicker(false);
                                }}
                            >
                                <Text style={styles.pickerAction}>Done</Text>
                            </Pressable>
                        </View>
                        <View style={styles.timePickerRow}>
                            <View style={styles.timeColumn}>
                                {hours12.map((h) => {
                                    const selected = timeDraft.hour === h;
                                    return (
                                        <Pressable
                                            key={`h-${h}`}
                                            style={[styles.timeOption, selected && styles.timeOptionActive]}
                                            onPress={() => setTimeDraft(prev => ({ ...prev, hour: h }))}
                                        >
                                            <Text style={[styles.timeOptionText, selected && styles.timeOptionTextActive]}>
                                                {String(h).padStart(2, '0')}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                            <View style={styles.timeColumn}>
                                {minutes.map((m) => {
                                    const selected = timeDraft.minute === m;
                                    return (
                                        <Pressable
                                            key={`m-${m}`}
                                            style={[styles.timeOption, selected && styles.timeOptionActive]}
                                            onPress={() => setTimeDraft(prev => ({ ...prev, minute: m }))}
                                        >
                                            <Text style={[styles.timeOptionText, selected && styles.timeOptionTextActive]}>
                                                {String(m).padStart(2, '0')}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                            <View style={styles.timeColumn}>
                                {periods.map((p) => {
                                    const selected = timeDraft.period === p;
                                    return (
                                        <Pressable
                                            key={`p-${p}`}
                                            style={[styles.timeOption, selected && styles.timeOptionActive]}
                                            onPress={() => setTimeDraft(prev => ({ ...prev, period: p }))}
                                        >
                                            <Text style={[styles.timeOptionText, selected && styles.timeOptionTextActive]}>
                                                {p}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Max Players - Hidden for CS2 & FC26 */}
            {selectedGame !== 'cs2' && selectedGame !== 'fc26' && (
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>
                        Max Players<Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <View style={styles.inputBox}>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g., 10"
                            placeholderTextColor="#757575"
                            value={formData.maxPlayers ? String(formData.maxPlayers) : ''}
                            onChangeText={(text) => onChange('maxPlayers', text ? parseInt(text, 10) : '')}
                            keyboardType="number-pad"
                        />
                    </View>
                </View>
            )}


        </>
    );
}
