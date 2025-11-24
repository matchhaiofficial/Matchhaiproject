// app/auth/register-step4.tsx
import { MaterialIcons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import LogoHalo from "../../src/components/LogoHalo";
import { useToast } from "../../src/hooks/useToast";
import { signUpWithEmail } from "../../src/services/authService";
import {
  saveOnboardingStep2,
  saveOnboardingStep3Platforms,
} from "../../src/services/userService";
import { useOnboardingStore } from "../../src/store/onboardingStore";
import { COLORS } from "../../src/theme";
import styles from "./register.styles";

export default function RegisterStep4() {
  const { step1, step2, step3, step4, setStep4, resetAll } =
    useOnboardingStore();
  const { showToast } = useToast();

  console.log("[Step4] mounted", { step1, step2, step3, step4 });

  const [submitting, setSubmitting] = useState(false);

  // ---- Derived helpers ----
  // Games + offline sports summary (same idea as Step 3)
  const { selectedActivities, sportsSummary } = useMemo(() => {
    const items: string[] = [];
    if (step2.playsCs2) items.push("CS2");
    if (step2.playsFc) items.push("FC 26");
    if (step2.playsTekken) items.push("Tekken 8");

    const playsFutsal = (step2 as any).playsFutsal ?? false;
    const playsIndoorCricket = (step2 as any).playsIndoorCricket ?? false;
    const playsPadel = (step2 as any).playsPadel ?? false;
    const playsPickleball = (step2 as any).playsPickleball ?? false;

    if (playsFutsal) items.push("Futsal");
    if (playsIndoorCricket) items.push("Indoor Cricket");
    if (playsPadel) items.push("Padel");
    if (playsPickleball) items.push("Pickleball");

    const futsalPositions =
      (((step2 as any).futsalPositions ?? []) as string[]) || [];
    const indoorCricketRole =
      ((step2 as any).indoorCricketRole as string) ?? null;
    const indoorCricketBowlingStyle =
      ((step2 as any).indoorCricketBowlingStyle as string) ?? null;
    const indoorCricketBattingStyle =
      ((step2 as any).indoorCricketBattingStyle as string) ?? null;
    const padelRole = ((step2 as any).padelRole as string) ?? null;
    const pickleballRole = ((step2 as any).pickleballRole as string) ?? null;

    const details: string[] = [];

    if (playsFutsal && futsalPositions.length) {
      details.push(`Futsal: ${futsalPositions.join(" / ")}`);
    }

    if (playsIndoorCricket && indoorCricketRole) {
      let roleLabel = indoorCricketRole;
      if (indoorCricketRole === "Bowler" && indoorCricketBowlingStyle) {
        roleLabel += ` (${indoorCricketBowlingStyle})`;
      } else if (indoorCricketRole === "Batsman" && indoorCricketBattingStyle) {
        roleLabel += ` (${indoorCricketBattingStyle})`;
      }
      details.push(`Indoor Cricket: ${roleLabel}`);
    }

    if (playsPadel && padelRole) {
      details.push(`Padel: ${padelRole}`);
    }

    if (playsPickleball && pickleballRole) {
      details.push(`Pickleball: ${pickleballRole}`);
    }

    return {
      selectedActivities: items,
      sportsSummary: details.join(" · "),
    };
  }, [step2]);

  const connectedPlatforms = useMemo(() => {
    const platforms: string[] = [];
    if (step3.steamProfileUrl?.trim()) platforms.push("Steam");
    if (step3.faceitProfileUrl?.trim()) platforms.push("FACEIT");
    if (step3.eaProfileUrl?.trim()) platforms.push("EA / FC");
    if (step3.xboxGamertag?.trim()) platforms.push("Xbox");
    if (step3.psnOnlineId?.trim()) platforms.push("PSN");
    return platforms;
  }, [step3]);

  const allAgreementsChecked =
    step4.agreeTerms && step4.agreePrivacy && step4.consentMatchHistory;

  const toggleAgreeTerms = () => setStep4({ agreeTerms: !step4.agreeTerms });
  const toggleAgreePrivacy = () =>
    setStep4({ agreePrivacy: !step4.agreePrivacy });
  const toggleConsentMatchHistory = () =>
    setStep4({ consentMatchHistory: !step4.consentMatchHistory });

  // ---- Keyboard container ----
  const Container: any = Platform.OS === "ios" ? KeyboardAvoidingView : View;
  const containerProps =
    Platform.OS === "ios"
      ? {
          style: styles.screen,
          behavior: "padding" as const,
          keyboardVerticalOffset: 0,
        }
      : { style: styles.screen };

  // ---- Final submit (with parallel Firestore saves) ----
  const handleFinalSignUp = async () => {
    if (!allAgreementsChecked) {
      showToast({
        type: "info",
        title: "Almost there",
        message:
          "Please agree to the Terms, Privacy Policy and match history usage to continue.",
      });
      return;
    }

    const { fullName, username, email, phone, password } = step1;

    // Safety: if Step 1 is somehow incomplete, push them back
    if (!fullName.trim() || !username.trim() || !email.trim() || !password) {
      showToast({
        type: "error",
        title: "Missing details",
        message:
          "Some of your basic account details are missing. Please go back and complete Step 1.",
      });
      console.log(
        "[Step4] missing step1 data in submit → redirecting to /auth/register"
      );
      router.replace("/auth/register");
      return;
    }

    setSubmitting(true);

    try {
      // 1) Create auth user
      console.log("[Step4] signUpWithEmail payload:", {
        fullName,
        username,
        email,
        phone,
      });

      const resSignUp = await signUpWithEmail(
        email.trim(),
        password,
        fullName.trim(),
        username.trim(),
        phone.trim()
      );

      console.log("[Step4] signUpWithEmail result", resSignUp);

      if (!resSignUp || !resSignUp.ok) {
        showToast({
          type: "error",
          title: "Sign up failed",
          message:
            resSignUp?.message ??
            "Something went wrong while creating your account.",
        });
        return;
      }

      console.log(
        "[Step4] saving step2 & step3 in Firestore (parallel with Promise.all)"
      );

      // new sports-related fields from step2
      const playsFutsal = (step2 as any).playsFutsal ?? false;
      const playsIndoorCricket = (step2 as any).playsIndoorCricket ?? false;
      const playsPadel = (step2 as any).playsPadel ?? false;
      const playsPickleball = (step2 as any).playsPickleball ?? false;

      const futsalPositions =
        (((step2 as any).futsalPositions ?? []) as string[]) || [];
      const indoorCricketRole =
        ((step2 as any).indoorCricketRole as string) ?? null;
      const indoorCricketBowlingStyle =
        ((step2 as any).indoorCricketBowlingStyle as string) ?? null;
      const indoorCricketBattingStyle =
        ((step2 as any).indoorCricketBattingStyle as string) ?? null;
      const padelRole = ((step2 as any).padelRole as string) ?? null;
      const pickleballRole = ((step2 as any).pickleballRole as string) ?? null;

      // 2) Save Step 2 + Step 3 in PARALLEL
      const step2Payload: any = {
        areasPreferred: step2.selectedAreas,
        playsCs2: step2.playsCs2,
        cs2Role: step2.cs2Role,
        playsFc: step2.playsFc,
        fcTeam: step2.fcTeam.trim() || null,
        fcFormation: step2.fcFormation,
        playsTekken: step2.playsTekken,
        tekkenFavorites: step2.tekkenFavorites,

        // new offline sports fields
        playsFutsal,
        playsIndoorCricket,
        playsPadel,
        playsPickleball,
        futsalPositions,
        indoorCricketRole,
        indoorCricketBowlingStyle,
        indoorCricketBattingStyle,
        padelRole,
        pickleballRole,
      };

      const step3Payload: any = {
        steamProfileUrl: (step3.steamProfileUrl || "").trim() || null,
        faceitProfileUrl: (step3.faceitProfileUrl || "").trim() || null,
        eaProfileUrl: (step3.eaProfileUrl || "").trim() || null,
        xboxGamertag: (step3.xboxGamertag || "").trim() || null,
        psnOnlineId: (step3.psnOnlineId || "").trim() || null,
      };

      const [resStep2, resStep3] = await Promise.all([
        saveOnboardingStep2(step2Payload),
        saveOnboardingStep3Platforms(step3Payload),
      ]);

      console.log("[Step4] saveOnboardingStep2 result", resStep2);
      console.log("[Step4] saveOnboardingStep3Platforms result", resStep3);

      if (!resStep2.ok) {
        showToast({
          type: "error",
          title: "Could not save preferences",
          message: resStep2.message || "Please try again in a moment.",
        });
        return;
      }
      if (!resStep3.ok) {
        showToast({
          type: "error",
          title: "Could not save platforms",
          message: resStep3.message || "Please try again in a moment.",
        });
        return;
      }

      console.log("[Step4] resetAll onboarding store");

      // 3) Clear onboarding state & go home
      resetAll();
      showToast({
        type: "success",
        title: "Welcome to MatchHai",
        message: "Your account is ready. Let’s find your squad!",
      });
      console.log("[Step4] redirecting to /home");
      router.replace("/home");
    } catch (err) {
      console.log("[Step4] unexpected error:", err);
      showToast({
        type: "error",
        title: "Sign up failed",
        message:
          "Unexpected error while creating your account. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container {...containerProps}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LogoHalo />

        {/* Stepper: Step 4 of 4 */}
        <View style={styles.stepperWrapper}>
          <View style={styles.stepperTopRow}>
            <View>
              <Text style={styles.stepperTitle}>Review & confirm</Text>
              <Text style={styles.stepperSubtitle}>
                Step 4 of 4 · Check your details before signing up
              </Text>
            </View>
          </View>
          <View style={styles.stepperBar}>
            <View style={[styles.stepperBarFill, { width: "100%" }]} />
          </View>
          <View style={styles.stepperDotsRow}>
            <View style={[styles.stepperDot, styles.stepperDotActive]} />
            <View style={[styles.stepperDot, styles.stepperDotActive]} />
            <View style={[styles.stepperDot, styles.stepperDotActive]} />
            <View style={[styles.stepperDot, styles.stepperDotActive]} />
          </View>
        </View>

        {/* Headings */}
        <Text style={styles.heading}>Almost ready</Text>
        <Text style={styles.sub}>
          Confirm your account details, location, games and connected platforms
          before creating your MatchHai profile.
        </Text>

        {/* Account details review */}
        <View style={styles.reviewSectionCard}>
          <View style={styles.reviewSectionHeaderRow}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <MaterialIcons
                name="person"
                size={16}
                color={COLORS.accent}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.reviewSectionTitle}>Account details</Text>
            </View>
            <Pressable onPress={() => router.replace("/auth/register")}>
              <Text style={styles.reviewEditLink}>Edit</Text>
            </Pressable>
          </View>

          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Full name</Text>
            <Text
              style={[
                styles.reviewValue,
                !step1.fullName && styles.reviewValueMuted,
              ]}
              numberOfLines={1}
            >
              {step1.fullName || "Not set"}
            </Text>
          </View>

          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Username</Text>
            <Text
              style={[
                styles.reviewValue,
                !step1.username && styles.reviewValueMuted,
              ]}
              numberOfLines={1}
            >
              {step1.username || "Not set"}
            </Text>
          </View>

          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Email</Text>
            <Text
              style={[
                styles.reviewValue,
                !step1.email && styles.reviewValueMuted,
              ]}
              numberOfLines={1}
            >
              {step1.email || "Not set"}
            </Text>
          </View>

          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Phone</Text>
            <Text
              style={[
                styles.reviewValue,
                !step1.phone && styles.reviewValueMuted,
              ]}
              numberOfLines={1}
            >
              {step1.phone || "Not set"}
            </Text>
          </View>
        </View>

        {/* Location & games/sports review */}
        <View style={styles.reviewSectionCard}>
          <View style={styles.reviewSectionHeaderRow}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <MaterialIcons
                name="map"
                size={16}
                color={COLORS.accent}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.reviewSectionTitle}>
                Location & games/sports
              </Text>
            </View>
            <Pressable onPress={() => router.replace("/auth/register-step2")}>
              <Text style={styles.reviewEditLink}>Edit</Text>
            </Pressable>
          </View>

          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Areas in Karachi</Text>
            <Text
              style={[
                styles.reviewValue,
                !step2.selectedAreas.length && styles.reviewValueMuted,
              ]}
            >
              {step2.selectedAreas.length
                ? step2.selectedAreas.join(", ")
                : "Not selected"}
            </Text>
          </View>

          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Games & sports</Text>
            {selectedActivities.length ? (
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <View style={styles.chipRow}>
                  {selectedActivities.map((g) => (
                    <View key={g} style={styles.summaryChip}>
                      <Text style={styles.summaryChipText}>{g}</Text>
                    </View>
                  ))}
                </View>
                {sportsSummary ? (
                  <Text
                    style={[styles.reviewValue, { marginTop: 4, fontSize: 12 }]}
                  >
                    {sportsSummary}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={[styles.reviewValue, styles.reviewValueMuted]}>
                None
              </Text>
            )}
          </View>
        </View>

        {/* Platforms review */}
        <View style={styles.reviewSectionCard}>
          <View style={styles.reviewSectionHeaderRow}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <MaterialIcons
                name="sports-esports"
                size={16}
                color={COLORS.accent}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.reviewSectionTitle}>Connected platforms</Text>
            </View>
            <Pressable onPress={() => router.replace("/auth/register-step3")}>
              <Text style={styles.reviewEditLink}>Edit</Text>
            </Pressable>
          </View>

          {connectedPlatforms.length ? (
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Platforms</Text>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <View style={styles.chipRow}>
                  {connectedPlatforms.map((p) => (
                    <View key={p} style={styles.summaryChip}>
                      <Text style={styles.summaryChipText}>{p}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Platforms</Text>
              <Text style={[styles.reviewValue, styles.reviewValueMuted]}>
                No platforms connected yet
              </Text>
            </View>
          )}
        </View>

        {/* Agreements (custom checkbox UI) */}
        <View style={styles.termsWrapper}>
          <Text style={styles.termsHeading}>Agreements</Text>

          <Pressable onPress={toggleAgreeTerms} style={styles.termRow}>
            <View
              style={[
                styles.termBox,
                step4.agreeTerms && styles.termBoxChecked,
              ]}
            >
              {step4.agreeTerms && <View style={styles.termBoxInner} />}
            </View>
            <Text style={styles.termText}>
              I agree to the{" "}
              <Text style={styles.termLink}>Terms of Service</Text>.
            </Text>
          </Pressable>

          <Pressable onPress={toggleAgreePrivacy} style={styles.termRow}>
            <View
              style={[
                styles.termBox,
                step4.agreePrivacy && styles.termBoxChecked,
              ]}
            >
              {step4.agreePrivacy && <View style={styles.termBoxInner} />}
            </View>
            <Text style={styles.termText}>
              I agree to the <Text style={styles.termLink}>Privacy Policy</Text>
              .
            </Text>
          </Pressable>

          <Pressable onPress={toggleConsentMatchHistory} style={styles.termRow}>
            <View
              style={[
                styles.termBox,
                step4.consentMatchHistory && styles.termBoxChecked,
              ]}
            >
              {step4.consentMatchHistory && (
                <View style={styles.termBoxInner} />
              )}
            </View>
            <Text style={styles.termText}>
              I consent to MatchHai using my match history for matchmaking &amp;
              stats.
            </Text>
          </Pressable>

          {!allAgreementsChecked && (
            <View style={styles.helperTextRow}>
              <Text style={[styles.helperText, styles.helperWarning]}>
                Please tick all three checkboxes to continue.
              </Text>
            </View>
          )}
        </View>

        {/* Back to Step 3 (safety link) */}
        <Pressable
          onPress={() => router.replace("/auth/register-step3")}
          style={{ alignSelf: "center", marginBottom: 12 }}
        >
          <Text style={{ color: COLORS.accent }}>← Back to platforms</Text>
        </Pressable>

        {/* Final Sign Up button */}
        <View
          style={[
            styles.buttonShadowWrapper,
            allAgreementsChecked &&
              !submitting &&
              styles.buttonShadowWrapperActive,
          ]}
        >
          <Pressable
            onPress={handleFinalSignUp}
            disabled={submitting || !allAgreementsChecked}
            style={({ pressed }) => [
              styles.primaryBtn,
              (!allAgreementsChecked || submitting) &&
                styles.primaryBtnDisabled,
              pressed &&
                !submitting &&
                allAgreementsChecked && { opacity: 0.92 },
            ]}
            android_ripple={{ color: "rgba(255,255,255,0.08)" }}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Sign up & start playing</Text>
            )}
          </Pressable>
        </View>

        {/* Safety link to login */}
        <Text style={styles.bottomText}>
          Already have an account?{" "}
          <Link href="/auth/login" style={{ color: COLORS.accent }}>
            Sign in
          </Link>
        </Text>
      </ScrollView>
    </Container>
  );
}
