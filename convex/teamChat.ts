import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getStrictAuthenticatedUserId } from "./chatAuth";
import { isUserHiddenFromPublic } from "./userVisibility";
import { markUserPresent } from "./presence";

// ============================================
// TEAM CHAT (private, members-only)
// ============================================
// A private chatroom for each team. Access is enforced from the teamMembers
// table (accepted members + captain). Pending invites are notifications, not
// teamMembers rows, so they are excluded automatically; removed users lose
// their teamMembers row and immediately lose access; soft-deleted accounts are
// rejected defensively. Reuses the shared chatrooms/chatMessages tables with
// `type: "team"`.

const chatMessageTypeValidator = v.union(
  v.literal("text"),
  v.literal("voice"),
  v.literal("image"),
  v.literal("file"),
);

const chatAttachmentInputValidator = v.object({
  storageId: v.id("_storage"),
  fileName: v.optional(v.string()),
  mimeType: v.optional(v.string()),
  sizeBytes: v.optional(v.number()),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
});

async function resolveAttachment(ctx: any, attachment: any) {
  if (!attachment?.storageId) return null;
  return { ...attachment, url: await ctx.storage.getUrl(attachment.storageId) };
}

type TeamAccessState =
  | { status: "ok"; userId: Id<"users">; team: any; memberUids: string[] }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "unauthenticated" };

function isActiveTeam(team: any): boolean {
  if (!team) return false;
  return !(team.status === "deleted" || Boolean(team.deletedAt));
}

// Canonical member list for a team chat: every accepted teamMembers row, minus
// any soft-deleted / hidden account (so deleted or removed users never remain
// in the members-only chat participant list).
async function getTeamMemberUids(ctx: any, teamId: Id<"teams">): Promise<string[]> {
  const members = await ctx.db
    .query("teamMembers")
    .withIndex("by_teamId", (q: any) => q.eq("teamId", teamId))
    .collect();
  const uids = new Set<string>();
  for (const m of members) {
    if (!m?.odxerId) continue;
    const memberUser = await ctx.db.get(m.odxerId);
    if (!memberUser || isUserHiddenFromPublic(memberUser)) continue;
    uids.add(String(m.odxerId));
  }
  return Array.from(uids);
}

async function getTeamAccessState(ctx: any, teamId: Id<"teams">): Promise<TeamAccessState> {
  let userId: Id<"users">;
  try {
    userId = await getStrictAuthenticatedUserId(ctx);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthenticated") {
      return { status: "unauthenticated" };
    }
    throw error;
  }

  const team = await ctx.db.get(teamId);
  if (!isActiveTeam(team)) return { status: "not_found" };

  // Defensive: a soft-deleted/hidden account is never a chat participant.
  const actor = await ctx.db.get(userId);
  if (!actor || isUserHiddenFromPublic(actor)) return { status: "forbidden" };

  const memberUids = await getTeamMemberUids(ctx, teamId);
  if (!memberUids.includes(String(userId))) {
    return { status: "forbidden" };
  }
  return { status: "ok", userId, team, memberUids };
}

async function requireTeamMember(ctx: any, teamId: Id<"teams">) {
  const state = await getTeamAccessState(ctx, teamId);
  if (state.status === "not_found") throw new Error("Team not found");
  if (state.status === "unauthenticated") throw new Error("Unauthenticated");
  if (state.status === "forbidden") throw new Error("You are not a member of this team");
  return state;
}

// Ensure the team chatroom exists and its participant list mirrors the current
// team membership. Caller must have already authorized the actor.
async function syncTeamChatroom(ctx: any, teamId: Id<"teams">, memberUids: string[], now: number) {
  let chatroom = await ctx.db
    .query("chatrooms")
    .withIndex("by_teamId", (q: any) => q.eq("teamId", teamId))
    .unique();

  if (!chatroom) {
    const chatroomId = await ctx.db.insert("chatrooms", {
      type: "team" as const,
      teamId,
      participantUids: memberUids,
      lastReadBy: {},
      createdAt: now,
      updatedAt: now,
    });
    chatroom = await ctx.db.get(chatroomId);
    return chatroom!;
  }

  const current = new Set<string>(chatroom.participantUids || []);
  const changed =
    memberUids.length !== current.size || memberUids.some((uid) => !current.has(uid));
  if (changed) {
    await ctx.db.patch(chatroom._id, { participantUids: memberUids, updatedAt: now });
    chatroom = await ctx.db.get(chatroom._id);
  }
  return chatroom!;
}

export const getAccess = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const state = await getTeamAccessState(ctx, args.teamId);
    return { status: state.status };
  },
});

export const getChat = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const state = await getTeamAccessState(ctx, args.teamId);
    if (state.status !== "ok") return null;
    const chatroom = await ctx.db
      .query("chatrooms")
      .withIndex("by_teamId", (q: any) => q.eq("teamId", args.teamId))
      .unique();
    return {
      teamId: args.teamId,
      teamName: state.team?.name || "Team",
      participantUids: chatroom?.participantUids || state.memberUids,
      lastReadBy: chatroom?.lastReadBy || {},
      updatedAt: chatroom?.updatedAt || chatroom?.createdAt || null,
    };
  },
});

export const listMessages = query({
  args: { teamId: v.id("teams"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const state = await getTeamAccessState(ctx, args.teamId);
    if (state.status !== "ok") return [];

    const chatroom = await ctx.db
      .query("chatrooms")
      .withIndex("by_teamId", (q: any) => q.eq("teamId", args.teamId))
      .unique();
    if (!chatroom) return [];

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_chatroomId_and_createdAt", (q: any) => q.eq("chatroomId", chatroom._id))
      .order("desc")
      .take(Math.max(1, Math.min(200, args.limit || 100)));

    return await Promise.all(
      messages.map(async (message: any) => ({
        ...message,
        audioUrl: message.audioStorageId ? await ctx.storage.getUrl(message.audioStorageId) : null,
        attachment: await resolveAttachment(ctx, message.attachment),
      })),
    );
  },
});

export const generateUploadUrl = mutation({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    await requireTeamMember(ctx, args.teamId);
    return await ctx.storage.generateUploadUrl();
  },
});

export const sendMessage = mutation({
  args: {
    teamId: v.id("teams"),
    text: v.string(),
    type: v.optional(chatMessageTypeValidator),
    audioStorageId: v.optional(v.id("_storage")),
    audioDurationMs: v.optional(v.number()),
    attachment: v.optional(chatAttachmentInputValidator),
    clientMessageId: v.optional(v.string()),
    replyTo: v.optional(
      v.object({
        messageId: v.string(),
        senderName: v.string(),
        text: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const state = await requireTeamMember(ctx, args.teamId);
    const now = Date.now();
    await markUserPresent(ctx, state.userId, now);

    const messageType = args.type || (args.audioStorageId ? "voice" : args.attachment ? "image" : "text");

    const text = String(args.text || "").slice(0, 4000);
    if (messageType === "text" && !text.trim()) {
      throw new Error("Message cannot be empty");
    }

    const chatroom = await syncTeamChatroom(ctx, args.teamId, state.memberUids, now);
    const sender = await ctx.db.get(state.userId);
    const senderUsername = sender?.username || sender?.fullName || "Member";

    // Idempotency: ignore duplicate client retries with the same clientMessageId.
    if (args.clientMessageId) {
      const existing = await ctx.db
        .query("chatMessages")
        .withIndex("by_chatroomId_and_createdAt", (q: any) => q.eq("chatroomId", chatroom._id))
        .order("desc")
        .take(25);
      const dup = existing.find((m: any) => m.clientMessageId === args.clientMessageId);
      if (dup) return dup._id;
    }

    const messageId = await ctx.db.insert("chatMessages", {
      chatroomId: chatroom._id,
      senderUid: state.userId,
      senderUsername,
      content: text,
      type: messageType,
      audioStorageId: args.audioStorageId,
      audioDurationMs: args.audioDurationMs,
      attachment: args.attachment,
      clientMessageId: args.clientMessageId,
      replyTo: args.replyTo,
      createdAt: now,
    });

    const preview =
      messageType === "voice"
        ? "Voice message"
        : messageType === "image"
          ? "Photo"
          : messageType === "file"
            ? "Attachment"
            : text;
    await ctx.db.patch(chatroom._id, {
      lastMessage: {
        text: preview.slice(0, 200),
        senderUid: String(state.userId),
        senderName: senderUsername,
        type: messageType,
        audioDurationMs: args.audioDurationMs,
        createdAt: now,
      },
      lastReadBy: { ...(chatroom.lastReadBy || {}), [String(state.userId)]: now },
      updatedAt: now,
    });

    return messageId;
  },
});

export const markRead = mutation({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const state = await requireTeamMember(ctx, args.teamId);
    const chatroom = await ctx.db
      .query("chatrooms")
      .withIndex("by_teamId", (q: any) => q.eq("teamId", args.teamId))
      .unique();
    if (!chatroom) return { ok: true };
    await ctx.db.patch(chatroom._id, {
      lastReadBy: { ...(chatroom.lastReadBy || {}), [String(state.userId)]: Date.now() },
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});
