// app/+not-found.tsx
import { Link, Stack } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import styles from './NotFound.styles';

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

