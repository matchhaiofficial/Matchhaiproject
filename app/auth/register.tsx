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
  View
} from "react-native";

import { AGE_RANGES, CITY_OPTIONS } from "../../constants/profileOptions";
import { CustomSingleSelect } from "../../src/components/CustomSingleSelect";
import LogoHalo from "../../src/components/LogoHalo";
import { useToast } from "../../src/hooks/useToast";
import {
  isEmailAvailable,
  isPhoneAvailable,
  isUsernameAvailable,
} from "../../src/services/convex/userService";
import { useOnboardingStore } from "../../src/store/onboardingStore";
import { COLORS, INPUT_PADDING } from "../../src/theme";
import { formatPakistaniPhone, isValidPakistaniPhone, normalizePakistaniPhone } from "../../src/utils/phoneUtils";
import styles from "./register.styles";

type FocusField =
  | "fullName"
  | "username"
  | "email"
  | "phone"
  | "password"
  | null;
type AvailabilityStatus = "idle" | "checking" | "available" | "taken" | "error";

// (Removed local formatPakistaniPhone, using shared version)



export default function Register() {
  const { step1, setStep1 } = useOnboardingStore();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState(step1.fullName);
  const [username, setUsername] = useState(step1.username);
  const [city, setCity] = useState(step1.city || "Karachi");
  const [ageRange, setAgeRange] = useState(step1.ageRange || AGE_RANGES[1]); // Default 18-24


  const [email, setEmail] = useState(step1.email || "");

  const [phone, setPhone] = useState(step1.phone);
  const [password, setPassword] = useState(step1.password);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const [focused, setFocused] = useState<FocusField>(null);

  const [usernameStatus, setUsernameStatus] =
    useState<AvailabilityStatus>("idle");
  const [phoneStatus, setPhoneStatus] = useState<AvailabilityStatus>("idle");
  const [emailStatus, setEmailStatus] = useState<AvailabilityStatus>("idle");

  // Latest request IDs for race condition guard
  const [latestRequestIds, setLatestRequestIds] = useState({
    username: 0,
    email: 0,
    phone: 0,
  });

  // when we hydrate, if fields already have values, show "available" by default
  useEffect(() => {
    if (step1.username) setUsernameStatus("available");
    if (step1.phone) setPhoneStatus("available");
    if (step1.email) setEmailStatus("available");
  }, [step1.username, step1.phone, step1.email]);

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
    const cityValid = city.length > 0;
    const ageValid = ageRange.length > 0;

    const usernameTrimmed = username.trim();
    const usernameFormatValid = /^[a-zA-Z0-9_]{3,20}$/.test(usernameTrimmed);

    // email: full email
    const emailTrimmed = email.trim();
    const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
    const emailValid = emailRegex.test(emailTrimmed);

    // ---- Phone validation ----
    const { phoneDigits } = normalizePakistaniPhone(phone);
    const phoneFormatValid = isValidPakistaniPhone(phone);

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
      if (rulesMet <= 2 || !lengthOkRule) {
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
      } else if (rulesMet === 5) {
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

    const usernameOk =
      usernameFormatValid &&
      (usernameStatus === "idle" || usernameStatus === "available");

    const phoneOk =
      phoneFormatValid &&
      (phoneStatus === "idle" || phoneStatus === "available");

    const emailOk =
      emailValid && (emailStatus === "idle" || emailStatus === "available");

    return {
      isFullNameValid: nameValid,
      isUsernameFormatValid: usernameFormatValid,
      isEmailValid: emailValid,
      isPhoneFormatValid: phoneFormatValid,
      isPasswordValid: passwordValid,
      isFormValid:
        nameValid && usernameOk && emailOk && phoneOk && passwordValid && cityValid && ageValid,

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
    emailStatus,
  ]);

  // Derived flag: all 4 visible requirements satisfied?
  const allCharRequirementsMet =
    hasUpper && hasLower && hasNumber && hasSpecial;
  const showRequirements =
    password.length > 0 && !allCharRequirementsMet;

  // Keyboard handling
  const Container = KeyboardAvoidingView;
  const containerProps = {
    style: styles.screen,
    behavior: Platform.OS === "ios" ? ("padding" as const) : ("height" as const),
    keyboardVerticalOffset: Platform.OS === "ios" ? 0 : 20,
  };

  // ---------- Availability checks (with race condition guard) ----------
  const checkUsername = async (val: string) => {
    const trimmed = val.trim();
    if (!trimmed || !/^[a-zA-Z0-9_]{3,20}$/.test(trimmed)) {
      setUsernameStatus("idle");
      return;
    }

    const requestId = Date.now();
    setLatestRequestIds(prev => ({ ...prev, username: requestId }));
    setUsernameStatus("checking");

    try {
      const available = await isUsernameAvailable(trimmed);
      setLatestRequestIds(current => {
        if (current.username === requestId) {
          setUsernameStatus(available ? "available" : "taken");
        }
        return current;
      });
    } catch {
      setLatestRequestIds(current => {
        if (current.username === requestId) {
          setUsernameStatus("error");
        }
        return current;
      });
    }
  };

  const checkEmail = async (val: string) => {
    const trimmed = val.trim();
    const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
    if (!trimmed || !emailRegex.test(trimmed)) {
      setEmailStatus("idle");
      return;
    }

    const requestId = Date.now();
    setLatestRequestIds(prev => ({ ...prev, email: requestId }));
    setEmailStatus("checking");

    try {
      const available = await isEmailAvailable(trimmed);
      setLatestRequestIds(current => {
        if (current.email === requestId) {
          setEmailStatus(available ? "available" : "taken");
        }
        return current;
      });
    } catch {
      setLatestRequestIds(current => {
        if (current.email === requestId) {
          setEmailStatus("error");
        }
        return current;
      });
    }
  };

  const checkPhone = async (val: string) => {
    const { phoneDigits } = normalizePakistaniPhone(val);
    if (!phoneDigits || !isValidPakistaniPhone(val)) {
      setPhoneStatus("idle");
      return;
    }

    const requestId = Date.now();
    setLatestRequestIds(prev => ({ ...prev, phone: requestId }));
    setPhoneStatus("checking");

    try {
      const available = await isPhoneAvailable(phoneDigits);
      setLatestRequestIds(current => {
        if (current.phone === requestId) {
          setPhoneStatus(available ? "available" : "taken");
        }
        return current;
      });
    } catch {
      setLatestRequestIds(current => {
        if (current.phone === requestId) {
          setPhoneStatus("error");
        }
        return current;
      });
    }
  };

  const handleUsernameBlur = () => checkUsername(username);
  const handleEmailBlur = () => checkEmail(email);
  const handlePhoneBlur = () => checkPhone(phone);

  // reset availability when typing
  const handleUsernameChange = (value: string) => {
    setUsername(value);
    if (usernameStatus !== "idle") setUsernameStatus("idle");
  };

  // Email change: allow standard email characters
  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (emailStatus !== "idle") setEmailStatus("idle");
  };

  // Phone: mimic Login’s format logic
  const handlePhoneChange = (value: string) => {
    let next = value;
    if (/^[\d+\s-]*$/.test(value)) {
      next = formatPakistaniPhone(value);
    }
    setPhone(next);
    if (phoneStatus !== "idle") setPhoneStatus("idle");
    // best effort typing check
    if (next.length >= 10) {
      checkPhone(next);
    }
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

    const { phoneE164 } = normalizePakistaniPhone(phone);

    setStep1({
      fullName: fullName.trim(),
      username: username.trim(),
      email: email.trim(),
      phone: phoneE164, // Store normalized E164
      password,
      city,
      ageRange,
    });

    router.push("/auth/register-step2");
  };

  // ---------- Helper: availability helper text ----------
  const renderAvailabilityHelper = (
    status: AvailabilityStatus,
    type: "username" | "phone" | "email"
  ) => {
    if (status === "idle") return null;

    let text = "";
    const style: any[] = [styles.helperText];

    if (status === "checking") {
      text =
        type === "username"
          ? "Checking username…"
          : type === "phone"
            ? "Checking number…"
            : "Checking email…";
      style.push(styles.helperWarning);
    } else if (status === "available") {
      text =
        type === "username"
          ? "Looks good! Username is available."
          : type === "phone"
            ? "Looks good! Number is available."
            : "Looks good! Email is available.";
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
                style={[styles.input, { paddingRight: INPUT_PADDING.withIcon }]}
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

        {/* City & Age Row */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <CustomSingleSelect
              label="City"
              value={city}
              options={CITY_OPTIONS}
              onChange={setCity}
              icon="location-city"
            />
          </View>

          <View style={{ flex: 0.8 }}>
            <CustomSingleSelect
              label="Age"
              value={ageRange}
              options={AGE_RANGES}
              onChange={setAgeRange}
              icon="cake"
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
          {!!username && !isUsernameFormatValid && usernameStatus === "idle" && (
            <Text style={styles.errorText}>
              Username must be 3-20 characters (letters, numbers, underscores).
            </Text>
          )}
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
                placeholder="Enter your email address"
                placeholderTextColor={COLORS.muted}
                style={[styles.input, { paddingRight: INPUT_PADDING.withIcon }]}
                selectionColor={COLORS.accent}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={handleEmailChange}
                onFocus={() => setFocused("email")}
                onBlur={() => {
                  setFocused(null);
                  handleEmailBlur();
                }}
              />
              {email.trim().length > 0 && (
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
          {!!email && !isEmailValid && emailStatus === "idle" && (
            <Text style={styles.errorText}>
              Enter a valid email address.
            </Text>
          )}
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
          {!!phone && !isPhoneFormatValid && phoneStatus === "idle" && (
            <Text style={styles.errorText}>
              Enter a valid Pakistani phone number.
            </Text>
          )}
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
