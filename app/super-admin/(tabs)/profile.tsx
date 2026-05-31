import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import AppHeader from "../../../src/components/AppHeader";
import { AdminInfoLine } from "../../../src/components/AdminSurface";
import {
  AppDialog,
  AppModalBody,
  AppModalFooter,
  AppModalHeader,
} from "../../../src/components/AppModalPrimitives";
import { BlockingLoader } from "../../../src/components/BlockingLoader";
import { AppButton, AppCard, StatusPill } from "../../../src/components/AppPrimitives";
import Screen from "../../../src/components/Screen";
import { useAuth } from "../../../src/context/AuthContext";
import { useTabBarClearance } from "../../../src/hooks/useTabBarClearance";
import { signOutUser } from "../../../src/services/convex/authService";
import {
  bootstrapPartnerSuperAdmins,
  getSuperAdminAccessOverview,
  type PartnerSuperAdminBootstrapResult,
  type SuperAdminAccessOverview,
} from "../../../src/services/convex/superAdminService";
import { useToast } from "../../../src/hooks/useToast";
import { COLORS, FONTS, SPACING } from "../../../src/theme";

const BOOTSTRAP_STATUS_TONE: Record<string, "success" | "info" | "warning" | "danger"> = {
  created: "success",
  already_exists: "info",
  conflict_existing_player_account: "warning",
  missing_temp_password_env: "danger",
  failed: "danger",
  skipped_protected: "info",
};

const BOOTSTRAP_STATUS_LABEL: Record<string, string> = {
  created: "Created",
  already_exists: "Already exists",
  conflict_existing_player_account: "Player conflict",
  missing_temp_password_env: "Not configured",
  failed: "Failed",
  skipped_protected: "Skipped",
};

export default function SuperAdminProfileTab() {
  const bottomContentPadding = useTabBarClearance(SPACING.lg);
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loggingOut, setLoggingOut] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const [overview, setOverview] = useState<SuperAdminAccessOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapResults, setBootstrapResults] = useState<PartnerSuperAdminBootstrapResult["results"] | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const loadOverview = useCallback(async (forceRefresh?: boolean) => {
    setOverviewLoading(true);
    const result = await getSuperAdminAccessOverview({ forceRefresh });
    if (result.ok) {
      setOverview(result.data);
    }
    setOverviewLoading(false);
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const runBootstrap = async () => {
    setShowConfirm(false);
    setBootstrapping(true);
    setBootstrapResults(null);
    try {
      const result = await bootstrapPartnerSuperAdmins({ reason: "Access Management bootstrap button" });
      if (!result.ok) {
        showToast({ type: "error", title: "Bootstrap failed", message: result.message });
        return;
      }
      setBootstrapResults(result.data.results);
      if (!result.data.configured) {
        showToast({
          type: "error",
          title: "Not configured",
          message: result.data.message || "Temporary bootstrap password is not configured.",
        });
      } else {
        const created = result.data.results.filter((r) => r.status === "created").length;
        showToast({
          type: "success",
          title: "Bootstrap complete",
          message: created > 0 ? `${created} partner Super Admin account(s) created.` : "No new accounts needed.",
        });
      }
      await loadOverview(true);
    } finally {
      setBootstrapping(false);
    }
  };

  const handleLogout = () => {
    setShowLogoutDialog(true);
  };

  const confirmLogout = async () => {
    setShowLogoutDialog(false);
    setLoggingOut(true);
    try {
      await signOutUser();
      router.replace("/auth/login");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <Screen style={styles.screen} contentStyle={styles.screenContent} scroll={false} edges={["top"]}>
      <BlockingLoader visible={loggingOut} label="Logging out..." />
      <AppHeader title="Profile" subtitle="Super Admin account." inlineTitle />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding }]} showsVerticalScrollIndicator={false}>
        <AppCard style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{String(user?.fullName || user?.username || "S").charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{user?.fullName || "Super Admin"}</Text>
          <Text style={styles.email}>{user?.email || "Email not available"}</Text>
          <StatusPill tone="info" label="Super Admin" />
          <View style={styles.infoStack}>
            <AdminInfoLine label="Username" value={user?.username || "N/A"} />
            <AdminInfoLine label="Account type" value={user?.accountType || "N/A"} />
            <AdminInfoLine label="Role" value={user?.role || "super-admin"} />
          </View>
        </AppCard>

        <AppCard style={styles.card}>
          <Text style={styles.sectionTitle}>Access Management</Text>
          <Text style={styles.helperText}>
            Partner Super Admins are separate operational accounts (not player accounts) and are hidden from all
            player and zone surfaces. Creating them requires the server-side temporary bootstrap password; created
            partners must change it on first login. No password is ever shown here.
          </Text>

          {overviewLoading ? (
            <ActivityIndicator color={COLORS.accent} />
          ) : overview ? (
            <View style={styles.accessList}>
              {overview.dbRoleAdmins.length === 0 && overview.envAllowlistAdmins.length === 0 ? (
                <Text style={styles.helperText}>No Super Admin accounts found yet.</Text>
              ) : null}
              {overview.dbRoleAdmins.map((admin) => (
                <View key={admin.userId} style={styles.accessRow}>
                  <View style={styles.accessRowMain}>
                    <Text style={styles.accessName}>{admin.fullName}</Text>
                    <Text style={styles.accessEmail}>{admin.email || "No email"}</Text>
                    <Text style={styles.accessMeta}>
                      {(admin.isSeparateAccount ? "Separate admin account" : `Account type: ${admin.accountType || "n/a"}`)}
                      {" · "}role: {admin.role || "n/a"} · source: {admin.source}
                    </Text>
                  </View>
                  <View style={styles.accessPills}>
                    {admin.mustChangePassword ? <StatusPill tone="warning" label="Must change password" /> : <StatusPill tone="success" label="Active" />}
                  </View>
                </View>
              ))}
              {overview.envAllowlistAdmins.map((entry) => (
                <View key={entry.email} style={styles.accessRow}>
                  <View style={styles.accessRowMain}>
                    <Text style={styles.accessName}>{entry.displayName}</Text>
                    <Text style={styles.accessEmail}>{entry.email}</Text>
                    <Text style={styles.accessMeta}>source: env_allowlist{entry.hasMatchingAccount ? " · account exists" : " · no account yet"}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.helperText}>Could not load access overview.</Text>
          )}

          {bootstrapResults ? (
            <View style={styles.accessList}>
              <Text style={styles.sectionSubTitle}>Last run</Text>
              {bootstrapResults.map((r) => (
                <View key={r.email} style={styles.resultRow}>
                  <StatusPill tone={BOOTSTRAP_STATUS_TONE[r.status] || "info"} label={BOOTSTRAP_STATUS_LABEL[r.status] || r.status} />
                  <View style={styles.resultRowMain}>
                    <Text style={styles.accessEmail}>{r.email}</Text>
                    <Text style={styles.accessMeta}>{r.message}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <AppButton onPress={() => setShowConfirm(true)} loading={bootstrapping} disabled={bootstrapping} leadingIcon="verified-user">
            Create partner Super Admins
          </AppButton>
        </AppCard>

        <AppCard style={styles.card}>
          <Text style={styles.sectionTitle}>Moderation Actions</Text>
          <Text style={styles.helperText}>User suspension actions are available from Reports and the Users screen. Every action is audit logged with your Super Admin identity.</Text>
          <View style={styles.actionsRow}>
            <AppButton variant="secondary" onPress={() => router.push("/super-admin/users" as any)}>Open Users</AppButton>
            <AppButton variant="secondary" onPress={() => router.push("/super-admin/audit-logs" as any)}>View Audit Logs</AppButton>
          </View>
        </AppCard>

        <AppButton variant="danger" onPress={handleLogout} leadingIcon="logout">Sign Out</AppButton>
      </ScrollView>

      <AppDialog visible={showConfirm} onClose={() => setShowConfirm(false)}>
        <AppModalHeader title="Create partner Super Admins" onClose={() => setShowConfirm(false)} />
        <AppModalBody contentContainerStyle={{ gap: SPACING.md }}>
          <Text style={styles.helperText}>
            This creates separate Super Admin accounts for the partner emails that do not yet have one. Existing
            accounts are skipped, and any email already used by a player account is reported as a conflict (never
            upgraded). Continue?
          </Text>
        </AppModalBody>
        <AppModalFooter>
          <View style={styles.dialogActionRow}>
            <AppButton variant="secondary" style={styles.dialogAction} onPress={() => setShowConfirm(false)}>
              Cancel
            </AppButton>
            <AppButton style={styles.dialogAction} onPress={runBootstrap} disabled={bootstrapping} loading={bootstrapping}>
              Create
            </AppButton>
          </View>
        </AppModalFooter>
      </AppDialog>

      <AppDialog visible={showLogoutDialog} onClose={() => setShowLogoutDialog(false)}>
        <AppModalHeader title="Logout" onClose={() => setShowLogoutDialog(false)} />
        <AppModalBody contentContainerStyle={{ gap: SPACING.md }}>
          <Text style={styles.helperText}>Are you sure you want to logout?</Text>
        </AppModalBody>
        <AppModalFooter>
          <View style={styles.dialogActionRow}>
            <AppButton variant="secondary" style={styles.dialogAction} onPress={() => setShowLogoutDialog(false)}>
              Cancel
            </AppButton>
            <AppButton variant="danger" style={styles.dialogAction} onPress={confirmLogout} disabled={loggingOut} loading={loggingOut}>
              Logout
            </AppButton>
          </View>
        </AppModalFooter>
      </AppDialog>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.backgroundDark },
  screenContent: { paddingTop: 0 },
  content: { gap: SPACING.md },
  card: { gap: SPACING.md, alignItems: "flex-start" },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.accent, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontFamily: FONTS.heading, fontSize: 24 },
  name: { color: COLORS.text, fontFamily: FONTS.heading, fontSize: 20 },
  email: { color: COLORS.textSecondary, fontFamily: FONTS.martelRegular, fontSize: 13 },
  infoStack: { width: "100%", gap: SPACING.sm },
  sectionTitle: { color: COLORS.text, fontFamily: FONTS.heading, fontSize: 16 },
  sectionSubTitle: { color: COLORS.text, fontFamily: FONTS.heading, fontSize: 14, marginTop: SPACING.xs },
  helperText: { color: COLORS.textSecondary, fontFamily: FONTS.martelRegular, fontSize: 13, lineHeight: 20 },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  accessList: { width: "100%", gap: SPACING.sm },
  accessRow: { width: "100%", flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start", justifyContent: "space-between" },
  accessRowMain: { flex: 1, gap: 2 },
  accessPills: { alignItems: "flex-end" },
  accessName: { color: COLORS.text, fontFamily: FONTS.martelRegular, fontSize: 14 },
  accessEmail: { color: COLORS.textSecondary, fontFamily: FONTS.martelRegular, fontSize: 13 },
  accessMeta: { color: COLORS.muted, fontFamily: FONTS.martelRegular, fontSize: 11 },
  resultRow: { width: "100%", flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start" },
  resultRowMain: { flex: 1, gap: 2 },
  dialogActionRow: { flexDirection: "row", gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  dialogAction: { flex: 1 },
});
