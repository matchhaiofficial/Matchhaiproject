import React from "react";
import {
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  View,
} from "react-native";

import { AppCard } from "./AppPrimitives";
import styles from "./DetailSurface.styles";

type DetailSectionHeaderProps = {
  title: string;
  subtitle?: string;
  accessory?: React.ReactNode;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

type DetailSectionCardProps = DetailSectionHeaderProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

type DetailKeyValueRowProps = {
  label: string;
  value: React.ReactNode;
  valueTone?: "default" | "accent" | "success" | "warning" | "danger";
  last?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  valueStyle?: StyleProp<TextStyle>;
};

export function DetailSectionHeader({
  title,
  subtitle,
  accessory,
  compact = false,
  style,
}: DetailSectionHeaderProps) {
  return (
    <View
      style={[
        styles.sectionHeader,
        compact && styles.sectionHeaderCompact,
        style,
      ]}
    >
      <View style={styles.sectionHeaderText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {accessory}
    </View>
  );
}

export function DetailSectionCard({
  title,
  subtitle,
  accessory,
  children,
  style,
  contentStyle,
}: DetailSectionCardProps) {
  return (
    <AppCard variant="elevated" style={[styles.sectionCard, style]}>
      <DetailSectionHeader
        title={title}
        subtitle={subtitle}
        accessory={accessory}
        compact
      />
      <View style={contentStyle}>{children}</View>
    </AppCard>
  );
}

export function DetailKeyValueRow({
  label,
  value,
  valueTone = "default",
  last = false,
  style,
  labelStyle,
  valueStyle,
}: DetailKeyValueRowProps) {
  const toneStyle =
    valueTone === "accent"
      ? styles.keyValueValueAccent
      : valueTone === "success"
        ? styles.keyValueValueSuccess
        : valueTone === "warning"
          ? styles.keyValueValueWarning
          : valueTone === "danger"
            ? styles.keyValueValueDanger
            : null;

  return (
    <View style={[styles.keyValueRow, last && styles.keyValueRowLast, style]}>
      <Text style={[styles.keyValueLabel, labelStyle]}>{label}</Text>
      {typeof value === "string" || typeof value === "number" ? (
        <Text style={[styles.keyValueValue, toneStyle, valueStyle]}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}
