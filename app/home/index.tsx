// app/home/index.tsx
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { signOutUser } from '../../src/services/authService';
import { COLORS } from '../../src/theme';
import styles from './home.styles';

export default function Home() {
  const { user, loading } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  // ✅ Redirect away when user becomes null (after logout)
  useEffect(() => {
    if (!loading && !user) {
      console.log("[Home] mounted / updated", { loading, hasUser: !!user });
      router.replace('/auth/login');
    }
  }, [loading, user]);

    // ✅ Redirect away when user becomes null (after logout)
  useEffect(() => {
    if (!loading && !user) {
      console.log("[Home] no user → redirecting to /auth/login");
      router.replace("/auth/login");
    }
  }, [loading, user]);

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

  const name = user.displayName || '';
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
        <Text style={styles.sub}>Welcome to MatchHai v0.</Text>
        <Text style={styles.sub}>Next: Matchrooms, zones, and court bookings.</Text>
      </View>

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
          <Text style={{ color: COLORS.text, fontSize: 16, fontFamily: 'Montserrat_700Bold' }}>
            Logout
          </Text>
        )}
      </Pressable>
    </View>
  );
}
