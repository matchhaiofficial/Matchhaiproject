// app/home.tsx
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../src/theme';

export default function Home() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Home</Text>
      <Text style={styles.body}>Welcome to MatchHai</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, backgroundColor: COLORS.background, justifyContent: 'center' },
  heading: { color: COLORS.text, fontFamily: FONTS.heading, fontSize: 28, marginBottom: 8 },
  body: { color: COLORS.text, fontFamily: FONTS.body, fontSize: 16 },
});
