import { StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../../src/theme';

export default StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background, padding: 24 },
  title: { color: COLORS.text, fontFamily: FONTS.heading, fontSize: 24, marginBottom: 6 },
  sub: { color: COLORS.muted, fontFamily: FONTS.body, fontSize: 16 },
  card: {
    marginTop: 16, backgroundColor: '#2b2b2b', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#2f2f2f',
  },
});