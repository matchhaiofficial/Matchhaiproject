import React, { useState } from 'react';
import { View, Text, TextInput, Platform, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { Link, router } from 'expo-router';   // ✅ add router
import LogoHalo from '../../src/components/LogoHalo';
import { COLORS } from '../../src/theme';
import styles from './login.styles';

// ✅ auth service
import { signInWithEmail } from '../../src/services/authService';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  const Container: any = Platform.OS === 'ios' ? require('react-native').KeyboardAvoidingView : View;
  const containerProps =
    Platform.OS === 'ios'
      ? { style: styles.screen, behavior: 'padding' as const }
      : { style: styles.screen };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing info', 'Please enter email and password.');
      return;
    }

    setLoading(true);

    const res = await signInWithEmail(email, password);
    setLoading(false);

    if (!res.ok) {
      Alert.alert('Sign In Failed', res.message);
      return;
    }

    // ✅ Redirect on success
    router.replace('/home');
  };

  return (
    <Container {...containerProps}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: 32 }]}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode={Platform.OS === 'ios' ? 'on-drag' : 'none'}
        showsVerticalScrollIndicator={false}
      >
        <LogoHalo />

        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.sub}>Sign in to MatchHai</Text>

        {/* Email */}
        <View style={[styles.inputBox, { position: 'relative' }]}>
          <TextInput
            placeholder="Email"
            placeholderTextColor={COLORS.muted}
            style={styles.input}
            selectionColor={COLORS.accent}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
          />
          <View style={[styles.focusBar, { opacity: emailFocused ? 1 : 0 }]} />
        </View>

        {/* Password */}
        <View style={[styles.inputBox, { position: 'relative' }]}>
          <TextInput
            placeholder="Password"
            placeholderTextColor={COLORS.muted}
            style={styles.input}
            selectionColor={COLORS.accent}
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
            onFocus={() => setPassFocused(true)}
            onBlur={() => setPassFocused(false)}
          />
          <View style={[styles.focusBar, { opacity: passFocused ? 1 : 0 }]} />
        </View>

        <Pressable
          onPress={handleLogin}
          disabled={loading}
          style={({ pressed }) => [styles.primaryBtn, pressed && !loading && { opacity: 0.92 }]}
          android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Sign In</Text>
          )}
        </Pressable>

        <Text style={styles.bottomText}>
          New here?{' '}
          <Link href="/auth/register" style={{ color: COLORS.accent }}>
            Create an account
          </Link>
        </Text>
      </ScrollView>
    </Container>
  );
}
