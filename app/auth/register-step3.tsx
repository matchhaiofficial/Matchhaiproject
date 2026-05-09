import { useIsFocused } from "@react-navigation/native";
import { Link, router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { AppIcon } from "../../src/components/AppIcon";
import { AppImage } from "../../src/components/AppImage";
import { AppButton } from "../../src/components/AppPrimitives";
import Screen from "../../src/components/Screen";
import { useToast } from "../../src/hooks/useToast";
import {
  FaceitProfileSummary,
  fetchFaceitProfileFromUrl,
  PsnVerificationResult,
  SteamProfileSummary,
  fetchSteamProfileFromUrl,
  verifyPsnProfile,
} from "../../src/services/convex/externalApiService";
import {
  isFaceitIdAvailable,
  isPsnIdAvailable,
  isSteamIdAvailable,
} from "../../src/services/convex/userService";
import { useOnboardingStore } from "../../src/store/onboardingStore";
import { COLORS } from "../../src/theme";
import RegistrationStepHeader from "./components/RegistrationStepHeader";
import styles from "./register.styles";

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

const STEAM_ID_REGEX =
  /^(?:https?:\/\/)?steamcommunity\.com\/(?:profiles|id)\/([a-zA-Z0-9_-]+)/i;
const FACEIT_URL_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?faceit\.com\/[a-z]{2}\/players\/([a-zA-Z0-9_-]+)/i;

export default function RegisterStep3() {
  const { step2, step3, setStep3, setCurrentStep } = useOnboardingStore();
  const { showToast } = useToast();
  const isFocused = useIsFocused();

  const [playsCs2] = useState<boolean>(step2.playsCs2);
  const [playsCs16] = useState<boolean>((step2 as any).playsCs16 ?? false);
  const [playsValorant] = useState<boolean>((step2 as any).playsValorant ?? false);
  const [playsFc] = useState<boolean>(step2.playsFc);
  const [playsTekken] = useState<boolean>(step2.playsTekken);
  const [playsFutsal] = useState<boolean>((step2 as any).playsFutsal ?? false);
  const [playsIndoorCricket] = useState<boolean>((step2 as any).playsIndoorCricket ?? false);
  const [playsPadel] = useState<boolean>((step2 as any).playsPadel ?? false);
  const [playsPickleball] = useState<boolean>((step2 as any).playsPickleball ?? false);

  const [steamProfileUrl, setSteamProfileUrl] = useState(step3.steamProfileUrl ?? "");
  const [faceitProfileUrl, setFaceitProfileUrl] = useState(step3.faceitProfileUrl ?? "");
  const [psnOnlineId, setPsnOnlineId] = useState(step3.psnOnlineId ?? "");
  const [steamProfile, setSteamProfile] = useState<SteamProfileSummary | null>(
    step3.steamProfile ?? null,
  );
  const [faceitProfile, setFaceitProfile] = useState<FaceitProfileSummary | null>(
    step3.faceitProfile ?? null,
  );
  const [psnProfile, setPsnProfile] = useState<PsnVerificationResult | null>(
    (step3 as any).psnStats ?? null,
  );
  const [steamStatus, setSteamStatus] = useState<VerificationStatus>(
    steamProfile ? "verified" : "unverified",
  );
  const [faceitStatus, setFaceitStatus] = useState<VerificationStatus>(
    faceitProfile ? "verified" : "unverified",
  );
  const [psnStatus, setPsnStatus] = useState<VerificationStatus>(
    psnProfile ? "verified" : "unverified",
  );
  const [steamCooldown, setSteamCooldown] = useState(0);
  const [faceitCooldown, setFaceitCooldown] = useState(0);
  const [psnCooldown, setPsnCooldown] = useState(0);
  const [steamFocused, setSteamFocused] = useState(false);
  const [faceitFocused, setFaceitFocused] = useState(false);
  const [psnFocused, setPsnFocused] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCurrentStep(3);
  }, [setCurrentStep]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSteamCooldown((current) => Math.max(0, current - 1));
      setFaceitCooldown((current) => Math.max(0, current - 1));
      setPsnCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isFocused) return;
    const hasActivity =
      playsCs2 ||
      playsCs16 ||
      playsValorant ||
      playsFc ||
      playsTekken;
    if (!step2.selectedAreas.length || !hasActivity) {
      router.replace("/auth/register-step2");
    }
  }, [
    isFocused,
    playsCs2,
    playsCs16,
    playsFc,
    playsTekken,
    playsValorant,
    step2.selectedAreas.length,
  ]);

  const extractSteamId = (input: string) => {
    const match = input.match(STEAM_ID_REGEX);
    return match ? match[1] : input.trim();
  };

  const extractFaceitNick = (input: string) => {
    const match = input.match(FACEIT_URL_REGEX);
    return match ? match[1] : input.trim();
  };

  const persistStep = () => {
    setStep3({
      steamProfileUrl: steamProfileUrl.trim(),
      faceitProfileUrl: faceitProfileUrl.trim(),
      psnOnlineId: psnOnlineId.trim(),
      steamProfile,
      faceitProfile,
      psnProfile,
    });
  };

  const handleSteamLookup = async () => {
    const query = extractSteamId(steamProfileUrl);
    if (!query) return;

    setSteamStatus("verifying");
    const result = await fetchSteamProfileFromUrl(query);
    if (!result.ok) {
      setSteamStatus("failed");
      setSteamCooldown(10);
      showToast({ type: "error", title: "Steam lookup failed", message: result.message });
      return;
    }

    const available = await isSteamIdAvailable(result.data.steamId);
    if (!available) {
      setSteamStatus("failed");
      setSteamCooldown(10);
      showToast({
        type: "warning",
        title: "Steam taken",
        message: "This Steam account is already linked to another user.",
      });
      return;
    }

    setSteamStatus("verified");
    setSteamProfile(result.data);
    showToast({
      type: "success",
      title: "Steam linked",
      message: `Found ${result.data.personaName}`,
    });
  };

  const handleFaceitLookup = async () => {
    const query = extractFaceitNick(faceitProfileUrl);
    if (!query) return;

    setFaceitStatus("verifying");
    const result = await fetchFaceitProfileFromUrl(query);
    if (!result.ok) {
      setFaceitStatus("failed");
      setFaceitCooldown(10);
      showToast({ type: "error", title: "FACEIT lookup failed", message: result.message });
      return;
    }

    const available = await isFaceitIdAvailable(result.data.faceitId);
    if (!available) {
      setFaceitStatus("failed");
      setFaceitCooldown(10);
      showToast({
        type: "warning",
        title: "FACEIT taken",
        message: "This FACEIT account is already linked to another user.",
      });
      return;
    }

    setFaceitStatus("verified");
    setFaceitProfile(result.data);
    showToast({
      type: "success",
      title: "FACEIT linked",
      message: `Found ${result.data.nickname}`,
    });
  };

  const handlePsnLookup = async () => {
    const query = psnOnlineId.trim();
    if (!query) return;

    setPsnStatus("verifying");
    const result = await verifyPsnProfile(query, playsTekken, playsFc);
    if (!result.ok) {
      setPsnStatus("failed");
      setPsnCooldown(10);
      showToast({ type: "error", title: "PSN verification failed", message: result.message });
      return;
    }

    if (!result.data.psnAccountId) {
      setPsnStatus("failed");
      setPsnCooldown(10);
      showToast({
        type: "error",
        title: "PSN verification failed",
        message: "Could not retrieve PSN account ID. Profile may be private.",
      });
      return;
    }

    const available = await isPsnIdAvailable(result.data.psnAccountId);
    if (!available) {
      setPsnStatus("failed");
      setPsnCooldown(10);
      showToast({
        type: "warning",
        title: "PSN taken",
        message: "This PSN account is already linked to another user.",
      });
      return;
    }

    setPsnStatus("verified");
    setPsnProfile(result.data);
    showToast({
      type: "success",
      title: "PSN linked",
      message: "PSN profile verified successfully.",
    });
  };

  const handleContinue = () => {
    setSaving(true);
    persistStep();
    setSaving(false);
    router.replace("/auth/register-step4");
  };

  const handleSkip = () => {
    setSaving(true);
    persistStep();
    setSaving(false);
    router.replace("/auth/register-step4");
  };

  const showSteam = playsCs2 || playsFc || playsTekken;
  const showFaceit = playsCs2;
  const showPsn = playsFc || playsTekken;
  const faceitLevelIcon =
    faceitProfile?.skillLevel && faceitLevelIcons[faceitProfile.skillLevel];

  return (
    <Screen
      scroll
      keyboardAvoiding
      style={styles.screen}
      contentStyle={styles.container}
      routeKey="/auth/register-step3"
      scrollProps={{
        showsVerticalScrollIndicator: false,
        keyboardShouldPersistTaps: "handled",
      }}
    >
      <RegistrationStepHeader
        title="Platform Links"
        subtitle=""
        stepTitle="Step 3 of 4"
        stepSubtitle="Optional account links"
        progress="75%"
        onBack={() => router.replace("/auth/register-step2")}
      />

      <Text style={styles.heading}>Add links you actually use</Text>
      <Text style={styles.sub}>
        Steam, FACEIT, and PSN help with faster verification. You can skip this step and add them later from Profile.
      </Text>

      {showSteam ? (
        <View style={styles.platformCard}>
          <View style={styles.platformHeaderRow}>
            <View style={styles.platformIconCircle}>
              <AppIcon name="link" size={18} color={COLORS.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.platformTitle}>Steam</Text>
              <Text style={styles.platformSubtitle}>
                Link your Steam profile for automated skill verification.
              </Text>
            </View>
          </View>
          <View style={[styles.inputBox, styles.inputRow, { marginTop: 10, marginBottom: 8 }]}>
            <AppIcon
              name="link"
              size={18}
              style={styles.prefixIcon}
              color={steamProfileUrl.trim() ? COLORS.accent : COLORS.muted}
            />
            {!steamProfileUrl.trim() && !steamFocused ? (
              <Text style={styles.inputPlaceholderOverlay} numberOfLines={1} ellipsizeMode="tail">
                steamcommunity.com/id/m_ahmed
              </Text>
            ) : null}
            <TextInput
              style={styles.input}
              value={steamProfileUrl}
              onFocus={() => setSteamFocused(true)}
              onBlur={() => setSteamFocused(false)}
              onChangeText={(text) => {
                setSteamProfileUrl(text);
                if (steamStatus !== "unverified") setSteamStatus("unverified");
              }}
              editable={steamStatus !== "verifying" && steamCooldown === 0}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              onPress={handleSteamLookup}
              disabled={steamStatus === "verifying" || steamStatus === "verified" || steamCooldown > 0}
              style={({ pressed }) => [
                styles.platformButton,
                styles.platformButtonInline,
                steamStatus === "verified" && styles.platformButtonActive,
                (steamStatus === "verifying" || steamCooldown > 0) && { opacity: 0.5 },
                pressed && { opacity: 0.8 },
              ]}
            >
              {steamStatus === "verifying" ? (
                <ActivityIndicator size="small" color={COLORS.text} />
              ) : (
                <Text style={styles.platformButtonText}>
                  {steamStatus === "verified" ? "Verified" : "Verify"}
                </Text>
              )}
            </Pressable>
          </View>
          {steamCooldown > 0 ? (
            <Text style={styles.cooldownText}>Try again in {steamCooldown}s</Text>
          ) : null}
          {steamProfile ? (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.summaryLabel}>Found: {steamProfile.personaName}</Text>
              {steamProfile.cs2Hours != null ? (
                <Text style={styles.summaryValue}>~{Math.round(steamProfile.cs2Hours)}h in CS2</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {showFaceit ? (
        <View style={styles.platformCard}>
          <View style={styles.platformHeaderRow}>
            <View style={styles.platformIconCircle}>
              <AppIcon name="sports-esports" size={18} color={COLORS.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.platformTitle}>FACEIT</Text>
              <Text style={styles.platformSubtitle}>
                Link your FACEIT profile to verify your CS2 rank and ELO.
              </Text>
            </View>
          </View>
          <View style={[styles.inputBox, styles.inputRow, { marginTop: 10, marginBottom: 8 }]}>
            <AppIcon
              name="link"
              size={18}
              style={styles.prefixIcon}
              color={faceitProfileUrl.trim() ? COLORS.accent : COLORS.muted}
            />
            {!faceitProfileUrl.trim() && !faceitFocused ? (
              <Text style={styles.inputPlaceholderOverlay} numberOfLines={1} ellipsizeMode="tail">
                faceit.com/en/players/m_ahmed
              </Text>
            ) : null}
            <TextInput
              style={styles.input}
              value={faceitProfileUrl}
              onFocus={() => setFaceitFocused(true)}
              onBlur={() => setFaceitFocused(false)}
              onChangeText={(text) => {
                setFaceitProfileUrl(text);
                if (faceitStatus !== "unverified") setFaceitStatus("unverified");
              }}
              editable={faceitStatus !== "verifying" && faceitCooldown === 0}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              onPress={handleFaceitLookup}
              disabled={
                faceitStatus === "verifying" ||
                faceitStatus === "verified" ||
                faceitCooldown > 0
              }
              style={({ pressed }) => [
                styles.platformButton,
                styles.platformButtonInline,
                faceitStatus === "verified" && styles.platformButtonActive,
                (faceitStatus === "verifying" || faceitCooldown > 0) && { opacity: 0.5 },
                pressed && { opacity: 0.8 },
              ]}
            >
              {faceitStatus === "verifying" ? (
                <ActivityIndicator size="small" color={COLORS.text} />
              ) : (
                <Text style={styles.platformButtonText}>
                  {faceitStatus === "verified" ? "Verified" : "Verify"}
                </Text>
              )}
            </Pressable>
          </View>
          {faceitCooldown > 0 ? (
            <Text style={styles.cooldownText}>Try again in {faceitCooldown}s</Text>
          ) : null}
          {faceitProfile ? (
            <View style={styles.faceitSummaryRow}>
              <Text style={styles.summaryLabel}>
                Found: {faceitProfile.nickname} (Level {faceitProfile.skillLevel})
              </Text>
              {faceitLevelIcon ? (
                <AppImage source={faceitLevelIcon} containerStyle={styles.faceitLevelIcon} contentFit="contain" />
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {showPsn ? (
        <View style={styles.platformCard}>
          <View style={styles.platformHeaderRow}>
            <View style={styles.platformIconCircle}>
              <AppIcon name="sports-esports" size={18} color={COLORS.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.platformTitle}>PSN</Text>
              <Text style={styles.platformSubtitle}>
                Enter your PSN Online ID for Tekken or FC verification.
              </Text>
            </View>
          </View>
          <View style={[styles.inputBox, styles.inputRow, { marginTop: 10, marginBottom: 8 }]}>
            <AppIcon
              name="person"
              size={18}
              style={styles.prefixIcon}
              color={psnOnlineId.trim() ? COLORS.accent : COLORS.muted}
            />
            {!psnOnlineId.trim() && !psnFocused ? (
              <Text style={styles.inputPlaceholderOverlay} numberOfLines={1} ellipsizeMode="tail">
                e.g. ahmedplayspk
              </Text>
            ) : null}
            <TextInput
              style={styles.input}
              value={psnOnlineId}
              onFocus={() => setPsnFocused(true)}
              onBlur={() => setPsnFocused(false)}
              onChangeText={(text) => {
                setPsnOnlineId(text);
                if (psnStatus !== "unverified") setPsnStatus("unverified");
              }}
              editable={psnStatus !== "verifying" && psnCooldown === 0}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              onPress={handlePsnLookup}
              disabled={psnStatus === "verifying" || psnStatus === "verified" || psnCooldown > 0}
              style={({ pressed }) => [
                styles.platformButton,
                styles.platformButtonInline,
                psnStatus === "verified" && styles.platformButtonActive,
                (psnStatus === "verifying" || psnCooldown > 0) && { opacity: 0.5 },
                pressed && { opacity: 0.8 },
              ]}
            >
              {psnStatus === "verifying" ? (
                <ActivityIndicator size="small" color={COLORS.text} />
              ) : (
                <Text style={styles.platformButtonText}>
                  {psnStatus === "verified" ? "Verified" : "Verify"}
                </Text>
              )}
            </Pressable>
          </View>
          {psnCooldown > 0 ? (
            <Text style={styles.cooldownText}>Try again in {psnCooldown}s</Text>
          ) : null}
          {psnProfile ? (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.summaryLabel}>Verified: {psnProfile.psnOnlineId}</Text>
              <Text style={styles.summaryValue}>
                Level {psnProfile.trophyLevel} | {psnProfile.totalTrophies?.platinum ?? 0} platinums
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <Pressable onPress={() => router.replace("/auth/register-step2")} style={styles.backLinkWrapper}>
        <Text style={styles.backLinkText}>Back to games and location</Text>
      </Pressable>

      <View style={styles.buttonStack}>
        <AppButton variant="secondary" onPress={handleSkip} disabled={saving} size="lg">
          Skip for now
        </AppButton>
        <View style={[styles.buttonShadowWrapper, !saving && styles.buttonShadowWrapperActive]}>
          <AppButton
            onPress={handleContinue}
            disabled={saving}
            size="lg"
            style={[styles.primaryBtn, saving ? styles.primaryBtnDisabled : null]}
          >
            {saving ? "Saving..." : "Continue"}
          </AppButton>
        </View>
      </View>

      <Text style={styles.bottomText}>
        Want to sign in instead?{" "}
        <Link href="/auth/login" style={{ color: COLORS.accent }}>
          Go to login
        </Link>
      </Text>
    </Screen>
  );
}
