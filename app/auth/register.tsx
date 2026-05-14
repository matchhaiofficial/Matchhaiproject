import { Link, router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { AGE_RANGES, DEFAULT_CITY } from "../../constants/profileOptions";
import RegistrationFieldLabel from "./components/RegistrationFieldLabel";
import RegistrationStepHeader from "./components/RegistrationStepHeader";
import { AppIcon } from "../../src/components/AppIcon";
import { AppButton } from "../../src/components/AppPrimitives";
import { CustomSingleSelect } from "../../src/components/CustomSingleSelect";
import Screen from "../../src/components/Screen";
import { useToast } from "../../src/hooks/useToast";
import {
  isEmailAvailable,
  isPhoneAvailable,
  isUsernameAvailable,
} from "../../src/services/convex/userService";
import {
  sendPhoneOtp,
  verifyPhoneOtp,
} from "../../src/services/convex/phoneOtpService";
import { useOnboardingStore } from "../../src/store/onboardingStore";
import { COLORS, INPUT_PADDING } from "../../src/theme";
import {
  formatPakistaniPhone,
  isValidPakistaniPhone,
  normalizePakistaniPhone,
} from "../../src/utils/phoneUtils";
import { Perf, PerfScope } from "../../src/utils/perfInstrumentation";
import styles from "./register.styles";

type FocusField =
  | "fullName"
  | "username"
  | "email"
  | "phone"
  | "password"
  | null;
type AvailabilityStatus = "idle" | "checking" | "available" | "taken" | "error";

export default function Register() {
  const { step1, setStep1, setCurrentStep } = useOnboardingStore();
  const { showToast } = useToast();
  const skipPhoneOtp = __DEV__ && process.env.EXPO_PUBLIC_SKIP_PHONE_OTP === "1";

  const [fullName, setFullName] = useState(step1.fullName);
  const [username, setUsername] = useState(step1.username);
  const [ageRange, setAgeRange] = useState(step1.ageRange || AGE_RANGES[1]);
  const [email, setEmail] = useState(step1.email || "");
  const [phone, setPhone] = useState(step1.phone);
  const [password, setPassword] = useState(step1.password);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [focused, setFocused] = useState<FocusField>(null);
  const [usernameStatus, setUsernameStatus] = useState<AvailabilityStatus>("idle");
  const [phoneStatus, setPhoneStatus] = useState<AvailabilityStatus>("idle");
  const [emailStatus, setEmailStatus] = useState<AvailabilityStatus>("idle");
  const [otpCode, setOtpCode] = useState("");
  const [otpVisible, setOtpVisible] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [latestRequestIds, setLatestRequestIds] = useState({
    username: 0,
    email: 0,
    phone: 0,
  });

  useEffect(() => {
    setCurrentStep(1);
  }, [setCurrentStep]);

  useEffect(() => {
    if (step1.username) setUsernameStatus("available");
    if (step1.phone) setPhoneStatus("available");
    if (step1.email) setEmailStatus("available");
  }, [step1.username, step1.phone, step1.email]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const { phoneE164: currentPhoneE164 } = normalizePakistaniPhone(phone);
  const phoneVerified =
    Boolean(step1.phoneVerified) &&
    Boolean(currentPhoneE164) &&
    step1.phoneVerifiedE164 === currentPhoneE164;
  const effectivePhoneVerified = phoneVerified || skipPhoneOtp;

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
    hasMinLength,
    strengthLabel,
    strengthColor,
    strengthWidth,
  } = useMemo(() => {
    const nameValid = fullName.trim().length >= 3;
    const cityValid = DEFAULT_CITY.length > 0;
    const ageValid = ageRange.length > 0;
    const usernameTrimmed = username.trim();
    const usernameFormatValid = /^[a-zA-Z0-9_]{3,20}$/.test(usernameTrimmed);
    const emailTrimmed = email.trim();
    const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
    const emailValid = emailRegex.test(emailTrimmed);
    const phoneFormatValid = isValidPakistaniPhone(phone);

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

    let nextStrengthLabel: string | null = null;
    let nextStrengthColor = COLORS.muted;
    let nextStrengthWidth = 0;

    if (password.length > 0) {
      if (rulesMet <= 2 || !lengthOkRule) {
        nextStrengthLabel = "Weak";
        nextStrengthColor = COLORS.error;
        nextStrengthWidth = 25;
      } else if (rulesMet === 3) {
        nextStrengthLabel = "Fair";
        nextStrengthColor = "#ffb74d";
        nextStrengthWidth = 50;
      } else if (rulesMet === 4) {
        nextStrengthLabel = "Strong";
        nextStrengthColor = COLORS.success;
        nextStrengthWidth = 75;
      } else {
        nextStrengthLabel = "Very strong";
        nextStrengthColor = COLORS.success;
        nextStrengthWidth = 100;
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
      phoneStatus === "available" &&
      effectivePhoneVerified;
    const emailOk =
      emailValid && (emailStatus === "idle" || emailStatus === "available");

    return {
      isFullNameValid: nameValid,
      isUsernameFormatValid: usernameFormatValid,
      isEmailValid: emailValid,
      isPhoneFormatValid: phoneFormatValid,
      isPasswordValid: passwordValid,
      isFormValid:
        nameValid &&
        usernameOk &&
        emailOk &&
        phoneOk &&
        passwordValid &&
        cityValid &&
        ageValid,
      hasUpper: hasUpperRule,
      hasLower: hasLowerRule,
      hasNumber: hasNumberRule,
      hasSpecial: hasSpecialRule,
      hasMinLength: lengthOkRule,
      strengthLabel: nextStrengthLabel,
      strengthColor: nextStrengthColor,
      strengthWidth: nextStrengthWidth,
    };
  }, [
    ageRange,
    email,
    emailStatus,
    fullName,
    password,
    phone,
    phoneVerified,
    phoneStatus,
    username,
    usernameStatus,
  ]);

  const showRequirements =
    password.length > 0 &&
    !(hasUpper && hasLower && hasNumber && hasSpecial && hasMinLength);

  const checkUsername = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || !/^[a-zA-Z0-9_]{3,20}$/.test(trimmed)) {
      setUsernameStatus("idle");
      return;
    }

    const requestId = Date.now();
    setLatestRequestIds((prev) => ({ ...prev, username: requestId }));
    setUsernameStatus("checking");

    try {
      const available = await isUsernameAvailable(trimmed);
      setLatestRequestIds((current) => {
        if (current.username === requestId) {
          setUsernameStatus(available ? "available" : "taken");
        }
        return current;
      });
    } catch {
      setLatestRequestIds((current) => {
        if (current.username === requestId) {
          setUsernameStatus("error");
        }
        return current;
      });
    }
  };

  const checkEmail = async (value: string) => {
    const trimmed = value.trim();
    const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
    if (!trimmed || !emailRegex.test(trimmed)) {
      setEmailStatus("idle");
      return;
    }

    const requestId = Date.now();
    setLatestRequestIds((prev) => ({ ...prev, email: requestId }));
    setEmailStatus("checking");

    try {
      const available = await isEmailAvailable(trimmed);
      setLatestRequestIds((current) => {
        if (current.email === requestId) {
          setEmailStatus(available ? "available" : "taken");
        }
        return current;
      });
    } catch {
      setLatestRequestIds((current) => {
        if (current.email === requestId) {
          setEmailStatus("error");
        }
        return current;
      });
    }
  };

  const checkPhone = async (value: string) => {
    const { phoneDigits } = normalizePakistaniPhone(value);
    if (!phoneDigits || !isValidPakistaniPhone(value)) {
      setPhoneStatus("idle");
      return;
    }

    const requestId = Date.now();
    setLatestRequestIds((prev) => ({ ...prev, phone: requestId }));
    setPhoneStatus("checking");

    try {
      const available = await isPhoneAvailable(phoneDigits);
      setLatestRequestIds((current) => {
        if (current.phone === requestId) {
          setPhoneStatus(available ? "available" : "taken");
        }
        return current;
      });
    } catch {
      setLatestRequestIds((current) => {
        if (current.phone === requestId) {
          setPhoneStatus("error");
        }
        return current;
      });
    }
  };

  const handlePhoneChange = (value: string) => {
    let next = value;
    if (/^[\d+\s-]*$/.test(value)) {
      next = formatPakistaniPhone(value);
    }
    setPhone(next);
    if (step1.phoneVerified) {
      setStep1({
        phoneVerified: false,
        phoneVerifiedAt: null,
        phoneVerifiedE164: "",
      });
    }
    setOtpCode("");
    setOtpVisible(false);
    setOtpMessage(null);
    setResendCooldown(0);
    if (phoneStatus !== "idle") setPhoneStatus("idle");
    if (next.length >= 10) {
      void checkPhone(next);
    }
  };

  const handleSendPhoneOtp = async () => {
    const { phoneE164 } = normalizePakistaniPhone(phone);
    if (!phoneE164 || !isPhoneFormatValid) {
      showToast({
        type: "error",
        title: "Invalid number",
        message: "Enter a valid Pakistani mobile number.",
      });
      return;
    }
    if (phoneStatus !== "available") {
      showToast({
        type: "info",
        title: "Check number",
        message: "Please wait until this phone number is confirmed available.",
      });
      return;
    }

    setOtpSending(true);
    setOtpMessage(null);
    const result = await sendPhoneOtp(phoneE164);
    setOtpSending(false);
    if (!result.ok) {
      setOtpMessage(result.message);
      showToast({ type: "error", title: "OTP failed", message: result.message });
      return;
    }

    setOtpVisible(true);
    setOtpCode("");
    setResendCooldown(result.cooldownSeconds || 30);
    setOtpMessage(`Code sent to ${result.phoneMasked}.`);
    showToast({
      type: "success",
      title: "Code sent",
      message: "Enter the verification code sent to your phone.",
    });
  };

  const handleVerifyPhoneOtp = async () => {
    const { phoneE164 } = normalizePakistaniPhone(phone);
    if (!phoneE164) return;
    const cleanOtp = otpCode.replace(/\D/g, "");
    if (!/^\d{6}$/.test(cleanOtp)) {
      setOtpMessage("Enter the 6-digit verification code.");
      return;
    }

    setOtpVerifying(true);
    setOtpMessage(null);
    const result = await verifyPhoneOtp(phoneE164, cleanOtp);
    setOtpVerifying(false);
    if (!result.ok) {
      setOtpMessage(result.message);
      showToast({ type: "error", title: "Verification failed", message: result.message });
      return;
    }

    setStep1({
      phone: result.phoneE164,
      phoneVerified: true,
      phoneVerifiedAt: result.verifiedAt,
      phoneVerifiedE164: result.phoneE164,
    });
    setPhone(result.phoneE164);
    setOtpCode("");
    setOtpVisible(false);
    setOtpMessage("Phone verified.");
    setPhoneStatus("available");
    showToast({
      type: "success",
      title: "Phone verified",
      message: "You can continue registration.",
    });
  };

  const handleNext = () => {
    const cid = Perf.newCid();
    Perf.markNav({
      routeKey: "/auth/register-step2",
      cid,
      meta: { source: "player_register_step1" },
    });

    return PerfScope.run(cid, () =>
      Perf.measureAsync(
        "Action.player_register_step1_continue",
        () => {
          const { phoneE164 } = normalizePakistaniPhone(phone);
          if (!effectivePhoneVerified || (!skipPhoneOtp && step1.phoneVerifiedE164 !== phoneE164)) {
            showToast({
              type: "info",
              title: "Verify phone",
              message: "Please verify your phone number before continuing.",
            });
            return;
          }

          if (!isFormValid || phoneStatus !== "available") {
            showToast({
              type: "info",
              title: "Check details",
              message: "Please complete all required fields before continuing.",
            });
            return;
          }

          setStep1({
            fullName: fullName.trim(),
            username: username.trim(),
            email: email.trim(),
            phone: phoneE164,
            phoneVerified: true,
            phoneVerifiedAt: skipPhoneOtp ? Date.now() : step1.phoneVerifiedAt,
            phoneVerifiedE164: phoneE164,
            password,
            city: DEFAULT_CITY,
            ageRange,
          });
          router.replace("/auth/register-step2");
        },
        {
          cid,
          actionKey: "player_register_step1_continue",
          meta: { city: DEFAULT_CITY, ageRange },
        },
      ),
    );
  };

  const renderAvailabilityHelper = (
    status: AvailabilityStatus,
    type: "username" | "phone" | "email",
  ) => {
    if (status === "idle") return null;

    let text = "";
    const style: any[] = [styles.helperText];

    if (status === "checking") {
      text =
        type === "username"
          ? "Checking username..."
          : type === "phone"
            ? "Checking number..."
            : "Checking email...";
      style.push(styles.helperWarning);
    } else if (status === "available") {
      text =
        type === "username"
          ? "Looks good. Username is available."
          : type === "phone"
            ? "Looks good. Number is available."
            : "Looks good. Email is available.";
      style.push(styles.helperOk);
    } else if (status === "taken") {
      text =
        type === "username"
          ? "This username is already in use."
          : type === "phone"
            ? "This phone number is already in use."
            : "This email is already in use.";
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

  const canSendOtp =
    isPhoneFormatValid &&
    phoneStatus === "available" &&
    !effectivePhoneVerified &&
    !otpSending &&
    resendCooldown <= 0;

  return (
    <Screen
      scroll
      keyboardAvoiding
      style={styles.screen}
      contentStyle={styles.container}
      routeKey="/auth/register"
      scrollProps={{
        showsVerticalScrollIndicator: false,
        keyboardShouldPersistTaps: "handled",
      }}
    >
      <RegistrationStepHeader
        title="Create Account"
        subtitle=""
        stepTitle="Step 1 of 4"
        stepSubtitle="Account details"
        progress="25%"
        onBack={() => router.back()}
      />

      <Text style={styles.heading}>Account details</Text>
      <Text style={styles.sub}>Use your real login/contact details. Didit identity verification comes after signup.</Text>

      <View style={styles.fieldGroup}>
        <RegistrationFieldLabel label="Full Name" required />
        <View style={styles.inputBox}>
          <View style={styles.inputRow}>
            <AppIcon
              name="person"
              size={20}
              style={styles.prefixIcon}
              color={isFullNameValid && fullName.trim() ? COLORS.accent : COLORS.muted}
            />
            <TextInput
              placeholder="e.g. Muhammad Ahmed"
              placeholderTextColor={COLORS.muted}
              style={[styles.input, { paddingRight: INPUT_PADDING.withIcon }]}
              selectionColor={COLORS.accent}
              value={fullName}
              onChangeText={setFullName}
              onFocus={() => setFocused("fullName")}
              onBlur={() => setFocused(null)}
            />
          </View>
          <View style={[styles.focusBar, { opacity: focused === "fullName" ? 1 : 0 }]} />
        </View>
      </View>

      <View style={styles.twoColumnRow}>
        <View style={{ flex: 1 }}>
          <CustomSingleSelect
            label={<RegistrationFieldLabel label="Age Range" required />}
            value={ageRange}
            options={AGE_RANGES}
            onChange={setAgeRange}
            icon="cake"
          />
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <RegistrationFieldLabel label="Username" required />
        <View style={styles.inputBox}>
          <View style={styles.inputRow}>
            <AppIcon
              name="alternate-email"
              size={20}
              style={styles.prefixIcon}
              color={isUsernameFormatValid && username.trim() ? COLORS.accent : COLORS.muted}
            />
            <TextInput
              placeholder="e.g. ahmed_karachi"
              placeholderTextColor={COLORS.muted}
              style={styles.input}
              selectionColor={COLORS.accent}
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={(value) => {
                setUsername(value);
                if (usernameStatus !== "idle") setUsernameStatus("idle");
              }}
              onFocus={() => setFocused("username")}
              onBlur={() => {
                setFocused(null);
                void checkUsername(username);
              }}
            />
            {username.trim().length > 0 ? (
              <AppIcon
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
            ) : null}
          </View>
          <View style={[styles.focusBar, { opacity: focused === "username" ? 1 : 0 }]} />
        </View>
        {renderAvailabilityHelper(usernameStatus, "username")}
        {username.trim().length > 0 && !isUsernameFormatValid ? (
          <Text style={styles.errorText}>
            Use 3-20 letters, numbers, or underscores only.
          </Text>
        ) : null}
      </View>

      <View style={styles.fieldGroup}>
        <RegistrationFieldLabel label="Login Email" required />
        <View style={styles.inputBox}>
          <View style={styles.inputRow}>
            <AppIcon
              name="email"
              size={20}
              style={styles.prefixIcon}
              color={isEmailValid && email.trim() ? COLORS.accent : COLORS.muted}
            />
            <TextInput
              placeholder="e.g. ahmed.pk@gmail.com"
              placeholderTextColor={COLORS.muted}
              style={styles.input}
              selectionColor={COLORS.accent}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (emailStatus !== "idle") setEmailStatus("idle");
              }}
              onFocus={() => setFocused("email")}
              onBlur={() => {
                setFocused(null);
                void checkEmail(email);
              }}
            />
            {email.trim().length > 0 ? (
              <AppIcon
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
            ) : null}
          </View>
          <View style={[styles.focusBar, { opacity: focused === "email" ? 1 : 0 }]} />
        </View>
        {renderAvailabilityHelper(emailStatus, "email")}
        <Text style={[styles.helperText, styles.helperOk, styles.diditHelperTextMargin]}>
          Used for sign in, password reset, and MatchHai updates. Didit verifies identity separately.
        </Text>
        {email.trim().length > 0 && !isEmailValid && emailStatus === "idle" ? (
          <Text style={styles.errorText}>Enter a valid email address.</Text>
        ) : null}
      </View>

      <View style={styles.fieldGroup}>
        <RegistrationFieldLabel label="Phone Number" required />
        <View style={styles.inputBox}>
          <View style={styles.inputRow}>
            <AppIcon
              name="phone"
              size={20}
              style={styles.prefixIcon}
              color={isPhoneFormatValid && phone.trim() ? COLORS.accent : COLORS.muted}
            />
            <TextInput
              placeholder="e.g. 0300 123 4567"
              placeholderTextColor={COLORS.muted}
              style={[styles.input, { paddingRight: INPUT_PADDING.withIcon }]}
              selectionColor={COLORS.accent}
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
              value={phone}
              onChangeText={handlePhoneChange}
              onFocus={() => setFocused("phone")}
              onBlur={() => {
                setFocused(null);
                void checkPhone(phone);
              }}
            />
            {phone.trim().length > 0 ? (
              <AppIcon
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
            ) : null}
            <Pressable
              onPress={handleSendPhoneOtp}
              disabled={skipPhoneOtp || !canSendOtp}
              style={({ pressed }) => [
                styles.platformButton,
                styles.platformButtonInline,
                styles.phoneVerifyButton,
                effectivePhoneVerified && styles.platformButtonActive,
                (!canSendOtp || resendCooldown > 0 || otpSending || skipPhoneOtp) && !effectivePhoneVerified
                  ? { opacity: 0.5 }
                  : null,
                pressed && canSendOtp ? { opacity: 0.8 } : null,
              ]}
            >
              {otpSending ? (
                <ActivityIndicator size="small" color={COLORS.text} />
              ) : (
                <Text style={styles.platformButtonText}>
                  {effectivePhoneVerified
                    ? skipPhoneOtp
                      ? "Verified (Dev)"
                      : "Verified"
                    : resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : "Verify"}
                </Text>
              )}
            </Pressable>
          </View>
          <View style={[styles.focusBar, { opacity: focused === "phone" ? 1 : 0 }]} />
        </View>
        {renderAvailabilityHelper(phoneStatus, "phone")}
        {phone.trim().length > 0 && !isPhoneFormatValid && phoneStatus === "idle" ? (
          <Text style={styles.errorText}>Enter a valid Pakistani mobile number.</Text>
        ) : null}
        {effectivePhoneVerified && !otpMessage ? (
          <Text style={[styles.helperText, styles.helperOk, { marginTop: 6 }]}>
            {skipPhoneOtp ? "Phone verified (dev bypass enabled)" : "Phone verified"}
          </Text>
        ) : null}
        {otpVisible ? (
          <View style={styles.otpRow}>
            <View style={[styles.inputBox, styles.otpInputBox]}>
              <TextInput
                placeholder="6-digit code"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                selectionColor={COLORS.accent}
                keyboardType="number-pad"
                value={otpCode}
                maxLength={6}
                onChangeText={(value) => setOtpCode(value.replace(/\D/g, ""))}
              />
            </View>
            <Pressable
              onPress={handleVerifyPhoneOtp}
              disabled={otpVerifying || otpCode.replace(/\D/g, "").length !== 6}
              style={({ pressed }) => [
                styles.platformButton,
                styles.platformButtonInline,
                styles.otpSubmitButton,
                (otpVerifying || otpCode.replace(/\D/g, "").length !== 6) && { opacity: 0.5 },
                pressed && { opacity: 0.8 },
              ]}
            >
              {otpVerifying ? (
                <ActivityIndicator size="small" color={COLORS.text} />
              ) : (
                <Text style={styles.platformButtonText}>Verify OTP</Text>
              )}
            </Pressable>
          </View>
        ) : null}
        {otpMessage ? (
          <Text
            style={[
              styles.helperText,
              phoneVerified ? styles.helperOk : styles.helperWarning,
              { marginTop: 6 },
            ]}
          >
            {otpMessage}
          </Text>
        ) : null}
      </View>

      <View style={styles.fieldGroup}>
        <RegistrationFieldLabel label="Password" required />
        <View style={styles.inputBox}>
          <View style={styles.inputRow}>
            <AppIcon
              name="lock"
              size={20}
              style={styles.prefixIcon}
              color={isPasswordValid && password.length > 0 ? COLORS.accent : COLORS.muted}
            />
            <TextInput
              placeholder="Password"
              placeholderTextColor={COLORS.muted}
              style={[styles.input, { paddingRight: INPUT_PADDING.withToggle }]}
              selectionColor={COLORS.accent}
              secureTextEntry={!passwordVisible}
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocused("password")}
              onBlur={() => setFocused(null)}
            />
            <Pressable onPress={() => setPasswordVisible((value) => !value)} hitSlop={10}>
              <AppIcon
                name={passwordVisible ? "visibility" : "visibility-off"}
                size={18}
                style={styles.suffixIcon}
                color={COLORS.muted}
              />
            </Pressable>
          </View>
          <View style={[styles.focusBar, { opacity: focused === "password" ? 1 : 0 }]} />
        </View>

        {password.length > 0 ? (
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
              <Text style={[styles.strengthLabel, { color: strengthColor || COLORS.muted }]}>
                Strength: {strengthLabel}
              </Text>
            ) : null}
          </View>
        ) : null}

        {showRequirements ? (
          <View style={styles.passwordRequirementsRow}>
            <View style={styles.requirementColumn}>
              <Text
                style={[
                  styles.passwordRequirementText,
                  hasUpper && styles.passwordRequirementTextDone,
                ]}
              >
                {hasUpper ? "OK" : "X"} 1 uppercase character
              </Text>
              <Text
                style={[
                  styles.passwordRequirementText,
                  hasLower && styles.passwordRequirementTextDone,
                ]}
              >
                {hasLower ? "OK" : "X"} 1 lowercase character
              </Text>
            </View>
            <View style={styles.requirementColumn}>
              <Text
                style={[
                  styles.passwordRequirementText,
                  hasNumber && styles.passwordRequirementTextDone,
                ]}
              >
                {hasNumber ? "OK" : "X"} 1 numeric character
              </Text>
              <Text
                style={[
                  styles.passwordRequirementText,
                  hasSpecial && styles.passwordRequirementTextDone,
                ]}
              >
                {hasSpecial ? "OK" : "X"} 1 special character
              </Text>
              <Text
                style={[
                  styles.passwordRequirementText,
                  hasMinLength && styles.passwordRequirementTextDone,
                ]}
              >
                {hasMinLength ? "OK" : "X"} 8+ characters
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={[styles.buttonShadowWrapper, isFormValid && styles.buttonShadowWrapperActive]}>
        <AppButton
          onPress={handleNext}
          disabled={!isFormValid}
          size="lg"
          style={[styles.primaryBtn, !isFormValid ? styles.primaryBtnDisabled : null]}
        >
          Continue
        </AppButton>
      </View>

      <Text style={styles.bottomText}>
        Already have an account?{" "}
        <Link href="/auth/login" style={{ color: COLORS.accent }}>
          Sign In
        </Link>
      </Text>
    </Screen>
  );
}
