import { useAction, useQuery } from "convex/react";
import { Link, router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { api } from "../../convex/_generated/api";
import LogoHalo from "../../src/components/LogoHalo";
import { AppButton, AppCard } from "../../src/components/AppPrimitives";
import { useAuth } from "../../src/context/AuthContext";
import { useToast } from "../../src/hooks/useToast";
import { useStartDiditKyc } from "../../src/hooks/useDiditKyc";
import { COLORS } from "../../src/theme";
import { KYC_VERIFICATION_REQUIRED_MESSAGE } from "../../src/utils/verificationGate";
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

export default function VerificationRequiredScreen() {
  const { authUser, user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [starting, setStarting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startDiditKyc = useStartDiditKyc();
  const currentKyc = useQuery(api.kyc.getCurrentUserKyc);
  const refreshDiditStatus = useAction(api.kyc.refreshDiditVerificationStatus);
  const kycStatus = currentKyc?.status || user?.kycVerificationStatus || "not_started";
  const isRejected = kycStatus === "rejected";
  const isVerified = kycStatus === "verified";
  const safeReason = useMemo(
    () => formatKycReason(currentKyc?.rejectionReason),
    [currentKyc?.rejectionReason],
  );

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

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace("/(player)/(tabs)" as any);
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

  const handleStart = async () => {
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
    await refreshVerificationState();
    showToast({
      type: isVerified ? "success" : isRejected ? "warning" : "info",
      title: "Status refreshed",
      message: isVerified
        ? "Identity verification is complete."
        : isRejected
          ? safeReason || "Identity verification was declined. Please start a new attempt."
          : KYC_VERIFICATION_REQUIRED_MESSAGE,
    });
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
          <Text style={styles.label}>Signed in as</Text>
          <AppCard style={styles.inputBox}>
            <Text style={[styles.input, { color: COLORS.text }]}>
              {authUser?.email || "Your MatchHai account"}
            </Text>
          </AppCard>
        </View>

        <View style={styles.helperTextRow}>
          <Text style={[styles.helperText, styles.helperWarning]}>
            {safeReason ||
              (isVerified
                ? "You can continue to MatchHai features."
                : "Complete CNIC & face verification to unlock matchrooms, teams, challenges, and payments.")}
          </Text>
        </View>

        <View style={styles.buttonShadowWrapper}>
          <AppButton onPress={handleStart} disabled={starting} loading={starting}>
            {isRejected ? "Retry Verification" : "Start Verification"}
          </AppButton>
        </View>

        <View style={styles.buttonShadowWrapper}>
          <AppButton variant="secondary" onPress={handleRefresh} disabled={refreshing} loading={refreshing}>
            Refresh status
          </AppButton>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "center" }}>
          <Text style={styles.bottomText}>Need help? </Text>
          <Link href="/auth/login" style={{ color: COLORS.accent }}>
            Back to login
          </Link>
        </View>

        <Pressable onPress={() => router.replace("/(player)/(tabs)" as any)} style={{ marginTop: 18 }}>
          <Text style={[styles.bottomText, { color: COLORS.accent, textAlign: "center" }]}>
            {isVerified ? "Continue to MatchHai" : "Back to locked dashboard"}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
