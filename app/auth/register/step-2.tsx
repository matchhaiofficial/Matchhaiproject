import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import DropdownSelect from '../../../src/components/DropdownSelect';
import LogoHalo from '../../../src/components/LogoHalo';
import OnboardingStepper from '../../../src/components/OnboardingStepper';
import { useOnboarding } from '../../../src/context/OnboardingContext';
import { COMPETITIVE_GAMES } from '../../../src/constants/games';
import { KARACHI_AREAS } from '../../../src/constants/karachiAreas';
import { COLORS } from '../../../src/theme';
import styles from './Step2LocationGames.styles';

export default function RegisterStep2LocationGames() {
  const { profile, updateOnboardingProfile } = useOnboarding();

  const [karachiArea, setKarachiArea] = useState(profile.karachiArea ?? '');
  const [selectedGames, setSelectedGames] = useState<string[]>([...profile.selectedGames]);
  const [areaError, setAreaError] = useState<string | null>(null);
  const [gamesError, setGamesError] = useState<string | null>(null);

  const areaOptions = useMemo(
    () =>
      [...KARACHI_AREAS]
        .sort((a, b) => a.localeCompare(b))
        .map(area => ({ label: area, value: area })),
    []
  );

  const Container = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const containerProps =
    Platform.OS === 'ios'
      ? ({
          style: styles.screen,
          behavior: 'padding' as const,
          keyboardVerticalOffset: 0,
        } as const)
      : ({ style: styles.screen } as const);

  const toggleGame = (id: string) => {
    setSelectedGames(prev => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter(gameId => gameId !== id) : [...prev, id];
      if (next.length > 0) {
        setGamesError(null);
      }
      return next;
    });
  };

  const handleBack = () => {
    updateOnboardingProfile({ karachiArea: karachiArea || null, selectedGames: [...selectedGames] });
    router.back();
  };

  const handleContinue = () => {
    let hasError = false;
    if (!karachiArea) {
      setAreaError('Please select your Karachi area.');
      hasError = true;
    } else {
      setAreaError(null);
    }

    if (selectedGames.length === 0) {
      setGamesError('Select at least one game to continue.');
      hasError = true;
    } else {
      setGamesError(null);
    }

    if (hasError) return;

    updateOnboardingProfile({ karachiArea, selectedGames: [...selectedGames] });
    router.push('/auth/register/step-3');
  };

  const isContinueEnabled = Boolean(karachiArea) && selectedGames.length > 0;

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
          subtitle="Step 2 of 3 · Preferences"
          currentStep={2}
          totalSteps={3}
        />

        <Text style={styles.heading}>Location and Game Preferences</Text>
        <Text style={styles.sub}>
          Tell us where you're located and which games you play competitively.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Your Location</Text>
          <Text style={styles.sectionHelper}>
            Choose the area of Karachi where you usually play. This helps us show relevant zones and
            events near you.
          </Text>

          <DropdownSelect
            placeholder="Choose your area"
            value={karachiArea || null}
            options={areaOptions}
            onSelect={value => {
              setKarachiArea(value);
              setAreaError(null);
            }}
            error={areaError}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Your Games</Text>
          <Text style={styles.sectionHelper}>
            Choose the games you play competitively. You can select multiple games.
          </Text>

          <View style={styles.gamesList}>
            {COMPETITIVE_GAMES.map(game => {
              const isSelected = selectedGames.includes(game.id);
              return (
                <Pressable
                  key={game.id}
                  onPress={() => toggleGame(game.id)}
                  style={({ pressed }) => [
                    styles.gameCard,
                    isSelected && styles.gameCardSelected,
                    pressed && { opacity: 0.94 },
                  ]}
                  android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
                >
                  {game.image ? (
                    <Image source={game.image} style={styles.gameThumbnail} resizeMode="cover" />
                  ) : (
                    <View style={styles.gameThumbnailFallback}>
                      <MaterialIcons name="sports-esports" size={20} color={COLORS.muted} />
                    </View>
                  )}
                  <View style={styles.gameContent}>
                    <Text style={styles.gameTitle}>{game.name}</Text>
                    <Text style={styles.gameDescription}>{game.description}</Text>
                  </View>
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected ? (
                      <MaterialIcons name="check" size={16} color={COLORS.text} />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
          {gamesError ? <Text style={styles.errorText}>{gamesError}</Text> : null}
        </View>

        <View style={styles.buttonRow}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.92 }]}
            android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
          >
            <Text style={styles.secondaryBtnText}>Back</Text>
          </Pressable>
          <Pressable
            onPress={handleContinue}
            disabled={!isContinueEnabled}
            style={({ pressed }) => [
              styles.primaryBtn,
              !isContinueEnabled && styles.primaryBtnDisabled,
              pressed && isContinueEnabled && { opacity: 0.92 },
            ]}
            android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
          >
            <Text style={styles.primaryBtnText}>Continue</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Container>
  );
}
