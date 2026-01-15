// app/auth/zone-register.tsx
import { MaterialIcons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
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
import {
  isEmailAvailable,
  isPhoneAvailable,
} from "../../src/services/userService";
import { useZoneOnboardingStore } from "../../src/store/zoneOnboardingStore";
import { COLORS } from "../../src/theme";
import styles from "./register.styles";

type FocusField =
  | "owner"
  | "brand"
  | "email"
  | "phone"
  | "password"
  | null;

type AvailabilityStatus = "idle" | "checking" | "available" | "taken" | "error";

// 📱 Pakistani phone formatter (same as login / user register)
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

export default function AdminRegisterStep1() {
  const { step1, setStep1, setCurrentStep } = useZoneOnboardingStore();
  const { showToast } = useToast();

  const [ownerFullName, setOwnerFullName] = useState(step1.ownerFullName);
  const [venueBrandName, setVenueBrandName] = useState(step1.venueBrandName);
  const [contactEmail, setContactEmail] = useState(step1.contactEmail);
  const [contactPhone, setContactPhone] = useState(step1.contactPhone);
  const [password, setPassword] = useState(step1.password);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const [focused, setFocused] = useState<FocusField>(null);
  const [submitting, setSubmitting] = useState(false);

  const [emailStatus, setEmailStatus] = useState<AvailabilityStatus>("idle");
  const [phoneStatus, setPhoneStatus] = useState<AvailabilityStatus>("idle");

  const ownerRef = useRef<TextInput | null>(null);
  const brandRef = useRef<TextInput | null>(null);
  const emailRef = useRef<TextInput | null>(null);
  const phoneRef = useRef<TextInput | null>(null);
  const passRef = useRef<TextInput | null>(null);

  // ---------- Validation + password rules (mirrors player register) ----------
  const {
    isNameValid,
    isBrandValid,
    isEmailValid,
    isPhoneFormatValid,
    isPasswordValid,
    hasUpper,
    hasLower,
    hasNumber,
    hasSpecial,
    isLengthValid,
    strengthLabel,
    strengthColor,
    strengthWidth,
  } = useMemo(() => {
    // Owner name + brand
    const nameValid = ownerFullName.trim().length >= 3;
    const brandValid = venueBrandName.trim().length >= 3;

    // Email
    const emailTrimmed = contactEmail.trim();
    const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
    const emailValid = emailRegex.test(emailTrimmed);

    // Phone
    const phoneTrimmed = contactPhone.trim();
    const normalizedPhone = phoneTrimmed.replace(/\s|-/g, "");
    const phoneRegex = /^(\+92|92|0)?3[0-9]{9}$/;
    const phoneFormatValid = phoneRegex.test(normalizedPhone);

    // Password rules – same as user registration
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
        strengthClr = COLORS.success;
        strengthPct = 75;
      } else {
        strengthLbl = "Very strong";
        strengthClr = COLORS.success;
        strengthPct = 100;
      }
    }

    const passwordValid =
      hasUpperRule &&
      hasLowerRule &&
      hasNumberRule &&
      hasSpecialRule &&
      lengthOkRule;

    return {
      isNameValid: nameValid,
      isBrandValid: brandValid,
      isEmailValid: emailValid,
      isPhoneFormatValid: phoneFormatValid,
      isPasswordValid: passwordValid,

      hasUpper: hasUpperRule,
      hasLower: hasLowerRule,
      hasNumber: hasNumberRule,
      hasSpecial: hasSpecialRule,
      isLengthValid: lengthOkRule,

      strengthLabel: strengthLbl,
      strengthColor: strengthClr,
      strengthWidth: strengthPct,
    };
  }, [ownerFullName, venueBrandName, contactEmail, contactPhone, password]);

  const isFormValid = useMemo(() => {
    const emailOk =
      isEmailValid && (emailStatus === "idle" || emailStatus === "available");
    const phoneOk =
      isPhoneFormatValid &&
      (phoneStatus === "idle" || phoneStatus === "available");

    return (
      isNameValid &&
      isBrandValid &&
      emailOk &&
      phoneOk &&
      isPasswordValid
    );
  }, [
    isNameValid,
    isBrandValid,
    isEmailValid,
    emailStatus,
    isPhoneFormatValid,
    phoneStatus,
    isPasswordValid,
  ]);

  // Same logic as player: show requirements until all 4 char rules are met
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

  // ---------- Handlers ----------
  const handlePhoneChange = (value: string) => {
    let next = value;
    if (/^[\d+\s-]*$/.test(value)) {
      next = formatPakistaniPhone(value);
    }
    setContactPhone(next);
    if (phoneStatus !== "idle") setPhoneStatus("idle");
  };

  const handleEmailBlur = async () => {
    const trimmed = contactEmail.trim();
    if (!trimmed || !isEmailValid) {
      setEmailStatus("idle");
      return;
    }

    try {
      setEmailStatus("checking");
      const available = await isEmailAvailable(trimmed);
      setEmailStatus(available ? "available" : "taken");
    } catch {
      setEmailStatus("error");
    }
  };

  const handlePhoneBlur = async () => {
    const phoneTrimmed = contactPhone.trim();
    const normalizedPhone = phoneTrimmed.replace(/\s|-/g, "");
    if (!normalizedPhone || !isPhoneFormatValid) {
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

  const renderAvailabilityHelper = (
    status: AvailabilityStatus,
    type: "email" | "phone"
  ) => {
    if (status === "idle") return null;

    let text = "";
    const style: any[] = [styles.helperText];

    if (status === "checking") {
      text = type === "email" ? "Checking email…" : "Checking number…";
      style.push(styles.helperWarning);
    } else if (status === "available") {
      text =
        type === "email"
          ? "Looks good! Email is available."
          : "Looks good! Number is available.";
      style.push(styles.helperOk);
    } else if (status === "taken") {
      text =
        type === "email"
          ? "This email is already in use."
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

  const handleContinue = () => {
    if (!isFormValid) {
      showToast({
        type: "info",
        title: "Check details",
        message:
          "Please fill in your name, venue name, contact email/phone and a strong password.",
      });
      return;
    }

    setSubmitting(true);

    setStep1({
      ownerFullName: ownerFullName.trim(),
      venueBrandName: venueBrandName.trim(),
      contactEmail: contactEmail.trim(),
      contactPhone: contactPhone.trim(),
      password,
      // type is already in step1 from store or default
    });

    setCurrentStep(1); // mark we finished step 1
    setSubmitting(false);
    router.push("/auth/zone-register-step2");
  };

  const isSubmitDisabled = !isFormValid || submitting;

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
              <Text style={styles.stepperTitle}>Create Admin Account</Text>
              <Text style={styles.stepperSubtitle}>
                Step 1 of 4 · Admin details
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
        <Text style={styles.heading}>Admin basics</Text>
        <Text style={styles.sub}>
          Tell us who runs this zone and how we can contact you. We’ll use this
          for payouts and support.
        </Text>

        {/* Business Type Selection */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Business Type</Text>
          <View style={styles.chipRow}>
            {[
              { label: 'Zone', value: 'gaming' },
              { label: 'Court', value: 'sports' },
              { label: 'Both', value: 'hybrid' }
            ].map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setStep1({ ...step1, type: option.value as any })}
                style={({ pressed }) => [
                  styles.optionChip,
                  step1.type === option.value && styles.optionChipActive,
                  pressed && { opacity: 0.9 },
                  { flex: 1, alignItems: 'center', justifyContent: 'center' }
                ]}
              >
                <Text style={[
                  styles.optionChipText,
                  step1.type === option.value && styles.optionChipTextActive,
                ]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Owner full name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Owner / primary contact</Text>
          <View style={styles.inputBox}>
            <View style={styles.inputRow}>
              <MaterialIcons
                name="person"
                size={20}
                style={styles.prefixIcon}
                color={
                  isNameValid && ownerFullName.trim().length > 0
                    ? COLORS.accent
                    : COLORS.muted
                }
              />
              <TextInput
                ref={ownerRef}
                placeholder="Full name"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                selectionColor={COLORS.accent}
                autoCapitalize="words"
                autoCorrect={false}
                value={ownerFullName}
                onChangeText={setOwnerFullName}
                onFocus={() => setFocused("owner")}
                onBlur={() => setFocused(null)}
                returnKeyType="next"
                onSubmitEditing={() => brandRef.current?.focus()}
              />
            </View>
            <View
              style={[
                styles.focusBar,
                { opacity: focused === "owner" ? 1 : 0 },
              ]}
            />
          </View>
        </View>

        {/* Venue brand name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Zone / brand name</Text>
          <View style={styles.inputBox}>
            <View style={styles.inputRow}>
              <MaterialIcons
                name="sports-esports"
                size={20}
                style={styles.prefixIcon}
                color={
                  isBrandValid && venueBrandName.trim().length > 0
                    ? COLORS.accent
                    : COLORS.muted
                }
              />
              <TextInput
                ref={brandRef}
                placeholder="e.g. O2 Esports Gaming Arena"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                selectionColor={COLORS.accent}
                autoCapitalize="words"
                autoCorrect={false}
                value={venueBrandName}
                onChangeText={setVenueBrandName}
                onFocus={() => setFocused("brand")}
                onBlur={() => setFocused(null)}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            </View>
            <View
              style={[
                styles.focusBar,
                { opacity: focused === "brand" ? 1 : 0 },
              ]}
            />
          </View>
        </View>

        {/* Contact email */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Contact email</Text>
          <View style={styles.inputBox}>
            <View style={styles.inputRow}>
              <MaterialIcons
                name="email"
                size={20}
                style={styles.prefixIcon}
                color={
                  isEmailValid && contactEmail.trim().length > 0
                    ? COLORS.accent
                    : COLORS.muted
                }
              />
              <TextInput
                ref={emailRef}
                placeholder="owner@youresportszone.com"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                selectionColor={COLORS.accent}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={contactEmail}
                onChangeText={(val) => {
                  setContactEmail(val);
                  if (emailStatus !== "idle") setEmailStatus("idle");
                }}
                onFocus={() => setFocused("email")}
                onBlur={() => {
                  setFocused(null);
                  handleEmailBlur();
                }}
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
              />
              {contactEmail.trim().length > 0 && (
                <MaterialIcons
                  name={
                    emailStatus === "checking"
                      ? "hourglass-top"
                      : emailStatus === "available"
                        ? "check-circle"
                        : emailStatus === "taken"
                          ? "error-outline"
                          : isEmailValid
                            ? "check-circle"
                            : "error-outline"
                  }
                  size={18}
                  style={styles.suffixIcon}
                  color={
                    emailStatus === "taken"
                      ? COLORS.error
                      : emailStatus === "available" || isEmailValid
                        ? COLORS.success
                        : COLORS.muted
                  }
                />
              )}
            </View>
            <View
              style={[
                styles.focusBar,
                { opacity: focused === "email" ? 1 : 0 },
              ]}
            />
          </View>
          {renderAvailabilityHelper(emailStatus, "email")}
          {!!contactEmail && !isEmailValid && emailStatus === "idle" && (
            <Text style={styles.errorText}>
              Enter a valid email address.
            </Text>
          )}
        </View>

        {/* Contact phone */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Contact phone / WhatsApp</Text>
          <View style={styles.inputBox}>
            <View style={styles.inputRow}>
              <MaterialIcons
                name="phone-android"
                size={20}
                style={styles.prefixIcon}
                color={
                  isPhoneFormatValid && contactPhone.trim().length > 0
                    ? COLORS.accent
                    : COLORS.muted
                }
              />
              <TextInput
                ref={phoneRef}
                placeholder="+92 3XX XXX XXXX"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                selectionColor={COLORS.accent}
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
                value={contactPhone}
                onChangeText={handlePhoneChange}
                onFocus={() => setFocused("phone")}
                onBlur={() => {
                  setFocused(null);
                  handlePhoneBlur();
                }}
                returnKeyType="next"
                onSubmitEditing={() => passRef.current?.focus()}
              />
              {contactPhone.trim().length > 0 && (
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
          {!!contactPhone && !isPhoneFormatValid && phoneStatus === "idle" && (
            <Text style={styles.errorText}>
              Enter a valid Pakistani phone number.
            </Text>
          )}
        </View>

        {/* Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password for zone admin login</Text>
          <View style={styles.inputBox}>
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
                ref={passRef}
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

          {/* Strength meter ABOVE requirements (same as player) */}
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

          {/* Password requirements — only if NOT all char rules met */}
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

        {/* Continue button */}
        <View
          style={[
            styles.buttonShadowWrapper,
            isFormValid && !submitting && styles.buttonShadowWrapperActive,
          ]}
        >
          <Pressable
            onPress={handleContinue}
            disabled={isSubmitDisabled}
            style={({ pressed }) => [
              styles.primaryBtn,
              isSubmitDisabled && styles.primaryBtnDisabled,
              pressed && !isSubmitDisabled && { opacity: 0.92 },
            ]}
            android_ripple={{ color: "rgba(255,255,255,0.08)" }}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <Text style={styles.primaryBtnText}>Continue</Text>
            )}
          </Pressable>
        </View>

        {/* Safety link back to login */}
        <Text style={styles.bottomText}>
          Already manage a zone?{" "}
          <Link href="/auth/login" style={{ color: COLORS.accent }}>
            Sign in
          </Link>
        </Text>
      </ScrollView>
    </Container>
  );
}
