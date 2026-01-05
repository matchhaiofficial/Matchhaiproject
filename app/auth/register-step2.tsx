// app/auth/register-step2.tsx
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  GAME_OPTIONS,
  KARACHI_AREAS,
  PLAY_TIME_OPTIONS,
  SPORT_OPTIONS
} from "../../constants/profileOptions";
import LogoHalo from "../../src/components/LogoHalo";
import { useToast } from "../../src/hooks/useToast";
import { useOnboardingStore } from "../../src/store/onboardingStore";
import styles from "./register.styles";

export default function RegisterStep2() {
  console.log("[Step2] mounted (Simplified)");
  const { step2, setStep2 } = useOnboardingStore();
  const { showToast } = useToast();

  // ---- State ----
  const [selectedAreas, setSelectedAreas] = useState<string[]>(
    step2.selectedAreas || []
  );
  const [playTimes, setPlayTimes] = useState<string[]>(step2.playTimes || []);

  // Game Toggles
  const [playsCs2, setPlaysCs2] = useState<boolean>(step2.playsCs2);
  const [playsFc, setPlaysFc] = useState<boolean>(step2.playsFc);
  const [playsTekken, setPlaysTekken] = useState<boolean>(step2.playsTekken);

  // Sport Toggles
  const [playsFutsal, setPlaysFutsal] = useState<boolean>((step2 as any).playsFutsal ?? false);
  const [playsIndoorCricket, setPlaysIndoorCricket] = useState<boolean>((step2 as any).playsIndoorCricket ?? false);
  const [playsPadel, setPlaysPadel] = useState<boolean>((step2 as any).playsPadel ?? false);
  const [playsPickleball, setPlaysPickleball] = useState<boolean>((step2 as any).playsPickleball ?? false);

  // ---- Validation ----
  const {
    isLocationValid,
    hasAnyActivity,
    isFormValid,
  } = useMemo(() => {
    const locationValid = selectedAreas.length > 0 && selectedAreas.length <= 5;

    const anyActivity =
      playsCs2 ||
      playsFc ||
      playsTekken ||
      playsFutsal ||
      playsIndoorCricket ||
      playsPadel ||
      playsPickleball;

    return {
      isLocationValid: locationValid,
      hasAnyActivity: anyActivity,
      isFormValid: locationValid && anyActivity,
    };
  }, [
    selectedAreas,
    playsCs2,
    playsFc,
    playsTekken,
    playsFutsal,
    playsIndoorCricket,
    playsPadel,
    playsPickleball,
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
        showToast({
          type: "warning",
          title: "Limit reached",
          message: "You can select up to 5 areas where you want to play.",
        });
        return prev;
      }
      return [...prev, area];
    });
  };

  const togglePlayTime = (time: string) => {
    setPlayTimes((prev) => {
      if (prev.includes(time)) {
        return prev.filter((t) => t !== time);
      }
      return [...prev, time];
    });
  };

  const toggleGame = (key: string) => {
    if (key === "cs2") setPlaysCs2(p => !p);
    if (key === "fc26") setPlaysFc(p => !p);
    if (key === "tekken8") setPlaysTekken(p => !p);
  };

  const toggleSport = (key: string) => {
    if (key === "futsal") setPlaysFutsal(p => !p);
    if (key === "indoor_cricket") setPlaysIndoorCricket(p => !p);
    if (key === "padel") setPlaysPadel(p => !p);
    if (key === "pickleball") setPlaysPickleball(p => !p);
  };

  // ---- Submit ----
  const handleContinue = () => {
    if (!isFormValid) {
      showToast({
        type: "info",
        title: "Check details",
        message: "Please select your area and at least one game/sport.",
      });
      return;
    }

    console.log("[Step2] saving (simplified) and going to step 3");

    // Only save minimal data. Any detailed questions happen Just-in-Time now.
    setStep2({
      selectedAreas,
      playTimes,
      playsCs2,
      playsFc,
      playsTekken,

      // Explicitly nullify removed fields to clear old state if any
      cs2Role: null,
      fcTeam: '',
      fcFormation: null,
      tekkenFavorites: [],

      // Sports
      playsFutsal,
      playsIndoorCricket,
      playsPadel,
      playsPickleball,

      futsalPositions: [],
      indoorCricketRole: null,
      padelRole: null,
      pickleballRole: null,
    } as any);

    router.push("/auth/register-step3");
  };

  return (
    <Container {...containerProps}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LogoHalo />

        <View style={styles.stepperWrapper}>
          <View style={styles.stepperTopRow}>
            <View>
              <Text style={styles.stepperTitle}>Location & games</Text>
              <Text style={styles.stepperSubtitle}>
                Step 2 of 4 · Quick Setup
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

        <Text style={styles.heading}>Where do you queue?</Text>
        <Text style={styles.sub}>
          Select your area and the activities you're interested in.
          We'll ask for skill levels later when you create a match.
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
                  <Text style={[
                    styles.optionChipText,
                    active && styles.optionChipTextActive,
                  ]}>
                    {area}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {(!isLocationValid && selectedAreas.length === 0) && (
            <Text style={[styles.helperText, styles.helperWarning, { marginTop: 6 }]}>
              Required
            </Text>
          )}
        </View>

        {/* Games */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Esports (PC/Console)</Text>
          <View style={styles.chipRow}>
            {GAME_OPTIONS.map((game) => {
              const active =
                (game.key === "cs2" && playsCs2) ||
                (game.key === "fc26" && playsFc) ||
                (game.key === "tekken8" && playsTekken);

              return (
                <Pressable
                  key={game.key}
                  onPress={() => toggleGame(game.key)}
                  style={({ pressed }) => [
                    styles.optionChip,
                    active && styles.optionChipActive,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={[
                    styles.optionChipText,
                    active && styles.optionChipTextActive,
                  ]}>
                    {game.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Sports */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Physical Sports</Text>
          <View style={styles.chipRow}>
            {SPORT_OPTIONS.map((sport) => {
              // Map sport key to state
              let active = false;
              if (sport.key === "futsal") active = playsFutsal;
              if (sport.key === "indoor_cricket") active = playsIndoorCricket;
              if (sport.key === "padel") active = playsPadel;
              if (sport.key === "pickleball") active = playsPickleball;

              return (
                <Pressable
                  key={sport.key}
                  onPress={() => toggleSport(sport.key)}
                  style={({ pressed }) => [
                    styles.optionChip,
                    active && styles.optionChipActive,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={[
                    styles.optionChipText,
                    active && styles.optionChipTextActive,
                  ]}>
                    {sport.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {!hasAnyActivity && (
          <Text style={[styles.helperText, styles.helperWarning, { marginBottom: 16 }]}>
            Select at least one game or sport.
          </Text>
        )}

        {/* Play Times */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Usual play times (Optional)</Text>
          <View style={styles.chipRow}>
            {PLAY_TIME_OPTIONS.map((time) => {
              const active = playTimes.includes(time);
              return (
                <Pressable
                  key={time}
                  onPress={() => togglePlayTime(time)}
                  style={({ pressed }) => [
                    styles.optionChip,
                    active && styles.optionChipActive,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={[
                    styles.optionChipText,
                    active && styles.optionChipTextActive,
                  ]}>
                    {time}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          onPress={() => router.push("/auth/register")}
          style={styles.backLinkWrapper}
        >
          <Text style={styles.backLinkText}>← Back to account details</Text>
        </Pressable>

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
          >
            <Text style={styles.primaryBtnText}>Continue</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Container>
  );
}
