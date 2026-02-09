import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useZoneData } from "../../../src/hooks/useZoneData";
import { updateZone } from "../../../src/services/zoneService";
import { COLORS } from "../../../src/theme";
import Logger from "../../../src/utils/logger";
import styles from "./branch.styles";

export default function BranchDetails() {
    const { id } = useLocalSearchParams(); // "primary" or actual ID
    const { zone, loading } = useZoneData();
    const router = useRouter();

    const [saving, setSaving] = useState(false);

    // Local state for editing
    const [branchName, setBranchName] = useState("");
    const [address, setAddress] = useState("");
    const [city, setCity] = useState("");
    const [area, setArea] = useState("");

    // Capacity state
    const [pcSeats, setPcSeats] = useState("");
    const [consoleSeats, setConsoleSeats] = useState("");
    const [futsalCourts, setFutsalCourts] = useState("");
    const [padelCourts, setPadelCourts] = useState("");

    // Initialize state when zone loads
    useEffect(() => {
        if (zone && id === "primary") {
            Logger.debug('BranchDetails', 'Loading primary branch data', { zoneId: zone.id });
            setBranchName(zone.primaryBranch?.branchDisplayName || "");
            setAddress(zone.primaryBranch?.addressLine1 || "");
            setCity(zone.primaryBranch?.city || "");
            setArea(zone.primaryBranch?.areaLabel || "");

            // Populate capacity
            if (zone.capacity) {
                setPcSeats(zone.capacity.pcSeats || "");
                setConsoleSeats(zone.capacity.consoleSeats || "");
                setFutsalCourts(zone.capacity.futsalCourts || "");
                setPadelCourts(zone.capacity.padelCourts || "");
            }
        }
    }, [zone, id]);

    const handleSave = async () => {
        if (!branchName.trim()) {
            Alert.alert("Error", "Branch name is required");
            return;
        }

        setSaving(true);
        Logger.info('BranchDetails', 'Saving branch updates', { id, branchName });
        try {
            if (id === "primary") {
                // Update primary branch fields in the zone doc
                await updateZone(zone.id, {
                    "primaryBranch.branchDisplayName": branchName.trim(),
                    "primaryBranch.addressLine1": address.trim(),
                    "primaryBranch.city": city.trim(),
                    "primaryBranch.areaLabel": area.trim(),
                    // Update capacities
                    "capacity.pcSeats": pcSeats.trim(),
                    "capacity.consoleSeats": consoleSeats.trim(),
                    "capacity.futsalCourts": futsalCourts.trim(),
                    "capacity.padelCourts": padelCourts.trim(),
                });
                Alert.alert("Success", "Branch updated successfully");
                Logger.info('BranchDetails', 'Branch updated successfully');
                router.back();
            } else {
                // TODO: Handle other branches
                Alert.alert("Error", "Editing other branches not implemented yet");
            }
        } catch (error) {
            Logger.error('BranchDetails', 'Failed to update branch', error);
            Alert.alert("Error", "Failed to update branch");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    if (!zone) return null;

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.flex1}
            >
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
                    </Pressable>
                    <Text style={styles.headerTitle}>
                        {id === "primary" ? "Edit Primary Branch" : "Edit Branch"}
                    </Text>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    {/* Branch Info Section */}
                    <Text style={styles.sectionLabel}>Basic Info</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Branch Name</Text>
                        <TextInput
                            style={styles.input}
                            value={branchName}
                            onChangeText={setBranchName}
                            placeholder="Main Branch"
                            placeholderTextColor={COLORS.muted}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>City</Text>
                        <TextInput
                            style={styles.input}
                            value={city}
                            onChangeText={setCity}
                            placeholder="Karachi"
                            placeholderTextColor={COLORS.muted}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Area</Text>
                        <TextInput
                            style={styles.input}
                            value={area}
                            onChangeText={setArea}
                            placeholder="DHA Phase 6"
                            placeholderTextColor={COLORS.muted}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Address</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={address}
                            onChangeText={setAddress}
                            placeholder="Street 12, Area, City"
                            placeholderTextColor={COLORS.muted}
                            multiline
                            textAlignVertical="top"
                        />
                    </View>

                    {/* Capacity Section */}
                    <Text style={styles.sectionLabel}>Assets & Capacity</Text>

                    <View style={styles.row}>
                        <View style={styles.flex1}>
                            <Text style={styles.inputLabel}>PC Seats</Text>
                            <TextInput
                                style={styles.input}
                                value={pcSeats}
                                onChangeText={setPcSeats}
                                placeholder="0"
                                placeholderTextColor={COLORS.muted}
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={styles.flex1}>
                            <Text style={styles.inputLabel}>Console Seats</Text>
                            <TextInput
                                style={styles.input}
                                value={consoleSeats}
                                onChangeText={setConsoleSeats}
                                placeholder="0"
                                placeholderTextColor={COLORS.muted}
                                keyboardType="numeric"
                            />
                        </View>
                    </View>

                    <View style={styles.row}>
                        <View style={styles.flex1}>
                            <Text style={styles.inputLabel}>Futsal Courts</Text>
                            <TextInput
                                style={styles.input}
                                value={futsalCourts}
                                onChangeText={setFutsalCourts}
                                placeholder="0"
                                placeholderTextColor={COLORS.muted}
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={styles.flex1}>
                            <Text style={styles.inputLabel}>Padel Courts</Text>
                            <TextInput
                                style={styles.input}
                                value={padelCourts}
                                onChangeText={setPadelCourts}
                                placeholder="0"
                                placeholderTextColor={COLORS.muted}
                                keyboardType="numeric"
                            />
                        </View>
                    </View>

                    {/* Save Button */}
                    <Pressable
                        onPress={handleSave}
                        disabled={saving}
                        style={({ pressed }) => [
                            styles.submitButton,
                            (pressed || saving) && { opacity: 0.8 }
                        ]}
                    >
                        {saving ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.submitButtonText}>Save Changes</Text>
                        )}
                    </Pressable>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
