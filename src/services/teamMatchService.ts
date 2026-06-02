// src/services/teamMatchService.ts
// Re-export wrapper - all implementations now in convex/teamMatchService.ts

export type {
    TeamMatchChallengeStatus,
    TeamChallengeVenueChoice,
    TeamMatchChallenge,
} from "./convex/teamMatchService";

export {
    TEAM_CHALLENGE_PAYMENTS_ENABLED,
    TEAM_CHALLENGE_PAYMENTS_DISABLED_COPY,
    sendTeamMatchChallenge,
    acceptTeamMatchChallenge,
    payTeamChallengeWithWallet,
    rejectTeamMatchChallenge,
    suggestTeamMatchChallengeAlternativeZone,
    respondToTeamMatchChallenge,
    proposeTeamChallengeVenue,
    getTeamMatchChallengeById,
    subscribeTeamMatchChallenge,
    getCaptainedTeams,
    getChallengesForCaptain,
    repairTeamMatchChallenge,
    repairTeamChallengesForCaptain,
} from "./convex/teamMatchService";
