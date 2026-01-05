// app/auth/zone-register-step2.tsx
import { MaterialIcons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { router } from "expo-router";
import debounce from "lodash.debounce";
import React, { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { CITY_OPTIONS, KARACHI_AREAS } from "../../constants/profileOptions";
import LogoHalo from "../../src/components/LogoHalo";
import { useToast } from "../../src/hooks/useToast";
import { BranchData, useZoneOnboardingStore } from "../../src/store/zoneOnboardingStore";
import { COLORS } from "../../src/theme";
import styles from "./register.styles";

export default function AdminRegisterStep2() {
  const {
    branches,
    addBranch,
    updateBranch,
    removeBranch,
    setBranches,
    setCurrentStep
  } = useZoneOnboardingStore();
  const { showToast } = useToast();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);

  // Modal Form State
  const [branchDisplayName, setBranchDisplayName] = useState("");
  const [city, setCity] = useState("Karachi");
  const [areaLabel, setAreaLabel] = useState<string>(KARACHI_AREAS[0]);
  const [addressLine1, setAddressLine1] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Location Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Search function (Debounced)
  const searchPlaces = async (text: string) => {
    if (text.length < 3) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      // Using Nominatim OpenStreetMap API (Free)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text + ", Karachi")}&limit=5&addressdetails=1`,
        {
          headers: {
            "User-Agent": "MatchHaiApp/1.0" // Required by OSM
          }
        }
      );
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error("Error searching places:", error);
    } finally {
      setIsSearching(false);
    }
  };

  // We use useCallback to create a memoized debounced function
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(
    debounce((text: string) => searchPlaces(text), 800),
    []
  );

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    debouncedSearch(text);
  };

  const handleSelectLocation = (result: any) => {
    // 1. Set Address from result (using simplified display name)
    const simplifiedName = result.display_name.split(',').slice(0, 3).join(', ');
    setAddressLine1(simplifiedName);

    // 2. Generate Google Maps URL
    const lat = result.lat;
    const lon = result.lon;
    // Standard format safe for all devices
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
    setGoogleMapsUrl(mapsLink);

    // 3. Clear Search
    setSearchQuery(result.name || result.display_name.split(',')[0]); // Set query to the selected name
    setSearchResults([]);

    // 4. Auto-detect Area from address
    // We check if any of our known KARACHI_AREAS are present in the full display name
    // This helps prevent conflicts (e.g. User select DHA but searches North Nazimabad)
    const fullName = result.display_name.toLowerCase();
    const matchedArea = KARACHI_AREAS.find(area => fullName.includes(area.toLowerCase()));

    if (matchedArea) {
      setAreaLabel(matchedArea);
      showToast({ type: "success", title: "Area Detected", message: `Set area to ${matchedArea}` });
    }
  };

  const resetForm = () => {
    setBranchDisplayName("");
    setCity("Karachi");
    setAreaLabel(KARACHI_AREAS[0]);
    setAddressLine1("");
    // ... rest of reset
    setGoogleMapsUrl("");
    setContactPhone("");
    setEditingBranchId(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  // 📱 Pakistani phone formatter (matches Step 1)
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
      formatted += rest.slice(0, 3) + " " + rest.slice(3);
    } else {
      formatted += rest.slice(0, 3) + " " + rest.slice(3, 7) + " " + rest.slice(7);
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
      showToast({ type: "warning", title: "Limit Reached", message: "You can add up to 10 branches maximum." });
      return;
    }
    resetForm();
    setModalVisible(true);
  };

  const handleEditBranch = (branch: BranchData) => {
    // ... same
    setEditingBranchId(branch.id);
    setBranchDisplayName(branch.branchDisplayName);
    setCity(branch.city);
    setAreaLabel(branch.areaLabel);
    setAddressLine1(branch.addressLine1);
    setGoogleMapsUrl(branch.googleMapsUrl);
    setContactPhone(branch.contactPhone || "");
    setModalVisible(true);
  };

  const handleSaveBranch = () => {
    if (!branchDisplayName.trim() || !addressLine1.trim()) {
      showToast({ type: "error", title: "Missing details", message: "Branch name and address are required." });
      return;
    }

    // Phone Validation
    let finalPhone: string | undefined = undefined;
    if (contactPhone.trim()) {
      const normalizedPhone = contactPhone.trim().replace(/\s|-/g, "");
      const phoneRegex = /^(\+92|92|0)?3[0-9]{9}$/;
      if (!phoneRegex.test(normalizedPhone)) {
        showToast({
          type: "error",
          title: "Invalid Phone",
          message: "Please enter a valid Pakistani mobile number (e.g. 0300...)"
        });
        return;
      }
      finalPhone = normalizedPhone;
    }

    if (editingBranchId) {
      // Update existing
      updateBranch(editingBranchId, {
        branchDisplayName: branchDisplayName.trim(),
        city,
        areaLabel,
        addressLine1: addressLine1.trim(),
        googleMapsUrl: googleMapsUrl.trim(),
        contactPhone: finalPhone,
      });
      showToast({ type: "success", title: "Updated", message: "Branch details updated successfully." });
    } else {
      // Add new
      const newBranch: BranchData = {
        id: Math.random().toString(36).substring(7),
        branchDisplayName: branchDisplayName.trim(),
        city,
        areaLabel,
        addressLine1: addressLine1.trim(),
        googleMapsUrl: googleMapsUrl.trim(),
        contactPhone: finalPhone,
        // Initialize inventory empty
        supportsCs2: false,
        supportsFc25: false,
        supportsTekken8: false,
        supportsFutsal: false,
        supportsIndoorCricket: false,
        supportsPadel: false,
        supportsPickleball: false,
        pricing: {},
        notes: ""
      };
      addBranch(newBranch);
    }

    setModalVisible(false);
    resetForm();
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newBranches = [...branches];
    [newBranches[index - 1], newBranches[index]] = [newBranches[index], newBranches[index - 1]];
    setBranches(newBranches);
  };

  const handleMoveDown = (index: number) => {
    if (index === branches.length - 1) return;
    const newBranches = [...branches];
    [newBranches[index + 1], newBranches[index]] = [newBranches[index], newBranches[index + 1]];
    setBranches(newBranches);
  };

  const handleContinue = () => {
    if (branches.length === 0) {
      showToast({ type: "info", title: "No branches", message: "Please add at least one branch to continue." });
      return;
    }
    setCurrentStep(2);
    router.push("/auth/zone-register-step3");
  };

  const Container: any = Platform.OS === "ios" ? KeyboardAvoidingView : View;
  const containerProps = Platform.OS === "ios" ? { style: styles.screen, behavior: "padding" as const } : { style: styles.screen };

  return (
    <Container {...containerProps}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 32 }]} showsVerticalScrollIndicator={false}>
        <LogoHalo />

        {/* Stepper */}
        <View style={styles.stepperWrapper}>
          <View style={styles.stepperTopRow}>
            <View>
              <Text style={styles.stepperTitle}>Branches & Locations</Text>
              <Text style={styles.stepperSubtitle}>Step 2 of 4 · Add your zone branches</Text>
            </View>
          </View>
          <View style={styles.stepperBar}><View style={[styles.stepperBarFill, { width: "50%" }]} /></View>
          <View style={styles.stepperDotsRow}>
            <View style={[styles.stepperDot, styles.stepperDotActive]} />
            <View style={[styles.stepperDot, styles.stepperDotActive]} />
            <View style={styles.stepperDot} />
            <View style={styles.stepperDot} />
          </View>
        </View>

        <Text style={styles.heading}>Your Branches</Text>
        <Text style={styles.sub}>Add all the branches you want to manage under this zone account.</Text>

        {/* Branch List */}
        {branches.map((branch, index) => (
          <View key={branch.id} style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ color: COLORS.text, fontWeight: 'bold', fontSize: 16 }}>{branch.branchDisplayName}</Text>
                <Text style={{ color: COLORS.muted, fontSize: 14 }}>{branch.areaLabel}, {branch.city}</Text>
                {branch.contactPhone ? (
                  <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>
                    <MaterialIcons name="phone" size={12} color={COLORS.muted} /> {branch.contactPhone}
                  </Text>
                ) : null}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {/* Reorder Controls */}
                <View style={{ flexDirection: 'column', marginRight: 8 }}>
                  <Pressable
                    onPress={() => handleMoveUp(index)}
                    disabled={index === 0}
                    style={{ opacity: index === 0 ? 0.3 : 1, padding: 2 }}
                  >
                    <MaterialIcons name="keyboard-arrow-up" size={24} color={COLORS.accent} />
                  </Pressable>
                  <Pressable
                    onPress={() => handleMoveDown(index)}
                    disabled={index === branches.length - 1}
                    style={{ opacity: index === branches.length - 1 ? 0.3 : 1, padding: 2 }}
                  >
                    <MaterialIcons name="keyboard-arrow-down" size={24} color={COLORS.accent} />
                  </Pressable>
                </View>

                {/* Edit Action */}
                <Pressable onPress={() => handleEditBranch(branch)} style={{ padding: 4 }}>
                  <MaterialIcons name="edit" size={22} color={COLORS.accent} />
                </Pressable>

                {/* Delete Action */}
                <Pressable onPress={() => removeBranch(branch.id)} style={{ padding: 4 }}>
                  <MaterialIcons name="delete-outline" size={22} color={COLORS.error} />
                </Pressable>
              </View>
            </View>
          </View>
        ))}

        {/* Add Branch Button */}
        <Pressable
          onPress={openAddModal}
          style={({ pressed }) => [
            styles.secondaryBtn,
            { marginTop: 16, flexDirection: 'row', justifyContent: 'center', gap: 8 },
            branches.length >= 10 && { opacity: 0.5, borderColor: COLORS.muted }
          ]}
          disabled={branches.length >= 10}
        >
          <MaterialIcons name="add" size={20} color={branches.length >= 10 ? COLORS.muted : COLORS.accent} />
          <Text style={[styles.secondaryBtnText, branches.length >= 10 && { color: COLORS.muted }]}>
            {branches.length >= 10 ? "Max Limit Reached (10)" : "Add Branch"}
          </Text>
        </Pressable>

        {/* Navigation Buttons */}
        <View style={{ marginTop: 32, gap: 12 }}>
          <Pressable onPress={() => router.back()} style={{ alignSelf: 'center' }}>
            <Text style={{ color: COLORS.muted }}>Back</Text>
          </Pressable>

          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.primaryBtn,
              branches.length === 0 && styles.primaryBtnDisabled,
              pressed && branches.length > 0 && { opacity: 0.92 }
            ]}
            disabled={branches.length === 0}
          >
            <Text style={styles.primaryBtnText}>Continue</Text>
          </Pressable>
        </View>

        {/* Branch Modal */}
        <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: COLORS.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' }}>
              <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>
                {editingBranchId ? "Edit Branch" : "Add New Branch"}
              </Text>

              <ScrollView>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Branch Name</Text>
                  <View style={styles.inputBox}>
                    <View style={styles.inputRow}>
                      <MaterialIcons name="store" size={20} style={styles.prefixIcon} color={COLORS.muted} />
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. O2 - FB Area"
                        placeholderTextColor={COLORS.muted}
                        value={branchDisplayName}
                        onChangeText={setBranchDisplayName}
                        selectionColor={COLORS.accent}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>City</Text>
                  <View style={styles.inputBox}>
                    <Picker selectedValue={city} onValueChange={setCity} style={{ color: COLORS.text }} dropdownIconColor={COLORS.muted}>
                      {CITY_OPTIONS.map(c => <Picker.Item key={c} label={c} value={c} />)}
                    </Picker>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Area</Text>
                  <View style={styles.inputBox}>
                    <Picker selectedValue={areaLabel} onValueChange={setAreaLabel} style={{ color: COLORS.text }} dropdownIconColor={COLORS.muted}>
                      {KARACHI_AREAS.map(a => <Picker.Item key={a} label={a} value={a} />)}
                    </Picker>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Address</Text>
                  <View style={styles.inputBox}>
                    <View style={styles.inputRow}>
                      <MaterialIcons name="location-on" size={20} style={styles.prefixIcon} color={COLORS.muted} />
                      <TextInput
                        style={styles.input}
                        placeholder="Full address"
                        placeholderTextColor={COLORS.muted}
                        value={addressLine1}
                        onChangeText={setAddressLine1}
                        selectionColor={COLORS.accent}
                        multiline
                      />
                    </View>
                  </View>
                </View>

                {/* New: Contact Number */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Contact Number (Optional)</Text>
                  <View style={styles.inputBox}>
                    <View style={styles.inputRow}>
                      <MaterialIcons name="phone" size={20} style={styles.prefixIcon} color={COLORS.muted} />
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. 0300 1234567"
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
                  <Text style={styles.label}>Search Location (Map)</Text>
                  <View style={styles.inputBox}>
                    <View style={styles.inputRow}>
                      <MaterialIcons name="search" size={20} style={styles.prefixIcon} color={COLORS.muted} />
                      <TextInput
                        style={styles.input}
                        placeholder="Search area (e.g. Hyperstar North)"
                        placeholderTextColor={COLORS.muted}
                        value={searchQuery}
                        onChangeText={handleSearchChange}
                        selectionColor={COLORS.accent}
                      />
                      {isSearching && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.accent }} />}
                    </View>
                  </View>

                  {/* Search Results Dropdown */}
                  {searchResults.length > 0 && (
                    <View style={{
                      backgroundColor: COLORS.cardBackground,
                      borderWidth: 1,
                      borderColor: COLORS.inputBorder,
                      borderRadius: 8,
                      marginTop: 4,
                      maxHeight: 200,
                    }}>
                      <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                        {searchResults.map((result: any, idx) => (
                          <Pressable
                            key={idx}
                            onPress={() => handleSelectLocation(result)}
                            style={({ pressed }) => ({
                              padding: 12,
                              borderBottomWidth: idx === searchResults.length - 1 ? 0 : 1,
                              borderBottomColor: COLORS.inputBorder,
                              backgroundColor: pressed ? COLORS.inputBackground : 'transparent'
                            })}
                          >
                            <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: 'bold' }}>
                              {result.display_name.split(',')[0]}
                            </Text>
                            <Text style={{ color: COLORS.muted, fontSize: 12 }} numberOfLines={1}>
                              {result.display_name}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Hidden/Read-only Google Maps URL (Auto-generated) */}
                {googleMapsUrl ? (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Google Maps Link (Auto-generated)</Text>
                    <View style={[styles.inputBox, { opacity: 0.7 }]}>
                      <View style={styles.inputRow}>
                        <MaterialIcons name="map" size={20} style={styles.prefixIcon} color={COLORS.success} />
                        <TextInput
                          style={[styles.input, { color: COLORS.success }]}
                          value={googleMapsUrl}
                          editable={false}
                        />
                      </View>
                    </View>
                  </View>
                ) : null}

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                  <Pressable onPress={() => setModalVisible(false)} style={[styles.secondaryBtn, { flex: 1 }]}>
                    <Text style={styles.secondaryBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={handleSaveBranch} style={[styles.primaryBtn, { flex: 1 }]}>
                    <Text style={styles.primaryBtnText}>{editingBranchId ? "Update" : "Add"}</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

      </ScrollView>
    </Container>
  );
}
