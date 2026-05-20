import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { AdminEmptyStateCard, AdminListCard, AdminPageHeader } from "../../src/components/AdminSurface";
import Screen from "../../src/components/Screen";
import SegmentedTabs from "../../src/components/SegmentedTabs";
import { useTabBarClearance } from "../../src/hooks/useTabBarClearance";
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
    <AdminListCard
      title={item.title || labelForType(item.type)}
      subtitle={formatDate(item.createdAt)}
      statusLabel={item.isRead ? "Read" : "Unread"}
      statusTone={item.isRead ? "neutral" : "warning"}
    >
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
    </AdminListCard>
  );
}

export default function SuperAdminNotificationsScreen() {
  const { showToast } = useToast();
  const bottomContentPadding = useTabBarClearance(SPACING.lg);
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
      <AdminPageHeader title="Notifications" subtitle="Super Admin inbox" onBack={() => router.back()} inlineTitle />
      <SegmentedTabs
        items={[
          { key: "unread", label: "Unread", badge: tab === "unread" && unreadCount ? unreadCount : undefined },
          { key: "read", label: "Read" },
        ]}
        value={tab}
        onChange={(value) => setTab(value as SuperAdminNotificationTab)}
        style={styles.tabs}
      />
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding }]}
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
    marginBottom: SPACING.md,
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    gap: SPACING.md,
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
