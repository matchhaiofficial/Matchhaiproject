import React from "react";
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { AppIcon, type AppIconName } from "./AppIcon";
import { AppCard, StatusPill } from "./AppPrimitives";
import styles from "./AdminSurface.styles";

type StatusToneName = "neutral" | "info" | "success" | "warning" | "danger";

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
