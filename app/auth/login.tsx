// app/auth/login.tsx
import { MaterialIcons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import LogoHalo from "../../src/components/LogoHalo";
import { useToast } from "../../src/hooks/useToast";
import { signInWithEmail } from "../../src/services/authService";
import { COLORS } from "../../src/theme";
import styles from "./login.styles";

// 📱 Pakistani phone formatter
const formatPakistaniPhone = (value: string) => {
  const numeric = value.replace(/\D/g, "");
  if (!numeric) return value;

  let prefix = "";
  let rest = numeric;

  if (numeric.startsWith("92")) {
    prefix = "+92 ";
    rest = numeric.slice(2);
  } else if (numeric.startsWith("0")) {
    prefix = "0";
    rest = numeric.slice(1);
  } else {
    // not clearly Pakistani → don't format
    return value;
  }

  let formatted = prefix;

  if (rest.length <= 3) {
    formatted += rest;
  } else if (rest.length <= 7) {
    formatted += rest.slice(0, 3) + " " + rest.slice(3);
  } else {
    formatted +=
      rest.slice(0, 3) + " " + rest.slice(3, 7) + " " + rest.slice(7);
  }

  return formatted.trim();
};

// Common weak passwords (2)
const COMMON_WEAK_PASSWORDS = [
  "123456",
  "12345678",
  "123456789",
  "password",
  "qwerty",
  "111111",
  "123123",
  "letmein",
  "pakistan",
  "pakistan123",
];

// Email typo map (4)
const EMAIL_DOMAIN_TYPO_MAP: Record<string, string> = {
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmil.com": "hotmail.com",
  "yaho.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "outlok.com": "outlook.com",
};

const COMMON_EMAIL_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "live.com",
  "icloud.com",
];

const MAX_ATTEMPTS = 5; // (7)
const LOCKOUT_SECONDS = 30; // (7)

export default function Login() {
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");

  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const [emailServerError, setEmailServerError] = useState("");

  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  // brute-force UI state (7)
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0);

  const emailRef = useRef<TextInput | null>(null);
  const passwordRef = useRef<TextInput | null>(null);

  const { showToast } = useToast();

  // Lockout countdown (7)
  useEffect(() => {
    if (lockoutSecondsLeft <= 0) return;
    const timer = setInterval(() => {
      setLockoutSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSecondsLeft]);

  // Validation + strength + caps lock detection
  const {
    isEmailValid,
    isPasswordValid,
    isFormValid,
    emailFormatError,
    emailDomainWarning,
    passwordError,
    hasUpper,
    hasLower,
    hasDigit,
    hasSpecial,
    strengthLabel,
    strengthPercent,
    strengthColor,
    capsLockLikely,
  } = useMemo(() => {
    const trimmed = emailOrPhone.trim();

    // 📨 Email / phone validation (4 + 6)
    const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,}$/;
    const normalizedPhone = trimmed.replace(/\s|-/g, "");
    const phoneRegex = /^(\+92|92|0)?3[0-9]{9}$/; // Pakistani mobile

    let emailErr = "";
    let domainWarning = "";

    const isEmailLike = trimmed.includes("@");

    const emailValidFormat = emailRegex.test(trimmed);
    const phoneValid = phoneRegex.test(normalizedPhone);

    if (!trimmed) {
      emailErr = "Email or phone is required.";
    } else if (!emailValidFormat && !phoneValid) {
      emailErr = "Enter a valid email or Pakistani mobile number.";
    }

    const emailValid = emailErr === "";

    // Email domain typo / unusual warning (4)
    if (trimmed && emailValidFormat) {
      const parts = trimmed.split("@");
      if (parts.length === 2) {
        const domain = parts[1].toLowerCase();
        if (EMAIL_DOMAIN_TYPO_MAP[domain]) {
          domainWarning = `Did you mean ${EMAIL_DOMAIN_TYPO_MAP[domain]}?`;
        } else if (
          !COMMON_EMAIL_DOMAINS.includes(domain) &&
          !domain.includes(".")
        ) {
          domainWarning = "This email domain looks unusual. Please check it.";
        }
      }
    }

    // 🔐 Password rules
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumeric = /\d/.test(password);
    const hasSpecialChar = /[^\w\s]/.test(password);
    const hasMinLength = password.length >= 6;

    // (3) reject "all same" or repetitive type passwords
    const allSameChar =
      password.length > 0 &&
      password.split("").every((ch) => ch === password[0]);

    // (2) common weak passwords
    const isCommonWeak = COMMON_WEAK_PASSWORDS.includes(password.toLowerCase());

    let passErr = "";
    if (!password) {
      passErr = "Password is required.";
    } else if (allSameChar) {
      passErr = "Password should not be all the same character.";
    } else if (isCommonWeak) {
      passErr = "This password is too common. Please choose a stronger one.";
    }

    const passwordValid =
      !!password &&
      hasMinLength &&
      hasUppercase &&
      hasLowercase &&
      hasNumeric &&
      hasSpecialChar &&
      !allSameChar &&
      !isCommonWeak;

    // (1) Strength meter
    const components = [
      hasMinLength,
      hasUppercase,
      hasLowercase,
      hasNumeric,
      hasSpecialChar,
    ].filter(Boolean).length;

    let strengthLabelLocal = "";
    let strengthColorLocal = "#e57373";
    let strengthPercentLocal = 0;

    if (password) {
      strengthPercentLocal = Math.min(100, components * 20);
      if (components <= 2) {
        strengthLabelLocal = "Weak";
        strengthColorLocal = "#e57373";
      } else if (components === 3) {
        strengthLabelLocal = "Fair";
        strengthColorLocal = "#ffb74d";
      } else if (components === 4) {
        strengthLabelLocal = "Strong";
        strengthColorLocal = "#81c784";
      } else {
        strengthLabelLocal = "Very strong";
        strengthColorLocal = "#4caf50";
      }
    }

    // (8) Caps Lock likely?
    let capsLikely = false;
    if (password.length >= 3) {
      const lettersOnly = password.replace(/[^A-Za-z]/g, "");
      if (
        lettersOnly.length >= 3 &&
        lettersOnly === lettersOnly.toUpperCase() &&
        /[A-Z]/.test(lettersOnly) &&
        !/[a-z]/.test(lettersOnly)
      ) {
        capsLikely = true;
      }
    }

    return {
      isEmailValid: emailValid,
      isPasswordValid: passwordValid,
      isFormValid: emailValid && passwordValid,
      emailFormatError: emailErr,
      emailDomainWarning: isEmailLike ? domainWarning : "",
      passwordError: passErr,
      hasUpper: hasUppercase,
      hasLower: hasLowercase,
      hasDigit: hasNumeric,
      hasSpecial: hasSpecialChar,
      strengthLabel: strengthLabelLocal,
      strengthPercent: strengthPercentLocal,
      strengthColor: strengthColorLocal,
      capsLockLikely: capsLikely,
    };
  }, [emailOrPhone, password]);

  const isLockedOut = lockoutSecondsLeft > 0;
  const emailErrorToShow =
    emailServerError || (emailTouched && !emailFocused ? emailFormatError : "");

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
    if (isLockedOut) {
      showToast({
        type: "warning",
        title: "Too many attempts",
        message: `Please wait ${lockoutSecondsLeft}s before trying again.`,
      });
      return;
    }

    if (!isFormValid) {
      setEmailTouched(true);
      setPasswordTouched(true);

      showToast({
        type: "info",
        title: "Check details",
        message: "Please enter a valid email/phone and a strong password.",
      });
      return;
    }

    try {
      setLoading(true);
      setEmailServerError("");

      const res = await signInWithEmail(emailOrPhone, password);
      setLoading(false);

      if (!res.ok) {
        // increment and check if we've hit the 5th attempt
        const nextAttempts = failedAttempts + 1;
        if (nextAttempts >= MAX_ATTEMPTS) {
          // start lockout
          setLockoutSecondsLeft(LOCKOUT_SECONDS);
          setFailedAttempts(0); // reset counter internally

          showToast({
            type: "warning",
            title: "Too many attempts",
            message: `You have failed 5 times. Please wait ${LOCKOUT_SECONDS} seconds before trying again.`,
          });
        } else {
          setFailedAttempts(nextAttempts);
        }

        const trimmed = emailOrPhone.trim();
        const normalizedPhone = trimmed.replace(/\s|-/g, "");
        const phoneRegex = /^(\+92|92|0)?3[0-9]{9}$/;

        if (res.code === "auth/user-not-found") {
          if (phoneRegex.test(normalizedPhone) && !trimmed.includes("@")) {
            setEmailServerError("No account found for this phone number.");
          } else {
            setEmailServerError("This email is not registered.");
          }
        } else if (res.code === "auth/invalid-email") {
          if (phoneRegex.test(normalizedPhone) && !trimmed.includes("@")) {
            setEmailServerError("Enter a valid Pakistani mobile number.");
          } else {
            setEmailServerError("Enter a valid email address.");
          }
        } else {
          setEmailServerError(res.message || "Sign in failed.");
        }

        showToast({
          type: "error",
          title: "Sign In Failed",
          message: res.message || "Sign in failed.",
        });
        return;
      }

      // success → reset brute-force state
      setFailedAttempts(0);
      setLockoutSecondsLeft(0);

      // Optional: subtle success toast
      showToast({
        type: "success",
        title: "Welcome back",
        message: "You’re now signed in.",
      });

      router.replace("/home");
    } catch (e) {
      setLoading(false);
      showToast({
        type: "error",
        title: "Sign In Failed",
        message: "Something went wrong. Please try again.",
      });
    }
  };

  const handleForgotPassword = () => {
    router.push("/auth/forgot-password");
  };

  const showPasswordHints = password.length > 0 || passFocused;

  const renderPasswordHintItem = (satisfied: boolean, label: string) => (
    <View style={styles.passwordHintItem}>
      <Text
        style={[
          styles.passwordHintIcon,
          satisfied
            ? styles.passwordHintIconDone
            : styles.passwordHintIconPending,
        ]}
      >
        {satisfied ? "✓" : "×"}
      </Text>
      <Text
        style={[
          styles.passwordHintText,
          satisfied
            ? styles.passwordHintTextDone
            : styles.passwordHintTextPending,
        ]}
      >
        {label}
      </Text>
    </View>
  );

  const isSubmitDisabled = loading || !isFormValid || isLockedOut;

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

          <View style={[styles.inputBox]}>
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
                ref={emailRef}
                placeholder="Email or phone"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                selectionColor={COLORS.accent}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={emailOrPhone}
                onChangeText={(text) => {
                  let next = text;
                  // (6) auto-format phone if looks numeric / Pakistani
                  if (/^[\d+\s-]*$/.test(text)) {
                    next = formatPakistaniPhone(text);
                  }
                  setEmailOrPhone(next);
                  if (emailServerError) setEmailServerError("");
                }}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => {
                  setEmailFocused(false);
                  setEmailTouched(true);
                }}
                returnKeyType="next"
                onSubmitEditing={() => {
                  passwordRef.current?.focus();
                }}
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

          {emailErrorToShow ? (
            <Text style={styles.errorText}>{emailErrorToShow}</Text>
          ) : null}

          {/* Email domain typo suggestion (4) */}
          {!emailErrorToShow &&
          emailTouched &&
          !emailFocused &&
          emailDomainWarning ? (
            <View style={styles.helperTextRow}>
              <Text style={[styles.helperText, styles.helperWarning]}>
                {emailDomainWarning}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>

          <View style={[styles.inputBox]}>
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
                ref={passwordRef}
                placeholder="Password"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                selectionColor={COLORS.accent}
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (!passwordTouched) setPasswordTouched(true);
                }}
                onFocus={() => setPassFocused(true)}
                onBlur={() => {
                  setPassFocused(false);
                  setPasswordTouched(true);
                }}
                returnKeyType="done"
                blurOnSubmit={false}
              />

              <Pressable
                // (9) short press toggles, long press temporarily shows password
                onPress={() => setPasswordVisible((v) => !v)}
                onLongPress={() => setPasswordVisible(true)}
                onPressOut={() => {
                  // we won't force-hide here to respect manual toggle
                }}
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

          {passwordTouched && passwordError ? (
            <Text style={styles.errorText}>{passwordError}</Text>
          ) : null}

          {/* (1) Strength meter + (3)(2) indirectly included via strength calc */}
          {showPasswordHints && (
            <View style={styles.strengthWrapper}>
              <View style={styles.strengthBar}>
                <View
                  style={[
                    styles.strengthBarFill,
                    {
                      width: `${strengthPercent}%`,
                      backgroundColor: strengthColor || "#444",
                    },
                  ]}
                />
              </View>
              {strengthLabel ? (
                <Text
                  style={[
                    styles.strengthLabel,
                    { color: strengthColor || COLORS.muted }, // <-- match meter color
                  ]}
                >
                  Strength: {strengthLabel}
                </Text>
              ) : null}
            </View>
          )}

          {/* Live rules (1 uppercase, 1 lowercase, 1 number, 1 special) */}
          {showPasswordHints && (
            <View style={styles.passwordHintGrid}>
              <View style={styles.passwordHintRow}>
                {renderPasswordHintItem(hasUpper, "1 uppercase character")}
                {renderPasswordHintItem(hasLower, "1 lowercase character")}
              </View>
              <View style={styles.passwordHintRow}>
                {renderPasswordHintItem(hasDigit, "1 numeric character")}
                {renderPasswordHintItem(hasSpecial, "1 special character")}
              </View>
            </View>
          )}

          {/* (8) Caps Lock heuristic warning */}
          {capsLockLikely && (
            <View style={styles.helperTextRow}>
              <Text style={[styles.helperText, styles.helperWarning]}>
                It looks like Caps Lock might be on.
              </Text>
            </View>
          )}
        </View>

        {/* Forgot password */}
        <View className="forgot-row" style={styles.forgotRow}>
          <Pressable onPress={handleForgotPassword}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </Pressable>
        </View>

        {/* Primary Login button + brute-force UI */}
        <View
          style={[
            styles.buttonShadowWrapper,
            // we keep shadow constant now to avoid focus jumps
          ]}
        >
          <Pressable
            onPress={handleLogin}
            disabled={isSubmitDisabled}
            style={({ pressed }) => [
              styles.primaryBtn,
              isSubmitDisabled ? styles.primaryBtnDisabled : null,
              pressed && !isSubmitDisabled && { opacity: 0.92 },
            ]}
            android_ripple={{ color: "rgba(255,255,255,0.08)" }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Login</Text>
            )}
          </Pressable>

          {/* (7) error counter / lockout UI */}
          {isLockedOut && (
            <View style={styles.helperTextRow}>
              <Text style={[styles.helperText, styles.helperWarning]}>
                Too many failed attempts. Please wait {lockoutSecondsLeft}s
                before trying again.
              </Text>
            </View>
          )}
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
