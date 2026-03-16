// src/services/functions.ts
// Migrated from Firebase to Convex
// All operations now delegate to Convex backend mutations/queries

import { convex } from "../lib/convex";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { currentUser } from "./convex/authService";
import { GAME_FORMATS } from '../constants/gameRules';
import Logger from '../utils/logger';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface SendFriendRequestData {
    toUid: string;
}

export type ServerResponse =
    | { ok: true; message?: string;[key: string]: any }
    | { ok: false; message: string;[key: string]: any };

// Helper: resolve authId to Convex user ID
async function resolveUserId(authIdOrConvexId: string): Promise<Id<"users"> | null> {
    try {
        // First try as a direct Convex ID
        const directUser = await convex.query(api.users.getById, { userId: authIdOrConvexId as Id<"users"> });
        if (directUser) return directUser._id;
    } catch {
        // Not a valid Convex ID, try as authId
    }
    try {
        const user = await convex.query(api.users.getByAuthId, { authId: authIdOrConvexId });
        if (user) return user._id;
    } catch {
        // Not found
    }
    return null;
}

async function getCurrentUserConvexId(): Promise<{ uid: string; convexId: Id<"users">; username: string } | null> {
    const user = await currentUser();
    if (!user) return null;
    const convexUser = await convex.query(api.users.getByAuthId, { authId: user.id });
    if (!convexUser) return null;
    return { uid: user.id, convexId: convexUser._id, username: convexUser.username };
}

// ----------------------------------------------------------------------------
// Social Functions
// ----------------------------------------------------------------------------

export const sendFriendRequest = async (data: SendFriendRequestData): Promise<ServerResponse> => {
    try {
        const me = await getCurrentUserConvexId();
        if (!me) throw new Error("Not authenticated");

        const toConvexId = await resolveUserId(data.toUid);
        if (!toConvexId) throw new Error("User not found");

        if (me.convexId === toConvexId) throw new Error("Cannot add self");

        await convex.mutation(api.social.sendFriendRequest, {
            fromUid: me.convexId,
            fromUsername: me.username,
            toUid: toConvexId,
        });

        return { ok: true, message: "Request sent." };
    } catch (error: any) {
        Logger.error('functions', 'sendFriendRequest error', error);
        return { ok: false, message: error.message || 'Failed to send request.' };
    }
};

export interface RespondFriendRequestData {
    notificationId: string;
    decision: 'accept' | 'decline';
}

export const respondFriendRequest = async (data: RespondFriendRequestData): Promise<ServerResponse> => {
    try {
        const me = await getCurrentUserConvexId();
        if (!me) throw new Error("Not authenticated");

        await convex.mutation(api.social.respondFriendRequest, {
            notificationId: data.notificationId as Id<"notifications">,
            accept: data.decision === 'accept',
        });

        return { ok: true };
    } catch (error: any) {
        Logger.error('functions', 'respondFriendRequest error', error);
        return { ok: false, message: error.message || 'Failed to respond.' };
    }
};

export interface RemoveFriendData {
    friendUid: string;
}

export const removeFriend = async (data: RemoveFriendData): Promise<ServerResponse> => {
    try {
        const me = await getCurrentUserConvexId();
        if (!me) throw new Error("Not authenticated");

        const friendConvexId = await resolveUserId(data.friendUid);
        if (!friendConvexId) throw new Error("Friend not found");

        await convex.mutation(api.social.removeFriend, {
            userId: me.convexId,
            friendId: friendConvexId,
        });

        return { ok: true };
    } catch (error: any) {
        Logger.error('functions', 'removeFriend error', error);
        return { ok: false, message: error.message || 'Failed to remove friend.' };
    }
};

// ----------------------------------------------------------------------------
// Team Functions
// ----------------------------------------------------------------------------

const ROSTER_CAPS: Record<string, number> = {
    cs2: 5,
    fc25: 2,
    fc26: 2,
    tekken8: 2,
    padel: 2,
    pickleball: 2,
    futsal: 7,
    indoor_cricket: 8
};

const checkUserTeamLimit = async (uid: string, game: string): Promise<void> => {
    // uid could be a Convex ID string or authId
    const result = await convex.query(api.teams.checkUserTeamLimit, { uid, game });
    if (result.inTeam) {
        throw new Error(`You are already in a ${game} team (${result.teamName}). You must leave it to create or join a new one.`);
    }
};

export interface CreateTeamData {
    name: string;
    game: string;
    description?: string;
    visibility?: 'public' | 'private';
    maxMembers?: number;
}

export const createTeam = async (data: CreateTeamData): Promise<ServerResponse> => {
    try {
        const me = await getCurrentUserConvexId();
        if (!me) throw new Error("Not authenticated");

        const { name, game, description, maxMembers: inputMaxMembers } = data;

        // Determine and validate maxMembers
        const formats = GAME_FORMATS[game];
        if (!formats || formats.length === 0) throw new Error("Unsupported game type");

        let cap = inputMaxMembers;
        if (cap) {
            const validSizes = formats.map(f => f.size);
            if (!validSizes.includes(cap)) {
                throw new Error(`Invalid team size. Allowed sizes for ${game}: ${validSizes.join(', ')}`);
            }
        } else {
            cap = formats[0].size;
        }

        // Check one-team-per-game limit
        await checkUserTeamLimit(me.convexId, game);

        // Check name uniqueness
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
            description,
        });

        return { ok: true, teamId };
    } catch (error: any) {
        if (error.message?.includes('already in a')) {
            return { ok: false, message: error.message };
        }
        Logger.error('functions', 'createTeam error', error);
        return { ok: false, message: error.message || 'Failed to create team.' };
    }
};

export const requestToJoinTeam = async (data: { teamId: string }): Promise<ServerResponse> => {
    try {
        const me = await getCurrentUserConvexId();
        if (!me) throw new Error("Not authenticated");

        const { teamId } = data;

        // Check team exists and get game
        const team = await convex.query(api.teams.getByIdString, { teamId });
        if (!team) throw new Error("Team not found");

        // Check one-team-per-game limit
        await checkUserTeamLimit(me.convexId, (team as any).game);

        await convex.mutation(api.teams.requestToJoinTeam, {
            teamId: teamId as Id<"teams">,
            fromUid: me.convexId,
            fromUsername: me.username,
        });

        return { ok: true, message: "Request sent to captain." };
    } catch (error: any) {
        if (error.message?.includes('already in a')) {
            return { ok: false, message: error.message };
        }
        Logger.error('functions', 'requestToJoinTeam error', error);
        return { ok: false, message: error.message || 'Failed to send request.' };
    }
};

export const respondToJoinRequest = async (data: { notificationId: string; decision: 'accept' | 'reject' }): Promise<ServerResponse> => {
    try {
        const me = await getCurrentUserConvexId();
        if (!me) throw new Error("Not authenticated");

        await convex.mutation(api.teams.respondToJoinRequest, {
            notificationId: data.notificationId as Id<"notifications">,
            captainUid: me.convexId,
            accept: data.decision === 'accept',
        });

        return { ok: true };
    } catch (error: any) {
        if (error.message?.includes('already in a')) {
            return { ok: false, message: error.message };
        }
        Logger.error('functions', 'respondToJoinRequest error', error);
        return { ok: false, message: error.message || 'Failed to respond.' };
    }
};

export const transferCaptain = async (data: { teamId: string; newCaptainUid: string }): Promise<ServerResponse> => {
    try {
        const me = await getCurrentUserConvexId();
        if (!me) throw new Error("Not authenticated");

        const { teamId, newCaptainUid } = data;

        // Resolve new captain
        const newCaptainConvexId = await resolveUserId(newCaptainUid);
        if (!newCaptainConvexId) throw new Error("Target user not found");

        const newCaptainUser = await convex.query(api.users.getById, { userId: newCaptainConvexId });
        const newCaptainUsername = newCaptainUser?.username || "Captain";

        await convex.mutation(api.teams.transferCaptain, {
            teamId: teamId as Id<"teams">,
            newCaptainUid: newCaptainConvexId,
            newCaptainUsername,
        });

        return { ok: true };
    } catch (error: any) {
        Logger.error('functions', 'transferCaptain error', error);
        return { ok: false, message: error.message || 'Failed to transfer.' };
    }
};

export const removeMember = async (data: { teamId: string; memberUid: string }): Promise<ServerResponse> => {
    try {
        const me = await getCurrentUserConvexId();
        if (!me) throw new Error("Not authenticated");

        const { teamId, memberUid } = data;
        if (me.convexId === memberUid) throw new Error("Cannot remove yourself");

        const memberConvexId = await resolveUserId(memberUid);
        if (!memberConvexId) throw new Error("Member not found");

        await convex.mutation(api.teams.removeMember, {
            teamId: teamId as Id<"teams">,
            userId: memberConvexId,
        });

        return { ok: true };
    } catch (error: any) {
        Logger.error('functions', 'removeMember error', error);
        return { ok: false, message: error.message || 'Failed to remove member.' };
    }
};

export const inviteToTeam = async (data: { teamId: string; toUid: string }): Promise<ServerResponse> => {
    try {
        const me = await getCurrentUserConvexId();
        if (!me) throw new Error("Not authenticated");

        const { teamId, toUid } = data;

        const toConvexId = await resolveUserId(toUid);
        if (!toConvexId) throw new Error("User not found");

        await convex.mutation(api.teams.inviteToTeam, {
            teamId: teamId as Id<"teams">,
            fromUid: me.convexId,
            toUid: toConvexId,
        });

        return { ok: true, message: "Invitation sent to friend." };
    } catch (error: any) {
        Logger.error('functions', 'inviteToTeam error', error);
        return { ok: false, message: error.message || 'Failed to invite.' };
    }
};

export const respondToTeamInvite = async (data: { notificationId: string; decision: 'accept' | 'decline' }): Promise<ServerResponse> => {
    try {
        const me = await getCurrentUserConvexId();
        if (!me) throw new Error("Not authenticated");

        const result = await convex.mutation(api.teams.respondToTeamInvite, {
            notificationId: data.notificationId as Id<"notifications">,
            userId: me.convexId,
            accept: data.decision === 'accept',
        });

        return result as ServerResponse;
    } catch (error: any) {
        if (error.message?.includes('already in a')) {
            return { ok: false, message: error.message };
        }
        Logger.error('functions', 'respondToTeamInvite error', error);
        return { ok: false, message: error.message || 'Failed to respond to invite.' };
    }
};

export const deleteTeam = async (data: { teamId: string }): Promise<ServerResponse> => {
    try {
        const me = await getCurrentUserConvexId();
        if (!me) throw new Error("Not authenticated");

        const { teamId } = data;

        // Verify captaincy before deleting
        const team = await convex.query(api.teams.getByIdString, { teamId });
        if (!team) throw new Error("Team not found");
        if ((team as any).captainUid !== me.convexId) throw new Error("Only captain can delete team");

        await convex.mutation(api.teams.remove, {
            teamId: teamId as Id<"teams">,
        });

        return { ok: true, message: "Team deleted successfully." };
    } catch (error: any) {
        Logger.error('functions', 'deleteTeam error', error);
        return { ok: false, message: error.message || 'Failed to delete team.' };
    }
};

export const leaveTeam = async (data: { teamId: string }): Promise<ServerResponse> => {
    try {
        const me = await getCurrentUserConvexId();
        if (!me) throw new Error("Not authenticated");

        await convex.mutation(api.teams.leaveTeam, {
            teamId: data.teamId as Id<"teams">,
            userId: me.convexId,
        });

        return { ok: true, message: "Left team successfully." };
    } catch (error: any) {
        Logger.error('functions', 'leaveTeam error', error);
        return { ok: false, message: error.message || 'Failed to leave team.' };
    }
};

// ----------------------------------------------------------------------------
// Matchroom Join Request Response
// ----------------------------------------------------------------------------

export const respondToMatchroomJoinRequest = async (data: { notificationId: string; decision: 'accept' | 'reject' }): Promise<ServerResponse> => {
    try {
        const me = await getCurrentUserConvexId();
        if (!me) throw new Error("Not authenticated");

        const result = await convex.mutation(api.matchrooms.respondToMatchroomJoinRequest, {
            notificationId: data.notificationId as Id<"notifications">,
            hostUid: me.uid,
            accept: data.decision === 'accept',
        });

        return result as ServerResponse;
    } catch (error: any) {
        Logger.error('functions', 'respondToMatchroomJoinRequest error', error);
        return { ok: false, message: error.message || 'Failed to respond to join request.' };
    }
};

// ----------------------------------------------------------------------------
// Cancel User's Pending Matchroom Requests
// ----------------------------------------------------------------------------

export const cancelUserPendingMatchroomRequests = async (uid: string): Promise<ServerResponse> => {
    try {
        const convexId = await resolveUserId(uid);
        if (!convexId) return { ok: false, message: "User not found" };

        const result = await convex.mutation(api.matchrooms.cancelUserPendingMatchroomRequests, {
            userUid: convexId,
        });

        return { ok: true, message: `Cancelled ${result.count} pending request(s).` };
    } catch (error: any) {
        Logger.error('functions', 'cancelUserPendingMatchroomRequests error', error);
        return { ok: false, message: error.message || 'Failed to cancel pending requests.' };
    }
};

// ----------------------------------------------------------------------------
// Matchroom Captaincy Transfer
// ----------------------------------------------------------------------------

export const transferMatchroomCaptain = async (data: {
    matchroomId: string;
    team: 'A' | 'B';
    newCaptainUid: string
}): Promise<ServerResponse> => {
    try {
        const me = await getCurrentUserConvexId();
        if (!me) throw new Error("Not authenticated");

        const result = await convex.mutation(api.matchrooms.transferMatchroomCaptain, {
            matchroomId: data.matchroomId as Id<"matchrooms">,
            callerUid: me.uid,
            team: data.team,
            newCaptainUid: data.newCaptainUid,
        });

        return result as ServerResponse;
    } catch (error: any) {
        Logger.error('functions', 'transferMatchroomCaptain error', error);
        return { ok: false, message: error.message || 'Failed to transfer captaincy.' };
    }
};

// ----------------------------------------------------------------------------
// Matchroom Invitations
// ----------------------------------------------------------------------------

export const inviteToMatchroom = async (data: {
    matchroomId: string;
    toUid: string;
    team: 'A' | 'B';
    slotId: string;
    role?: string;
    fromUsername?: string;
}): Promise<ServerResponse> => {
    try {
        const me = await getCurrentUserConvexId();
        if (!me) throw new Error("Not authenticated");

        const toConvexId = await resolveUserId(data.toUid);
        if (!toConvexId) throw new Error("User not found");

        await convex.mutation(api.matchrooms.inviteToMatchroom, {
            matchroomId: data.matchroomId as Id<"matchrooms">,
            fromUid: me.uid,
            fromUsername: data.fromUsername || me.username,
            toUid: toConvexId,
            team: data.team,
            slotId: data.slotId,
            role: data.role,
        });

        return { ok: true, message: "Invitation sent successfully." };
    } catch (error: any) {
        Logger.error('functions', 'inviteToMatchroom error', error);
        return { ok: false, message: error.message || 'Failed to send invitation.' };
    }
};

export const respondToMatchroomInvite = async (data: {
    notificationId: string;
    decision: 'accept' | 'decline';
}): Promise<ServerResponse> => {
    try {
        const me = await getCurrentUserConvexId();
        if (!me) throw new Error("Not authenticated");

        const result = await convex.mutation(api.matchrooms.respondToMatchroomInvite, {
            notificationId: data.notificationId as Id<"notifications">,
            userId: me.convexId,
            accept: data.decision === 'accept',
        });

        return result as ServerResponse;
    } catch (error: any) {
        Logger.error('functions', 'respondToMatchroomInvite error', error);
        return { ok: false, message: error.message || 'Failed to respond.' };
    }
};

export const kickFromMatchroom = async (data: {
    matchroomId: string;
    playerUid: string;
}): Promise<ServerResponse> => {
    try {
        const me = await getCurrentUserConvexId();
        if (!me) throw new Error("Not authenticated");

        const result = await convex.mutation(api.matchrooms.kickFromMatchroom, {
            matchroomId: data.matchroomId as Id<"matchrooms">,
            callerUid: me.uid,
            playerUid: data.playerUid,
        });

        return result as ServerResponse;
    } catch (error: any) {
        Logger.error('functions', 'kickFromMatchroom error', error);
        return { ok: false, message: error.message || 'Failed to kick player.' };
    }
};
