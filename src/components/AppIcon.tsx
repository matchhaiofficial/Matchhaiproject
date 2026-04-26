import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { StyleProp, TextStyle } from "react-native";

import { COLORS, STATUS_TONES } from "../theme";

export type AppIconName = keyof typeof MaterialIcons.glyphMap;
export type AppIconTone =
  | "default"
  | "muted"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "inverse";
export type AppIconSurface = "default" | "subtle" | "strong" | "inverse";
export type AppIconSize = "xs" | "sm" | "md" | "lg" | "xl" | number;

const ICON_SIZE_MAP = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} satisfies Record<Exclude<AppIconSize, number>, number>;

function resolveSize(size: AppIconSize) {
  return typeof size === "number" ? size : ICON_SIZE_MAP[size];
}

function resolveColor(tone: AppIconTone, surface: AppIconSurface) {
  if (surface === "inverse" || tone === "inverse") return "#FFFFFF";
  if (tone === "accent") return COLORS.accent;
  if (tone === "muted") return COLORS.textSecondary;
  if (tone === "success") return STATUS_TONES.success.text;
  if (tone === "warning") return STATUS_TONES.warning.text;
  if (tone === "danger") return STATUS_TONES.danger.text;
  if (surface === "strong") return COLORS.text;
  if (surface === "subtle") return COLORS.textSecondary;
  return COLORS.text;
}

export function AppIcon({
  name,
  size = "md",
  tone = "default",
  surface = "default",
  color,
  decorative = true,
  style,
}: {
  name: AppIconName;
  size?: AppIconSize;
  tone?: AppIconTone;
  surface?: AppIconSurface;
  color?: string;
  decorative?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <MaterialIcons
      name={name}
      size={resolveSize(size)}
      color={color ?? resolveColor(tone, surface)}
      accessible={!decorative}
      importantForAccessibility={decorative ? "no" : "auto"}
      style={style}
    />
  );
}
