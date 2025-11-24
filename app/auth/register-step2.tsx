// app/auth/register-step2.tsx
import { Link, router } from "expo-router";
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
  CS2_ROLES,
  FC_FORMATIONS,
  FC_LEAGUES,
  FUTSAL_POSITIONS,
  GAME_OPTIONS,
  INDOOR_CRICKET_BATTING_STYLES,
  INDOOR_CRICKET_BOWLING_STYLES,
  INDOOR_CRICKET_ROLES,
  KARACHI_AREAS,
  PADEL_ROLES,
  PICKLEBALL_ROLES,
  SPORT_OPTIONS,
  TEKKEN_CHARACTERS,
} from "../../constants/profileOptions";
import LogoHalo from "../../src/components/LogoHalo";
import { useToast } from "../../src/hooks/useToast";
import { useOnboardingStore } from "../../src/store/onboardingStore";
import { COLORS } from "../../src/theme";
import styles from "./register.styles";

type Cs2Role = (typeof CS2_ROLES)[number];
type FcFormation = (typeof FC_FORMATIONS)[number];
type TekkenCharacter = (typeof TEKKEN_CHARACTERS)[number];

type FcLeagueId = string;

// new sport types
type FutsalPosition = (typeof FUTSAL_POSITIONS)[number];
type IndoorCricketRole = (typeof INDOOR_CRICKET_ROLES)[number];
type IndoorBowlingStyle = (typeof INDOOR_CRICKET_BOWLING_STYLES)[number];
type IndoorBattingStyle = (typeof INDOOR_CRICKET_BATTING_STYLES)[number];
type PadelRole = (typeof PADEL_ROLES)[number];
type PickleballRole = (typeof PICKLEBALL_ROLES)[number];

export default function RegisterStep2() {
  console.log("[Step2] mounted");
  const { step2, setStep2 } = useOnboardingStore();
  const { showToast } = useToast();

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

  // FC league inferred from saved team
  const [selectedFcLeagueId, setSelectedFcLeagueId] =
    useState<FcLeagueId | null>(() => {
      if (!step2.fcTeam) return null;
      const teamName = step2.fcTeam;
      const league = FC_LEAGUES.find((lg) =>
        lg.teams.some((t) => t === teamName)
      );
      return league ? (league.id as FcLeagueId) : null;
    });

  const [fcTeam, setFcTeam] = useState(step2.fcTeam);
  const [fcFormation, setFcFormation] = useState<FcFormation | null>(
    (step2.fcFormation as FcFormation) || null
  );

  const [tekkenFavorites, setTekkenFavorites] = useState<TekkenCharacter[]>(
    step2.tekkenFavorites as TekkenCharacter[]
  );

  // --- New sports state (MVP) ---
  const [playsFutsal, setPlaysFutsal] = useState<boolean>(
    (step2 as any).playsFutsal ?? false
  );
  const [playsIndoorCricket, setPlaysIndoorCricket] = useState<boolean>(
    (step2 as any).playsIndoorCricket ?? false
  );
  const [playsPadel, setPlaysPadel] = useState<boolean>(
    (step2 as any).playsPadel ?? false
  );
  const [playsPickleball, setPlaysPickleball] = useState<boolean>(
    (step2 as any).playsPickleball ?? false
  );

  const [futsalPositions, setFutsalPositions] = useState<FutsalPosition[]>(
    ((step2 as any).futsalPositions ?? []) as FutsalPosition[]
  );

  const [indoorCricketRole, setIndoorCricketRole] =
    useState<IndoorCricketRole | null>(
      ((step2 as any).indoorCricketRole as IndoorCricketRole) ?? null
    );

  const [indoorCricketBowlingStyle, setIndoorCricketBowlingStyle] =
    useState<IndoorBowlingStyle | null>(
      ((step2 as any).indoorCricketBowlingStyle as IndoorBowlingStyle) ?? null
    );

  const [indoorCricketBattingStyle, setIndoorCricketBattingStyle] =
    useState<IndoorBattingStyle | null>(
      ((step2 as any).indoorCricketBattingStyle as IndoorBattingStyle) ?? null
    );

  const [padelRole, setPadelRole] = useState<PadelRole | null>(
    ((step2 as any).padelRole as PadelRole) ?? null
  );
  const [pickleballRole, setPickleballRole] = useState<PickleballRole | null>(
    ((step2 as any).pickleballRole as PickleballRole) ?? null
  );

  const currentFcLeague = useMemo(
    () =>
      selectedFcLeagueId
        ? FC_LEAGUES.find((lg) => lg.id === selectedFcLeagueId) ?? null
        : null,
    [selectedFcLeagueId]
  );

  // ---- Validation ----
  const {
    isLocationValid,
    hasAnyActivity,
    isCs2Valid,
    isFcValid,
    isTekkenValid,
    isFutsalValid,
    isIndoorCricketValid,
    isPadelValid,
    isPickleballValid,
    isFormValid,
  } = useMemo(() => {
    const locationValid = selectedAreas.length > 0 && selectedAreas.length <= 5;

    // now "activity" = any game OR sport
    const anyActivity =
      playsCs2 ||
      playsFc ||
      playsTekken ||
      playsFutsal ||
      playsIndoorCricket ||
      playsPadel ||
      playsPickleball;

    const cs2Valid = !playsCs2 || !!cs2Role;

    const leagueTeams = currentFcLeague?.teams ?? [];
    const fcTeamValid =
      !playsFc ||
      (!!selectedFcLeagueId &&
        !!fcTeam &&
        leagueTeams.some((t) => t === fcTeam));

    const fcFormationValid = !playsFc || !!fcFormation;

    const tekkenValid =
      !playsTekken ||
      (tekkenFavorites.length > 0 && tekkenFavorites.length <= 3);

    // sports validity
    const futsalValid = !playsFutsal || futsalPositions.length > 0;

    let indoorCricketValid = !playsIndoorCricket;
    if (playsIndoorCricket) {
      if (!indoorCricketRole) {
        indoorCricketValid = false;
      } else if (
        indoorCricketRole === "Bowler" &&
        !indoorCricketBowlingStyle
      ) {
        indoorCricketValid = false;
      } else if (
        indoorCricketRole === "Batsman" &&
        !indoorCricketBattingStyle
      ) {
        indoorCricketValid = false;
      } else {
        indoorCricketValid = true;
      }
    }

    const padelValid = !playsPadel || !!padelRole;
    const pickleballValid = !playsPickleball || !!pickleballRole;

    return {
      isLocationValid: locationValid,
      hasAnyActivity: anyActivity,
      isCs2Valid: cs2Valid,
      isFcValid: fcTeamValid && fcFormationValid,
      isTekkenValid: tekkenValid,
      isFutsalValid: futsalValid,
      isIndoorCricketValid: indoorCricketValid,
      isPadelValid: padelValid,
      isPickleballValid: pickleballValid,
      isFormValid:
        locationValid &&
        anyActivity &&
        cs2Valid &&
        fcTeamValid &&
        fcFormationValid &&
        tekkenValid &&
        futsalValid &&
        indoorCricketValid &&
        padelValid &&
        pickleballValid,
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
    cs2Role,
    fcTeam,
    fcFormation,
    tekkenFavorites,
    selectedFcLeagueId,
    currentFcLeague,
    futsalPositions,
    indoorCricketRole,
    indoorCricketBowlingStyle,
    indoorCricketBattingStyle,
    padelRole,
    pickleballRole,
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
        setSelectedFcLeagueId(null);
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

  const handleSelectLeague = (leagueId: FcLeagueId) => {
    setSelectedFcLeagueId(leagueId);
    setFcTeam("");
  };

  const handleSelectTeam = (team: string) => {
    setFcTeam(team);
  };

  // --- sport toggles ---
  const toggleSport = (
    key: "futsal" | "indoor_cricket" | "padel" | "pickleball"
  ) => {
    if (key === "futsal") {
      setPlaysFutsal((prev) => !prev);
      if (playsFutsal) setFutsalPositions([]);
    }
    if (key === "indoor_cricket") {
      setPlaysIndoorCricket((prev) => !prev);
      if (playsIndoorCricket) {
        setIndoorCricketRole(null);
        setIndoorCricketBowlingStyle(null);
        setIndoorCricketBattingStyle(null);
      }
    }
    if (key === "padel") {
      setPlaysPadel((prev) => !prev);
      if (playsPadel) setPadelRole(null);
    }
    if (key === "pickleball") {
      setPlaysPickleball((prev) => !prev);
      if (playsPickleball) setPickleballRole(null);
    }
  };

  const toggleFutsalPosition = (pos: FutsalPosition) => {
    setFutsalPositions((prev) => {
      if (prev.includes(pos)) {
        return prev.filter((p) => p !== pos);
      }
      return [...prev, pos];
    });
  };

  // ---- Submit (LOCAL ONLY) ----
  const handleContinue = () => {
    if (!isFormValid) {
      showToast({
        type: "info",
        title: "Check details",
        message:
          "Please select your area(s), choose at least one game or sport, and fill the required preferences.",
      });
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

      // new sports fields
      playsFutsal,
      playsIndoorCricket,
      playsPadel,
      playsPickleball,
      futsalPositions,
      indoorCricketRole: indoorCricketRole ?? null,
      indoorCricketBowlingStyle: indoorCricketBowlingStyle ?? null,
      indoorCricketBattingStyle: indoorCricketBattingStyle ?? null,
      padelRole: padelRole ?? null,
      pickleballRole: pickleballRole ?? null,
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
          Tell us your areas and favourite games/sports so we can match you
          with the right squad.
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
        </View>

        {!hasAnyActivity && (
          <View style={styles.helperTextRow}>
            <Text style={[styles.helperText, styles.helperWarning]}>
              Select at least one game or sport. You can add more later.
            </Text>
          </View>
        )}

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
            <Text style={styles.label}>FC 26 · Favourite league</Text>
            <View style={styles.chipRow}>
              {FC_LEAGUES.map((league) => {
                const active = selectedFcLeagueId === league.id;
                return (
                  <Pressable
                    key={league.id}
                    onPress={() => handleSelectLeague(league.id)}
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
                      {league.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {!selectedFcLeagueId && (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperWarning]}>
                  Choose a league you mostly follow or play with.
                </Text>
              </View>
            )}

            {currentFcLeague && (
              <>
                <Text style={[styles.label, { marginTop: 10 }]}>
                  FC 26 · Favourite team in {currentFcLeague.name}
                </Text>
                <View style={styles.chipRow}>
                  {(currentFcLeague.teams ?? []).map((team) => {
                    const active = fcTeam === team;
                    return (
                      <Pressable
                        key={team}
                        onPress={() => handleSelectTeam(team)}
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
                          {team}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
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
                  Select a league, team and formation. You can change this
                  later.
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

        {/* Sports section */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Which sports do you play offline?</Text>
          <View style={styles.chipRow}>
            {SPORT_OPTIONS.map((sport) => {
              const active =
                (sport.key === "futsal" && playsFutsal) ||
                (sport.key === "indoor_cricket" && playsIndoorCricket) ||
                (sport.key === "padel" && playsPadel) ||
                (sport.key === "pickleball" && playsPickleball);

              return (
                <Pressable
                  key={sport.key}
                  onPress={() =>
                    toggleSport(
                      sport.key as
                        | "futsal"
                        | "indoor_cricket"
                        | "padel"
                        | "pickleball"
                    )
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
                    {sport.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Futsal roles */}
        {playsFutsal && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Futsal · Preferred positions</Text>
            <View style={styles.chipRow}>
              {FUTSAL_POSITIONS.map((pos) => {
                const active = futsalPositions.includes(pos);
                return (
                  <Pressable
                    key={pos}
                    onPress={() => toggleFutsalPosition(pos)}
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
                      {pos}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {!isFutsalValid && (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperWarning]}>
                  Pick at least one position you’re happy to play.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Indoor Cricket */}
        {playsIndoorCricket && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Indoor Cricket · Main role</Text>
            <View style={styles.chipRow}>
              {INDOOR_CRICKET_ROLES.map((role) => {
                const active = indoorCricketRole === role;
                return (
                  <Pressable
                    key={role}
                    onPress={() => {
                      setIndoorCricketRole(role);
                      // reset sub-styles when switching
                      if (role !== "Bowler") {
                        setIndoorCricketBowlingStyle(null);
                      }
                      if (role !== "Batsman") {
                        setIndoorCricketBattingStyle(null);
                      }
                    }}
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

            {/* If Bowler → ask bowling style */}
            {indoorCricketRole === "Bowler" && (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.label}>Indoor Cricket · Bowler type</Text>
                <View style={styles.chipRow}>
                  {INDOOR_CRICKET_BOWLING_STYLES.map((style) => {
                    const active = indoorCricketBowlingStyle === style;
                    return (
                      <Pressable
                        key={style}
                        onPress={() => setIndoorCricketBowlingStyle(style)}
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
                          {style}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* If Batsman → ask batting style */}
            {indoorCricketRole === "Batsman" && (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.label}>Indoor Cricket · Batting style</Text>
                <View style={styles.chipRow}>
                  {INDOOR_CRICKET_BATTING_STYLES.map((style) => {
                    const active = indoorCricketBattingStyle === style;
                    return (
                      <Pressable
                        key={style}
                        onPress={() => setIndoorCricketBattingStyle(style)}
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
                          {style}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {!isIndoorCricketValid && (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperWarning]}>
                  Choose your main role and, if you&apos;re a batsman or
                  bowler, pick your style so we can rotate you fairly.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Padel */}
        {playsPadel && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Padel · Style</Text>
            <View style={styles.chipRow}>
              {PADEL_ROLES.map((role) => {
                const active = padelRole === role;
                return (
                  <Pressable
                    key={role}
                    onPress={() => setPadelRole(role)}
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
            {!isPadelValid && (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperWarning]}>
                  Tell us how you like to play so we can pair you correctly.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Pickleball */}
        {playsPickleball && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Pickleball · Preferred mode</Text>
            <View style={styles.chipRow}>
              {PICKLEBALL_ROLES.map((role) => {
                const active = pickleballRole === role;
                return (
                  <Pressable
                    key={role}
                    onPress={() => setPickleballRole(role)}
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
            {!isPickleballValid && (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperWarning]}>
                  Choose how you usually play (singles or doubles side).
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
