// app/auth/register-step3.tsx
import { MaterialIcons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { Link, router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { PsnVerificationResult, verifyPsnProfile } from "../../src/services/psnApi";
import {
  fetchSteamProfileFromUrl,
  SteamProfileSummary,
} from "../../src/services/steamApi";
import {
  isFaceitIdAvailable,
  isPsnIdAvailable,
  isSteamIdAvailable
} from "../../src/services/userService";
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

type VerificationStatus = "unverified" | "verifying" | "verified" | "failed";

const STEAM_ID_REGEX = /^(?:https?:\/\/)?steamcommunity\.com\/(?:profiles|id)\/([a-zA-Z0-9_-]+)/i;
const FACEIT_URL_REGEX = /^(?:https?:\/\/)?(?:www\.)?faceit\.com\/[a-z]{2}\/players\/([a-zA-Z0-9_-]+)/i;

export default function RegisterStep3() {
  const { step2, step3, setStep3 } = useOnboardingStore();
  const { showToast } = useToast();

  // Initial values from step2
  const [playsCs2] = useState<boolean>(step2.playsCs2);
  const [playsFc] = useState<boolean>(step2.playsFc);
  const [playsTekken] = useState<boolean>(step2.playsTekken);

  // local editable fields for links / IDs
  const [steamProfileUrl, setSteamProfileUrl] = useState(step3.steamProfileUrl ?? "");
  const [faceitProfileUrl, setFaceitProfileUrl] = useState(step3.faceitProfileUrl ?? "");
  const [psnOnlineId, setPsnOnlineId] = useState(step3.psnOnlineId ?? "");

  // fetched summaries
  const [steamProfile, setSteamProfile] = useState<SteamProfileSummary | null>(step3.steamProfile ?? null);
  const [faceitProfile, setFaceitProfile] = useState<FaceitProfileSummary | null>(step3.faceitProfile ?? null);
  const [psnProfile, setPsnProfile] = useState<PsnVerificationResult | null>((step3 as any).psnStats ?? null);

  // Verification Status Machine
  const [steamStatus, setSteamStatus] = useState<VerificationStatus>(steamProfile ? "verified" : "unverified");
  const [faceitStatus, setFaceitStatus] = useState<VerificationStatus>(faceitProfile ? "verified" : "unverified");
  const [psnStatus, setPsnStatus] = useState<VerificationStatus>(psnProfile ? "verified" : "unverified");

  // Cooldown logic (10s)
  const [steamCooldown, setSteamCooldown] = useState(0);
  const [faceitCooldown, setFaceitCooldown] = useState(0);
  const [psnCooldown, setPsnCooldown] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSteamCooldown((c) => Math.max(0, c - 1));
      setFaceitCooldown((c) => Math.max(0, c - 1));
      setPsnCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [saving, setSaving] = useState(false);
  const isFocused = useIsFocused();

  // Redirect if missing step2
  useEffect(() => {
    if (!isFocused) return;
    if (!step2.selectedAreas.length && !playsCs2 && !playsFc && !playsTekken) {
      router.replace("/auth/register-step2");
    }
  }, [isFocused, step2, playsCs2, playsFc, playsTekken]);

  // --- Combined Gating Logic ---
  const { isFormValid, gate1Met, gate2Met } = useMemo(() => {
    const steamV = steamStatus === "verified";
    const faceitV = faceitStatus === "verified";
    const psnV = psnStatus === "verified";

    // Gate 1: CS2 -> steam OR faceit
    const g1 = playsCs2 ? (steamV || faceitV) : true;
    // Gate 2: Fighting/FC -> steam OR psn
    const g2 = (playsFc || playsTekken) ? (steamV || psnV) : true;

    return {
      gate1Met: g1,
      gate2Met: g2,
      isFormValid: g1 && g2,
    };
  }, [playsCs2, playsFc, playsTekken, steamStatus, faceitStatus, psnStatus]);

  // --- Verification Parsing & Logic ---
  const extractSteamId = (input: string) => {
    const match = input.match(STEAM_ID_REGEX);
    return match ? match[1] : input.trim();
  };

  const extractFaceitNick = (input: string) => {
    const match = input.match(FACEIT_URL_REGEX);
    return match ? match[1] : input.trim();
  };

  const handleSteamLookup = async () => {
    const query = extractSteamId(steamProfileUrl);
    if (!query) return;

    setSteamStatus("verifying");
    const res = await fetchSteamProfileFromUrl(query);

    if (!res.ok) {
      setSteamStatus("failed");
      setSteamCooldown(10);
      showToast({ type: "error", title: "Steam lookup failed", message: res.message });
      return;
    }

    const available = await isSteamIdAvailable(res.data.steamId);
    if (!available) {
      setSteamStatus("failed");
      setSteamCooldown(10);
      showToast({ type: "warning", title: "Steam taken", message: "This Steam account is already linked to another user." });
      return;
    }

    setSteamStatus("verified");
    setSteamProfile(res.data);
    showToast({ type: "success", title: "Steam linked", message: `Found ${res.data.personaName}` });
  };

  const handleFaceitLookup = async () => {
    const query = extractFaceitNick(faceitProfileUrl);
    if (!query) return;

    setFaceitStatus("verifying");
    const res = await fetchFaceitProfileFromUrl(query);

    if (!res.ok) {
      setFaceitStatus("failed");
      setFaceitCooldown(10);
      showToast({ type: "error", title: "FACEIT lookup failed", message: res.message });
      return;
    }

    const available = await isFaceitIdAvailable(res.data.faceitId);
    if (!available) {
      setFaceitStatus("failed");
      setFaceitCooldown(10);
      showToast({ type: "warning", title: "FACEIT taken", message: "This FACEIT account is already linked to another user." });
      return;
    }

    setFaceitStatus("verified");
    setFaceitProfile(res.data);
    showToast({ type: "success", title: "FACEIT linked", message: `Found ${res.data.nickname}` });
  };

  const handlePsnLookup = async () => {
    const query = psnOnlineId.trim();
    if (!query) return;

    setPsnStatus("verifying");
    const res = await verifyPsnProfile(query, playsTekken, playsFc);

    if (!res.ok) {
      setPsnStatus("failed");
      setPsnCooldown(10);
      showToast({ type: "error", title: "PSN verification failed", message: res.message });
      return;
    }

    const available = await isPsnIdAvailable(res.data.psnAccountId);
    if (!available) {
      setPsnStatus("failed");
      setPsnCooldown(10);
      showToast({ type: "warning", title: "PSN taken", message: "This PSN account is already linked to another user." });
      return;
    }

    setPsnStatus("verified");
    setPsnProfile(res.data);
    showToast({ type: "success", title: "PSN linked", message: "PSN profile verified successfully." });
  };

  const handleContinue = () => {
    if (!isFormValid) {
      const messages: string[] = [];
      if (playsCs2 && !gate1Met) messages.push("CS2 requires Steam or FACEIT.");
      if ((playsFc || playsTekken) && !gate2Met) messages.push("Fighting/FC require Steam or PSN.");

      showToast({ type: "info", title: "Requirements missing", message: messages.join(" ") });
      return;
    }

    setSaving(true);
    setStep3({
      steamProfileUrl: steamProfileUrl.trim(),
      faceitProfileUrl: faceitProfileUrl.trim(),
      psnOnlineId: psnOnlineId.trim(),
      steamProfile,
      faceitProfile,
      psnProfile,
    });

    setSaving(false);
    router.push("/auth/register-step4");
  };

  // Visibility flags
  const showSteam = playsCs2 || playsFc || playsTekken;
  const showFaceit = playsCs2;
  const showPsn = playsFc || playsTekken;

  // Subtitles
  const steamSubtitle = "Link your Steam profile for automated skill verification.";
  const faceitSubtitle = "Link your FACEIT profile to verify your CS2 rank/ELO.";
  const psnSubtitle = "Enter your PSN Online ID for Tekken/FC verification.";

  const faceitLevelIcon = faceitProfile?.skillLevel && faceitLevelIcons[faceitProfile.skillLevel];

  const Container = KeyboardAvoidingView;
  const containerProps = {
    style: styles.screen,
    behavior: Platform.OS === "ios" ? ("padding" as const) : ("height" as const),
    keyboardVerticalOffset: Platform.OS === "ios" ? 0 : 20,
  };

  return (
    <Container {...containerProps}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 32 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <LogoHalo />

        <View style={styles.stepperWrapper}>
          <View style={styles.stepperTopRow}>
            <View>
              <Text style={styles.stepperTitle}>Account links</Text>
              <Text style={styles.stepperSubtitle}>Step 3 of 4 · Add your profile links</Text>
            </View>
          </View>
          <View style={styles.stepperBar}>
            <View style={[styles.stepperBarFill, { width: "75%" }]} />
          </View>
        </View>

        {/* Requirements Banner */}
        <View style={[styles.requirementBanner, isFormValid && styles.requirementMet]}>
          <Text style={[styles.requirementTitle, isFormValid && styles.requirementMetTitle]}>
            {isFormValid ? "Verification requirements satisfied ✓" : "Verification requirements"}
          </Text>
          <Text style={styles.requirementText}>
            {playsCs2 && (gate1Met ? "• CS2 verified ✓\n" : "• CS2 requires Steam or FACEIT verification.\n")}
            {(playsFc || playsTekken) && (gate2Met ? "• Tekken/FC verified ✓\n" : "• Tekken/FC require Steam or PSN verification.\n")}
            {isFormValid && "You're all set to continue."}
          </Text>
        </View>

        <Text style={[styles.heading, { marginTop: 18 }]}>Add your account links</Text>
        <Text style={styles.sub}>Paste the profile links or IDs you use for ranked play. We'll use these for verification.</Text>

        {/* Steam */}
        {showSteam && (
          <View style={styles.platformCard}>
            <View style={styles.platformHeaderRow}>
              <View style={styles.platformIconCircle}><MaterialIcons name="link" size={18} color={COLORS.text} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.platformTitle}>Steam</Text>
                <Text style={styles.platformSubtitle}>{steamSubtitle}</Text>
              </View>
            </View>
            <View style={[styles.inputBox, styles.inputRow, { marginTop: 10, marginBottom: 8 }]}>
              <MaterialIcons name="link" size={18} style={styles.prefixIcon} color={steamProfileUrl.trim() ? COLORS.accent : COLORS.muted} />
              <TextInput
                placeholder="Steam link or ID"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                value={steamProfileUrl}
                onChangeText={(text) => {
                  setSteamProfileUrl(text);
                  if (steamStatus !== "unverified") setSteamStatus("unverified");
                }}
                editable={steamStatus !== "verifying" && steamCooldown === 0}
              />
              <Pressable
                onPress={handleSteamLookup}
                disabled={steamStatus === "verifying" || steamStatus === "verified" || steamCooldown > 0}
                android_ripple={{ color: COLORS.overlayMedium }}
              >
                {steamStatus === "verifying" ? <ActivityIndicator size="small" color={COLORS.text} /> : (
                  <Text style={styles.platformButtonText}>{steamStatus === "verified" ? "Verified" : "Verify"}</Text>
                )}
              </Pressable>
            </View>
            {steamCooldown > 0 && <Text style={styles.cooldownText}>Try again in {steamCooldown}s</Text>}
            {steamProfile && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.summaryLabel}>Found: {steamProfile.personaName}</Text>
                {steamProfile.cs2Hours != null && <Text style={styles.summaryValue}>~{Math.round(steamProfile.cs2Hours)}h in CS2</Text>}
              </View>
            )}
          </View>
        )}

        {/* FACEIT */}
        {showFaceit && (
          <View style={styles.platformCard}>
            <View style={styles.platformHeaderRow}>
              <View style={styles.platformIconCircle}><MaterialIcons name="sports-esports" size={18} color={COLORS.text} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.platformTitle}>FACEIT</Text>
                <Text style={styles.platformSubtitle}>{faceitSubtitle}</Text>
              </View>
            </View>
            <View style={[styles.inputBox, styles.inputRow, { marginTop: 10, marginBottom: 8 }]}>
              <MaterialIcons name="link" size={18} style={styles.prefixIcon} color={faceitProfileUrl.trim() ? COLORS.accent : COLORS.muted} />
              <TextInput
                placeholder="FACEIT nickname or link"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                value={faceitProfileUrl}
                onChangeText={(text) => {
                  setFaceitProfileUrl(text);
                  if (faceitStatus !== "unverified") setFaceitStatus("unverified");
                }}
                editable={faceitStatus !== "verifying" && faceitCooldown === 0}
              />
              <Pressable
                onPress={handleFaceitLookup}
                disabled={faceitStatus === "verifying" || faceitStatus === "verified" || faceitCooldown > 0}
                style={({ pressed }) => [
                  styles.platformButton,
                  { marginTop: 0, paddingVertical: 8, paddingHorizontal: 12, minWidth: 80 },
                  faceitStatus === "verified" && styles.platformButtonActive,
                  (faceitStatus === "verifying" || faceitCooldown > 0) && { opacity: 0.5 },
                  pressed && { opacity: 0.8 },
                ]}
              >
                {faceitStatus === "verifying" ? <ActivityIndicator size="small" color={COLORS.text} /> : (
                  <Text style={styles.platformButtonText}>{faceitStatus === "verified" ? "Verified" : "Verify"}</Text>
                )}
              </Pressable>
            </View>
            {faceitCooldown > 0 && <Text style={styles.cooldownText}>Try again in {faceitCooldown}s</Text>}
            {faceitProfile && (
              <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.summaryLabel}>Found: {faceitProfile.nickname} (Level {faceitProfile.skillLevel})</Text>
                {faceitLevelIcon && <Image source={faceitLevelIcon} style={{ width: 24, height: 24, marginLeft: 8 }} resizeMode="contain" />}
              </View>
            )}
          </View>
        )}

        {/* PSN */}
        {showPsn && (
          <View style={styles.platformCard}>
            <View style={styles.platformHeaderRow}>
              <View style={styles.platformIconCircle}><MaterialIcons name="sports-esports" size={18} color={COLORS.text} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.platformTitle}>PlayStation Network</Text>
                <Text style={styles.platformSubtitle}>{psnSubtitle}</Text>
              </View>
            </View>
            <View style={[styles.inputBox, styles.inputRow, { marginTop: 10, marginBottom: 8 }]}>
              <MaterialIcons name="person" size={18} style={styles.prefixIcon} color={psnOnlineId.trim() ? COLORS.accent : COLORS.muted} />
              <TextInput
                placeholder="MyPsnId_123"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                value={psnOnlineId}
                onChangeText={(text) => {
                  setPsnOnlineId(text);
                  if (psnStatus !== "unverified") setPsnStatus("unverified");
                }}
                editable={psnStatus !== "verifying" && psnCooldown === 0}
              />
              <Pressable
                onPress={handlePsnLookup}
                disabled={psnStatus === "verifying" || psnStatus === "verified" || psnCooldown > 0}
                style={({ pressed }) => [
                  styles.platformButton,
                  { marginTop: 0, paddingVertical: 8, paddingHorizontal: 12, minWidth: 80 },
                  psnStatus === "verified" && styles.platformButtonActive,
                  (psnStatus === "verifying" || psnCooldown > 0) && { opacity: 0.5 },
                  pressed && { opacity: 0.8 },
                ]}
              >
                {psnStatus === "verifying" ? <ActivityIndicator size="small" color={COLORS.text} /> : (
                  <Text style={styles.platformButtonText}>{psnStatus === "verified" ? "Verified" : "Verify"}</Text>
                )}
              </Pressable>
            </View>
            {psnCooldown > 0 && <Text style={styles.cooldownText}>Try again in {psnCooldown}s</Text>}
            {psnProfile && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.summaryLabel}>Verified: {psnProfile.psnOnlineId}</Text>
                <Text style={styles.summaryValue}>Level {psnProfile.trophyLevel} · {psnProfile.totalTrophies?.platinum ?? 0} Platinums</Text>
              </View>
            )}
          </View>
        )}

        <Pressable onPress={() => router.push("/auth/register-step2")} style={styles.backLinkWrapper}>
          <Text style={styles.backLinkText}>← Back to games & location</Text>
        </Pressable>

        <View style={[styles.buttonShadowWrapper, isFormValid && !saving && styles.buttonShadowWrapperActive]}>
          <Pressable
            onPress={handleContinue}
            disabled={saving || !isFormValid}
            style={({ pressed }) => [
              styles.primaryBtn,
              !isFormValid || saving ? styles.primaryBtnDisabled : null,
              pressed && !saving && isFormValid && { opacity: 0.92 },
            ]}
          >
            <Text style={styles.primaryBtnText}>{saving ? "Saving..." : "Continue"}</Text>
          </Pressable>
        </View>

        <Text style={styles.bottomText}>
          Want to sign in instead?{" "}
          <Link href="/auth/login" style={{ color: COLORS.accent }}>Go to login</Link>
        </Text>
      </ScrollView>
    </Container>
  );
}
