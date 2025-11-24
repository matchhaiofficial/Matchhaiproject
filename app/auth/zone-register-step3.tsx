// app/auth/zone-register-step3.tsx
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

import LogoHalo from "../../src/components/LogoHalo";
import { useToast } from "../../src/hooks/useToast";
import { useZoneOnboardingStore } from "../../src/store/zoneOnboardingStore";
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

export default function ZoneRegisterStep3() {
  const { step2, step3, setStep3, setCurrentStep } = useZoneOnboardingStore();
  const { showToast } = useToast();

  const branchCount = step2.branches?.length || 1;

  // local UI state for toggles + capacities
  const [supportsCs2, setSupportsCs2] = useState(step3.supportsCs2);
  const [supportsFc25, setSupportsFc25] = useState(step3.supportsFc25);
  const [supportsTekken8, setSupportsTekken8] = useState(step3.supportsTekken8);
  const [supportsFutsal, setSupportsFutsal] = useState(step3.supportsFutsal);
  const [supportsIndoorCricket, setSupportsIndoorCricket] = useState(
    step3.supportsIndoorCricket
  );
  const [supportsPadel, setSupportsPadel] = useState(step3.supportsPadel);
  const [supportsPickleball, setSupportsPickleball] = useState(
    step3.supportsPickleball
  );

  // PC + console
  const [pcSeats, setPcSeats] = useState(step3.pcSeats || "");
  const [consoleSeats, setConsoleSeats] = useState(step3.consoleSeats || "");
  const [consolePlatform, setConsolePlatform] = useState(
    step3.consolePlatform || ""
  );

  // Courts / nets
  const [futsalCourts, setFutsalCourts] = useState(step3.futsalCourts || "");
  const [futsalCourtType, setFutsalCourtType] = useState(
    step3.futsalCourtType || ""
  );

  const [indoorCricketNets, setIndoorCricketNets] = useState(
    step3.indoorCricketNets || ""
  );
  const [indoorCricketSurface, setIndoorCricketSurface] = useState(
    step3.indoorCricketSurface || ""
  );

  const [padelCourts, setPadelCourts] = useState(step3.padelCourts || "");
  const [padelCourtSurface, setPadelCourtSurface] = useState(
    step3.padelCourtSurface || ""
  );

  const [pickleballCourts, setPickleballCourts] = useState(
    step3.pickleballCourts || ""
  );
  const [pickleballSurface, setPickleballSurface] = useState(
    step3.pickleballSurface || ""
  );

  const [notes, setNotes] = useState(step3.notes || "");

  // focus flags
  const [pcFocused, setPcFocused] = useState(false);
  const [consoleFocused, setConsoleFocused] = useState(false);
  const [notesFocused, setNotesFocused] = useState(false);

  const [futsalFocused, setFutsalFocused] = useState(false);
  const [indoorCricketFocused, setIndoorCricketFocused] = useState(false);
  const [padelFocused, setPadelFocused] = useState(false);
  const [pickleballFocused, setPickleballFocused] = useState(false);

  // ---- Validation ----
  const {
    hasAnyGame,
    pcSectionValid,
    consoleSectionValid,
    futsalSectionValid,
    indoorCricketSectionValid,
    padelSectionValid,
    pickleballSectionValid,
    hasAnyCapacity,
    pcError,
    consoleError,
    futsalError,
    indoorCricketError,
    padelError,
    pickleballError,
    isFormValid,
  } = useMemo(() => {
    const anyGame =
      supportsCs2 ||
      supportsFc25 ||
      supportsTekken8 ||
      supportsFutsal ||
      supportsIndoorCricket ||
      supportsPadel ||
      supportsPickleball;

    const toInt = (v: string) => {
      const n = Number(v.trim());
      return Number.isFinite(n) ? n : NaN;
    };

    const supportsConsoleGames = supportsFc25 || supportsTekken8;

    // PC capacity (only matters if CS2 is supported)
    const pcTrim = pcSeats.trim();
    const pcNum = toInt(pcSeats);
    const pcValidBase =
      !supportsCs2 ||
      (pcTrim.length > 0 && !Number.isNaN(pcNum) && pcNum > 0 && pcNum <= 200);
    const pcErrorText =
      supportsCs2 && pcTrim.length > 0 && !pcValidBase
        ? "Enter a number between 1 and 200."
        : "";

    // Console capacity (only if FC / Tekken supported)
    const consoleTrim = consoleSeats.trim();
    const consoleNum = toInt(consoleSeats);
    const consoleSeatsValid =
      !supportsConsoleGames ||
      (consoleTrim.length > 0 &&
        !Number.isNaN(consoleNum) &&
        consoleNum > 0 &&
        consoleNum <= 100);
    const consolePlatformValid =
      !supportsConsoleGames || !consoleTrim.length
        ? true
        : consolePlatform.trim().length > 0;

    const consoleSectionOk =
      !supportsConsoleGames ||
      (!consoleTrim.length && !consolePlatform.trim().length)
        ? true // if they didn't fill anything at all, it's optional unless no other capacity is given
        : consoleSeatsValid && consolePlatformValid;

    let consoleErrorText = "";
    if (supportsConsoleGames && consoleTrim.length > 0 && !consoleSeatsValid) {
      consoleErrorText = "Enter a number between 1 and 100.";
    } else if (
      supportsConsoleGames &&
      consoleTrim.length > 0 &&
      consoleSeatsValid &&
      !consolePlatformValid
    ) {
      consoleErrorText = "Select the console type.";
    }

    // Futsal
    const futsalTrim = futsalCourts.trim();
    const futsalNum = toInt(futsalCourts);
    const futsalCourtsValid =
      !supportsFutsal ||
      (futsalTrim.length > 0 &&
        !Number.isNaN(futsalNum) &&
        futsalNum > 0 &&
        futsalNum <= 10);
    const futsalTypeValid =
      !supportsFutsal || !futsalTrim.length
        ? true
        : futsalCourtType.trim().length > 0;

    const futsalSectionOk =
      !supportsFutsal ||
      (!futsalTrim.length && !futsalCourtType.trim().length)
        ? true
        : futsalCourtsValid && futsalTypeValid;

    let futsalErrorText = "";
    if (supportsFutsal && futsalTrim.length > 0 && !futsalCourtsValid) {
      futsalErrorText = "Enter a number between 1 and 10.";
    } else if (
      supportsFutsal &&
      futsalTrim.length > 0 &&
      futsalCourtsValid &&
      !futsalTypeValid
    ) {
      futsalErrorText = "Select the futsal court type.";
    }

    // Indoor cricket
    const icTrim = indoorCricketNets.trim();
    const icNum = toInt(indoorCricketNets);
    const icNetsValid =
      !supportsIndoorCricket ||
      (icTrim.length > 0 &&
        !Number.isNaN(icNum) &&
        icNum > 0 &&
        icNum <= 10);
    const icSurfaceValid =
      !supportsIndoorCricket || !icTrim.length
        ? true
        : indoorCricketSurface.trim().length > 0;

    const indoorCricketSectionOk =
      !supportsIndoorCricket ||
      (!icTrim.length && !indoorCricketSurface.trim().length)
        ? true
        : icNetsValid && icSurfaceValid;

    let icErrorText = "";
    if (supportsIndoorCricket && icTrim.length > 0 && !icNetsValid) {
      icErrorText = "Enter a number between 1 and 10.";
    } else if (
      supportsIndoorCricket &&
      icTrim.length > 0 &&
      icNetsValid &&
      !icSurfaceValid
    ) {
      icErrorText = "Select the indoor cricket surface.";
    }

    // Padel
    const padelTrim = padelCourts.trim();
    const padelNum = toInt(padelCourts);
    const padelCourtsValid =
      !supportsPadel ||
      (padelTrim.length > 0 &&
        !Number.isNaN(padelNum) &&
        padelNum > 0 &&
        padelNum <= 10);
    const padelSurfaceValid =
      !supportsPadel || !padelTrim.length
        ? true
        : padelCourtSurface.trim().length > 0;

    const padelSectionOk =
      !supportsPadel ||
      (!padelTrim.length && !padelCourtSurface.trim().length)
        ? true
        : padelCourtsValid && padelSurfaceValid;

    let padelErrorText = "";
    if (supportsPadel && padelTrim.length > 0 && !padelCourtsValid) {
      padelErrorText = "Enter a number between 1 and 10.";
    } else if (
      supportsPadel &&
      padelTrim.length > 0 &&
      padelCourtsValid &&
      !padelSurfaceValid
    ) {
      padelErrorText = "Select the padel court surface.";
    }

    // Pickleball
    const pickleTrim = pickleballCourts.trim();
    const pickleNum = toInt(pickleballCourts);
    const pickleCourtsValid =
      !supportsPickleball ||
      (pickleTrim.length > 0 &&
        !Number.isNaN(pickleNum) &&
        pickleNum > 0 &&
        pickleNum <= 10);
    const pickleSurfaceValid =
      !supportsPickleball || !pickleTrim.length
        ? true
        : pickleballSurface.trim().length > 0;

    const pickleballSectionOk =
      !supportsPickleball ||
      (!pickleTrim.length && !pickleballSurface.trim().length)
        ? true
        : pickleCourtsValid && pickleSurfaceValid;

    let pickleErrorText = "";
    if (supportsPickleball && pickleTrim.length > 0 && !pickleCourtsValid) {
      pickleErrorText = "Enter a number between 1 and 10.";
    } else if (
      supportsPickleball &&
      pickleTrim.length > 0 &&
      pickleCourtsValid &&
      !pickleSurfaceValid
    ) {
      pickleErrorText = "Select the pickleball surface.";
    }

    // At least one capacity across all selected offerings
    const hasCap =
      (supportsCs2 && pcTrim.length > 0 && pcValidBase) ||
      (supportsConsoleGames &&
        consoleTrim.length > 0 &&
        consoleSeatsValid &&
        consolePlatformValid) ||
      (supportsFutsal && futsalTrim.length > 0 && futsalCourtsValid) ||
      (supportsIndoorCricket && icTrim.length > 0 && icNetsValid) ||
      (supportsPadel && padelTrim.length > 0 && padelCourtsValid) ||
      (supportsPickleball && pickleTrim.length > 0 && pickleCourtsValid);

    const allSectionsValid =
      pcValidBase &&
      consoleSectionOk &&
      futsalSectionOk &&
      indoorCricketSectionOk &&
      padelSectionOk &&
      pickleballSectionOk;

    return {
      hasAnyGame: anyGame,
      pcSectionValid: pcValidBase,
      consoleSectionValid: consoleSectionOk,
      futsalSectionValid: futsalSectionOk,
      indoorCricketSectionValid: indoorCricketSectionOk,
      padelSectionValid: padelSectionOk,
      pickleballSectionValid: pickleballSectionOk,
      hasAnyCapacity: hasCap,
      pcError: pcErrorText,
      consoleError: consoleErrorText,
      futsalError: futsalErrorText,
      indoorCricketError: icErrorText,
      padelError: padelErrorText,
      pickleballError: pickleErrorText,
      isFormValid: anyGame && hasCap && allSectionsValid,
    };
  }, [
    supportsCs2,
    supportsFc25,
    supportsTekken8,
    supportsFutsal,
    supportsIndoorCricket,
    supportsPadel,
    supportsPickleball,
    pcSeats,
    consoleSeats,
    consolePlatform,
    futsalCourts,
    futsalCourtType,
    indoorCricketNets,
    indoorCricketSurface,
    padelCourts,
    padelCourtSurface,
    pickleballCourts,
    pickleballSurface,
  ]);

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
  const handleContinue = () => {
    if (!hasAnyGame) {
      showToast({
        type: "info",
        title: "Pick at least one game",
        message: "Select the games your zone supports for MatchHai bookings.",
      });
      return;
    }

    if (!hasAnyCapacity) {
      showToast({
        type: "info",
        title: "Add capacity",
        message:
          "Add at least one PC, console setup, or court so we can build fair lobbies.",
      });
      return;
    }

    if (!isFormValid) {
      showToast({
        type: "info",
        title: "Check details",
        message: "Please fix the highlighted fields before continuing.",
      });
      return;
    }

    setStep3({
      supportsCs2,
      supportsFc25,
      supportsTekken8,
      supportsFutsal,
      supportsIndoorCricket,
      supportsPadel,
      supportsPickleball,
      pcSeats: pcSeats.trim(),
      consoleSeats: consoleSeats.trim(),
      consolePlatform: consolePlatform.trim(),
      futsalCourts: futsalCourts.trim(),
      futsalCourtType: futsalCourtType.trim(),
      indoorCricketNets: indoorCricketNets.trim(),
      indoorCricketSurface: indoorCricketSurface.trim(),
      padelCourts: padelCourts.trim(),
      padelCourtSurface: padelCourtSurface.trim(),
      pickleballCourts: pickleballCourts.trim(),
      pickleballSurface: pickleballSurface.trim(),
      notes: notes.trim(),
    });

    setCurrentStep(3);
    router.push("/auth/zone-register-step4" as any);
  };

  const handleBack = () => {
    router.replace("/auth/zone-register-step2" as any);
  };

  const isSubmitDisabled = !isFormValid;

  // Helper to render a chip
  const renderGameChip = (
    label: string,
    active: boolean,
    onToggle: () => void
  ) => (
    <Pressable
      key={label}
      onPress={onToggle}
      style={[styles.optionChip, active && styles.optionChipActive]}
    >
      <Text
        style={[
          styles.optionChipText,
          active && styles.optionChipTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );

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
              <Text style={styles.stepperSubtitle}>
                Step 3 of 4 · What can players book here?
              </Text>
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

        {/* Headings */}
        <Text style={styles.heading}>What do you host at this branch?</Text>
        <Text style={styles.sub}>
          Choose the games and rough number of setups. You can fine-tune this
          later in the zone dashboard.
        </Text>
        {branchCount > 1 && (
          <View style={styles.helperTextRow}>
            <Text style={[styles.helperText, { color: COLORS.muted }]}>
              These settings apply to all branches for now. You can customize
              per-branch inventory after onboarding.
            </Text>
          </View>
        )}

        {/* Game options (chips bound to flags) */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Supported games / sports</Text>
          <View style={styles.chipRow}>
            {renderGameChip("CS2 (PC)", supportsCs2, () =>
              setSupportsCs2((v) => !v)
            )}
            {renderGameChip("FC25 / FC26", supportsFc25, () =>
              setSupportsFc25((v) => !v)
            )}
            {renderGameChip("Tekken 8", supportsTekken8, () =>
              setSupportsTekken8((v) => !v)
            )}
            {renderGameChip("Futsal", supportsFutsal, () =>
              setSupportsFutsal((v) => !v)
            )}
            {renderGameChip(
              "Indoor Cricket",
              supportsIndoorCricket,
              () => setSupportsIndoorCricket((v) => !v)
            )}
            {renderGameChip("Padel", supportsPadel, () =>
              setSupportsPadel((v) => !v)
            )}
            {renderGameChip("Pickleball", supportsPickleball, () =>
              setSupportsPickleball((v) => !v)
            )}
          </View>
          {!hasAnyGame && (
            <View style={styles.helperTextRow}>
              <Text style={[styles.helperText, styles.helperWarning]}>
                Select at least one game or sport you host.
              </Text>
            </View>
          )}
        </View>

        {/* PC setups – only if CS2 selected */}
        {supportsCs2 && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Approx. CS2 / PC setups</Text>
            <View style={styles.inputBox}>
              <View className="row" style={styles.inputRow}>
                <MaterialIcons
                  name="computer"
                  size={22}
                  style={styles.prefixIcon}
                  color={
                    pcSectionValid && pcSeats.trim().length > 0
                      ? COLORS.accent
                      : COLORS.muted
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
                  value={pcSeats}
                  onChangeText={setPcSeats}
                  onFocus={() => setPcFocused(true)}
                  onBlur={() => setPcFocused(false)}
                />
              </View>
              <View
                style={[styles.focusBar, { opacity: pcFocused ? 1 : 0 }]}
              />
            </View>
            {pcError ? (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperError]}>
                  {pcError}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Console setups – only if FC / Tekken selected */}
        {(supportsFc25 || supportsTekken8) && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Approx. console setups</Text>
            <View style={styles.inputBox}>
              <View className="row" style={styles.inputRow}>
                <MaterialIcons
                  name="sports-esports"
                  size={22}
                  style={styles.prefixIcon}
                  color={
                    consoleSectionValid && consoleSeats.trim().length > 0
                      ? COLORS.accent
                      : COLORS.muted
                  }
                />
                <TextInput
                  placeholder="e.g. 4 (Tekken / FC pods)"
                  placeholderTextColor={COLORS.muted}
                  style={[styles.input, { flex: 1 }]}
                  selectionColor={COLORS.accent}
                  keyboardType="numeric"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={consoleSeats}
                  onChangeText={setConsoleSeats}
                  onFocus={() => setConsoleFocused(true)}
                  onBlur={() => setConsoleFocused(false)}
                />
              </View>
              <View
                style={[
                  styles.focusBar,
                  { opacity: consoleFocused ? 1 : 0 },
                ]}
              />
            </View>

            {/* Console platform picker */}
            {consoleSeats.trim().length > 0 && (
              <View style={[styles.inputBox, { marginTop: 8 }]}>
                <View style={styles.inputRow}>
                  <MaterialIcons
                    name="videogame-asset"
                    size={22}
                    style={styles.prefixIcon}
                    color={
                      consoleSectionValid && consolePlatform.trim().length > 0
                        ? COLORS.accent
                        : COLORS.muted
                    }
                  />
                  <View style={{ flex: 1 }}>
                    <Picker
                      selectedValue={consolePlatform}
                      onValueChange={(value) => setConsolePlatform(value)}
                      dropdownIconColor={COLORS.muted}
                      style={{
                        color:
                          consolePlatform.trim().length > 0
                            ? COLORS.text
                            : COLORS.muted,
                        width: "100%",
                      }}
                    >
                      {CONSOLE_PLATFORM_OPTIONS.map((opt) => (
                        <Picker.Item
                          key={opt.value || opt.label}
                          label={opt.label}
                          value={opt.value}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>
            )}

            {consoleError ? (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperError]}>
                  {consoleError}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Futsal courts */}
        {supportsFutsal && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Futsal courts</Text>
            <View style={styles.inputBox}>
              <View className="row" style={styles.inputRow}>
                <MaterialIcons
                  name="sports-soccer"
                  size={22}
                  style={styles.prefixIcon}
                  color={
                    futsalSectionValid && futsalCourts.trim().length > 0
                      ? COLORS.accent
                      : COLORS.muted
                  }
                />
                <TextInput
                  placeholder="e.g. 1"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                  selectionColor={COLORS.accent}
                  keyboardType="numeric"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={futsalCourts}
                  onChangeText={setFutsalCourts}
                  onFocus={() => setFutsalFocused(true)}
                  onBlur={() => setFutsalFocused(false)}
                />
              </View>
              <View
                style={[styles.focusBar, { opacity: futsalFocused ? 1 : 0 }]}
              />
            </View>

            {futsalCourts.trim().length > 0 && (
              <View style={[styles.inputBox, { marginTop: 8 }]}>
                <View style={styles.inputRow}>
                  <MaterialIcons
                    name="layers"
                    size={22}
                    style={styles.prefixIcon}
                    color={
                      futsalSectionValid && futsalCourtType.trim().length > 0
                        ? COLORS.accent
                        : COLORS.muted
                    }
                  />
                  <View style={{ flex: 1 }}>
                    <Picker
                      selectedValue={futsalCourtType}
                      onValueChange={(value) => setFutsalCourtType(value)}
                      dropdownIconColor={COLORS.muted}
                      style={{
                        color:
                          futsalCourtType.trim().length > 0
                            ? COLORS.text
                            : COLORS.muted,
                        width: "100%",
                      }}
                    >
                      {FUTSAL_COURT_TYPES.map((opt) => (
                        <Picker.Item
                          key={opt.value || opt.label}
                          label={opt.label}
                          value={opt.value}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>
            )}

            {futsalError ? (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperError]}>
                  {futsalError}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Indoor cricket */}
        {supportsIndoorCricket && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Indoor cricket nets</Text>
            <View style={styles.inputBox}>
              <View className="row" style={styles.inputRow}>
                <MaterialIcons
                  name="sports-cricket"
                  size={22}
                  style={styles.prefixIcon}
                  color={
                    indoorCricketSectionValid &&
                    indoorCricketNets.trim().length > 0
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
                  value={indoorCricketNets}
                  onChangeText={setIndoorCricketNets}
                  onFocus={() => setIndoorCricketFocused(true)}
                  onBlur={() => setIndoorCricketFocused(false)}
                />
              </View>
              <View
                style={[
                  styles.focusBar,
                  { opacity: indoorCricketFocused ? 1 : 0 },
                ]}
              />
            </View>

            {indoorCricketNets.trim().length > 0 && (
              <View style={[styles.inputBox, { marginTop: 8 }]}>
                <View style={styles.inputRow}>
                  <MaterialIcons
                    name="layers"
                    size={22}
                    style={styles.prefixIcon}
                    color={
                      indoorCricketSectionValid &&
                      indoorCricketSurface.trim().length > 0
                        ? COLORS.accent
                        : COLORS.muted
                    }
                  />
                  <View style={{ flex: 1 }}>
                    <Picker
                      selectedValue={indoorCricketSurface}
                      onValueChange={(value) => setIndoorCricketSurface(value)}
                      dropdownIconColor={COLORS.muted}
                      style={{
                        color:
                          indoorCricketSurface.trim().length > 0
                            ? COLORS.text
                            : COLORS.muted,
                        width: "100%",
                      }}
                    >
                      {INDOOR_CRICKET_SURFACES.map((opt) => (
                        <Picker.Item
                          key={opt.value || opt.label}
                          label={opt.label}
                          value={opt.value}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>
            )}

            {indoorCricketError ? (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperError]}>
                  {indoorCricketError}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Padel */}
        {supportsPadel && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Padel courts</Text>
            <View style={styles.inputBox}>
              <View className="row" style={styles.inputRow}>
                <MaterialIcons
                  name="sports-tennis"
                  size={22}
                  style={styles.prefixIcon}
                  color={
                    padelSectionValid && padelCourts.trim().length > 0
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
                  value={padelCourts}
                  onChangeText={setPadelCourts}
                  onFocus={() => setPadelFocused(true)}
                  onBlur={() => setPadelFocused(false)}
                />
              </View>
              <View
                style={[styles.focusBar, { opacity: padelFocused ? 1 : 0 }]}
              />
            </View>

            {padelCourts.trim().length > 0 && (
              <View style={[styles.inputBox, { marginTop: 8 }]}>
                <View style={styles.inputRow}>
                  <MaterialIcons
                    name="layers"
                    size={22}
                    style={styles.prefixIcon}
                    color={
                      padelSectionValid &&
                      padelCourtSurface.trim().length > 0
                        ? COLORS.accent
                        : COLORS.muted
                    }
                  />
                  <View style={{ flex: 1 }}>
                    <Picker
                      selectedValue={padelCourtSurface}
                      onValueChange={(value) => setPadelCourtSurface(value)}
                      dropdownIconColor={COLORS.muted}
                      style={{
                        color:
                          padelCourtSurface.trim().length > 0
                            ? COLORS.text
                            : COLORS.muted,
                        width: "100%",
                      }}
                    >
                      {PADEL_SURFACES.map((opt) => (
                        <Picker.Item
                          key={opt.value || opt.label}
                          label={opt.label}
                          value={opt.value}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>
            )}

            {padelError ? (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperError]}>
                  {padelError}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Pickleball */}
        {supportsPickleball && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Pickleball courts</Text>
            <View style={styles.inputBox}>
              <View className="row" style={styles.inputRow}>
                <MaterialIcons
                  name="sports-tennis"
                  size={22}
                  style={styles.prefixIcon}
                  color={
                    pickleballSectionValid &&
                    pickleballCourts.trim().length > 0
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
                  value={pickleballCourts}
                  onChangeText={setPickleballCourts}
                  onFocus={() => setPickleballFocused(true)}
                  onBlur={() => setPickleballFocused(false)}
                />
              </View>
              <View
                style={[
                  styles.focusBar,
                  { opacity: pickleballFocused ? 1 : 0 },
                ]}
              />
            </View>

            {pickleballCourts.trim().length > 0 && (
              <View style={[styles.inputBox, { marginTop: 8 }]}>
                <View style={styles.inputRow}>
                  <MaterialIcons
                    name="layers"
                    size={22}
                    style={styles.prefixIcon}
                    color={
                      pickleballSectionValid &&
                      pickleballSurface.trim().length > 0
                        ? COLORS.accent
                        : COLORS.muted
                    }
                  />
                  <View style={{ flex: 1 }}>
                    <Picker
                      selectedValue={pickleballSurface}
                      onValueChange={(value) => setPickleballSurface(value)}
                      dropdownIconColor={COLORS.muted}
                      style={{
                        color:
                          pickleballSurface.trim().length > 0
                            ? COLORS.text
                            : COLORS.muted,
                        width: "100%",
                      }}
                    >
                      {PICKLEBALL_SURFACES.map((opt) => (
                        <Picker.Item
                          key={opt.value || opt.label}
                          label={opt.label}
                          value={opt.value}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>
            )}

            {pickleballError ? (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperError]}>
                  {pickleballError}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Global capacity warning */}
        {!hasAnyCapacity && hasAnyGame && (
          <View style={styles.helperTextRow}>
            <Text style={[styles.helperText, styles.helperWarning]}>
              Add at least one PC, console, or court so we know this branch
              can host bookings.
            </Text>
          </View>
        )}

        {/* Extra notes */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Optional notes for players</Text>
          <View style={styles.inputBox}>
            <View style={styles.inputRow}>
              <MaterialIcons
                name="info"
                size={22}
                style={styles.prefixIcon}
                color={notes.trim().length > 0 ? COLORS.accent : COLORS.muted}
              />
              <TextInput
                placeholder="House rules, parking info, smoking area, etc."
                placeholderTextColor={COLORS.muted}
                style={[styles.input, { minHeight: 60 }]}
                selectionColor={COLORS.accent}
                autoCapitalize="sentences"
                autoCorrect={false}
                value={notes}
                onChangeText={setNotes}
                onFocus={() => setNotesFocused(true)}
                onBlur={() => setNotesFocused(false)}
                multiline
              />
            </View>
            <View
              style={[styles.focusBar, { opacity: notesFocused ? 1 : 0 }]}
            />
          </View>
        </View>

        {/* Back to Step 2 */}
        <Pressable onPress={handleBack} style={styles.backLinkWrapper}>
          <Text style={styles.backLinkText}>← Back to branch & location</Text>
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
            disabled={isSubmitDisabled}
            style={({ pressed }) => [
              styles.primaryBtn,
              isSubmitDisabled && styles.primaryBtnDisabled,
              pressed && !isSubmitDisabled && { opacity: 0.92 },
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
