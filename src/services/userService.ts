// src/services/userService.ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../config/firebaseConfig";

function normalizePhone(raw: string) {
  // keep digits only (so +92, spaces, etc. are normalized)
  return raw.replace(/\D/g, "");
}

/**
 * Check if a username is free.
 * We store and compare a lowercase version so checks are case-insensitive.
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const trimmed = username.trim().toLowerCase();
  if (!trimmed) return false;

  const q = query(
    collection(db, "users"),
    where("usernameLower", "==", trimmed),
    limit(1)
  );

  const snap = await getDocs(q);
  return snap.empty;
}

/**
 * Check if a phone is free.
 * We store phone in normalized numeric form, like 03xxxxxxxxx / 923xxxxxxxxx.
 */
export async function isPhoneAvailable(phone: string): Promise<boolean> {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;

  const q = query(
    collection(db, "users"),
    where("phone", "==", normalized),
    limit(1)
  );

  const snap = await getDocs(q);
  return snap.empty;
}

/** Helper you can reuse inside signUp to normalize phone before saving */
export function normalizePhoneForSave(phone: string) {
  return normalizePhone(phone);
}

// ---- Onboarding Step 2: Location & Game Preferences ----

export interface OnboardingStep2Prefs {
  areasPreferred: string[]; // selectedAreas
  playsCs2: boolean;
  cs2Role: string | null;
  playsFc: boolean;
  fcTeam: string | null;
  fcFormation: string | null;
  playsTekken: boolean;
  tekkenFavorites: string[]; // up to 3 characters
}

/**
 * Save / update the user's location + game preferences in their Firestore profile.
 * Requires the user to be signed in (auth.currentUser).
 */
export async function saveOnboardingStep2(
  prefs: OnboardingStep2Prefs
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = auth.currentUser;

  if (!user) {
    return { ok: false, message: "Not signed in. Please log in again." };
  }

  try {
    const userRef = doc(db, "users", user.uid);

    await updateDoc(userRef, {
      areasPreferred: prefs.areasPreferred,
      playsCs2: prefs.playsCs2,
      cs2Role: prefs.cs2Role ?? null,
      playsFc: prefs.playsFc,
      fcTeam: prefs.fcTeam ?? null,
      fcFormation: prefs.fcFormation ?? null,
      playsTekken: prefs.playsTekken,
      tekkenFavorites: prefs.tekkenFavorites,
      updatedAt: serverTimestamp(),
    });

    return { ok: true };
  } catch (e) {
    console.log("[userService] saveOnboardingStep2 error", e);
    return {
      ok: false,
      message: "Could not save your preferences. Please try again.",
    };
  }
}

// ---- Onboarding summary for Step 3 ----

export interface OnboardingSummary {
  fullName: string | null;
  username: string | null;
  areasPreferred: string[];
  playsCs2: boolean;
  playsFc: boolean;
  playsTekken: boolean;
}

/** Load basic profile + step 2 prefs for Step 3 screen */
export async function fetchOnboardingSummary(): Promise<
  { ok: true; data: OnboardingSummary } | { ok: false; message: string }
> {
  const user = auth.currentUser;
  if (!user) {
    return { ok: false, message: "Not signed in. Please log in again." };
  }

  try {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      return { ok: false, message: "User profile not found in database." };
    }

    const data: any = snap.data();

    return {
      ok: true,
      data: {
        fullName: data.fullName ?? null,
        username: data.username ?? null,
        areasPreferred: Array.isArray(data.areasPreferred)
          ? data.areasPreferred
          : [],
        playsCs2: !!data.playsCs2,
        playsFc: !!data.playsFc,
        playsTekken: !!data.playsTekken,
      },
    };
  } catch (e) {
    console.log("[userService] fetchOnboardingSummary error", e);
    return {
      ok: false,
      message: "Could not load your previous selections. Please try again.",
    };
  }
}

// ---- Onboarding Step 3: Connected platforms ----

export interface OnboardingStep3Platforms {
  steam: boolean;
  faceit: boolean;
  ea: boolean;
  xbox: boolean;
  psn: boolean;
}

/**
 * Save connected platforms for the user.
 * (This is still "soft" — just flags, no real OAuth yet.)
 */
export async function saveOnboardingStep3Platforms(
  platforms: OnboardingStep3Platforms
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = auth.currentUser;
  if (!user) {
    return { ok: false, message: "Not signed in. Please log in again." };
  }

  try {
    const userRef = doc(db, "users", user.uid);

    await updateDoc(userRef, {
      platformSteam: platforms.steam,
      platformFaceit: platforms.faceit,
      platformEa: platforms.ea,
      platformXbox: platforms.xbox,
      platformPsn: platforms.psn,
      onboardingStep: 3,
      updatedAt: serverTimestamp(),
    });

    return { ok: true };
  } catch (e) {
    console.log("[userService] saveOnboardingStep3Platforms error", e);
    return {
      ok: false,
      message: "Could not save your connected platforms. Please try again.",
    };
  }
}
