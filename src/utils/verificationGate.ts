import { Alert } from "react-native";
import Toast from "react-native-toast-message";

import type { AuthUser } from "../lib/auth-client";
import type { UserProfile } from "../context/AuthContext";

export const KYC_VERIFICATION_REQUIRED_MESSAGE =
  "Please complete CNIC & face verification to unlock MatchHai features.";

export const KYC_VERIFICATION_DASHBOARD_DETAIL_MESSAGE =
  `${KYC_VERIFICATION_REQUIRED_MESSAGE} Only profile settings and help are available right now.`;

export const KYC_VERIFICATION_PENDING_MESSAGE =
  "Your verification is under review. MatchHai gameplay features unlock after approval; profile settings and help remain available.";

export function isKycVerificationBypassEnabled(): boolean {
  return (
    __DEV__ && (
      process.env.EXPO_PUBLIC_SKIP_KYC_VERIFICATION === "1" ||
      process.env.EXPO_PUBLIC_SKIP_PHONE_OTP === "1"
    )
  );
}

export function isKycAccessAllowed(status?: string | null): boolean {
  if (isKycVerificationBypassEnabled()) return true;
  return status === "verified";
}

export function isKycReviewActive(status?: string | null): boolean {
  return status === "pending" || status === "in_progress" || status === "in_review";
}

export function isUserFullyVerified(_authUser?: AuthUser | null, userProfile?: UserProfile | null): boolean {
  return isKycAccessAllowed(userProfile?.kycVerificationStatus);
}

export function showKycVerificationRequiredToast() {
  if (isKycVerificationBypassEnabled()) return;
  Toast.show({
    type: "warning",
    text1: "Verify your identity",
    text2: KYC_VERIFICATION_REQUIRED_MESSAGE,
    visibilityTime: 3500,
    autoHide: true,
    position: "bottom",
  });
}

export function showKycVerificationRequiredAlert() {
  if (isKycVerificationBypassEnabled()) return;
  Alert.alert("Verify your identity", KYC_VERIFICATION_REQUIRED_MESSAGE, [{ text: "OK" }]);
}
