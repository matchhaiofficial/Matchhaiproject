// app/auth/zone-register-step4.tsx
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
import { saveZoneRegistration } from "../../src/services/zoneService";
import { useZoneOnboardingStore } from "../../src/store/zoneOnboardingStore";
import { COLORS } from "../../src/theme";
import styles from "./register.styles";

export default function ZoneRegisterStep4() {
  const { step1, step2, step3, step4, setStep4, setCurrentStep, resetAll } =
    useZoneOnboardingStore();
  const { showToast } = useToast();

  const [submitting, setSubmitting] = useState(false);

  // ---- Derived helpers ----

  const gamesSummary = useMemo(() => {
    const games: string[] = [];
    if (step3.supportsCs2) games.push("CS2 (PC)");
    if (step3.supportsFc25) games.push("FC25 / FC26");
    if (step3.supportsTekken8) games.push("Tekken 8");
    if (step3.supportsFutsal) games.push("Futsal");
    if (step3.supportsIndoorCricket) games.push("Indoor Cricket");
    if (step3.supportsPadel) games.push("Padel");
    if (step3.supportsPickleball) games.push("Pickleball");
    return games;
  }, [step3]);

  const capacityLines = useMemo(() => {
    const lines: string[] = [];

    if (step3.pcSeats?.trim()) {
      lines.push(`PC setups: ${step3.pcSeats.trim()}`);
    }
    if (step3.consoleSeats?.trim()) {
      const label = step3.consolePlatform
        ? `Console pods: ${step3.consoleSeats.trim()} (${step3.consolePlatform})`
        : `Console pods: ${step3.consoleSeats.trim()}`;
      lines.push(label);
    }
    if (step3.futsalCourts?.trim()) {
      const label = step3.futsalCourtType
        ? `Futsal courts: ${step3.futsalCourts.trim()} (${step3.futsalCourtType})`
        : `Futsal courts: ${step3.futsalCourts.trim()}`;
      lines.push(label);
    }
    if (step3.indoorCricketNets?.trim()) {
      const label = step3.indoorCricketSurface
        ? `Indoor cricket nets: ${step3.indoorCricketNets.trim()} (${step3.indoorCricketSurface})`
        : `Indoor cricket nets: ${step3.indoorCricketNets.trim()}`;
      lines.push(label);
    }
    if (step3.padelCourts?.trim()) {
      const label = step3.padelCourtSurface
        ? `Padel courts: ${step3.padelCourts.trim()} (${step3.padelCourtSurface})`
        : `Padel courts: ${step3.padelCourts.trim()}`;
      lines.push(label);
    }
    if (step3.pickleballCourts?.trim()) {
      const label = step3.pickleballSurface
        ? `Pickleball courts: ${step3.pickleballCourts.trim()} (${step3.pickleballSurface})`
        : `Pickleball courts: ${step3.pickleballCourts.trim()}`;
      lines.push(label);
    }

    return lines;
  }, [step3]);

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

  // ---- Final submit: create auth user + Firestore zone ----
  const handleFinish = async () => {
    if (!allAgreementsChecked) {
      showToast({
        type: "info",
        title: "Almost there",
        message:
          "Please confirm you’re authorised and agree to the zone policies to continue.",
      });
      return;
    }

    // Safety: ensure basic fields exist – if missing, send them back.
    if (
      !step1.ownerFullName.trim() ||
      !step1.venueBrandName.trim() ||
      !step1.contactEmail.trim() ||
      !step1.password
    ) {
      showToast({
        type: "error",
        title: "Missing details",
        message:
          "Some of your zone account details are missing. Please go back and complete Step 1.",
      });
      router.replace("/auth/zone-register");
      return;
    }

    setSubmitting(true);

    try {
      // 1) Create auth user for this zone owner (same as player sign-up)
      const resSignUp = await signUpWithEmail(
        step1.contactEmail.trim(),
        step1.password,
        step1.ownerFullName.trim(),
        undefined, // no username for zone account (for now)
        step1.contactPhone.trim()
      );

      if (!resSignUp || !resSignUp.ok) {
        showToast({
          type: "error",
          title: "Zone account failed",
          message:
            resSignUp?.message ??
            "Something went wrong while creating your zone account.",
        });
        return;
      }

      // 2) Save zone + primary branch in Firestore under /zones
      const resZone = await saveZoneRegistration({ step1, step2, step3 });

      if (!resZone.ok) {
        showToast({
          type: "error",
          title: "Could not save zone",
          message: resZone.message || "Please try again in a moment.",
        });
        return;
      }

      // 3) Mark onboarding step & clear store
      setStep4({
        agreeTerms: true,
        agreeRevenueShare: true,
      });

      setCurrentStep(4);
      resetAll();

      showToast({
        type: "success",
        title: "Zone submitted",
        message:
          "Your zone and primary branch are submitted for review. We’ll get back to you soon.",
      });

      router.replace("/home");
    } catch (err) {
      console.log("[ZoneStep4] unexpected error:", err);
      showToast({
        type: "error",
        title: "Could not finish",
        message:
          "Unexpected error while finishing zone setup. Please try again.",
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
          Confirm your zone account, branch location, and games/courts before
          sending your zone for approval.
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

        {/* Primary branch & location review */}
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
                Primary branch & location
              </Text>
            </View>
            <Pressable
              onPress={() => router.replace("/auth/zone-register-step2")}
            >
              <Text style={styles.reviewEditLink}>Edit</Text>
            </Pressable>
          </View>

          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Branch name</Text>
            <Text
              style={[
                styles.reviewValue,
                !step2.branchDisplayName && styles.reviewValueMuted,
              ]}
              numberOfLines={1}
            >
              {step2.branchDisplayName || "Not set"}
            </Text>
          </View>

          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>City</Text>
            <Text
              style={[
                styles.reviewValue,
                !step2.city && styles.reviewValueMuted,
              ]}
              numberOfLines={1}
            >
              {step2.city || "Not set"}
            </Text>
          </View>

          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Area / neighbourhood</Text>
            <Text
              style={[
                styles.reviewValue,
                !step2.areaLabel && styles.reviewValueMuted,
              ]}
              numberOfLines={1}
            >
              {step2.areaLabel || "Not set"}
            </Text>
          </View>

          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Address</Text>
            <Text
              style={[
                styles.reviewValue,
                !step2.addressLine1 && styles.reviewValueMuted,
              ]}
              numberOfLines={2}
            >
              {step2.addressLine1 || "Not set"}
            </Text>
          </View>

          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Google Maps link</Text>
            <Text
              style={[
                styles.reviewValue,
                !step2.googleMapsUrl && styles.reviewValueMuted,
              ]}
              numberOfLines={1}
            >
              {step2.googleMapsUrl || "Not added"}
            </Text>
          </View>
        </View>

        {/* Games, courts & setups review */}
        <View style={styles.reviewSectionCard}>
          <View style={styles.reviewSectionHeaderRow}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <MaterialIcons
                name="sports-esports"
                size={16}
                color={COLORS.accent}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.reviewSectionTitle}>
                Games, courts & setups
              </Text>
            </View>
            <Pressable
              onPress={() => router.replace("/auth/zone-register-step3")}
            >
              <Text style={styles.reviewEditLink}>Edit</Text>
            </Pressable>
          </View>

          {/* Games / sports chips */}
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Games & sports</Text>
            {gamesSummary.length ? (
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <View style={styles.chipRow}>
                  {gamesSummary.map((g) => (
                    <View key={g} style={styles.summaryChip}>
                      <Text style={styles.summaryChipText}>{g}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <Text style={[styles.reviewValue, styles.reviewValueMuted]}>
                None selected
              </Text>
            )}
          </View>

          {/* Capacity details */}
          <View style={[styles.reviewRow, { alignItems: "flex-start" }]}>
            <Text style={styles.reviewLabel}>Setups & courts</Text>
            {capacityLines.length ? (
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                {capacityLines.map((line) => (
                  <Text
                    key={line}
                    style={[styles.reviewValue, { textAlign: "right" }]} // ✅ allow wrapping, right-aligned
                  >
                    {line}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={[styles.reviewValue, styles.reviewValueMuted]}>
                No capacity details added yet
              </Text>
            )}
          </View>

          {/* Optional notes */}
          <View style={[styles.reviewRow, { alignItems: "flex-start" }]}>
            <Text style={styles.reviewLabel}>Zone notes</Text>
            <Text
              style={[
                styles.reviewValue,
                !step3.notes && styles.reviewValueMuted,
              ]}
              numberOfLines={2}
            >
              {step3.notes || "No extra notes"}
            </Text>
          </View>
        </View>

        {/* Agreements (zone-specific) */}
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
              I confirm that I own or am authorised to manage this zone and
              branch on MatchHai.
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
              I agree to MatchHai’s{" "}
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

        {/* Back to Step 3 (safety link) */}
        <Pressable
          onPress={() => router.replace("/auth/zone-register-step3")}
          style={{ alignSelf: "center", marginBottom: 12 }}
        >
          <Text style={{ color: COLORS.accent }}>← Back to games & setups</Text>
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
  );
}