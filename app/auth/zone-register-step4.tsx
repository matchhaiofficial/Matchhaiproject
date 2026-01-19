// app/auth/zone-register-step4.tsx
import { MaterialIcons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import React, { useState } from "react";
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
import { saveZoneRegistration } from "../../src/services/zoneService";
import { useZoneOnboardingStore } from "../../src/store/zoneOnboardingStore";
import { COLORS } from "../../src/theme";
import styles from "./register.styles";

export default function AdminRegisterStep4() {
  const { step1, branches, step4, setStep4, setCurrentStep, resetAll } =
    useZoneOnboardingStore();
  const { showToast } = useToast();

  const [submitting, setSubmitting] = useState(false);

  // ---- Derived helpers ----
  const allAgreementsChecked = step4.agreeTerms && step4.agreeRevenueShare;

  const toggleAgreeTerms = () => setStep4({ agreeTerms: !step4.agreeTerms });
  const toggleAgreeRevenueShare = () =>
    setStep4({ agreeRevenueShare: !step4.agreeRevenueShare });

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

  const [phase, setPhase] = useState<"idle" | "submitting" | "partial-fail" | "success">("idle");
  const [currentSubStep, setCurrentSubStep] = useState<number>(0);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  // ---- Final submit: create auth user + Firestore zone ----
  const handleFinish = async () => {
    if (!allAgreementsChecked) {
      showToast({
        type: "info",
        title: "Almost there",
        message:
          "Please confirm you're authorised and agree to the zone policies to continue.",
      });
      return;
    }

    // Safety: ensure basic fields exist
    if (
      !step1.ownerFullName.trim() ||
      !step1.venueBrandName.trim() ||
      !step1.contactEmail.trim() ||
      !step1.password ||
      branches.length === 0
    ) {
      showToast({
        type: "error",
        title: "Missing details",
        message:
          "Some of your zone account details are missing. Please go back and complete all steps.",
      });
      router.replace("/auth/zone-register");
      return;
    }

    setSubmitting(true);
    setPhase("submitting");
    setErrorDetails(null);

    try {
      // PHASE 1: Auth + Basic Profile
      if (currentSubStep <= 0) {
        setCurrentSubStep(1);
        console.log("[ZoneStep4] Phase 1: Creating administrator account...");
        const resSignUp = await signUpWithEmail(
          step1.contactEmail.trim(),
          step1.password,
          step1.ownerFullName.trim(),
          undefined,
          step1.contactPhone.trim(),
          'zone'
        );

        if (!resSignUp || !resSignUp.ok) {
          throw { step: 1, message: resSignUp?.message || "Admin account creation failed." };
        }
      }

      // PHASE 2: Zone + Branches Firestore Save
      if (currentSubStep <= 1) {
        setCurrentSubStep(2);
        console.log("[ZoneStep4] Phase 2: Saving zone information...");
        const resZone = await saveZoneRegistration({ step1, branches });

        if (!resZone.ok) {
          throw { step: 2, message: resZone.message || "Failed to save zone data." };
        }
      }

      // SUCCESS
      setCurrentSubStep(3);
      setPhase("success");
      console.log("[ZoneStep4] Zone registration complete!");

      setTimeout(() => {
        setStep4({
          agreeTerms: true,
          agreeRevenueShare: true,
        });
        setCurrentStep(4);
        resetAll();

        showToast({
          type: "success",
          title: "Zone submitted",
          message: "Wait for approval. We'll get back to you soon.",
        });
        router.replace("/zone");
      }, 2000);

    } catch (err: any) {
      console.error("[ZoneStep4] Submission error:", err);
      const failedAt = err.step || currentSubStep;
      setCurrentSubStep(failedAt);
      setPhase("partial-fail");
      setErrorDetails(err.message || "An unexpected error occurred.");
      setSubmitting(false);

      showToast({
        type: "error",
        title: "Submission incomplete",
        message: err.message || "Something went wrong. You can try again to finish setup.",
      });
    }
  };

  const renderLoadingOverlay = () => {
    if (phase === "idle") return null;

    const steps = [
      { id: 1, label: "Creating administrator account" },
      { id: 2, label: "Registering zone & branches" },
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
            {phase === "submitting" ? "Registering your zone..." :
              phase === "partial-fail" ? "Registration Interrupted" : "Zone Submitted!"}
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
                onPress={handleFinish}
                style={[styles.primaryBtn, { width: '100%', marginBottom: 12 }]}
              >
                <Text style={styles.primaryBtnText}>Retry submission</Text>
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
              Waiting for approval...
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <>
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
                  Step 4 of 4 · Check your zone details before submitting
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
            Confirm your zone account and branches before sending your zone for approval.
          </Text>

          {/* Zone account & brand review */}
          <View style={styles.reviewSectionCard}>
            <View style={styles.reviewSectionHeaderRow}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <MaterialIcons
                  name="storefront"
                  size={16}
                  color={COLORS.accent}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.reviewSectionTitle}>
                  Zone account & brand
                </Text>
              </View>
              <Pressable onPress={() => router.replace("/auth/zone-register")}>
                <Text style={styles.reviewEditLink}>Edit</Text>
              </Pressable>
            </View>

            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Owner / main contact</Text>
              <Text
                style={[
                  styles.reviewValue,
                  !step1.ownerFullName && styles.reviewValueMuted,
                ]}
                numberOfLines={1}
              >
                {step1.ownerFullName || "Not set"}
              </Text>
            </View>

            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Venue brand</Text>
              <Text
                style={[
                  styles.reviewValue,
                  !step1.venueBrandName && styles.reviewValueMuted,
                ]}
                numberOfLines={1}
              >
                {step1.venueBrandName || "Not set"}
              </Text>
            </View>

            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Business Type</Text>
              <Text style={styles.reviewValue}>
                {step1.type === 'gaming' ? 'Zone (Gaming)' : step1.type === 'sports' ? 'Court (Sports)' : 'Both (Hybrid)'}
              </Text>
            </View>

            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Contact email</Text>
              <Text
                style={[
                  styles.reviewValue,
                  !step1.contactEmail && styles.reviewValueMuted,
                ]}
                numberOfLines={1}
              >
                {step1.contactEmail || "Not set"}
              </Text>
            </View>

            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Contact phone</Text>
              <Text
                style={[
                  styles.reviewValue,
                  !step1.contactPhone && styles.reviewValueMuted,
                ]}
                numberOfLines={1}
              >
                {step1.contactPhone || "Not set"}
              </Text>
            </View>
          </View>

          {/* Branches Review */}
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
                  Branches ({branches.length})
                </Text>
              </View>
              <Pressable
                onPress={() => router.replace("/auth/zone-register-step2")}
              >
                <Text style={styles.reviewEditLink}>Edit</Text>
              </Pressable>
            </View>

            {branches.map((branch, index) => (
              <View key={branch.id} style={{ marginTop: index > 0 ? 16 : 0, paddingTop: index > 0 ? 16 : 0, borderTopWidth: index > 0 ? 1 : 0, borderTopColor: '#333' }}>
                <Text style={{ color: COLORS.accent, fontWeight: 'bold', marginBottom: 8 }}>
                  {branch.branchDisplayName}
                </Text>
                <Text style={{ color: COLORS.muted, fontSize: 12 }}>
                  {branch.addressLine1}, {branch.areaLabel}, {branch.city}
                </Text>

                {/* Inventory Summary */}
                <View style={{ marginTop: 8 }}>
                  {branch.supportsCs2 && (
                    <Text style={{ color: COLORS.text, fontSize: 12 }}>
                      • PC Setups: {[
                        branch.pricing.pc?.regular?.count ? `Regular (${branch.pricing.pc.regular.count})` : null,
                        branch.pricing.pc?.premium?.count ? `Premium (${branch.pricing.pc.premium.count})` : null,
                        branch.pricing.pc?.elite?.count ? `Elite (${branch.pricing.pc.elite.count})` : null,
                      ].filter(Boolean).join(', ') || 'N/A'}
                    </Text>
                  )}
                  {branch.supportsFc25 && branch.pricing.console?.ps5 && (
                    <Text style={{ color: COLORS.text, fontSize: 12 }}>
                      • PS5 Consoles: {branch.pricing.console.ps5.count}
                    </Text>
                  )}
                  {branch.supportsFutsal && (
                    <Text style={{ color: COLORS.text, fontSize: 12 }}>
                      • Futsal Courts: {Object.values(branch.pricing.futsal || {}).reduce((sum: number, v: any) => sum + parseInt(v.count || '0'), 0)}
                    </Text>
                  )}
                  {branch.supportsIndoorCricket && (
                    <Text style={{ color: COLORS.text, fontSize: 12 }}>
                      • Cricket Nets: {Object.values(branch.pricing.indoor_cricket || {}).reduce((sum: number, v: any) => sum + parseInt(v.count || '0'), 0)}
                    </Text>
                  )}
                  {branch.supportsPadel && (
                    <Text style={{ color: COLORS.text, fontSize: 12 }}>
                      • Padel Courts: {Object.values(branch.pricing.padel || {}).reduce((sum: number, v: any) => sum + parseInt(v.count || '0'), 0)}
                    </Text>
                  )}
                  {branch.supportsPickleball && (
                    <Text style={{ color: COLORS.text, fontSize: 12 }}>
                      • Pickleball Courts: {Object.values(branch.pricing.pickleball || {}).reduce((sum: number, v: any) => sum + parseInt(v.count || '0'), 0)}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>

          {/* Agreements */}
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
                I confirm that I own or am authorised to manage this zone and all branches on MatchHai.
              </Text>
            </Pressable>

            <Pressable onPress={toggleAgreeRevenueShare} style={styles.termRow}>
              <View
                style={[
                  styles.termBox,
                  step4.agreeRevenueShare && styles.termBoxChecked,
                ]}
              >
                {step4.agreeRevenueShare && <View style={styles.termBoxInner} />}
              </View>
              <Text style={styles.termText}>
                I agree to MatchHai's{" "}
                <Text style={styles.termLink}>zone policies & revenue model</Text>
                . (You can set payout method later.)
              </Text>
            </Pressable>

            {!allAgreementsChecked && (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperWarning]}>
                  Please tick both checkboxes to continue.
                </Text>
              </View>
            )}
          </View>

          {/* Back to Step 3 */}
          <Pressable
            onPress={() => router.replace("/auth/zone-register-step3")}
            style={{ alignSelf: "center", marginBottom: 12 }}
          >
            <Text style={{ color: COLORS.accent }}>← Back to branch inventory</Text>
          </Pressable>

          {/* Final Submit button */}
          <View
            style={[
              styles.buttonShadowWrapper,
              allAgreementsChecked &&
              !submitting &&
              styles.buttonShadowWrapperActive,
            ]}
          >
            <Pressable
              onPress={handleFinish}
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
                <Text style={styles.primaryBtnText}>Submit zone for review</Text>
              )}
            </Pressable>
          </View>

          {/* Safety link to login */}
          <Text style={styles.bottomText}>
            Already manage a zone?{" "}
            <Link href="/auth/login" style={{ color: COLORS.accent }}>
              Sign in
            </Link>
          </Text>
        </ScrollView>
      </Container>
      {renderLoadingOverlay()}
    </>
  );
}
