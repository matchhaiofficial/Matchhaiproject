// app/auth/register-step3.tsx
import { MaterialIcons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { Link, router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
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
import {
  FaceitProfileSummary,
  fetchFaceitProfileFromUrl,
} from "../../src/services/faceitApi";
import {
  fetchSteamProfileFromUrl,
  SteamProfileSummary,
} from "../../src/services/steamApi";
import { useOnboardingStore } from "../../src/store/onboardingStore";
import { COLORS } from "../../src/theme";
import styles from "./register.styles";

// --- FACEIT LEVEL ICONS ---
const faceitLevelIcons: Record<number, any> = {
  1: require("../../assets/images/faceit-levels/Level 1.png"),
  2: require("../../assets/images/faceit-levels/Level 2.png"),
  3: require("../../assets/images/faceit-levels/Level 3.png"),
  4: require("../../assets/images/faceit-levels/Level 4.png"),
  5: require("../../assets/images/faceit-levels/Level 5.png"),
  6: require("../../assets/images/faceit-levels/Level 6.png"),
  7: require("../../assets/images/faceit-levels/Level 7.png"),
  8: require("../../assets/images/faceit-levels/Level 8.png"),
  9: require("../../assets/images/faceit-levels/Level 9.png"),
  10: require("../../assets/images/faceit-levels/Level 10.png"),
};

export default function RegisterStep3() {
  const { step2, step3, setStep3 } = useOnboardingStore();
  const { showToast } = useToast();

  console.log("[Step3] mounted with step2:", {
    selectedAreas: step2.selectedAreas,
    playsCs2: step2.playsCs2,
    playsFc: step2.playsFc,
    playsTekken: step2.playsTekken,
  });

  const [areasPreferred] = useState<string[]>(step2.selectedAreas);
  const [playsCs2] = useState(step2.playsCs2);
  const [playsFc] = useState(step2.playsFc);
  const [playsTekken] = useState(step2.playsTekken);

  // local editable fields for links / IDs
  const [steamProfileUrl, setSteamProfileUrl] = useState(
    step3.steamProfileUrl ?? ""
  );
  const [faceitProfileUrl, setFaceitProfileUrl] = useState(
    step3.faceitProfileUrl ?? ""
  );
  const [eaProfileUrl, setEaProfileUrl] = useState(step3.eaProfileUrl ?? "");
  const [xboxGamertag, setXboxGamertag] = useState(step3.xboxGamertag ?? "");
  const [psnOnlineId, setPsnOnlineId] = useState(step3.psnOnlineId ?? "");

  // fetched summaries
  const [steamProfile, setSteamProfile] = useState<SteamProfileSummary | null>(
    step3.steamProfile ?? null
  );
  const [faceitProfile, setFaceitProfile] =
    useState<FaceitProfileSummary | null>(step3.faceitProfile ?? null);

  const [steamLoading, setSteamLoading] = useState(false);
  const [faceitLoading, setFaceitLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isFocused = useIsFocused();

  // derived flags
  const steamVerified = !!steamProfile;
  const faceitVerified = !!faceitProfile;

  // If user somehow comes here without step2 filled, send them back
  useEffect(() => {
    if (!isFocused) return;

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

  // --- validation logic for links + soft "looks weird" hints ---
  const {
    cs2Ok,
    fcOk,
    tekkenOk,
    isFormValid,
    steamLooksWeird,
    faceitLooksWeird,
    eaLooksWeird,
    xboxLooksWeird,
    psnLooksWeird,
  } = useMemo(() => {
    const steam = (steamProfileUrl ?? "").trim();
    const faceit = (faceitProfileUrl ?? "").trim();
    const ea = (eaProfileUrl ?? "").trim();
    const xbox = (xboxGamertag ?? "").trim();
    const psn = (psnOnlineId ?? "").trim();

    const steamFilled = steam.length > 0;
    const faceitFilled = faceit.length > 0;
    const eaFilled = ea.length > 0;
    const xboxFilled = xbox.length > 0;
    const psnFilled = psn.length > 0;

    // existing “does this game have at least one platform” logic
    const cs2Valid = !playsCs2 || steamFilled || faceitFilled;
    const fcValid =
      !playsFc || steamFilled || eaFilled || xboxFilled || psnFilled;
    const tekkenValid =
      !playsTekken || steamFilled || xboxFilled || psnFilled;

    // --- soft format checks (warnings only) ---

    // generic URL check: http(s) + non-space
    const urlRegex = /^https?:\/\/\S+$/;

    // Steam: prefer a proper URL
    const steamWeird = steamFilled && !urlRegex.test(steam);

    // FACEIT: either URL or simple nickname
    const faceitNicknameRegex = /^[A-Za-z0-9_]{3,30}$/;
    const faceitWeird =
      faceitFilled &&
      !urlRegex.test(faceit) &&
      !faceitNicknameRegex.test(faceit);

    // Very short IDs → likely typo
    const eaWeird = eaFilled && ea.length < 3;
    const xboxWeird = xboxFilled && xbox.length < 3;
    const psnWeird = psnFilled && psn.length < 3;

    return {
      cs2Ok: cs2Valid,
      fcOk: fcValid,
      tekkenOk: tekkenValid,
      isFormValid: cs2Valid && fcValid && tekkenValid,

      steamLooksWeird: steamWeird,
      faceitLooksWeird: faceitWeird,
      eaLooksWeird: eaWeird,
      xboxLooksWeird: xboxWeird,
      psnLooksWeird: psnWeird,
    };
  }, [
    playsCs2,
    playsFc,
    playsTekken,
    steamProfileUrl,
    faceitProfileUrl,
    eaProfileUrl,
    xboxGamertag,
    psnOnlineId,
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

  const handleSteamLookup = async () => {
    const url = steamProfileUrl.trim();
    if (!url) {
      showToast({
        type: "info",
        title: "Steam profile",
        message: "Please paste your Steam profile link first.",
      });
      return;
    }

    setSteamLoading(true);
    const res = await fetchSteamProfileFromUrl(url);
    setSteamLoading(false);

    if (!res.ok) {
      showToast({
        type: "error",
        title: "Steam lookup failed",
        message: res.message || "We couldn’t verify this Steam profile.",
      });
      setSteamProfile(null);
      return;
    }

    setSteamProfile(res.data);
    showToast({
      type: "success",
      title: "Steam linked",
      message: res.data.personaName
        ? `Found profile: ${res.data.personaName}.`
        : "Steam profile verified.",
    });
  };

  const handleFaceitLookup = async () => {
    const value = faceitProfileUrl.trim();
    if (!value) {
      showToast({
        type: "info",
        title: "FACEIT profile",
        message: "Paste your FACEIT profile link or nickname first.",
      });
      return;
    }

    setFaceitLoading(true);
    const res = await fetchFaceitProfileFromUrl(value);
    setFaceitLoading(false);

    if (!res.ok) {
      showToast({
        type: "error",
        title: "FACEIT lookup failed",
        message: res.message || "We couldn’t verify this FACEIT profile.",
      });
      setFaceitProfile(null);
      return;
    }

    setFaceitProfile(res.data);
    showToast({
      type: "success",
      title: "FACEIT linked",
      message: res.data.nickname
        ? `Found profile: ${res.data.nickname}.`
        : "FACEIT profile verified.",
    });
  };

  const handleContinue = () => {
    if (!isFormValid) {
      const messages: string[] = [];

      if (playsCs2 && !cs2Ok) {
        messages.push("CS2: add at least a Steam or FACEIT profile link.");
      }
      if (playsFc && !fcOk) {
        messages.push(
          "FC 26: add at least one link (Steam, EA, Xbox or PlayStation)."
        );
      }
      if (playsTekken && !tekkenOk) {
        messages.push(
          "Tekken 8: add at least one link (Steam, Xbox or PlayStation)."
        );
      }

      showToast({
        type: "info",
        title: "Add your profile links",
        message:
          messages.length > 0
            ? messages.join(" ")
            : "Please add at least one platform link for each game you selected.",
      });

      return;
    }

    setSaving(true);
    console.log("[Step3] saving platform links and going to step 4");

    setStep3({
      steamProfileUrl: steamProfileUrl.trim(),
      faceitProfileUrl: faceitProfileUrl.trim(),
      eaProfileUrl: eaProfileUrl.trim(),
      xboxGamertag: xboxGamertag.trim(),
      psnOnlineId: psnOnlineId.trim(),
      steamProfile,
      faceitProfile,
    });

    setSaving(false);
    router.push("/auth/register-step4");
  };

  // Show only platforms that make sense
  const showSteam = playsCs2 || playsFc || playsTekken;
  const showFaceit = playsCs2;
  const showEa = playsFc;
  const showXbox = playsFc || playsTekken;
  const showPsn = playsFc || playsTekken;

  // Dynamic helper subtitles
  const steamGames: string[] = [];
  if (playsCs2) steamGames.push("CS2");
  if (playsFc) steamGames.push("FC 26");
  if (playsTekken) steamGames.push("Tekken 8");
  const steamSubtitle = steamGames.length
    ? `Paste your Steam profile link for ${steamGames.join(" · ")}.`
    : "Paste your Steam profile link.";

  const eaSubtitle = playsFc
    ? "FC 26: paste a link we can use (club page or EA ID)."
    : "Paste your EA account / club link.";

  const xboxSubtitleParts: string[] = [];
  if (playsFc) xboxSubtitleParts.push("FC 26");
  if (playsTekken) xboxSubtitleParts.push("Tekken 8");
  const xboxSubtitle = xboxSubtitleParts.length
    ? `Enter your Xbox gamertag for ${xboxSubtitleParts.join(" & ")}.`
    : "Enter your Xbox gamertag.";

  const psnSubtitleParts: string[] = [];
  if (playsFc) psnSubtitleParts.push("FC 26");
  if (playsTekken) psnSubtitleParts.push("Tekken 8");
  const psnSubtitle = psnSubtitleParts.length
    ? `Enter your PSN ID for ${psnSubtitleParts.join(" & ")}.`
    : "Enter your PlayStation Network ID.";

  // helper for FACEIT icon
  const faceitLevelIcon =
    faceitProfile?.skillLevel && faceitLevelIcons[faceitProfile.skillLevel];

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
              <Text style={styles.stepperTitle}>Account links</Text>
              <Text style={styles.stepperSubtitle}>
                Step 3 of 4 · Add your profile links
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
          Add your account links
        </Text>
        <Text style={styles.sub}>
          Paste the profile links or IDs you use for ranked play. We&apos;ll use
          these for verification and matchmaking.
        </Text>

        {/* Steam */}
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
            </View>

            <View
              style={[
                styles.inputBox,
                styles.inputRow,
                { marginTop: 10, marginBottom: 8 },
              ]}
            >
              <MaterialIcons
                name="link"
                size={18}
                style={styles.prefixIcon}
                color={
                  steamProfileUrl.trim().length > 0
                    ? COLORS.accent
                    : COLORS.muted
                }
              />
              <TextInput
                placeholder="https://steamcommunity.com/id/yourprofile"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                selectionColor={COLORS.accent}
                autoCapitalize="none"
                autoCorrect={false}
                value={steamProfileUrl}
                onChangeText={(text) => {
                  setSteamProfileUrl(text);
                  if (steamProfile) {
                    setSteamProfile(null);
                  }
                }}
              />
            </View>

            <Pressable
              onPress={handleSteamLookup}
              disabled={steamLoading || !steamProfileUrl.trim()}
              style={({ pressed }) => [
                styles.platformButton,
                steamVerified && { backgroundColor: "#1DB954" },
                pressed && !steamLoading && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.platformButtonText}>
                {steamLoading
                  ? "Checking..."
                  : steamVerified
                  ? "Steam verified"
                  : "Verify Steam profile"}
              </Text>
            </Pressable>

            {steamProfile && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.summaryLabel}>Verified profile</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    { color: COLORS.accent, fontWeight: "600" },
                  ]}
                >
                  {steamProfile.personaName}{" "}
                  {steamProfile.cs2Hours != null
                    ? `· CS2: ~${Math.round(steamProfile.cs2Hours)} hours`
                    : ""}
                </Text>
              </View>
            )}

            {steamLooksWeird && (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperWarning]}>
                  This doesn&apos;t look like a full Steam profile link. Make
                  sure it starts with https://steamcommunity.com/...
                </Text>
              </View>
            )}
          </View>
        )}

        {/* FACEIT */}
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
                  CS2 only: paste your FACEIT profile link or nickname.
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.inputBox,
                styles.inputRow,
                { marginTop: 10, marginBottom: 8 },
              ]}
            >
              <MaterialIcons
                name="link"
                size={18}
                style={styles.prefixIcon}
                color={
                  faceitProfileUrl.trim().length > 0
                    ? COLORS.accent
                    : COLORS.muted
                }
              />
              <TextInput
                placeholder="https://www.faceit.com/en/players/yourname"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                selectionColor={COLORS.accent}
                autoCapitalize="none"
                autoCorrect={false}
                value={faceitProfileUrl}
                onChangeText={(text) => {
                  setFaceitProfileUrl(text);
                  if (faceitProfile) {
                    setFaceitProfile(null);
                  }
                }}
              />
            </View>

            <Pressable
              onPress={handleFaceitLookup}
              disabled={faceitLoading || !faceitProfileUrl.trim()}
              style={({ pressed }) => [
                styles.platformButton,
                faceitVerified && { backgroundColor: "#1DB954" },
                pressed && !faceitLoading && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.platformButtonText}>
                {faceitLoading
                  ? "Checking..."
                  : faceitVerified
                  ? "FACEIT verified"
                  : "Verify FACEIT profile"}
              </Text>
            </Pressable>

            {faceitProfile && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.summaryLabel}>Verified profile</Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text
                    style={[
                      styles.summaryValue,
                      { color: COLORS.accent, fontWeight: "600" },
                    ]}
                  >
                    {faceitProfile.nickname}
                  </Text>

                  {/* spacer */}
                  <View style={{ width: 8 }} />

                  {/* ELO */}
                  {faceitProfile.elo != null && (
                    <Text style={styles.summaryValue}>
                      ELO {faceitProfile.elo}
                    </Text>
                  )}

                  {/* Level icon / fallback text */}
                  {faceitProfile.skillLevel != null && (
                    <View
                      style={{
                        marginLeft: 8,
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                    >
                      {faceitLevelIcon ? (
                        <Image
                          source={faceitLevelIcon}
                          style={{ width: 24, height: 24 }}
                          resizeMode="contain"
                        />
                      ) : (
                        <Text style={styles.summaryValue}>
                          Level {faceitProfile.skillLevel}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </View>
            )}

            {faceitLooksWeird && (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperWarning]}>
                  This doesn&apos;t look like a FACEIT link or nickname. Use
                  your profile URL or a simple nickname (letters, numbers,
                  underscore).
                </Text>
              </View>
            )}
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
                <Text style={styles.platformTitle}>EA Account / Club</Text>
                <Text style={styles.platformSubtitle}>{eaSubtitle}</Text>
              </View>
            </View>
            <View style={[styles.inputBox, styles.inputRow, { marginTop: 10 }]}>
              <MaterialIcons
                name="link"
                size={18}
                style={styles.prefixIcon}
                color={
                  eaProfileUrl.trim().length > 0 ? COLORS.accent : COLORS.muted
                }
              />
              <TextInput
                placeholder="Club link or EA ID (optional)"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                selectionColor={COLORS.accent}
                autoCapitalize="none"
                autoCorrect={false}
                value={eaProfileUrl}
                onChangeText={setEaProfileUrl}
              />
            </View>

            {eaLooksWeird && (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperWarning]}>
                  That looks very short. Please double-check your EA ID or club
                  link.
                </Text>
              </View>
            )}
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
            </View>
            <View style={[styles.inputBox, styles.inputRow, { marginTop: 10 }]}>
              <MaterialIcons
                name="person"
                size={18}
                style={styles.prefixIcon}
                color={
                  xboxGamertag.trim().length > 0
                    ? COLORS.accent
                    : COLORS.muted
                }
              />
              <TextInput
                placeholder="Your Xbox gamertag"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                selectionColor={COLORS.accent}
                autoCapitalize="none"
                autoCorrect={false}
                value={xboxGamertag}
                onChangeText={setXboxGamertag}
              />
            </View>

            {xboxLooksWeird && (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperWarning]}>
                  That gamertag looks very short. Please double-check it.
                </Text>
              </View>
            )}
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
            </View>
            <View style={[styles.inputBox, styles.inputRow, { marginTop: 10 }]}>
              <MaterialIcons
                name="person"
                size={18}
                style={styles.prefixIcon}
                color={
                  psnOnlineId.trim().length > 0 ? COLORS.accent : COLORS.muted
                }
              />
              <TextInput
                placeholder="Your PSN online ID"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                selectionColor={COLORS.accent}
                autoCapitalize="none"
                autoCorrect={false}
                value={psnOnlineId}
                onChangeText={setPsnOnlineId}
              />
            </View>

            {psnLooksWeird && (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperWarning]}>
                  That PSN ID looks very short. Please double-check it.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Validation helpers per game */}
        {playsCs2 && !cs2Ok && (
          <View style={styles.helperTextRow}>
            <Text style={[styles.helperText, styles.helperWarning]}>
              CS2: add at least a Steam or FACEIT link.
            </Text>
          </View>
        )}
        {playsFc && !fcOk && (
          <View style={styles.helperTextRow}>
            <Text style={[styles.helperText, styles.helperWarning]}>
              FC 26: add at least one link (Steam, EA, Xbox or PlayStation).
            </Text>
          </View>
        )}
        {playsTekken && !tekkenOk && (
          <View style={styles.helperTextRow}>
            <Text style={[styles.helperText, styles.helperWarning]}>
              Tekken 8: add at least one link (Steam, Xbox or PlayStation).
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
