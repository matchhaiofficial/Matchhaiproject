// src/services/convex/index.ts
// Barrel file for Convex-based services

// Auth service
export {
  signUpWithEmail,
  signInWithEmail,
  sendPasswordReset,
  signOutUser,
  getSession,
  currentUser,
  onAuthStateChanged,
  normalizePhoneForSave,
  type AuthResult,
  type SimpleResult,
} from "./authService";

// User service
export {
  isUsernameAvailable,
  isPhoneAvailable,
  isEmailAvailable,
  isSteamIdAvailable,
  isPsnIdAvailable,
  isFaceitIdAvailable,
  saveOnboardingStep2,
  fetchOnboardingSummary,
  saveOnboardingStep3Platforms,
  getUserProfile,
  getUserProfileByAuthId,
  updateUserProfile,
  completeOnboarding,
  refreshUserStats,
  getUserFriends,
  type OnboardingStep2Prefs,
  type OnboardingSummary,
  type OnboardingStep3Platforms,
} from "./userService";

// External API service (Steam, FACEIT, PSN)
export {
  fetchSteamProfileFromUrl,
  fetchFaceitProfileFromUrl,
  verifyPsnProfile,
  type SteamProfileSummary,
  type FaceitProfileSummary,
  type PsnGameStats,
  type PsnVerificationResult,
} from "./externalApiService";
