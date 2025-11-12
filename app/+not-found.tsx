// app/+not-found.tsx
import { Link, Stack } from 'expo-router';
import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { COLORS, FONTS } from '../src/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn’t exist.</Text>
        <Link href="/auth/login" style={styles.link}>
          <Text style={styles.linkText}>Go to Login</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 22,
    marginBottom: 16,
    textAlign: 'center',
  },
  link: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
  },
  linkText: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 16,
  },
});
