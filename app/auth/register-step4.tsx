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
import { signUpWithEmail } from "../../src/services/convex/authService";
import {
  saveOnboardingStep2,
  saveOnboardingStep3Platforms,
  completeOnboarding,
} from "../../src/services/convex/userService";
import { useOnboardingStore } from "../../src/store/onboardingStore";
import { useAuth } from "../../src/context/AuthContext";
import { COLORS } from "../../src/theme";
import styles from "./register.styles";

export default function RegisterStep4() {
  const { step1, step2, step3, step4, setStep4, resetAll } =
    useOnboardingStore();
  const { showToast } = useToast();
  const { refreshSession } = useAuth();

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

  // Keyboard handling
  const Container = KeyboardAvoidingView;
  const containerProps = {
    style: styles.screen,
    behavior: Platform.OS === "ios" ? ("padding" as const) : ("height" as const),
    keyboardVerticalOffset: Platform.OS === "ios" ? 0 : 20,
  };

  const [phase, setPhase] = useState<"idle" | "submitting" | "partial-fail" | "success">("idle");
  const [currentSubStep, setCurrentSubStep] = useState<number>(0);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [registeredUserId, setRegisteredUserId] = useState<string | null>(null);

  // ---- Final submit (with phase-based reliability) ----
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

    const { fullName, username, email, phone, password, city, ageRange } = step1;

    // Safety: if Step 1 is somehow incomplete, push them back
    if (!fullName.trim() || !username.trim() || !email.trim() || !password) {
      showToast({
        type: "error",
        title: "Missing details",
        message:
          "Some of your basic account details are missing. Please go back and complete Step 1.",
      });
      router.replace("/auth/register");
      return;
    }

    setSubmitting(true);
    setPhase("submitting");
    setErrorDetails(null);

    try {
      // PHASE 1: Auth + Basic Profile
      let userId = registeredUserId;
      if (currentSubStep <= 0) {
        setCurrentSubStep(1);
        console.log("[Step4] Phase 1: Creating account...");
        const resSignUp = await signUpWithEmail(
          email.trim(),
          password,
          fullName.trim(),
          username.trim(),
          phone.trim(),
          "player",
          city?.trim() || "Karachi",
          ageRange?.trim() || undefined
        );

        if (!resSignUp || !resSignUp.ok) {
          throw { step: 1, message: resSignUp?.message || "Auth creation failed." };
        }
        userId = resSignUp.userId as string;
        setRegisteredUserId(userId);
      }

      if (!userId) {
        throw { step: 1, message: "User ID not available. Please try again." };
      }

      // PHASE 2: Preferences (Step 2)
      if (currentSubStep <= 1) {
        setCurrentSubStep(2);
        console.log("[Step4] Phase 2: Saving preferences...");

        const playsFutsal = (step2 as any).playsFutsal ?? false;
        const playsIndoorCricket = (step2 as any).playsIndoorCricket ?? false;
        const playsPadel = (step2 as any).playsPadel ?? false;
        const playsPickleball = (step2 as any).playsPickleball ?? false;

        const futsalPositions = (((step2 as any).futsalPositions ?? []) as string[]) || [];
        const indoorCricketRole = ((step2 as any).indoorCricketRole as string) ?? null;
        const indoorCricketBowlingStyle = ((step2 as any).indoorCricketBowlingStyle as string) ?? null;
        const indoorCricketBattingStyle = ((step2 as any).indoorCricketBattingStyle as string) ?? null;
        const padelRole = ((step2 as any).padelRole as string) ?? null;
        const pickleballRole = ((step2 as any).pickleballRole as string) ?? null;

        const resStep2 = await saveOnboardingStep2(userId as any, {
          areasPreferred: step2.selectedAreas,
          playsCs2: step2.playsCs2,
          cs2Role: step2.cs2Role,
          playsFc: step2.playsFc,
          fcTeam: step2.fcTeam.trim() || null,
          fcFormation: step2.fcFormation,
          playsTekken: step2.playsTekken,
          tekkenFavorites: step2.tekkenFavorites,
          // new sports fields logic
          ...({
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
          } as any)
        });

        if (!resStep2.ok) {
          throw { step: 2, message: resStep2.message };
        }
      }

      // PHASE 3: Platforms (Step 3)
      if (currentSubStep <= 2) {
        setCurrentSubStep(3);
        console.log("[Step4] Phase 3: Connecting platforms...");
        const resStep3 = await saveOnboardingStep3Platforms(userId as any, {
          steamProfileUrl: (step3.steamProfileUrl || "").trim() || null,
          faceitProfileUrl: (step3.faceitProfileUrl || "").trim() || null,
          eaProfileUrl: (step3.eaProfileUrl || "").trim() || null,
          xboxGamertag: (step3.xboxGamertag || "").trim() || null,
          psnOnlineId: (step3.psnOnlineId || "").trim() || null,
          // summaries from Step 3
          steamProfile: step3.steamProfile,
          faceitProfile: step3.faceitProfile,
          psnProfile: step3.psnProfile,
        });

        if (!resStep3.ok) {
          throw { step: 3, message: resStep3.message };
        }
      }

      // PHASE 4: Complete onboarding
      if (currentSubStep <= 3) {
        setCurrentSubStep(4);
        console.log("[Step4] Phase 4: Completing onboarding...");
        const resComplete = await completeOnboarding(userId as any);

        if (!resComplete.ok) {
          throw { step: 4, message: resComplete.message };
        }
      }

      // SUCCESS
      setCurrentSubStep(5);
      setPhase("success");
      console.log("[Step4] Registration fully complete!");

      // Refresh the auth session before navigating
      await refreshSession();

      setTimeout(() => {
        resetAll();
        showToast({
          type: "success",
          title: "Welcome to MatchHai",
          message: "Account ready! Let's find your squad.",
        });
        router.replace("/home");
      }, 1500);

    } catch (err: any) {
      console.error("[Step4] Submission error:", err);
      // Determine how far we got
      const failedAt = err.step || currentSubStep;
      setCurrentSubStep(failedAt);
      setPhase("partial-fail");
      setErrorDetails(err.message || "An unexpected error occurred.");
      setSubmitting(false);

      showToast({
        type: "error",
        title: "Registration incomplete",
        message: err.message || "Something went wrong. You can try again to finish setup.",
      });
    }
  };

  // Rendering the loading overlay
  const renderLoadingOverlay = () => {
    if (phase === "idle") return null;

    const steps = [
      { id: 1, label: "Creating account" },
      { id: 2, label: "Saving preferences" },
      { id: 3, label: "Connecting platforms" },
      { id: 4, label: "Completing setup" },
    ];

    return (
      <View style={styles.loadingOverlay}>
        <View style={styles.loadingContent}>
          {phase !== "partial-fail" && phase !== "success" && (
            <ActivityIndicator size="large" color={COLORS.accent} style={styles.loadingSpinner} />
          )}

          {phase === "success" && (
            <MaterialIcons name="check-circle" size={64} color={COLORS.success} style={styles.loadingSpinner} />
          )}

          {phase === "partial-fail" && (
            <MaterialIcons name="error" size={64} color={COLORS.error} style={styles.loadingSpinner} />
          )}

          <Text style={styles.loadingPhaseTitle}>
            {phase === "submitting" ? "Setting up your profile..." :
              phase === "partial-fail" ? "Setup Interrupted" : "Welcome aboard!"}
          </Text>

          <View style={{ width: '100%', marginBottom: 20 }}>
            {steps.map((s, idx) => {
              const isDone = currentSubStep > s.id || (phase === 'success');
              const isActive = currentSubStep === s.id && phase === 'submitting';
              const isFailed = currentSubStep === s.id && phase === 'partial-fail';

              return (
                <View key={s.id}>
                  <View style={styles.progressStep}>
                    <View style={styles.progressIcon}>
                      {isDone ? (
                        <MaterialIcons name="check-circle" size={20} color={COLORS.success} />
                      ) : isFailed ? (
                        <MaterialIcons name="cancel" size={20} color={COLORS.error} />
                      ) : isActive ? (
                        <ActivityIndicator size="small" color={COLORS.accent} />
                      ) : (
                        <MaterialIcons name="radio-button-unchecked" size={20} color="rgba(255,255,255,0.2)" />
                      )}
                    </View>
                    <Text style={[
                      styles.progressText,
                      isActive && styles.progressTextActive,
                      isDone && styles.progressTextDone,
                      isFailed && { color: COLORS.error }
                    ]}>
                      {s.label}
                    </Text>
                  </View>
                  {idx < steps.length - 1 && <View style={styles.progressStepLine} />}
                </View>
              );
            })}
          </View>

          {phase === "partial-fail" && (
            <>
              <Text style={[styles.helperText, styles.helperError, { textAlign: 'center', marginBottom: 20 }]}>
                {errorDetails}
              </Text>
              <Pressable
                onPress={handleFinalSignUp}
                style={[styles.primaryBtn, { width: '100%', marginBottom: 12 }]}
              >
                <Text style={styles.primaryBtnText}>Retry failed steps</Text>
              </Pressable>
              <Pressable
                onPress={() => { setPhase("idle"); setSubmitting(false); }}
                style={{ padding: 10 }}
              >
                <Text style={{ color: COLORS.muted }}>Cancel</Text>
              </Pressable>
            </>
          )}

          {phase === "success" && (
            <Text style={[styles.progressText, { textAlign: 'center' }]}>
              Redirecting you to the dashboard...
            </Text>
          )}
        </View>
      </View>
    );
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
            android_ripple={{ color: "rgba(255,255,255,0.12)" }}
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

      {/* Improved Loading & Status Overlay */}
      {renderLoadingOverlay()}
    </Container>
  );
}
