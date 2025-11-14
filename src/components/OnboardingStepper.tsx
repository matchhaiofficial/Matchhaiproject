import React from 'react';
import { Text, View } from 'react-native';

import styles from './OnboardingStepper.styles';

type OnboardingStepperProps = {
  title: string;
  subtitle: string;
  currentStep: number;
  totalSteps: number;
};

export default function OnboardingStepper({
  title,
  subtitle,
  currentStep,
  totalSteps,
}: OnboardingStepperProps) {
  const safeCurrent = Math.min(Math.max(currentStep, 1), totalSteps);
  const progress = totalSteps > 0 ? (safeCurrent / totalSteps) * 100 : 0;
  const dots = Array.from({ length: totalSteps });

  return (
    <View style={styles.wrapper}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <View style={styles.dotsRow}>
        {dots.map((_, index) => (
          <View
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            style={[styles.dot, index + 1 <= safeCurrent && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}
