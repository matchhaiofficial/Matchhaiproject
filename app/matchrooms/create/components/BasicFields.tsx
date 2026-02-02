import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
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

    // Helper to parse ISO date string YYYY-MM-DD to Date object
    const parseDate = (dateStr: string) => {
        if (!dateStr) return new Date();
        // Expect ISO format; fallback to current date if invalid
        const parsed = new Date(`${dateStr}T00:00`);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
    };

    // Helper to parse time string HH:MM to Date object
    const parseTime = (timeStr: string) => {
        if (!timeStr) return new Date();
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(hours);
        date.setMinutes(minutes);
        return date;
    };

    // Helper to format 24h HH:mm to 12h HH:mm AM/PM
    const formatTimeForDisplay = (time24: string) => {
        if (!time24) return '';
        const [hours, minutes] = time24.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;
        return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
    };

    const handleDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(false);
        if (selectedDate) {
            const day = String(selectedDate.getDate()).padStart(2, '0');
            const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const year = selectedDate.getFullYear();
            const iso = `${year}-${month}-${day}`;
            onChange('date', iso);
        }
    };

    const handleTimeChange = (event: any, selectedTime?: Date) => {
        setShowTimePicker(false);
        if (selectedTime) {
            const hours = String(selectedTime.getHours()).padStart(2, '0');
            const minutes = String(selectedTime.getMinutes()).padStart(2, '0');
            // Store as 24h for backend consistency
            onChange('time', `${hours}:${minutes}`);
        }
    };

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

            {/* Date and Time (CS2 & Others) */}
            <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                    Date & Time<Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <View style={styles.tabContainer}>
                    <View style={[styles.inputBox, styles.flex1]}>
                        <Pressable
                            onPress={() => setShowDatePicker(true)}
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
                            onPress={() => setShowTimePicker(true)}
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

            {showDatePicker && (
                <DateTimePicker
                    value={parseDate(formData.date)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChange}
                    minimumDate={minimumDate || new Date()}
                />
            )}

            {showTimePicker && (
                <DateTimePicker
                    value={parseTime(formData.time)}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleTimeChange}
                    is24Hour={false}
                />
            )}

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
