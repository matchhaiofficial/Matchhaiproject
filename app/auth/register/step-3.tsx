import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import LogoHalo from '../../../src/components/LogoHalo';
import OnboardingStepper from '../../../src/components/OnboardingStepper';
import { useOnboarding } from '../../../src/context/OnboardingContext';
import { COMPETITIVE_GAMES } from '../../../src/constants/games';
import { signUpWithEmail } from '../../../src/services/authService';
import { COLORS } from '../../../src/theme';
import styles from './Step3Review.styles';

export default function RegisterStep3Review() {
  const { profile, resetOnboarding } = useOnboarding();
  const [submitting, setSubmitting] = useState(false);

  const Container = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const containerProps =
    Platform.OS === 'ios'
      ? ({
          style: styles.screen,
          behavior: 'padding' as const,
          keyboardVerticalOffset: 0,
        } as const)
      : ({ style: styles.screen } as const);

  const games = useMemo(
    () => COMPETITIVE_GAMES.filter(game => profile.selectedGames.includes(game.id)),
    [profile.selectedGames]
  );

  const basicsIncomplete =
    !profile.fullName || !profile.username || !profile.email || !profile.phone || !profile.password;
  const preferencesIncomplete = !profile.karachiArea || profile.selectedGames.length === 0;

  useEffect(() => {
    if (basicsIncomplete) {
      router.replace('/auth/register');
    }
  }, [basicsIncomplete]);

  const handleBack = () => {
    router.back();
  };

  const handleFinish = async () => {
    if (submitting) return;
    if (basicsIncomplete) {
      Alert.alert('Missing details', 'Please complete your basic information first.');
      router.replace('/auth/register');
      return;
    }

    if (preferencesIncomplete) {
      Alert.alert('Missing preferences', 'Please select your Karachi area and at least one game.');
      router.replace('/auth/register/step-2');
      return;
    }

    setSubmitting(true);
    const result = await signUpWithEmail(
      profile.email,
      profile.password,
      profile.fullName,
      profile.username,
      profile.phone,
      {
        karachiArea: profile.karachiArea,
        selectedGames: profile.selectedGames,
      }
    );
    setSubmitting(false);

    if (!result.ok) {
      Alert.alert('Sign Up Failed', result.message);
      return;
    }

    resetOnboarding();
    router.replace('/home');
  };

  return (
    <Container {...containerProps}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LogoHalo />

        <OnboardingStepper
          title="Create your account"
          subtitle="Step 3 of 3 · Review"
          currentStep={3}
          totalSteps={3}
        />

        <Text style={styles.heading}>Review & Finish</Text>
        <Text style={styles.sub}>
          Almost there! Confirm your details below. We'll add more profile customization in future
          updates.
        </Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Your basic info</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Full name</Text>
            <Text style={styles.summaryValue}>{profile.fullName}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Username</Text>
            <Text style={styles.summaryValue}>@{profile.username}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Email</Text>
            <Text style={styles.summaryValue}>{profile.email}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Phone</Text>
            <Text style={styles.summaryValue}>{profile.phone}</Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Preferences</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Karachi area</Text>
            <Text style={styles.summaryValue}>{profile.karachiArea}</Text>
          </View>
          <View style={styles.summaryGames}>
            <Text style={styles.summaryLabel}>Competitive games</Text>
            <View style={styles.tagList}>
              {games.map(game => (
                <View key={game.id} style={styles.tag}>
                  <Text style={styles.tagText}>{game.name}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.placeholderBox}>
          <Text style={styles.placeholderTitle}>More onboarding coming soon</Text>
          <Text style={styles.placeholderBody}>
            We'll expand this step with match-making preferences, team invites and more esports tools
            tailored for Karachi players.
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <Pressable
            onPress={handleBack}
            disabled={submitting}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && !submitting && { opacity: 0.92 },
            ]}
            android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
          >
            <Text style={styles.secondaryBtnText}>Back</Text>
          </Pressable>
          <Pressable
            onPress={handleFinish}
            disabled={submitting}
            style={({ pressed }) => [
              styles.primaryBtn,
              submitting && styles.primaryBtnDisabled,
              pressed && !submitting && { opacity: 0.92 },
            ]}
            android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <Text style={styles.primaryBtnText}>Complete registration</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </Container>
  );
}
