// app/auth/zone-register-step3.tsx
import { MaterialIcons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { Link, router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import LogoHalo from "../../src/components/LogoHalo";
import { useToast } from "../../src/hooks/useToast";
import { useZoneOnboardingStore } from "../../src/store/zoneOnboardingStore";
import type { ZoneBranchSetup } from "../../src/store/zoneOnboardingStore";
import { COLORS } from "../../src/theme";
import styles from "./register.styles";

// Console platforms
const CONSOLE_PLATFORM_OPTIONS = [
  { value: "", label: "Select console type" },
  { value: "ps5", label: "PS5" },
  { value: "ps4", label: "PS4" },
  { value: "xbox-series", label: "Xbox Series X|S" },
  { value: "xbox-one", label: "Xbox One" },
  { value: "mixed", label: "Mixed (PS + Xbox)" },
  { value: "other", label: "Other / arcade" },
];

// Futsal court types
const FUTSAL_COURT_TYPES = [
  { value: "", label: "Select court type" },
  { value: "belgian-turf", label: "Belgian turf" },
  { value: "rubber-turf", label: "Rubber / PVC turf" },
  { value: "hard-court", label: "Hard court (indoor)" },
  { value: "other", label: "Other" },
];

// Indoor cricket surfaces
const INDOOR_CRICKET_SURFACES = [
  { value: "", label: "Select surface" },
  { value: "green-turf", label: "Green turf" },
  { value: "blue-multipurpose", label: "Blue multipurpose turf" },
  { value: "cement-matting", label: "Cement wicket + matting" },
  { value: "other", label: "Other" },
];

// Padel court surfaces
const PADEL_SURFACES = [
  { value: "", label: "Select surface" },
  { value: "blue-turf", label: "Blue padel turf" },
  { value: "red-turf", label: "Red padel turf" },
  { value: "green-turf", label: "Green turf" },
  { value: "indoor", label: "Indoor padel court" },
  { value: "other", label: "Other" },
];

// Pickleball surfaces
const PICKLEBALL_SURFACES = [
  { value: "", label: "Select surface" },
  { value: "acrylic-hard", label: "Acrylic hard court" },
  { value: "concrete-acrylic", label: "Concrete + acrylic" },
  { value: "asphalt-acrylic", label: "Asphalt + acrylic" },
  { value: "indoor-wood", label: "Indoor wooden court" },
  { value: "multi-sport", label: "Multi-sport court" },
  { value: "other", label: "Other" },
];

type BranchSetupState = ZoneBranchSetup & { id: string };

type BranchValidation = {
  id: string;
  branchName: string;
  hasAnyGame: boolean;
  hasAnyCapacity: boolean;
  pcSectionValid: boolean;
  consoleSectionValid: boolean;
  futsalSectionValid: boolean;
  indoorCricketSectionValid: boolean;
  padelSectionValid: boolean;
  pickleballSectionValid: boolean;
  pcError: string;
  consoleError: string;
  futsalError: string;
  indoorCricketError: string;
  padelError: string;
  pickleballError: string;
  isFormValid: boolean;
};

function normalizeBranchSetup(setup?: ZoneBranchSetup, id?: string): BranchSetupState {
  return {
    id: id || `branch-setup-${Date.now()}`,
    branchDisplayName: setup?.branchDisplayName || "",
    supportsCs2: !!setup?.supportsCs2,
    supportsFc25: !!setup?.supportsFc25,
    supportsTekken8: !!setup?.supportsTekken8,
    supportsFutsal: !!setup?.supportsFutsal,
    supportsIndoorCricket: !!setup?.supportsIndoorCricket,
    supportsPadel: !!setup?.supportsPadel,
    supportsPickleball: !!setup?.supportsPickleball,
    pcSeats: setup?.pcSeats || "",
    consoleSeats: setup?.consoleSeats || "",
    consolePlatform: setup?.consolePlatform || "",
    futsalCourts: setup?.futsalCourts || "",
    futsalCourtType: setup?.futsalCourtType || "",
    indoorCricketNets: setup?.indoorCricketNets || "",
    indoorCricketSurface: setup?.indoorCricketSurface || "",
    padelCourts: setup?.padelCourts || "",
    padelCourtSurface: setup?.padelCourtSurface || "",
    pickleballCourts: setup?.pickleballCourts || "",
    pickleballSurface: setup?.pickleballSurface || "",
  };
}

export default function ZoneRegisterStep3() {
  const { step2, step3, setStep3, setCurrentStep } = useZoneOnboardingStore();
  const { showToast } = useToast();

  const branchesFromStep2 = useMemo(() => {
    if (step2.branches && step2.branches.length > 0) {
      return step2.branches;
    }

    if (
      step2.branchDisplayName ||
      step2.city ||
      step2.areaLabel ||
      step2.addressLine1 ||
      step2.googleMapsUrl
    ) {
      return [
        {
          branchDisplayName: step2.branchDisplayName || "",
          city: step2.city || "",
          areaLabel: step2.areaLabel || "",
          addressLine1: step2.addressLine1 || "",
          googleMapsUrl: step2.googleMapsUrl || "",
        },
      ];
    }

    return [
      {
        branchDisplayName: "",
        city: "",
        areaLabel: "",
        addressLine1: "",
        googleMapsUrl: "",
      },
    ];
  }, [step2]);

  const [branchSetups, setBranchSetups] = useState<BranchSetupState[]>(() => {
    const existing = step3.branchSetups || [];
    return branchesFromStep2.map((branch, idx) =>
      normalizeBranchSetup(
        existing[idx] || existing[0] || { branchDisplayName: branch.branchDisplayName },
        `branch-${idx}`
      )
    );
  });

  useEffect(() => {
    setBranchSetups((prev) => {
      if (branchesFromStep2.length === prev.length) return prev;
      return branchesFromStep2.map((branch, idx) =>
        normalizeBranchSetup(
          prev[idx] || prev[0] || { branchDisplayName: branch.branchDisplayName },
          `branch-${idx}`
        )
      );
    });
  }, [branchesFromStep2]);

  const [notes, setNotes] = useState(step3.notes || "");
  const [focused, setFocused] = useState<{ id: string; field: string } | null>(null);

  // ---- Validation ----
  const branchValidations = useMemo(() => {
    const toInt = (v: string) => {
      const n = Number(v.trim());
      return Number.isFinite(n) ? n : NaN;
    };

    const computeValidation = (branch: BranchSetupState): BranchValidation => {
      const supportsConsoleGames = branch.supportsFc25 || branch.supportsTekken8;

      const anyGame =
        branch.supportsCs2 ||
        branch.supportsFc25 ||
        branch.supportsTekken8 ||
        branch.supportsFutsal ||
        branch.supportsIndoorCricket ||
        branch.supportsPadel ||
        branch.supportsPickleball;

      const pcTrim = branch.pcSeats.trim();
      const pcNum = toInt(branch.pcSeats);
      const pcValidBase =
        !branch.supportsCs2 ||
        (pcTrim.length > 0 && !Number.isNaN(pcNum) && pcNum > 0 && pcNum <= 200);
      const pcErrorText =
        branch.supportsCs2 && pcTrim.length > 0 && !pcValidBase
          ? "Enter a number between 1 and 200."
          : "";

      const consoleTrim = branch.consoleSeats.trim();
      const consoleNum = toInt(branch.consoleSeats);
      const consoleSeatsValid =
        !supportsConsoleGames ||
        (consoleTrim.length > 0 && !Number.isNaN(consoleNum) && consoleNum > 0 && consoleNum <= 100);
      const consolePlatformValid =
        !supportsConsoleGames || !consoleTrim.length ? true : branch.consolePlatform.trim().length > 0;
      const consoleSectionOk =
        !supportsConsoleGames ||
        (!consoleTrim.length && !branch.consolePlatform.trim().length)
          ? true
          : consoleSeatsValid && consolePlatformValid;

      let consoleErrorText = "";
      if (supportsConsoleGames && consoleTrim.length > 0 && !consoleSeatsValid) {
        consoleErrorText = "Enter a number between 1 and 100.";
      } else if (supportsConsoleGames && consoleTrim.length > 0 && consoleSeatsValid && !consolePlatformValid) {
        consoleErrorText = "Select the console type.";
      }

      const futsalTrim = branch.futsalCourts.trim();
      const futsalNum = toInt(branch.futsalCourts);
      const futsalCourtsValid =
        !branch.supportsFutsal ||
        (futsalTrim.length > 0 && !Number.isNaN(futsalNum) && futsalNum > 0 && futsalNum <= 10);
      const futsalTypeValid =
        !branch.supportsFutsal || !futsalTrim.length ? true : branch.futsalCourtType.trim().length > 0;
      const futsalSectionOk =
        !branch.supportsFutsal ||
        (!futsalTrim.length && !branch.futsalCourtType.trim().length) ? true : futsalCourtsValid && futsalTypeValid;

      let futsalErrorText = "";
      if (branch.supportsFutsal && futsalTrim.length > 0 && !futsalCourtsValid) {
        futsalErrorText = "Enter a number between 1 and 10.";
      } else if (branch.supportsFutsal && futsalTrim.length > 0 && futsalCourtsValid && !futsalTypeValid) {
        futsalErrorText = "Select the futsal court type.";
      }

      const icTrim = branch.indoorCricketNets.trim();
      const icNum = toInt(branch.indoorCricketNets);
      const icNetsValid =
        !branch.supportsIndoorCricket ||
        (icTrim.length > 0 && !Number.isNaN(icNum) && icNum > 0 && icNum <= 10);
      const icSurfaceValid =
        !branch.supportsIndoorCricket || !icTrim.length
          ? true
          : branch.indoorCricketSurface.trim().length > 0;
      const indoorCricketSectionOk =
        !branch.supportsIndoorCricket ||
        (!icTrim.length && !branch.indoorCricketSurface.trim().length)
          ? true
          : icNetsValid && icSurfaceValid;

      let icErrorText = "";
      if (branch.supportsIndoorCricket && icTrim.length > 0 && !icNetsValid) {
        icErrorText = "Enter a number between 1 and 10.";
      } else if (
        branch.supportsIndoorCricket &&
        icTrim.length > 0 &&
        icNetsValid &&
        !icSurfaceValid
      ) {
        icErrorText = "Select the indoor cricket surface.";
      }

      const padelTrim = branch.padelCourts.trim();
      const padelNum = toInt(branch.padelCourts);
      const padelCourtsValid =
        !branch.supportsPadel ||
        (padelTrim.length > 0 && !Number.isNaN(padelNum) && padelNum > 0 && padelNum <= 10);
      const padelSurfaceValid =
        !branch.supportsPadel || !padelTrim.length ? true : branch.padelCourtSurface.trim().length > 0;
      const padelSectionOk =
        !branch.supportsPadel ||
        (!padelTrim.length && !branch.padelCourtSurface.trim().length) ? true : padelCourtsValid && padelSurfaceValid;

      let padelErrorText = "";
      if (branch.supportsPadel && padelTrim.length > 0 && !padelCourtsValid) {
        padelErrorText = "Enter a number between 1 and 10.";
      } else if (branch.supportsPadel && padelTrim.length > 0 && padelCourtsValid && !padelSurfaceValid) {
        padelErrorText = "Select the padel court surface.";
      }

      const pickleTrim = branch.pickleballCourts.trim();
      const pickleNum = toInt(branch.pickleballCourts);
      const pickleCourtsValid =
        !branch.supportsPickleball ||
        (pickleTrim.length > 0 && !Number.isNaN(pickleNum) && pickleNum > 0 && pickleNum <= 10);
      const pickleSurfaceValid =
        !branch.supportsPickleball || !pickleTrim.length
          ? true
          : branch.pickleballSurface.trim().length > 0;
      const pickleballSectionOk =
        !branch.supportsPickleball ||
        (!pickleTrim.length && !branch.pickleballSurface.trim().length)
          ? true
          : pickleCourtsValid && pickleSurfaceValid;

      let pickleballErrorText = "";
      if (branch.supportsPickleball && pickleTrim.length > 0 && !pickleCourtsValid) {
        pickleballErrorText = "Enter a number between 1 and 10.";
      } else if (
        branch.supportsPickleball &&
        pickleTrim.length > 0 &&
        pickleCourtsValid &&
        !pickleSurfaceValid
      ) {
        pickleballErrorText = "Select the pickleball surface.";
      }

      const hasCap =
        (branch.supportsCs2 && pcTrim.length > 0 && pcValidBase) ||
        (supportsConsoleGames && consoleTrim.length > 0 && consoleSeatsValid && consolePlatformValid) ||
        (branch.supportsFutsal && futsalTrim.length > 0 && futsalCourtsValid) ||
        (branch.supportsIndoorCricket && icTrim.length > 0 && icNetsValid) ||
        (branch.supportsPadel && padelTrim.length > 0 && padelCourtsValid) ||
        (branch.supportsPickleball && pickleTrim.length > 0 && pickleCourtsValid);

      const allSectionsValid =
        pcValidBase &&
        consoleSectionOk &&
        futsalSectionOk &&
        indoorCricketSectionOk &&
        padelSectionOk &&
        pickleballSectionOk;

      return {
        id: branch.id,
        branchName: branch.branchDisplayName || "Branch",
        hasAnyGame: anyGame,
        hasAnyCapacity: hasCap,
        pcSectionValid: pcValidBase,
        consoleSectionValid: consoleSectionOk,
        futsalSectionValid: futsalSectionOk,
        indoorCricketSectionValid: indoorCricketSectionOk,
        padelSectionValid: padelSectionOk,
        pickleballSectionValid: pickleballSectionOk,
        pcError: pcErrorText,
        consoleError: consoleErrorText,
        futsalError: futsalErrorText,
        indoorCricketError: icErrorText,
        padelError: padelErrorText,
        pickleballError: pickleballErrorText,
        isFormValid: anyGame && hasCap && allSectionsValid,
      };
    };

    return branchSetups.map((branch) => computeValidation(branch));
  }, [branchSetups]);

  const Container: any = Platform.OS === "ios" ? KeyboardAvoidingView : View;
  const containerProps =
    Platform.OS === "ios"
      ? {
          style: styles.screen,
          behavior: "padding" as const,
          keyboardVerticalOffset: 0,
        }
      : { style: styles.screen };

  // ---- Handlers ----
  const updateBranchSetup = (
    id: string,
    updater: (prev: BranchSetupState) => BranchSetupState
  ) => {
    setBranchSetups((prev) => prev.map((branch) => (branch.id === id ? updater(branch) : branch)));
  };

  const handleContinue = () => {
    const firstIssue = branchValidations.find((v) => !v.isFormValid);

    if (firstIssue) {
      if (!firstIssue.hasAnyGame) {
        showToast({
          type: "info",
          title: "Pick games",
          message: `Select at least one game or sport for ${firstIssue.branchName}.`,
        });
        return;
      }

      if (!firstIssue.hasAnyCapacity) {
        showToast({
          type: "info",
          title: "Add setups",
          message: `Add at least one setup or court for ${firstIssue.branchName} to continue.`,
        });
        return;
      }

      showToast({
        type: "info",
        title: "Check branch details",
        message: `Please fix the highlighted fields for ${firstIssue.branchName}.`,
      });
      return;
    }

    const trimmedSetups: ZoneBranchSetup[] = branchSetups.map((branch, idx) => ({
      branchDisplayName: branchesFromStep2[idx]?.branchDisplayName || branch.branchDisplayName || "",
      supportsCs2: branch.supportsCs2,
      supportsFc25: branch.supportsFc25,
      supportsTekken8: branch.supportsTekken8,
      supportsFutsal: branch.supportsFutsal,
      supportsIndoorCricket: branch.supportsIndoorCricket,
      supportsPadel: branch.supportsPadel,
      supportsPickleball: branch.supportsPickleball,
      pcSeats: branch.pcSeats.trim(),
      consoleSeats: branch.consoleSeats.trim(),
      consolePlatform: branch.consolePlatform.trim(),
      futsalCourts: branch.futsalCourts.trim(),
      futsalCourtType: branch.futsalCourtType.trim(),
      indoorCricketNets: branch.indoorCricketNets.trim(),
      indoorCricketSurface: branch.indoorCricketSurface.trim(),
      padelCourts: branch.padelCourts.trim(),
      padelCourtSurface: branch.padelCourtSurface.trim(),
      pickleballCourts: branch.pickleballCourts.trim(),
      pickleballSurface: branch.pickleballSurface.trim(),
    }));

    setStep3({
      branchSetups: trimmedSetups,
      notes: notes.trim(),
    });

    setCurrentStep(3);
    router.push("/auth/zone-register-step4" as any);
  };

  const handleBack = () => {
    router.replace("/auth/zone-register-step2" as any);
  };

  const renderGameChip = (
    label: string,
    active: boolean,
    onToggle: () => void
  ) => (
    <Pressable key={label} onPress={onToggle} style={[styles.optionChip, active && styles.optionChipActive]}>
      <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>{label}</Text>
    </Pressable>
  );

  const renderBranchCard = (branch: BranchSetupState, index: number, validation: BranchValidation) => {
    const branchLabel = branch.branchDisplayName?.trim() || `Branch ${index + 1}`;
    const focusFor = (field: string) => focused?.id === branch.id && focused.field === field;

    return (
      <View key={branch.id} style={[styles.reviewSectionCard, { marginTop: index === 0 ? 0 : 16 }]}>
        <Text style={styles.heading}>{branchLabel}</Text>
        <Text style={styles.sub}>
          Choose the games and rough number of setups for this location. You can fine-tune later in the
          dashboard.
        </Text>

        <View style={[styles.fieldGroup, { marginTop: 12 }]}>
          <Text style={styles.label}>Supported games / sports</Text>
          <View style={styles.chipRow}>
            {renderGameChip("CS2 (PC)", branch.supportsCs2, () =>
              updateBranchSetup(branch.id, (prev) => ({ ...prev, supportsCs2: !prev.supportsCs2 }))
            )}
            {renderGameChip("FC25 / FC26", branch.supportsFc25, () =>
              updateBranchSetup(branch.id, (prev) => ({ ...prev, supportsFc25: !prev.supportsFc25 }))
            )}
            {renderGameChip("Tekken 8", branch.supportsTekken8, () =>
              updateBranchSetup(branch.id, (prev) => ({ ...prev, supportsTekken8: !prev.supportsTekken8 }))
            )}
            {renderGameChip("Futsal", branch.supportsFutsal, () =>
              updateBranchSetup(branch.id, (prev) => ({ ...prev, supportsFutsal: !prev.supportsFutsal }))
            )}
            {renderGameChip("Indoor Cricket", branch.supportsIndoorCricket, () =>
              updateBranchSetup(branch.id, (prev) => ({ ...prev, supportsIndoorCricket: !prev.supportsIndoorCricket }))
            )}
            {renderGameChip("Padel", branch.supportsPadel, () =>
              updateBranchSetup(branch.id, (prev) => ({ ...prev, supportsPadel: !prev.supportsPadel }))
            )}
            {renderGameChip("Pickleball", branch.supportsPickleball, () =>
              updateBranchSetup(branch.id, (prev) => ({ ...prev, supportsPickleball: !prev.supportsPickleball }))
            )}
          </View>
          {!validation.hasAnyGame && (
            <View style={styles.helperTextRow}>
              <Text style={[styles.helperText, styles.helperWarning]}>
                Select at least one game or sport you host at this branch.
              </Text>
            </View>
          )}
        </View>

        {branch.supportsCs2 && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Approx. CS2 / PC setups</Text>
            <View style={styles.inputBox}>
              <View className="row" style={styles.inputRow}>
                <MaterialIcons
                  name="computer"
                  size={22}
                  style={styles.prefixIcon}
                  color={
                    validation.pcSectionValid && branch.pcSeats.trim().length > 0 ? COLORS.accent : COLORS.muted
                  }
                />
                <TextInput
                  placeholder="e.g. 10"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                  selectionColor={COLORS.accent}
                  keyboardType="numeric"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={branch.pcSeats}
                  onChangeText={(text) =>
                    updateBranchSetup(branch.id, (prev) => ({
                      ...prev,
                      pcSeats: text,
                    }))
                  }
                  onFocus={() => setFocused({ id: branch.id, field: "pc" })}
                  onBlur={() => setFocused(null)}
                />
              </View>
              <View style={[styles.focusBar, { opacity: focusFor("pc") ? 1 : 0 }]} />
            </View>

            {validation.pcError ? (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperError]}>{validation.pcError}</Text>
              </View>
            ) : null}
          </View>
        )}

        {(branch.supportsFc25 || branch.supportsTekken8) && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Approx. console pods</Text>
            <View style={styles.inputBox}>
              <View className="row" style={styles.inputRow}>
                <MaterialIcons
                  name="sports-esports"
                  size={22}
                  style={styles.prefixIcon}
                  color={
                    validation.consoleSectionValid && branch.consoleSeats.trim().length > 0
                      ? COLORS.accent
                      : COLORS.muted
                  }
                />
                <TextInput
                  placeholder="e.g. 6"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                  selectionColor={COLORS.accent}
                  keyboardType="numeric"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={branch.consoleSeats}
                  onChangeText={(text) =>
                    updateBranchSetup(branch.id, (prev) => ({
                      ...prev,
                      consoleSeats: text,
                    }))
                  }
                  onFocus={() => setFocused({ id: branch.id, field: "console" })}
                  onBlur={() => setFocused(null)}
                />
              </View>
              <View style={[styles.focusBar, { opacity: focusFor("console") ? 1 : 0 }]} />
            </View>

            {branch.consoleSeats.trim().length > 0 && (
              <View style={[styles.inputBox, { marginTop: 8 }]}> 
                <View style={styles.inputRow}>
                  <MaterialIcons
                    name="videogame-asset"
                    size={22}
                    style={styles.prefixIcon}
                    color={
                      validation.consoleSectionValid && branch.consolePlatform.trim().length > 0
                        ? COLORS.accent
                        : COLORS.muted
                    }
                  />
                  <View style={{ flex: 1 }}>
                    <Picker
                      selectedValue={branch.consolePlatform}
                      onValueChange={(value) =>
                        updateBranchSetup(branch.id, (prev) => ({
                          ...prev,
                          consolePlatform: String(value),
                        }))
                      }
                      dropdownIconColor={COLORS.muted}
                      style={{
                        color: branch.consolePlatform.trim().length > 0 ? COLORS.text : COLORS.muted,
                        width: "100%",
                      }}
                    >
                      {CONSOLE_PLATFORM_OPTIONS.map((opt) => (
                        <Picker.Item key={opt.value || opt.label} label={opt.label} value={opt.value} />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>
            )}

            {validation.consoleError ? (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperError]}>{validation.consoleError}</Text>
              </View>
            ) : null}
          </View>
        )}

        {branch.supportsFutsal && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Futsal courts</Text>
            <View style={styles.inputBox}>
              <View className="row" style={styles.inputRow}>
                <MaterialIcons
                  name="sports-soccer"
                  size={22}
                  style={styles.prefixIcon}
                  color={
                    validation.futsalSectionValid && branch.futsalCourts.trim().length > 0
                      ? COLORS.accent
                      : COLORS.muted
                  }
                />
                <TextInput
                  placeholder="e.g. 2"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                  selectionColor={COLORS.accent}
                  keyboardType="numeric"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={branch.futsalCourts}
                  onChangeText={(text) =>
                    updateBranchSetup(branch.id, (prev) => ({
                      ...prev,
                      futsalCourts: text,
                    }))
                  }
                  onFocus={() => setFocused({ id: branch.id, field: "futsal" })}
                  onBlur={() => setFocused(null)}
                />
              </View>
              <View style={[styles.focusBar, { opacity: focusFor("futsal") ? 1 : 0 }]} />
            </View>

            {branch.futsalCourts.trim().length > 0 && (
              <View style={[styles.inputBox, { marginTop: 8 }]}> 
                <View style={styles.inputRow}>
                  <MaterialIcons
                    name="grass"
                    size={22}
                    style={styles.prefixIcon}
                    color={
                      validation.futsalSectionValid && branch.futsalCourtType.trim().length > 0
                        ? COLORS.accent
                        : COLORS.muted
                    }
                  />
                  <View style={{ flex: 1 }}>
                    <Picker
                      selectedValue={branch.futsalCourtType}
                      onValueChange={(value) =>
                        updateBranchSetup(branch.id, (prev) => ({
                          ...prev,
                          futsalCourtType: String(value),
                        }))
                      }
                      dropdownIconColor={COLORS.muted}
                      style={{
                        color: branch.futsalCourtType.trim().length > 0 ? COLORS.text : COLORS.muted,
                        width: "100%",
                      }}
                    >
                      {FUTSAL_COURT_TYPES.map((opt) => (
                        <Picker.Item key={opt.value || opt.label} label={opt.label} value={opt.value} />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>
            )}

            {validation.futsalError ? (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperError]}>{validation.futsalError}</Text>
              </View>
            ) : null}
          </View>
        )}

        {branch.supportsIndoorCricket && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Indoor cricket nets</Text>
            <View style={styles.inputBox}>
              <View className="row" style={styles.inputRow}>
                <MaterialIcons
                  name="sports-cricket"
                  size={22}
                  style={styles.prefixIcon}
                  color={
                    validation.indoorCricketSectionValid && branch.indoorCricketNets.trim().length > 0
                      ? COLORS.accent
                      : COLORS.muted
                  }
                />
                <TextInput
                  placeholder="e.g. 3"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                  selectionColor={COLORS.accent}
                  keyboardType="numeric"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={branch.indoorCricketNets}
                  onChangeText={(text) =>
                    updateBranchSetup(branch.id, (prev) => ({
                      ...prev,
                      indoorCricketNets: text,
                    }))
                  }
                  onFocus={() => setFocused({ id: branch.id, field: "ic" })}
                  onBlur={() => setFocused(null)}
                />
              </View>
              <View style={[styles.focusBar, { opacity: focusFor("ic") ? 1 : 0 }]} />
            </View>

            {branch.indoorCricketNets.trim().length > 0 && (
              <View style={[styles.inputBox, { marginTop: 8 }]}> 
                <View style={styles.inputRow}>
                  <MaterialIcons
                    name="layers"
                    size={22}
                    style={styles.prefixIcon}
                    color={
                      validation.indoorCricketSectionValid && branch.indoorCricketSurface.trim().length > 0
                        ? COLORS.accent
                        : COLORS.muted
                    }
                  />
                  <View style={{ flex: 1 }}>
                    <Picker
                      selectedValue={branch.indoorCricketSurface}
                      onValueChange={(value) =>
                        updateBranchSetup(branch.id, (prev) => ({
                          ...prev,
                          indoorCricketSurface: String(value),
                        }))
                      }
                      dropdownIconColor={COLORS.muted}
                      style={{
                        color: branch.indoorCricketSurface.trim().length > 0 ? COLORS.text : COLORS.muted,
                        width: "100%",
                      }}
                    >
                      {INDOOR_CRICKET_SURFACES.map((opt) => (
                        <Picker.Item key={opt.value || opt.label} label={opt.label} value={opt.value} />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>
            )}

            {validation.indoorCricketError ? (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperError]}>{validation.indoorCricketError}</Text>
              </View>
            ) : null}
          </View>
        )}

        {branch.supportsPadel && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Padel courts</Text>
            <View style={styles.inputBox}>
              <View className="row" style={styles.inputRow}>
                <MaterialIcons
                  name="sports-tennis"
                  size={22}
                  style={styles.prefixIcon}
                  color={
                    validation.padelSectionValid && branch.padelCourts.trim().length > 0
                      ? COLORS.accent
                      : COLORS.muted
                  }
                />
                <TextInput
                  placeholder="e.g. 2"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                  selectionColor={COLORS.accent}
                  keyboardType="numeric"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={branch.padelCourts}
                  onChangeText={(text) =>
                    updateBranchSetup(branch.id, (prev) => ({
                      ...prev,
                      padelCourts: text,
                    }))
                  }
                  onFocus={() => setFocused({ id: branch.id, field: "padel" })}
                  onBlur={() => setFocused(null)}
                />
              </View>
              <View style={[styles.focusBar, { opacity: focusFor("padel") ? 1 : 0 }]} />
            </View>

            {branch.padelCourts.trim().length > 0 && (
              <View style={[styles.inputBox, { marginTop: 8 }]}> 
                <View style={styles.inputRow}>
                  <MaterialIcons
                    name="layers"
                    size={22}
                    style={styles.prefixIcon}
                    color={
                      validation.padelSectionValid && branch.padelCourtSurface.trim().length > 0
                        ? COLORS.accent
                        : COLORS.muted
                    }
                  />
                  <View style={{ flex: 1 }}>
                    <Picker
                      selectedValue={branch.padelCourtSurface}
                      onValueChange={(value) =>
                        updateBranchSetup(branch.id, (prev) => ({
                          ...prev,
                          padelCourtSurface: String(value),
                        }))
                      }
                      dropdownIconColor={COLORS.muted}
                      style={{
                        color: branch.padelCourtSurface.trim().length > 0 ? COLORS.text : COLORS.muted,
                        width: "100%",
                      }}
                    >
                      {PADEL_SURFACES.map((opt) => (
                        <Picker.Item key={opt.value || opt.label} label={opt.label} value={opt.value} />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>
            )}

            {validation.padelError ? (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperError]}>{validation.padelError}</Text>
              </View>
            ) : null}
          </View>
        )}

        {branch.supportsPickleball && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Pickleball courts</Text>
            <View style={styles.inputBox}>
              <View className="row" style={styles.inputRow}>
                <MaterialIcons
                  name="sports"
                  size={22}
                  style={styles.prefixIcon}
                  color={
                    validation.pickleballSectionValid && branch.pickleballCourts.trim().length > 0
                      ? COLORS.accent
                      : COLORS.muted
                  }
                />
                <TextInput
                  placeholder="e.g. 4"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                  selectionColor={COLORS.accent}
                  keyboardType="numeric"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={branch.pickleballCourts}
                  onChangeText={(text) =>
                    updateBranchSetup(branch.id, (prev) => ({
                      ...prev,
                      pickleballCourts: text,
                    }))
                  }
                  onFocus={() => setFocused({ id: branch.id, field: "pickle" })}
                  onBlur={() => setFocused(null)}
                />
              </View>
              <View style={[styles.focusBar, { opacity: focusFor("pickle") ? 1 : 0 }]} />
            </View>

            {branch.pickleballCourts.trim().length > 0 && (
              <View style={[styles.inputBox, { marginTop: 8 }]}> 
                <View style={styles.inputRow}>
                  <MaterialIcons
                    name="layers"
                    size={22}
                    style={styles.prefixIcon}
                    color={
                      validation.pickleballSectionValid && branch.pickleballSurface.trim().length > 0
                        ? COLORS.accent
                        : COLORS.muted
                    }
                  />
                  <View style={{ flex: 1 }}>
                    <Picker
                      selectedValue={branch.pickleballSurface}
                      onValueChange={(value) =>
                        updateBranchSetup(branch.id, (prev) => ({
                          ...prev,
                          pickleballSurface: String(value),
                        }))
                      }
                      dropdownIconColor={COLORS.muted}
                      style={{
                        color: branch.pickleballSurface.trim().length > 0 ? COLORS.text : COLORS.muted,
                        width: "100%",
                      }}
                    >
                      {PICKLEBALL_SURFACES.map((opt) => (
                        <Picker.Item key={opt.value || opt.label} label={opt.label} value={opt.value} />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>
            )}

            {validation.pickleballError ? (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperError]}>{validation.pickleballError}</Text>
              </View>
            ) : null}
          </View>
        )}
      </View>
    );
  };

  const branchCount = branchSetups.length;
  const isSubmitDisabled = branchValidations.some((v) => !v.isFormValid);

  return (
    <Container {...containerProps}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <LogoHalo />

        {/* Stepper: Step 3 of 4 */}
        <View style={styles.stepperWrapper}>
          <View style={styles.stepperTopRow}>
            <View>
              <Text style={styles.stepperTitle}>Games & setups</Text>
              <Text style={styles.stepperSubtitle}>Step 3 of 4 · What can players book at each branch?</Text>
            </View>
          </View>
          <View style={styles.stepperBar}>
            <View style={[styles.stepperBarFill, { width: "75%" }]} />
          </View>
        <View style={styles.stepperDotsRow}>
          <View style={[styles.stepperDot, styles.stepperDotActive]} />
          <View style={[styles.stepperDot, styles.stepperDotActive]} />
          <View style={[styles.stepperDot, styles.stepperDotActive]} />
          <View style={styles.stepperDot} />
        </View>
      </View>

      {branchCount > 1 && (
        <View style={styles.helperTextRow}>
          <Text style={[styles.helperText, { color: COLORS.muted }]}>
            These settings apply to all branches for now. You can customize per-branch inventory after
            onboarding.
          </Text>
        </View>
      )}

      {branchSetups.map((branch, idx) => renderBranchCard(branch, idx, branchValidations[idx]))}

        <View style={[styles.fieldGroup, { marginTop: 16 }]}>
          <Text style={styles.label}>Notes for the MatchHai team (optional)</Text>
          <View style={styles.inputBox}>
            <View style={styles.inputRow}>
              <MaterialIcons
                name="sticky-note-2"
                size={22}
                style={styles.prefixIcon}
                color={notes.trim().length > 0 ? COLORS.accent : COLORS.muted}
              />
              <TextInput
                placeholder="Any special setups, timings, or hosting notes for all branches"
                placeholderTextColor={COLORS.muted}
                style={[styles.input, { height: 80, textAlignVertical: "top" }]}
                selectionColor={COLORS.accent}
                multiline
                value={notes}
                onChangeText={setNotes}
                onFocus={() => setFocused({ id: "notes", field: "notes" })}
                onBlur={() => setFocused(null)}
              />
            </View>
            <View style={[styles.focusBar, { opacity: focused?.id === "notes" ? 1 : 0 }]} />
          </View>
        </View>

        {/* Back to step 2 */}
        <Pressable onPress={handleBack} style={styles.backLinkWrapper}>
          <Text style={styles.backLinkText}>← Back to branch details</Text>
        </Pressable>

        {/* Continue button */}
        <View
          style={[
            styles.buttonShadowWrapper,
            !isSubmitDisabled && styles.buttonShadowWrapperActive,
          ]}
        >
          <Pressable
            onPress={handleContinue}
            disabled={isSubmitDisabled}
            style={({ pressed }) => [
              styles.primaryBtn,
              isSubmitDisabled ? styles.primaryBtnDisabled : null,
              pressed && !isSubmitDisabled && { opacity: 0.92 },
            ]}
            android_ripple={{ color: "rgba(255,255,255,0.08)" }}
          >
            <Text style={styles.primaryBtnText}>Continue</Text>
          </Pressable>
        </View>

        {/* Footer / login link */}
        <View style={{ alignItems: "center" }}>
          <Text style={styles.bottomText}>Already onboarded?</Text>
          <Link href="/auth/login" asChild>
            <Pressable>
              <Text style={styles.backLinkText}>Sign in instead</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </Container>
  );
}
