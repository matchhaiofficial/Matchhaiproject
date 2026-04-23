import React from "react";
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { AppCard } from "../../../components/AppPrimitives";
import { AppIcon, type AppIconName } from "../../../components/AppIcon";
import { COLORS } from "../../../theme";
import styles from "../styles/shared.styles";

type DiscoverChipOption = string | { key: string; label: string };

export const discoverSharedStyles = styles;
type DiscoverTone = "accent" | "neutral" | "success" | "warning" | "danger" | "ghost";

function getOptionKey(option: DiscoverChipOption) {
  return typeof option === "string" ? option : option.key;
}

function getOptionLabel(option: DiscoverChipOption) {
  return typeof option === "string" ? option : option.label;
}

export function DiscoverFilterRow({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: DiscoverChipOption[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterLabel}>{label}</Text>
      <DiscoverChipScroller options={options} selected={selected} onSelect={onSelect} />
    </View>
  );
}

export function DiscoverChipScroller({
  options,
  selected,
  onSelect,
  chipStyle,
}: {
  options: DiscoverChipOption[];
  selected: string;
  onSelect: (value: string) => void;
  chipStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={styles.filterOptionsWrap}>
      {options.map((option) => {
        const optionKey = getOptionKey(option);
        const isSelected = selected === optionKey;

        return (
          <Pressable
            key={optionKey}
            onPress={() => onSelect(optionKey)}
            style={({ pressed }) => [
              styles.optionChip,
              chipStyle,
              isSelected && styles.optionChipActive,
              pressed && styles.optionChipPressed,
            ]}
          >
            <Text style={[styles.optionChipText, isSelected && styles.optionChipTextActive]}>
              {getOptionLabel(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DiscoverResultsCount({ label }: { label: string }) {
  return (
    <View style={styles.resultsCount}>
      <Text style={styles.resultsCountText}>{label}</Text>
    </View>
  );
}

export function DiscoverEmptyState({
  icon,
  title,
  description,
  iconSize = 48,
}: {
  icon: AppIconName;
  title: string;
  description: string;
  iconSize?: number;
}) {
  return (
    <View style={styles.emptyState}>
      <AppIcon name={icon} size={iconSize} tone="muted" style={styles.emptyIcon} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{description}</Text>
    </View>
  );
}

export function DiscoverPressableCard({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  if (!onPress) {
    return (
      <AppCard variant="elevated" style={[styles.discoverCard, style]}>
        {children}
      </AppCard>
    );
  }

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <AppCard
          variant="elevated"
          style={[styles.discoverCard, pressed && styles.discoverCardPressed, style]}
        >
          {children}
        </AppCard>
      )}
    </Pressable>
  );
}

export function DiscoverTag({
  label,
  tone = "neutral",
  style,
}: {
  label: string;
  tone?: DiscoverTone;
  style?: StyleProp<ViewStyle>;
}) {
  const containerTone =
    tone === "accent"
      ? styles.inlineTagAccent
      : tone === "success"
        ? styles.inlineTagSuccess
        : tone === "warning"
          ? styles.inlineTagWarning
          : tone === "danger"
            ? styles.inlineTagDanger
            : tone === "ghost"
              ? styles.inlineTagGhost
              : styles.inlineTagNeutral;
  const textTone =
    tone === "accent"
      ? styles.inlineTagTextAccent
      : tone === "success"
        ? styles.inlineTagTextSuccess
        : tone === "warning"
          ? styles.inlineTagTextWarning
          : tone === "danger"
            ? styles.inlineTagTextDanger
            : tone === "ghost"
              ? styles.inlineTagTextGhost
              : styles.inlineTagTextNeutral;

  return (
    <View style={[styles.inlineTag, containerTone, style]}>
      <Text style={[styles.inlineTagText, textTone]}>{label}</Text>
    </View>
  );
}

export function DiscoverActionChip({
  label,
  tone = "accent",
  icon,
  onPress,
  disabled = false,
  style,
}: {
  label: string;
  tone?: Exclude<DiscoverTone, "ghost">;
  icon?: AppIconName;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const containerTone =
    tone === "success"
      ? styles.actionChipSuccess
      : tone === "warning"
        ? styles.actionChipWarning
        : tone === "danger"
          ? styles.actionChipDanger
          : tone === "neutral"
            ? styles.actionChipNeutral
            : styles.actionChipAccent;
  const textTone =
    tone === "success"
      ? styles.actionChipTextSuccess
      : tone === "warning"
        ? styles.actionChipTextWarning
        : tone === "danger"
          ? styles.actionChipTextDanger
          : tone === "neutral"
            ? styles.actionChipTextNeutral
            : styles.actionChipTextAccent;
  const iconColor =
    tone === "success"
      ? COLORS.success
      : tone === "warning"
        ? COLORS.warning
        : tone === "danger"
          ? COLORS.error
          : tone === "neutral"
            ? COLORS.text
            : COLORS.accent;

  const content = (
    <>
      {icon ? <AppIcon name={icon} size={14} color={iconColor} /> : null}
      <Text style={[styles.actionChipText, textTone]}>{label}</Text>
    </>
  );

  if (!onPress) {
    return <View style={[styles.actionChip, containerTone, style]}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionChip,
        containerTone,
        style,
        pressed && !disabled && styles.actionChipPressed,
        disabled && styles.discoverCardPressed,
      ]}
    >
      {content}
    </Pressable>
  );
}
