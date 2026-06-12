import { useAction, useQuery } from "convex/react";
import { Link, router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { api } from "../../convex/_generated/api";
import LogoHalo from "../../src/components/LogoHalo";
import { AppButton, AppCard } from "../../src/components/AppPrimitives";
import { useAuth } from "../../src/context/AuthContext";
import { useToast } from "../../src/hooks/useToast";
import { useStartDiditKyc } from "../../src/hooks/useDiditKyc";
import { COLORS } from "../../src/theme";
import { KYC_VERIFICATION_REQUIRED_MESSAGE, isKycReviewActive } from "../../src/utils/verificationGate";
import styles from "./login.styles";

function formatKycReason(reason?: string | null) {
  const value = String(reason || "").trim();
  if (!value) return null;
  if (value === "LOW_FACE_MATCH_SIMILARITY") {
    return "Face match did not pass. Please retry with the same person as the CNIC photo, good lighting, and no glare.";
  }
  if (value === "QR_VALIDATION_FAILED") {
    return "Document validation needs another attempt. Please retake clear front/back CNIC photos.";
  }
  return value.replace(/_/g, " ").toLowerCase();
}

const ACCOUNT_EMAIL_REQUIRED_MESSAGE =
  "Your account email is missing or invalid. Please update your account email before starting verification.";

function isValidAccountEmail(value?: string | null) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim().toLowerCase());
}

export default function VerificationRequiredScreen() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [starting, setStarting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startDiditKyc = useStartDiditKyc();
  const currentKyc = useQuery(api.kyc.getCurrentUserKyc);
  const refreshDiditStatus = useAction(api.kyc.refreshDiditVerificationStatus);
  const kycStatus = currentKyc?.status || user?.kycVerificationStatus || "not_started";
  const isRejected = kycStatus === "rejected";
  const isVerified = kycStatus === "verified";
  const reviewActive = isKycReviewActive(kycStatus);
  const hasKycAttempt = Boolean(currentKyc?._id);
  const startActionLabel =
    isRejected
      ? "Retry Verification"
      : hasKycAttempt && (kycStatus === "not_started" || kycStatus === "expired")
        ? "Try Again"
        : "Start Verification";
  const accountEmail = String(user?.email || "").trim().toLowerCase();
  const accountEmailValid = isValidAccountEmail(accountEmail);
  const dashboardRoute = user?.accountType === "zone" ? "/zone/(tabs)" : "/(player)/(tabs)";
  const safeReason = useMemo(
    () => formatKycReason(currentKyc?.rejectionReason),
    [currentKyc?.rejectionReason],
  );

  const openProfileEmailSettings = useCallback(() => {
    if (user?.accountType === "zone") {
      router.push("/zone/profile/edit" as any);
      return;
    }
    router.push("/(player)/profile/edit" as any);
  }, [user?.accountType]);

  const refreshVerificationState = useCallback(async () => {
    setRefreshing(true);
    try {
      const shouldRefreshProvider =
        currentKyc?._id &&
        currentKyc.providerSessionId &&
        currentKyc.status !== "verified" &&
        currentKyc.status !== "rejected" &&
        currentKyc.status !== "expired";
      if (shouldRefreshProvider) {
        await refreshDiditStatus({ verificationId: currentKyc._id });
      }
      await refreshUser();
    } finally {
      setRefreshing(false);
    }
  }, [currentKyc?._id, currentKyc?.providerSessionId, refreshDiditStatus, refreshUser]);

  useFocusEffect(
    useCallback(() => {
      void refreshVerificationState();
    }, [refreshVerificationState]),
  );

  const handleStart = async () => {
    if (!accountEmailValid) {
      showToast({
        type: "error",
        title: "Account email required",
        message: ACCOUNT_EMAIL_REQUIRED_MESSAGE,
      });
      openProfileEmailSettings();
      return;
    }
    setStarting(true);
    const role = user?.accountType === "zone" ? "zone_owner" : "player";
    const result = await startDiditKyc(role);
    setStarting(false);
    showToast({
      type: result.ok ? "info" : "error",
      title: result.ok ? "Verification opened" : "Could not start verification",
      message: result.ok ? "Complete CNIC & face verification to unlock MatchHai features." : result.message,
    });
  };

  const handleRefresh = async () => {
    try {
      await refreshVerificationState();
    } catch {}
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <LogoHalo />
        <Text style={styles.heading}>
          {isVerified ? "Identity verified" : isRejected ? "Verification declined" : "Verify your identity"}
        </Text>
        <Text style={styles.sub}>
          {isVerified
            ? "Your MatchHai account is unlocked."
            : isRejected
              ? "Didit could not verify this attempt. Your account remains locked until a successful verification."
              : KYC_VERIFICATION_REQUIRED_MESSAGE}
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Account email used for verification</Text>
          <AppCard style={styles.inputBox}>
            <Text style={[styles.input, { color: COLORS.text }]}>
              {accountEmail || "No account email on file"}
            </Text>
          </AppCard>
          <View style={styles.helperTextRow}>
            <Text style={[styles.helperText, accountEmailValid ? { color: COLORS.muted } : styles.helperWarning]}>
              {accountEmailValid
                ? "This email comes from your MatchHai account and cannot be changed during KYC."
                : ACCOUNT_EMAIL_REQUIRED_MESSAGE}
            </Text>
          </View>
        </View>

        <View style={styles.helperTextRow}>
          <Text style={[styles.helperText, styles.helperWarning]}>
            {safeReason ||
              (isVerified
                ? "You can continue to MatchHai features."
                : "Complete CNIC & face verification to unlock matchrooms, teams, challenges, and payments.")}
          </Text>
        </View>

        {!isVerified && !reviewActive ? (
          <View style={styles.buttonShadowWrapper}>
            <AppButton onPress={handleStart} disabled={starting || !accountEmailValid} loading={starting}>
              {startActionLabel}
            </AppButton>
          </View>
        ) : null}

        {!accountEmailValid ? (
          <View style={styles.buttonShadowWrapper}>
            <AppButton variant="secondary" onPress={openProfileEmailSettings}>
              Update account email
            </AppButton>
          </View>
        ) : null}

        {reviewActive ? (
          <View style={styles.buttonShadowWrapper}>
            <AppButton variant="secondary" onPress={handleRefresh} disabled={refreshing} loading={refreshing}>
              Refresh status
            </AppButton>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", justifyContent: "center" }}>
          <Text style={styles.bottomText}>Need help? </Text>
          <Link href="/auth/login" style={{ color: COLORS.accent }}>
            Back to login
          </Link>
        </View>

        <Pressable onPress={() => router.replace(dashboardRoute as any)} style={{ marginTop: 18 }}>
          <Text style={[styles.bottomText, { color: COLORS.accent, textAlign: "center" }]}>
            {isVerified ? "Continue to MatchHai" : "Back to locked dashboard"}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
