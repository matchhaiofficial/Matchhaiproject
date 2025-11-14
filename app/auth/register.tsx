// app/auth/register.tsx
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
import { signUpWithEmail } from "../../src/services/authService";
import {
  isPhoneAvailable,
  isUsernameAvailable,
} from "../../src/services/userService";
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

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);

  const [focused, setFocused] = useState<FocusField>(null);

  const [usernameStatus, setUsernameStatus] =
    useState<AvailabilityStatus>("idle");
  const [phoneStatus, setPhoneStatus] = useState<AvailabilityStatus>("idle");

  const [loading, setLoading] = useState(false);

  // ---------- Validation ----------
  const {
    isFullNameValid,
    isUsernameFormatValid,
    isEmailValid,
    isPhoneFormatValid,
    isPasswordValid,
    isFormValid,
  } = useMemo(() => {
    const nameValid = fullName.trim().length >= 3;

    const usernameTrimmed = username.trim();
    const usernameFormatValid = /^[a-zA-Z0-9_]{3,20}$/.test(usernameTrimmed);

    const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
    const emailValid = emailRegex.test(email.trim());

    const normalizedPhone = phone.replace(/\D/g, "");
    const phoneFormatValid =
      normalizedPhone.length >= 10 && normalizedPhone.length <= 13;

    const passwordValid = password.length >= 6;

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
    };
  }, [fullName, username, email, phone, password, usernameStatus, phoneStatus]);

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
    const normalized = phone.replace(/\D/g, "");
    if (!normalized || !isPhoneFormatValid) {
      setPhoneStatus("idle");
      return;
    }

    try {
      setPhoneStatus("checking");
      const available = await isPhoneAvailable(normalized);
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

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    if (phoneStatus !== "idle") setPhoneStatus("idle");
  };

  // ---------- Submit ----------
  const handleRegister = async () => {
    console.log("[Register] handleRegister called");
    console.log("[Register] isFormValid:", isFormValid, {
      fullName,
      username,
      email,
      phone,
      passwordLen: password.length,
      usernameStatus,
      phoneStatus,
    });

    if (!isFormValid) {
      Alert.alert(
        "Check details",
        "Please complete all fields correctly before continuing."
      );
      return;
    }

    setLoading(true);
    console.log("[Register] submitting step 1 …");

    try {
      console.log("[Register] calling signUpWithEmail");
      const res = await signUpWithEmail(
        email.trim(),
        password,
        fullName.trim(),
        username.trim(),
        phone
      );
      console.log("[Register] signUpWithEmail result:", res);

      if (!res || !res.ok) {
        console.log("[Register] signUpWithEmail reported failure");
        Alert.alert(
          "Sign Up Failed",
          res?.message ?? "Something went wrong. Please try again."
        );
        return;
      }

      console.log("[Register] success → navigating to /auth/register-step2");
      router.replace("/auth/register-step2");
    } catch (err) {
      console.error("[Register] unexpected error during sign up", err);
      Alert.alert(
        "Sign Up Failed",
        "Unexpected error while creating your account. Please try again."
      );
    } finally {
      console.log("[Register] finally: setLoading(false)");
      setLoading(false);
    }
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
          <View
            style={[
              styles.inputBox,
              isFullNameValid &&
                fullName.trim().length > 0 &&
                styles.inputBoxValidShadow,
            ]}
          >
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
          <View
            style={[
              styles.inputBox,
              isUsernameFormatValid &&
                username.trim().length > 0 &&
                styles.inputBoxValidShadow,
            ]}
          >
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
                      ? "#8bc34a"
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
          <View
            style={[
              styles.inputBox,
              isEmailValid &&
                email.trim().length > 0 &&
                styles.inputBoxValidShadow,
            ]}
          >
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
                style={styles.input}
                selectionColor={COLORS.accent}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
              />
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
          <View
            style={[
              styles.inputBox,
              isPhoneFormatValid &&
                phone.trim().length > 0 &&
                styles.inputBoxValidShadow,
            ]}
          >
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
                placeholder="03XXXXXXXXX"
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
                      ? "#8bc34a"
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
                autoComplete="password"
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
        </View>

        {/* Primary button */}
        <View
          style={[
            styles.buttonShadowWrapper,
            isFormValid && !loading && styles.buttonShadowWrapperActive,
          ]}
        >
          <Pressable
            onPress={handleRegister}
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
              <Text style={styles.primaryBtnText}>Sign Up</Text>
            )}
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
