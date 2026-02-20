// src/services/userService.ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { FaceitProfileSummary, fetchFaceitProfileFromUrl } from "../../services/faceitApi";
import { PsnVerificationResult, verifyPsnProfile } from "../../services/psnApi";
import { SteamProfileSummary, fetchSteamProfileFromUrl } from "../../services/steamApi";

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

/**
 * Check if an email is free.
 */
export async function isEmailAvailable(email: string): Promise<boolean> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return false;

  const q = query(
    collection(db, "users"),
    where("email", "==", trimmed),
    limit(1)
  );

  const snap = await getDocs(q);
  return snap.empty;
}

/**
 * Check if a Steam ID is already linked to an account.
 * If excludeUserId is provided, we ignore that specific user (useful for profile edits).
 */
export async function isSteamIdAvailable(steamId: string, excludeUserId?: string): Promise<boolean> {
  if (!steamId) return false;

  let q = query(
    collection(db, "users"),
    where("steamId", "==", steamId),
    limit(1)
  );

  const snap = await getDocs(q);
  if (snap.empty) return true;

  // If we found a match, check if it's the user we want to exclude
  if (excludeUserId && snap.docs[0].id === excludeUserId) {
    return true;
  }

  return false;
}

/**
 * Check if a FACEIT ID is already linked to an account.
 * If excludeUserId is provided, we ignore that specific user (useful for profile edits).
 */
export async function isFaceitIdAvailable(faceitId: string, excludeUserId?: string): Promise<boolean> {
  if (!faceitId) return false;

  let q = query(
    collection(db, "users"),
    where("faceitId", "==", faceitId),
    limit(1)
  );

  const snap = await getDocs(q);
  if (snap.empty) return true;

  // If we found a match, check if it's the user we want to exclude
  if (excludeUserId && snap.docs[0].id === excludeUserId) {
    return true;
  }

  return false;
}

/**
 * Check if a PSN Account ID is already linked to an account.
 */
export async function isPsnIdAvailable(psnAccountId: string, excludeUserId?: string): Promise<boolean> {
  if (!psnAccountId) return false;

  let q = query(
    collection(db, "users"),
    where("psnAccountId", "==", psnAccountId),
    limit(1)
  );

  const snap = await getDocs(q);
  if (snap.empty) return true;

  if (excludeUserId && snap.docs[0].id === excludeUserId) {
    return true;
  }

  return false;
}

/**
 * Check if an EA Profile URL is already linked to an account.
 */
export async function isEaIdAvailable(eaProfileUrl: string, excludeUserId?: string): Promise<boolean> {
  if (!eaProfileUrl) return false;

  let q = query(
    collection(db, "users"),
    where("eaProfileUrl", "==", eaProfileUrl),
    limit(1)
  );

  const snap = await getDocs(q);
  if (snap.empty) return true;

  if (excludeUserId && snap.docs[0].id === excludeUserId) {
    return true;
  }

  return false;
}

/**
 * Check if an Xbox Gamertag is already linked to an account.
 */
export async function isXboxIdAvailable(xboxGamertag: string, excludeUserId?: string): Promise<boolean> {
  if (!xboxGamertag) return false;

  let q = query(
    collection(db, "users"),
    where("xboxGamertag", "==", xboxGamertag),
    limit(1)
  );

  const snap = await getDocs(q);
  if (snap.empty) return true;

  if (excludeUserId && snap.docs[0].id === excludeUserId) {
    return true;
  }

  return false;
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

  // offline sports (MVP)
  playsFutsal?: boolean;
  playsIndoorCricket?: boolean;
  playsPadel?: boolean;
  playsPickleball?: boolean;

  futsalPositions?: string[]; // multi-select
  indoorCricketRole?: string | null;
  indoorCricketBowlingStyle?: string | null;
  indoorCricketBattingStyle?: string | null;
  padelRole?: string | null;
  pickleballRole?: string | null;
}

/**
 * Save / update the user's location + game preferences in their Firestore profile.
 * Requires the user to be signed in (auth.currentUser).
 */
export async function saveOnboardingStep2(
  prefs: OnboardingStep2Prefs
): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
  const user = auth.currentUser;

  if (!user) {
    return { ok: false, message: "Not signed in. Please log in again." };
  }

  try {
    const userRef = doc(db, "users", user.uid);

    const futsalPositions = Array.isArray(prefs.futsalPositions)
      ? prefs.futsalPositions.filter(Boolean)
      : [];

    await updateDoc(userRef, {
      areasPreferred: prefs.areasPreferred,
      playsCs2: prefs.playsCs2,
      cs2Role: prefs.cs2Role ?? null,
      playsFc: prefs.playsFc,
      fcTeam: prefs.fcTeam ?? null,
      fcFormation: prefs.fcFormation ?? null,
      playsTekken: prefs.playsTekken,
      tekkenFavorites: prefs.tekkenFavorites,

      // offline sports
      playsFutsal: !!prefs.playsFutsal,
      playsIndoorCricket: !!prefs.playsIndoorCricket,
      playsPadel: !!prefs.playsPadel,
      playsPickleball: !!prefs.playsPickleball,

      futsalPositions,
      // legacy: keep the first position for older screens
      futsalPosition: futsalPositions[0] ?? null,

      indoorCricketRole: prefs.indoorCricketRole ?? null,
      indoorCricketBowlingStyle: prefs.indoorCricketBowlingStyle ?? null,
      indoorCricketBattingStyle: prefs.indoorCricketBattingStyle ?? null,
      padelRole: prefs.padelRole ?? null,
      pickleballRole: prefs.pickleballRole ?? null,

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
  { ok: true; data: OnboardingSummary; message?: string } | { ok: false; message: string }
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
  psnProfile?: PsnVerificationResult | null;
}


/**
 * Save platform profile links for the user.
 * We store URLs / IDs only — no OAuth, no actual account connection yet.
 */
export async function saveOnboardingStep3Platforms(
  platforms: OnboardingStep3Platforms
): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
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
      steamStats: platforms.steamProfile?.stats ?? null, // Save entire stats object

      faceitId: platforms.faceitProfile?.faceitId ?? null,
      faceitNickname: platforms.faceitProfile?.nickname ?? null,
      faceitGame: platforms.faceitProfile?.game ?? null,
      faceitElo: platforms.faceitProfile?.elo ?? null,
      faceitSkillLevel: platforms.faceitProfile?.skillLevel ?? null,


      psnAccountId: platforms.psnProfile?.psnAccountId ?? null,
      psnStats: platforms.psnProfile ?? null, // Save full PSN result object

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

// ---- Profile Access for Matchroom Creation ----

export interface UserProfile {
  uid: string;
  email?: string;
  displayName?: string;
  fullName?: string;
  username?: string;
  role?: 'player' | 'zone-admin' | 'super-admin';
  trustScore?: number; // 0-1 confidence score for voting interactions
  isOnline?: boolean;

  // Gaming profiles
  playsCs2?: boolean;
  playsFc?: boolean;
  playsTekken?: boolean;
  playsFutsal?: boolean;
  playsIndoorCricket?: boolean;
  playsPadel?: boolean;
  playsPickleball?: boolean;

  cs2Role?: string;
  faceitId?: string;
  faceitSkillLevel?: number;
  faceitElo?: number;
  faceitProfileUrl?: string;

  steamId?: string;
  steamPersonaName?: string;
  steamProfileUrl?: string;
  steamCs2Hours?: number;
  steamFc26Hours?: number;

  fcTeam?: string;
  fcFormation?: string;

  tekkenFavorites?: string[];
  tekkenSkillScore?: number;
  tekkenSkillBracket?: "A" | "B" | "C" | "D";

  // Sports profiles (from step 2 if they exist)
  futsalPosition?: string;
  futsalPositions?: string[];
  indoorCricketRole?: string;
  indoorCricketBowlingStyle?: string;
  indoorCricketBattingStyle?: string;
  padelRole?: string;
  pickleballRole?: string;

  // Location preferences
  areasPreferred?: string[];
  city?: string;

  // PSN Stats
  psnAccountId?: string;
  psnOnlineId?: string;
  psnStats?: PsnVerificationResult;

  // Skill Scores (MatchHai Ratings)
  skillScores?: {
    cs2?: import('./skillRatingService').GameSkillScore;
    tekken8?: import('./skillRatingService').GameSkillScore;
    fc26?: import('./skillRatingService').GameSkillScore;
    fc25?: import('./skillRatingService').GameSkillScore;
    futsal?: import('./skillRatingService').GameSkillScore;
    indoor_cricket?: import('./skillRatingService').GameSkillScore;
    padel?: import('./skillRatingService').GameSkillScore;
    pickleball?: import('./skillRatingService').GameSkillScore;
  };

  // Team references (Phase 2)
  teamsByGame?: {
    [gameKey: string]: string[]; // teamIds
  };

  // Frontend Privacy Settings
  hideAreasPublicly?: boolean;
  hidePlatformsPublicly?: boolean;
  restrictInvitesToFriends?: boolean;
}

const SKILL_THRESHOLDS = {
  BEGINNER: 30,
  INTERMEDIATE: 60,
  ADVANCED: 80,
};

function clampSkillRating(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getTierFromRatingLocal(rating: number) {
  if (rating <= SKILL_THRESHOLDS.BEGINNER) return "Beginner";
  if (rating <= SKILL_THRESHOLDS.INTERMEDIATE) return "Intermediate";
  if (rating <= SKILL_THRESHOLDS.ADVANCED) return "Advanced";
  return "Pro";
}

function normalizeSkillScores(
  skillScores?: UserProfile["skillScores"]
): UserProfile["skillScores"] | undefined {
  if (!skillScores) return undefined;

  const normalized: Record<string, any> = {};
  Object.entries(skillScores).forEach(([key, score]) => {
    if (!score) return;
    if (typeof (score as any).rating !== "number") {
      normalized[key] = score;
      return;
    }
    const rating = clampSkillRating((score as any).rating);
    normalized[key] = {
      ...score,
      rating,
      tier: getTierFromRatingLocal(rating),
    };
  });

  return normalized as UserProfile["skillScores"];
}

/**
 * Get a user's profile by their UID.
 * Used for matchroom creation and other features that need user data.
 */
export async function getUserProfile(
  uid: string
): Promise<{ ok: true; data: UserProfile; message?: string } | { ok: false; message: string }> {
  try {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      return { ok: false, message: "User profile not found." };
    }

    const data = snap.data();
    const profile: UserProfile = {
      uid: snap.id,
      email: data.email ?? undefined,
      displayName: data.displayName ?? undefined,
      fullName: data.fullName ?? undefined,
      username: data.username ?? undefined,
      role: (data.accountType === "super-admin" || data.role === "super-admin" || (data.email && data.email.toLowerCase() === "superadmin@matchhai.com"))
        ? "super-admin"
        : (data.accountType === 'zone' ? 'zone-admin' : (data.accountType || data.role || 'player')),
      trustScore: typeof data.trustScore === 'number' ? data.trustScore : 0.5, // Default trust
      isOnline: data.isOnline ?? false,

      // Gaming profiles
      playsCs2: !!data.playsCs2,
      playsFc: !!data.playsFc,
      playsTekken: !!data.playsTekken,
      playsFutsal: !!data.playsFutsal,
      playsIndoorCricket: !!data.playsIndoorCricket,
      playsPadel: !!data.playsPadel,
      playsPickleball: !!data.playsPickleball,

      cs2Role: data.cs2Role ?? undefined,
      faceitSkillLevel: data.faceitSkillLevel ?? undefined,
      faceitElo: data.faceitElo ?? undefined,
      faceitProfileUrl: data.faceitProfileUrl ?? undefined,
      steamProfileUrl: data.steamProfileUrl ?? undefined,
      steamCs2Hours: data.steamCs2Hours ?? undefined,
      steamFc26Hours: data.steamFc26Hours ?? undefined,
      fcTeam: data.fcTeam ?? undefined,
      fcFormation: data.fcFormation ?? undefined,
      tekkenFavorites: data.tekkenFavorites ?? undefined,
      tekkenSkillScore: data.tekkenSkillScore ?? undefined,
      tekkenSkillBracket: data.tekkenSkillBracket ?? undefined,

      // Sports profiles
      futsalPosition: data.futsalPosition ?? undefined,
      futsalPositions: Array.isArray(data.futsalPositions)
        ? data.futsalPositions.filter(Boolean)
        : (data.futsalPosition ? [data.futsalPosition] : undefined),
      indoorCricketRole: data.indoorCricketRole ?? undefined,
      indoorCricketBowlingStyle: data.indoorCricketBowlingStyle ?? undefined,
      indoorCricketBattingStyle: data.indoorCricketBattingStyle ?? undefined,
      padelRole: data.padelRole ?? undefined,
      pickleballRole: data.pickleballRole ?? undefined,

      // Location preferences
      areasPreferred: data.areasPreferred ?? undefined,
      city: data.city ?? undefined,

      // PSN
      psnOnlineId: data.psnOnlineId ?? undefined,
      psnStats: data.psnStats ?? undefined,

      // Skill Scores
      skillScores: normalizeSkillScores(data.skillScores) ?? undefined,

      // Team references
      teamsByGame: data.teamsByGame ?? undefined,
    };

    return { ok: true, data: profile };
  } catch (e) {
    console.log("[userService] getUserProfile error", e);
    return {
      ok: false,
      message: "Could not load user profile. Please try again.",
    };
  }
}


export const getUserSportProfile = (profile: UserProfile, gameKey: string) => {
  switch (gameKey) {
    case 'cs2':
      return {
        role: profile.cs2Role,
        skillLevel: profile.faceitSkillLevel,
      };
    case 'fc25':
    case 'fc26':
      return {
        team: profile.fcTeam,
        formation: profile.fcFormation,
      };
    case 'tekken8':
      return {
        favorites: profile.tekkenFavorites || [],
      };
    case 'futsal':
      return {
        positions: profile.futsalPositions || (profile.futsalPosition ? [profile.futsalPosition] : []),
      };
    case 'indoor_cricket':
      return {
        role: profile.indoorCricketRole,
        bowlingStyle: profile.indoorCricketBowlingStyle,
        battingStyle: profile.indoorCricketBattingStyle,
      };
    case 'padel':
      return {
        role: profile.padelRole,
      };
    case 'pickleball':
      return {
        role: profile.pickleballRole,
      };
    default:
      return null;
  }
};

export const getUserSportRoleLabel = (profile: UserProfile, gameKey: string): string | null => {
  const sportProfile: any = getUserSportProfile(profile, gameKey);
  if (!sportProfile) return null;

  switch (gameKey) {
    case 'cs2': {
      const role = typeof sportProfile.role === 'string' ? sportProfile.role.trim() : '';
      if (role) return role;
      const level = sportProfile.skillLevel;
      if (typeof level === 'number' && level > 0) return `FACEIT Lv ${level}`;
      return null;
    }
    case 'fc25':
    case 'fc26': {
      const team = typeof sportProfile.team === 'string' ? sportProfile.team.trim() : '';
      const formation = typeof sportProfile.formation === 'string' ? sportProfile.formation.trim() : '';
      if (team && formation) return `${team} (${formation})`;
      if (team) return team;
      if (formation) return formation;
      return null;
    }
    case 'tekken8': {
      const favorites = Array.isArray(sportProfile.favorites) ? sportProfile.favorites.filter(Boolean) : [];
      if (favorites.length === 0) return null;
      if (favorites.length === 1) return String(favorites[0]);
      return `${favorites[0]} +${favorites.length - 1}`;
    }
    case 'futsal': {
      const positions = Array.isArray(sportProfile.positions) ? sportProfile.positions.filter(Boolean) : [];
      if (positions.length === 0) return null;
      if (positions.length === 1) return String(positions[0]);
      return positions.join(", ");
    }
    case 'indoor_cricket': {
      const role = typeof sportProfile.role === 'string' ? sportProfile.role.trim() : '';
      return role || null;
    }
    case 'padel':
    case 'pickleball': {
      const role = typeof sportProfile.role === 'string' ? sportProfile.role.trim() : '';
      return role || null;
    }
    default:
      return null;
  }
};

/**
 * Refresh a user's gaming stats (Steam/Faceit) by calling the live APIs.
 * This ensures we always show the latest ELO/Hours even if they ranked up recently.
 */
export async function refreshUserStats(
  userId: string
): Promise<{ ok: true; data: Partial<UserProfile>; message?: string } | { ok: false; message: string }> {
  try {
    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      return { ok: false, message: "User not found." };
    }

    const data = snap.data();
    const updates: any = {};
    const refreshedData: Partial<UserProfile> = {};

    // 1. Refresh Steam if linked
    // We prioritize using the stored URL to re-fetch
    let steamUrl = data.steamProfileUrl;
    if (steamUrl) {
      // If we only have an ID but no URL saved, we might construct one, 
      // but for now we assume URL is the source of truth for re-fetching.
      console.log(`[refreshUserStats] Refreshing Steam for ${userId}...`);
      const steamRes = await fetchSteamProfileFromUrl(steamUrl);
      if (steamRes.ok) {
        updates.steamId = steamRes.data.steamId;
        updates.steamPersonaName = steamRes.data.personaName;
        updates.steamCs2Hours = steamRes.data.cs2Hours;
        updates.steamStats = steamRes.data.stats || null;
        updates.updatedAt = serverTimestamp();

        // only return what changed relevant to UI
        // (UserProfile doesn't strictly have 'steamCs2Hours' typed on it yet in all interfaces, 
        // but often we just want to know it succeeded)
      }
    }

    // 2. Refresh FACEIT if linked
    let faceitUrl = data.faceitProfileUrl;
    if (faceitUrl) {
      console.log(`[refreshUserStats] Refreshing FACEIT for ${userId}...`);
      // We pass 'cs2' as default game
      const faceitRes = await fetchFaceitProfileFromUrl(faceitUrl, "cs2");
      if (faceitRes.ok) {
        updates.faceitId = faceitRes.data.faceitId;
        updates.faceitNickname = faceitRes.data.nickname;
        updates.faceitGame = faceitRes.data.game;
        updates.faceitElo = faceitRes.data.elo;
        updates.faceitSkillLevel = faceitRes.data.skillLevel;
        updates.updatedAt = serverTimestamp();

        refreshedData.faceitSkillLevel = faceitRes.data.skillLevel;
        // extended fields can be added to UserProfile if needed
      }
    }

    // 3. Refresh PSN if linked
    let psnId = data.psnOnlineId;
    if (psnId) {
      // Check if they want Tekken/FC based on current profile flags
      // We can just ask for both, the backend handles "not found" gracefully for each title.
      // Or read playsTekken/playsFc from 'data'.
      const wantsTekken = !!data.playsTekken;
      const wantsFc = !!data.playsFc;

      if (wantsTekken || wantsFc) {
        console.log(`[refreshUserStats] Refreshing PSN for ${userId}...`);
        const psnRes = await verifyPsnProfile(psnId, wantsTekken, wantsFc);

        if (psnRes.ok) {
          updates.psnStats = psnRes.data;
          updates.updatedAt = serverTimestamp();
          refreshedData.psnStats = psnRes.data;
        }
      }
    }

    // If we have updates, save them
    if (Object.keys(updates).length > 0) {
      await updateDoc(userRef, updates);
      console.log("[refreshUserStats] Updates saved:", updates);
      return { ok: true, data: refreshedData };
    }

    return { ok: true, data: {} }; // no changes needed
  } catch (e) {
    console.log("[refreshUserStats] error", e);
    return { ok: false, message: "Failed to refresh stats." };
  }
}
/**
 * Get all friends of a specific user.
 */
export async function getUserFriends(uid: string): Promise<{ ok: true; data: Array<{ uid: string; username: string }>; message?: string } | { ok: false; message: string }> {
  try {
    const friendsRef = collection(db, "users", uid, "friends");
    const snap = await getDocs(friendsRef);

    const friends = snap.docs.map((doc: any) => ({
      uid: doc.id,
      username: doc.data().username || 'Unknown'
    }));

    return { ok: true, data: friends };
  } catch (e) {
    console.log("[userService] getUserFriends error", e);
    return { ok: false, message: "Failed to load friends." };
  }
}

export async function addWalletFunds(
  uid: string,
  amount: number,
  source: string = "manual"
): Promise<{ ok: true; balance: number } | { ok: false; message: string }> {
  if (!uid) return { ok: false, message: "User not found." };
  const safeAmount = Number(amount);
  if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
    return { ok: false, message: "Invalid amount." };
  }

  try {
    const userRef = doc(db, "users", uid);
    const txRef = doc(collection(db, "users", uid, "wallet_transactions"));

    const updatedBalance = await runTransaction(db, async (transaction: any) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) {
        throw new Error("User not found");
      }

      const currentBalance = Number(userSnap.data()?.walletBalance || 0);
      const nextBalance = currentBalance + safeAmount;

      transaction.update(userRef, {
        walletBalance: nextBalance,
        updatedAt: serverTimestamp(),
      });

      transaction.set(txRef, {
        type: "topup",
        amount: safeAmount,
        source,
        status: "confirmed",
        balanceAfter: nextBalance,
        createdAt: serverTimestamp(),
      });

      return nextBalance;
    });

    return { ok: true, balance: updatedBalance };
  } catch (error) {
    Logger.error("userService", "Failed to add wallet funds", error);
    return { ok: false, message: "Failed to add funds." };
  }
}

export async function deductWalletFunds(
  uid: string,
  amount: number,
  source: string = "manual"
): Promise<{ ok: true } | { ok: false; message: string; code?: string }> {
  if (!uid) return { ok: false, message: "User not found." };
  const safeAmount = Number(amount);
  if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
    return { ok: false, message: "Invalid amount." };
  }

  try {
    const userRef = doc(db, "users", uid);
    const txRef = doc(collection(db, "users", uid, "wallet_transactions"));

    await runTransaction(db, async (transaction: any) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) {
        throw new Error("User not found");
      }

      const currentBalance = Number(userSnap.data()?.walletBalance || 0);
      if (!Number.isFinite(currentBalance) || currentBalance < safeAmount) {
        const err: any = new Error("insufficient_wallet");
        err.code = "insufficient_wallet";
        throw err;
      }

      const nextBalance = currentBalance - safeAmount;
      transaction.update(userRef, {
        walletBalance: nextBalance,
        updatedAt: serverTimestamp(),
      });

      transaction.set(txRef, {
        type: "debit",
        amount: safeAmount,
        source,
        status: "completed",
        balanceAfter: nextBalance,
        createdAt: serverTimestamp(),
      });
    });

    return { ok: true };
  } catch (error: any) {
    if (error?.code === "insufficient_wallet" || error?.message === "insufficient_wallet") {
      return { ok: false, code: "insufficient_wallet", message: "Insufficient wallet balance." };
    }
    Logger.error("userService", "Failed to deduct wallet funds", error);
    return { ok: false, message: "Failed to debit wallet." };
  }
}
