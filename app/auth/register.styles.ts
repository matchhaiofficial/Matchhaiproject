// app/auth/register.styles.ts
import { StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../../src/theme';

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },

  // ---- Stepper ----
  stepperWrapper: {
    marginBottom: 20,
  },
  stepperTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepperTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 18,
  },
  stepperSubtitle: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: 12,
  },
  stepperBar: {
    height: 4,
    borderRadius: 999,
    backgroundColor: '#3a3a3a',
    overflow: 'hidden',
  },
  stepperBarFill: {
    width: '25%', // step 1 of 4
    height: '100%',
    backgroundColor: COLORS.accent,
  },
  stepperDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  stepperDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#414141',
    marginHorizontal: 3,
  },
  stepperDotActive: {
    backgroundColor: COLORS.accent,
  },

  // ---- Headings ----
  heading: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 24,
    marginBottom: 4,
  },
  sub: {
    color: COLORS.muted,
    fontFamily: FONTS.subheading,
    fontSize: 14,
    marginBottom: 18,
  },

  // ---- Fields ----
  fieldGroup: {
    marginBottom: 12,
  },
  label: {
    color: 'rgba(253, 253, 253, 0.85)',
    fontFamily: FONTS.body,
    fontSize: 13,
    marginBottom: 4,
  },

  inputBox: {
    backgroundColor: '#2b2b2b',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prefixIcon: {
    marginRight: 8,
    opacity: 0.9,
  },
  suffixIcon: {
    marginLeft: 8,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 15,
    paddingVertical: 9,
  },

  inputBoxValidShadow: {
    shadowColor: COLORS.accent,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

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

  helperTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  helperText: {
    fontFamily: FONTS.body,
    fontSize: 11,
  },
  helperOk: {
    color: '#8bc34a',
  },
  helperWarning: {
    color: '#ffb74d',
  },
  helperError: {
    color: COLORS.error,
  },

  // ---- Button ----
  buttonShadowWrapper: {
    width: '100%',
    marginTop: 16,
  },
  buttonShadowWrapperActive: {
    shadowColor: COLORS.accent,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    backgroundColor: '#3a3a3a',
  },
  primaryBtnText: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 16,
  },

  bottomText: {
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 12,
    fontFamily: FONTS.body,
  },
});