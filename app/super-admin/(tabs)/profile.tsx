import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import AppHeader from "../../../src/components/AppHeader";
import { AdminInfoLine } from "../../../src/components/AdminSurface";
import { BlockingLoader } from "../../../src/components/BlockingLoader";
import { AppButton, AppCard, StatusPill } from "../../../src/components/AppPrimitives";
import Screen from "../../../src/components/Screen";
import { useAuth } from "../../../src/context/AuthContext";
import { useTabBarClearance } from "../../../src/hooks/useTabBarClearance";
import { signOutUser } from "../../../src/services/convex/authService";
import { COLORS, FONTS, SPACING } from "../../../src/theme";

export default function SuperAdminProfileTab() {
  const bottomContentPadding = useTabBarClearance(SPACING.lg);
  const { user } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          setLoggingOut(true);
          try {
            await signOutUser();
            router.replace("/auth/login");
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
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
          <Text style={styles.sectionTitle}>Moderation Actions</Text>
          <Text style={styles.helperText}>User suspension actions are available from Reports and the Users screen. Every action is audit logged with your Super Admin identity.</Text>
          <View style={styles.actionsRow}>
            <AppButton variant="secondary" onPress={() => router.push("/super-admin/users" as any)}>Open Users</AppButton>
            <AppButton variant="secondary" onPress={() => router.push("/super-admin/audit-logs" as any)}>View Audit Logs</AppButton>
          </View>
        </AppCard>

        <AppButton variant="danger" onPress={handleLogout} leadingIcon="logout">Sign Out</AppButton>
      </ScrollView>
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
  helperText: { color: COLORS.textSecondary, fontFamily: FONTS.martelRegular, fontSize: 13, lineHeight: 20 },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
});
