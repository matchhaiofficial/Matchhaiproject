import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import {
  GAME_OPTIONS,
  KARACHI_AREAS,
  normalizeKarachiAreaList,
  PLAY_TIME_OPTIONS,
  SPORT_OPTIONS,
} from "../../constants/profileOptions";
import RegistrationFieldLabel from "./components/RegistrationFieldLabel";
import RegistrationStepHeader from "./components/RegistrationStepHeader";
import { AppButton } from "../../src/components/AppPrimitives";
import Screen from "../../src/components/Screen";
import { useToast } from "../../src/hooks/useToast";
import { useOnboardingStore } from "../../src/store/onboardingStore";
import { Perf } from "../../src/utils/perfInstrumentation";
import styles from "./register.styles";

export default function RegisterStep2() {
  const { step1, step2, setStep2, setCurrentStep } = useOnboardingStore();
  const { showToast } = useToast();

  const [selectedAreas, setSelectedAreas] = useState<string[]>(
    normalizeKarachiAreaList(step2.selectedAreas || []),
  );
  const [playTimes, setPlayTimes] = useState<string[]>(step2.playTimes || []);
  const [playsCs2, setPlaysCs2] = useState<boolean>(step2.playsCs2);
  const [playsCs16, setPlaysCs16] = useState<boolean>((step2 as any).playsCs16 ?? false);
  const [playsValorant, setPlaysValorant] = useState<boolean>((step2 as any).playsValorant ?? false);
  const [playsFc, setPlaysFc] = useState<boolean>(step2.playsFc);
  const [playsTekken, setPlaysTekken] = useState<boolean>(step2.playsTekken);
  const [playsFutsal, setPlaysFutsal] = useState<boolean>((step2 as any).playsFutsal ?? false);
  const [playsIndoorCricket, setPlaysIndoorCricket] = useState<boolean>((step2 as any).playsIndoorCricket ?? false);
  const [playsPadel, setPlaysPadel] = useState<boolean>((step2 as any).playsPadel ?? false);
  const [playsPickleball, setPlaysPickleball] = useState<boolean>((step2 as any).playsPickleball ?? false);

  useEffect(() => {
    setCurrentStep(2);
    Perf.mark("Screen.Mount", {
      routeKey: "/auth/register-step2",
      meta: { routeKeyConfidence: "explicit" },
    });
    const navMark = Perf.consumeNavMark("/auth/register-step2");
    if (navMark) {
      Perf.mark("Nav.ToMounted", {
        cid: navMark.cid,
        routeKey: "/auth/register-step2",
        meta: {
          durationMs: Date.now() - navMark.startedAt,
          ...(navMark.meta || {}),
        },
      });
    }
  }, [setCurrentStep]);

  useEffect(() => {
    if (!step1.fullName.trim() || !step1.username.trim() || !step1.email.trim() || !step1.password) {
      router.replace("/auth/register");
    }
  }, [step1]);

  const { isLocationValid, hasAnyActivity, isFormValid } = useMemo(() => {
    const locationValid = selectedAreas.length > 0 && selectedAreas.length <= 5;
    const anyActivity =
      playsCs2 ||
      playsCs16 ||
      playsValorant ||
      playsFc ||
      playsTekken;

    return {
      isLocationValid: locationValid,
      hasAnyActivity: anyActivity,
      isFormValid: locationValid && anyActivity,
    };
  }, [
    selectedAreas,
    playsCs2,
    playsCs16,
    playsValorant,
    playsFc,
    playsTekken,
  ]);

  const toggleArea = (area: string) => {
    setSelectedAreas((prev) => {
      if (prev.includes(area)) {
        return prev.filter((item) => item !== area);
      }
      if (prev.length >= 5) {
        showToast({
          type: "warning",
          title: "Limit reached",
          message: "You can select up to 5 areas where you want to play.",
        });
        return prev;
      }
      return normalizeKarachiAreaList([...prev, area]);
    });
  };

  const togglePlayTime = (time: string) => {
    setPlayTimes((prev) =>
      prev.includes(time) ? prev.filter((item) => item !== time) : [...prev, time],
    );
  };

  const toggleGame = (key: string) => {
    if (key === "cs2") setPlaysCs2((prev) => !prev);
    if (key === "cs16") setPlaysCs16((prev) => !prev);
    if (key === "valorant") setPlaysValorant((prev) => !prev);
    if (key === "fc26") setPlaysFc((prev) => !prev);
    if (key === "tekken8") setPlaysTekken((prev) => !prev);
  };

  const toggleSport = (key: string) => {
    if (key === "futsal") setPlaysFutsal((prev) => !prev);
    if (key === "indoor_cricket") setPlaysIndoorCricket((prev) => !prev);
    if (key === "padel") setPlaysPadel((prev) => !prev);
    if (key === "pickleball") setPlaysPickleball((prev) => !prev);
  };

  const handleContinue = () => {
    if (!isFormValid) {
      showToast({
        type: "info",
        title: "Check details",
        message: "Select your areas and at least one game before continuing.",
      });
      return;
    }

    setStep2({
      selectedAreas: normalizeKarachiAreaList(selectedAreas),
      playTimes,
      playsCs2,
      playsCs16,
      playsValorant,
      playsFc,
      playsTekken,
      cs2Role: null,
      cs16Role: null,
      valorantRole: null,
      fcTeam: "",
      fcFormation: null,
      tekkenFavorites: [],
      playsFutsal: false,
      playsIndoorCricket: false,
      playsPadel: false,
      playsPickleball: false,
      futsalPositions: [],
      indoorCricketRole: null,
      padelRole: null,
      pickleballRole: null,
    } as any);

    router.replace("/auth/register-step3");
  };

  return (
    <Screen
      scroll
      keyboardAvoiding
      style={styles.screen}
      contentStyle={styles.container}
      routeKey="/auth/register-step2"
      scrollProps={{
        showsVerticalScrollIndicator: false,
        keyboardShouldPersistTaps: "handled",
      }}
    >
      <RegistrationStepHeader
        title="Play Preferences"
        subtitle=""
        stepTitle="Step 2 of 4"
        stepSubtitle="Location and interests"
        progress="50%"
        onBack={() => router.replace("/auth/register")}
      />

      <Text style={styles.heading}>Areas and games</Text>
      <Text style={styles.sub}>Pick up to 5 Karachi areas and your main games.</Text>

      <View style={styles.fieldGroup}>
        <RegistrationFieldLabel label="Your areas in Karachi (up to 5)" required />
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
                <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>
                  {area}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {!isLocationValid && selectedAreas.length === 0 ? (
          <Text style={[styles.helperText, styles.helperWarning, { marginTop: 6 }]}>Required</Text>
        ) : null}
      </View>

      <View style={styles.fieldGroup}>
        <RegistrationFieldLabel label="Esports interests" required />
        <View style={styles.chipRow}>
          {GAME_OPTIONS.map((game) => {
            const active =
              (game.key === "cs2" && playsCs2) ||
              (game.key === "cs16" && playsCs16) ||
              (game.key === "valorant" && playsValorant) ||
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
                <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>
                  {game.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {SPORT_OPTIONS.length > 0 ? (
        <View style={styles.fieldGroup}>
          <RegistrationFieldLabel label="Disabled sports interests" />
          <View style={styles.chipRow}>
            {SPORT_OPTIONS.map((sport) => {
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
                  <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>
                    {sport.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {!hasAnyActivity ? (
        <Text style={[styles.helperText, styles.helperWarning, { marginBottom: 16 }]}>
          Select at least one game.
        </Text>
      ) : null}

      <View style={styles.fieldGroup}>
        <RegistrationFieldLabel label="Usual play times" optional />
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
                <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>
                  {time}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable onPress={() => router.replace("/auth/register")} style={styles.backLinkWrapper}>
        <Text style={styles.backLinkText}>Back to account details</Text>
      </Pressable>

      <View style={[styles.buttonShadowWrapper, isFormValid && styles.buttonShadowWrapperActive]}>
        <AppButton
          onPress={handleContinue}
          disabled={!isFormValid}
          size="lg"
          style={[styles.primaryBtn, !isFormValid ? styles.primaryBtnDisabled : null]}
        >
          Continue
        </AppButton>
      </View>
    </Screen>
  );
}
