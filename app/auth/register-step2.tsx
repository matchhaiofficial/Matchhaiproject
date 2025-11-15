import { MaterialIcons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  CS2_ROLES,
  FC_FORMATIONS,
  GAME_OPTIONS,
  KARACHI_AREAS,
  TEKKEN_CHARACTERS,
} from "../../constants/profileOptions";
import LogoHalo from "../../src/components/LogoHalo";
import { useOnboardingStore } from "../../src/store/onboardingStore";
import { COLORS } from "../../src/theme";
import styles from "./register.styles";

type Cs2Role = (typeof CS2_ROLES)[number];
type FcFormation = (typeof FC_FORMATIONS)[number];
type TekkenCharacter = (typeof TEKKEN_CHARACTERS)[number];

export default function RegisterStep2() {
  console.log("[Step2] mounted");
  const { step2, setStep2 } = useOnboardingStore();

  // ---- State ----
  const [selectedAreas, setSelectedAreas] = useState<string[]>(
    step2.selectedAreas
  );

  const [playsCs2, setPlaysCs2] = useState<boolean>(step2.playsCs2);
  const [playsFc, setPlaysFc] = useState<boolean>(step2.playsFc);
  const [playsTekken, setPlaysTekken] = useState<boolean>(step2.playsTekken);

  const [cs2Role, setCs2Role] = useState<Cs2Role | null>(
    (step2.cs2Role as Cs2Role) || null
  );

  const [fcTeam, setFcTeam] = useState(step2.fcTeam);
  const [fcFormation, setFcFormation] = useState<FcFormation | null>(
    (step2.fcFormation as FcFormation) || null
  );

  const [tekkenFavorites, setTekkenFavorites] = useState<TekkenCharacter[]>(
    step2.tekkenFavorites as TekkenCharacter[]
  );

  // ---- Validation ----
  const {
    isLocationValid,
    hasAnyGame,
    isCs2Valid,
    isFcValid,
    isTekkenValid,
    isFormValid,
  } = useMemo(() => {
    const locationValid = selectedAreas.length > 0;
    const anyGame = playsCs2 || playsFc || playsTekken;
    const cs2Valid = !playsCs2 || !!cs2Role;

    const fcTeamValid = !playsFc || fcTeam.trim().length >= 2;
    const fcFormationValid = !playsFc || !!fcFormation;

    const tekkenValid = !playsTekken || tekkenFavorites.length > 0;

    return {
      isLocationValid: locationValid,
      hasAnyGame: anyGame,
      isCs2Valid: cs2Valid,
      isFcValid: fcTeamValid && fcFormationValid,
      isTekkenValid: tekkenValid,
      isFormValid:
        locationValid &&
        anyGame &&
        cs2Valid &&
        fcTeamValid &&
        fcFormationValid &&
        tekkenValid,
    };
  }, [
    selectedAreas,
    playsCs2,
    playsFc,
    playsTekken,
    cs2Role,
    fcTeam,
    fcFormation,
    tekkenFavorites,
  ]);

  // ---- Keyboard handling ----
  const Container: any = Platform.OS === "ios" ? KeyboardAvoidingView : View;
  const containerProps =
    Platform.OS === "ios"
      ? {
          style: styles.screen,
          behavior: "padding" as const,
          keyboardVerticalOffset: 0,
        }
      : { style: styles.screen };

  // ---- Helpers ----
  const toggleArea = (area: string) => {
    setSelectedAreas((prev) => {
      const isSelected = prev.includes(area);
      if (isSelected) {
        return prev.filter((a) => a !== area);
      }
      if (prev.length >= 5) {
        Alert.alert(
          "Limit reached",
          "You can select up to 5 areas where you want to play."
        );
        return prev;
      }
      return [...prev, area];
    });
  };

  const toggleGame = (key: "cs2" | "fc26" | "tekken8") => {
    if (key === "cs2") {
      setPlaysCs2((prev: boolean) => !prev);
      if (playsCs2) setCs2Role(null);
    }
    if (key === "fc26") {
      setPlaysFc((prev: boolean) => !prev);
      if (playsFc) {
        setFcTeam("");
        setFcFormation(null);
      }
    }
    if (key === "tekken8") {
      setPlaysTekken((prev: boolean) => !prev);
      if (playsTekken) setTekkenFavorites([]);
    }
  };

  const toggleTekkenCharacter = (char: TekkenCharacter) => {
    setTekkenFavorites((prev) => {
      if (prev.includes(char)) {
        return prev.filter((c) => c !== char);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, char];
    });
  };

  // ---- Submit (LOCAL ONLY) ----
  const handleContinue = () => {
    if (!isFormValid) {
      Alert.alert(
        "Check details",
        "Please select your area(s), choose at least one game, and fill the required preferences."
      );
      return;
    }

    console.log("[Step2] saving and going to step 3");

    setStep2({
      selectedAreas,
      playsCs2,
      playsFc,
      playsTekken,
      cs2Role: cs2Role ?? null,
      fcTeam: fcTeam.trim(),
      fcFormation: fcFormation ?? null,
      tekkenFavorites,
    });

    router.push("/auth/register-step3");
  };

  return (
    <Container {...containerProps}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <LogoHalo />

        {/* Stepper: Step 2 of 4 */}
        <View style={styles.stepperWrapper}>
          <View style={styles.stepperTopRow}>
            <View>
              <Text style={styles.stepperTitle}>Location & games</Text>
              <Text style={styles.stepperSubtitle}>
                Step 2 of 4 · Where you play and what you play
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
        <Text style={styles.heading}>Where do you queue from?</Text>
        <Text style={styles.sub}>
          Tell us your areas and favourite games so we can match you with the
          right squad.
        </Text>

        {/* Location */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Your areas in Karachi (up to 5)</Text>
          <View style={styles.chipRow}>
            {KARACHI_AREAS.map((area) => {
              const active = selectedAreas.includes(area);
              return (
                <Pressable
                  key={area}
                  onPress={() => toggleArea(area)}
                  style={({ pressed }) => [
                    styles.optionChip,
                    active && styles.optionChipActive,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      active && styles.optionChipTextActive,
                    ]}
                  >
                    {area}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.helperTextRow}>
            <Text style={[styles.helperText, styles.helperWarning]}>
              Select up to 5 locations. ({selectedAreas.length}/5)
            </Text>
          </View>
          {!isLocationValid && (
            <View style={styles.helperTextRow}>
              <Text style={[styles.helperText, styles.helperWarning]}>
                Please pick at least one area (you can choose up to 5).
              </Text>
            </View>
          )}
        </View>

        {/* Games */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Which games do you play regularly?</Text>
          <View style={styles.chipRow}>
            {GAME_OPTIONS.map((game) => {
              const active =
                (game.key === "cs2" && playsCs2) ||
                (game.key === "fc26" && playsFc) ||
                (game.key === "tekken8" && playsTekken);

              return (
                <Pressable
                  key={game.key}
                  onPress={() =>
                    toggleGame(game.key as "cs2" | "fc26" | "tekken8")
                  }
                  style={({ pressed }) => [
                    styles.optionChip,
                    active && styles.optionChipActive,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      active && styles.optionChipTextActive,
                    ]}
                  >
                    {game.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {!hasAnyGame && (
            <View style={styles.helperTextRow}>
              <Text style={[styles.helperText, styles.helperWarning]}>
                Select at least one game. You can add more later.
              </Text>
            </View>
          )}
        </View>

        {/* CS2 section */}
        {playsCs2 && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>CS2 · What’s your main role?</Text>
            <View style={styles.chipRow}>
              {CS2_ROLES.map((role) => {
                const active = cs2Role === role;
                return (
                  <Pressable
                    key={role}
                    onPress={() => setCs2Role(role)}
                    style={({ pressed }) => [
                      styles.optionChip,
                      active && styles.optionChipActive,
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        active && styles.optionChipTextActive,
                      ]}
                    >
                      {role}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {!isCs2Valid && (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperWarning]}>
                  Pick the role you mainly play. You can change it later.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* FC 26 section */}
        {playsFc && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>FC 26 · Favourite team</Text>
            <View style={[styles.inputBox, styles.inputRow]}>
              <MaterialIcons
                name="sports-soccer"
                size={20}
                style={styles.prefixIcon}
                color={fcTeam.trim().length > 0 ? COLORS.accent : COLORS.muted}
              />
              <TextInput
                placeholder="e.g. Real Madrid, Liverpool"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                selectionColor={COLORS.accent}
                autoCapitalize="words"
                autoCorrect
                value={fcTeam}
                onChangeText={setFcTeam}
              />
            </View>
            {!isFcValid && fcTeam.trim().length === 0 && (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperWarning]}>
                  Add your favourite club. You can change it later.
                </Text>
              </View>
            )}

            <Text style={[styles.label, { marginTop: 10 }]}>
              FC 26 · Preferred formation
            </Text>
            <View style={styles.chipRow}>
              {FC_FORMATIONS.map((form) => {
                const active = fcFormation === form;
                return (
                  <Pressable
                    key={form}
                    onPress={() => setFcFormation(form)}
                    style={({ pressed }) => [
                      styles.optionChip,
                      active && styles.optionChipActive,
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        active && styles.optionChipTextActive,
                      ]}
                    >
                      {form}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {!isFcValid && (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperWarning]}>
                  Choose at least one formation you like.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Tekken 8 section */}
        {playsTekken && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Tekken 8 · Favourite characters</Text>
            <View style={styles.chipRow}>
              {TEKKEN_CHARACTERS.map((char) => {
                const active = tekkenFavorites.includes(char);
                return (
                  <Pressable
                    key={char}
                    onPress={() => toggleTekkenCharacter(char)}
                    style={({ pressed }) => [
                      styles.optionChip,
                      active && styles.optionChipActive,
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        active && styles.optionChipTextActive,
                      ]}
                    >
                      {char}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.helperTextRow}>
              <Text style={[styles.helperText, styles.helperWarning]}>
                Select up to 3 mains. ({tekkenFavorites.length}/3 selected)
              </Text>
            </View>
            {!isTekkenValid && (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperError]}>
                  Pick at least one favourite character.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Back to Step 1 */}
        <Pressable
          onPress={() => {
            console.log("[Step2] back to step 1");
            router.push("/auth/register");
          }}
          style={styles.backLinkWrapper}
        >
          <Text style={styles.backLinkText}>← Back to account details</Text>
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

        {/* Back to login (safety link) */}
        <Text style={styles.bottomText}>
          Want to sign in instead?{" "}
          <Link href="/auth/login" style={{ color: COLORS.accent }}>
            Go to login
          </Link>
        </Text>
      </ScrollView>
    </Container>
  );
}
