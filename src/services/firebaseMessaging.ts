import Constants from "expo-constants";
import { Platform } from "react-native";

type FirebaseMessagingModule = typeof import("@react-native-firebase/messaging");

let firebaseMessagingModulePromise: Promise<FirebaseMessagingModule | null> | null = null;

export async function loadFirebaseMessaging() {
  if (Platform.OS === "web") {
    return null;
  }
  if (Constants.appOwnership === "expo") {
    return null;
  }

  if (!firebaseMessagingModulePromise) {
    firebaseMessagingModulePromise = import("@react-native-firebase/messaging")
      .then((module) => module)
      .catch(() => null);
  }

  return firebaseMessagingModulePromise;
}
