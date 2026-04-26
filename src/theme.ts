// src/theme.ts

// 🎨 Colors
export const COLORS = {
  background: '#252525',
  accent: '#42a5f5',
  text: '#fdfdfd',
  muted: '#bdbdbd',
  surface: '#303030',
  error: '#ef5350',
  surfaceHighlight: '#3d3d3d',
  disabled: '#555555',

  // neutrals used across inputs / cards / dividers
  inputBackground: '#2b2b2b',
  inputBorder: '#3a3a3a',
  cardBackground: '#1f1f1f',
  divider: '#333333',

  // overlays
  overlayLight: 'rgba(255,255,255,0.05)',
  overlayMedium: 'rgba(255,255,255,0.1)',

  // success / status
  success: '#4caf50', // ✅ system green for strength + checks
  warning: '#FFC107', // ⚠️ warning yellow

  // gaming-specific colors
  backgroundDark: '#121212', // deeper black for gaming UI
  cardDark: '#1E1E1E', // darker cards
  cardBorder: '#333333', // subtle borders
  textSecondary: '#AAAAAA', // softer muted text
  successBright: '#00E676', // brighter success green for gaming

  // social brand accents (can reuse in other places later)
  steamBorder: '#66c0f4',
  faceitBorder: '#ff5500',
  eaBorder: '#5c2d91',
  xboxBorder: '#107c10',
  psBorder: '#00439c',
};

export const SURFACES = {
  page: COLORS.backgroundDark,
  card: COLORS.cardDark,
  cardAlt: COLORS.cardBackground,
  muted: COLORS.overlayLight,
  strong: COLORS.surface,
};

// 🔤 Fonts
export const FONTS = {
  // Semantic
  heading: 'Montserrat_700Bold',
  subheading: 'Lora_400Regular',
  body: 'Martel_400Regular',
  bold: 'Montserrat_700Bold',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  clean: 'Inter_500Medium',
  serif: 'Martel_400Regular',

  // Manual Control (Montserrat)
  montserratRegular: 'Montserrat_400Regular',
  montserratMedium: 'Montserrat_500Medium',
  montserratSemiBold: 'Montserrat_600SemiBold',
  montserratBold: 'Montserrat_700Bold',

  // Manual Control (Inter)
  interRegular: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  interSemiBold: 'Inter_600SemiBold', // Ensure loaded in _layout
  interBold: 'Inter_700Bold',       // Ensure loaded in _layout

  // Manual Control (Others)
  loraRegular: 'Lora_400Regular',
  martelRegular: 'Martel_400Regular',
};

// 📏 Spacing scale (8pt-ish system)
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,

  screenPadding: 24,
};

// ⭕ Border radius tokens
export const RADII = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  pill: 999,
};

export const CONTROL_SIZES = {
  buttonSm: 40,
  buttonMd: 48,
  buttonLg: 56,
  inputMd: 48,
  chipSm: 28,
  chipMd: 32,
  cardRadius: 16,
  sheetRadius: 24,
};

// 🔠 Text sizes
export const TEXT_SIZES = {
  heading: 28,
  subheading: 16,
  body: 15,
  label: 14,
  input: 16,
  caption: 12,

  // New sizes
  xs: 10,
  lg: 18,
  xl: 20,
  xxl: 24,
};

// 🌫 Common shadows (RN-only, web will just ignore)
export const SHADOWS = {
  accentSoft: {
    shadowColor: COLORS.accent,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  accentStrong: {
    shadowColor: COLORS.accent,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  cardElevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8, // Increased for Android
  },
  cardSoft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // Increased for Android
  },
};

export const STATUS_TONES = {
  neutral: {
    text: COLORS.text,
    border: COLORS.cardBorder,
    background: COLORS.overlayLight,
  },
  info: {
    text: COLORS.accent,
    border: `${COLORS.accent}55`,
    background: `${COLORS.accent}14`,
  },
  success: {
    text: COLORS.successBright,
    border: `${COLORS.successBright}55`,
    background: `${COLORS.successBright}14`,
  },
  warning: {
    text: COLORS.warning,
    border: `${COLORS.warning}55`,
    background: `${COLORS.warning}14`,
  },
  danger: {
    text: COLORS.error,
    border: `${COLORS.error}55`,
    background: `${COLORS.error}14`,
  },
};

// Primary CTA button system (shared across player/admin create flows)
export const CTA = {
  primaryButton: {
    minHeight: 54,
    borderRadius: RADII.xl,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: COLORS.accent,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    ...SHADOWS.accentStrong,
  },
  primaryButtonDisabled: {
    backgroundColor: COLORS.disabled,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  primaryButtonPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.988 }],
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: FONTS.interSemiBold,
    fontSize: TEXT_SIZES.body + 1,
    letterSpacing: 0.2,
  },
  fabButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: COLORS.accent,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    ...SHADOWS.accentStrong,
  },
};

// 📦 Input Padding (for inputs with right-side icons)
export const INPUT_PADDING = {
  default: 12, // No icon on right
  withIcon: 32, // Small icon (status indicators)
  withToggle: 36, // Visibility toggle icon
  withSuffix: 100, // Text suffix like "@gmail.com"
};
