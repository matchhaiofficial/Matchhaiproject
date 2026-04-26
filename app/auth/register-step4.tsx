import { Link, router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import RegistrationFieldLabel from "./components/RegistrationFieldLabel";
import RegistrationStepHeader from "./components/RegistrationStepHeader";
import { AppIcon } from "../../src/components/AppIcon";
import { AppButton } from "../../src/components/AppPrimitives";
import Screen from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import { useToast } from "../../src/hooks/useToast";
import { signUpWithEmail } from "../../src/services/convex/authService";
import {
  completeOnboarding,
  saveOnboardingStep2,
  saveOnboardingStep3Platforms,
} from "../../src/services/convex/userService";
import { useOnboardingStore } from "../../src/store/onboardingStore";
import { COLORS } from "../../src/theme";
import styles from "./register.styles";
import { Modal } from "react-native";

export default function RegisterStep4() {
  const { step1, step2, step3, step4, setStep4, resetAll, setCurrentStep } =
    useOnboardingStore();
  const { showToast } = useToast();
  const { refreshSession } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<"idle" | "submitting" | "partial-fail" | "success">("idle");
  const [currentSubStep, setCurrentSubStep] = useState<number>(0);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [registeredUserId, setRegisteredUserId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentStep(4);
  }, [setCurrentStep]);

  useEffect(() => {
    if (!step1.fullName.trim() || !step1.username.trim() || !step1.email.trim() || !step1.password) {
      router.replace("/auth/register");
      return;
    }
    const hasActivity =
      step2.playsCs2 ||
      (step2 as any).playsCs16 ||
      (step2 as any).playsValorant ||
      step2.playsFc ||
      step2.playsTekken ||
      (step2 as any).playsFutsal ||
      (step2 as any).playsIndoorCricket ||
      (step2 as any).playsPadel ||
      (step2 as any).playsPickleball;
    if (!step2.selectedAreas.length || !hasActivity) {
      router.replace("/auth/register-step2");
    }
  }, [step1, step2]);

  const { selectedActivities, sportsSummary } = useMemo(() => {
    const items: string[] = [];
    if (step2.playsCs2) items.push("CS2");
    if ((step2 as any).playsCs16) items.push("CS 1.6");
    if ((step2 as any).playsValorant) items.push("Valorant");
    if (step2.playsFc) items.push("FC26");
    if (step2.playsTekken) items.push("Tekken 8");
    if ((step2 as any).playsFutsal) items.push("Futsal");
    if ((step2 as any).playsIndoorCricket) items.push("Indoor Cricket");
    if ((step2 as any).playsPadel) items.push("Padel");
    if ((step2 as any).playsPickleball) items.push("Pickleball");

    const details: string[] = [];
    const futsalPositions = (((step2 as any).futsalPositions ?? []) as string[]) || [];
    const indoorCricketRole = ((step2 as any).indoorCricketRole as string) ?? null;
    const indoorCricketBowlingStyle =
      ((step2 as any).indoorCricketBowlingStyle as string) ?? null;
    const indoorCricketBattingStyle =
      ((step2 as any).indoorCricketBattingStyle as string) ?? null;
    const padelRole = ((step2 as any).padelRole as string) ?? null;
    const pickleballRole = ((step2 as any).pickleballRole as string) ?? null;

    if (futsalPositions.length) details.push(`Futsal: ${futsalPositions.join(" / ")}`);
    if (indoorCricketRole) {
      let roleLabel = indoorCricketRole;
      if (indoorCricketRole === "Bowler" && indoorCricketBowlingStyle) {
        roleLabel += ` (${indoorCricketBowlingStyle})`;
      } else if (indoorCricketRole === "Batsman" && indoorCricketBattingStyle) {
        roleLabel += ` (${indoorCricketBattingStyle})`;
      }
      details.push(`Indoor Cricket: ${roleLabel}`);
    }
    if (padelRole) details.push(`Padel: ${padelRole}`);
    if (pickleballRole) details.push(`Pickleball: ${pickleballRole}`);

    return {
      selectedActivities: items,
      sportsSummary: details.join(" | "),
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

  const hasAnyStep3Data = useMemo(
    () =>
      Boolean(
        step3.steamProfileUrl?.trim() ||
        step3.faceitProfileUrl?.trim() ||
        step3.eaProfileUrl?.trim() ||
        step3.xboxGamertag?.trim() ||
        step3.psnOnlineId?.trim() ||
        step3.steamProfile ||
        step3.faceitProfile ||
        step3.psnProfile,
      ),
    [step3],
  );

  const allAgreementsChecked =
    step4.agreeTerms && step4.agreePrivacy && step4.consentMatchHistory;

  const handleFinalSignUp = async () => {
    if (!allAgreementsChecked) {
      showToast({
        type: "info",
        title: "Almost there",
        message: "Please accept all required agreements before creating your account.",
      });
      return;
    }

    const { fullName, username, email, phone, password, city, ageRange } = step1;
    if (!fullName.trim() || !username.trim() || !email.trim() || !password) {
      showToast({
        type: "error",
        title: "Missing details",
        message: "Some of your account details are missing. Please complete Step 1 again.",
      });
      router.replace("/auth/register");
      return;
    }

    setSubmitting(true);
    setPhase("submitting");
    setErrorDetails(null);

    try {
      let userId = registeredUserId;
      if (currentSubStep <= 0) {
        setCurrentSubStep(1);
        const signUpResult = await signUpWithEmail(
          email.trim(),
          password,
          fullName.trim(),
          username.trim(),
          phone.trim(),
          "player",
          city?.trim() || "Karachi",
          ageRange?.trim() || undefined,
        );
        if (!signUpResult || !signUpResult.ok) {
          throw { step: 1, message: signUpResult?.message || "Auth creation failed." };
        }
        userId = signUpResult.userId as string;
        setRegisteredUserId(userId);
      }

      if (!userId) {
        throw { step: 1, message: "User ID not available. Please try again." };
      }

      if (currentSubStep <= 1) {
        setCurrentSubStep(2);
        const saveStep2Result = await saveOnboardingStep2(userId as any, {
          areasPreferred: step2.selectedAreas,
          playsCs2: step2.playsCs2,
          cs2Role: step2.cs2Role,
          playsCs16: (step2 as any).playsCs16 ?? false,
          cs16Role: (step2 as any).cs16Role ?? null,
          playsValorant: (step2 as any).playsValorant ?? false,
          valorantRole: (step2 as any).valorantRole ?? null,
          playsFc: step2.playsFc,
          fcTeam: step2.fcTeam.trim() || null,
          fcFormation: step2.fcFormation,
          playsTekken: step2.playsTekken,
          tekkenFavorites: step2.tekkenFavorites,
          playsFutsal: (step2 as any).playsFutsal ?? false,
          playsIndoorCricket: (step2 as any).playsIndoorCricket ?? false,
          playsPadel: (step2 as any).playsPadel ?? false,
          playsPickleball: (step2 as any).playsPickleball ?? false,
          futsalPositions: (((step2 as any).futsalPositions ?? []) as string[]) || [],
          indoorCricketRole: ((step2 as any).indoorCricketRole as string) ?? null,
          indoorCricketBowlingStyle:
            ((step2 as any).indoorCricketBowlingStyle as string) ?? null,
          indoorCricketBattingStyle:
            ((step2 as any).indoorCricketBattingStyle as string) ?? null,
          padelRole: ((step2 as any).padelRole as string) ?? null,
          pickleballRole: ((step2 as any).pickleballRole as string) ?? null,
        } as any);
        if (!saveStep2Result.ok) {
          throw { step: 2, message: saveStep2Result.message };
        }
      }

      if (currentSubStep <= 2 && hasAnyStep3Data) {
        setCurrentSubStep(3);
        const saveStep3Result = await saveOnboardingStep3Platforms(userId as any, {
          steamProfileUrl: (step3.steamProfileUrl || "").trim() || null,
          faceitProfileUrl: (step3.faceitProfileUrl || "").trim() || null,
          eaProfileUrl: (step3.eaProfileUrl || "").trim() || null,
          xboxGamertag: (step3.xboxGamertag || "").trim() || null,
          psnOnlineId: (step3.psnOnlineId || "").trim() || null,
          steamProfile: step3.steamProfile,
          faceitProfile: step3.faceitProfile,
          psnProfile: step3.psnProfile,
        });
        if (!saveStep3Result.ok) {
          throw { step: 3, message: saveStep3Result.message };
        }
      }

      if (currentSubStep <= 3) {
        setCurrentSubStep(4);
        const completeResult = await completeOnboarding(userId as any);
        if (!completeResult.ok) {
          throw { step: 4, message: completeResult.message };
        }
      }

      setCurrentSubStep(5);
      setPhase("success");
      await refreshSession();

      setTimeout(() => {
        resetAll();
        showToast({
          type: "success",
          title: "Welcome to MatchHai",
          message: "Account created. Verify your email to unlock matchrooms and team actions.",
        });
        router.replace("/auth/verification-required" as any);
      }, 1500);
    } catch (error: any) {
      const failedAt = error.step || currentSubStep;
      setCurrentSubStep(failedAt);
      setPhase("partial-fail");
      setErrorDetails(error.message || "An unexpected error occurred.");
      setSubmitting(false);
      showToast({
        type: "error",
        title: "Registration incomplete",
        message: error.message || "Something went wrong. You can retry from here.",
      });
    }
  };

  const renderLoadingOverlay = () => {
    if (phase === "idle") return null;

    const steps = [
      { id: 1, label: "Creating account" },
      { id: 2, label: "Saving preferences" },
      { id: 3, label: "Saving account links" },
      { id: 4, label: "Completing setup" },
    ];

    return (
      <Modal transparent animationType="fade" visible statusBarTranslucent>
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            {phase !== "partial-fail" && phase !== "success" ? (
              <ActivityIndicator size="large" color={COLORS.accent} style={styles.loadingSpinner} />
            ) : null}
            {phase === "success" ? (
              <AppIcon name="check-circle" size={64} color={COLORS.success} style={styles.loadingSpinner} />
            ) : null}
            {phase === "partial-fail" ? (
              <AppIcon name="error" size={64} color={COLORS.error} style={styles.loadingSpinner} />
            ) : null}

            <Text style={styles.loadingPhaseTitle}>
              {phase === "submitting"
                ? "Setting up your profile..."
                : phase === "partial-fail"
                  ? "Setup interrupted"
                  : "Welcome aboard"}
            </Text>

            <View style={{ width: "100%", marginBottom: 20 }}>
              {steps.map((step, index) => {
                const isDone = currentSubStep > step.id || phase === "success";
                const isActive = currentSubStep === step.id && phase === "submitting";
                const isFailed = currentSubStep === step.id && phase === "partial-fail";

                return (
                  <View key={step.id}>
                    <View style={styles.progressStep}>
                      <View style={styles.progressIcon}>
                        {isDone ? (
                          <AppIcon name="check-circle" size={20} color={COLORS.success} />
                        ) : isFailed ? (
                          <AppIcon name="cancel" size={20} color={COLORS.error} />
                        ) : isActive ? (
                          <ActivityIndicator size="small" color={COLORS.accent} />
                        ) : (
                          <AppIcon
                            name="radio-button-unchecked"
                            size={20}
                            color="rgba(255,255,255,0.2)"
                          />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.progressText,
                          isActive && styles.progressTextActive,
                          isDone && styles.progressTextDone,
                          isFailed && { color: COLORS.error },
                        ]}
                      >
                        {step.label}
                      </Text>
                    </View>
                    {index < steps.length - 1 ? <View style={styles.progressStepLine} /> : null}
                  </View>
                );
              })}
            </View>

            {phase === "partial-fail" ? (
              <>
                <Text
                  style={[
                    styles.helperText,
                    styles.helperError,
                    { textAlign: "center", marginBottom: 20 },
                  ]}
                >
                  {errorDetails}
                </Text>
                <AppButton onPress={handleFinalSignUp} size="lg" style={[styles.primaryBtn, { width: "100%", marginBottom: 12 }]}>
                  Retry failed steps
                </AppButton>
                <Pressable onPress={() => { setPhase("idle"); setSubmitting(false); }} style={{ padding: 10 }}>
                  <Text style={{ color: COLORS.muted }}>Cancel</Text>
                </Pressable>
              </>
            ) : null}

            {phase === "success" ? (
              <Text style={[styles.progressText, { textAlign: "center" }]}>
                Redirecting you to the next screen...
              </Text>
            ) : null}
          </View>
        </View>
      </Modal>
    );
  };

  const sectionHeader = (icon: string, title: string, route: string) => (
    <View style={styles.reviewSectionHeaderRow}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <AppIcon name={icon as any} size={16} color={COLORS.accent} style={{ marginRight: 6 }} />
        <Text style={styles.reviewSectionTitle}>{title}</Text>
      </View>
      <Pressable onPress={() => router.replace(route as any)}>
        <Text style={styles.reviewEditLink}>Edit</Text>
      </Pressable>
    </View>
  );

  return (
    <Screen
      scroll
      keyboardAvoiding
      style={styles.screen}
      contentStyle={styles.container}
      routeKey="/auth/register-step4"
      scrollProps={{
        showsVerticalScrollIndicator: false,
        keyboardShouldPersistTaps: "handled",
      }}
    >
      <RegistrationStepHeader
        title="Review and Confirm"
        subtitle="Check the essentials before creating your player profile."
        stepTitle="Step 4 of 4"
        stepSubtitle="Final review"
        progress="100%"
        onBack={() => router.replace("/auth/register-step3")}
      />

      <Text style={styles.heading}>One last check</Text>
      <Text style={styles.sub}>
        Review your account details, preferences, and optional links before you submit.
      </Text>

      <View style={styles.reviewSectionCard}>
        {sectionHeader("person", "Account details", "/auth/register")}
        <View style={styles.summaryCardList}>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Full name</Text>
            <Text style={[styles.reviewValue, !step1.fullName && styles.reviewValueMuted]}>
              {step1.fullName || "Not set"}
            </Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Username</Text>
            <Text style={[styles.reviewValue, !step1.username && styles.reviewValueMuted]}>
              {step1.username || "Not set"}
            </Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Email</Text>
            <Text style={[styles.reviewValue, !step1.email && styles.reviewValueMuted]}>
              {step1.email || "Not set"}
            </Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Phone</Text>
            <Text style={[styles.reviewValue, !step1.phone && styles.reviewValueMuted]}>
              {step1.phone || "Not set"}
            </Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>City and age range</Text>
            <Text style={styles.reviewValue}>
              {[step1.city || "Karachi", step1.ageRange || "Not set"].join(" | ")}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.reviewSectionCard}>
        {sectionHeader("map", "Location and interests", "/auth/register-step2")}
        <View style={styles.summaryCardList}>
          <View>
            <Text style={styles.reviewLabel}>Areas in Karachi</Text>
            <Text style={[styles.reviewValue, !step2.selectedAreas.length && styles.reviewValueMuted]}>
              {step2.selectedAreas.length ? step2.selectedAreas.join(", ") : "Not selected"}
            </Text>
          </View>
          <View>
            <Text style={styles.reviewLabel}>Games and sports</Text>
            {selectedActivities.length ? (
              <View style={styles.chipRow}>
                {selectedActivities.map((item) => (
                  <View key={item} style={styles.summaryChip}>
                    <Text style={styles.summaryChipText}>{item}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.reviewValue, styles.reviewValueMuted]}>None</Text>
            )}
          </View>
          {sportsSummary ? (
            <View>
              <Text style={styles.reviewLabel}>Role details</Text>
              <Text style={styles.reviewValue}>{sportsSummary}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.reviewSectionCard}>
        {sectionHeader("sports-esports", "Connected platforms", "/auth/register-step3")}
        {connectedPlatforms.length ? (
          <View style={styles.summaryCardList}>
            <View style={styles.chipRow}>
              {connectedPlatforms.map((platform) => (
                <View key={platform} style={styles.summaryChip}>
                  <Text style={styles.summaryChipText}>{platform}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.reviewValue}>
              Connected platforms stay editable after signup from your Profile screen.
            </Text>
          </View>
        ) : (
          <Text style={[styles.reviewValue, styles.reviewValueMuted]}>
            No platforms connected yet. You can add them later from Profile.
          </Text>
        )}
      </View>

      <View style={styles.termsWrapper}>
        <RegistrationFieldLabel label="Agreements" required style={styles.termsHeading} />

        <Pressable onPress={() => setStep4({ agreeTerms: !step4.agreeTerms })} style={styles.termRow}>
          <View style={[styles.termBox, step4.agreeTerms && styles.termBoxChecked]}>
            {step4.agreeTerms ? <View style={styles.termBoxInner} /> : null}
          </View>
          <Text style={styles.termText}>
            I agree to the <Text style={styles.termLink}>Terms of Service</Text>.
          </Text>
        </Pressable>

        <Pressable onPress={() => setStep4({ agreePrivacy: !step4.agreePrivacy })} style={styles.termRow}>
          <View style={[styles.termBox, step4.agreePrivacy && styles.termBoxChecked]}>
            {step4.agreePrivacy ? <View style={styles.termBoxInner} /> : null}
          </View>
          <Text style={styles.termText}>
            I agree to the <Text style={styles.termLink}>Privacy Policy</Text>.
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setStep4({ consentMatchHistory: !step4.consentMatchHistory })}
          style={styles.termRow}
        >
          <View style={[styles.termBox, step4.consentMatchHistory && styles.termBoxChecked]}>
            {step4.consentMatchHistory ? <View style={styles.termBoxInner} /> : null}
          </View>
          <Text style={styles.termText}>
            I consent to MatchHai using my match history for matchmaking and stats.
          </Text>
        </Pressable>

        {!allAgreementsChecked ? (
          <View style={styles.helperTextRow}>
            <Text style={[styles.helperText, styles.helperWarning]}>
              Please tick all three checkboxes to continue.
            </Text>
          </View>
        ) : null}
      </View>

      <Pressable onPress={() => router.replace("/auth/register-step3")} style={styles.backLinkWrapper}>
        <Text style={styles.backLinkText}>Back to optional account links</Text>
      </Pressable>

      <View style={[styles.buttonShadowWrapper, allAgreementsChecked && !submitting && styles.buttonShadowWrapperActive]}>
        <AppButton
          onPress={handleFinalSignUp}
          disabled={submitting || !allAgreementsChecked}
          size="lg"
          style={[
            styles.primaryBtn,
            !allAgreementsChecked || submitting ? styles.primaryBtnDisabled : null,
          ]}
        >
          {submitting ? "Submitting..." : "Sign up and continue"}
        </AppButton>
      </View>

      <Text style={styles.bottomText}>
        Already have an account?{" "}
        <Link href="/auth/login" style={{ color: COLORS.accent }}>
          Sign in
        </Link>
      </Text>

      {renderLoadingOverlay()}
    </Screen>
  );
}
