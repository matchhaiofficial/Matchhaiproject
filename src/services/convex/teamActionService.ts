import { convex } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { ensureVerifiedEmailAccess, currentUser } from "./authService";
import { GAME_FORMATS } from "../../constants/gameRules";
import { getTeamMainRosterSize, getTeamMaxSubstitutes, getTeamTotalRosterCapacity } from "../../constants/teamRosterRules";
import Logger from "../../utils/logger";

export type TeamActionResponse =
  | { ok: true; message?: string; [key: string]: any }
  | { ok: false; message: string; [key: string]: any };

export interface CreateTeamData {
  name: string;
  game: string;
  description?: string;
  visibility?: "public" | "private";
  maxMembers?: number;
  substituteSlots?: number;
}

async function resolveUserId(authIdOrConvexId: string): Promise<Id<"users"> | null> {
  try {
    const directUser = await convex.query(api.users.getById, {
      userId: authIdOrConvexId as Id<"users">,
    });
    if (directUser) return directUser._id;
  } catch {
    // Fall through to auth-id lookup.
  }

  try {
    const user = await convex.query(api.users.getByAuthId, { authId: authIdOrConvexId });
    if (user) return user._id;
  } catch {
    // Ignore and return null below.
  }

  return null;
}

async function getCurrentUserConvexId(): Promise<{
  uid: string;
  convexId: Id<"users">;
  username: string;
} | null> {
  const user = await currentUser();
  if (!user) return null;

  const convexUser = await convex.query(api.users.getByAuthId, { authId: user.id });
  if (!convexUser) return null;

  return { uid: user.id, convexId: convexUser._id, username: convexUser.username };
}

async function checkUserTeamLimit(uid: string, game: string): Promise<void> {
  const result = await convex.query(api.teams.checkUserTeamLimit, { uid, game });
  if (result.inTeam) {
    throw new Error(
      `You are already in a ${game} team (${result.teamName}). You must leave it to create or join a new one.`,
    );
  }
}

export async function createTeamAction(data: CreateTeamData): Promise<TeamActionResponse> {
  try {
    const verificationGate = await ensureVerifiedEmailAccess();
    if (!verificationGate.ok) {
      return { ok: false, message: verificationGate.message, code: verificationGate.code };
    }

    const me = await getCurrentUserConvexId();
    if (!me) throw new Error("Not authenticated");

    const { name, game, description, maxMembers: inputMaxMembers, substituteSlots = 0 } = data;
    const formats = GAME_FORMATS[game];
    if (!formats || formats.length === 0) throw new Error("Unsupported game type");

    const mainRosterSize = getTeamMainRosterSize(game);
    const maxSubstitutes = getTeamMaxSubstitutes(game);
    const safeSubstituteSlots = Math.max(0, Math.min(maxSubstitutes, Math.floor(substituteSlots)));
    const cap = inputMaxMembers || getTeamTotalRosterCapacity(game, safeSubstituteSlots);

    if (cap < mainRosterSize || cap > mainRosterSize + maxSubstitutes) {
      throw new Error(
        `Invalid roster size. ${game} teams require ${mainRosterSize} main players and can add up to ${maxSubstitutes} substitute${maxSubstitutes === 1 ? "" : "s"}.`,
      );
    }

    await checkUserTeamLimit(me.convexId, game);

    const nameAvailable = await convex.query(api.teams.isNameAvailable, { name });
    if (!nameAvailable) {
      return { ok: false, message: "A team with this name already exists." };
    }

    const teamId = await convex.mutation(api.teams.create, {
      name,
      game,
      captainUid: me.convexId,
      captainUsername: me.username,
      maxMembers: cap,
      mainRosterSize,
      maxSubstitutes: safeSubstituteSlots,
      description,
    });

    return { ok: true, teamId };
  } catch (error: any) {
    if (error.message?.includes("already in a")) {
      return { ok: false, message: error.message };
    }
    Logger.error("teamActionService", "createTeamAction error", error);
    return { ok: false, message: error.message || "Failed to create team." };
  }
}

export async function requestToJoinTeamAction(data: { teamId: string }): Promise<TeamActionResponse> {
  try {
    const verificationGate = await ensureVerifiedEmailAccess();
    if (!verificationGate.ok) {
      return { ok: false, message: verificationGate.message, code: verificationGate.code };
    }

    const me = await getCurrentUserConvexId();
    if (!me) throw new Error("Not authenticated");

    const team = await convex.query(api.teams.getByIdString, { teamId: data.teamId });
    if (!team) throw new Error("Team not found");

    await checkUserTeamLimit(me.convexId, (team as any).game);

    await convex.mutation(api.teams.requestToJoinTeam, {
      teamId: data.teamId as Id<"teams">,
      fromUid: me.convexId,
      fromUsername: me.username,
    });

    return { ok: true, message: "Request sent to captain." };
  } catch (error: any) {
    if (error.message?.includes("already in a")) {
      return { ok: false, message: error.message };
    }
    Logger.error("teamActionService", "requestToJoinTeamAction error", error);
    return { ok: false, message: error.message || "Failed to send request." };
  }
}

export async function respondToJoinRequestAction(data: {
  notificationId: string;
  decision: "accept" | "reject";
}): Promise<TeamActionResponse> {
  try {
    const me = await getCurrentUserConvexId();
    if (!me) throw new Error("Not authenticated");

    await convex.mutation(api.teams.respondToJoinRequest, {
      notificationId: data.notificationId as Id<"notifications">,
      captainUid: me.convexId,
      accept: data.decision === "accept",
    });

    return { ok: true };
  } catch (error: any) {
    if (error.message?.includes("already in a")) {
      return { ok: false, message: error.message };
    }
    Logger.error("teamActionService", "respondToJoinRequestAction error", error);
    return { ok: false, message: error.message || "Failed to respond." };
  }
}

export async function transferCaptainAction(data: {
  teamId: string;
  newCaptainUid: string;
}): Promise<TeamActionResponse> {
  try {
    const me = await getCurrentUserConvexId();
    if (!me) throw new Error("Not authenticated");

    const newCaptainConvexId = await resolveUserId(data.newCaptainUid);
    if (!newCaptainConvexId) throw new Error("Target user not found");

    const newCaptainUser = await convex.query(api.users.getById, { userId: newCaptainConvexId });
    const newCaptainUsername = newCaptainUser?.username || "Captain";

    await convex.mutation(api.teams.transferCaptain, {
      teamId: data.teamId as Id<"teams">,
      newCaptainUid: newCaptainConvexId,
      newCaptainUsername,
    });

    return { ok: true };
  } catch (error: any) {
    Logger.error("teamActionService", "transferCaptainAction error", error);
    return { ok: false, message: error.message || "Failed to transfer." };
  }
}

export async function removeMemberAction(data: {
  teamId: string;
  memberUid: string;
}): Promise<TeamActionResponse> {
  try {
    const me = await getCurrentUserConvexId();
    if (!me) throw new Error("Not authenticated");

    if (String(me.convexId) === String(data.memberUid)) {
      throw new Error("Cannot remove yourself");
    }

    const memberConvexId = await resolveUserId(data.memberUid);
    if (!memberConvexId) throw new Error("Member not found");

    await convex.mutation(api.teams.removeMember, {
      teamId: data.teamId as Id<"teams">,
      userId: memberConvexId,
    });

    return { ok: true };
  } catch (error: any) {
    Logger.error("teamActionService", "removeMemberAction error", error);
    return { ok: false, message: error.message || "Failed to remove member." };
  }
}

export async function inviteToTeamAction(data: {
  teamId: string;
  toUid: string;
}): Promise<TeamActionResponse> {
  try {
    const me = await getCurrentUserConvexId();
    if (!me) throw new Error("Not authenticated");

    const toConvexId = await resolveUserId(data.toUid);
    if (!toConvexId) throw new Error("User not found");

    const result = await convex.mutation(api.teams.inviteToTeam, {
      teamId: data.teamId as Id<"teams">,
      fromUid: me.convexId,
      toUid: toConvexId,
    });

    if (result?.alreadyPending) {
      return {
        ok: true,
        alreadyPending: true,
        notificationId: result.notificationId,
        message: "An invite is already pending for this friend.",
      };
    }

    return {
      ok: true,
      alreadyPending: false,
      notificationId: result?.notificationId,
      message: "Invitation sent to friend.",
    };
  } catch (error: any) {
    Logger.error("teamActionService", "inviteToTeamAction error", error);
    if (error?.message?.includes("Invitation already pending")) {
      return { ok: true, alreadyPending: true, message: "An invite is already pending for this friend." };
    }
    if (error?.message?.includes("User is already a member")) {
      return { ok: false, message: "This player is already on your team." };
    }
    return { ok: false, message: error.message || "Failed to invite." };
  }
}

export async function respondToTeamInviteAction(data: {
  notificationId: string;
  decision: "accept" | "decline";
}): Promise<TeamActionResponse> {
  try {
    const me = await getCurrentUserConvexId();
    if (!me) throw new Error("Not authenticated");

    const result = await convex.mutation(api.teams.respondToTeamInvite, {
      notificationId: data.notificationId as Id<"notifications">,
      userId: me.convexId,
      accept: data.decision === "accept",
    });

    return result as TeamActionResponse;
  } catch (error: any) {
    if (error.message?.includes("already in a")) {
      return { ok: false, message: error.message };
    }
    Logger.error("teamActionService", "respondToTeamInviteAction error", error);
    return { ok: false, message: error.message || "Failed to respond to invite." };
  }
}

export async function leaveTeamAction(data: { teamId: string }): Promise<TeamActionResponse> {
  try {
    const me = await getCurrentUserConvexId();
    if (!me) throw new Error("Not authenticated");

    await convex.mutation(api.teams.leaveTeam, {
      teamId: data.teamId as Id<"teams">,
      userId: me.convexId,
    });

    return { ok: true, message: "Left team successfully." };
  } catch (error: any) {
    Logger.error("teamActionService", "leaveTeamAction error", error);
    return { ok: false, message: error.message || "Failed to leave team." };
  }
}
