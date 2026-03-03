// app/home/index.tsx
import { Redirect, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useZoneData } from '../../src/hooks/useZoneData';
import { signOutUser } from '../../src/services/authService';
import { COLORS, FONTS } from '../../src/theme';
import styles from './home.styles';

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { zone, loading: zoneLoading } = useZoneData();
  const [signingOut, setSigningOut] = useState(false);

  const loading = authLoading || (!!user && zoneLoading);

  // ✅ Redirect away when user becomes null (after logout)
  useEffect(() => {
    if (!authLoading && !user) {
      console.log("[Home] no user → redirecting to /auth/login");
      router.replace("/auth/login");
    }
  }, [authLoading, user]);

  // ✅ Role-aware redirect: If user has a zone, they belong in /zone. If super-admin, /super-admin
  useEffect(() => {
    if (!loading && user) {
      const isSuperAdmin = (user.email && user.email.toLowerCase() === "superadmin@matchhai.com") ||
        user._id === "jM2JZrPNNNahPb844rHmr0MQKYo1";

      if (isSuperAdmin) {
        console.log("[Home] super-admin detected via email/uid → redirecting");
        router.replace("/super-admin/(tabs)");
        return;
      }
      if (zone) {
        console.log("[Home] admin detected → redirecting to /zone");
        router.replace("/zone");
      }
    }
  }, [loading, user, zone]);

  if (loading) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  // While redirecting, render nothing (or a tiny placeholder)
  if (!user) {
    return null;
  }

  const name = user.fullName || '';
  const email = user.email || '';

  const handleLogout = async () => {
    setSigningOut(true);
    const res = await signOutUser();
    setSigningOut(false);

    if (!res.ok) {
      Alert.alert('Logout Failed', res.message);
      return;
    }

    // ❌ No need to call router here; AuthContext + useEffect will handle redirect
    // router.replace('/auth/login');  <-- remove this line
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Hi{name ? `, ${name}` : ''} 👋</Text>
      <Text style={styles.sub}>Signed in as {email}</Text>

      <View style={styles.card}>
        <Text style={styles.sub}>Redirecting to Dashboard...</Text>
      </View>
      {/* Fallback redirect if they land here */}
      <Redirect href={((user.email && user.email.toLowerCase() === "superadmin@matchhai.com") || user._id === "jM2JZrPNNNahPb844rHmr0MQKYo1") ? "/super-admin/(tabs)" : "/(player)/(tabs)"} />

      <Pressable
        onPress={handleLogout}
        disabled={signingOut}
        style={({ pressed }) => [
          {
            backgroundColor: COLORS.accent,
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: 'center',
            marginTop: 20,
          },
          pressed && !signingOut && { opacity: 0.92 },
        ]}
        android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
      >
        {signingOut ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: COLORS.text, fontSize: 16, fontFamily: FONTS.montserratBold }}>
            Logout
          </Text>
        )}
      </Pressable>
    </View>
  );
}
