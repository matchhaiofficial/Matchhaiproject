import { router } from "expo-router";
import { Alert } from "react-native";
import Toast from "react-native-toast-message";

import type { AuthUser } from "../lib/auth-client";
import {
  EMAIL_VERIFICATION_REQUIRED_MESSAGE,
  sendCurrentUserVerificationEmail,
} from "../services/convex/authService";

export const EMAIL_VERIFICATION_LOCK_DETAIL_MESSAGE =
  "You can browse the app, but creating or joining matchrooms and team actions stay locked until verification is complete.";

export const EMAIL_VERIFICATION_DASHBOARD_DETAIL_MESSAGE =
  `${EMAIL_VERIFICATION_LOCK_DETAIL_MESSAGE} Only profile settings and logout are available right now.`;

export function hasVerifiedEmail(authUser?: AuthUser | null): boolean {
  return Boolean(authUser?.emailVerified);
}

export function openVerificationRequiredScreen() {
  router.push("/auth/verification-required" as any);
}

export async function resendVerificationEmailWithAlert() {
  const result = await sendCurrentUserVerificationEmail();
  Toast.show({
    type: result.ok ? "success" : "error",
    text1: result.ok ? "Verification Email Sent" : "Could Not Resend Email",
    text2: result.ok
      ? "Check your inbox and verify your email to unlock matchrooms and team actions."
      : result.message,
    visibilityTime: 3500,
    autoHide: true,
    position: "bottom",
  });
}

export function showEmailVerificationRequiredAlert() {
  Alert.alert(
    "Verify Email",
    `${EMAIL_VERIFICATION_REQUIRED_MESSAGE}\n\n${EMAIL_VERIFICATION_LOCK_DETAIL_MESSAGE}`,
    [
      { text: "Not now", style: "cancel" },
      {
        text: "Resend Email",
        onPress: () => {
          void resendVerificationEmailWithAlert();
        },
      },
      {
        text: "Open Verification",
        onPress: openVerificationRequiredScreen,
      },
    ],
  );
}
