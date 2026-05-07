import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import debounce from "lodash.debounce";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";

import {
    DEFAULT_CITY,
    KARACHI_AREAS,
    normalizeKarachiAreaLabel,
} from "../../../constants/profileOptions";
import RegistrationFieldLabel from "../../auth/components/RegistrationFieldLabel";
import registerStyles from "../../auth/register.styles";
import AppHeader from "../../../src/components/AppHeader";
import { AppIcon } from "../../../src/components/AppIcon";
import { AppButton } from "../../../src/components/AppPrimitives";
import Screen from "../../../src/components/Screen";
import { useToast } from "../../../src/hooks/useToast";
import { useZoneData } from "../../../src/hooks/useZoneData";
import { addBranch, updateZone } from "../../../src/services/convex/zoneService";
import { COLORS } from "../../../src/theme";
import Logger from "../../../src/utils/logger";
import BranchInventoryPricingForm, {
    buildZoneGamesFromBranches,
    createEmptyBranchInventory,
    sanitizeBranchInventory,
    validateBranchInventory,
} from "./components/BranchInventoryPricingForm";
import styles from "./branch.styles";

type LocationSearchResult = {
    display_name: string;
    lat: string;
    lon: string;
    name?: string;
    place_id: string;
};

const normalizePhoneForSave = (value: string) => value.trim().replace(/\s|-/g, "");

const formatPakistaniPhone = (value: string) => {
    const numeric = value.replace(/\D/g, "");
    if (!numeric) return value;

    let prefix = "";
    let rest = numeric;
    if (numeric.startsWith("92")) {
        prefix = "+92 ";
        rest = numeric.slice(2);
    } else if (numeric.startsWith("0")) {
        prefix = "0";
        rest = numeric.slice(1);
    } else {
        return value;
    }

    if (rest.length <= 3) return `${prefix}${rest}`.trim();
    if (rest.length <= 7) return `${prefix}${rest.slice(0, 3)} ${rest.slice(3)}`.trim();
    return `${prefix}${rest.slice(0, 3)} ${rest.slice(3, 7)} ${rest.slice(7)}`.trim();
};

export default function AddBranch() {
    const { zone } = useZoneData();
    const router = useRouter();
    const { showToast } = useToast();
    const [saving, setSaving] = useState(false);

    const [branchDisplayName, setBranchDisplayName] = useState("");
    const [areaLabel, setAreaLabel] = useState<string>(KARACHI_AREAS[0]);
    const [addressLine1, setAddressLine1] = useState("");
    const [googleMapsUrl, setGoogleMapsUrl] = useState("");
    const [contactPhone, setContactPhone] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [inventory, setInventory] = useState(createEmptyBranchInventory);

    const detectAreaFromLocation = useCallback((locationText: string) => {
        const normalized = locationText.toLowerCase();
        const areaAliases: Record<string, string[]> = {
            "Defence Housing Authority Karachi": ["dha", "defence housing authority", "defence"],
            "Clifton Karachi": ["clifton"],
            "Gulshan-e-Iqbal": ["gulshan", "gulshan-e-iqbal", "gulshan e iqbal"],
            "Gulistan-e-Johar": ["johar", "gulistan-e-johar", "gulistan e johar"],
            Nazimabad: ["nazimabad"],
            "North Nazimabad": ["north nazimabad"],
            "North Karachi": ["north karachi"],
            "Federal B. Area": ["federal b area", "fb area", "f.b area"],
            "P.E.C.H.S Block 2": ["pechs", "p.e.c.h.s"],
            Dastagir: ["dastagir"],
            "Tariq Road": ["tariq road"],
            Bahadurabad: ["bahadurabad"],
            Karsaz: ["karsaz"],
        };

        for (const area of KARACHI_AREAS) {
            const aliases = areaAliases[area] || [area];
            if (aliases.some((alias) => normalized.includes(alias.toLowerCase()))) {
                return normalizeKarachiAreaLabel(area);
            }
        }
        return null;
    }, []);

    const searchPlaces = useCallback(async (text: string) => {
        if (text.length < 3) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${text}, Karachi`)}&limit=5&addressdetails=1`,
                {
                    headers: {
                        "User-Agent": "MatchHaiApp/1.0",
                    },
                },
            );
            const data = await response.json();
            setSearchResults(data || []);
        } catch (error) {
            Logger.error("AddBranch", "Error searching places", error);
        } finally {
            setIsSearching(false);
        }
    }, []);

    const debouncedSearch = useMemo(
        () =>
            debounce((text: string) => {
                void searchPlaces(text);
            }, 800),
        [searchPlaces],
    );

    useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

    const handleSearchChange = (text: string) => {
        setSearchQuery(text);
        debouncedSearch(text);
    };

    const handleSelectLocation = (result: LocationSearchResult) => {
        const formattedAddress = String(result.display_name || "");
        const simplifiedName = formattedAddress.split(",").slice(0, 3).join(", ");
        const mapsLink = `https://www.google.com/maps/search/?api=1&query=${result.lat},${result.lon}`;

        setAddressLine1(simplifiedName);
        setGoogleMapsUrl(mapsLink);
        setSearchQuery(result.name || formattedAddress.split(",")[0]);
        setSearchResults([]);

        const matchedArea = detectAreaFromLocation(formattedAddress);
        if (matchedArea) {
            setAreaLabel(matchedArea);
            showToast({
                type: "success",
                title: "Area detected",
                message: `Set area to ${matchedArea}`,
            });
        } else {
            showToast({
                type: "info",
                title: "Location selected",
                message: "Address was filled. Please confirm the area manually if needed.",
            });
        }
    };

    const handlePhoneChange = (text: string) => {
        setContactPhone(/^[\d+\s-]*$/.test(text) ? formatPakistaniPhone(text) : text);
    };

    const handleSave = async () => {
        if (!zone?.id) {
            showToast({ type: "error", title: "Missing zone", message: "Could not find the current zone account." });
            return;
        }
        if (!branchDisplayName.trim()) {
            showToast({ type: "error", title: "Missing details", message: "Enter the branch name." });
            return;
        }
        const finalAddressLine = addressLine1.trim() || searchQuery.trim();
        if (!finalAddressLine) {
            showToast({
                type: "error",
                title: "Missing address",
                message: "Select an address from the location results or enter address details.",
            });
            return;
        }

        const inventoryError = validateBranchInventory(branchDisplayName, inventory);
        if (inventoryError) {
            showToast({
                type: "error",
                title: "Complete branch setup",
                message: inventoryError,
            });
            return;
        }

        let finalPhone: string | undefined;
        if (contactPhone.trim()) {
            const normalizedPhone = normalizePhoneForSave(contactPhone);
            const phoneRegex = /^(\+92|92|0)?3[0-9]{9}$/;
            if (!phoneRegex.test(normalizedPhone)) {
                showToast({
                    type: "error",
                    title: "Invalid phone",
                    message: "Please enter a valid Pakistani mobile number such as 0300 123 4567.",
                });
                return;
            }
            finalPhone = normalizedPhone;
        }

        setSaving(true);
        try {
            const sanitizedInventory = sanitizeBranchInventory(inventory);
            const branchPayload = {
                branchDisplayName: branchDisplayName.trim(),
                name: branchDisplayName.trim(),
                city: DEFAULT_CITY,
                areaLabel: normalizeKarachiAreaLabel(areaLabel),
                addressLine1: finalAddressLine,
                address: finalAddressLine,
                googleMapsUrl: googleMapsUrl.trim(),
                contactPhone: finalPhone,
                isPrimary: false,
                capacity: {},
                ...sanitizedInventory,
                pricing: sanitizedInventory.pricing || {},
            };

            const result = await addBranch(zone.id, branchPayload);

            if (result.ok) {
                const nextBranches = [
                    ...(Array.isArray(zone.branches) ? zone.branches : []),
                    { ...branchPayload, id: result.data?.id },
                ];
                const gamesResult = await updateZone(zone.id, {
                    games: buildZoneGamesFromBranches(nextBranches),
                });

                if (!gamesResult.ok) {
                    showToast({
                        type: "warning",
                        title: "Branch created",
                        message: "Branch saved, but supported games did not refresh. Reopen settings if games look outdated.",
                    });
                    router.back();
                    return;
                }

                showToast({ type: "success", title: "Created", message: "Branch added successfully." });
                router.back();
            } else {
                showToast({ type: "error", title: "Error", message: result.message });
            }
        } catch (error) {
            Logger.error("AddBranch", "Failed to add branch", error);
            showToast({ type: "error", title: "Error", message: "Failed to add branch" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Screen style={styles.container} scroll={false}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.flex1}
            >
                <AppHeader title="Add New Branch" onBack={() => router.back()} inlineTitle />

                <ScrollView contentContainerStyle={[styles.content, styles.contentInsideScreen]}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Branch Name</Text>
                        <TextInput
                            style={styles.input}
                            value={branchDisplayName}
                            onChangeText={setBranchDisplayName}
                            placeholder="North Nazimabad Branch"
                            placeholderTextColor={COLORS.muted}
                        />
                    </View>

                    <View style={registerStyles.fieldGroup}>
                        <RegistrationFieldLabel label="Area" required />
                        <View style={registerStyles.inputBox}>
                            <Picker
                                selectedValue={areaLabel}
                                onValueChange={setAreaLabel}
                                style={{ color: COLORS.text }}
                                dropdownIconColor={COLORS.muted}
                            >
                                {KARACHI_AREAS.map((option) => (
                                    <Picker.Item key={option} label={option} value={option} />
                                ))}
                            </Picker>
                        </View>
                    </View>

                    <View style={registerStyles.fieldGroup}>
                        <RegistrationFieldLabel label="Branch phone" optional />
                        <View style={registerStyles.inputBox}>
                            <View style={registerStyles.inputRow}>
                                <AppIcon name="phone" size={20} style={registerStyles.prefixIcon} color={COLORS.muted} />
                                <TextInput
                                    style={registerStyles.input}
                                    placeholder="e.g. 0300 123 4567"
                                    placeholderTextColor={COLORS.muted}
                                    value={contactPhone}
                                    onChangeText={handlePhoneChange}
                                    selectionColor={COLORS.accent}
                                    keyboardType="phone-pad"
                                />
                            </View>
                        </View>
                    </View>

                    <View style={[registerStyles.fieldGroup, { zIndex: 10 }]}>
                        <RegistrationFieldLabel label="Address" required />
                        <View style={registerStyles.inputBox}>
                            <View style={registerStyles.inputRow}>
                                <AppIcon name="search" size={20} style={registerStyles.prefixIcon} color={COLORS.muted} />
                                <TextInput
                                    style={registerStyles.input}
                                    placeholder="e.g. Garden, Karachi"
                                    placeholderTextColor={COLORS.muted}
                                    value={searchQuery}
                                    onChangeText={handleSearchChange}
                                    selectionColor={COLORS.accent}
                                />
                                {isSearching ? (
                                    <View
                                        style={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: 5,
                                            backgroundColor: COLORS.accent,
                                        }}
                                    />
                                ) : null}
                            </View>
                        </View>

                        {searchResults.length > 0 ? (
                            <View
                                style={{
                                    backgroundColor: COLORS.cardBackground,
                                    borderWidth: 1,
                                    borderColor: COLORS.inputBorder,
                                    borderRadius: 12,
                                    marginTop: 6,
                                    maxHeight: 220,
                                }}
                            >
                                <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }}>
                                    {searchResults.map((result, index) => (
                                        <Pressable
                                            key={`${result.place_id}-${index}`}
                                            onPress={() => handleSelectLocation(result)}
                                            style={({ pressed }) => ({
                                                paddingVertical: 12,
                                                paddingHorizontal: 14,
                                                borderBottomWidth: index === searchResults.length - 1 ? 0 : 1,
                                                borderBottomColor: COLORS.inputBorder,
                                                backgroundColor: pressed ? COLORS.inputBackground : "transparent",
                                            })}
                                        >
                                            <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: "700" }}>
                                                {result.name || String(result.display_name).split(",")[0]}
                                            </Text>
                                            <Text style={{ color: COLORS.muted, fontSize: 12 }} numberOfLines={1}>
                                                {result.display_name}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </ScrollView>
                            </View>
                        ) : null}
                    </View>

                    <View style={registerStyles.fieldGroup}>
                        <RegistrationFieldLabel label="Address Details" optional />
                        <View style={registerStyles.inputBox}>
                            <View style={registerStyles.inputRow}>
                                <AppIcon
                                    name="location-on"
                                    size={20}
                                    style={registerStyles.prefixIcon}
                                    color={COLORS.muted}
                                />
                                <TextInput
                                    style={registerStyles.input}
                                    placeholder="e.g. Near Pakola Masjid, Garden Road, Karachi"
                                    placeholderTextColor={COLORS.muted}
                                    value={addressLine1}
                                    onChangeText={setAddressLine1}
                                    selectionColor={COLORS.accent}
                                    multiline
                                />
                            </View>
                        </View>
                    </View>

                    {googleMapsUrl ? (
                        <View style={registerStyles.fieldGroup}>
                            <RegistrationFieldLabel label="Google Maps link" optional />
                            <View style={[registerStyles.inputBox, { opacity: 0.75 }]}>
                                <View style={registerStyles.inputRow}>
                                    <AppIcon name="map" size={20} style={registerStyles.prefixIcon} color={COLORS.success} />
                                    <TextInput
                                        style={[registerStyles.input, { color: COLORS.success }]}
                                        value={googleMapsUrl}
                                        editable={false}
                                    />
                                </View>
                            </View>
                        </View>
                    ) : null}

                    <BranchInventoryPricingForm
                        value={inventory}
                        onChange={setInventory}
                        validationError={validateBranchInventory(branchDisplayName, inventory)}
                    />

                    <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                        <AppButton variant="secondary" style={{ flex: 1 }} onPress={() => router.back()} disabled={saving}>
                            Cancel
                        </AppButton>
                        <AppButton style={{ flex: 1 }} onPress={handleSave} loading={saving} disabled={saving}>
                            Create
                        </AppButton>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </Screen>
    );
}
