// src/services/authService.ts
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "../config/firebaseConfig";
import { normalizePhoneForSave } from "./userService";

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
    case "auth/operation-not-allowed":
      return "Email/password sign-in is disabled for this project. Enable it in Firebase console.";
    case "auth/invalid-credential":
      return "The provided sign-in credentials are not valid anymore. Please sign in again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export type AuthResult =
  | { ok: true; user: User }
  | { ok: false; message: string; code?: string };

/**
 * Sign up with email/password.
 *
 * `displayName` = full name shown in Firebase Auth
 * `username`    = MatchHai handle (saved in Firestore + `usernameLower`)
 * `phone`       = normalized and saved in Firestore
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string,
  username?: string,
  phone?: string
): Promise<AuthResult> {
  console.log("[authService] signUpWithEmail start", {
    email,
    hasPassword: !!password,
    displayName,
    username,
    phone,
  });

  try {
    const trimmedEmail = email.trim();
    console.log("[authService] before createUserWithEmailAndPassword");
    const cred = await createUserWithEmailAndPassword(
      auth,
      trimmedEmail,
      password
    );
    console.log("[authService] user created", cred.user.uid);

    // 1) Update displayName in Firebase Auth (non-fatal if it fails)
    if (displayName) {
      try {
        console.log("[authService] updating displayName");
        await updateProfile(cred.user, { displayName: displayName.trim() });
        console.log("[authService] displayName updated");
      } catch (err) {
        console.warn(
          "[authService] updateProfile failed (non-fatal, continuing):",
          err
        );
      }
    }

    // 2) Fire-and-forget Firestore profile write (DO NOT await)
    try {
      const uid = cred.user.uid;
      const usernameTrimmed = username?.trim() || null;
      const usernameLower = usernameTrimmed
        ? usernameTrimmed.toLowerCase()
        : null;
      const normalizedPhone = phone ? normalizePhoneForSave(phone) : null;

      console.log("[authService] scheduling Firestore user doc write");
      setDoc(doc(db, "users", uid), {
        uid,
        email: trimmedEmail.toLowerCase(),
        fullName: displayName ? displayName.trim() : null,
        username: usernameTrimmed,
        usernameLower,
        phone: normalizedPhone,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
        .then(() => {
          console.log("[authService] Firestore user doc written");
        })
        .catch((e) => {
          console.warn(
            "[authService] Failed to create Firestore user document (non-fatal):",
            e
          );
        });
    } catch (e) {
      console.warn(
        "[authService] Firestore user doc threw synchronously (non-fatal):",
        e
      );
    }

    console.log(
      "[authService] signUpWithEmail returning OK (not waiting for Firestore)"
    );
    return { ok: true, user: cred.user };
  } catch (e: any) {
    console.error("[authService] signUpWithEmail error", e);
    return { ok: false, message: mapAuthError(e?.code), code: e?.code };
  }
}

/** Sign in with email/password */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return { ok: true, user: cred.user };
  } catch (e: any) {
    return { ok: false, message: mapAuthError(e?.code), code: e?.code };
  }
}

/** Send password reset email */
export async function sendPasswordReset(
  email: string
): Promise<{ ok: true } | { ok: false; message: string; code?: string }> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: mapAuthError(e?.code), code: e?.code };
  }
}

/** Sign out current user */
export async function signOutUser(): Promise<
  { ok: true } | { ok: false; message: string; code?: string }
> {
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
