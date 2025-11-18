// app/auth/forgot-password.tsx
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
    TextInput,
    View,
} from "react-native";

import LogoHalo from "../../src/components/LogoHalo";
import { sendPasswordReset } from "../../src/services/authService";
import { COLORS } from "../../src/theme";
import styles from "./login.styles";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // simple email validation (no phone here — Firebase reset is email-only)
  const { isEmailValid, isFormValid } = useMemo(() => {
    const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
    const trimmed = email.trim();
    const emailValid = emailRegex.test(trimmed);

    return {
      isEmailValid: emailValid,
      isFormValid: emailValid,
    };
  }, [email]);

  // Keyboard handling (iOS)
  const Container: any = Platform.OS === "ios" ? KeyboardAvoidingView : View;
  const containerProps =
    Platform.OS === "ios"
      ? {
          style: styles.screen,
          behavior: "padding" as const,
          keyboardVerticalOffset: 0,
        }
      : { style: styles.screen };

  const handleSubmit = async () => {
    if (!isFormValid) {
      Alert.alert(
        "Check email",
        "Please enter a valid email address to receive the reset link."
      );
      return;
    }

    setSubmitting(true);
    const res = await sendPasswordReset(email);
    setSubmitting(false);

    if (!res.ok) {
      Alert.alert("Reset failed", res.message);
      return;
    }

    Alert.alert(
      "Email sent",
      "If an account exists with this email, you'll receive a reset link shortly.",
      [
        {
          text: "OK",
          onPress: () => router.replace("/auth/login"),
        },
      ]
    );
  };

  return (
    <Container {...containerProps}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <LogoHalo />

        {/* Headings */}
        <Text style={styles.heading}>Reset password</Text>
        <Text style={styles.sub}>
          Enter the email linked to your MatchHai account and we'll send you a
          reset link.
        </Text>

        {/* Email field */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>

          <View
            style={[
              styles.inputBox,
              isEmailValid && email.trim().length > 0 && styles.inputBoxValidShadow,
            ]}
          >
            <View style={styles.inputRow}>
              <MaterialIcons
                name="email"
                size={22}
                style={styles.prefixIcon}
                color={
                  isEmailValid && email.trim().length > 0
                    ? COLORS.accent
                    : COLORS.muted
                }
              />

              <TextInput
                placeholder="your@email.com"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                selectionColor={COLORS.accent}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />

              {email.trim().length > 0 && (
                <MaterialIcons
                  name={isEmailValid ? "check-circle" : "error-outline"}
                  size={20}
                  style={styles.suffixIcon}
                  color={isEmailValid ? "#4CAF50" : "#FF5252"}
                />
              )}
            </View>

            <View style={[styles.focusBar, { opacity: emailFocused ? 1 : 0 }]} />
          </View>

          {!isEmailValid && email.trim().length > 0 && (
            <View style={styles.helperTextRow}>
              <Text style={[styles.helperText, styles.helperWarning]}>
                Please enter a valid email address.
              </Text>
            </View>
          )}
        </View>

        {/* Submit button */}
        <View
          style={[
            styles.buttonShadowWrapper,
            isFormValid && !submitting && styles.buttonShadowWrapperActive,
          ]}
        >
          <Pressable
            onPress={handleSubmit}
            disabled={submitting || !isFormValid}
            style={({ pressed }) => [
              styles.primaryBtn,
              !isFormValid || submitting ? styles.primaryBtnDisabled : null,
              pressed && !submitting && isFormValid && { opacity: 0.92 },
            ]}
            android_ripple={{ color: "rgba(255,255,255,0.08)" }}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Send reset link</Text>
            )}
          </Pressable>
        </View>

        {/* Back to login */}
        <Text style={styles.bottomText}>
          Remembered your password?{" "}
          <Link href="/auth/login" style={{ color: COLORS.accent }}>
            Back to login
          </Link>
        </Text>
      </ScrollView>
    </Container>
  );
}
