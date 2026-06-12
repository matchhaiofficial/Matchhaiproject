// app/auth/login.tsx
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

import { AppIcon } from "../../src/components/AppIcon";
import LogoHalo from "../../src/components/LogoHalo";
import { useAuth } from "../../src/context/AuthContext";
import { logFlowEvent, useRouteLogger } from "../../src/hooks/useRouteLogger";
import { useToast } from "../../src/hooks/useToast";
import {
  recoverMissingProfileAfterLogin,
  signInWithEmail,
  signOutUser,
} from "../../src/services/convex/authService";
import { getUserProfile } from "../../src/services/convex/userService";
import { useLoginFormStore } from "../../src/store/loginFormStore";
import { getLoginButtonState } from "../../src/utils/loginButtonState";
import { COLORS, INPUT_PADDING } from "../../src/theme";
import Logger from "../../src/utils/logger";
import { APP_ROUTES } from "../../src/navigation/routes";
import { isSuperAdminProfile } from "../../src/utils/accountRouting";
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
const LOGIN_REQUEST_TIMEOUT_MS = 20000;
const LOGIN_CLEANUP_TIMEOUT_MS = 5000;

async function withLoginTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export default function Login() {
  useRouteLogger("LoginScreen");
  const emailOrPhone = useLoginFormStore((state) => state.emailOrPhone);
  const password = useLoginFormStore((state) => state.password);
  const userType = useLoginFormStore((state) => state.userType);
  const setEmailOrPhone = useLoginFormStore((state) => state.setEmailOrPhone);
  const setPassword = useLoginFormStore((state) => state.setPassword);
  const setUserType = useLoginFormStore((state) => state.setUserType);
  const [loading, setLoading] = useState(false);

  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const [emailServerError, setEmailServerError] = useState("");
  const [passwordServerError, setPasswordServerError] = useState("");

  const [passwordVisible, setPasswordVisible] = useState(false);
  const [modeHelper, setModeHelper] = useState<null | {
    message: string;
    targetMode: "player" | "zone";
    cta: string;
  }>(null);
  const [recoveryHelper, setRecoveryHelper] = useState<string | null>(null);

  // brute-force UI state (7)
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0);

  const emailRef = useRef<TextInput | null>(null);
  const passwordRef = useRef<TextInput | null>(null);
  const loginAttemptRef = useRef(0);

  const { showToast, hideToast } = useToast();
  const { refreshSession } = useAuth();

  const handleUserTypeChange = (nextType: "player" | "zone") => {
    setUserType(nextType);
    setModeHelper(null);
    setRecoveryHelper(null);
    setEmailServerError("");
    setPasswordServerError("");
    hideToast();
  };

  // DEBUG: log mount and userType changes
  useEffect(() => {
    Logger.info("Login", "Screen mounted");
  }, []);

  useEffect(() => {
    Logger.info("Login", "User type changed", { userType });
  }, [userType]);

  // Lockout countdown (7)
  useEffect(() => {
    if (lockoutSecondsLeft <= 0) return;
    Logger.info("Login", "Lockout countdown started", { lockoutSecondsLeft });
    const timer = setInterval(() => {
      setLockoutSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          Logger.info("Login", "Lockout countdown finished");
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
  const passwordErrorToShow =
    passwordServerError || (passwordTouched && !passFocused ? passwordError : "");

  // Keyboard handling
  const Container = KeyboardAvoidingView;
  const containerProps = {
    style: styles.screen,
    behavior: Platform.OS === "ios" ? ("padding" as const) : ("height" as const),
    keyboardVerticalOffset: Platform.OS === "ios" ? 0 : 20,
  };

  const handleLogin = async () => {
    if (loading) return;

    logFlowEvent("Login", "Login attempt started", {
      userType,
      identifierType: emailOrPhone.includes("@") ? "email" : "phone",
    });

    if (isLockedOut) {
      Logger.warn("Login", "Blocked by lockout", { lockoutSecondsLeft });
      showToast({
        type: "warning",
        title: "Too many attempts",
        message: `Please wait ${lockoutSecondsLeft}s before trying again.`,
      });
      return;
    }

    if (!isEmailValid || !password) {
      Logger.info("Login", "Blocked by invalid form", {
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
    const attemptId = loginAttemptRef.current + 1;
    loginAttemptRef.current = attemptId;
    let handoffStarted = false;
    const finishAttempt = () => {
      if (loginAttemptRef.current === attemptId) {
        setLoading(false);
      }
    };

    setLoading(true);
    const timeout = setTimeout(() => {
      if (loginAttemptRef.current !== attemptId) return;
      loginAttemptRef.current = attemptId + 1;
      setLoading(false);
      showToast({ type: "error", title: "Timed out", message: "Request took too long. Please try again." });
    }, LOGIN_REQUEST_TIMEOUT_MS);

    try {
      setEmailServerError("");
      setPasswordServerError("");
      setModeHelper(null);
      setRecoveryHelper(null);
      Logger.info("Login", "Calling signInWithEmail", {
        identifierType: emailOrPhone.includes("@") ? "email" : "phone",
      });

      const res = await signInWithEmail(emailOrPhone, password /*, userType */);
      if (loginAttemptRef.current !== attemptId) return;

      if (!res.ok) {
        finishAttempt();
        Logger.warn("Login", "signInWithEmail failed", {
          code: res.code,
          message: res.message,
        });
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
          setPasswordServerError("");
          if (phoneRegex.test(normalizedPhone) && !trimmed.includes("@")) {
            setEmailServerError("No account found for this phone number.");
          } else {
            setEmailServerError("This email is not registered.");
          }
        } else if (res.code === "auth/invalid-email") {
          setPasswordServerError("");
          if (phoneRegex.test(normalizedPhone) && !trimmed.includes("@")) {
            setEmailServerError("Enter a valid Pakistani mobile number.");
          } else {
            setEmailServerError("Enter a valid email address.");
          }
        } else if (res.code === "auth/wrong-password") {
          setEmailServerError("");
          setPasswordServerError("Incorrect password. Please try again.");
        } else {
          setPasswordServerError("");
          setEmailServerError(res.message || "Sign in failed.");
        }

        showToast({
          type: "error",
          title: "Sign In Failed",
          message: res.message || "Sign in failed.",
        });
        return;
      }

      // ✅ Role Validation
      Logger.info("Login", "Validating account role", {
        userId: res.userId,
        userType,
      });
      const profileRes = await getUserProfile(res.userId);
      if (loginAttemptRef.current !== attemptId) return;

      if (!profileRes.ok) {
        Logger.error("Login", "Failed to fetch user profile for role check", {
          message: profileRes.message,
        });
        const isMissing = profileRes.message === "User profile not found.";
        if (isMissing) {
          const recovered = await recoverMissingProfileAfterLogin(
            res.user,
            userType === "zone" ? "zone" : "player",
          );
          if (loginAttemptRef.current !== attemptId) return;

          if (recovered.ok) {
            await refreshSession();
            if (loginAttemptRef.current !== attemptId) return;
            handoffStarted = true;
            setLoading(false);
            showToast({
              type: "success",
              title: "Profile restored",
              message: "We rebuilt your MatchHai profile and signed you in.",
            });
            router.replace(userType === "zone" ? APP_ROUTES.zoneHome as any : APP_ROUTES.playerHome as any);
            return;
          }

          setRecoveryHelper("We authenticated your account, but your MatchHai profile is missing. Please retry once or contact support.");
        } else {
          setRecoveryHelper("We signed you in, but could not verify your MatchHai profile yet. Please try again.");
        }

        finishAttempt();
        await withLoginTimeout(
          signOutUser(),
          LOGIN_CLEANUP_TIMEOUT_MS,
          "Sign-out cleanup timed out.",
        ).catch((cleanupError) => {
          Logger.warn("Login", "Profile verification cleanup failed", cleanupError);
        });
        showToast({
          type: "error",
          title: isMissing ? "Profile Missing" : "Login Error",
          message: isMissing
            ? "Your account authenticated but the app profile could not be loaded."
            : "Could not verify your account type. Please try again.",
        });
        return;
      }

      const accountType = profileRes.data.accountType;
      const inputEmail = emailOrPhone.trim().toLowerCase();
      const userEmail = (res.user.email || inputEmail).toLowerCase();
      const isSuperAdmin = isSuperAdminProfile({
        _id: profileRes.data._id,
        email: userEmail || profileRes.data.email,
        role: profileRes.data.role,
      } as any);

      Logger.info("Login", "Resolved account role", {
        accountType,
        isSuperAdmin,
        userId: res.userId,
      });

      if (!isSuperAdmin) {
        if (userType === "zone" && accountType !== "zone") {
          Logger.warn("Login", "Zone login blocked by account type mismatch", {
            accountType,
            userId: res.userId,
          });
          finishAttempt();
          await withLoginTimeout(
            signOutUser(),
            LOGIN_CLEANUP_TIMEOUT_MS,
            "Sign-out cleanup timed out.",
          ).catch((cleanupError) => {
            Logger.warn("Login", "Zone mismatch cleanup failed", cleanupError);
          });
          setEmailServerError("This account is registered as a player account.");
          setModeHelper({
            message: "This email is registered as a Player account. Use Player mode to continue.",
            targetMode: "player",
            cta: "Use Player",
          });
          showToast({
            type: "error",
            title: "Player Account Detected",
            message: "Switch to Player mode and try again.",
          });
          return;
        }

        if (userType === "player" && accountType === "zone") {
          Logger.warn("Login", "Player login blocked by account type mismatch", {
            accountType,
            userId: res.userId,
          });
          finishAttempt();
          await withLoginTimeout(
            signOutUser(),
            LOGIN_CLEANUP_TIMEOUT_MS,
            "Sign-out cleanup timed out.",
          ).catch((cleanupError) => {
            Logger.warn("Login", "Player mismatch cleanup failed", cleanupError);
          });
          setEmailServerError("This account is registered as a zone account.");
          setModeHelper({
            message: "This email is registered as a Zone Admin account. Use Zone Admin mode to continue.",
            targetMode: "zone",
            cta: "Use Zone Admin",
          });
          showToast({
            type: "error",
            title: "Zone Account Detected",
            message: "Switch to Zone Admin mode and try again.",
          });
          return;
        }
      }

      Logger.info("Login", "Sign in succeeded, refreshing session", {
        userId: res.userId,
      });

      setFailedAttempts(0);
      setLockoutSecondsLeft(0);

      // Refresh the auth session to ensure AuthContext is updated
      await refreshSession();
      if (loginAttemptRef.current !== attemptId) return;

      handoffStarted = true;
      setLoading(false);

      showToast({
        type: "success",
        title: "Welcome back",
        message: isSuperAdmin ? "Signed in as Super Admin" : "You're now signed in.",
      });

      // ✅ Redirect based on user type or role
      if (isSuperAdmin) {
        Logger.info("Login", "Redirecting to super admin dashboard", {
          userId: res.userId,
        });
        router.replace(APP_ROUTES.superAdminHome as any);
      } else if (accountType === "zone") {
        Logger.info("Login", "Redirecting to zone dashboard", {
          userId: res.userId,
        });
        router.replace(APP_ROUTES.zoneHome as any);
      } else {
        Logger.info("Login", "Redirecting to player home", {
          userId: res.userId,
        });
        router.replace(APP_ROUTES.playerHome as any);
      }
    } catch (e) {
      Logger.error("Login", "signInWithEmail threw error", e);
      finishAttempt();
      showToast({
        type: "error",
        title: "Sign In Failed",
        message: "Something went wrong. Please try again.",
      });
    } finally {
      clearTimeout(timeout);
      if (!handoffStarted) {
        finishAttempt();
      }
    }
  };

  const handleForgotPassword = () => {
    Logger.info("Login", "Forgot password pressed");
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

  const { canSubmit, showActiveStyle } = getLoginButtonState({
    isIdentifierValid: isEmailValid,
    hasPassword: password.length > 0,
    loading,
    isLockedOut,
  });
  const isSubmitDisabled = !canSubmit;

  // Bottom CTA text + href based on role
  const bottomLabel =
    userType === "zone" ? "Sign up as Admin" : "Create an account";
  const bottomPrefix = userType === "zone" ? "New zone? " : "New here? ";
  const bottomHref =
    userType === "zone" ? "/auth/zone-register" : "/auth/register";

  useEffect(() => {
    Logger.info("Login", "Footer CTA updated", { bottomHref });
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
            onPress={() => handleUserTypeChange("player")}
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
            onPress={() => handleUserTypeChange("zone")}
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

        {modeHelper ? (
          <View style={styles.modeHelperCard}>
            <View style={styles.modeHelperHeader}>
              <View style={styles.modeHelperIcon}>
                <AppIcon name="swap-horiz" size={20} color={COLORS.warning} />
              </View>
              <View style={styles.modeHelperCopy}>
                <Text style={styles.modeHelperTitle}>Wrong login mode</Text>
                <Text style={styles.modeHelperMessage}>{modeHelper.message}</Text>
              </View>
            </View>
            <Pressable
              onPress={() => {
                handleUserTypeChange(modeHelper.targetMode);
              }}
              style={({ pressed }) => [
                styles.modeHelperButton,
                pressed && styles.modeHelperButtonPressed,
              ]}
            >
              <Text style={styles.modeHelperButtonText}>{modeHelper.cta}</Text>
              <AppIcon name="arrow-forward" size={18} color={COLORS.text} />
            </Pressable>
          </View>
        ) : null}

        {recoveryHelper ? (
          <View style={styles.helperTextRow}>
            <Text style={[styles.helperText, styles.helperWarning]}>{recoveryHelper}</Text>
          </View>
        ) : null}

        {/* Email / Phone */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email or Phone</Text>

          <View style={[styles.inputBox]}>
            <View style={styles.inputRow}>
              <AppIcon
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
                testID="login-email-input"
                placeholder="Email or phone"
                placeholderTextColor={COLORS.muted}
                style={[styles.input, { paddingRight: INPUT_PADDING.withIcon }]}
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
                  hideToast();
                  if (emailServerError) setEmailServerError("");
                  if (passwordServerError) setPasswordServerError("");
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
                <AppIcon
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
              <AppIcon
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
                testID="login-password-input"
                placeholder="Password"
                placeholderTextColor={COLORS.muted}
                style={[styles.input, { paddingRight: INPUT_PADDING.withToggle }]}
                selectionColor={COLORS.accent}
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  hideToast();
                  if (passwordServerError) setPasswordServerError("");
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
                <AppIcon
                  name={passwordVisible ? "visibility" : "visibility-off"}
                  size={20}
                  style={styles.suffixIcon}
                  color={COLORS.muted}
                />
              </Pressable>
            </View>
          </View>

          {passwordErrorToShow ? (
            <Text style={styles.errorText}>{passwordErrorToShow}</Text>
          ) : null}


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
            testID="login-submit-button"
            onPress={handleLogin}
            disabled={isSubmitDisabled}
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: showActiveStyle ? COLORS.accent : COLORS.disabled,
              },
              pressed && !isSubmitDisabled && { opacity: 0.92 },
            ]}
            android_ripple={{ color: "rgba(255,255,255,0.12)" }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.primaryBtnText, isSubmitDisabled && styles.primaryBtnTextDisabled]}>Login</Text>
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
