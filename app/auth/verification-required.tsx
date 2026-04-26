import { Link, router } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import LogoHalo from "../../src/components/LogoHalo";
import { AppButton, AppCard } from "../../src/components/AppPrimitives";
import { useAuth } from "../../src/context/AuthContext";
import { useToast } from "../../src/hooks/useToast";
import {
  EMAIL_VERIFICATION_REQUIRED_MESSAGE,
  sendCurrentUserVerificationEmail,
} from "../../src/services/convex/authService";
import { COLORS } from "../../src/theme";
import { EMAIL_VERIFICATION_LOCK_DETAIL_MESSAGE } from "../../src/utils/emailVerificationGate";
import styles from "./login.styles";

export default function VerificationRequiredScreen() {
  const { authUser } = useAuth();
  const { showToast } = useToast();
  const [sending, setSending] = useState(false);

  const handleResend = async () => {
    setSending(true);
    const result = await sendCurrentUserVerificationEmail();
    setSending(false);

    showToast({
      type: result.ok ? "success" : "error",
      title: result.ok ? "Verification sent" : "Could not resend",
      message: result.ok
        ? "Check your inbox and verify your email to unlock matchrooms and team actions."
        : result.message,
    });
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <LogoHalo />
        <Text style={styles.heading}>Verify your email</Text>
        <Text style={styles.sub}>
          {EMAIL_VERIFICATION_REQUIRED_MESSAGE}
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
            {EMAIL_VERIFICATION_LOCK_DETAIL_MESSAGE}
          </Text>
        </View>

        <View style={styles.buttonShadowWrapper}>
          <AppButton onPress={handleResend} disabled={sending} loading={sending}>
            Resend verification email
          </AppButton>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "center" }}>
          <Text style={styles.bottomText}>Already verified? </Text>
          <Link href="/auth/login" style={{ color: COLORS.accent }}>
            Back to login
          </Link>
        </View>

        <Pressable onPress={() => router.replace("/(player)/(tabs)" as any)} style={{ marginTop: 18 }}>
          <Text style={[styles.bottomText, { color: COLORS.accent, textAlign: "center" }]}>
            Continue to player home
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
