import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  User,
} from "firebase/auth";
import { auth } from "../config/firebaseConfig";

/** Friendly message mapper for common Firebase Auth errors */
function mapAuthError(code?: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "Invalid email address.";
    case "auth/email-already-in-use":
      return "This email is already registered.";
    case "auth/weak-password":
      return "Password is too weak (use at least 6 characters).";
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export type AuthResult =
  | { ok: true; user: User }
  | { ok: false; message: string; code?: string };

/** Sign up with email/password (optionally set displayName) */
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<AuthResult> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (displayName) {
      try {
        await updateProfile(cred.user, { displayName });
      } catch {
        // non-fatal: profile update can fail if offline; user is still created
      }
    }
    return { ok: true, user: cred.user };
  } catch (e: any) {
    return { ok: false, message: mapAuthError(e?.code), code: e?.code };
  }
}

/** Sign in with email/password */
export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return { ok: true, user: cred.user };
  } catch (e: any) {
    return { ok: false, message: mapAuthError(e?.code), code: e?.code };
  }
}

/** Send password reset email */
export async function sendPasswordReset(email: string): Promise<{ ok: true } | { ok: false; message: string; code?: string }> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: mapAuthError(e?.code), code: e?.code };
  }
}

/** Sign out current user */
export async function signOutUser(): Promise<{ ok: true } | { ok: false; message: string; code?: string }> {
  try {
    await signOut(auth);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: mapAuthError(e?.code), code: e?.code };
  }
}

/** Convenience getter (null if signed out) */
export function currentUser(): User | null {
  return auth.currentUser;
}
