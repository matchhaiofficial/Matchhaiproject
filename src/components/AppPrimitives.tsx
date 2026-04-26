import React from "react";
import {
  Pressable,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import Animated from "react-native-reanimated";

import { COLORS, STATUS_TONES } from "../theme";
import { AppIcon, type AppIconName, type AppIconTone } from "./AppIcon";
import { usePressScale } from "../motion/usePressScale";
import { Perf, PerfScope } from "../utils/perfInstrumentation";
import styles from "./AppPrimitives.styles";

type CardVariant = "default" | "soft" | "elevated" | "empty";
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";
type StatusTone = keyof typeof STATUS_TONES;
type ButtonPerfConfig = {
  actionKey: string;
  toRouteKey?: string;
  meta?: Record<string, unknown>;
};

export function AppCard({
  children,
  style,
  variant = "default",
  ...rest
}: ViewProps & {
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      {...rest}
      style={[
        styles.cardBase,
        variant === "soft" && styles.cardSoft,
        variant === "elevated" && styles.cardElevated,
        variant === "empty" && styles.cardEmpty,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function AppButton({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  leadingIcon,
  trailingIcon,
  iconTone,
  style,
  textStyle,
  perf,
  ...rest
}: Omit<PressableProps, "style"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: AppIconName;
  trailingIcon?: AppIconName;
  iconTone?: AppIconTone;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  children: React.ReactNode;
  perf?: ButtonPerfConfig;
}) {
  const isDisabled = disabled || loading;
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const textVariantStyle =
    variant === "primary"
      ? styles.buttonTextPrimary
      : variant === "danger"
        ? styles.buttonTextDanger
        : variant === "success"
          ? styles.buttonTextSuccess
          : variant === "ghost"
            ? styles.buttonTextGhost
            : styles.buttonTextSecondary;

  const handlePress: PressableProps["onPress"] = (event) => {
    if (!rest.onPress) return;
    if (!perf || !__DEV__) {
      return rest.onPress(event);
    }

    const cid = Perf.newCid();
    if (perf.toRouteKey) {
      Perf.markNav({
        routeKey: perf.toRouteKey,
        cid,
        meta: {
          actionKey: perf.actionKey,
          ...(perf.meta || {}),
        },
      });
    }

    return PerfScope.run(cid, () =>
      Perf.measureAsync(`Action.${perf.actionKey}`, () => Promise.resolve(rest.onPress?.(event)), {
        cid,
        actionKey: perf.actionKey,
        meta: perf.meta,
      }),
    );
  };

  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      onPress={handlePress}
      onPressIn={(event) => {
        onPressIn();
        rest.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        onPressOut();
        rest.onPressOut?.(event);
      }}
      style={[
        styles.buttonBase,
        size === "sm" && styles.buttonSm,
        size === "md" && styles.buttonMd,
        size === "lg" && styles.buttonLg,
        variant === "primary" && styles.buttonPrimary,
        variant === "secondary" && styles.buttonSecondary,
        variant === "ghost" && styles.buttonGhost,
        variant === "danger" && styles.buttonDanger,
        variant === "success" && styles.buttonSuccess,
        isDisabled && styles.buttonDisabled,
        style,
      ]}
    >
      <Animated.View style={[styles.buttonContent, animatedStyle]}>
        {leadingIcon ? (
          <AppIcon
            name={leadingIcon}
            size="sm"
            tone={iconTone ?? (variant === "primary" ? "inverse" : "default")}
          />
        ) : null}
        {typeof children === "string" ? (
          <Text style={[styles.buttonTextBase, textVariantStyle, textStyle]}>{children}</Text>
        ) : (
          children
        )}
        {trailingIcon ? (
          <AppIcon
            name={trailingIcon}
            size="sm"
            tone={iconTone ?? (variant === "primary" ? "inverse" : "default")}
          />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

export function StatusPill({
  tone = "neutral",
  label,
  caps = true,
  style,
  textStyle,
}: {
  tone?: StatusTone;
  label: string;
  caps?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const toneStyles = STATUS_TONES[tone];

  return (
    <View
      style={[
        styles.pillBase,
        {
          borderColor: toneStyles.border,
          backgroundColor: toneStyles.background,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.pillText,
          !caps && styles.pillTextNoCaps,
          { color: toneStyles.text },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}
