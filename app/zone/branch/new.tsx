import { MaterialIcons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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

import { CITY_OPTIONS, KARACHI_AREAS } from "../../../constants/profileOptions";
import { useZoneData } from "../../../src/hooks/useZoneData";
import { addBranch } from "../../../src/services/zoneService";
import { COLORS } from "../../../src/theme";
import styles from "./branch.styles";

export default function AddBranch() {
    const { zone } = useZoneData();
    const router = useRouter();
    const [saving, setSaving] = useState(false);

    // Form State
    const [branchName, setBranchName] = useState("");
    const [city, setCity] = useState("Karachi");
    const [area, setArea] = useState(KARACHI_AREAS[0]);
    const [address, setAddress] = useState("");
    const [googleMapsUrl, setGoogleMapsUrl] = useState("");

    const handleSave = async () => {
        if (!branchName.trim()) {
            Alert.alert("Error", "Branch name is required");
            return;
        }
        if (!address.trim()) {
            Alert.alert("Error", "Address is required");
            return;
        }

        setSaving(true);
        try {
            const result = await addBranch(zone.id, {
                branchDisplayName: branchName.trim(),
                city: city.trim(),
                areaLabel: area.trim(),
                addressLine1: address.trim(),
                googleMapsUrl: googleMapsUrl.trim(),
                isPrimary: false,
                capacity: {}, // Initialize empty capacity
            });

            if (result.ok) {
                Alert.alert("Success", "Branch added successfully");
                router.back();
            } else {
                Alert.alert("Error", result.message);
            }
        } catch (error) {
            Alert.alert("Error", "Failed to add branch");
        } finally {
            setSaving(false);
        }
    };

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
                    <Text style={styles.headerTitle}>Add New Branch</Text>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Branch Name</Text>
                        <TextInput
                            style={styles.input}
                            value={branchName}
                            onChangeText={setBranchName}
                            placeholder="North Nazimabad Branch"
                            placeholderTextColor={COLORS.muted}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>City</Text>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={city}
                                onValueChange={(itemValue) => setCity(itemValue)}
                                style={styles.picker}
                                dropdownIconColor={COLORS.text}
                            >
                                {CITY_OPTIONS.map((c) => (
                                    <Picker.Item key={c} label={c} value={c} />
                                ))}
                            </Picker>
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Area</Text>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={area}
                                onValueChange={(itemValue) => setArea(itemValue)}
                                style={styles.picker}
                                dropdownIconColor={COLORS.text}
                            >
                                {KARACHI_AREAS.map((a) => (
                                    <Picker.Item key={a} label={a} value={a} />
                                ))}
                            </Picker>
                        </View>
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

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Google Maps URL (Optional)</Text>
                        <TextInput
                            style={styles.input}
                            value={googleMapsUrl}
                            onChangeText={setGoogleMapsUrl}
                            placeholder="https://maps.app.goo.gl/abc123"
                            placeholderTextColor={COLORS.muted}
                            keyboardType="url"
                            autoCapitalize="none"
                        />
                    </View>

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
                            <Text style={styles.submitButtonText}>Create Branch</Text>
                        )}
                    </Pressable>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
