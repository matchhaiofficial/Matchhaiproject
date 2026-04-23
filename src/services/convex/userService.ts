// src/services/convex/userService.ts
// Convex-based user service that wraps Convex queries/mutations
// Maintains the same interface as the Firebase user service

import { convex } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";
import { Id, Doc } from "../../../convex/_generated/dataModel";
import { currentUser } from "./authService";

// Re-export types
export type UserProfile = Doc<"users">;

/** Helper to normalize phone numbers (keeps digits only) */
function normalizePhone(raw: string) {
  const trimmed = String(raw || "").trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("92")) return `+${digits}`;
  if (digits.startsWith("0")) return `+92${digits.slice(1)}`;
  return `+${digits}`;
}

export function normalizePhoneForSave(phone: string) {
  return normalizePhone(phone);
}

// ============================================
// AVAILABILITY CHECKS
// ============================================

export async function isUsernameAvailable(
  username: string,
  excludeUserId?: Id<"users">
): Promise<boolean> {
  return await convex.query(api.users.isUsernameAvailable, {
    username,
    excludeUserId,
  });
}

export async function isPhoneAvailable(
  phone: string,
  excludeUserId?: Id<"users">
): Promise<boolean> {
  return await convex.query(api.users.isPhoneAvailable, {
    phone: normalizePhone(phone),
    excludeUserId,
  });
}

export async function isEmailAvailable(
  email: string,
  excludeUserId?: Id<"users">
): Promise<boolean> {
  return await convex.query(api.users.isEmailAvailable, {
    email,
    excludeUserId,
  });
}

export async function isSteamIdAvailable(
  steamId: string,
  excludeUserId?: Id<"users">
): Promise<boolean> {
  return await convex.query(api.users.isSteamIdAvailable, {
    steamId,
    excludeUserId,
  });
}

export async function isPsnIdAvailable(
  psnAccountId: string,
  excludeUserId?: Id<"users">
): Promise<boolean> {
  return await convex.query(api.users.isPsnAccountIdAvailable, {
    psnAccountId,
    excludeUserId,
  });
}

export async function isFaceitIdAvailable(
  faceitId: string,
  excludeUserId?: Id<"users">
): Promise<boolean> {
  return await convex.query(api.users.isFaceitIdAvailable, {
    faceitId,
    excludeUserId,
  });
}

export async function isEaIdAvailable(
  eaId: string,
  excludeUserId?: Id<"users">
): Promise<boolean> {
  return await convex.query(api.users.isEaIdAvailable, {
    eaId,
    excludeUserId,
  });
}

export async function isXboxIdAvailable(
  xboxGamertag: string,
  excludeUserId?: Id<"users">
): Promise<boolean> {
  return await convex.query(api.users.isXboxGamertagAvailable, {
    xboxGamertag,
    excludeUserId,
  });
}

// ============================================
// ONBOARDING
// ============================================

export interface OnboardingStep2Prefs {
  areasPreferred: string[];
  playsCs2: boolean;
  cs2Role: string | null;
  playsCs16: boolean;
  cs16Role: string | null;
  playsValorant: boolean;
  valorantRole: string | null;
  playsFc: boolean;
  fcTeam: string | null;
  fcFormation: string | null;
  playsTekken: boolean;
  tekkenFavorites: string[];
  playsFutsal?: boolean;
  playsIndoorCricket?: boolean;
  playsPadel?: boolean;
  playsPickleball?: boolean;
  futsalPositions?: string[];
  indoorCricketRole?: string | null;
  indoorCricketBowlingStyle?: string | null;
  indoorCricketBattingStyle?: string | null;
  padelRole?: string | null;
  pickleballRole?: string | null;
}

export async function saveOnboardingStep2(
  userId: Id<"users">,
  prefs: OnboardingStep2Prefs
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await convex.mutation(api.users.saveOnboardingStep2, {
      userId,
      ...prefs,
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

export interface OnboardingSummary {
  fullName: string | null;
  username: string | null;
  areasPreferred: string[];
  playsCs2: boolean;
  playsCs16: boolean;
  playsValorant: boolean;
  playsFc: boolean;
  playsTekken: boolean;
}

export async function fetchOnboardingSummary(
  userId: Id<"users">
): Promise<
  | { ok: true; data: OnboardingSummary }
  | { ok: false; message: string }
> {
  try {
    const user = await convex.query(api.users.getById, { userId });

    if (!user) {
      return { ok: false, message: "User profile not found in database." };
    }

    return {
      ok: true,
      data: {
        fullName: user.fullName ?? null,
        username: user.username ?? null,
        areasPreferred: (user as any).areasPreferred ?? [],
        playsCs2: !!(user as any).playsCs2,
        playsCs16: !!(user as any).playsCs16,
        playsValorant: !!(user as any).playsValorant,
        playsFc: !!(user as any).playsFc,
        playsTekken: !!(user as any).playsTekken,
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

export interface OnboardingStep3Platforms {
  steamProfileUrl: string | null;
  faceitProfileUrl: string | null;
  eaProfileUrl: string | null;
  xboxGamertag: string | null;
  psnOnlineId: string | null;
  steamProfile?: any | null;
  faceitProfile?: any | null;
  psnProfile?: any | null;
}

export async function saveOnboardingStep3Platforms(
  userId: Id<"users">,
  platforms: OnboardingStep3Platforms
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await convex.mutation(api.users.saveOnboardingStep3, {
      userId,
      ...platforms,
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

// ============================================
// PROFILE ACCESS
// ============================================

export async function getUserProfile(
  userId: Id<"users">
): Promise<
  | { ok: true; data: UserProfile }
  | { ok: false; message: string }
> {
  try {
    const user = await convex.query(api.users.getById, { userId });

    if (!user) {
      return { ok: false, message: "User profile not found." };
    }

    return { ok: true, data: user };
  } catch (e) {
    console.log("[userService] getUserProfile error", e);
    return {
      ok: false,
      message: "Could not load user profile. Please try again.",
    };
  }
}

export async function getPublicUserProfile(
  userId: Id<"users">,
  viewerUserId?: Id<"users">
): Promise<
  | { ok: true; data: UserProfile }
  | { ok: false; message: string }
> {
  try {
    const user = await convex.query(api.users.getPublicById, {
      userId,
      viewerUserId,
    });

    if (!user) {
      return { ok: false, message: "User profile not found." };
    }

    return { ok: true, data: user };
  } catch (e) {
    console.log("[userService] getPublicUserProfile error", e);
    return {
      ok: false,
      message: "Could not load user profile. Please try again.",
    };
  }
}

export async function getUserProfileByAuthId(
  authId: string
): Promise<
  | { ok: true; data: UserProfile }
  | { ok: false; message: string }
> {
  try {
    const user = await convex.query(api.users.getByAuthId, { authId });

    if (!user) {
      return { ok: false, message: "User profile not found." };
    }

    return { ok: true, data: user };
  } catch (e) {
    console.log("[userService] getUserProfileByAuthId error", e);
    return {
      ok: false,
      message: "Could not load user profile. Please try again.",
    };
  }
}

// ============================================
// PROFILE UPDATES
// ============================================

export async function updateUserProfile(
  userId: Id<"users">,
  updates: {
    fullName?: string;
    username?: string;
    bio?: string;
    photoURL?: string;
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await convex.mutation(api.users.updateProfile, {
      userId,
      ...updates,
    });
    return { ok: true };
  } catch (e) {
    console.log("[userService] updateUserProfile error", e);
    return {
      ok: false,
      message: "Could not update profile. Please try again.",
    };
  }
}

export async function completeOnboarding(
  userId: Id<"users">
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await convex.mutation(api.users.completeOnboarding, { userId });
    return { ok: true };
  } catch (e) {
    console.log("[userService] completeOnboarding error", e);
    return {
      ok: false,
      message: "Could not complete onboarding. Please try again.",
    };
  }
}

// ============================================
// EXTERNAL PROFILES REFRESH
// ============================================

export async function refreshUserStats(
  userId: Id<"users">
): Promise<
  | { ok: true; data: Partial<UserProfile> }
  | { ok: false; message: string }
> {
  try {
    const user = await convex.query(api.users.getById, { userId });

    if (!user) {
      return { ok: false, message: "User not found." };
    }

    const updates: Record<string, any> = {};
    const refreshedData: Partial<UserProfile> = {};

    // 1. Refresh Steam if linked
    if ((user as any).steamProfileUrl) {
      try {
        const steamRes = await convex.action(api.externalApis.fetchSteamProfile, {
          url: (user as any).steamProfileUrl,
        });
        if (steamRes) {
          updates.steamStats = steamRes;
          refreshedData.steamStats = steamRes as any;
        }
      } catch (e) {
        console.log("[refreshUserStats] Steam refresh failed", e);
      }
    }

    // 2. Refresh FACEIT if linked
    if ((user as any).faceitProfileUrl) {
      try {
        const faceitRes = await convex.action(api.externalApis.fetchFaceitProfile, {
          value: (user as any).faceitProfileUrl,
          game: "cs2",
        });
        if (faceitRes) {
          updates.faceitStats = faceitRes;
          refreshedData.faceitStats = faceitRes as any;
        }
      } catch (e) {
        console.log("[refreshUserStats] FACEIT refresh failed", e);
      }
    }

    // 3. Refresh PSN if linked
    if (user.psnOnlineId) {
      try {
        const wantsTekken = !!(user as any).playsTekken;
        const wantsFc = !!(user as any).playsFc;

        if (wantsTekken || wantsFc) {
          const psnRes = await convex.action(api.externalApis.verifyPsnProfile, {
            psnOnlineId: user.psnOnlineId,
            wantsTekken,
            wantsFc,
          });
          if (psnRes) {
            updates.psnStats = psnRes;
            refreshedData.psnStats = psnRes as any;
          }
        }
      } catch (e) {
        console.log("[refreshUserStats] PSN refresh failed", e);
      }
    }

    // Save updates if any
    if (Object.keys(updates).length > 0) {
      await convex.mutation(api.users.updatePlatformLinks, {
        userId,
        ...updates,
      });
    }

    return { ok: true, data: refreshedData };
  } catch (e) {
    console.log("[refreshUserStats] error", e);
    return { ok: false, message: "Failed to refresh stats." };
  }
}

// ============================================
// FRIENDS
// ============================================

export async function getUserFriends(
  userId: Id<"users">
): Promise<
  | {
      ok: true;
      data: Array<{
        _id: Id<"users">;
        uid: string; // Alias for backwards compatibility
        username: string;
        fullName?: string;
        photoURL?: string;
        isOnline?: boolean;
        playsCs2?: boolean;
        playsCs16?: boolean;
        playsValorant?: boolean;
        playsFc?: boolean;
        playsTekken?: boolean;
        playsFutsal?: boolean;
        playsIndoorCricket?: boolean;
        playsPadel?: boolean;
        playsPickleball?: boolean;
      }>;
    }
  | { ok: false; message: string }
> {
  try {
    const friends = await convex.query(api.social.listFriends, { userId });
    // Transform to include uid as an alias for friendId (backwards compatibility)
    const data = (friends || []).map((f: any) => ({
      _id: f.friendId,
      uid: f.friendId as string, // Alias for uid
      username: f.username,
      fullName: f.fullName,
      photoURL: f.photoURL,
      isOnline: f.isOnline,
      playsCs2: f.playsCs2,
      playsCs16: f.playsCs16,
      playsValorant: f.playsValorant,
      playsFc: f.playsFc,
      playsTekken: f.playsTekken,
      playsFutsal: f.playsFutsal,
      playsIndoorCricket: f.playsIndoorCricket,
      playsPadel: f.playsPadel,
      playsPickleball: f.playsPickleball,
    }));
    return { ok: true, data };
  } catch (e) {
    console.log("[userService] getUserFriends error", e);
    return { ok: false, message: "Failed to load friends." };
  }
}
