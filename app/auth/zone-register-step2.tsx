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

type BranchFormState = {
  id: string;
  branchDisplayName: string;
  city: string;
  areaLabel: string;
  addressLine1: string;
  googleMapsUrl: string;
};

const createEmptyBranch = (index: number): BranchFormState => ({
  id: `branch-${Date.now()}-${index}`,
  branchDisplayName: "",
  city: "Karachi",
  areaLabel: KARACHI_AREAS[0],
  addressLine1: "",
  googleMapsUrl: "",
});

export default function ZoneRegisterStep2() {
  const { step2, setStep2, setCurrentStep } = useZoneOnboardingStore();
  const { showToast } = useToast();

  const [branches, setBranches] = useState<BranchFormState[]>(() => {
    if (step2.branches && step2.branches.length > 0) {
      return step2.branches.map((b, idx) => ({
        id: `branch-${idx}`,
        branchDisplayName: b.branchDisplayName || "",
        city: b.city || "Karachi",
        areaLabel: b.areaLabel || KARACHI_AREAS[0],
        addressLine1: b.addressLine1 || "",
        googleMapsUrl: b.googleMapsUrl || "",
      }));
    }

    return [createEmptyBranch(0)];
  });

  const [focused, setFocused] = useState<{ id: string; field: FocusField } | null>(
    null
  );

  const { branchValidity, isFormValid } = useMemo(() => {
    const urlRegex = /^https?:\/\/\S+$/;

    const validity = branches.map((branch) => {
      const branchOk = branch.branchDisplayName.trim().length >= 3;
      const cityOk = branch.city.trim().length >= 2;
      const areaOk = branch.areaLabel.trim().length >= 3;
      const addrOk = branch.addressLine1.trim().length >= 6;

      const url = branch.googleMapsUrl.trim();
      const urlFilled = url.length > 0;
      const looksWeird = urlFilled && !urlRegex.test(url);

      return {
        id: branch.id,
        isBranchValid: branchOk,
        isCityValid: cityOk,
        isAreaValid: areaOk,
        isAddressValid: addrOk,
        mapsLooksWeird: looksWeird,
        isComplete: branchOk && cityOk && areaOk && addrOk,
      };
    });

    return {
      branchValidity: validity,
      isFormValid: validity.length > 0 && validity.every((b) => b.isComplete),
    };
  }, [branches]);

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
        title: "Add branch locations",
        message:
          "Please fill branch name, city, area and address for each branch so players can find you.",
      });
      return;
    }

    const trimmedBranches = branches.map((branch) => ({
      branchDisplayName: branch.branchDisplayName.trim(),
      city: branch.city.trim(),
      areaLabel: branch.areaLabel.trim(),
      addressLine1: branch.addressLine1.trim(),
      googleMapsUrl: branch.googleMapsUrl.trim(),
    }));

    const primary = trimmedBranches[0] || {
      branchDisplayName: "",
      city: "",
      areaLabel: "",
      addressLine1: "",
      googleMapsUrl: "",
    };

    setStep2({
      branches: trimmedBranches,
      branchDisplayName: primary.branchDisplayName,
      city: primary.city,
      areaLabel: primary.areaLabel,
      addressLine1: primary.addressLine1,
      googleMapsUrl: primary.googleMapsUrl,
    });

    setCurrentStep(2);
    router.push("/auth/zone-register-step3" as any);
  };

  const handleBack = () => {
    router.replace("/auth/zone-register" as any);
  };

  const handleAddBranch = () => {
    if (branches.length >= 5) {
      showToast({
        type: "info",
        title: "Branch limit",
        message: "You can add up to 5 branches during sign-up. Add more later.",
      });
      return;
    }

    setBranches((prev) => [...prev, createEmptyBranch(prev.length)]);
  };

  const handleRemoveBranch = (id: string) => {
    setBranches((prev) => prev.filter((b, idx) => idx === 0 || b.id !== id));
  };

  const updateBranchField = (
    id: string,
    field: keyof Omit<BranchFormState, "id">,
    value: string
  ) => {
    setBranches((prev) =>
      prev.map((branch) => (branch.id === id ? { ...branch, [field]: value } : branch))
    );
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
              <Text style={styles.stepperTitle}>Branches & locations</Text>
              <Text style={styles.stepperSubtitle}>
                Step 2 of 4 · Add your primary branch and any others
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
        <Text style={styles.heading}>Where are your branches?</Text>
        <Text style={styles.sub}>
          Players will see your primary branch first. You can add up to 5 branches during
          sign-up and manage more later in the dashboard.
        </Text>

        {branches.map((branch, index) => {
          const validity = branchValidity.find((v) => v.id === branch.id);
          const isPrimary = index === 0;

          return (
            <View key={branch.id} style={{ marginBottom: 24 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <Text style={[styles.label, { color: COLORS.text }]}>
                  Branch {index + 1}
                  {isPrimary ? " · Primary" : ""}
                </Text>
                {!isPrimary && (
                  <Pressable onPress={() => handleRemoveBranch(branch.id)}>
                    <Text style={[styles.helperText, { color: COLORS.muted }]}>Remove</Text>
                  </Pressable>
                )}
              </View>

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
                        validity?.isBranchValid && branch.branchDisplayName.trim().length > 0
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
                      value={branch.branchDisplayName}
                      onChangeText={(text) =>
                        updateBranchField(branch.id, "branchDisplayName", text)
                      }
                      onFocus={() => setFocused({ id: branch.id, field: "branch" })}
                      onBlur={() => setFocused(null)}
                      returnKeyType="next"
                    />
                  </View>
                  <View
                    style={[
                      styles.focusBar,
                      {
                        opacity:
                          focused?.id === branch.id && focused.field === "branch"
                            ? 1
                            : 0,
                      },
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
                        validity?.isCityValid && branch.city.trim().length > 0
                          ? COLORS.accent
                          : COLORS.muted
                      }
                    />
                    <View style={{ flex: 1 }}>
                      <Picker
                        selectedValue={branch.city}
                        onValueChange={(value) => updateBranchField(branch.id, "city", value)}
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
                        validity?.isAreaValid && branch.areaLabel.trim().length > 0
                          ? COLORS.accent
                          : COLORS.muted
                      }
                    />
                    <View style={{ flex: 1 }}>
                      <Picker
                        selectedValue={branch.areaLabel}
                        onValueChange={(value) =>
                          updateBranchField(branch.id, "areaLabel", value)
                        }
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
                        validity?.isAddressValid && branch.addressLine1.trim().length > 0
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
                      value={branch.addressLine1}
                      onChangeText={(text) =>
                        updateBranchField(branch.id, "addressLine1", text)
                      }
                      onFocus={() => setFocused({ id: branch.id, field: "addr" })}
                      onBlur={() => setFocused(null)}
                      multiline
                    />
                  </View>
                  <View
                    style={[
                      styles.focusBar,
                      {
                        opacity:
                          focused?.id === branch.id && focused.field === "addr"
                            ? 1
                            : 0,
                      },
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
                        branch.googleMapsUrl.trim().length > 0
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
                      value={branch.googleMapsUrl}
                      onChangeText={(text) =>
                        updateBranchField(branch.id, "googleMapsUrl", text)
                      }
                      onFocus={() => setFocused({ id: branch.id, field: "map" })}
                      onBlur={() => setFocused(null)}
                      keyboardType="url"
                    />
                  </View>
                  <View
                    style={[
                      styles.focusBar,
                      {
                        opacity:
                          focused?.id === branch.id && focused.field === "map"
                            ? 1
                            : 0,
                      },
                    ]}
                  />
                </View>

                {validity?.mapsLooksWeird && (
                  <View style={styles.helperTextRow}>
                    <Text style={[styles.helperText, styles.helperWarning]}>
                      This doesn&apos;t look like a full link. Make sure it starts with
                      https:// and is a Google Maps URL.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}

        <Pressable
          onPress={handleAddBranch}
          style={{
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: 12,
            padding: 12,
            backgroundColor: COLORS.card,
            marginBottom: 12,
          }}
        >
          <Text style={{ color: COLORS.accent, fontWeight: "600" }}>
            + Add another branch
          </Text>
        </Pressable>

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
