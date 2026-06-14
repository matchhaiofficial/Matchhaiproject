import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { convex } from "../lib/convex";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

const INSTALLATION_ID_KEY = "push_registration.installation_id.v1";
let pushRegistrationGeneration = 0;

const createInstallationId = () =>
  `inst_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

async function loadExpoNotifications() {
  if (Constants.appOwnership === "expo") {
    return null;
  }
  return await import("expo-notifications");
}

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

export function cancelPendingPushRegistrationSync() {
  pushRegistrationGeneration += 1;
}

export async function syncPushRegistration(input: {
  userId: Id<"users">;
  enabled?: boolean;
}) {
  const generation = ++pushRegistrationGeneration;
  const isCurrentSync = () => generation === pushRegistrationGeneration;
  const installationId = await getOrCreateInstallationId();
  const enabled = input.enabled !== false;

  if (!isCurrentSync()) {
    return { ok: true as const, skipped: "cancelled" as const };
  }

  if (!enabled || Platform.OS === "web") {
    await convex.mutation((api as any).pushNotifications.deactivateDevice, { installationId });
    return { ok: true as const, skipped: "disabled" as const };
  }

  if (Constants.appOwnership === "expo") {
    if (!isCurrentSync()) {
      return { ok: true as const, skipped: "cancelled" as const };
    }
    await convex.mutation((api as any).pushNotifications.upsertDevice, {
      userId: input.userId,
      installationId,
      provider: "expo",
      platform: Platform.OS,
      projectId: getProjectId() || undefined,
      deviceName: String(Constants.deviceName || ""),
      appVersion: String(Constants.expoConfig?.version || ""),
      permissionStatus: "undetermined",
    });

    return { ok: true as const, skipped: "expo_go" as const };
  }

  const Notifications = await loadExpoNotifications();
  if (!isCurrentSync()) {
    return { ok: true as const, skipped: "cancelled" as const };
  }
  if (!Notifications) {
    await convex.mutation((api as any).pushNotifications.upsertDevice, {
      userId: input.userId,
      installationId,
      provider: "expo",
      platform: Platform.OS,
      projectId: getProjectId() || undefined,
      deviceName: String(Constants.deviceName || ""),
      appVersion: String(Constants.expoConfig?.version || ""),
      permissionStatus: "undetermined",
    });

    return { ok: true as const, skipped: "expo_go" as const };
  }

  let permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== "granted" && permissions.canAskAgain !== false) {
    permissions = await Notifications.requestPermissionsAsync();
  }

  if (!isCurrentSync()) {
    return { ok: true as const, skipped: "cancelled" as const };
  }

  const permissionStatus =
    permissions.status === "granted" || permissions.status === "denied"
      ? permissions.status
      : "undetermined";

  let expoPushToken = "";
  const projectId = getProjectId();
  if (permissionStatus === "granted" && projectId) {
    try {
      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      expoPushToken = token.data;
    } catch {
      expoPushToken = "";
    }
  }

  if (!isCurrentSync()) {
    return { ok: true as const, skipped: "cancelled" as const };
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
