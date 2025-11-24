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

  // NEW: user type (player vs zone admin)
  const [userType, setUserType] = useState<"player" | "zone">("player");

  // DEBUG: log mount and userType changes
  useEffect(() => {
    console.log("[Login] screen mounted");
  }, []);

  useEffect(() => {
    console.log("[Login] userType changed →", userType);
  }, [userType]);

  // Lockout countdown (7)
  useEffect(() => {
    if (lockoutSecondsLeft <= 0) return;
    console.log("[Login] lockout started, seconds left:", lockoutSecondsLeft);
    const timer = setInterval(() => {
      setLockoutSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          console.log("[Login] lockout finished");
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
    // Only show for PLAYERS; Zone Admins can use custom business domains
    if (trimmed && emailValidFormat && userType === "player") {
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
    }

    const passwordValid = !!password; // just non-empty for login

    // (1) Strength meter
    const components = [
      hasMinLength,
      hasUppercase,
      hasLowercase,
      hasNumeric,
      hasSpecialChar,
      !allSameChar && !isCommonWeak,
    ].filter(Boolean).length;

    let strengthLabelLocal = "";
    let strengthColorLocal = "#e57373";
    let strengthPercentLocal = 0;

    if (password) {
      strengthPercentLocal = Math.min(100, components * 16.6);
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
  }, [emailOrPhone, password, userType]);

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
    console.log("[Login] handleLogin called, userType=", userType);

    if (isLockedOut) {
      console.log("[Login] blocked by lockout");
      showToast({
        type: "warning",
        title: "Too many attempts",
        message: `Please wait ${lockoutSecondsLeft}s before trying again.`,
      });
      return;
    }

    if (!isEmailValid || !password) {
      console.log("[Login] invalid form", {
        isEmailValid,
        hasPassword: !!password,
      });
      setEmailTouched(true);
      setPasswordTouched(true);

      showToast({
        type: "info",
        title: "Check details",
        message: "Please enter a valid email/phone and your password.",
      });
      return;
    }

    try {
      setLoading(true);
      setEmailServerError("");
      console.log("[Login] calling signInWithEmail", { emailOrPhone });

      const res = await signInWithEmail(emailOrPhone, password /*, userType */);
      setLoading(false);

      if (!res.ok) {
        console.log("[Login] signInWithEmail FAILED", res);
        const nextAttempts = failedAttempts + 1;
        if (nextAttempts >= MAX_ATTEMPTS) {
          setLockoutSecondsLeft(LOCKOUT_SECONDS);
          setFailedAttempts(0);

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
        } else if (res.code === "auth/wrong-password") {
          setEmailServerError("Incorrect password. Please try again.");
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

      console.log("[Login] signInWithEmail OK, navigating, userType=", userType);

      setFailedAttempts(0);
      setLockoutSecondsLeft(0);

      showToast({
        type: "success",
        title: "Welcome back",
        message:
          userType === "zone"
            ? "Signed in as Zone Admin."
            : "You’re now signed in.",
      });

      // For now, both go to /home; later you can add /zone/home
      router.replace("/home");
    } catch (e) {
      console.error("[Login] signInWithEmail threw error", e);
      setLoading(false);
      showToast({
        type: "error",
        title: "Sign In Failed",
        message: "Something went wrong. Please try again.",
      });
    }
  };

  const handleForgotPassword = () => {
    console.log("[Login] Forgot Password pressed");
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

  const isSubmitDisabled = loading || !isEmailValid || !password || isLockedOut;

  // Bottom CTA text + href based on role
  const bottomLabel =
    userType === "zone" ? "Sign up as Admin" : "Create an account";
  const bottomPrefix = userType === "zone" ? "New zone? " : "New here? ";
  const bottomHref =
    userType === "zone" ? "/auth/zone-register" : "/auth/register";

  useEffect(() => {
    console.log("[Login] bottomHref changed →", bottomHref);
  }, [bottomHref]);

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

        {/* Role toggle (Player / Zone Admin) */}
        <View style={styles.roleToggleRow}>
          <Pressable
            onPress={() => setUserType("player")}
            style={[
              styles.roleChip,
              userType === "player" && styles.roleChipActive,
            ]}
          >
            <Text
              style={[
                styles.roleChipText,
                userType === "player" && styles.roleChipTextActive,
              ]}
            >
              Player
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setUserType("zone")}
            style={[
              styles.roleChip,
              userType === "zone" && styles.roleChipActive,
            ]}
          >
            <Text
              style={[
                styles.roleChipText,
                userType === "zone" && styles.roleChipTextActive,
              ]}
            >
              Zone Admin
            </Text>
          </Pressable>
        </View>

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

          {!emailErrorToShow &&
            emailTouched &&
            !emailFocused &&
            emailDomainWarning && (
              <View style={styles.helperTextRow}>
                <Text style={[styles.helperText, styles.helperWarning]}>
                  {emailDomainWarning}
                </Text>
              </View>
            )}
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
                onPress={() => setPasswordVisible((v) => !v)}
                onLongPress={() => setPasswordVisible(true)}
                onPressOut={() => {
                  // don't force-hide, respect manual toggle
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

          {/* Strength meter */}
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
                    { color: strengthColor || COLORS.muted },
                  ]}
                >
                  Strength: {strengthLabel}
                </Text>
              ) : null}
            </View>
          )}

          {/* Live rules */}
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

          {/* Caps Lock heuristic warning */}
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
        <View style={styles.buttonShadowWrapper}>
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

          {isLockedOut && (
            <View style={styles.helperTextRow}>
              <Text style={[styles.helperText, styles.helperWarning]}>
                Too many failed attempts. Please wait {lockoutSecondsLeft}s
                before trying again.
              </Text>
            </View>
          )}
        </View>

        {/* Bottom link (dynamic text + Link navigation) */}
        <View style={{ flexDirection: "row", justifyContent: "center" }}>
          <Text style={styles.bottomText}>{bottomPrefix}</Text>
          <Link
            href={bottomHref}
            asChild
            onPress={() =>
              console.log(
                "[Login] Link pressed → userType=",
                userType,
                "href=",
                bottomHref
              )
            }
          >
            <Pressable>
              <Text style={[styles.bottomText, { color: COLORS.accent }]}>
                {bottomLabel}
              </Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </Container>
  );
}
