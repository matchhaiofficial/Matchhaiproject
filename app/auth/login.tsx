// app/auth/login.tsx
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
import { signInWithEmail } from "../../src/services/authService";
import { COLORS } from "../../src/theme";
import styles from "./login.styles";

export default function Login() {
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  // Email OR Pakistani phone validation
  const { isEmailValid, isPasswordValid, isFormValid } = useMemo(() => {
    const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
    const phoneRegex = /^(\+92|0)?[0-9]{10}$/;

    const trimmed = emailOrPhone.trim();
    const emailValid = emailRegex.test(trimmed) || phoneRegex.test(trimmed);
    const passValid = password.length >= 6;

    return {
      isEmailValid: emailValid,
      isPasswordValid: passValid,
      isFormValid: emailValid && passValid,
    };
  }, [emailOrPhone, password]);

  // Keyboard handling (iOS only)
  const Container: any = Platform.OS === "ios" ? KeyboardAvoidingView : View;
  const containerProps =
    Platform.OS === "ios"
      ? {
          style: styles.screen,
          behavior: "padding" as const,
          keyboardVerticalOffset: 0,
        }
      : { style: styles.screen };

  const handleLogin = async () => {
    if (!isFormValid) {
      Alert.alert(
        "Check details",
        "Please enter a valid email/phone and a password of at least 6 characters."
      );
      return;
    }

    try {
      setLoading(true);
      const res = await signInWithEmail(emailOrPhone, password);
      setLoading(false);

      if (!res.ok) {
        Alert.alert("Sign In Failed", res.message);
        return;
      }

      router.replace("/home");
    } catch (e) {
      setLoading(false);
      Alert.alert("Sign In Failed", "Something went wrong. Please try again.");
    }
  };

  const handleForgotPassword = () => {
    router.push("/auth/forgot-password");
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
        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.sub}>Sign in to MatchHai</Text>

        {/* Email / Phone */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email or Phone</Text>

          <View
            style={[
              styles.inputBox,
              isEmailValid &&
                emailOrPhone.trim().length > 0 &&
                styles.inputBoxValidShadow,
            ]}
          >
            <View style={styles.inputRow}>
              <MaterialIcons
                name="email"
                size={22}
                style={styles.prefixIcon}
                color={
                  isEmailValid && emailOrPhone.trim().length > 0
                    ? COLORS.accent
                    : COLORS.muted
                }
              />

              <TextInput
                placeholder="Email or phone"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                selectionColor={COLORS.accent}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                value={emailOrPhone}
                onChangeText={setEmailOrPhone}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />

              {emailOrPhone.trim().length > 0 && (
                <MaterialIcons
                  name={isEmailValid ? "check-circle" : "error-outline"}
                  size={20}
                  style={styles.suffixIcon}
                  color={isEmailValid ? "#4CAF50" : "#FF5252"}
                />
              )}
            </View>

            <View
              style={[styles.focusBar, { opacity: emailFocused ? 1 : 0 }]}
            />
          </View>
        </View>

        {/* Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>

          <View
            style={[
              styles.inputBox,
              isPasswordValid &&
                password.length > 0 &&
                styles.inputBoxValidShadow,
            ]}
          >
            <View style={styles.inputRow}>
              <MaterialIcons
                name="lock"
                size={22}
                style={styles.prefixIcon}
                color={
                  isPasswordValid && password.length > 0
                    ? COLORS.accent
                    : COLORS.muted
                }
              />

              <TextInput
                placeholder="Password"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                selectionColor={COLORS.accent}
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPassFocused(true)}
                onBlur={() => setPassFocused(false)}
              />

              <Pressable
                onPress={() => setPasswordVisible((v) => !v)}
                hitSlop={10}
              >
                <MaterialIcons
                  name={passwordVisible ? "visibility" : "visibility-off"}
                  size={20}
                  style={styles.suffixIcon}
                  color={COLORS.muted}
                />
              </Pressable>
            </View>

            <View style={[styles.focusBar, { opacity: passFocused ? 1 : 0 }]} />
          </View>
        </View>

        {/* Forgot password */}
        <View style={styles.forgotRow}>
          <Pressable onPress={handleForgotPassword}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </Pressable>
        </View>

        {/* Primary Login button */}
        <View
          style={[
            styles.buttonShadowWrapper,
            isFormValid && !loading && styles.buttonShadowWrapperActive,
          ]}
        >
          <Pressable
            onPress={handleLogin}
            disabled={loading || !isFormValid}
            style={({ pressed }) => [
              styles.primaryBtn,
              !isFormValid || loading ? styles.primaryBtnDisabled : null,
              pressed && !loading && isFormValid && { opacity: 0.92 },
            ]}
            android_ripple={{ color: "rgba(255,255,255,0.08)" }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Login</Text>
            )}
          </Pressable>
        </View>

        {/* Bottom link */}
        <Text style={styles.bottomText}>
          New here?{" "}
          <Link href="/auth/register" style={{ color: COLORS.accent }}>
            Create an account
          </Link>
        </Text>
      </ScrollView>
    </Container>
  );
}
