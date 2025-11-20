// src/components/ToastHost.styles.ts
import { StyleSheet } from "react-native";
import {
    COLORS,
    FONTS,
    RADII,
    SHADOWS,
    SPACING,
    TEXT_SIZES,
} from "../src/theme";

export const toastStyles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: SPACING.xxl,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999,
  },
  toast: {
    maxWidth: "90%",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADII.md,
    backgroundColor: COLORS.cardBackground,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    ...SHADOWS.accentSoft,
  },
  title: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.label,
    marginBottom: 2,
  },
  message: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
  },
});
