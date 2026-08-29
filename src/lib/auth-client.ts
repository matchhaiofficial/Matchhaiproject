import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { phoneNumberClient } from "better-auth/client/plugins";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const CONVEX_SITE_URL = process.env.EXPO_PUBLIC_CONVEX_SITE_URL;

if (!CONVEX_SITE_URL) {
  console.warn("[auth-client] EXPO_PUBLIC_CONVEX_SITE_URL is not set");
}

export const authClient = createAuthClient({
  baseURL: CONVEX_SITE_URL || "",
  plugins: [
    convexClient(),
    phoneNumberClient(),
    expoClient({
      scheme: Constants.expoConfig?.scheme as string || "matchhai",
      storagePrefix: "matchhai",
      storage: SecureStore,
    }),
  ],
});

// Type exports - aligned with Better Auth's actual response types
export type AuthUser = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  userId?: string | null;
  phoneNumber?: string | null;
  phoneNumberVerified?: boolean;
};

export type AuthSessionData = {
  id: string;
  userId: string;
  expiresAt: Date;
  token: string;
  createdAt: Date;
  updatedAt: Date;
  ipAddress?: string;
  userAgent?: string;
};

export type AuthSession = {
  user: AuthUser;
  session: AuthSessionData;
};

// Export typed auth hooks and methods
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;

// Phone number specific methods
export const phoneAuth = {
  signIn: authClient.signIn.phoneNumber,
  signUp: (authClient.signUp as any)?.phoneNumber,
  sendOTP: (authClient as any).phoneNumber?.sendOtp,
  verify: (authClient as any).phoneNumber?.verify,
  requestPasswordReset: (authClient as any).phoneNumber?.requestPasswordReset,
  resetPassword: (authClient as any).phoneNumber?.resetPassword,
};

// Email specific methods
export const emailAuth = {
  signIn: authClient.signIn.email,
  signUp: authClient.signUp.email,
  sendVerificationEmail: (authClient as any).sendVerificationEmail,
  verifyEmail: (authClient as any).verifyEmail,
};
