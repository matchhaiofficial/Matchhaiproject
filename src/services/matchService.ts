// src/services/matchService.ts
// Re-exports from Convex match service for backwards compatibility
// Original Firebase implementation replaced during Convex migration

export {
  // Types
  type Slot,
  type Matchroom,

  // CRUD
  createMatchroom,
  getMatchrooms,
  getMatchroom,
  getMatchroomById,
  getUserMatchrooms,

  // Join / Leave
  joinMatchroom,
  leaveMatchroom,
  deleteMatchroom,

  // Match lifecycle
  startMatch,
  submitCaptainReport,
  submitParticipantVote,
  adminCancelMatchroom,

  // Time conflict / active room checks
  findUserTimeConflict,
  isUserInActiveMatchroom,

  // Join requests
  requestJoinMatchroom,
  cancelMatchJoinRequest,
  respondToMatchJoinRequest,
} from "./convex/matchService";
