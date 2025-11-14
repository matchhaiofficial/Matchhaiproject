// app/auth/register/index.tsx (Registration Step 1)
import { MaterialIcons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import LogoHalo from '../../../src/components/LogoHalo';
import OnboardingStepper from '../../../src/components/OnboardingStepper';
import { useOnboarding } from '../../../src/context/OnboardingContext';
import { isPhoneAvailable, isUsernameAvailable } from '../../../src/services/userService';
import { COLORS } from '../../../src/theme';
import styles from './Step1BasicInfo.styles';

type FocusField = 'fullName' | 'username' | 'email' | 'phone' | 'password' | null;
type AvailabilityStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error';

export default function RegisterStep1() {
  const { profile, updateOnboardingProfile } = useOnboarding();

  const [fullName, setFullName] = useState(profile.fullName);
  const [username, setUsername] = useState(profile.username);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone);
  const [password, setPassword] = useState(profile.password);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const [focused, setFocused] = useState<FocusField>(null);

  const [usernameStatus, setUsernameStatus] = useState<AvailabilityStatus>('idle');
  const [phoneStatus, setPhoneStatus] = useState<AvailabilityStatus>('idle');

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

    // basic: letters, numbers, underscores; length 3–20
    const usernameTrimmed = username.trim();
    const usernameFormatValid = /^[a-zA-Z0-9_]{3,20}$/.test(usernameTrimmed);

    const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
    const emailValid = emailRegex.test(email.trim());

    const normalizedPhone = phone.replace(/\D/g, '');
    const phoneFormatValid = normalizedPhone.length >= 10 && normalizedPhone.length <= 13;

    const passwordValid = password.length >= 6;

    const usernameOk =
      usernameFormatValid &&
      (usernameStatus === 'idle' || usernameStatus === 'available');
    const phoneOk =
      phoneFormatValid &&
      (phoneStatus === 'idle' || phoneStatus === 'available');

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
  const Container = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const containerProps =
    Platform.OS === 'ios'
      ? ({
          style: styles.screen,
          behavior: 'padding' as const,
          keyboardVerticalOffset: 0,
        } as const)
      : ({ style: styles.screen } as const);

  // ---------- Availability checks ----------
  const handleUsernameBlur = async () => {
    const trimmed = username.trim();
    if (!trimmed || !isUsernameFormatValid) {
      setUsernameStatus('idle');
      return;
    }

    try {
      setUsernameStatus('checking');
      const available = await isUsernameAvailable(trimmed);
      setUsernameStatus(available ? 'available' : 'taken');
    } catch {
      setUsernameStatus('error');
    }
  };

  const handlePhoneBlur = async () => {
    const normalized = phone.replace(/\D/g, '');
    if (!normalized || !isPhoneFormatValid) {
      setPhoneStatus('idle');
      return;
    }

    try {
      setPhoneStatus('checking');
      const available = await isPhoneAvailable(normalized);
      setPhoneStatus(available ? 'available' : 'taken');
    } catch {
      setPhoneStatus('error');
    }
  };

  // reset availability when typing
  const handleUsernameChange = (value: string) => {
    setUsername(value);
    if (usernameStatus !== 'idle') setUsernameStatus('idle');
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    if (phoneStatus !== 'idle') setPhoneStatus('idle');
  };

  // ---------- Submit ----------
  const handleContinue = () => {
    if (!isFormValid) {
      Alert.alert(
        'Check details',
        'Please complete all fields correctly before continuing.'
      );
      return;
    }
    updateOnboardingProfile({
      fullName: fullName.trim(),
      username: username.trim(),
      email: email.trim(),
      phone,
      password,
    });

    router.push('/auth/register/step-2');
  };

  // ---------- Helper: availability helper text ----------
  const renderAvailabilityHelper = (
    status: AvailabilityStatus,
    type: 'username' | 'phone'
  ) => {
    if (status === 'idle') return null;

    let text = '';
    let helperVariant;

    if (status === 'checking') {
      text = type === 'username' ? 'Checking username…' : 'Checking number…';
      helperVariant = styles.helperWarning;
    } else if (status === 'available') {
      text =
        type === 'username'
          ? 'Looks good! Username is available.'
          : 'Looks good! Number is available.';
      helperVariant = styles.helperOk;
    } else if (status === 'taken') {
      text =
        type === 'username'
          ? 'This username is already taken.'
          : 'This phone number is already in use.';
      helperVariant = styles.helperError;
    } else {
      text = 'Could not verify right now. Please try again.';
      helperVariant = styles.helperWarning;
    }

    return (
      <View style={styles.helperTextRow}>
        <Text style={[styles.helperText, helperVariant]}>{text}</Text>
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

        <OnboardingStepper
          title="Create your account"
          subtitle="Step 1 of 3 · Account details"
          currentStep={1}
          totalSteps={3}
        />

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
              isFullNameValid && fullName.trim().length > 0 && styles.inputBoxValidShadow,
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
                onFocus={() => setFocused('fullName')}
                onBlur={() => setFocused(null)}
              />
            </View>
            <View style={[styles.focusBar, { opacity: focused === 'fullName' ? 1 : 0 }]} />
          </View>
        </View>

        {/* Username */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Username</Text>
          <View
            style={[
              styles.inputBox,
              isUsernameFormatValid && username.trim().length > 0 && styles.inputBoxValidShadow,
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
                onFocus={() => setFocused('username')}
                onBlur={() => {
                  setFocused(null);
                  handleUsernameBlur();
                }}
              />
              {username.trim().length > 0 && (
                <MaterialIcons
                  name={
                    usernameStatus === 'checking'
                      ? 'hourglass-top'
                      : usernameStatus === 'available'
                      ? 'check-circle'
                      : usernameStatus === 'taken'
                      ? 'error-outline'
                      : isUsernameFormatValid
                      ? 'check-circle'
                      : 'error-outline'
                  }
                  size={18}
                  style={styles.suffixIcon}
                  color={
                    usernameStatus === 'taken'
                      ? COLORS.error
                      : usernameStatus === 'available' || isUsernameFormatValid
                      ? '#8bc34a'
                      : COLORS.muted
                  }
                />
              )}
            </View>
            <View style={[styles.focusBar, { opacity: focused === 'username' ? 1 : 0 }]} />
          </View>
          {renderAvailabilityHelper(usernameStatus, 'username')}
        </View>

        {/* Email Address */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email Address</Text>
          <View
            style={[
              styles.inputBox,
              isEmailValid && email.trim().length > 0 && styles.inputBoxValidShadow,
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
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
              />
            </View>
            <View style={[styles.focusBar, { opacity: focused === 'email' ? 1 : 0 }]} />
          </View>
        </View>

        {/* Phone Number */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <View
            style={[
              styles.inputBox,
              isPhoneFormatValid && phone.trim().length > 0 && styles.inputBoxValidShadow,
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
                onFocus={() => setFocused('phone')}
                onBlur={() => {
                  setFocused(null);
                  handlePhoneBlur();
                }}
              />
              {phone.trim().length > 0 && (
                <MaterialIcons
                  name={
                    phoneStatus === 'checking'
                      ? 'hourglass-top'
                      : phoneStatus === 'available'
                      ? 'check-circle'
                      : phoneStatus === 'taken'
                      ? 'error-outline'
                      : isPhoneFormatValid
                      ? 'check-circle'
                      : 'error-outline'
                  }
                  size={18}
                  style={styles.suffixIcon}
                  color={
                    phoneStatus === 'taken'
                      ? COLORS.error
                      : phoneStatus === 'available' || isPhoneFormatValid
                      ? '#8bc34a'
                      : COLORS.muted
                  }
                />
              )}
            </View>
            <View style={[styles.focusBar, { opacity: focused === 'phone' ? 1 : 0 }]} />
          </View>
          {renderAvailabilityHelper(phoneStatus, 'phone')}
        </View>

        {/* Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <View
            style={[
              styles.inputBox,
              isPasswordValid && password.length > 0 && styles.inputBoxValidShadow,
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
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
              />
              <Pressable onPress={() => setPasswordVisible(v => !v)} hitSlop={10}>
                <MaterialIcons
                  name={passwordVisible ? 'visibility' : 'visibility-off'}
                  size={18}
                  style={styles.suffixIcon}
                  color={COLORS.muted}
                />
              </Pressable>
            </View>
            <View style={[styles.focusBar, { opacity: focused === 'password' ? 1 : 0 }]} />
          </View>
        </View>

        {/* Primary button */}
        <View
          style={[styles.buttonShadowWrapper, isFormValid && styles.buttonShadowWrapperActive]}
        >
          <Pressable
            onPress={handleContinue}
            disabled={!isFormValid}
            style={({ pressed }) => [
              styles.primaryBtn,
              !isFormValid ? styles.primaryBtnDisabled : null,
              pressed && isFormValid && { opacity: 0.92 },
            ]}
            android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
          >
            <Text style={styles.primaryBtnText}>Continue</Text>
          </Pressable>
        </View>

        {/* Bottom link */}
        <Text style={styles.bottomText}>
          Already have an account?{' '}
          <Link href="/auth/login" style={{ color: COLORS.accent }}>
            Sign In
          </Link>
        </Text>
      </ScrollView>
    </Container>
  );
}