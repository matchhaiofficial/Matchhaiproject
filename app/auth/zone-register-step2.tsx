// app/auth/zone-register-step2.tsx
import { MaterialIcons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { Link, router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
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
import { useZoneOnboardingStore } from "../../src/store/zoneOnboardingStore";
import { COLORS } from "../../src/theme";
import styles from "./register.styles";

type FocusField = "branch" | "addr" | "map" | null;

export default function ZoneRegisterStep2() {
  const { step2, setStep2, setCurrentStep } = useZoneOnboardingStore();
  const { showToast } = useToast();

  const [branchDisplayName, setBranchDisplayName] = useState(
    step2.branchDisplayName
  );
  const [city, setCity] = useState(step2.city || "Karachi");
  const [areaLabel, setAreaLabel] = useState(
    step2.areaLabel || KARACHI_AREAS[0]
  );
  const [addressLine1, setAddressLine1] = useState(step2.addressLine1);
  const [googleMapsUrl, setGoogleMapsUrl] = useState(step2.googleMapsUrl);

  const [focused, setFocused] = useState<FocusField>(null);

  const {
    isBranchValid,
    isCityValid,
    isAreaValid,
    isAddressValid,
    isFormValid,
    mapsLooksWeird,
  } = useMemo(() => {
    const branchOk = branchDisplayName.trim().length >= 3;
    const cityOk = city.trim().length >= 2;
    const areaOk = areaLabel.trim().length >= 3;
    const addrOk = addressLine1.trim().length >= 6;

    const url = googleMapsUrl.trim();
    const urlFilled = url.length > 0;
    const urlRegex = /^https?:\/\/\S+$/;
    const looksWeird = urlFilled && !urlRegex.test(url);

    return {
      isBranchValid: branchOk,
      isCityValid: cityOk,
      isAreaValid: areaOk,
      isAddressValid: addrOk,
      isFormValid: branchOk && cityOk && areaOk && addrOk,
      mapsLooksWeird: looksWeird,
    };
  }, [branchDisplayName, city, areaLabel, addressLine1, googleMapsUrl]);

  const Container: any = Platform.OS === "ios" ? KeyboardAvoidingView : View;
  const containerProps =
    Platform.OS === "ios"
      ? {
          style: styles.screen,
          behavior: "padding" as const,
          keyboardVerticalOffset: 0,
        }
      : { style: styles.screen };

  const handleContinue = () => {
    if (!isFormValid) {
      showToast({
        type: "info",
        title: "Add branch location",
        message:
          "Please fill branch name, city, area and address so players can find you.",
      });
      return;
    }

    setStep2({
      branchDisplayName: branchDisplayName.trim(),
      city: city.trim(),
      areaLabel: areaLabel.trim(),
      addressLine1: addressLine1.trim(),
      googleMapsUrl: googleMapsUrl.trim(),
    });

    setCurrentStep(2);
    router.push("/auth/zone-register-step3" as any);
  };

  const handleBack = () => {
    router.replace("/auth/zone-register" as any);
  };

  return (
    <Container {...containerProps}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LogoHalo />

        {/* Stepper: Step 2 of 4 */}
        <View style={styles.stepperWrapper}>
          <View style={styles.stepperTopRow}>
            <View>
              <Text style={styles.stepperTitle}>Branch & location</Text>
              <Text style={styles.stepperSubtitle}>
                Step 2 of 4 · Main branch where players will visit
              </Text>
            </View>
          </View>
          <View style={styles.stepperBar}>
            <View style={[styles.stepperBarFill, { width: "50%" }]} />
          </View>
          <View style={styles.stepperDotsRow}>
            <View style={[styles.stepperDot, styles.stepperDotActive]} />
            <View style={[styles.stepperDot, styles.stepperDotActive]} />
            <View style={styles.stepperDot} />
            <View style={styles.stepperDot} />
          </View>
        </View>

        {/* Headings */}
        <Text style={styles.heading}>Where is this zone?</Text>
        <Text style={styles.sub}>
          Players will see this as your first branch. You can add more branches
          later from the zone dashboard.
        </Text>

        {/* Branch display name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Branch name</Text>
          <View style={styles.inputBox}>
            <View style={styles.inputRow}>
              <MaterialIcons
                name="storefront"
                size={20}
                style={styles.prefixIcon}
                color={
                  isBranchValid && branchDisplayName.trim().length > 0
                    ? COLORS.accent
                    : COLORS.muted
                }
              />
              <TextInput
                placeholder='e.g. "O2 – FB Area"'
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                selectionColor={COLORS.accent}
                autoCapitalize="words"
                autoCorrect={false}
                value={branchDisplayName}
                onChangeText={setBranchDisplayName}
                onFocus={() => setFocused("branch")}
                onBlur={() => setFocused(null)}
                returnKeyType="next"
              />
            </View>
            <View
              style={[
                styles.focusBar,
                { opacity: focused === "branch" ? 1 : 0 },
              ]}
            />
          </View>
        </View>

        {/* City (dropdown) */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>City</Text>
          <View style={styles.inputBox}>
            <View style={styles.inputRow}>
              <MaterialIcons
                name="location-city"
                size={20}
                style={styles.prefixIcon}
                color={
                  isCityValid && city.trim().length > 0
                    ? COLORS.accent
                    : COLORS.muted
                }
              />
              <View style={{ flex: 1 }}>
                <Picker
                  selectedValue={city}
                  onValueChange={(value) => setCity(value)}
                  dropdownIconColor={COLORS.muted}
                  style={{
                    color: COLORS.text,
                    width: "100%",
                  }}
                >
                  {CITY_OPTIONS.map((c) => (
                    <Picker.Item key={c} label={c} value={c} />
                  ))}
                </Picker>
              </View>
            </View>
          </View>
        </View>

        {/* Area label (dropdown - Karachi areas for now) */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Area / neighbourhood</Text>
          <View style={styles.inputBox}>
            <View style={styles.inputRow}>
              <MaterialIcons
                name="map"
                size={20}
                style={styles.prefixIcon}
                color={
                  isAreaValid && areaLabel.trim().length > 0
                    ? COLORS.accent
                    : COLORS.muted
                }
              />
              <View style={{ flex: 1 }}>
                <Picker
                  selectedValue={areaLabel}
                  onValueChange={(value) => setAreaLabel(value)}
                  dropdownIconColor={COLORS.muted}
                  style={{
                    color: COLORS.text,
                    width: "100%",
                  }}
                >
                  {KARACHI_AREAS.map((a) => (
                    <Picker.Item key={a} label={a} value={a} />
                  ))}
                </Picker>
              </View>
            </View>
          </View>
        </View>

        {/* Address line */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Full address</Text>
          <View style={styles.inputBox}>
            <View style={styles.inputRow}>
              <MaterialIcons
                name="place"
                size={20}
                style={styles.prefixIcon}
                color={
                  isAddressValid && addressLine1.trim().length > 0
                    ? COLORS.accent
                    : COLORS.muted
                }
              />
              <TextInput
                placeholder="Building, street, floor etc."
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                selectionColor={COLORS.accent}
                autoCapitalize="sentences"
                autoCorrect={false}
                value={addressLine1}
                onChangeText={setAddressLine1}
                onFocus={() => setFocused("addr")}
                onBlur={() => setFocused(null)}
                multiline
              />
            </View>
            <View
              style={[
                styles.focusBar,
                { opacity: focused === "addr" ? 1 : 0 },
              ]}
            />
          </View>
        </View>

        {/* Google Maps URL (optional) */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Google Maps link (optional)</Text>
          <View style={styles.inputBox}>
            <View style={styles.inputRow}>
              <MaterialIcons
                name="link"
                size={20}
                style={styles.prefixIcon}
                color={
                  googleMapsUrl.trim().length > 0
                    ? COLORS.accent
                    : COLORS.muted
                }
              />
              <TextInput
                placeholder="https://maps.app.goo.gl/..."
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                selectionColor={COLORS.accent}
                autoCapitalize="none"
                autoCorrect={false}
                value={googleMapsUrl}
                onChangeText={setGoogleMapsUrl}
                onFocus={() => setFocused("map")}
                onBlur={() => setFocused(null)}
                keyboardType="url"
              />
            </View>
            <View
              style={[
                styles.focusBar,
                { opacity: focused === "map" ? 1 : 0 },
              ]}
            />
          </View>

          {mapsLooksWeird && (
            <View style={styles.helperTextRow}>
              <Text style={[styles.helperText, styles.helperWarning]}>
                This doesn&apos;t look like a full link. Make sure it starts
                with https:// and is a Google Maps URL.
              </Text>
            </View>
          )}
        </View>

        {/* Back to Step 1 */}
        <Pressable onPress={handleBack} style={styles.backLinkWrapper}>
          <Text style={styles.backLinkText}>← Back to zone account</Text>
        </Pressable>

        {/* Continue button */}
        <View
          style={[
            styles.buttonShadowWrapper,
            isFormValid && styles.buttonShadowWrapperActive,
          ]}
        >
          <Pressable
            onPress={handleContinue}
            disabled={!isFormValid}
            style={({ pressed }) => [
              styles.primaryBtn,
              !isFormValid ? styles.primaryBtnDisabled : null,
              pressed && isFormValid && { opacity: 0.92 },
            ]}
            android_ripple={{ color: "rgba(255,255,255,0.08)" }}
          >
            <Text style={styles.primaryBtnText}>Continue</Text>
          </Pressable>
        </View>

        {/* Safety link to login */}
        <Text style={styles.bottomText}>
          Already manage a zone?{" "}
          <Link href="/auth/login" style={{ color: COLORS.accent }}>
            Sign in
          </Link>
        </Text>
      </ScrollView>
    </Container>
  );
}
