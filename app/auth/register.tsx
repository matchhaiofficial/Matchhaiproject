// app/auth/register.tsx
import { MaterialIcons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
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
import {
  isPhoneAvailable,
  isUsernameAvailable,
} from "../../src/services/userService";
import { useOnboardingStore } from "../../src/store/onboardingStore";
import { COLORS } from "../../src/theme";
import styles from "./register.styles";

type FocusField =
  | "fullName"
  | "username"
  | "email"
  | "phone"
  | "password"
  | null;
type AvailabilityStatus = "idle" | "checking" | "available" | "taken" | "error";

// 📱 Pakistani phone formatter (same as login)
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

export default function Register() {
  const { step1, setStep1 } = useOnboardingStore();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState(step1.fullName);
  const [username, setUsername] = useState(step1.username);

  // store only the local part in state, derive from existing email
  const [email, setEmail] = useState(() => {
    const e = (step1.email || "").trim();
    if (!e) return "";
    const gmailSuffix = "@gmail.com";
    if (e.toLowerCase().endsWith(gmailSuffix)) {
      return e.slice(0, -gmailSuffix.length);
    }
    const atIndex = e.indexOf("@");
    if (atIndex > 0) return e.slice(0, atIndex);
    return e;
  });

  const [phone, setPhone] = useState(step1.phone);
  const [password, setPassword] = useState(step1.password);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const [focused, setFocused] = useState<FocusField>(null);

  const [usernameStatus, setUsernameStatus] =
    useState<AvailabilityStatus>("idle");
  const [phoneStatus, setPhoneStatus] = useState<AvailabilityStatus>("idle");

  // when we hydrate, if fields already have values, show "available" by default
  useEffect(() => {
    if (step1.username) setUsernameStatus("available");
    if (step1.phone) setPhoneStatus("available");
  }, [step1.username, step1.phone]);

  // ---------- Validation + password rules ----------
  const {
    isFullNameValid,
    isUsernameFormatValid,
    isEmailValid,
    isPhoneFormatValid,
    isPasswordValid,
    isFormValid,
    hasUpper,
    hasLower,
    hasNumber,
    hasSpecial,
    isLengthValid,
    strengthLabel,
    strengthColor,
    strengthWidth,
  } = useMemo(() => {
    const nameValid = fullName.trim().length >= 3;

    const usernameTrimmed = username.trim();
    const usernameFormatValid = /^[a-zA-Z0-9_]{3,20}$/.test(usernameTrimmed);

    // email: local part + @gmail.com
    const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
    const localPart = email.trim();
    const fullEmail = localPart.length > 0 ? `${localPart}@gmail.com` : "";
    const emailValid = emailRegex.test(fullEmail);

    // ---- Phone validation (same as Login) ----
    const phoneTrimmed = phone.trim();
    const normalizedPhone = phoneTrimmed.replace(/\s|-/g, "");
    const phoneRegex = /^(\+92|92|0)?3[0-9]{9}$/;
    const phoneFormatValid = phoneRegex.test(normalizedPhone);

    // --- password rules ---
    const hasUpperRule = /[A-Z]/.test(password);
    const hasLowerRule = /[a-z]/.test(password);
    const hasNumberRule = /[0-9]/.test(password);
    const hasSpecialRule = /[^A-Za-z0-9]/.test(password);
    const lengthOkRule = password.length >= 8;

    const rulesMet = [
      hasUpperRule,
      hasLowerRule,
      hasNumberRule,
      hasSpecialRule,
      lengthOkRule,
    ].filter(Boolean).length;

    let strengthLbl: string | null = null;
    let strengthClr = COLORS.muted;
    let strengthPct = 0;

    if (password.length > 0) {
      if (rulesMet <= 2) {
        strengthLbl = "Weak";
        strengthClr = "#ef5350";
        strengthPct = 25;
      } else if (rulesMet === 3) {
        strengthLbl = "Fair";
        strengthClr = "#ffb74d";
        strengthPct = 50;
      } else if (rulesMet === 4) {
        strengthLbl = "Strong";
        strengthClr = COLORS.success; // ✅ system green
        strengthPct = 75;
      } else {
        strengthLbl = "Very strong";
        strengthClr = COLORS.success; // same green for max
        strengthPct = 100;
      }
    }

    const passwordValid =
      hasUpperRule &&
      hasLowerRule &&
      hasNumberRule &&
      hasSpecialRule &&
      lengthOkRule;

    const usernameOk =
      usernameFormatValid &&
      (usernameStatus === "idle" || usernameStatus === "available");

    const phoneOk =
      phoneFormatValid &&
      (phoneStatus === "idle" || phoneStatus === "available");

    return {
      isFullNameValid: nameValid,
      isUsernameFormatValid: usernameFormatValid,
      isEmailValid: emailValid,
      isPhoneFormatValid: phoneFormatValid,
      isPasswordValid: passwordValid,
      isFormValid:
        nameValid && usernameOk && emailValid && phoneOk && passwordValid,

      // password rule flags for UI
      hasUpper: hasUpperRule,
      hasLower: hasLowerRule,
      hasNumber: hasNumberRule,
      hasSpecial: hasSpecialRule,
      isLengthValid: lengthOkRule,

      strengthLabel: strengthLbl,
      strengthColor: strengthClr,
      strengthWidth: strengthPct,
    };
  }, [
    fullName,
    username,
    email,
    phone,
    password,
    usernameStatus,
    phoneStatus,
  ]);

  // Derived flag: all 4 visible requirements satisfied?
  const allCharRequirementsMet =
    hasUpper && hasLower && hasNumber && hasSpecial;
  const showRequirements =
    password.length > 0 && !allCharRequirementsMet;

  // ---------- Keyboard handling ----------
  const Container: any = Platform.OS === "ios" ? KeyboardAvoidingView : View;
  const containerProps =
    Platform.OS === "ios"
      ? {
          style: styles.screen,
          behavior: "padding" as const,
          keyboardVerticalOffset: 0,
        }
      : { style: styles.screen };

  // ---------- Availability checks ----------
  const handleUsernameBlur = async () => {
    const trimmed = username.trim();
    if (!trimmed || !isUsernameFormatValid) {
      setUsernameStatus("idle");
      return;
    }

    try {
      setUsernameStatus("checking");
      const available = await isUsernameAvailable(trimmed);
      setUsernameStatus(available ? "available" : "taken");
    } catch {
      setUsernameStatus("error");
    }
  };

  const handlePhoneBlur = async () => {
    const phoneTrimmed = phone.trim();
    const normalizedPhone = phoneTrimmed.replace(/\s|-/g, "");
    const phoneRegex = /^(\+92|92|0)?3[0-9]{9}$/;

    if (!normalizedPhone || !phoneRegex.test(normalizedPhone)) {
      setPhoneStatus("idle");
      return;
    }

    try {
      setPhoneStatus("checking");
      const available = await isPhoneAvailable(normalizedPhone);
      setPhoneStatus(available ? "available" : "taken");
    } catch {
      setPhoneStatus("error");
    }
  };

  // reset availability when typing
  const handleUsernameChange = (value: string) => {
    setUsername(value);
    if (usernameStatus !== "idle") setUsernameStatus("idle");
  };

  // Email local-part change: only allow letters, numbers, and simple symbols
  const handleEmailChange = (value: string) => {
    const cleaned = value.replace(/[^a-zA-Z0-9._%+-]/g, "");
    setEmail(cleaned);
  };

  // Phone: mimic Login’s format logic
  const handlePhoneChange = (value: string) => {
    let next = value;
    if (/^[\d+\s-]*$/.test(value)) {
      next = formatPakistaniPhone(value);
    }
    setPhone(next);
    if (phoneStatus !== "idle") setPhoneStatus("idle");
  };

  // ---------- Submit (LOCAL ONLY) ----------
  const handleNext = () => {
    if (!isFormValid) {
      showToast({
        type: "info",
        title: "Check details",
        message: "Please complete all fields correctly before continuing.",
      });
      return;
    }

    const localPart = email.trim();
    const fullEmail = localPart.length > 0 ? `${localPart}@gmail.com` : "";

    setStep1({
      fullName: fullName.trim(),
      username: username.trim(),
      email: fullEmail,
      phone,
      password,
    });

    router.push("/auth/register-step2");
  };

  // ---------- Helper: availability helper text ----------
  const renderAvailabilityHelper = (
    status: AvailabilityStatus,
    type: "username" | "phone"
  ) => {
    if (status === "idle") return null;

    let text = "";
    const style: any[] = [styles.helperText];

    if (status === "checking") {
      text = type === "username" ? "Checking username…" : "Checking number…";
      style.push(styles.helperWarning);
    } else if (status === "available") {
      text =
        type === "username"
          ? "Looks good! Username is available."
          : "Looks good! Number is available.";
      style.push(styles.helperOk);
    } else if (status === "taken") {
      text =
        type === "username"
          ? "This username is already taken."
          : "This phone number is already in use.";
      style.push(styles.helperError);
    } else {
      text = "Could not verify right now. Please try again.";
      style.push(styles.helperWarning);
    }

    return (
      <View style={styles.helperTextRow}>
        <Text style={style as any}>{text}</Text>
      </View>
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

        {/* Stepper */}
        <View style={styles.stepperWrapper}>
          <View style={styles.stepperTopRow}>
            <View>
              <Text style={styles.stepperTitle}>Create your account</Text>
              <Text style={styles.stepperSubtitle}>
                Step 1 of 4 · Account details
              </Text>
            </View>
          </View>
          <View style={styles.stepperBar}>
            <View style={[styles.stepperBarFill, { width: "25%" }]} />
          </View>
          <View style={styles.stepperDotsRow}>
            <View style={[styles.stepperDot, styles.stepperDotActive]} />
            <View style={styles.stepperDot} />
            <View style={styles.stepperDot} />
            <View style={styles.stepperDot} />
          </View>
        </View>

        {/* Headings */}
        <Text style={styles.heading}>Let’s get started</Text>
        <Text style={styles.sub}>
          Fill in your basic info to create your MatchHai profile.
        </Text>

        {/* Full Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Full Name</Text>
          <View style={[styles.inputBox]}>
            <View style={styles.inputRow}>
              <MaterialIcons
                name="person"
                size={20}
                style={styles.prefixIcon}
                color={
                  isFullNameValid && fullName.trim().length > 0
                    ? COLORS.accent
                    : COLORS.muted
                }
              />
              <TextInput
                placeholder="Enter your full name"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                selectionColor={COLORS.accent}
                value={fullName}
                onChangeText={setFullName}
                onFocus={() => setFocused("fullName")}
                onBlur={() => setFocused(null)}
              />
            </View>
            <View
              style={[
                styles.focusBar,
                { opacity: focused === "fullName" ? 1 : 0 },
              ]}
            />
          </View>
        </View>

        {/* Username */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Username</Text>
          <View style={[styles.inputBox]}>
            <View style={styles.inputRow}>
              <MaterialIcons
                name="alternate-email"
                size={20}
                style={styles.prefixIcon}
                color={
                  isUsernameFormatValid && username.trim().length > 0
                    ? COLORS.accent
                    : COLORS.muted
                }
              />
              <TextInput
                placeholder="Choose a unique username"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                selectionColor={COLORS.accent}
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={handleUsernameChange}
                onFocus={() => setFocused("username")}
                onBlur={() => {
                  setFocused(null);
                  handleUsernameBlur();
                }}
              />
              {username.trim().length > 0 && (
                <MaterialIcons
                  name={
                    usernameStatus === "checking"
                      ? "hourglass-top"
                      : usernameStatus === "available"
                      ? "check-circle"
                      : usernameStatus === "taken"
                      ? "error-outline"
                      : isUsernameFormatValid
                      ? "check-circle"
                      : "error-outline"
                  }
                  size={18}
                  style={styles.suffixIcon}
                  color={
                    usernameStatus === "taken"
                      ? COLORS.error
                      : usernameStatus === "available" || isUsernameFormatValid
                      ? COLORS.success
                      : COLORS.muted
                  }
                />
              )}
            </View>
            <View
              style={[
                styles.focusBar,
                { opacity: focused === "username" ? 1 : 0 },
              ]}
            />
          </View>
          {renderAvailabilityHelper(usernameStatus, "username")}
        </View>

        {/* Email Address */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email Address</Text>
          <View style={[styles.inputBox]}>
            <View style={styles.inputRow}>
              <MaterialIcons
                name="email"
                size={20}
                style={styles.prefixIcon}
                color={
                  isEmailValid && email.trim().length > 0
                    ? COLORS.accent
                    : COLORS.muted
                }
              />
              <TextInput
                placeholder="yourname"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                selectionColor={COLORS.accent}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={handleEmailChange}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
              />
              <Text style={styles.emailSuffix}>@gmail.com</Text>
            </View>
            <View
              style={[
                styles.focusBar,
                { opacity: focused === "email" ? 1 : 0 },
              ]}
            />
          </View>
        </View>

        {/* Phone Number */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={[styles.inputBox]}>
            <View style={styles.inputRow}>
              <MaterialIcons
                name="phone-android"
                size={20}
                style={styles.prefixIcon}
                color={
                  isPhoneFormatValid && phone.trim().length > 0
                    ? COLORS.accent
                    : COLORS.muted
                }
              />
              <TextInput
                placeholder="03XX XXX XXXX"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                selectionColor={COLORS.accent}
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
                value={phone}
                onChangeText={handlePhoneChange}
                onFocus={() => setFocused("phone")}
                onBlur={() => {
                  setFocused(null);
                  handlePhoneBlur();
                }}
              />
              {phone.trim().length > 0 && (
                <MaterialIcons
                  name={
                    phoneStatus === "checking"
                      ? "hourglass-top"
                      : phoneStatus === "available"
                      ? "check-circle"
                      : phoneStatus === "taken"
                      ? "error-outline"
                      : isPhoneFormatValid
                      ? "check-circle"
                      : "error-outline"
                  }
                  size={18}
                  style={styles.suffixIcon}
                  color={
                    phoneStatus === "taken"
                      ? COLORS.error
                      : phoneStatus === "available" || isPhoneFormatValid
                      ? COLORS.success
                      : COLORS.muted
                  }
                />
              )}
            </View>
            <View
              style={[
                styles.focusBar,
                { opacity: focused === "phone" ? 1 : 0 },
              ]}
            />
          </View>
          {renderAvailabilityHelper(phoneStatus, "phone")}
        </View>

        {/* Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={[styles.inputBox]}>
            <View style={styles.inputRow}>
              <MaterialIcons
                name="lock"
                size={20}
                style={styles.prefixIcon}
                color={
                  isPasswordValid && password.length > 0
                    ? COLORS.accent
                    : COLORS.muted
                }
              />
              <TextInput
                placeholder="Create a strong password"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                selectionColor={COLORS.accent}
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
              />
              <Pressable
                onPress={() => setPasswordVisible((v) => !v)}
                hitSlop={10}
              >
                <MaterialIcons
                  name={passwordVisible ? "visibility" : "visibility-off"}
                  size={18}
                  style={styles.suffixIcon}
                  color={COLORS.muted}
                />
              </Pressable>
            </View>
            <View
              style={[
                styles.focusBar,
                { opacity: focused === "password" ? 1 : 0 },
              ]}
            />
          </View>

          {/* Strength meter ABOVE requirements */}
          {password.length > 0 && (
            <View style={styles.passwordStrengthWrapper}>
              <View style={styles.strengthMeterTrack}>
                <View
                  style={[
                    styles.strengthMeterFill,
                    {
                      width: `${strengthWidth}%`,
                      backgroundColor: strengthColor,
                    } as any,
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

          {/* Password requirements — only if NOT all met */}
          {showRequirements && (
            <View style={styles.passwordRequirementsRow}>
              <View style={styles.requirementColumn}>
                <Text
                  style={[
                    styles.passwordRequirementText,
                    hasUpper && styles.passwordRequirementTextDone,
                  ]}
                >
                  {hasUpper ? "✓" : "×"} 1 uppercase character
                </Text>
                <Text
                  style={[
                    styles.passwordRequirementText,
                    hasLower && styles.passwordRequirementTextDone,
                  ]}
                >
                  {hasLower ? "✓" : "×"} 1 lowercase character
                </Text>
              </View>
              <View style={styles.requirementColumn}>
                <Text
                  style={[
                    styles.passwordRequirementText,
                    hasNumber && styles.passwordRequirementTextDone,
                  ]}
                >
                  {hasNumber ? "✓" : "×"} 1 numeric character
                </Text>
                <Text
                  style={[
                    styles.passwordRequirementText,
                    hasSpecial && styles.passwordRequirementTextDone,
                  ]}
                >
                  {hasSpecial ? "✓" : "×"} 1 special character
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Primary button */}
        <View style={[styles.buttonShadowWrapper]}>
          <Pressable
            onPress={handleNext}
            disabled={!isFormValid}
            style={({ pressed }) => [
              styles.primaryBtn,
              !isFormValid ? styles.primaryBtnDisabled : null,
              pressed && isFormValid && { opacity: 0.92 },
            ]}
            android_ripple={{ color: "rgba(255,255,255,0.08)" }}
          >
            <Text style={styles.primaryBtnText}>Continue</Text>
          </Pressable>
        </View>

        {/* Bottom link */}
        <Text style={styles.bottomText}>
          Already have an account?{" "}
          <Link href="/auth/login" style={{ color: COLORS.accent }}>
            Sign In
          </Link>
        </Text>
      </ScrollView>
    </Container>
  );
}
