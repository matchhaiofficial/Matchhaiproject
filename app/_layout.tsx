// Force app to start at app/index.tsx (not tabs or modal)
export const unstable_settings = { initialRouteName: 'auth/login' };

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

// Fonts
import { useFonts as useMontserrat, Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import { useFonts as useLora, Lora_400Regular } from '@expo-google-fonts/lora';
import { useFonts as useMartel, Martel_400Regular } from '@expo-google-fonts/martel';

// Theme + Auth provider
import { COLORS } from '../src/theme';
import AuthProvider from '../src/context/AuthContext';
import { OnboardingProvider } from '../src/context/OnboardingContext';

export default function RootLayout() {
  const [montLoaded] = useMontserrat({ Montserrat_700Bold });
  const [loraLoaded] = useLora({ Lora_400Regular });
  const [martelLoaded] = useMartel({ Martel_400Regular });

  const ready = montLoaded && loraLoaded && martelLoaded;
  if (!ready) return null;

  return (
    <AuthProvider>
      <OnboardingProvider>
        <View style={{ flex: 1, backgroundColor: COLORS.background }}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: COLORS.background },
            }}
          />
        </View>
      </OnboardingProvider>
    </AuthProvider>
  );
}
