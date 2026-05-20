import React from "react";
import {
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextStyle,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppHeader from "./AppHeader";
import { AppIcon, type AppIconName } from "./AppIcon";
import { AppDrawer, AppModalBody, AppModalFooter, AppModalHeader } from "./AppModalPrimitives";
import { AppButton, AppCard, StatusPill } from "./AppPrimitives";
import styles from "./AdminSurface.styles";
import { COLORS, SPACING } from "../theme";

type StatusToneName = "neutral" | "info" | "success" | "warning" | "danger";

export function AdminPageHeader({
  title,
  subtitle,
  onBack,
  leftAction,
  rightAction,
  inlineTitle,
  style,
  titleStyle,
  subtitleStyle,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  inlineTitle?: boolean;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
}) {
  return (
    <AppHeader
      title={title}
      subtitle={subtitle}
      onBack={onBack}
      leftAction={leftAction}
      rightAction={rightAction}
      inlineTitle={inlineTitle}
      style={style}
      titleStyle={titleStyle}
      subtitleStyle={subtitleStyle}
    />
  );
}

export function AdminSearchFilterBar({
  value,
  onChangeText,
  placeholder = "Search",
  onFilterPress,
  activeFilterCount = 0,
  autoCapitalize = "none",
  autoCorrect = false,
  style,
  inputStyle,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  onFilterPress?: () => void;
  activeFilterCount?: number;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoCorrect?: boolean;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}) {
  const hasActiveFilters = activeFilterCount > 0;

  return (
    <View style={[styles.searchFilterRow, style]}>
      <View style={styles.searchBar}>
        <AppIcon name="search" size={20} color={COLORS.textSecondary} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          style={[styles.searchInput, inputStyle]}
        />
      </View>
      {onFilterPress ? (
        <Pressable
          onPress={onFilterPress}
          style={({ pressed }) => [styles.filterButton, pressed && styles.pressedCard]}
          accessibilityRole="button"
          accessibilityLabel="Open filters"
        >
          <AppIcon name="filters" size={20} color={COLORS.text} />
          {hasActiveFilters ? (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

export function AdminSectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  accessory,
  compact = false,
  style,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  accessory?: React.ReactNode;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionHeader, compact && styles.sectionHeaderCompact, style]}>
      <View style={styles.sectionHeaderText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {accessory}
      {actionLabel && onAction ? (
        <Pressable onPress={onAction}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function AdminMetricCard({
  label,
  value,
  subtitle,
  icon,
  iconColor,
  iconStyle,
  style,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: AppIconName;
  iconColor?: string;
  iconStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <AppCard variant="elevated" style={[styles.metricCard, style]}>
      <View style={styles.metricCardTop}>
        {icon ? (
          <View style={[styles.metricIconWrap, iconStyle]}>
            <AppIcon name={icon} size={18} color={iconColor} />
          </View>
        ) : <View />}
        <Text style={styles.metricValue}>{value}</Text>
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      {subtitle ? <Text style={styles.metricSubtitle}>{subtitle}</Text> : null}
    </AppCard>
  );
}

export function AdminQuickActionCard({
  title,
  description,
  icon,
  badgeLabel,
  iconColor,
  cardStyle,
  iconStyle,
  onPress,
}: {
  title: string;
  description: string;
  icon: AppIconName;
  badgeLabel?: string;
  iconColor?: string;
  cardStyle?: StyleProp<ViewStyle>;
  iconStyle?: StyleProp<ViewStyle>;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickActionPressable, cardStyle, pressed && styles.pressedCard]}>
      <AppCard variant="elevated" style={styles.adminQuickActionCard}>
        <View style={styles.quickActionTop}>
          <View style={[styles.quickActionIconWrap, iconStyle]}>
            <AppIcon name={icon} size={20} color={iconColor} />
          </View>
          {badgeLabel ? <StatusPill tone="neutral" label={badgeLabel} /> : null}
        </View>
        <View style={styles.quickActionTextWrap}>
          <Text style={styles.quickActionTitle} numberOfLines={2} ellipsizeMode="tail">{title}</Text>
          <Text style={styles.quickActionDescription} numberOfLines={2} ellipsizeMode="tail">{description}</Text>
        </View>
      </AppCard>
    </Pressable>
  );
}

export function AdminInfoLine({
  label,
  value,
  style,
  labelStyle,
  valueStyle,
}: {
  label: string;
  value: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  valueStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View style={[styles.infoLine, style]}>
      <Text style={[styles.infoLabel, labelStyle]}>{label}</Text>
      {typeof value === "string" || typeof value === "number" ? (
        <Text style={[styles.infoValue, valueStyle]}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

export function AdminListCard({
  title,
  subtitle,
  statusLabel,
  statusTone = "neutral",
  onPress,
  children,
  actions,
  style,
}: {
  title: string;
  subtitle?: string;
  statusLabel?: string;
  statusTone?: StatusToneName;
  onPress?: () => void;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const content = (
    <AppCard variant="elevated" style={[styles.listCard, style]}>
      <View style={styles.listCardHeader}>
        <View style={styles.listCardHeaderText}>
          <Text style={styles.listCardTitle}>{title}</Text>
          {subtitle ? <Text style={styles.listCardSubtitle}>{subtitle}</Text> : null}
        </View>
        {statusLabel ? <StatusPill tone={statusTone} label={statusLabel} /> : null}
      </View>
      {children}
      {actions ? <View style={styles.actionRow}>{actions}</View> : null}
    </AppCard>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressedCard]}>
      {content}
    </Pressable>
  );
}

export function AdminEmptyStateCard({
  title,
  description,
  icon = "inventory-2",
  style,
}: {
  title: string;
  description?: string;
  icon?: AppIconName;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <AppCard variant="empty" style={[styles.emptyCard, style]}>
      <View style={styles.emptyIconWrap}>
        <AppIcon name={icon} size={24} color="#8E8E93" />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.emptyDescription}>{description}</Text> : null}
    </AppCard>
  );
}

export function AdminEmptyState(props: {
  title: string;
  description?: string;
  icon?: AppIconName;
  style?: StyleProp<ViewStyle>;
}) {
  return <AdminEmptyStateCard {...props} />;
}

export function AdminStatusBadge({
  tone = "neutral",
  label,
  caps = true,
  style,
  textStyle,
}: {
  tone?: StatusToneName;
  label: string;
  caps?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <StatusPill
      tone={tone}
      label={label}
      caps={caps}
      style={style}
      textStyle={textStyle}
    />
  );
}

export function AdminFilterDrawer({
  visible,
  title,
  subtitle,
  activeFilterCount,
  onClose,
  onReset,
  onDone,
  resetDisabled = false,
  children,
  drawerStyle,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  activeFilterCount?: number;
  onClose: () => void;
  onReset: () => void;
  onDone: () => void;
  resetDisabled?: boolean;
  children: React.ReactNode;
  drawerStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(420, Math.round(width * 0.94));
  const resolvedSubtitle =
    subtitle ?? (typeof activeFilterCount === "number" ? `${activeFilterCount} active filters` : undefined);

  return (
    <AppDrawer
      visible={visible}
      onClose={onClose}
      drawerStyle={[
        styles.filterDrawer,
        { width: drawerWidth },
        drawerStyle,
      ]}
    >
      <View style={[styles.filterDrawerContent, { paddingTop: Math.max(insets.top, SPACING.md) }]}>
        <AppModalHeader
          title={title}
          subtitle={resolvedSubtitle}
          onClose={onClose}
          compact
        />
        <AppModalBody scroll contentContainerStyle={styles.filterDrawerBody}>
          {children}
        </AppModalBody>
        <AppModalFooter>
          <View style={styles.filterDrawerFooterRow}>
            <AppButton
              variant="secondary"
              style={styles.filterDrawerFooterButton}
              onPress={onReset}
              disabled={resetDisabled}
            >
              Reset
            </AppButton>
            <AppButton style={styles.filterDrawerFooterButton} onPress={onDone}>
              Done
            </AppButton>
          </View>
        </AppModalFooter>
      </View>
    </AppDrawer>
  );
}
