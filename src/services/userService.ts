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
import type { FaceitProfileSummary } from "../services/faceitApi";
import type { SteamProfileSummary } from "../services/steamApi";

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

// ---- Onboarding Step 3: Platform profile links ----

export interface OnboardingStep3Platforms {
  steamProfileUrl: string | null;
  faceitProfileUrl: string | null;
  eaProfileUrl: string | null;
  xboxGamertag: string | null;
  psnOnlineId: string | null;

  // optional, from API lookups
  steamProfile?: SteamProfileSummary | null;
  faceitProfile?: FaceitProfileSummary | null;
}


/**
 * Save platform profile links for the user.
 * We store URLs / IDs only — no OAuth, no actual account connection yet.
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
      steamProfileUrl: platforms.steamProfileUrl ?? null,
      faceitProfileUrl: platforms.faceitProfileUrl ?? null,
      eaProfileUrl: platforms.eaProfileUrl ?? null,
      xboxGamertag: platforms.xboxGamertag ?? null,
      psnOnlineId: platforms.psnOnlineId ?? null,

      // flatten summaries so they’re easy to query later
      steamId: platforms.steamProfile?.steamId ?? null,
      steamPersonaName: platforms.steamProfile?.personaName ?? null,
      steamCs2Hours: platforms.steamProfile?.cs2Hours ?? null,
      faceitId: platforms.faceitProfile?.faceitId ?? null,
      faceitNickname: platforms.faceitProfile?.nickname ?? null,
      faceitGame: platforms.faceitProfile?.game ?? null,
      faceitElo: platforms.faceitProfile?.elo ?? null,
      faceitSkillLevel: platforms.faceitProfile?.skillLevel ?? null,

      onboardingStep: 3,
      updatedAt: serverTimestamp(),
    });

    return { ok: true };
  } catch (e) {
    console.log("[userService] saveOnboardingStep3Platforms error", e);
    return {
      ok: false,
      message: "Could not save your platform links. Please try again.",
    };
  }
}


