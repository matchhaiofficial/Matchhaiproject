// app/auth/register-step4.tsx
import { MaterialIcons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import LogoHalo from "../../src/components/LogoHalo";
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

  console.log("[Step4] mounted", { step1, step2, step3, step4 });

  const [submitting, setSubmitting] = useState(false);

  // ---- Derived helpers ----
  const selectedGames = useMemo(() => {
    const games: string[] = [];
    if (step2.playsCs2) games.push("CS2");
    if (step2.playsFc) games.push("FC 26");
    if (step2.playsTekken) games.push("Tekken 8");
    return games;
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

  // ---- Final submit ----
  const handleFinalSignUp = async () => {
    if (!allAgreementsChecked) {
      Alert.alert(
        "Almost there",
        "Please agree to the Terms, Privacy Policy and match history usage to continue."
      );
      return;
    }

    const { fullName, username, email, phone, password } = step1;

    if (!fullName.trim() || !username.trim() || !email.trim() || !password) {
      Alert.alert(
        "Missing details",
        "Some of your basic account details are missing. Please go back and complete Step 1."
      );
      console.log("[Step4] missing step1 data → redirecting to /auth/register");
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
        Alert.alert(
          "Sign Up Failed",
          resSignUp?.message ??
            "Something went wrong while creating your account."
        );
        return;
      }

      console.log("[Step4] saving step2 in Firestore");

      // 2) Save Step 2 (location & games)
      const resStep2 = await saveOnboardingStep2({
        areasPreferred: step2.selectedAreas,
        playsCs2: step2.playsCs2,
        cs2Role: step2.cs2Role,
        playsFc: step2.playsFc,
        fcTeam: step2.fcTeam.trim() || null,
        fcFormation: step2.fcFormation,
        playsTekken: step2.playsTekken,
        tekkenFavorites: step2.tekkenFavorites,
      });

      console.log("[Step4] saveOnboardingStep2 result", resStep2);

      if (!resStep2.ok) {
        Alert.alert("Could not save preferences", resStep2.message);
        return;
      }

      console.log("[Step4] saving step3 platforms in Firestore");

      // 3) Save Step 3 (platforms)
      const resStep3 = await saveOnboardingStep3Platforms({
        steamProfileUrl: (step3.steamProfileUrl || "").trim() || null,
        faceitProfileUrl: (step3.faceitProfileUrl || "").trim() || null,
        eaProfileUrl: (step3.eaProfileUrl || "").trim() || null,
        xboxGamertag: (step3.xboxGamertag || "").trim() || null,
        psnOnlineId: (step3.psnOnlineId || "").trim() || null,
      });

      console.log("[Step4] saveOnboardingStep3Platforms result", resStep3);

      if (!resStep3.ok) {
        Alert.alert("Could not save platforms", resStep3.message);
        return;
      }

      console.log("[Step4] resetAll onboarding store");

      // 4) Clear onboarding state & go home
      resetAll();
      console.log("[Step4] redirecting to /home");
      router.replace("/home");
    } catch (err) {
      console.log("[Step4] unexpected error:", err);
      Alert.alert(
        "Sign Up Failed",
        "Unexpected error while creating your account. Please try again."
      );
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

        {/* Location & games review */}
        <View style={styles.reviewSectionCard}>
          <View style={styles.reviewSectionHeaderRow}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <MaterialIcons
                name="map"
                size={16}
                color={COLORS.accent}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.reviewSectionTitle}>Location & games</Text>
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

          <View style={[styles.reviewRow, { marginBottom: 0 }]}>
            <Text style={styles.reviewLabel}>Games selected</Text>
            {selectedGames.length ? (
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <View style={styles.chipRow}>
                  {selectedGames.map((g) => (
                    <View key={g} style={styles.summaryChip}>
                      <Text style={styles.summaryChipText}>{g}</Text>
                    </View>
                  ))}
                </View>
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
              I consent to MatchHai using my match history for matchmaking &
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
