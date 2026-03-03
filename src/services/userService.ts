// src/services/userService.ts
// Re-exports from Convex user service for backwards compatibility
// Original Firebase implementation backed up to userService.firebase.ts.bak

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

// Utility functions for sport profiles

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
