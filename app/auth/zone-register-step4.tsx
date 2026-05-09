import { Link, router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";

import RegistrationFieldLabel from "./components/RegistrationFieldLabel";
import RegistrationStepHeader from "./components/RegistrationStepHeader";
import { AppIcon } from "../../src/components/AppIcon";
import { AppButton } from "../../src/components/AppPrimitives";
import Screen from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import { APP_ROUTES } from "../../src/navigation/routes";
import { signUpWithEmail } from "../../src/services/authService";
import { saveZoneRegistration } from "../../src/services/convex/zoneService";
import { useZoneOnboardingStore } from "../../src/store/zoneOnboardingStore";
import { COLORS } from "../../src/theme";
import { useToast } from "../../src/hooks/useToast";
import styles from "./register.styles";
import { Modal } from "react-native";
import {
  DEFAULT_CITY,
  normalizeKarachiAreaLabel,
} from "../../constants/profileOptions";

export default function AdminRegisterStep4() {
  const { step1, branches, step4, setStep4, setCurrentStep, resetAll } = useZoneOnboardingStore();
  const { showToast } = useToast();
  const { refreshSession } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<"idle" | "submitting" | "partial-fail" | "success">("idle");
  const [currentSubStep, setCurrentSubStep] = useState(0);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  useEffect(() => {
    setCurrentStep(4);
  }, [setCurrentStep]);

  useEffect(() => {
        // Don't redirect away if we're in success flow
    if (phase === "success" || phase === "submitting") return;
    if (
      !step1.ownerFullName.trim() ||
      !step1.venueBrandName.trim() ||
      !step1.contactEmail.trim() ||
      !step1.password
    ) {
      router.replace("/auth/zone-register");
      return;
    }

    if (!branches.length) {
      router.replace("/auth/zone-register-step2");
    }
  }, [branches.length, step1,phase]);

  const allAgreementsChecked = step4.agreeTerms && step4.agreeRevenueShare;

  const branchSummaries = useMemo(
    () =>
      branches.map((branch) => {
        const items: string[] = [];

        const pcTotal =
          Number(branch.pricing.pc?.regular?.count || 0) +
          Number(branch.pricing.pc?.premium?.count || 0) +
          Number(branch.pricing.pc?.elite?.count || 0);
        if (branch.supportsCs2 && pcTotal > 0) items.push(`${pcTotal} PC setups`);

        const consoleTotal =
          Number(branch.pricing.console?.regular?.count || 0) +
          Number(branch.pricing.console?.premium?.count || 0) +
          Number(branch.pricing.console?.elite?.count || 0) +
          Number(branch.pricing.console?.ps5?.count || 0) +
          Number(branch.pricing.console?.xbox?.count || 0);
        if ((branch.supportsFc25 || branch.supportsTekken8) && consoleTotal > 0) {
          items.push(`${consoleTotal} console units`);
        }

        const sumCounts = (record?: Record<string, { count: string; price: string }>) =>
          Object.values(record || {}).reduce((sum, item) => sum + Number(item.count || 0), 0);

        // Physical sports are temporarily disabled.
        // if (branch.supportsFutsal) { ... }
        // if (branch.supportsIndoorCricket) { ... }
        // if (branch.supportsPadel) { ... }
        // if (branch.supportsPickleball) { ... }

        return {
          id: branch.id,
          branchDisplayName: branch.branchDisplayName,
          location: [normalizeKarachiAreaLabel(branch.areaLabel), DEFAULT_CITY].filter(Boolean).join(", "),
          addressLine1: branch.addressLine1,
          items,
        };
      }),
    [branches],
  );

  const handleFinish = async () => {
    if (!allAgreementsChecked) {
      showToast({
        type: "info",
        title: "Almost there",
        message:
          "Please confirm authority and revenue-share agreement before submitting the zone.",
      });
      return;
    }

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
        message: "Some required zone details are missing. Please complete the previous steps.",
      });
      router.replace("/auth/zone-register");
      return;
    }

    setSubmitting(true);
    setPhase("submitting");
    setErrorDetails(null);

    try {
      if (currentSubStep <= 0) {
        setCurrentSubStep(1);
        const resSignUp = await signUpWithEmail(
          step1.contactEmail.trim(),
          step1.password,
          step1.ownerFullName.trim(),
          undefined,
          step1.contactPhone.trim(),
          "zone",
        );

        if (!resSignUp || !resSignUp.ok) {
          throw { step: 1, message: resSignUp?.message || "Admin account creation failed." };
        }

        const sessionReady = await refreshSession();
        if (!sessionReady) {
          throw {
            step: 1,
            message: "Account created, but session was not ready yet. Please retry once.",
          };
        }
      }

      if (currentSubStep <= 1) {
        setCurrentSubStep(2);
        const resZone = await saveZoneRegistration({ step1, branches });
        if (!resZone.ok) {
          throw { step: 2, message: resZone.message || "Failed to save zone data." };
        }
      }

      setCurrentSubStep(3);
      setPhase("success");
      await refreshSession();

      setTimeout(() => {
        setStep4({
          agreeTerms: true,
          agreeRevenueShare: true,
        });
        showToast({
          type: "success",
          title: "Zone account created",
          message:
            "Your dashboard is ready. The venue stays in review until a super admin approves it.",
        });
        router.replace(APP_ROUTES.zoneHome as any);
        resetAll();
      }, 2000);
    } catch (error: any) {
      const failedAt = error.step || currentSubStep;
      setCurrentSubStep(failedAt - 1); 
      setPhase("partial-fail");
      setErrorDetails(error.message || "An unexpected error occurred.");
      setSubmitting(false);
      showToast({
        type: "error",
        title: "Submission incomplete",
        message: error.message || "Something went wrong. You can try again to finish setup.",
      });
    }
  };

  const renderLoadingOverlay = () => {
    if (phase === "idle") return null;

    const steps = [
      { id: 1, label: "Creating administrator account" },
      { id: 2, label: "Registering zone and branches" },
    ];

    return (
      <Modal
        transparent
        animationType="fade"
        visible
        statusBarTranslucent={Platform.OS === "android"}
        navigationBarTranslucent={false}
      >
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
                ? "Registering your zone..."
                : phase === "partial-fail"
                  ? "Registration interrupted"
                  : "Zone submitted"}
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
                <AppButton onPress={handleFinish} size="lg" style={[styles.primaryBtn, { width: "100%", marginBottom: 12 }]}>
                  Retry submission
                </AppButton>
                <Pressable onPress={() => { setPhase("idle"); setSubmitting(false); }} style={{ padding: 10 }}>
                  <Text style={{ color: COLORS.muted }}>Cancel</Text>
                </Pressable>
              </>
            ) : null}

            {phase === "success" ? (
              <Text style={[styles.progressText, { textAlign: "center" }]}>
                Redirecting to your zone dashboard...
              </Text>
            ) : null}
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <Screen
      scroll
      keyboardAvoiding
      style={styles.screen}
      contentStyle={styles.container}
      routeKey="/auth/zone-register-step4"
      scrollProps={{
        showsVerticalScrollIndicator: false,
        keyboardShouldPersistTaps: "handled",
      }}
    >
      <RegistrationStepHeader
        title="Review and Confirm"
        subtitle=""
        stepTitle="Step 4 of 4"
        stepSubtitle="Final review"
        progress="100%"
        onBack={() => router.replace("/auth/zone-register-step3")}
      />

      <Text style={styles.heading}>Review the zone setup</Text>
      <Text style={styles.sub}>
        This summary is what your team will manage once the zone is created and sent for moderation.
      </Text>

      <View style={styles.reviewSectionCard}>
        <View style={styles.reviewSectionHeaderRow}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <AppIcon name="storefront" size={16} color={COLORS.accent} style={{ marginRight: 6 }} />
            <Text style={styles.reviewSectionTitle}>Zone account and brand</Text>
          </View>
          <Pressable onPress={() => router.replace("/auth/zone-register")}>
            <Text style={styles.reviewEditLink}>Edit</Text>
          </Pressable>
        </View>

        <View style={styles.summaryCardList}>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Owner / primary contact</Text>
            <Text style={styles.reviewValue}>{step1.ownerFullName || "Not set"}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Venue brand</Text>
            <Text style={styles.reviewValue}>{step1.venueBrandName || "Not set"}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Contact email</Text>
            <Text style={styles.reviewValue}>{step1.contactEmail || "Not set"}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Contact phone</Text>
            <Text style={styles.reviewValue}>{step1.contactPhone || "Not set"}</Text>
          </View>
        </View>
      </View>

      <View style={styles.reviewSectionCard}>
        <View style={styles.reviewSectionHeaderRow}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <AppIcon name="map" size={16} color={COLORS.accent} style={{ marginRight: 6 }} />
            <Text style={styles.reviewSectionTitle}>Branches</Text>
          </View>
          <Pressable onPress={() => router.replace("/auth/zone-register-step2")}>
            <Text style={styles.reviewEditLink}>Edit</Text>
          </Pressable>
        </View>

        <View style={styles.summaryCardList}>
          {branchSummaries.map((branch) => (
            <View key={branch.id} style={styles.reviewCard}>
              <Text style={styles.reviewSectionTitle}>{branch.branchDisplayName}</Text>
              <Text style={styles.reviewValue}>{branch.location}</Text>
              <Text style={[styles.reviewValueMuted, { marginTop: 4 }]}>{branch.addressLine1}</Text>

              {branch.items.length ? (
                <View style={[styles.chipRow, { marginTop: 10 }]}>
                  {branch.items.map((item) => (
                    <View key={`${branch.id}-${item}`} style={styles.summaryChip}>
                      <Text style={styles.summaryChipText}>{item}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[styles.reviewValueMuted, { marginTop: 10 }]}>No inventory configured yet</Text>
              )}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.reviewSectionCard}>
        <View style={styles.reviewSectionHeaderRow}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <AppIcon name="inventory" size={16} color={COLORS.accent} style={{ marginRight: 6 }} />
            <Text style={styles.reviewSectionTitle}>Inventory and pricing</Text>
          </View>
          <Pressable onPress={() => router.replace("/auth/zone-register-step3")}>
            <Text style={styles.reviewEditLink}>Edit</Text>
          </Pressable>
        </View>
        <Text style={styles.reviewValueMuted}>
          Pricing and inventory are configured per branch and will drive availability across bookings,
          counters, and zone detail views.
        </Text>
      </View>

      <View style={styles.termsWrapper}>
        <RegistrationFieldLabel label="Agreements" required style={styles.termsHeading} />

        <Pressable onPress={() => setStep4({ agreeTerms: !step4.agreeTerms })} style={styles.termRow}>
          <View style={[styles.termBox, step4.agreeTerms && styles.termBoxChecked]}>
            {step4.agreeTerms ? <View style={styles.termBoxInner} /> : null}
          </View>
          <Text style={styles.termText}>
            I confirm that I own or am authorised to manage this zone and all listed branches.
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setStep4({ agreeRevenueShare: !step4.agreeRevenueShare })}
          style={styles.termRow}
        >
          <View style={[styles.termBox, step4.agreeRevenueShare && styles.termBoxChecked]}>
            {step4.agreeRevenueShare ? <View style={styles.termBoxInner} /> : null}
          </View>
          <Text style={styles.termText}>
            I agree to MatchHai&apos;s <Text style={styles.termLink}>zone policies and revenue model</Text>.
          </Text>
        </Pressable>

        {!allAgreementsChecked ? (
          <View style={styles.helperTextRow}>
            <Text style={[styles.helperText, styles.helperWarning]}>
              Tick both confirmations before submitting the zone.
            </Text>
          </View>
        ) : null}
      </View>

      <Pressable
        onPress={() => router.replace("/auth/zone-register-step3")}
        style={styles.backLinkWrapper}
      >
        <Text style={styles.backLinkText}>Back to branch inventory</Text>
      </Pressable>

      <View
        style={[
          styles.buttonShadowWrapper,
          allAgreementsChecked && !submitting && styles.buttonShadowWrapperActive,
        ]}
      >
        <AppButton
          onPress={handleFinish}
          disabled={submitting || !allAgreementsChecked}
          size="lg"
          style={[
            styles.primaryBtn,
            !allAgreementsChecked || submitting ? styles.primaryBtnDisabled : null,
          ]}
        >
          {submitting ? "Submitting..." : "Submit zone for review"}
        </AppButton>
      </View>

      <Text style={styles.bottomText}>
        Already manage a zone?{" "}
        <Link href="/auth/login" style={{ color: COLORS.accent }}>
          Sign in
        </Link>
      </Text>

      {renderLoadingOverlay()}
    </Screen>
  );
}
