// src/services/convex/authService.ts
// Convex-based auth service that wraps Better Auth
// Maintains the same interface as the Firebase auth service

import { authClient, AuthSession, AuthUser } from "../../lib/auth-client";
import { convex } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

/** Friendly message mapper for common auth errors */
function mapAuthError(error?: any): string {
  const code = error?.code || error?.message || "";

  if (code.includes("invalid-email") || code.includes("INVALID_EMAIL")) {
    return "Invalid email address.";
  }
  if (code.includes("email-already") || code.includes("EMAIL_EXISTS") || code.includes("already registered")) {
    return "This email is already registered.";
  }
  if (code.includes("weak-password") || code.includes("WEAK_PASSWORD")) {
    return "Password is too weak (use at least 6 characters).";
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

  return error?.message || "Something went wrong. Please try again.";
}

export type AuthResult =
  | { ok: true; user: AuthUser; userId: Id<"users"> }
  | { ok: false; message: string; code?: string };

export type SimpleResult =
  | { ok: true }
  | { ok: false; message: string; code?: string };

/** Helper to normalize phone numbers (keeps digits only) */
export function normalizePhoneForSave(raw: string): string {
  return raw.replace(/\D/g, "");
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
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedUsername = username?.trim() || null;
    const normalizedPhone = phone ? normalizePhoneForSave(phone) : null;

    // 1) Create Better Auth account
    const signUpData = {
      email: trimmedEmail,
      password,
      name: displayName?.trim() || "User",
    };

    const { data, error } = await authClient.signUp.email(signUpData as any);

    if (error || !data?.user) {
      return { ok: false, message: mapAuthError(error), code: error?.code };
    }

    const authUserData = data.user as AuthUser;

    // 2) Create Convex user profile
    try {
      const userId = await convex.mutation(api.users.create, {
        authId: authUserData.id,
        email: trimmedEmail,
        fullName: displayName?.trim() || null,
        username: trimmedUsername,
        usernameLower: trimmedUsername?.toLowerCase() || null,
        phone: normalizedPhone,
        city: city?.trim() || undefined,
        ageRange: ageRange?.trim() || undefined,
        accountType,
      });

      return { ok: true, user: authUserData, userId };
    } catch (e) {
      console.error("[authService] Failed to create Convex user document:", e);
      return {
        ok: false,
        message: "Account created but profile setup failed. Please try again.",
      };
    }
  } catch (e: any) {
    console.error("[authService] signUpWithEmail error:", e?.message);
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
    const trimmed = emailOrPhone.trim();

    // If it looks like an email, sign in directly
    if (trimmed.includes("@")) {
      const { data, error } = await authClient.signIn.email({
        email: trimmed,
        password,
      });

      if (error || !data?.user) {
        return { ok: false, message: mapAuthError(error), code: error?.code };
      }

      const authUserData = data.user as AuthUser;

      // Get the Convex user ID
      const user = await convex.query(api.users.getByAuthId, { authId: authUserData.id });
      if (!user) {
        return { ok: false, message: "User profile not found." };
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

    // Sign in with the found email
    const { data, error } = await authClient.signIn.email({
      email: user.email,
      password,
    });

    if (error || !data?.user) {
      return { ok: false, message: mapAuthError(error), code: error?.code };
    }

    return { ok: true, user: data.user as AuthUser, userId: user._id };
  } catch (e: any) {
    console.error("[authService] signInWithEmail error", e);
    return { ok: false, message: mapAuthError(e), code: e?.code };
  }
}

/** Send password reset email */
export async function sendPasswordReset(email: string): Promise<SimpleResult> {
  try {
    // Better Auth uses forgetPassword (note: the method may vary by version)
    const forgetPasswordFn = (authClient as any).forgetPassword || (authClient as any).forgotPassword;

    if (!forgetPasswordFn) {
      // Fallback: try to use the email-based password reset
      console.warn("[authService] Password reset not available in this Better Auth version");
      return { ok: false, message: "Password reset is not available at this time." };
    }

    const { error } = await forgetPasswordFn({
      email: email.trim(),
      redirectTo: "/auth/reset-password",
    });

    if (error) {
      return { ok: false, message: mapAuthError(error), code: error?.code };
    }

    return { ok: true };
  } catch (e: any) {
    console.error("[authService] sendPasswordReset error", e);
    return { ok: false, message: mapAuthError(e), code: e?.code };
  }
}

/** Sign out current user */
export async function signOutUser(): Promise<SimpleResult> {
  try {
    await authClient.signOut();
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
