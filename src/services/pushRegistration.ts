import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { convex } from "../lib/convex";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

const INSTALLATION_ID_KEY = "push_registration.installation_id.v1";

const createInstallationId = () =>
  `inst_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export const getOrCreateInstallationId = async () => {
  const existing = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
  if (existing) return existing;
  const next = createInstallationId();
  await AsyncStorage.setItem(INSTALLATION_ID_KEY, next);
  return next;
};

const getProjectId = () => {
  return (
    Constants.expoConfig?.extra?.eas?.projectId
    || Constants.easConfig?.projectId
    || process.env.EXPO_PUBLIC_EXPO_PROJECT_ID
    || ""
  );
};

export async function syncPushRegistration(input: {
  userId: Id<"users">;
  enabled?: boolean;
}) {
  const installationId = await getOrCreateInstallationId();
  const enabled = input.enabled !== false;

  if (!enabled || Platform.OS === "web") {
    await convex.mutation((api as any).pushNotifications.deactivateDevice, { installationId });
    return { ok: true as const, skipped: "disabled" as const };
  }

  let permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== "granted" && permissions.canAskAgain !== false) {
    permissions = await Notifications.requestPermissionsAsync();
  }

  const permissionStatus =
    permissions.status === "granted" || permissions.status === "denied"
      ? permissions.status
      : "undetermined";

  let expoPushToken = "";
  const projectId = getProjectId();
  if (permissionStatus === "granted" && projectId) {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    expoPushToken = token.data;
  }

  await convex.mutation((api as any).pushNotifications.upsertDevice, {
    userId: input.userId,
    installationId,
    provider: "expo",
    platform: Platform.OS,
    expoPushToken: expoPushToken || undefined,
    projectId: projectId || undefined,
    deviceName: String(Constants.deviceName || ""),
    appVersion: String(Constants.expoConfig?.version || ""),
    permissionStatus,
  });

  return {
    ok: true as const,
    permissionStatus,
    expoPushToken,
  };
}

export async function deactivateCurrentInstallation() {
  const installationId = await getOrCreateInstallationId();
  await convex.mutation((api as any).pushNotifications.deactivateDevice, { installationId });
  return { ok: true as const };
}
