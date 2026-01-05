// app/index.tsx
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { useZoneData } from '../src/hooks/useZoneData';
import { COLORS } from '../src/theme';

export default function IndexGate() {
  const { user, loading: authLoading } = useAuth();
  const { zone, loading: zoneLoading } = useZoneData();

  const loading = authLoading || (!!user && zoneLoading);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  // If user has a zone, they are an admin -> go to dashboard
  if (zone) {
    return <Redirect href="/zone/(tabs)" />;
  }

  // Otherwise, they are a player -> go to dashboard
  return <Redirect href="/(player)/(tabs)" />;
}
