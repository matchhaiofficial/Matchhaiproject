// src/services/convex/authService.ts
// Convex-based auth service that wraps Better Auth
// Maintains the same interface as the Firebase auth service

import { authClient, AuthSession, AuthUser } from "../../lib/auth-client";
import { clearCachedAuthSession } from "../../lib/authSessionCache";
import { convex } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { isKycAccessAllowed, isKycVerificationBypassEnabled } from "../../utils/verificationGate";

/** Friendly message mapper for common auth errors */
function mapAuthError(error?: any): string {
  const code = String(error?.code || error?.message || "");
  const statusText = String(error?.statusText || error?.error?.message || "");
  const raw = [code, statusText, String(error?.message || "")]
    .filter(Boolean)
    .join(" | ");

  if (
    raw.includes("INVALID_EMAIL_OR_PASSWORD") ||
    raw.toLowerCase().includes("invalid email or password") ||
    raw.toLowerCase().includes("incorrect email or password")
  ) {
    return "Incorrect email or password.";
  }
  if (raw.includes("phone number is already registered")) {
    return "This phone number is already registered.";
  }
  if (code.includes("invalid-email") || code.includes("INVALID_EMAIL")) {
    return "Invalid email address.";
  }
  if (code.includes("email-already") || code.includes("EMAIL_EXISTS") || code.includes("already registered")) {
    return "This email is already registered.";
  }
  if (code.includes("weak-password") || code.includes("WEAK_PASSWORD")) {
    return "Password is too weak (use at least 6 characters).";
  }
  if (raw.includes("PASSWORD_TOO_SHORT")) {
    return "Password is too short.";
  }
  if (raw.includes("PASSWORD_TOO_LONG")) {
    return "Password is too long.";
  }
  if (raw.includes("INVALID_TOKEN")) {
    return "This reset link is invalid or has expired. Please request a new one.";
  }
  if (code.includes("user-not-found") || code.includes("USER_NOT_FOUND")) {
    return "Incorrect email or password.";
  }
  if (code.includes("wrong-password") || code.includes("INVALID_PASSWORD")) {
    return "Incorrect email or password.";
  }
  if (code.includes("too-many-requests") || code.includes("RATE_LIMIT")) {
    return "Too many attempts. Please try again later.";
  }
  if (code.includes("network") || code.includes("NETWORK")) {
    return "Network error. Check your connection and try again.";
  }
  if (code.includes("invalid-phone") || code.includes("INVALID_PHONE")) {
    return "Invalid phone number.";
  }
  if (code.includes("email-not-verified")) {
    return EMAIL_VERIFICATION_REQUIRED_MESSAGE;
  }
  if (
    raw.includes("RESEND_FROM_EMAIL")
    || raw.includes("Invalid `from` field")
    || raw.includes("validation_error")
    || raw.includes("Failed to send email: 422")
  ) {
    return "Email delivery is misconfigured. Set RESEND_FROM_EMAIL to a valid sender like no-reply@example.com or MatchHai <no-reply@example.com>.";
  }
  if (
    raw.includes("domain is not verified")
    || raw.includes("Verify the domain in Resend")
  ) {
    return "Email delivery is blocked because matchhai.com is not verified in Resend yet. Verify the domain in Resend before sending emails to users.";
  }
  if (
    raw.includes("only send testing emails to your own email address")
    || raw.includes("still in testing mode")
  ) {
    return "Email delivery is blocked because this Resend account is still in testing mode. Verify a sending domain in Resend to email real users.";
  }
  if (raw.includes("RESEND_API_KEY")) {
    return "Email delivery is not configured. Add a valid RESEND_API_KEY before registering accounts.";
  }

  return String(error?.message || statusText || "Something went wrong. Please try again.");
}

async function markAuthUserOffline(authId?: string | null) {
  if (!authId) return;
  try {
    const profile = await convex.query(api.users.getByAuthId, { authId });
    if (!profile?._id) return;
    await convex.mutation(api.users.updateOnlineStatus, {
      userId: profile._id as Id<"users">,
      isOnline: false,
    });
  } catch {
    // Presence is best-effort; auth should not fail because this write failed.
  }
}

async function getCurrentSessionAuthId() {
  try {
    const { data } = await authClient.getSession();
    return data?.user?.id || null;
  } catch {
    return null;
  }
}

function isCombinedCredentialError(error?: any) {
  const raw = [
    String(error?.code || ""),
    String(error?.message || ""),
    String(error?.statusText || ""),
    String(error?.error?.message || ""),
  ]
    .filter(Boolean)
    .join(" | ")
    .toLowerCase();

  return (
    raw.includes("invalid_email_or_password") ||
    raw.includes("invalid email or password") ||
    raw.includes("incorrect email or password")
  );
}

export type AuthResult =
  | { ok: true; user: AuthUser; userId: Id<"users"> }
  | { ok: false; message: string; code?: string };

export type SimpleResult =
  | { ok: true }
  | { ok: false; message: string; code?: string };

export const EMAIL_VERIFICATION_REQUIRED_MESSAGE =
  "Please complete CNIC & face verification to unlock MatchHai features.";
const EMAIL_VERIFICATION_CALLBACK_PATH = "/auth/login";
const AUTH_CALL_TIMEOUT_MS = 15000;

function isSuspendedUser(user: any) {
  if (!user || user.accountStatus !== "suspended") return false;
  const suspendedUntil = typeof user.suspendedUntil === "number" ? user.suspendedUntil : null;
  return !suspendedUntil || suspendedUntil > Date.now();
}

function suspendedAccountResult(): AuthResult {
  return {
    ok: false,
    code: "auth/account-suspended",
    message: "Your MatchHai account is suspended. Please contact support.",
  };
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function ensureConvexUserProfile(args: {
  authUserData: AuthUser;
  identity: {
    email: string;
    phone: string;
    username?: string | null;
    usernameLower?: string | null;
    phoneValidated?: boolean;
    phoneValidationProvider?: string;
    phoneValidationCheckedAt?: number;
    phoneOtpVerified?: boolean;
    phoneOtpVerifiedAt?: number;
    phoneNumberMasked?: string;
    phoneNumberHash?: string;
  };
  displayName?: string;
  city?: string;
  ageRange?: string;
  accountType: "player" | "zone";
}): Promise<AuthResult> {
  const existingProfile = await convex.query(api.users.getByAuthId, {
    authId: args.authUserData.id,
  });

  if (existingProfile) {
    if (existingProfile.accountType !== args.accountType) {
      return {
        ok: false,
        message: `This email is already registered as a ${existingProfile.accountType} account.`,
      };
    }
    return { ok: true, user: args.authUserData, userId: existingProfile._id };
  }

  const userId = await convex.mutation(api.users.create, {
    authId: args.authUserData.id,
    email: args.identity.email,
    fullName: args.displayName?.trim() || null,
    username: args.identity.username ?? null,
    usernameLower: args.identity.usernameLower ?? null,
    phone: args.identity.phone,
    phoneValidated: args.identity.phoneValidated,
    phoneValidationProvider: args.identity.phoneValidationProvider,
    phoneValidationCheckedAt: args.identity.phoneValidationCheckedAt,
    phoneOtpVerified: args.identity.phoneOtpVerified,
    phoneOtpVerifiedAt: args.identity.phoneOtpVerifiedAt,
    phoneNumberMasked: args.identity.phoneNumberMasked,
    phoneNumberHash: args.identity.phoneNumberHash,
    city: args.city?.trim() || undefined,
    ageRange: args.ageRange?.trim() || undefined,
    accountType: args.accountType,
  });

  return { ok: true, user: args.authUserData, userId };
}

async function sendVerificationEmailWithAppCallback(email: string): Promise<void> {
  const sendVerificationEmail = (authClient as any).sendVerificationEmail;
  if (!sendVerificationEmail) {
    throw new Error("Email verification is not available right now.");
  }

  await sendVerificationEmail({
    email,
    callbackURL: EMAIL_VERIFICATION_CALLBACK_PATH,
  });
}

/** Helper to normalize phone numbers (keeps digits only) */
export function normalizePhoneForSave(raw: string): string {
  const trimmed = String(raw || "").trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("92")) return `+${digits}`;
  if (digits.startsWith("0")) return `+92${digits.slice(1)}`;
  return `+${digits}`;
}

/**
 * Sign up with email/password.
 * Creates both Better Auth account and Convex user profile.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string,
  username?: string,
  phone?: string,
  accountType: "player" | "zone" = "player",
  city?: string,
  ageRange?: string
): Promise<AuthResult> {
  try {
    try {
      console.log("[authService] signUpWithEmail clearing existing session if any", {
        email: email.trim().toLowerCase(),
      });
      await withTimeout(
        authClient.signOut(),
        AUTH_CALL_TIMEOUT_MS,
        "Timed out while clearing the previous session. Please try again.",
      );
      console.log("[authService] signUpWithEmail session clear complete");
    } catch {
      // Ignore when there is no active session to clear.
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedUsername = username?.trim() || null;
    const normalizedPhone = phone ? normalizePhoneForSave(phone) : null;
    let authUserData: AuthUser | undefined;

    console.log("[authService] signUpWithEmail checking for recoverable auth account", {
      accountType,
      email: trimmedEmail,
    });
    const existingSignInResult = await withTimeout(
      authClient.signIn.email({
        email: trimmedEmail,
        password,
      }),
      AUTH_CALL_TIMEOUT_MS,
      "Account recovery timed out. Please try again.",
    );

    if (existingSignInResult.data?.user) {
      authUserData = existingSignInResult.data.user as AuthUser;
      console.log("[authService] signUpWithEmail recovered auth account via sign-in", {
        accountType,
        email: trimmedEmail,
        authUserId: authUserData.id,
      });
    }

    if (authUserData) {
      const existingProfile = await convex.query(api.users.getByAuthId, {
        authId: authUserData.id,
      });

      if (existingProfile) {
        if (existingProfile.accountType !== accountType) {
          return {
            ok: false,
            message: `This email is already registered as a ${existingProfile.accountType} account.`,
          };
        }

        return { ok: true, user: authUserData, userId: existingProfile._id };
      }
    }

    // New signup path: validate identity before creating auth account so we don't create orphan auth users.
    const identity = await convex.action(api.users.validateRegistrationIdentity, {
      email: trimmedEmail,
      phone: normalizedPhone || "",
      username: trimmedUsername,
      accountType,
    });

    // 1) Create Better Auth account
    const signUpData = {
      email: trimmedEmail,
      password,
      name: displayName?.trim() || "User",
    };

    if (!authUserData) {
      console.log("[authService] signUpWithEmail calling signUp.email", {
        accountType,
        email: trimmedEmail,
      });
      const { data, error } = await withTimeout(
        authClient.signUp.email(signUpData as any),
        AUTH_CALL_TIMEOUT_MS,
        "Account creation timed out. Please try again.",
      );
      console.log("[authService] signUpWithEmail signUp.email result", {
        accountType,
        email: trimmedEmail,
        hasUser: Boolean(data?.user),
        errorCode: error?.code ?? null,
        errorMessage: error?.message ?? null,
        errorStatus: error?.status ?? null,
        errorStatusText: error?.statusText ?? null,
      });

      authUserData = data?.user as AuthUser | undefined;

      if (error || !authUserData) {
        const signInResult = await withTimeout(
          authClient.signIn.email({
            email: trimmedEmail,
            password,
          }),
          AUTH_CALL_TIMEOUT_MS,
          "Account recovery timed out. Please try signing in directly.",
        );
        console.log("[authService] signUpWithEmail recovered existing auth account", {
          accountType,
          email: trimmedEmail,
          signInErrorCode: signInResult.error?.code ?? null,
          signInErrorMessage: signInResult.error?.message ?? null,
          hasUser: Boolean(signInResult.data?.user),
        });

        if (signInResult.error || !signInResult.data?.user) {
          return {
            ok: false,
            message: "This email is already registered. Sign in with the original password or use another email.",
            code: signInResult.error?.code || error?.code,
          };
        }

        authUserData = signInResult.data.user as AuthUser;
      }
    }

    // 2) Reuse existing Convex user profile when signup is retried after auth creation.
    const existingProfile = await convex.query(api.users.getByAuthId, {
      authId: authUserData.id,
    });

    if (existingProfile) {
      if (existingProfile.accountType !== accountType) {
        return {
          ok: false,
          message: `This email is already registered as a ${existingProfile.accountType} account.`,
        };
      }

      return { ok: true, user: authUserData, userId: existingProfile._id };
    }

    // 3) Create Convex user profile
    try {
      const profileResult = await ensureConvexUserProfile({
        authUserData,
        identity,
        displayName,
        city,
        ageRange,
        accountType,
      });

      return profileResult;
    } catch (e) {
      console.error("[authService] Failed to create Convex user document:", e);
      return {
        ok: false,
        message: "Account created but profile setup failed. Please try again.",
      };
    }
  } catch (e: any) {
    console.error("[authService] signUpWithEmail error:", {
      message: e?.message ?? null,
      code: e?.code ?? null,
      status: e?.status ?? null,
      statusText: e?.statusText ?? null,
      cause: e?.cause ?? null,
    });
    return { ok: false, message: mapAuthError(e), code: e?.code };
  }
}

/**
 * Sign in with email OR phone + password.
 * - If input contains "@": treated as email.
 * - Otherwise: treated as phone (lookup email first, then sign in).
 */
export async function signInWithEmail(
  emailOrPhone: string,
  password: string
): Promise<AuthResult> {
  try {
    const previousAuthId = await getCurrentSessionAuthId();
    const trimmed = emailOrPhone.trim();

    // If it looks like an email, sign in directly
    if (trimmed.includes("@")) {
      const { data, error } = await authClient.signIn.email({
        email: trimmed,
        password,
      });

      if (error || !data?.user) {
        if (isCombinedCredentialError(error)) {
          const existingUser = await convex.query(api.users.getByEmail, {
            email: trimmed,
          });

          if (existingUser) {
            return {
              ok: false,
              message: "Incorrect password. Please try again.",
              code: "auth/wrong-password",
            };
          }
        }

        return { ok: false, message: mapAuthError(error), code: error?.code };
      }

      const authUserData = data.user as AuthUser;

      // Get the Convex user ID
      const user = await convex.query(api.users.getByAuthId, { authId: authUserData.id });
      if (!user) {
        return { ok: false, message: "User profile not found." };
      }

      if (isSuspendedUser(user)) {
        await signOutUser().catch(() => null);
        return suspendedAccountResult();
      }

      if (previousAuthId && previousAuthId !== authUserData.id) {
        await markAuthUserOffline(previousAuthId);
      }

      return { ok: true, user: authUserData, userId: user._id };
    }

    // Otherwise, treat as phone login
    const normalizedPhone = normalizePhoneForSave(trimmed);

    if (!normalizedPhone) {
      return {
        ok: false,
        code: "auth/invalid-phone-number",
        message: "Invalid phone number.",
      };
    }

    // Look up user by normalized phone
    const user = await convex.query(api.users.getByPhone, { phone: normalizedPhone });

    if (!user) {
      return {
        ok: false,
        code: "auth/user-not-found",
        message: mapAuthError({ code: "auth/user-not-found" }),
      };
    }

    if (!user.email) {
      return {
        ok: false,
        code: "auth/invalid-email",
        message: "This account does not have an email configured.",
      };
    }

    if (isSuspendedUser(user)) {
      return suspendedAccountResult();
    }

    // Sign in with the found email
    const { data, error } = await authClient.signIn.email({
      email: user.email,
      password,
    });

    if (error || !data?.user) {
      if (isCombinedCredentialError(error)) {
        return {
          ok: false,
          message: "Incorrect password. Please try again.",
          code: "auth/wrong-password",
        };
      }

      return { ok: false, message: mapAuthError(error), code: error?.code };
    }

    const authUserData = data.user as AuthUser;
    if (isSuspendedUser(user)) {
      await signOutUser().catch(() => null);
      return suspendedAccountResult();
    }
    if (previousAuthId && previousAuthId !== authUserData.id) {
      await markAuthUserOffline(previousAuthId);
    }

    return { ok: true, user: authUserData, userId: user._id };
  } catch (e: any) {
    console.error("[authService] signInWithEmail error", e);
    return { ok: false, message: mapAuthError(e), code: e?.code };
  }
}

export async function recoverMissingProfileAfterLogin(
  authUser: AuthUser,
  accountType: "player" | "zone"
): Promise<AuthResult> {
  try {
    const existing = await convex.query(api.users.getByAuthId, { authId: authUser.id });
    if (existing) {
      return { ok: true, user: authUser, userId: existing._id };
    }

    const generatedUsername = `${accountType}_${Date.now()}`;
    const userId = await convex.mutation(api.users.create, {
      authId: authUser.id,
      email: authUser.email,
      fullName: authUser.name?.trim() || null,
      username: accountType === "player" ? null : generatedUsername,
      usernameLower: accountType === "player" ? null : generatedUsername,
      phone: authUser.phoneNumber ? normalizePhoneForSave(authUser.phoneNumber) : null,
      accountType,
    });

    return { ok: true, user: authUser, userId };
  } catch (e: any) {
    return { ok: false, message: mapAuthError(e), code: e?.code };
  }
}

const APP_SCHEME = "matchhai"; // must match your app.json "scheme"

/** Send password reset email */
export async function sendPasswordReset(email: string): Promise<SimpleResult> {
  try {
    const payload = {
      email: email.trim().toLowerCase(),
      redirectTo: `${APP_SCHEME}://auth/reset-password`,
    };

    const requestPasswordReset = (authClient as any).requestPasswordReset;
    if (requestPasswordReset) {
      const response = await withTimeout<any>(
        requestPasswordReset(payload),
        AUTH_CALL_TIMEOUT_MS,
        "Password reset request timed out. Please try again.",
      );
      if (!response?.error) return { ok: true };
      return {
        ok: false,
        message: mapAuthError(response.error),
        code: response.error?.code,
      };
    }

    const siteUrl = process.env.EXPO_PUBLIC_CONVEX_SITE_URL;
    if (siteUrl) {
      const response = await fetch(
        `${siteUrl.replace(/\/$/, "")}/request-password-reset`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (response.ok) return { ok: true };
    }

    return { ok: false, message: "Password reset is not available right now." };
  } catch (e: any) {
    return { ok: false, message: mapAuthError(e), code: e?.code };
  }
}

/** Apply a password reset token from the email reset deep link. */
export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
): Promise<SimpleResult> {
  try {
    const trimmedToken = String(token || "").trim();
    if (!trimmedToken) {
      return {
        ok: false,
        message: "Reset token is missing. Please request a new reset link.",
        code: "auth/invalid-token",
      };
    }

    const resetPassword = (authClient as any).resetPassword;
    if (resetPassword) {
      const { error } = await withTimeout<any>(
        resetPassword({
          newPassword,
          token: trimmedToken,
        }),
        AUTH_CALL_TIMEOUT_MS,
        "Password reset timed out. Please try again.",
      );

      if (!error) return { ok: true };
      return { ok: false, message: mapAuthError(error), code: error?.code };
    }

    const siteUrl = process.env.EXPO_PUBLIC_CONVEX_SITE_URL;
    if (siteUrl) {
      const response = await fetch(
        `${siteUrl.replace(/\/$/, "")}/reset-password`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ newPassword, token: trimmedToken }),
        },
      );

      if (response.ok) return { ok: true };

      let message = "Could not reset password. Try again.";
      try {
        const data = await response.json();
        message = data?.message || message;
      } catch {
        // Keep the fallback message when the server does not return JSON.
      }
      return { ok: false, message };
    }

    return { ok: false, message: "Password reset is not available right now." };
  } catch (e: any) {
    return { ok: false, message: mapAuthError(e), code: e?.code };
  }
}

/** Sign out current user */
export async function signOutUser(): Promise<SimpleResult> {
  try {
    await markAuthUserOffline(await getCurrentSessionAuthId());
    await clearCachedAuthSession();
    await authClient.signOut();
    await clearCachedAuthSession();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: mapAuthError(e), code: e?.code };
  }
}

/** Get current session */
export async function getSession(): Promise<AuthSession | null> {
  const { data } = await authClient.getSession();
  return data as AuthSession | null;
}

/** Get current user from session (convenience) */
export async function currentUser(): Promise<AuthUser | null> {
  const session = await getSession();
  return (session?.user as AuthUser) || null;
}

export async function requireKycAccess(): Promise<SimpleResult> {
  try {
    const authUser = await currentUser();
    if (!authUser?.id) {
      return { ok: false, code: "auth/not-authenticated", message: "Please sign in to continue." };
    }

    const profile = await convex.query(api.users.getByAuthId, { authId: authUser.id });
    if (!profile) {
      return { ok: false, code: "auth/profile-not-found", message: "User profile not found." };
    }

    if (isSuspendedUser(profile)) {
      return {
        ok: false,
        code: "auth/account-suspended",
        message: "Your MatchHai account is suspended. Please contact support.",
      };
    }

    if (!isKycAccessAllowed(profile.kycVerificationStatus)) {
      return { ok: false, code: "auth/kyc-required", message: EMAIL_VERIFICATION_REQUIRED_MESSAGE };
    }

    return { ok: true };
  } catch (error: any) {
    return {
      ok: false,
      code: "auth/kyc-check-failed",
      message: error?.message || "Could not confirm verification status. Please try again.",
    };
  }
}

export async function ensureVerifiedEmailAccess(): Promise<SimpleResult> {
  return requireKycAccess();
}

export async function sendCurrentUserVerificationEmail(): Promise<SimpleResult> {
  if (isKycVerificationBypassEnabled()) return { ok: true };
  return { ok: false, code: "auth/kyc-required", message: EMAIL_VERIFICATION_REQUIRED_MESSAGE };
}

/** Subscribe to auth state changes */
export function onAuthStateChanged(
  callback: (user: AuthUser | null) => void
): () => void {
  // Better Auth's session subscription using useSession hook alternative
  // Note: The $store API may vary by version, using type assertion for compatibility
  const store = authClient.$store as any;
  if (store?.listen) {
    return store.listen("session", (session: any) => {
      callback(session?.user || null);
    });
  }

  // Fallback: poll session changes (not ideal but ensures compatibility)
  console.warn("[authService] Session subscription not available, using polling");
  let lastUserId: string | null = null;
  const interval = setInterval(async () => {
    const session = await getSession();
    const currentUserId = session?.user?.id || null;
    if (currentUserId !== lastUserId) {
      lastUserId = currentUserId;
      callback((session?.user as AuthUser) || null);
    }
  }, 1000);

  return () => clearInterval(interval);
}
