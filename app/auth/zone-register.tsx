import { Link, router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import RegistrationFieldLabel from "./components/RegistrationFieldLabel";
import RegistrationStepHeader from "./components/RegistrationStepHeader";
import { AppIcon } from "../../src/components/AppIcon";
import { AppButton } from "../../src/components/AppPrimitives";
import Screen from "../../src/components/Screen";
import { useToast } from "../../src/hooks/useToast";
import {
  isEmailAvailable,
  isPhoneAvailable,
} from "../../src/services/userService";
import { useZoneOnboardingStore } from "../../src/store/zoneOnboardingStore";
import { COLORS } from "../../src/theme";
import {
  formatPakistaniPhone,
  isValidPakistaniPhone,
  normalizePakistaniPhone,
} from "../../src/utils/phoneUtils";
import { Perf, PerfScope } from "../../src/utils/perfInstrumentation";
import styles from "./register.styles";

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

  const ownerRef = useRef<TextInput | null>(null);
  const brandRef = useRef<TextInput | null>(null);
  const emailRef = useRef<TextInput | null>(null);
  const phoneRef = useRef<TextInput | null>(null);
  const passRef = useRef<TextInput | null>(null);

  useEffect(() => {
    setCurrentStep(1);
  }, [setCurrentStep]);

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
    isPhoneFormatValid && phoneStatus !== "checking" && phoneStatus !== "taken";
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
    const { phoneDigits } = normalizePakistaniPhone(contactPhone);
    if (!phoneDigits || !isPhoneFormatValid) {
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

          setSubmitting(true);
          const { phoneE164 } = normalizePakistaniPhone(contactPhone);
          setStep1({
            ownerFullName: ownerFullName.trim(),
            venueBrandName: venueBrandName.trim(),
            contactEmail: contactEmail.trim(),
            contactPhone: phoneE164 || contactPhone.trim(),
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
      scrollProps={{
        showsVerticalScrollIndicator: false,
        keyboardShouldPersistTaps: "handled",
      }}
    >
      <RegistrationStepHeader
        title="Zone Setup"
        subtitle="Create your zone admin account."
        stepTitle="Step 1 of 4"
        stepSubtitle="Admin details"
        progress="25%"
        onBack={() => router.back()}
      />

      <Text style={styles.heading}>Admin account</Text>
      <Text style={styles.sub}>Add the contact details used for zone access and support.</Text>

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
        <RegistrationFieldLabel label="Contact email" required />
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
          </View>
          <View style={[styles.focusBar, { opacity: focused === "phone" ? 1 : 0 }]} />
        </View>
        {renderAvailabilityHelper(phoneStatus, "phone")}
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
