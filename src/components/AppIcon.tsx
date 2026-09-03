import React from "react";
import { StyleProp } from "react-native";
import type { SvgProps } from "react-native-svg";

import { AppIcons, type AppIconName } from "../theme/icons";
import { COLORS, STATUS_TONES } from "../theme";

export type { AppIconName } from "../theme/icons";

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
  strokeWidth = 2,
  decorative = true,
  style,
}: {
  name: AppIconName | string;
  size?: AppIconSize;
  tone?: AppIconTone;
  surface?: AppIconSurface;
  color?: string;
  strokeWidth?: number;
  decorative?: boolean;
  style?: StyleProp<any>;
}) {
  const Icon = AppIcons[name as AppIconName];

  if (!Icon) return null;

  return (
    <Icon
      size={resolveSize(size)}
      color={color ?? resolveColor(tone, surface)}
      strokeWidth={strokeWidth}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? "no" : "auto"}
      style={style}
    />
  );
}
