// src/services/userService.ts
// Re-exports from Convex user service for backwards compatibility
// Convex-based user service (re-export wrapper)

export {
  // Types
  type UserProfile,
  type OnboardingStep2Prefs,
  type OnboardingSummary,
  type OnboardingStep3Platforms,

  // Availability checks
  isUsernameAvailable,
  isPhoneAvailable,
  isEmailAvailable,
  isSteamIdAvailable,
  isPsnIdAvailable,
  isFaceitIdAvailable,
  isEaIdAvailable,
  isXboxIdAvailable,

  // Phone utilities
  normalizePhoneForSave,

  // Onboarding
  saveOnboardingStep2,
  fetchOnboardingSummary,
  saveOnboardingStep3Platforms,

  // Profile access
  getUserProfile,
  getPublicUserProfile,
  getUserProfileByAuthId,

  // Profile updates
  updateUserProfile,
  completeOnboarding,

  // Stats refresh
  refreshUserStats,

  // Friends
  getUserFriends,
} from "./convex/userService";

import type { UserProfile } from "./convex/userService";
import { isPhysicalGameDisabled } from "../../constants/gameAvailability";

// Utility functions for sport profiles

const canonicalizeProfileGameKey = (gameKey: string) => gameKey === "fc25" ? "fc26" : gameKey;

export const isProfileGameEnabled = (profile: UserProfile | null | undefined, gameKey: string): boolean => {
  if (!profile) return false;
  if (isPhysicalGameDisabled(gameKey)) return false;

  switch (canonicalizeProfileGameKey(gameKey)) {
    case 'cs2':
      return !!profile.playsCs2;
    case 'cs16':
      return !!(profile as any).playsCs16;
    case 'valorant':
      return !!(profile as any).playsValorant;
    case 'fc25':
    case 'fc26':
      return !!profile.playsFc;
    case 'tekken8':
      return !!profile.playsTekken;
    case 'futsal':
      return !!profile.playsFutsal;
    case 'indoor_cricket':
      return !!profile.playsIndoorCricket;
    case 'padel':
      return !!profile.playsPadel;
    case 'pickleball':
      return !!profile.playsPickleball;
    default:
      return false;
  }
};

export const getUserSportProfile = (profile: UserProfile, gameKey: string) => {
  switch (canonicalizeProfileGameKey(gameKey)) {
    case 'cs2':
      return {
        role: profile.cs2Role,
        skillLevel: profile.faceitSkillLevel,
      };
    case 'cs16':
      return {
        role: (profile as any).cs16Role,
        skillScore: (profile as any).skillScores?.cs16,
      };
    case 'valorant':
      return {
        role: (profile as any).valorantRole,
        skillScore: (profile as any).skillScores?.valorant,
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
  const canonicalGameKey = canonicalizeProfileGameKey(gameKey);
  const sportProfile: any = getUserSportProfile(profile, canonicalGameKey);
  if (!sportProfile) return null;

  switch (canonicalGameKey) {
    case 'cs2': {
      const role = typeof sportProfile.role === 'string' ? sportProfile.role.trim() : '';
      if (role) return role;
      const level = sportProfile.skillLevel;
      if (typeof level === 'number' && level > 0) return `FACEIT Lv ${level}`;
      return null;
    }
    case 'cs16': {
      const role = typeof sportProfile.role === 'string' ? sportProfile.role.trim() : '';
      if (role) return role;
      const tier = sportProfile.skillScore?.tier;
      return typeof tier === 'string' && tier.trim() ? tier : null;
    }
    case 'valorant': {
      const role = typeof sportProfile.role === 'string' ? sportProfile.role.trim() : '';
      if (role) return role;
      const tier = sportProfile.skillScore?.tier;
      return typeof tier === 'string' && tier.trim() ? tier : null;
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
