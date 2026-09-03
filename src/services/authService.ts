// src/services/authService.ts
// Re-exports from Convex auth service for backwards compatibility
// Original Firebase implementation replaced with Convex-based auth

export {
  // Types
  type AuthResult,
  type SimpleResult,

  // Auth operations
  signUpWithEmail,
  signInWithEmail,
  sendPasswordReset,
  signOutUser,

  // Session / user
  getSession,
  currentUser,
  onAuthStateChanged,

  // Phone utilities
  normalizePhoneForSave,
} from "./convex/authService";
