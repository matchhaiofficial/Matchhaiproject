import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import AppHeader from "../../src/components/AppHeader";
import { AdminEmptyStateCard, AdminInfoLine, AdminListCard } from "../../src/components/AdminSurface";
import { AppIcon } from "../../src/components/AppIcon";
import { AppButton } from "../../src/components/AppPrimitives";
import Screen from "../../src/components/Screen";
import SegmentedTabs from "../../src/components/SegmentedTabs";
import { useTabBarClearance } from "../../src/hooks/useTabBarClearance";
import { useToast } from "../../src/hooks/useToast";
import {
  getUsers,
  setUserSuspension,
  type SuperAdminUser,
} from "../../src/services/convex/superAdminService";
import { COLORS, FONTS, RADII, SPACING } from "../../src/theme";

type UserTab = "all" | "player" | "zone";

function formatDate(value?: number | null) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

function statusTone(status?: string | null) {
  return status === "suspended" ? "danger" as const : "success" as const;
}

export default function SuperAdminUsersScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const bottomContentPadding = useTabBarClearance(SPACING.lg);
  const [tab, setTab] = useState<UserTab>("all");
  const [users, setUsers] = useState<SuperAdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    const result = await getUsers(tab === "all" ? undefined : tab);
    if (result.ok) {
      setUsers(result.data);
    } else {
      showToast({ type: "error", title: "Users failed", message: result.message });
    }
    if (mode === "initial") setLoading(false);
    else setRefreshing(false);
  }, [showToast, tab]);

  useFocusEffect(useCallback(() => {
    void load("initial");
  }, [load]));

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) => [
      user.fullName,
      user.username,
      user.email,
      user.accountType,
      user.role,
      user.accountStatus || "active",
    ].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [search, users]);

  const handleSuspension = async (user: SuperAdminUser, status: "active" | "suspended") => {
    setBusyUserId(user.id);
    const result = await setUserSuspension(user.id, {
      status,
      reason: status === "suspended" ? "Suspended from Super Admin users screen." : undefined,
      suspendedUntil: null,
    });
    setBusyUserId(null);
    if (result.ok) {
      showToast({
        type: "success",
        title: status === "suspended" ? "User suspended" : "User reactivated",
        message: `${user.fullName || user.username} was updated.`,
      });
      await load("refresh");
    } else {
      showToast({ type: "error", title: "Update failed", message: result.message });
    }
  };

  return (
    <Screen style={styles.screen} contentStyle={styles.screenContent} scroll={false} edges={["top"]}>
      <AppHeader title="Users" subtitle="Review accounts and manage suspensions." onBack={() => router.back()} inlineTitle />
      <View style={styles.searchBar}>
        <AppIcon name="search" size={20} color={COLORS.textSecondary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search users"
          placeholderTextColor={COLORS.textSecondary}
          style={styles.searchInput}
          autoCapitalize="none"
        />
      </View>
      <SegmentedTabs
        items={[
          { key: "all", label: "All" },
          { key: "player", label: "Players" },
          { key: "zone", label: "Zone Admins" },
        ]}
        value={tab}
        onChange={(value) => setTab(value as UserTab)}
        style={styles.tabs}
      />

      {loading ? (
        <View style={styles.loaderWrap}><ActivityIndicator color={COLORS.accent} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} tintColor={COLORS.accent} />}
          showsVerticalScrollIndicator={false}
        >
          {visible.map((user) => {
            const suspended = user.accountStatus === "suspended";
            return (
              <AdminListCard
                key={user.id}
                title={user.fullName || user.username || "Unknown user"}
                subtitle={user.email}
                statusLabel={suspended ? "Suspended" : "Active"}
                statusTone={statusTone(user.accountStatus)}
                actions={
                  suspended ? (
                    <AppButton size="sm" variant="success" loading={busyUserId === user.id} onPress={() => handleSuspension(user, "active")}>
                      Reactivate
                    </AppButton>
                  ) : (
                    <AppButton size="sm" variant="danger" loading={busyUserId === user.id} onPress={() => handleSuspension(user, "suspended")}>
                      Suspend
                    </AppButton>
                  )
                }
              >
                <View style={styles.infoStack}>
                  <AdminInfoLine label="Username" value={user.username || "N/A"} />
                  <AdminInfoLine label="Type" value={user.accountType === "zone" ? "Zone Admin" : "Player"} />
                  <AdminInfoLine label="Role" value={user.role || "Standard"} />
                  <AdminInfoLine label="Created" value={formatDate(user.createdAt)} />
                  {suspended ? <AdminInfoLine label="Reason" value={user.suspensionReason || "No reason recorded"} /> : null}
                </View>
              </AdminListCard>
            );
          })}
          {visible.length === 0 ? (
            <AdminEmptyStateCard title="No users found" description="Try another tab or search term." icon="players" />
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.backgroundDark },
  screenContent: { paddingTop: 0 },
  searchBar: {
    minHeight: 48,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardDark,
    paddingHorizontal: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  searchInput: { flex: 1, color: COLORS.text, fontFamily: FONTS.body, fontSize: 14 },
  tabs: { marginBottom: SPACING.md },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { gap: SPACING.md },
  infoStack: { gap: SPACING.sm },
});
