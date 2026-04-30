// src/services/convex/teamService.ts
// Convex-based team service that maintains the same interface as the Firebase version

import { convex } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { currentUser, ensureVerifiedEmailAccess } from "./authService";

export interface TeamMember {
  uid: string;
  username: string;
  role: "captain" | "member";
  joinedAt: any;
}

export interface Team {
  id?: string;
  _id?: string;
  name: string;
  nameLower?: string;
  description?: string;
  game: string;
  tag?: string;
  logoUrl?: string;
  captainUid: string;
  captainUsername?: string;
  members?: TeamMember[];
  memberUids: string[];
  memberCount: number;
  maxMembers: number;
  mainRosterSize?: number;
  maxSubstitutes?: number;
  visibility?: "public" | "private";
  createdAt: any;
  updatedAt?: any;
  stats: {
    matchesPlayed: number;
    wins: number;
    losses: number;
  };
}

type SuccessResult<T> = { ok: true; data?: T; id?: string; message?: string };
type ErrorResult = { ok: false; message: string };
type Result<T = void> = SuccessResult<T> | ErrorResult;

/**
 * Create a new team
 */
export async function createTeam(
  data: Omit<Team, "id" | "createdAt" | "stats" | "memberUids">
): Promise<Result<{ id: string }>> {
  try {
    const verificationGate = await ensureVerifiedEmailAccess();
    if (!verificationGate.ok) {
      return { ok: false, message: verificationGate.message };
    }

    // Get the captain user to verify they exist
    const captain = await convex.query(api.users.getByAuthId, {
      authId: data.captainUid,
    });

    if (!captain) {
      return { ok: false, message: "Captain user not found" };
    }

    const teamId = await convex.mutation(api.teams.create, {
      name: data.name,
      tag: data.tag,
      game: data.game,
      captainUid: captain._id,
      captainUsername: data.captainUsername || captain.username,
      maxMembers: data.maxMembers || 10,
      mainRosterSize: data.mainRosterSize,
      maxSubstitutes: data.maxSubstitutes,
      description: data.description,
    });

    return { ok: true, id: teamId };
  } catch (error: any) {
    console.error("[teamService] createTeam error:", error);
    return { ok: false, message: error?.message || "Failed to create team" };
  }
}

/**
 * Get team by ID
 */
export async function getTeamById(
  id: string
): Promise<Result<Team>> {
  try {
    const team = await convex.query(api.teams.getByIdString, { teamId: id });
    if (!team) {
      return { ok: false, message: "Team not found" };
    }
    return { ok: true, data: team as Team };
  } catch (error: any) {
    console.error("[teamService] getTeamById error:", error);
    return { ok: false, message: "Failed to fetch team" };
  }
}

/**
 * Get all teams for a user
 */
export async function getUserTeams(uid: string): Promise<Result<Team[]>> {
  try {
    const teams = await convex.query(api.teams.getUserTeams, { uid });
    return {
      ok: true,
      data: teams.map((t) => ({ ...t, id: t._id })) as Team[],
    };
  } catch (error: any) {
    console.error("[teamService] getUserTeams error:", error);
    return { ok: false, message: "Failed to fetch teams" };
  }
}

/**
 * Get user's teams for a specific game
 */
export async function getUserTeamsForGame(
  uid: string,
  gameKey: string
): Promise<Result<Team[]>> {
  try {
    const teams = await convex.query(api.teams.getUserTeamsForGame, {
      uid,
      game: gameKey,
    });
    return {
      ok: true,
      data: teams.map((t) => ({ ...t, id: t._id })) as Team[],
    };
  } catch (error: any) {
    console.error("[teamService] getUserTeamsForGame error:", error);
    return { ok: false, message: "Failed to fetch teams" };
  }
}

/**
 * Join a team
 */
export async function joinTeam(
  teamId: string,
  user: { uid: string; username: string }
): Promise<Result> {
  try {
    const verificationGate = await ensureVerifiedEmailAccess();
    if (!verificationGate.ok) {
      return { ok: false, message: verificationGate.message };
    }

    // Get the user's Convex ID
    const convexUser = await convex.query(api.users.getByAuthId, {
      authId: user.uid,
    });

    if (!convexUser) {
      return { ok: false, message: "User not found" };
    }

    await convex.mutation(api.teams.addMember, {
      teamId: teamId as Id<"teams">,
      userId: convexUser._id,
      username: user.username,
    });

    return { ok: true, message: "Joined team" };
  } catch (error: any) {
    console.error("[teamService] joinTeam error:", error);
    return { ok: false, message: error?.message || "Failed to join team" };
  }
}

/**
 * Leave a team
 */
export async function leaveTeam(teamId: string, uid: string): Promise<Result> {
  try {
    // Get the user's Convex ID
    const convexUser = await convex.query(api.users.getByAuthId, {
      authId: uid,
    });

    if (!convexUser) {
      return { ok: false, message: "User not found" };
    }

    await convex.mutation(api.teams.removeMember, {
      teamId: teamId as Id<"teams">,
      userId: convexUser._id,
    });

    return { ok: true, message: "Left team" };
  } catch (error: any) {
    console.error("[teamService] leaveTeam error:", error);
    return { ok: false, message: error?.message || "Failed to leave team" };
  }
}

export interface GetPublicTeamsOptions {
  game?: string;
  searchQuery?: string;
  lastDoc?: any;
  limitCount?: number;
}

/**
 * Get public teams with filtering/pagination
 */
export async function getPublicTeams(
  options: GetPublicTeamsOptions = {}
): Promise<Result<Team[]>> {
  try {
    const { game, searchQuery, limitCount = 20 } = options;

    let teams;

    if (searchQuery) {
      teams = await convex.query(api.teams.searchByName, {
        query: searchQuery,
        limit: limitCount,
      });
    } else if (game && game !== "all") {
      teams = await convex.query(api.teams.listByGame, {
        game,
        limit: limitCount,
      });
    } else {
      teams = await convex.query(api.teams.searchByName, {
        query: "",
        limit: limitCount,
      });
    }

    return {
      ok: true,
      data: teams.map((t) => ({ ...t, id: t._id })) as Team[],
    };
  } catch (error: any) {
    console.error("[teamService] getPublicTeams error:", error);
    return { ok: false, message: "Failed to find teams" };
  }
}

/**
 * Request to join a team (creates notification)
 */
export async function requestToJoinTeam(teamId: string): Promise<Result> {
  try {
    const verificationGate = await ensureVerifiedEmailAccess();
    if (!verificationGate.ok) {
      return { ok: false, message: verificationGate.message };
    }

    const authUser = await currentUser();
    if (!authUser) {
      return { ok: false, message: "Not authenticated" };
    }

    const me = await convex.query(api.users.getByAuthId, { authId: authUser.id });
    if (!me) {
      return { ok: false, message: "User not found" };
    }

    const team = await convex.query(api.teams.getByIdString, { teamId }) as Team | null;
    if (!team) {
      return { ok: false, message: "Team not found" };
    }

    await convex.mutation(api.teams.requestToJoinTeam, {
      teamId: teamId as Id<"teams">,
      fromUid: me._id,
      fromUsername: me.username || authUser.name || "Player",
    });

    return { ok: true, message: "Join request sent" };
  } catch (error: any) {
    console.error("[teamService] requestToJoinTeam error:", error);
    return { ok: false, message: "Failed to send join request" };
  }
}

/**
 * Delete a team
 */
export async function deleteTeam(teamId: string): Promise<Result> {
  try {
    await convex.mutation(api.teams.remove, {
      teamId: teamId as Id<"teams">,
    });
    return { ok: true, message: "Team deleted" };
  } catch (error: any) {
    console.error("[teamService] deleteTeam error:", error);
    return { ok: false, message: error?.message || "Failed to delete team" };
  }
}

/**
 * Update team name
 */
export async function updateTeamName(
  teamId: string,
  newName: string
): Promise<Result> {
  try {
    await convex.mutation(api.teams.update, {
      teamId: teamId as Id<"teams">,
      name: newName.trim(),
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[teamService] updateTeamName error:", error);
    return { ok: false, message: error?.message || "Failed to update team name" };
  }
}

/**
 * Upload team logo
 * Note: The actual file upload should be handled client-side with Convex storage
 * This function updates the logo URL after upload
 */
export async function uploadTeamLogo(
  teamId: string,
  logoUrl: string
): Promise<Result<{ url: string }>> {
  try {
    await convex.mutation(api.teams.update, {
      teamId: teamId as Id<"teams">,
      logoUrl,
    });
    return { ok: true, data: { url: logoUrl } };
  } catch (error: any) {
    console.error("[teamService] uploadTeamLogo error:", error);
    return { ok: false, message: "Failed to upload logo" };
  }
}

/**
 * Update team stats (for after matches)
 */
export async function updateTeamStats(
  teamId: string,
  stats: { wins?: number; losses?: number; matchesPlayed?: number }
): Promise<Result> {
  try {
    await convex.mutation(api.teams.updateStats, {
      teamId: teamId as Id<"teams">,
      ...stats,
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[teamService] updateTeamStats error:", error);
    return { ok: false, message: "Failed to update team stats" };
  }
}
