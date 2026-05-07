import { Picker } from "@react-native-picker/picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import debounce from "lodash.debounce";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";

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
import { updateZone } from "../../../src/services/convex/zoneService";
import { COLORS } from "../../../src/theme";
import Logger from "../../../src/utils/logger";
import BranchInventoryPricingForm, {
    buildZoneGamesFromBranches,
    createEmptyBranchInventory,
    normalizeBranchInventory,
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

const getRouteParam = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value || "";

const getBranchEffectiveId = (branch: any, index: number) =>
    String(branch?.id || `branch_${index + 1}`);

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

function buildPrimaryBranch(branch: any) {
    return {
        branchDisplayName: branch.branchDisplayName || branch.name || "",
        city: DEFAULT_CITY,
        areaLabel: normalizeKarachiAreaLabel(branch.areaLabel) || "",
        addressLine1: branch.addressLine1 || branch.address || "",
        googleMapsUrl: branch.googleMapsUrl || "",
    };
}

export default function BranchDetails() {
    const { id } = useLocalSearchParams();
    const routeBranchId = getRouteParam(id);
    const { zone, loading } = useZoneData();
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

    const branches = useMemo(() => {
        if (!Array.isArray(zone?.branches)) return [];
        return zone.branches;
    }, [zone?.branches]);

    const branchMatch = useMemo(() => {
        if (!zone) return { branch: null as any, index: -1 };

        const explicitIndex = branches.findIndex((branch: any, index: number) =>
            getBranchEffectiveId(branch, index) === routeBranchId,
        );
        if (explicitIndex >= 0) {
            return { branch: branches[explicitIndex], index: explicitIndex };
        }

        if (routeBranchId === "primary") {
            const primaryIndex = branches.findIndex((branch: any) => branch?.isPrimary === true);
            if (primaryIndex >= 0) {
                return { branch: branches[primaryIndex], index: primaryIndex };
            }
            if (branches[0]) return { branch: branches[0], index: 0 };
            if (zone.primaryBranch) return { branch: zone.primaryBranch, index: -1 };
        }

        return { branch: null as any, index: -1 };
    }, [branches, routeBranchId, zone]);

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
            Logger.error("BranchDetails", "Error searching places", error);
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

    useEffect(() => {
        const branch = branchMatch.branch;
        if (!branch) return;

        const name = String(branch.branchDisplayName || branch.name || "");
        const address = String(branch.addressLine1 || branch.address || "");
        setBranchDisplayName(name);
        setAreaLabel(normalizeKarachiAreaLabel(branch.areaLabel) || KARACHI_AREAS[0]);
        setAddressLine1(address);
        setGoogleMapsUrl(String(branch.googleMapsUrl || ""));
        setContactPhone(formatPakistaniPhone(String(branch.contactPhone || "")));
        setSearchQuery(address || name);
        setSearchResults([]);
        setInventory(normalizeBranchInventory(branch));
    }, [branchMatch.branch]);

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
        if (!zone) return;
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

        const sanitizedInventory = sanitizeBranchInventory(inventory);
        const existingBranch = branchMatch.branch || {};
        const updatedBranch = {
            ...existingBranch,
            id: getBranchEffectiveId(existingBranch, Math.max(branchMatch.index, 0)),
            branchDisplayName: branchDisplayName.trim(),
            name: branchDisplayName.trim(),
            city: DEFAULT_CITY,
            areaLabel: normalizeKarachiAreaLabel(areaLabel),
            addressLine1: finalAddressLine,
            address: finalAddressLine,
            googleMapsUrl: googleMapsUrl.trim(),
            contactPhone: finalPhone,
            ...sanitizedInventory,
            pricing: sanitizedInventory.pricing || {},
        };

        setSaving(true);
        Logger.info("BranchDetails", "Saving branch updates", {
            branchId: routeBranchId,
            zoneId: zone.id,
        });

        try {
            const nextBranches =
                branchMatch.index >= 0
                    ? branches.map((branch: any, index: number) =>
                          index === branchMatch.index ? updatedBranch : branch,
                      )
                    : branches;

            const primaryBranch =
                branchMatch.index === 0 || (branchMatch.index < 0 && routeBranchId === "primary")
                    ? buildPrimaryBranch(updatedBranch)
                    : buildPrimaryBranch(nextBranches[0] || updatedBranch);

            const result = await updateZone(zone.id, {
                ...(branchMatch.index >= 0 ? { branches: nextBranches } : {}),
                primaryBranch,
                city: primaryBranch.city,
                address: primaryBranch.addressLine1,
                ...((branchMatch.index === 0 || (branchMatch.index < 0 && routeBranchId === "primary"))
                    ? { contactPhone: finalPhone }
                    : {}),
                games: buildZoneGamesFromBranches(
                    branchMatch.index >= 0 ? nextBranches : [updatedBranch],
                ),
            });

            if (!result.ok) {
                showToast({
                    type: "error",
                    title: "Error",
                    message: result.message || "Failed to update branch",
                });
                return;
            }

            showToast({
                type: "success",
                title: "Updated",
                message: "Branch details updated successfully.",
            });
            router.back();
        } catch (error) {
            Logger.error("BranchDetails", "Failed to update branch", error);
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

    if (!branchMatch.branch) {
        return (
            <SafeAreaView style={styles.container}>
                <AppHeader title="Edit Branch" onBack={() => router.back()} inlineTitle style={styles.appHeader} />
                <View style={styles.centered}>
                    <Text style={{ color: COLORS.text }}>Branch not found.</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <Screen style={styles.container} scroll={false}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.flex1}
            >
                <AppHeader
                    title={branchMatch.index === 0 || routeBranchId === "primary" ? "Edit Primary Branch" : "Edit Branch"}
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
                            value={branchDisplayName}
                            onChangeText={setBranchDisplayName}
                            placeholder="Main Branch"
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
                            Save
                        </AppButton>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </Screen>
    );
}
