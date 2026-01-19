// app/index.tsx
import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { useZoneData } from '../src/hooks/useZoneData';
import { getUserProfile } from '../src/services/userService';
import { COLORS } from '../src/theme';

export default function IndexGate() {
  const { user, loading: authLoading } = useAuth();
  const { zone, loading: zoneLoading } = useZoneData();
  const [profile, setProfile] = React.useState<any>(null);
  const [profileLoading, setProfileLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadProfile() {
      if (user) {
        setProfileLoading(true);
        const res = await getUserProfile(user.uid);
        if (res.ok) {
          setProfile(res.data);
        }
      }
      setProfileLoading(false);
    }
    loadProfile();
  }, [user]);

  const loading = authLoading || (!!user && (zoneLoading || profileLoading));

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

  // ✅ Robust Super Admin Check
  const isSuperAdmin = profile?.role === "super-admin" ||
    (user?.email && user.email.toLowerCase() === "superadmin@matchhai.com") ||
    user?.uid === "jM2JZrPNNNahPb844rHmr0MQKYo1";

  if (isSuperAdmin) {
    return <Redirect href={"/super-admin" as any} />;
  }

  // If user has a zone, they are an admin -> go to dashboard
  if (zone) {
    return <Redirect href="/zone/(tabs)" />;
  }

  // Otherwise, they are a player -> go to dashboard
  return <Redirect href="/(player)/(tabs)" />;
}
