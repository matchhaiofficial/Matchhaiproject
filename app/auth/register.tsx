import React, { useState } from 'react';
import { View, Text, TextInput, Platform, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { Link, router } from 'expo-router';
import LogoHalo from '../../src/components/LogoHalo';
import { COLORS } from '../../src/theme';
import styles from './login.styles'; // ✅ reuse same styles or make separate
import { signUpWithEmail } from '../../src/services/authService';

export default function Register() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focused, setFocused] = useState<{ [k: string]: boolean }>({});
  const [loading, setLoading] = useState(false);

  const Container: any = Platform.OS === 'ios' ? require('react-native').KeyboardAvoidingView : View;
  const containerProps =
    Platform.OS === 'ios'
      ? { style: styles.screen, behavior: 'padding' as const }
      : { style: styles.screen };

  const handleRegister = async () => {
    if (!displayName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing info', 'Please fill all fields.');
      return;
    }

    setLoading(true);
    const res = await signUpWithEmail(email, password, displayName);
    setLoading(false);

    if (!res.ok) {
      Alert.alert('Sign Up Failed', res.message);
      return;
    }

    // ✅ go to home
    router.replace('/home');
  };

  return (
    <Container {...containerProps}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: 32 }]}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      >
        <LogoHalo />

        <Text style={styles.heading}>Create Account</Text>
        <Text style={styles.sub}>Join MatchHai today</Text>

        {/* Name */}
        <View style={[styles.inputBox, { position: 'relative' }]}>
          <TextInput
            placeholder="Full Name"
            placeholderTextColor={COLORS.muted}
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            onFocus={() => setFocused({ ...focused, name: true })}
            onBlur={() => setFocused({ ...focused, name: false })}
          />
          <View style={[styles.focusBar, { opacity: focused.name ? 1 : 0 }]} />
        </View>

        {/* Email */}
        <View style={[styles.inputBox, { position: 'relative' }]}>
          <TextInput
            placeholder="Email"
            placeholderTextColor={COLORS.muted}
            style={styles.input}
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocused({ ...focused, email: true })}
            onBlur={() => setFocused({ ...focused, email: false })}
          />
          <View style={[styles.focusBar, { opacity: focused.email ? 1 : 0 }]} />
        </View>

        {/* Password */}
        <View style={[styles.inputBox, { position: 'relative' }]}>
          <TextInput
            placeholder="Password"
            placeholderTextColor={COLORS.muted}
            style={styles.input}
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocused({ ...focused, pass: true })}
            onBlur={() => setFocused({ ...focused, pass: false })}
          />
          <View style={[styles.focusBar, { opacity: focused.pass ? 1 : 0 }]} />
        </View>

        <Pressable
          onPress={handleRegister}
          disabled={loading}
          style={({ pressed }) => [styles.primaryBtn, pressed && !loading && { opacity: 0.92 }]}
          android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Sign Up</Text>
          )}
        </Pressable>

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
