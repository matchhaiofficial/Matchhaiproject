// src/services/teamService.ts
// Re-exports from Convex team service for backwards compatibility
// Original Firebase implementation replaced during Convex migration

export {
  // Types
  type TeamMember,
  type Team,
  type GetPublicTeamsOptions,

  // CRUD
  createTeam,
  getTeamById,
  getUserTeams,
  getUserTeamsForGame,
  getPublicTeams,
  deleteTeam,

  // Membership
  joinTeam,
  leaveTeam,
  requestToJoinTeam,

  // Updates
  updateTeamName,
  uploadTeamLogo,
  updateTeamStats,
} from "./convex/teamService";
