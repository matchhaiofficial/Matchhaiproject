import { Picker } from "@react-native-picker/picker";
import { router } from "expo-router";
import debounce from "lodash.debounce";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import {
  DEFAULT_CITY,
  KARACHI_AREAS,
  normalizeKarachiAreaLabel,
} from "../../constants/profileOptions";
import RegistrationFieldLabel from "./components/RegistrationFieldLabel";
import RegistrationStepHeader from "./components/RegistrationStepHeader";
import { AppIcon } from "../../src/components/AppIcon";
import {
  AppBottomSheet,
  AppModalBody,
  AppModalFooter,
  AppModalHeader,
} from "../../src/components/AppModalPrimitives";
import { AppButton } from "../../src/components/AppPrimitives";
import Screen from "../../src/components/Screen";
import { useToast } from "../../src/hooks/useToast";
import { BranchData, useZoneOnboardingStore } from "../../src/store/zoneOnboardingStore";
import { COLORS } from "../../src/theme";
import { Perf } from "../../src/utils/perfInstrumentation";
import styles from "./register.styles";

type LocationSearchResult = {
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  place_id: string;
};

export default function AdminRegisterStep2() {
  const { step1, branches, addBranch, updateBranch, removeBranch, setBranches, setCurrentStep } =
    useZoneOnboardingStore();
  const { showToast } = useToast();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [branchDisplayName, setBranchDisplayName] = useState("");
  const [areaLabel, setAreaLabel] = useState<string>(KARACHI_AREAS[0]);
  const [addressLine1, setAddressLine1] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    setCurrentStep(2);
    Perf.mark("Screen.Mount", {
      routeKey: "/auth/zone-register-step2",
      meta: {
        routeKeyConfidence: "explicit",
      },
    });

    const navMark = Perf.consumeNavMark("/auth/zone-register-step2");
    if (navMark) {
      Perf.mark("Nav.ToMounted", {
        cid: navMark.cid,
        routeKey: "/auth/zone-register-step2",
        meta: {
          durationMs: Date.now() - navMark.startedAt,
          ...(navMark.meta || {}),
        },
      });
    }
  }, [setCurrentStep]);

  useEffect(() => {
    if (
      !step1.ownerFullName.trim() ||
      !step1.venueBrandName.trim() ||
      !step1.contactEmail.trim() ||
      !step1.password
    ) {
      router.replace("/auth/zone-register");
    }
  }, [step1]);

  const branchCountLabel = useMemo(
    () => (branches.length === 1 ? "1 branch added" : `${branches.length} branches added`),
    [branches.length],
  );
  const detectAreaFromLocation = (locationText: string) => {
    const normalized = locationText.toLowerCase();
    const areaAliases: Record<string, string[]> = {
      "Defence Housing Authority Karachi": ["dha", "defence housing authority", "defence"],
      "Clifton Karachi": ["clifton"],
      "Gulshan-e-Iqbal": ["gulshan", "gulshan-e-iqbal", "gulshan e iqbal"],
      "Gulistan-e-Johar": ["johar", "gulistan-e-johar", "gulistan e johar"],
      "North Nazimabad": ["north nazimabad"],
      Nazimabad: ["nazimabad"],
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
  };

  const searchPlaces = async (text: string) => {
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
      console.error("Error searching places:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const debouncedSearch = useCallback(
    debounce((text: string) => {
      void searchPlaces(text);
    }, 800),
    [],
  );

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

  const resetForm = () => {
    setBranchDisplayName("");
    setAreaLabel(KARACHI_AREAS[0]);
    setAddressLine1("");
    setGoogleMapsUrl("");
    setContactPhone("");
    setEditingBranchId(null);
    setSearchQuery("");
    setSearchResults([]);
  };

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

    let formatted = prefix;
    if (rest.length <= 3) {
      formatted += rest;
    } else if (rest.length <= 7) {
      formatted += `${rest.slice(0, 3)} ${rest.slice(3)}`;
    } else {
      formatted += `${rest.slice(0, 3)} ${rest.slice(3, 7)} ${rest.slice(7)}`;
    }

    return formatted.trim();
  };

  const handlePhoneChange = (text: string) => {
    let next = text;
    if (/^[\d+\s-]*$/.test(text)) {
      next = formatPakistaniPhone(text);
    }
    setContactPhone(next);
  };

  const openAddModal = () => {
    if (branches.length >= 10) {
      showToast({
        type: "warning",
        title: "Limit reached",
        message: "You can add up to 10 branches maximum.",
      });
      return;
    }

    resetForm();
    setModalVisible(true);
  };

  const handleEditBranch = (branch: BranchData) => {
    setEditingBranchId(branch.id);
    setBranchDisplayName(branch.branchDisplayName);
    setAreaLabel(normalizeKarachiAreaLabel(branch.areaLabel) || KARACHI_AREAS[0]);
    setAddressLine1(branch.addressLine1);
    setGoogleMapsUrl(branch.googleMapsUrl);
    setContactPhone(branch.contactPhone || "");
    setModalVisible(true);
  };

  const handleSaveBranch = () => {
    if (!branchDisplayName.trim() || !searchQuery.trim() || !googleMapsUrl.trim()) {
      showToast({
        type: "error",
        title: "Missing details",
        message: "Enter the branch name and select an address from the location results.",
      });
      return;
    }

    let finalPhone: string | undefined;
    if (contactPhone.trim()) {
      const normalizedPhone = contactPhone.trim().replace(/\s|-/g, "");
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

    if (editingBranchId) {
      updateBranch(editingBranchId, {
        branchDisplayName: branchDisplayName.trim(),
        city: DEFAULT_CITY,
        areaLabel: normalizeKarachiAreaLabel(areaLabel),
        addressLine1: addressLine1.trim(),
        googleMapsUrl: googleMapsUrl.trim(),
        contactPhone: finalPhone,
      });
      showToast({
        type: "success",
        title: "Updated",
        message: "Branch details updated successfully.",
      });
    } else {
      const newBranch: BranchData = {
        id: Math.random().toString(36).substring(7),
        branchDisplayName: branchDisplayName.trim(),
        city: DEFAULT_CITY,
        areaLabel: normalizeKarachiAreaLabel(areaLabel),
        addressLine1: addressLine1.trim(),
        googleMapsUrl: googleMapsUrl.trim(),
        contactPhone: finalPhone,
        supportsCs2: false,
        supportsFc25: false,
        supportsTekken8: false,
        supportsFutsal: false,
        supportsIndoorCricket: false,
        supportsPadel: false,
        supportsPickleball: false,
        pricing: {},
        notes: "",
      };
      addBranch(newBranch);
    }

    setModalVisible(false);
    resetForm();
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const next = [...branches];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setBranches(next);
  };

  const handleMoveDown = (index: number) => {
    if (index === branches.length - 1) return;
    const next = [...branches];
    [next[index + 1], next[index]] = [next[index], next[index + 1]];
    setBranches(next);
  };

  const handleContinue = () => {
    if (!branches.length) {
      showToast({
        type: "info",
        title: "No branches",
        message: "Please add at least one branch to continue.",
      });
      return;
    }

    router.replace("/auth/zone-register-step3");
  };

  return (
    <Screen
      scroll
      keyboardAvoiding
      style={styles.screen}
      contentStyle={styles.container}
      routeKey="/auth/zone-register-step2"
      scrollProps={{
        showsVerticalScrollIndicator: false,
        keyboardShouldPersistTaps: "handled",
      }}
    >
      <RegistrationStepHeader
        title="Branch Setup"
        subtitle=""
        stepTitle="Step 2 of 4"
        stepSubtitle="Branches and locations"
        progress="50%"
        onBack={() => router.replace("/auth/zone-register")}
      />

      <Text style={styles.heading}>Add branches</Text>
      <Text style={styles.sub}>Each branch gets its own location, inventory, and pricing.</Text>

      <View style={styles.reviewSectionCard}>
        <View style={styles.reviewSectionHeaderRow}>
          <View>
            <Text style={styles.reviewSectionTitle}>Branch list</Text>
            <Text style={styles.reviewValueMuted}>{branchCountLabel}</Text>
          </View>
          <AppButton
            variant="secondary"
            size="sm"
            onPress={openAddModal}
            disabled={branches.length >= 10}
          >
            {branches.length >= 10 ? "Limit reached" : "Add branch"}
          </AppButton>
        </View>

        {branches.length ? (
          <View style={styles.summaryCardList}>
            {branches.map((branch, index) => (
              <View key={branch.id} style={styles.reviewCard}>
                <View style={styles.reviewSectionHeaderRow}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={styles.reviewSectionTitle}>{branch.branchDisplayName}</Text>
                    <Text style={styles.reviewValue}>
                      {[normalizeKarachiAreaLabel(branch.areaLabel), DEFAULT_CITY].filter(Boolean).join(", ")}
                    </Text>
                    <Text style={[styles.reviewValue, { marginTop: 4 }]} numberOfLines={2}>
                      {branch.addressLine1}
                    </Text>
                    {branch.contactPhone ? (
                      <Text style={[styles.reviewValueMuted, { marginTop: 6 }]}>
                        Contact: {branch.contactPhone}
                      </Text>
                    ) : null}
                  </View>

                  <View style={{ alignItems: "flex-end", gap: 10 }}>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <Pressable
                        onPress={() => handleMoveUp(index)}
                        disabled={index === 0}
                        style={{ opacity: index === 0 ? 0.35 : 1 }}
                      >
                        <AppIcon name="keyboard-arrow-up" size={22} color={COLORS.accent} />
                      </Pressable>
                      <Pressable
                        onPress={() => handleMoveDown(index)}
                        disabled={index === branches.length - 1}
                        style={{ opacity: index === branches.length - 1 ? 0.35 : 1 }}
                      >
                        <AppIcon name="keyboard-arrow-down" size={22} color={COLORS.accent} />
                      </Pressable>
                    </View>
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      <Pressable onPress={() => handleEditBranch(branch)}>
                        <Text style={styles.reviewEditLink}>Edit</Text>
                      </Pressable>
                      <Pressable onPress={() => removeBranch(branch.id)}>
                        <Text style={[styles.reviewEditLink, { color: COLORS.error }]}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateTitle}>No branches added yet</Text>
            <Text style={styles.emptyStateText}>
              Add at least one branch before continuing to inventory and pricing.
            </Text>
          </View>
        )}
      </View>

      <Pressable onPress={() => router.replace("/auth/zone-register")} style={styles.backLinkWrapper}>
        <Text style={styles.backLinkText}>Back to admin details</Text>
      </Pressable>

      <View style={[styles.buttonShadowWrapper, branches.length > 0 && styles.buttonShadowWrapperActive]}>
        <AppButton
          onPress={handleContinue}
          disabled={branches.length === 0}
          size="lg"
          style={[styles.primaryBtn, branches.length === 0 ? styles.primaryBtnDisabled : null]}
        >
          Continue
        </AppButton>
      </View>

      <AppBottomSheet
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        sheetStyle={{ backgroundColor: COLORS.backgroundDark, maxHeight: "92%" }}
        keyboardAware
      >
        <AppModalHeader
          title={editingBranchId ? "Edit branch" : "Add branch"}
          onClose={() => setModalVisible(false)}
        />

        <AppModalBody
          scroll
          contentContainerStyle={styles.branchModalContent}
        >
            <View style={styles.fieldGroup}>
              <RegistrationFieldLabel label="Branch name" required />
              <View style={styles.inputBox}>
                <View style={styles.inputRow}>
                  <AppIcon name="store" size={20} style={styles.prefixIcon} color={COLORS.muted} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Pasha's Arena - Garden"
                    placeholderTextColor={COLORS.muted}
                    value={branchDisplayName}
                    onChangeText={setBranchDisplayName}
                    selectionColor={COLORS.accent}
                    returnKeyType="next"
                  />
                </View>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <RegistrationFieldLabel label="Area" required />
              <View style={styles.inputBox}>
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

            <View style={styles.fieldGroup}>
              <RegistrationFieldLabel label="Branch phone" optional />
              <View style={styles.inputBox}>
                <View style={styles.inputRow}>
                  <AppIcon name="phone" size={20} style={styles.prefixIcon} color={COLORS.muted} />
                  <TextInput
                    style={styles.input}
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

            <View style={[styles.fieldGroup, { zIndex: 10 }]}>
              <RegistrationFieldLabel label="Address" required />
              <View style={styles.inputBox}>
                <View style={styles.inputRow}>
                  <AppIcon name="search" size={20} style={styles.prefixIcon} color={COLORS.muted} />
                  <TextInput
                    style={styles.input}
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

            <View style={styles.fieldGroup}>
              <RegistrationFieldLabel label="Address Details" optional />
              <View style={styles.inputBox}>
                <View style={styles.inputRow}>
                  <AppIcon
                    name="location-on"
                    size={20}
                    style={styles.prefixIcon}
                    color={COLORS.muted}
                  />
                  <TextInput
                    style={styles.input}
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
              <View style={styles.fieldGroup}>
                <RegistrationFieldLabel label="Google Maps link" optional />
                <View style={[styles.inputBox, { opacity: 0.75 }]}>
                  <View style={styles.inputRow}>
                    <AppIcon name="map" size={20} style={styles.prefixIcon} color={COLORS.success} />
                    <TextInput style={[styles.input, { color: COLORS.success }]} value={googleMapsUrl} editable={false} />
                  </View>
                </View>
              </View>
            ) : null}
        </AppModalBody>

        <AppModalFooter>
          <View style={styles.branchModalActions}>
            <AppButton variant="secondary" style={{ flex: 1 }} onPress={() => setModalVisible(false)}>
              Cancel
            </AppButton>
            <AppButton style={{ flex: 1 }} onPress={handleSaveBranch}>
              {editingBranchId ? "Update" : "Add"}
            </AppButton>
          </View>
        </AppModalFooter>
      </AppBottomSheet>
    </Screen>
  );
}
