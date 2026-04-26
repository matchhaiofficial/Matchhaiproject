import { useLocalSearchParams, router } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { authClient } from "../../src/lib/auth-client";
import { AppButton } from "../../src/components/AppPrimitives";
import { AppIcon } from "../../src/components/AppIcon";
import LogoHalo from "../../src/components/LogoHalo";
import { useToast } from "../../src/hooks/useToast";
import { COLORS, INPUT_PADDING } from "../../src/theme";
import styles from "./login.styles";

export default function ResetPassword() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { showToast } = useToast();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isPasswordValid = password.length >= 8;
  const isFormValid = isPasswordValid && password === confirm;

  const handleReset = async () => {
    if (!token) {
      showToast({
        type: "error",
        title: "Invalid link",
        message: "Reset token is missing. Please request a new reset link.",
      });
      return;
    }

    if (!isFormValid) {
      showToast({
        type: "info",
        title: "Check passwords",
        message:
          password !== confirm
            ? "Passwords do not match."
            : "Password must be at least 8 characters.",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Better Auth's reset password endpoint
      const resetFn =
        (authClient as any).resetPassword ??
        (authClient as any).confirmPasswordReset;

      if (!resetFn) {
        throw new Error("resetPassword method not found on authClient.");
      }

      const { error } = await resetFn({ token, newPassword: password });

      if (error) {
        showToast({
          type: "error",
          title: "Reset failed",
          message: error.message ?? "Could not reset password. Try again.",
        });
        return;
      }

      showToast({
        type: "success",
        title: "Password updated",
        message: "Your password has been reset. Please sign in.",
      });
      router.replace("/auth/login");
    } catch (e: any) {
      showToast({
        type: "error",
        title: "Reset failed",
        message: e?.message ?? "Something went wrong. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const Container: any = Platform.OS === "ios" ? KeyboardAvoidingView : View;
  const containerProps =
    Platform.OS === "ios"
      ? { style: styles.screen, behavior: "padding" as const }
      : { style: styles.screen };

  // No token in URL — the link was already consumed or is invalid
  if (!token) {
    return (
      <Container {...containerProps}>
        <View style={styles.container}>
          <LogoHalo />
          <Text style={styles.heading}>Invalid link</Text>
          <Text style={styles.sub}>
            This reset link is invalid or has already been used. Please request
            a new one.
          </Text>
          <AppButton onPress={() => router.replace("/auth/forgot-password")}>
            Request new link
          </AppButton>
        </View>
      </Container>
    );
  }

  return (
    <Container {...containerProps}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LogoHalo />
        <Text style={styles.heading}>Set new password</Text>
        <Text style={styles.sub}>Choose a strong password for your MatchHai account.</Text>

        {/* New password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>New password</Text>
          <View style={styles.inputBox}>
            <View style={styles.inputRow}>
              <AppIcon name="lock" size={22} style={styles.prefixIcon} color={COLORS.muted} />
              <TextInput
                placeholder="Min. 8 characters"
                placeholderTextColor={COLORS.muted}
                style={[styles.input, { paddingRight: INPUT_PADDING.withIcon }]}
                selectionColor={COLORS.accent}
                secureTextEntry
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
              />
              {password.length > 0 && (
                <AppIcon
                  name={isPasswordValid ? "check-circle" : "error-outline"}
                  size={20}
                  style={styles.suffixIcon}
                  color={isPasswordValid ? "#4CAF50" : "#FF5252"}
                />
              )}
            </View>
          </View>
        </View>

        {/* Confirm password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Confirm password</Text>
          <View style={styles.inputBox}>
            <View style={styles.inputRow}>
              <AppIcon name="lock" size={22} style={styles.prefixIcon} color={COLORS.muted} />
              <TextInput
                placeholder="Repeat your password"
                placeholderTextColor={COLORS.muted}
                style={[styles.input, { paddingRight: INPUT_PADDING.withIcon }]}
                selectionColor={COLORS.accent}
                secureTextEntry
                autoCapitalize="none"
                value={confirm}
                onChangeText={setConfirm}
              />
              {confirm.length > 0 && (
                <AppIcon
                  name={password === confirm ? "check-circle" : "error-outline"}
                  size={20}
                  style={styles.suffixIcon}
                  color={password === confirm ? "#4CAF50" : "#FF5252"}
                />
              )}
            </View>
          </View>
          {confirm.length > 0 && password !== confirm && (
            <Text style={[styles.helperText, styles.helperWarning]}>
              Passwords do not match.
            </Text>
          )}
        </View>

        <View
          style={[
            styles.buttonShadowWrapper,
            isFormValid && !submitting && styles.buttonShadowWrapperActive,
          ]}
        >
          <AppButton onPress={handleReset} disabled={submitting || !isFormValid} loading={submitting}>
            Reset password
          </AppButton>
        </View>
      </ScrollView>
    </Container>
  );
}