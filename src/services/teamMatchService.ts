// src/services/teamMatchService.ts
// Re-export wrapper - all implementations now in convex/teamMatchService.ts

export type {
    TeamMatchChallengeStatus,
    TeamChallengeVenueChoice,
    TeamMatchChallenge,
} from "./convex/teamMatchService";

export {
    sendTeamMatchChallenge,
    acceptTeamMatchChallenge,
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
