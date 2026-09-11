import { Link, router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import RegistrationFieldLabel from "../../app-shared/auth/components/RegistrationFieldLabel";
import RegistrationStepHeader from "../../app-shared/auth/components/RegistrationStepHeader";
import { AppIcon } from "../../src/components/AppIcon";
import { AppButton } from "../../src/components/AppPrimitives";
import Screen from "../../src/components/Screen";
import { useToast } from "../../src/hooks/useToast";
import {
  isEmailAvailable,
  isPhoneAvailable,
} from "../../src/services/userService";
import { sendPhoneOtp, verifyPhoneOtp } from "../../src/services/convex/phoneOtpService";
import { useZoneOnboardingStore } from "../../src/store/zoneOnboardingStore";
import { COLORS } from "../../src/theme";
import {
  formatPakistaniPhone,
  isValidPakistaniPhone,
  normalizePakistaniPhone,
} from "../../src/utils/phoneUtils";
import { Perf, PerfScope } from "../../src/utils/perfInstrumentation";
import styles from "../../app-shared/auth/register.styles";

type FocusField = "owner" | "brand" | "email" | "phone" | "password" | null;
type AvailabilityStatus = "idle" | "checking" | "available" | "taken" | "error";

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
  const [otpCode, setOtpCode] = useState("");
  const [otpVisible, setOtpVisible] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const skipPhoneOtp = __DEV__ && process.env.EXPO_PUBLIC_SKIP_PHONE_OTP === "1";

  const ownerRef = useRef<TextInput | null>(null);
  const brandRef = useRef<TextInput | null>(null);
  const emailRef = useRef<TextInput | null>(null);
  const phoneRef = useRef<TextInput | null>(null);
  const passRef = useRef<TextInput | null>(null);

  useEffect(() => {
    setCurrentStep(1);
  }, [setCurrentStep]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const { phoneE164: currentPhoneE164 } = normalizePakistaniPhone(contactPhone);
  const phoneVerified = Boolean(step1.phoneVerified)
    && Boolean(currentPhoneE164)
    && step1.phoneVerifiedE164 === currentPhoneE164;
  const effectivePhoneVerified = phoneVerified || skipPhoneOtp;

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
    strengthLabel,
    strengthColor,
    strengthWidth,
  } = useMemo(() => {
    const nameValid = ownerFullName.trim().length >= 3;
    const brandValid = venueBrandName.trim().length >= 3;
    const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
    const emailValid = emailRegex.test(contactEmail.trim());
    const phoneFormatValid = isValidPakistaniPhone(contactPhone);

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
      if (rulesMet <= 2) {
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

    return {
      isNameValid: nameValid,
      isBrandValid: brandValid,
      isEmailValid: emailValid,
      isPhoneFormatValid: phoneFormatValid,
      isPasswordValid:
        hasUpperRule &&
        hasLowerRule &&
        hasNumberRule &&
        hasSpecialRule &&
        lengthOkRule,
      hasUpper: hasUpperRule,
      hasLower: hasLowerRule,
      hasNumber: hasNumberRule,
      hasSpecial: hasSpecialRule,
      strengthLabel: nextStrengthLabel,
      strengthColor: nextStrengthColor,
      strengthWidth: nextStrengthWidth,
    };
  }, [contactEmail, contactPhone, ownerFullName, password, venueBrandName]);

  const emailOk =
    isEmailValid && emailStatus !== "checking" && emailStatus !== "taken";
  const phoneOk =
    isPhoneFormatValid && phoneStatus === "available" && effectivePhoneVerified;
  const isFormValid =
    isNameValid &&
    isBrandValid &&
    emailOk &&
    phoneOk &&
    isPasswordValid;

  const showRequirements =
    password.length > 0 && !(hasUpper && hasLower && hasNumber && hasSpecial);
  const showOwnerError = ownerFullName.trim().length > 0 && !isNameValid;
  const showBrandError = venueBrandName.trim().length > 0 && !isBrandValid;

  const handlePhoneChange = (value: string) => {
    let next = value;
    if (/^[\d+\s-]*$/.test(value)) {
      next = formatPakistaniPhone(value);
    }
    setContactPhone(next);
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
    if (next.length >= 10) void handlePhoneAvailability(next);
  };

  const handlePhoneAvailability = async (value: string) => {
    const { phoneDigits } = normalizePakistaniPhone(value);
    if (!phoneDigits || !isValidPakistaniPhone(value)) {
      setPhoneStatus("idle");
      return;
    }
    try {
      setPhoneStatus("checking");
      const available = await isPhoneAvailable(phoneDigits);
      setPhoneStatus(available ? "available" : "taken");
    } catch {
      setPhoneStatus("error");
    }
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
    await handlePhoneAvailability(contactPhone);
  };

  const handleSendPhoneOtp = async () => {
    const { phoneE164 } = normalizePakistaniPhone(contactPhone);
    if (!phoneE164 || !isPhoneFormatValid) {
      showToast({ type: "error", title: "Invalid number", message: "Enter a valid Pakistani mobile number." });
      return;
    }
    if (phoneStatus !== "available") {
      showToast({ type: "info", title: "Check number", message: "Please wait until this phone number is confirmed available." });
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
  };

  const handleVerifyPhoneOtp = async () => {
    const { phoneE164 } = normalizePakistaniPhone(contactPhone);
    const cleanOtp = otpCode.replace(/\D/g, "");
    if (!phoneE164 || !/^\d{6}$/.test(cleanOtp)) {
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
      contactPhone: result.phoneE164,
      phoneVerified: true,
      phoneVerifiedAt: result.verifiedAt,
      phoneVerifiedE164: result.phoneE164,
    });
    setContactPhone(result.phoneE164);
    setPhoneStatus("available");
    setOtpVisible(false);
    setOtpCode("");
    setOtpMessage("Phone verified.");
  };

  const renderAvailabilityHelper = (status: AvailabilityStatus, type: "email" | "phone") => {
    if (status === "idle") return null;

    let text = "";
    const style: any[] = [styles.helperText];
    if (status === "checking") {
      text = type === "email" ? "Checking email..." : "Checking number...";
      style.push(styles.helperWarning);
    } else if (status === "available") {
      text = type === "email" ? "Looks good. Email is available." : "Looks good. Number is available.";
      style.push(styles.helperOk);
    } else if (status === "taken") {
      text = type === "email" ? "This email is already in use." : "This phone number is already in use.";
      style.push(styles.helperError);
    } else {
      text = "Could not verify right now. You can continue and we'll validate again on submit.";
      style.push(styles.helperWarning);
    }

    return (
      <View style={styles.helperTextRow}>
        <Text style={style as any}>{text}</Text>
      </View>
    );
  };

  const handleContinue = () => {
    const cid = Perf.newCid();
    Perf.markNav({
      routeKey: "/auth/zone-register-step2",
      cid,
      meta: { source: "zone_register_step1" },
    });

    return PerfScope.run(cid, () =>
      Perf.measureAsync(
        "Action.zone_register_step1_continue",
        () => {
          if (!isFormValid) {
            showToast({
              type: "info",
              title: "Check details",
              message:
                "Please complete your admin details, contact information, and password before continuing.",
            });
            return;
          }

          if (!effectivePhoneVerified || (!skipPhoneOtp && step1.phoneVerifiedE164 !== normalizePakistaniPhone(contactPhone).phoneE164)) {
            showToast({ type: "info", title: "Verify phone", message: "Please verify the 6-digit phone OTP before continuing." });
            return;
          }

          setSubmitting(true);
          const { phoneE164 } = normalizePakistaniPhone(contactPhone);
          setStep1({
            ownerFullName: ownerFullName.trim(),
            venueBrandName: venueBrandName.trim(),
            contactEmail: contactEmail.trim(),
            contactPhone: phoneE164 || contactPhone.trim(),
            phoneVerified: true,
            phoneVerifiedAt: skipPhoneOtp ? Date.now() : step1.phoneVerifiedAt,
            phoneVerifiedE164: phoneE164,
            password,
            type: "gaming",
          });
          setCurrentStep(1);
          setSubmitting(false);
          router.replace("/auth/zone-register-step2");
        },
        {
          cid,
          actionKey: "zone_register_step1_continue",
          meta: { businessType: "gaming" },
        },
      ),
    );
  };

  const isSubmitDisabled = !isFormValid || submitting;

  return (
    <Screen
      scroll
      keyboardAvoiding
      style={styles.screen}
      contentStyle={styles.container}
      routeKey="/auth/zone-register"
      keyboardFocusKey={focused}
      scrollProps={{
        showsVerticalScrollIndicator: false,
        keyboardShouldPersistTaps: "handled",
      }}
    >
      <RegistrationStepHeader
        title="Zone Setup"
        subtitle=""
        stepTitle="Step 1 of 4"
        stepSubtitle="Admin details"
        progress="25%"
        onBack={() => router.back()}
      />

      <Text style={styles.heading}>Admin account</Text>
      <Text style={styles.sub}>Use real login/contact details. Verify the 6-digit phone OTP before continuing; zone tools stay locked until Didit identity verification is approved.</Text>

      <View style={styles.fieldGroup}>
        <RegistrationFieldLabel label="Owner / primary contact" required />
        <View style={styles.inputBox}>
          <View style={styles.inputRow}>
            <AppIcon
              name="person"
              size={20}
              style={styles.prefixIcon}
              color={isNameValid && ownerFullName.trim() ? COLORS.accent : COLORS.muted}
            />
            <TextInput
              ref={ownerRef}
              placeholder="e.g. Ayesha Khan"
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
          <View style={[styles.focusBar, { opacity: focused === "owner" ? 1 : 0 }]} />
        </View>
        <Text style={[styles.helperText, { color: COLORS.muted, marginTop: 6 }]}>
          Use your full name as per CNIC so KYC can be verified.
        </Text>
        {showOwnerError ? (
          <Text style={styles.errorText}>Enter at least 3 characters for the owner name.</Text>
        ) : null}
      </View>

      <View style={styles.fieldGroup}>
        <RegistrationFieldLabel label="Zone / brand name" required />
        <View style={styles.inputBox}>
          <View style={styles.inputRow}>
            <AppIcon
              name="sports-esports"
              size={20}
              style={styles.prefixIcon}
              color={isBrandValid && venueBrandName.trim() ? COLORS.accent : COLORS.muted}
            />
            <TextInput
              ref={brandRef}
              placeholder="e.g. Pasha's Arena"
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
          <View style={[styles.focusBar, { opacity: focused === "brand" ? 1 : 0 }]} />
        </View>
        {showBrandError ? (
          <Text style={styles.errorText}>
            Enter at least 3 characters for the zone or brand name.
          </Text>
        ) : null}
      </View>

      <View style={styles.fieldGroup}>
        <RegistrationFieldLabel label="Login / contact email" required />
        <View style={styles.inputBox}>
          <View style={styles.inputRow}>
            <AppIcon
              name="email"
              size={20}
              style={styles.prefixIcon}
              color={isEmailValid && contactEmail.trim() ? COLORS.accent : COLORS.muted}
            />
            <TextInput
              ref={emailRef}
              placeholder="e.g. admin@pashasarena.pk"
              placeholderTextColor={COLORS.muted}
              style={styles.input}
              selectionColor={COLORS.accent}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={contactEmail}
              onChangeText={(value) => {
                setContactEmail(value);
                if (emailStatus !== "idle") setEmailStatus("idle");
              }}
              onFocus={() => setFocused("email")}
              onBlur={() => {
                setFocused(null);
                void handleEmailBlur();
              }}
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
            />
          </View>
          <View style={[styles.focusBar, { opacity: focused === "email" ? 1 : 0 }]} />
        </View>
        {renderAvailabilityHelper(emailStatus, "email")}
        <Text style={[styles.helperText, styles.helperOk]}>
          Used for login and password reset.
        </Text>
        {contactEmail.trim().length > 0 && !isEmailValid && emailStatus === "idle" ? (
          <Text style={styles.errorText}>Enter a valid email address.</Text>
        ) : null}
      </View>

      <View style={styles.fieldGroup}>
        <RegistrationFieldLabel label="Contact phone / WhatsApp" required />
        <View style={styles.inputBox}>
          <View style={styles.inputRow}>
            <AppIcon
              name="phone"
              size={20}
              style={styles.prefixIcon}
              color={isPhoneFormatValid && contactPhone.trim() ? COLORS.accent : COLORS.muted}
            />
            <TextInput
              ref={phoneRef}
              placeholder="e.g. 0300 123 4567"
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
                void handlePhoneBlur();
              }}
              returnKeyType="next"
              onSubmitEditing={() => passRef.current?.focus()}
            />
            <Pressable
              onPress={handleSendPhoneOtp}
              disabled={skipPhoneOtp || !isPhoneFormatValid || phoneStatus !== "available" || effectivePhoneVerified || otpSending || resendCooldown > 0}
              style={({ pressed }) => [
                styles.platformButton,
                styles.platformButtonInline,
                styles.phoneVerifyButton,
                effectivePhoneVerified && styles.platformButtonActive,
                (!isPhoneFormatValid || phoneStatus !== "available" || otpSending || resendCooldown > 0) && !effectivePhoneVerified ? { opacity: 0.5 } : null,
                pressed ? { opacity: 0.8 } : null,
              ]}
            >
              {otpSending ? <ActivityIndicator size="small" color={COLORS.text} /> : (
                <Text style={styles.platformButtonText}>
                  {effectivePhoneVerified ? (skipPhoneOtp ? "Verified (Dev)" : "Verified") : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Verify"}
                </Text>
              )}
            </Pressable>
          </View>
          <View style={[styles.focusBar, { opacity: focused === "phone" ? 1 : 0 }]} />
        </View>
        {renderAvailabilityHelper(phoneStatus, "phone")}
        <Text style={[styles.helperText, { color: COLORS.muted, marginTop: 6 }]}>We will send a 6-digit OTP. It must be verified before signup can continue.</Text>
        {otpVisible ? (
          <View style={styles.otpRow}>
            <View style={[styles.inputBox, styles.otpInputBox]}>
              <TextInput
                placeholder="6-digit code"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                keyboardType="number-pad"
                value={otpCode}
                maxLength={6}
                onChangeText={(value) => setOtpCode(value.replace(/\D/g, ""))}
              />
            </View>
            <Pressable
              onPress={handleVerifyPhoneOtp}
              disabled={otpVerifying || otpCode.length !== 6}
              style={[styles.platformButton, styles.platformButtonInline, styles.otpSubmitButton, (otpVerifying || otpCode.length !== 6) && { opacity: 0.5 }]}
            >
              {otpVerifying ? <ActivityIndicator size="small" color={COLORS.text} /> : <Text style={styles.platformButtonText}>Verify OTP</Text>}
            </Pressable>
          </View>
        ) : null}
        {otpMessage ? <Text style={[styles.helperText, phoneVerified ? styles.helperOk : styles.helperWarning, { marginTop: 6 }]}>{otpMessage}</Text> : null}
        {contactPhone.trim().length > 0 && !isPhoneFormatValid && phoneStatus === "idle" ? (
          <Text style={styles.errorText}>Enter a valid Pakistani mobile number.</Text>
        ) : null}
      </View>

      <View style={styles.fieldGroup}>
        <RegistrationFieldLabel label="Password for zone admin login" required />
        <View style={styles.inputBox}>
          <View style={styles.inputRow}>
            <AppIcon
              name="lock"
              size={20}
              style={styles.prefixIcon}
              color={isPasswordValid && password.length > 0 ? COLORS.accent : COLORS.muted}
            />
            <TextInput
              ref={passRef}
              placeholder="Password"
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
              <Text style={[styles.passwordRequirementText, hasUpper && styles.passwordRequirementTextDone]}>
                {hasUpper ? "OK" : "X"} 1 uppercase character
              </Text>
              <Text style={[styles.passwordRequirementText, hasLower && styles.passwordRequirementTextDone]}>
                {hasLower ? "OK" : "X"} 1 lowercase character
              </Text>
            </View>
            <View style={styles.requirementColumn}>
              <Text style={[styles.passwordRequirementText, hasNumber && styles.passwordRequirementTextDone]}>
                {hasNumber ? "OK" : "X"} 1 numeric character
              </Text>
              <Text style={[styles.passwordRequirementText, hasSpecial && styles.passwordRequirementTextDone]}>
                {hasSpecial ? "OK" : "X"} 1 special character
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={[styles.buttonShadowWrapper, isFormValid && !submitting && styles.buttonShadowWrapperActive]}>
        <AppButton
          onPress={handleContinue}
          disabled={isSubmitDisabled}
          size="lg"
          style={[styles.primaryBtn, isSubmitDisabled ? styles.primaryBtnDisabled : null]}
        >
          {submitting ? "Saving..." : "Continue"}
        </AppButton>
      </View>

      <Text style={styles.bottomText}>
        Already manage a zone?{" "}
        <Link href="/auth/login" style={{ color: COLORS.accent }}>
          Sign in
        </Link>
      </Text>
    </Screen>
  );
}
