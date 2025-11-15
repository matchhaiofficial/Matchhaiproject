// src/theme.ts

// 🎨 Colors
export const COLORS = {
  background: '#252525',
  accent: '#42a5f5',
  text: '#fdfdfd',
  muted: '#bdbdbd',
  surface: '#303030',
  error: '#ef5350',

  // neutrals used across inputs / cards / dividers
  inputBackground: '#2b2b2b',
  inputBorder: '#3a3a3a',
  cardBackground: '#1f1f1f',
  divider: '#333333',

  // social brand accents (can reuse in other places later)
  steamBorder: '#66c0f4',
  faceitBorder: '#ff5500',
  eaBorder: '#5c2d91',
  xboxBorder: '#107c10',
  psBorder: '#00439c',
};

// 🔤 Fonts
export const FONTS = {
  heading: 'Montserrat_700Bold',
  subheading: 'Lora_400Regular',
  body: 'Martel_400Regular',
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
  sm: 8,
  md: 12,
  lg: 14,
};

// 🔠 Text sizes
export const TEXT_SIZES = {
  heading: 28,
  subheading: 16,
  body: 15,
  label: 14,
  input: 16,
  caption: 12,
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
};