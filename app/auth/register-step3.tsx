import { MaterialIcons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { Link, router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import LogoHalo from "../../src/components/LogoHalo";
import { useOnboardingStore } from "../../src/store/onboardingStore";
import { COLORS } from "../../src/theme";
import styles from "./register.styles";

type PlatformKey = "steam" | "faceit" | "ea" | "xbox" | "psn";

export default function RegisterStep3() {
  const { step2, step3, setStep3 } = useOnboardingStore();

  console.log("[Step3] mounted with step2:", {
    selectedAreas: step2.selectedAreas,
    playsCs2: step2.playsCs2,
    playsFc: step2.playsFc,
    playsTekken: step2.playsTekken,
  });

  const [areasPreferred, setAreasPreferred] = useState<string[]>(
    step2.selectedAreas
  );
  const [playsCs2, setPlaysCs2] = useState(step2.playsCs2);
  const [playsFc, setPlaysFc] = useState(step2.playsFc);
  const [playsTekken, setPlaysTekken] = useState(step2.playsTekken);

  // platform selections
  const [steamConnected, setSteamConnected] = useState<boolean>(step3.steam);
  const [faceitConnected, setFaceitConnected] = useState<boolean>(step3.faceit);
  const [eaConnected, setEaConnected] = useState<boolean>(step3.ea);
  const [xboxConnected, setXboxConnected] = useState<boolean>(step3.xbox);
  const [psnConnected, setPsnConnected] = useState<boolean>(step3.psn);

  const [saving, setSaving] = useState(false);

  // if user somehow comes here without step2 filled, send them back
  const isFocused = useIsFocused();

  // if user somehow comes here without step2 filled, send them back
  useEffect(() => {
    if (!isFocused) {
      // screen is mounted (maybe preloaded) but not active: do nothing
      return;
    }

    if (
      !step2.selectedAreas.length &&
      !step2.playsCs2 &&
      !step2.playsFc &&
      !step2.playsTekken
    ) {
      console.log("[Step3] missing step2 data → redirecting to step2");
      router.replace("/auth/register-step2");
    }
  }, [isFocused, step2]);

  // helper array for chips in summary
  const selectedGames = useMemo(() => {
    const games: string[] = [];
    if (playsCs2) games.push("CS2");
    if (playsFc) games.push("FC 26");
    if (playsTekken) games.push("Tekken 8");
    return games;
  }, [playsCs2, playsFc, playsTekken]);

  // --- validation logic ---
  const { cs2Ok, fcOk, tekkenOk, isFormValid } = useMemo(() => {
    const hasSteam = steamConnected;
    const hasFaceit = faceitConnected;
    const hasEa = eaConnected;
    const hasXbox = xboxConnected;
    const hasPsn = psnConnected;

    const cs2Valid = !playsCs2 || hasSteam || hasFaceit;

    const fcValid = !playsFc || hasSteam || hasEa || hasXbox || hasPsn;

    const tekkenValid = !playsTekken || hasSteam || hasXbox || hasPsn;

    return {
      cs2Ok: cs2Valid,
      fcOk: fcValid,
      tekkenOk: tekkenValid,
      isFormValid: cs2Valid && fcValid && tekkenValid,
    };
  }, [
    playsCs2,
    playsFc,
    playsTekken,
    steamConnected,
    faceitConnected,
    eaConnected,
    xboxConnected,
    psnConnected,
  ]);

  // --- keyboard container ---
  const Container: any = Platform.OS === "ios" ? KeyboardAvoidingView : View;
  const containerProps =
    Platform.OS === "ios"
      ? {
          style: styles.screen,
          behavior: "padding" as const,
          keyboardVerticalOffset: 0,
        }
      : { style: styles.screen };

  const togglePlatform = (key: PlatformKey) => {
    if (key === "steam") setSteamConnected((p: boolean) => !p);
    if (key === "faceit") setFaceitConnected((p: boolean) => !p);
    if (key === "ea") setEaConnected((p: boolean) => !p);
    if (key === "xbox") setXboxConnected((p: boolean) => !p);
    if (key === "psn") setPsnConnected((p: boolean) => !p);
  };

  const handleContinue = () => {
    if (!isFormValid) {
      const messages: string[] = [];

      if (playsCs2 && !cs2Ok) {
        messages.push("• CS2: connect Steam or FACEIT.");
      }
      if (playsFc && !fcOk) {
        messages.push("• FC 26: connect Steam, EA, Xbox or PlayStation.");
      }
      if (playsTekken && !tekkenOk) {
        messages.push("• Tekken 8: connect Steam, Xbox or PlayStation.");
      }

      Alert.alert(
        "Connect your accounts",
        messages.length
          ? messages.join("\n")
          : "Please connect at least one platform for each game you selected."
      );
      return;
    }

    setSaving(true);
    console.log("[Step3] saving platforms and going to step 4");
    // persist in store
    setStep3({
      steam: steamConnected,
      faceit: faceitConnected,
      ea: eaConnected,
      xbox: xboxConnected,
      psn: psnConnected,
    });
    setSaving(false);

    router.push("/auth/register-step4");
  };

  const showSteam = playsCs2 || playsFc || playsTekken;
  const showFaceit = playsCs2;
  const showEa = playsFc;
  const showXbox = playsFc || playsTekken;
  const showPsn = playsFc || playsTekken;

  // Dynamic subtitles
  const steamGames: string[] = [];
  if (playsCs2) steamGames.push("CS2");
  if (playsFc) steamGames.push("FC 26");
  if (playsTekken) steamGames.push("Tekken 8");
  const steamSubtitle = steamGames.length
    ? `Covers: ${steamGames.join(" · ")}`
    : "Link your Steam account.";

  const eaSubtitle = playsFc
    ? "Required for FC 26 verification (clubs, divisions)."
    : "Link your EA account.";

  const xboxSubtitleParts: string[] = [];
  if (playsFc) xboxSubtitleParts.push("FC 26");
  if (playsTekken) xboxSubtitleParts.push("Tekken 8");
  const xboxSubtitle = xboxSubtitleParts.length
    ? `Use your Xbox account for ${xboxSubtitleParts.join(" & ")}.`
    : "Link your Xbox account.";

  const psnSubtitleParts: string[] = [];
  if (playsFc) psnSubtitleParts.push("FC 26");
  if (playsTekken) psnSubtitleParts.push("Tekken 8");
  const psnSubtitle = psnSubtitleParts.length
    ? `Use your PSN account for ${psnSubtitleParts.join(" & ")}.`
    : "Link your PlayStation Network account.";

  return (
    <Container {...containerProps}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LogoHalo />

        {/* Stepper: Step 3 of 4 */}
        <View style={styles.stepperWrapper}>
          <View style={styles.stepperTopRow}>
            <View>
              <Text style={styles.stepperTitle}>Connect your platforms</Text>
              <Text style={styles.stepperSubtitle}>
                Step 3 of 4 · Link your gaming accounts
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

        {/* Previous selections card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeaderRow}>
            <MaterialIcons
              name="folder"
              size={16}
              color={COLORS.accent}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.summaryTitle}>Previous selections</Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.summaryLabel}>Locations</Text>
              <Text style={styles.summaryValue}>
                {areasPreferred.length
                  ? areasPreferred.join(", ")
                  : "Not selected"}
              </Text>
            </View>
            <View style={{ flex: 1, paddingLeft: 8 }}>
              <Text style={styles.summaryLabel}>Selected games</Text>
              {selectedGames.length ? (
                <View style={styles.chipRow}>
                  {selectedGames.map((g) => (
                    <View key={g} style={styles.summaryChip}>
                      <Text style={styles.summaryChipText}>{g}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.summaryValue}>None</Text>
              )}
            </View>
          </View>
        </View>

        {/* Platforms section */}
        <Text style={[styles.heading, { marginTop: 18 }]}>
          Connect gaming platforms
        </Text>
        <Text style={styles.sub}>
          Link your accounts so we can verify your skill level and match
          history.
        </Text>

        {/* Steam & FACEIT */}
        {showSteam && (
          <View style={styles.platformCard}>
            <View style={styles.platformHeaderRow}>
              <View style={styles.platformIconCircle}>
                <MaterialIcons name="computer" size={18} color={COLORS.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.platformTitle}>Steam</Text>
                <Text style={styles.platformSubtitle}>{steamSubtitle}</Text>
              </View>
              {steamConnected && (
                <Text style={styles.platformConnectedBadge}>Connected</Text>
              )}
            </View>
            <Pressable
              onPress={() => togglePlatform("steam")}
              style={({ pressed }) => [
                styles.platformButton,
                steamConnected && styles.platformButtonActiveSteam,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.platformButtonText}>
                {steamConnected ? "Disconnect Steam" : "Connect Steam"}
              </Text>
            </Pressable>
          </View>
        )}

        {showFaceit && (
          <View style={styles.platformCard}>
            <View style={styles.platformHeaderRow}>
              <View style={styles.platformIconCircle}>
                <MaterialIcons
                  name="sports-esports"
                  size={18}
                  color={COLORS.text}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.platformTitle}>FACEIT</Text>
                <Text style={styles.platformSubtitle}>
                  CS2 only: retrieve your FACEIT Elo and match history.
                </Text>
              </View>
              {faceitConnected && (
                <Text style={styles.platformConnectedBadge}>Connected</Text>
              )}
            </View>
            <Pressable
              onPress={() => togglePlatform("faceit")}
              style={({ pressed }) => [
                styles.platformButton,
                faceitConnected && styles.platformButtonActiveFaceit,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.platformButtonText}>
                {faceitConnected ? "Disconnect FACEIT" : "Connect FACEIT"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* FC 26 platforms */}
        {showEa && (
          <View style={styles.platformCard}>
            <View style={styles.platformHeaderRow}>
              <View style={styles.platformIconCircle}>
                <MaterialIcons
                  name="sports-soccer"
                  size={18}
                  color={COLORS.text}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.platformTitle}>EA Account</Text>
                <Text style={styles.platformSubtitle}>{eaSubtitle}</Text>
              </View>
              {eaConnected && (
                <Text style={styles.platformConnectedBadge}>Connected</Text>
              )}
            </View>
            <Pressable
              onPress={() => togglePlatform("ea")}
              style={({ pressed }) => [
                styles.platformButton,
                eaConnected && styles.platformButtonActive,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.platformButtonText}>
                {eaConnected ? "Disconnect EA" : "Connect EA"}
              </Text>
            </Pressable>
          </View>
        )}

        {showXbox && (
          <View style={styles.platformCard}>
            <View style={styles.platformHeaderRow}>
              <View style={styles.platformIconCircle}>
                <MaterialIcons
                  name="sports-esports"
                  size={18}
                  color={COLORS.text}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.platformTitle}>Xbox</Text>
                <Text style={styles.platformSubtitle}>{xboxSubtitle}</Text>
              </View>
              {xboxConnected && (
                <Text style={styles.platformConnectedBadge}>Connected</Text>
              )}
            </View>
            <Pressable
              onPress={() => togglePlatform("xbox")}
              style={({ pressed }) => [
                styles.platformButton,
                xboxConnected && styles.platformButtonActive,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.platformButtonText}>
                {xboxConnected ? "Disconnect Xbox" : "Connect Xbox"}
              </Text>
            </Pressable>
          </View>
        )}

        {showPsn && (
          <View style={styles.platformCard}>
            <View style={styles.platformHeaderRow}>
              <View style={styles.platformIconCircle}>
                <MaterialIcons
                  name="sports-esports"
                  size={18}
                  color={COLORS.text}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.platformTitle}>PlayStation Network</Text>
                <Text style={styles.platformSubtitle}>{psnSubtitle}</Text>
              </View>
              {psnConnected && (
                <Text style={styles.platformConnectedBadge}>Connected</Text>
              )}
            </View>
            <Pressable
              onPress={() => togglePlatform("psn")}
              style={({ pressed }) => [
                styles.platformButton,
                psnConnected && styles.platformButtonActive,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.platformButtonText}>
                {psnConnected ? "Disconnect PSN" : "Connect PSN"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Validation helpers per game */}
        {playsCs2 && !cs2Ok && (
          <View style={styles.helperTextRow}>
            <Text style={[styles.helperText, styles.helperWarning]}>
              CS2: connect at least Steam or FACEIT.
            </Text>
          </View>
        )}
        {playsFc && !fcOk && (
          <View style={styles.helperTextRow}>
            <Text style={[styles.helperText, styles.helperWarning]}>
              FC 26: connect Steam, EA, Xbox or PlayStation.
            </Text>
          </View>
        )}
        {playsTekken && !tekkenOk && (
          <View style={styles.helperTextRow}>
            <Text style={[styles.helperText, styles.helperWarning]}>
              Tekken 8: connect Steam, Xbox or PlayStation.
            </Text>
          </View>
        )}

        {/* Back to Step 2 */}
        <Pressable
          onPress={() => router.push("/auth/register-step2")}
          style={styles.backLinkWrapper}
        >
          <Text style={styles.backLinkText}>← Back to games & location</Text>
        </Pressable>

        {/* Continue button */}
        <View
          style={[
            styles.buttonShadowWrapper,
            isFormValid && !saving && styles.buttonShadowWrapperActive,
          ]}
        >
          <Pressable
            onPress={handleContinue}
            disabled={saving || !isFormValid}
            style={({ pressed }) => [
              styles.primaryBtn,
              !isFormValid || saving ? styles.primaryBtnDisabled : null,
              pressed && !saving && isFormValid && { opacity: 0.92 },
            ]}
            android_ripple={{ color: "rgba(255,255,255,0.08)" }}
          >
            <Text style={styles.primaryBtnText}>Continue</Text>
          </Pressable>
        </View>

        {/* Bottom link */}
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
