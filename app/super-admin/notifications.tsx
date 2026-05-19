import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import AppHeader from "../../src/components/AppHeader";
import { AdminEmptyStateCard } from "../../src/components/AdminSurface";
import { AppIcon } from "../../src/components/AppIcon";
import { AppCard, StatusPill } from "../../src/components/AppPrimitives";
import Screen from "../../src/components/Screen";
import { useToast } from "../../src/hooks/useToast";
import {
  archiveSuperAdminNotification,
  getSuperAdminNotifications,
  markSuperAdminNotificationRead,
  type SuperAdminNotification,
  type SuperAdminNotificationTab,
} from "../../src/services/convex/superAdminService";
import { COLORS, FONTS, RADII, SPACING } from "../../src/theme";

function formatDate(value?: number) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

function labelForType(type?: string) {
  return String(type || "notification").replace(/[._-]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function NotificationCard({
  item,
  onArchive,
  onMarkRead,
  onOpen,
}: {
  item: SuperAdminNotification;
  onArchive: (item: SuperAdminNotification) => void;
  onMarkRead: (item: SuperAdminNotification) => void;
  onOpen: (item: SuperAdminNotification) => void;
}) {
  const route = item.route || String(item.data?.href || item.data?.route || "");
  return (
    <AppCard variant="elevated" style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconWrap}>
          <AppIcon name={item.isRead ? "notifications-none" : "notifications-active"} size={20} color={COLORS.accent} />
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{item.title || labelForType(item.type)}</Text>
          <Text style={styles.meta}>{formatDate(item.createdAt)}</Text>
        </View>
        <StatusPill tone={item.isRead ? "neutral" : "warning"} label={item.isRead ? "Read" : "Unread"} />
      </View>
      {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
      <View style={styles.metaRow}>
        <Text style={styles.typeText}>{labelForType(item.type)}</Text>
        {route ? <Text style={styles.routeText} numberOfLines={1}>{route}</Text> : null}
      </View>
      <View style={styles.actions}>
        {route ? (
          <Pressable style={styles.actionButton} onPress={() => onOpen(item)}>
            <Text style={styles.actionText}>Open</Text>
          </Pressable>
        ) : null}
        {!item.isRead ? (
          <Pressable style={styles.actionButton} onPress={() => onMarkRead(item)}>
            <Text style={styles.actionText}>Mark read</Text>
          </Pressable>
        ) : null}
        <Pressable style={[styles.actionButton, styles.archiveButton]} onPress={() => onArchive(item)}>
          <Text style={[styles.actionText, styles.archiveText]}>Archive</Text>
        </Pressable>
      </View>
    </AppCard>
  );
}

export default function SuperAdminNotificationsScreen() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<SuperAdminNotificationTab>("unread");
  const [items, setItems] = useState<SuperAdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    const result = await getSuperAdminNotifications(tab, { forceRefresh: mode === "refresh" });
    if (result.ok) {
      setItems(result.data);
    } else {
      showToast({ type: "error", title: "Notifications failed", message: result.message });
    }
    if (mode === "initial") setLoading(false);
    else setRefreshing(false);
  }, [showToast, tab]);

  useFocusEffect(useCallback(() => {
    void load("initial");
  }, [load]));

  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items]);

  const markRead = useCallback(async (item: SuperAdminNotification) => {
    if (item.isRead || busyId) return;
    setBusyId(item.id);
    const result = await markSuperAdminNotificationRead(item.id);
    setBusyId(null);
    if (!result.ok) {
      showToast({ type: "error", title: "Update failed", message: result.message });
      return;
    }
    setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, isRead: true } : candidate));
  }, [busyId, showToast]);

  const archive = useCallback(async (item: SuperAdminNotification) => {
    if (busyId) return;
    setBusyId(item.id);
    const result = await archiveSuperAdminNotification(item.id);
    setBusyId(null);
    if (!result.ok) {
      showToast({ type: "error", title: "Archive failed", message: result.message });
      return;
    }
    setItems((current) => current.filter((candidate) => candidate.id !== item.id));
  }, [busyId, showToast]);

  const openNotification = useCallback(async (item: SuperAdminNotification) => {
    const route = item.route || String(item.data?.href || item.data?.route || "");
    if (!route) return;
    if (!item.isRead) await markRead(item);
    router.push(route as any);
  }, [markRead]);

  return (
    <Screen style={styles.screen} scroll={false} edges={["top"]}>
      <AppHeader title="Notifications" subtitle="Super Admin inbox" onBack={() => router.back()} inlineTitle />
      <View style={styles.tabs}>
        {(["unread", "read"] as const).map((nextTab) => (
          <Pressable
            key={nextTab}
            onPress={() => setTab(nextTab)}
            style={[styles.tabButton, tab === nextTab && styles.tabButtonActive]}
          >
            <Text style={[styles.tabText, tab === nextTab && styles.tabTextActive]}>
              {nextTab === "unread" ? `Unread${tab === "unread" && unreadCount ? ` (${unreadCount})` : ""}` : "Read"}
            </Text>
          </Pressable>
        ))}
      </View>
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} tintColor={COLORS.accent} />}
          showsVerticalScrollIndicator={false}
        >
          {items.length === 0 ? (
            <AdminEmptyStateCard
              title={tab === "unread" ? "No unread notifications" : "No read notifications"}
              description="Super Admin operational alerts will appear here."
              icon="notifications"
            />
          ) : (
            items.map((item) => (
              <NotificationCard
                key={item.id}
                item={item}
                onArchive={archive}
                onMarkRead={markRead}
                onOpen={openNotification}
              />
            ))
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: COLORS.backgroundDark,
  },
  tabs: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.cardDark,
  },
  tabButtonActive: {
    borderColor: COLORS.accent,
    backgroundColor: `${COLORS.accent}18`,
  },
  tabText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.medium,
  },
  tabTextActive: {
    color: COLORS.text,
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    gap: SPACING.md,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  card: {
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${COLORS.accent}18`,
    borderWidth: 1,
    borderColor: `${COLORS.accent}44`,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    color: COLORS.text,
    fontFamily: FONTS.bold,
    fontSize: 16,
  },
  meta: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: 12,
    marginTop: 2,
  },
  body: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    gap: 4,
  },
  typeText: {
    color: COLORS.accent,
    fontFamily: FONTS.medium,
    fontSize: 12,
  },
  routeText: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: 12,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  actionButton: {
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  actionText: {
    color: COLORS.text,
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
  archiveButton: {
    borderColor: `${COLORS.error}55`,
  },
  archiveText: {
    color: COLORS.error,
  },
});
