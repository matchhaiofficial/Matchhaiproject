// app/auth/login.styles.ts
import { StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../../src/theme';

export default StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },

  heading: { color: COLORS.text, fontFamily: FONTS.heading, fontSize: 28, marginBottom: 6 },
  sub: { color: COLORS.muted, fontFamily: FONTS.subheading, fontSize: 16, marginBottom: 18 },

  inputBox: {
    backgroundColor: '#2b2b2b',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 2,     // TextInput has its own vertical padding
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2f2f2f',
  },
  input: { color: COLORS.text, fontFamily: FONTS.body, fontSize: 16, paddingVertical: 12 },

  // thin accent bar (no layout reflow)
  focusBar: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 6,
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.accent,
    opacity: 0,
  },

  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: COLORS.accent,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  primaryBtnText: { color: COLORS.text, fontFamily: FONTS.heading, fontSize: 16 },
  bottomText: { color: COLORS.muted, textAlign: 'center', marginTop: 16, fontFamily: FONTS.body },
});
