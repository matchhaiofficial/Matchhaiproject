import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { convex } from "../lib/convex";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

const INSTALLATION_ID_KEY = "push_registration.installation_id.v1";
let pushRegistrationGeneration = 0;

export type PushRegistrationSyncResult = {
  ok: true;
  permissionStatus?: "granted" | "denied" | "undetermined";
  expoPushToken?: string;
  registrationError?: string;
  retryable: boolean;
  skipped?: "cancelled" | "disabled" | "expo_go";
};

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

const getRegistrationErrorMessage = (error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Expo push token registration failed.";
  return message.trim().slice(0, 500) || "Expo push token registration failed.";
};

async function upsertPushDevice(args: {
  userId: Id<"users">;
  installationId: string;
  expoPushToken?: string;
  projectId?: string;
  permissionStatus: "granted" | "denied" | "undetermined";
  registrationError?: string;
}) {
  return await convex.mutation((api as any).pushNotifications.upsertDevice, {
    userId: args.userId,
    installationId: args.installationId,
    provider: "expo",
    platform: Platform.OS,
    expoPushToken: args.expoPushToken,
    projectId: args.projectId,
    deviceName: String(Constants.deviceName || ""),
    appVersion: String(Constants.expoConfig?.version || ""),
    permissionStatus: args.permissionStatus,
    registrationError: args.registrationError,
  });
}

export function cancelPendingPushRegistrationSync() {
  pushRegistrationGeneration += 1;
}

export async function syncPushRegistration(input: {
  userId: Id<"users">;
  enabled?: boolean;
}): Promise<PushRegistrationSyncResult> {
  const generation = ++pushRegistrationGeneration;
  const isCurrentSync = () => generation === pushRegistrationGeneration;
  const installationId = await getOrCreateInstallationId();
  const enabled = input.enabled !== false;

  if (!isCurrentSync()) {
    return { ok: true, skipped: "cancelled", retryable: false };
  }

  if (!enabled || Platform.OS === "web") {
    await convex.mutation((api as any).pushNotifications.deactivateDevice, { installationId });
    return { ok: true, skipped: "disabled", retryable: false };
  }

  if (Constants.appOwnership === "expo") {
    if (!isCurrentSync()) {
      return { ok: true, skipped: "cancelled", retryable: false };
    }
    await upsertPushDevice({
      userId: input.userId,
      installationId,
      projectId: getProjectId() || undefined,
      permissionStatus: "undetermined",
      registrationError: "Push notifications are unavailable in Expo Go.",
    });

    return { ok: true, skipped: "expo_go", retryable: false };
  }

  const Notifications = await loadExpoNotifications();
  if (!isCurrentSync()) {
    return { ok: true, skipped: "cancelled", retryable: false };
  }
  if (!Notifications) {
    await upsertPushDevice({
      userId: input.userId,
      installationId,
      projectId: getProjectId() || undefined,
      permissionStatus: "undetermined",
      registrationError: "Push notifications are unavailable in Expo Go.",
    });

    return { ok: true, skipped: "expo_go", retryable: false };
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#42a5f5",
    });
  }

  let permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== "granted" && permissions.canAskAgain !== false) {
    permissions = await Notifications.requestPermissionsAsync();
  }

  if (!isCurrentSync()) {
    return { ok: true, skipped: "cancelled", retryable: false };
  }

  const permissionStatus =
    permissions.status === "granted" || permissions.status === "denied"
      ? permissions.status
      : "undetermined";

  let expoPushToken = "";
  const projectId = getProjectId();
  let registrationError: string | undefined;
  if (permissionStatus === "granted" && projectId) {
    try {
      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      expoPushToken = token.data;
    } catch (error) {
      expoPushToken = "";
      registrationError = getRegistrationErrorMessage(error);
    }
  } else if (permissionStatus === "granted" && !projectId) {
    registrationError = "Expo project ID is missing from this build.";
  } else if (permissionStatus === "denied") {
    registrationError = "Push notification permission was denied.";
  }

  if (!isCurrentSync()) {
    return { ok: true, skipped: "cancelled", retryable: false };
  }

  const registeredDeviceId = await upsertPushDevice({
    userId: input.userId,
    installationId,
    expoPushToken: expoPushToken || undefined,
    projectId: projectId || undefined,
    permissionStatus,
    registrationError,
  });

  return {
    ok: true,
    permissionStatus,
    expoPushToken,
    registrationError,
    retryable:
      !registeredDeviceId ||
      (permissionStatus === "granted" && !expoPushToken && Boolean(projectId)),
  };
}

export async function deactivateCurrentInstallation() {
  const installationId = await getOrCreateInstallationId();
  await convex.mutation((api as any).pushNotifications.deactivateDevice, { installationId });
  return { ok: true as const };
}
