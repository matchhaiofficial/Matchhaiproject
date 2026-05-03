import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";

import AppHeader from "../../../src/components/AppHeader";
import Screen from "../../../src/components/Screen";
import { useToast } from "../../../src/hooks/useToast";
import { useZoneData } from "../../../src/hooks/useZoneData";
import { updateZone } from "../../../src/services/convex/zoneService";
import { COLORS } from "../../../src/theme";
import Logger from "../../../src/utils/logger";
import styles from "./branch.styles";

export default function BranchDetails() {
    const { id } = useLocalSearchParams(); // "primary" or actual ID
    const { zone, loading } = useZoneData();
    const router = useRouter();
    const { showToast } = useToast();

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
            showToast({ type: "warning", title: "Error", message: "Branch name is required" });
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
                    // Physical sports are temporarily disabled.
                    "capacity.futsalCourts": "",
                    "capacity.padelCourts": "",
                });
                showToast({ type: "success", title: "Success", message: "Branch updated successfully" });
                Logger.info('BranchDetails', 'Branch updated successfully');
                router.back();
            } else {
                // TODO: Handle other branches
                showToast({ type: "warning", title: "Error", message: "Editing other branches not implemented yet" });
            }
        } catch (error) {
            Logger.error('BranchDetails', 'Failed to update branch', error);
            showToast({ type: "error", title: "Error", message: "Failed to update branch" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Screen style={styles.container} scroll={false}>
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={COLORS.accent} />
              </View>
            </Screen>
        );
    }

    if (!zone) return null;

    return (
        <Screen style={styles.container} scroll={false}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.flex1}
            >
                <AppHeader
                    title={id === "primary" ? "Edit Primary Branch" : "Edit Branch"}
                    onBack={() => router.back()}
                    inlineTitle
                />

                <ScrollView contentContainerStyle={[styles.content, styles.contentInsideScreen]}>
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

                    {/* Physical sports are temporarily disabled. */}
                    {false ? (
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
                    ) : null}

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
        </Screen>
    );
}
