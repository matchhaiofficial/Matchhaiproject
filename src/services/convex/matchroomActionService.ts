import { convex } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { currentUser } from "./authService";
import Logger from "../../utils/logger";

export type MatchroomActionResponse =
  | { ok: true; message?: string; [key: string]: any }
  | { ok: false; message: string; [key: string]: any };

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

export async function respondToMatchroomJoinRequestAction(data: {
  notificationId: string;
  decision: "accept" | "reject";
}): Promise<MatchroomActionResponse> {
  try {
    const me = await getCurrentUserConvexId();
    if (!me) throw new Error("Not authenticated");

    const result = await convex.mutation(api.matchrooms.respondToMatchroomJoinRequest, {
      notificationId: data.notificationId as Id<"notifications">,
      hostUid: me.convexId,
      accept: data.decision === "accept",
    });

    return result as MatchroomActionResponse;
  } catch (error: any) {
    Logger.error("matchroomActionService", "respondToMatchroomJoinRequestAction error", error);
    return { ok: false, message: error.message || "Failed to respond to join request." };
  }
}

export async function transferMatchroomCaptainAction(data: {
  matchroomId: string;
  team: "A" | "B";
  newCaptainUid: string;
}): Promise<MatchroomActionResponse> {
  try {
    const me = await getCurrentUserConvexId();
    if (!me) throw new Error("Not authenticated");

    const result = await convex.mutation(api.matchrooms.transferMatchroomCaptain, {
      matchroomId: data.matchroomId as Id<"matchrooms">,
      callerUid: me.convexId,
      team: data.team,
      newCaptainUid: data.newCaptainUid,
    });

    return result as MatchroomActionResponse;
  } catch (error: any) {
    Logger.error("matchroomActionService", "transferMatchroomCaptainAction error", error);
    return { ok: false, message: error.message || "Failed to transfer captaincy." };
  }
}

export async function inviteToMatchroomAction(data: {
  matchroomId: string;
  toUid: string;
  team: "A" | "B";
  slotId: string;
  role?: string;
  fromUsername?: string;
}): Promise<MatchroomActionResponse> {
  try {
    const me = await getCurrentUserConvexId();
    if (!me) throw new Error("Not authenticated");

    const toConvexId = await resolveUserId(data.toUid);
    if (!toConvexId) throw new Error("User not found");

    await convex.mutation(api.matchrooms.inviteToMatchroom, {
      matchroomId: data.matchroomId as Id<"matchrooms">,
      fromUid: me.convexId,
      fromUsername: data.fromUsername || me.username,
      toUid: toConvexId,
      team: data.team,
      slotId: data.slotId,
      role: data.role,
    });

    return { ok: true, message: "Invitation sent successfully." };
  } catch (error: any) {
    Logger.warn("matchroomActionService", "inviteToMatchroomAction rejected", {
      message: error?.message || "Failed to send invitation.",
    });
    return { ok: false, message: error.message || "Failed to send invitation." };
  }
}

export async function respondToMatchroomInviteAction(data: {
  notificationId: string;
  decision: "accept" | "decline";
}): Promise<MatchroomActionResponse> {
  try {
    const me = await getCurrentUserConvexId();
    if (!me) throw new Error("Not authenticated");

    const result = await convex.mutation(api.matchrooms.respondToMatchroomInvite, {
      notificationId: data.notificationId as Id<"notifications">,
      userId: me.convexId,
      accept: data.decision === "accept",
    });

    return result as MatchroomActionResponse;
  } catch (error: any) {
    Logger.error("matchroomActionService", "respondToMatchroomInviteAction error", error);
    return { ok: false, message: error.message || "Failed to respond." };
  }
}

export async function kickFromMatchroomAction(data: {
  matchroomId: string;
  playerUid: string;
}): Promise<MatchroomActionResponse> {
  try {
    const me = await getCurrentUserConvexId();
    if (!me) throw new Error("Not authenticated");

    const result = await convex.mutation(api.matchrooms.kickFromMatchroom, {
      matchroomId: data.matchroomId as Id<"matchrooms">,
      callerUid: me.convexId,
      playerUid: data.playerUid,
    });

    return result as MatchroomActionResponse;
  } catch (error: any) {
    Logger.error("matchroomActionService", "kickFromMatchroomAction error", error);
    return { ok: false, message: error.message || "Failed to kick player." };
  }
}
