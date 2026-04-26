import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { getStrictAuthenticatedUserId } from "./chatAuth";
import { normalizeChatUserKeys, toChatUserKey } from "./chatIdentity";

const chatMessageTypeValidator = v.union(
  v.literal("text"),
  v.literal("voice"),
  v.literal("image"),
  v.literal("file")
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
  return {
    ...attachment,
    url: await ctx.storage.getUrl(attachment.storageId),
  };
}

type ChallengeChatAccessState =
  | { status: "ok"; userId: Id<"users">; chat: any; challenge: any; participantIds: Id<"users">[] }
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "locked" };

async function ensureChallengeChatMember(ctx: any, chatId: string, userId: Id<"users">, now: number) {
  const existing = await ctx.db
    .query("teamChallengeChatMembers")
    .withIndex("by_chatId_and_userId", (q: any) => q.eq("chatId", chatId).eq("userId", userId))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, { updatedAt: now });
    return existing;
  }

  const memberId = await ctx.db.insert("teamChallengeChatMembers", {
    chatId,
    userId,
    joinedAt: now,
    lastReadAt: now,
    unreadCount: 0,
    updatedAt: now,
  });
  return await ctx.db.get(memberId);
}

async function syncChallengeChatMembers(ctx: any, chatId: string, participantUids: Id<"users">[], now: number) {
  const normalized = normalizeChatUserKeys(participantUids || []);
  const existingMembers = await ctx.db
    .query("teamChallengeChatMembers")
    .withIndex("by_chatId", (q: any) => q.eq("chatId", chatId))
    .collect();

  const existingByUserId = new Map(existingMembers.map((member: any) => [String(member.userId), member]));
  for (const rawUserId of normalized) {
    if (!existingByUserId.has(rawUserId)) {
      await ctx.db.insert("teamChallengeChatMembers", {
        chatId,
        userId: rawUserId as Id<"users">,
        joinedAt: now,
        lastReadAt: now,
        unreadCount: 0,
        updatedAt: now,
      });
    }
  }

  for (const member of existingMembers) {
    if (!normalized.includes(toChatUserKey(member.userId))) {
      await ctx.db.delete(member._id);
    }
  }
}

async function updateChallengeUnreadCounts(ctx: any, chatId: string, senderUid: Id<"users">, now: number) {
  const members = await ctx.db
    .query("teamChallengeChatMembers")
    .withIndex("by_chatId", (q: any) => q.eq("chatId", chatId))
    .collect();

  for (const member of members) {
    if (String(member.userId) === String(senderUid)) {
      await ctx.db.patch(member._id, {
        unreadCount: 0,
        lastReadAt: now,
        updatedAt: now,
      });
      continue;
    }

    await ctx.db.patch(member._id, {
      unreadCount: Number(member.unreadCount || 0) + 1,
      updatedAt: now,
    });
  }
}

async function getChallengeChatAccessState(ctx: any, chatId: string): Promise<ChallengeChatAccessState> {
  let userId: Id<"users">;
  try {
    userId = await getStrictAuthenticatedUserId(ctx);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthenticated") {
      return { status: "unauthenticated" };
    }
    throw error;
  }

  const chat = await ctx.db
    .query("teamChallengeChats")
    .withIndex("by_chatId", (q: any) => q.eq("chatId", chatId))
    .unique();

  const challengeId = chat?.challengeId || (chatId as Id<"teamChallenges">);
  const challenge = challengeId ? await ctx.db.get(challengeId) : null;
  if (!challenge) {
    return { status: "not_found" };
  }

  const participantIds = (chat?.participantUids || [challenge.captainAUid, challenge.captainBUid].filter(Boolean)) as Id<"users">[];
  const chatEnabledStatuses = new Set(["accepted", "venue_proposed", "venue_confirmed", "admin_pending", "completed"]);
  if (!participantIds.some((id: any) => String(id) === String(userId))) {
    return { status: "forbidden" };
  }
  if (!chatEnabledStatuses.has(challenge.status)) {
    return { status: "locked" };
  }

  return { status: "ok", userId, chat, challenge, participantIds };
}

async function requireChatParticipant(ctx: any, chatId: string) {
  const access = await getChallengeChatAccessState(ctx, chatId);
  if (access.status === "unauthenticated") {
    throw new Error("Unauthenticated");
  }
  if (access.status === "not_found") {
    throw new Error("Challenge chat is not linked to an active challenge");
  }
  if (access.status === "forbidden") {
    throw new Error("Only challenge captains can access this chat");
  }
  if (access.status === "locked") {
    throw new Error("Challenge chat is locked for this status");
  }
  return access;
}

export const getChat = query({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    const { chat } = await requireChatParticipant(ctx, args.chatId);
    return chat;
  },
});

export const getAccess = query({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    const access = await getChallengeChatAccessState(ctx, args.chatId);
    if (access.status !== "ok") {
      return access;
    }

    return {
      status: "ok" as const,
      challengeId: access.challenge._id,
      chatExists: Boolean(access.chat),
    };
  },
});

export const listForMe = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getStrictAuthenticatedUserId(ctx);
    const memberships = await ctx.db
      .query("teamChallengeChatMembers")
      .withIndex("by_userId", (q: any) => q.eq("userId", userId))
      .collect();

    return await Promise.all(
      memberships.map(async (membership: any) => {
        const chat = await ctx.db
          .query("teamChallengeChats")
          .withIndex("by_chatId", (q: any) => q.eq("chatId", membership.chatId))
          .unique();
        if (!chat) return null;

        const challenge = chat.challengeId ? await ctx.db.get(chat.challengeId) : null;
        return {
          id: chat.chatId,
          kind: "challenge" as const,
          title:
            challenge?.challengerTeamName && challenge?.opponentTeamName
              ? `${challenge.challengerTeamName} vs ${challenge.opponentTeamName}`
              : "Captains chat",
          subtitle: challenge?.status ? String(challenge.status).replace(/_/g, " ") : "Challenge chat",
          participantUids: (chat.participantUids || []).map((value: any) => String(value)),
          lastMessage: chat.lastMessage || null,
          updatedAt: chat.updatedAt || chat.createdAt,
          unreadCount: Number(membership.unreadCount || 0),
        };
      })
    ).then((rows) => rows.filter(Boolean));
  },
});

export const listMessages = query({
  args: {
    chatId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireChatParticipant(ctx, args.chatId);
    const messages = await ctx.db
      .query("teamChallengeChatMessages")
      .withIndex("by_chatId_and_createdAt", (q) => q.eq("chatId", args.chatId))
      .order("asc")
      .take(args.limit || 200);

    return await Promise.all(
      messages.map(async (message) => ({
        ...message,
        audioUrl: message.audioStorageId ? await ctx.storage.getUrl(message.audioStorageId) : null,
        attachment: await resolveAttachment(ctx, message.attachment),
      }))
    );
  },
});

export const generateChatUploadUrl = mutation({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    await requireChatParticipant(ctx, args.chatId);
    return await ctx.storage.generateUploadUrl();
  },
});

export const sendMessage = mutation({
  args: {
    chatId: v.string(),
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
      })
    ),
  },
  handler: async (ctx, args) => {
    const { userId, chat, challenge, participantIds } = await requireChatParticipant(ctx, args.chatId);
    if (!challenge) {
      throw new Error("Challenge chat not found");
    }

    const senderName =
      String(challenge.captainAUid) === String(userId)
        ? challenge.captainAName || "Captain"
        : challenge.captainBName || "Captain";

    const now = Date.now();
    const messageType = args.type || "text";
    if ((messageType === "image" || messageType === "file") && !args.attachment) {
      throw new Error("Attachment message is missing attachment data");
    }
    const previewText =
      messageType === "voice"
        ? "Voice message"
        : messageType === "image"
          ? "Photo"
          : messageType === "file"
            ? args.attachment?.fileName || "File"
            : args.text.trim();
    const messageId = await ctx.db.insert("teamChallengeChatMessages", {
      chatId: args.chatId,
      senderUid: String(userId),
      senderName,
      text: args.text.trim(),
      type: messageType,
      audioStorageId: args.audioStorageId,
      audioDurationMs: args.audioDurationMs,
      attachment: args.attachment,
      clientMessageId: args.clientMessageId,
      replyTo: args.replyTo,
      createdAt: now,
    });

    if (chat) {
      const lastReadBy = { ...((chat.lastReadBy as Record<string, number>) || {}), [String(userId)]: now };
      await ctx.db.patch(chat._id, {
        updatedAt: now,
        lastReadBy,
        lastMessage: {
          text: previewText,
          senderUid: userId,
          senderName,
          type: messageType,
          audioDurationMs: args.audioDurationMs,
          createdAt: now,
        },
      });
      await syncChallengeChatMembers(ctx, args.chatId, participantIds, now);
    } else {
      await ctx.db.insert("teamChallengeChats", {
        chatId: args.chatId,
        challengeId: challenge._id,
        participantUids: participantIds,
        lastMessage: {
          text: previewText,
          senderUid: userId,
          senderName,
          type: messageType,
          audioDurationMs: args.audioDurationMs,
          createdAt: now,
        },
        lastReadBy: { [String(userId)]: now },
        updatedAt: now,
        createdAt: now,
      });
      await syncChallengeChatMembers(ctx, args.chatId, participantIds, now);
    }

    await ensureChallengeChatMember(ctx, args.chatId, userId, now);
    await updateChallengeUnreadCounts(ctx, args.chatId, userId, now);

    // Schedule push notification to the other captain
    const recipientIds = participantIds
      .filter((pid) => String(pid) !== String(userId));
    if (recipientIds.length > 0) {
      await ctx.scheduler.runAfter(0, (internal as any).pushNotificationsActions.sendChatPush, {
        senderName,
        messagePreview: previewText.slice(0, 100),
        recipientUserIds: recipientIds,
        chatKey: args.chatId,
        challengeId: String(challenge._id),
      });
    }

    return messageId;
  },
});

export const markRead = mutation({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    const { chat, userId } = await requireChatParticipant(ctx, args.chatId);
    if (!chat) return;

    const now = Date.now();
    const lastReadBy = { ...((chat.lastReadBy as Record<string, number>) || {}), [String(userId)]: now };
    await ctx.db.patch(chat._id, {
      lastReadBy,
      updatedAt: now,
    });

    const member = await ensureChallengeChatMember(ctx, args.chatId, userId, now);
    if (member) {
      await ctx.db.patch(member._id, {
        unreadCount: 0,
        lastReadAt: now,
        updatedAt: now,
      });
    }
  },
});

export const toggleReaction = mutation({
  args: {
    messageId: v.id("teamChallengeChatMessages"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    const { userId } = await requireChatParticipant(ctx, message.chatId);

    const reactions: Array<{ emoji: string; userId: Id<"users">; createdAt: number }> =
      (message.reactions as any[]) || [];
    const existingIndex = reactions.findIndex(
      (r) => r.emoji === args.emoji && String(r.userId) === String(userId)
    );

    if (existingIndex >= 0) {
      reactions.splice(existingIndex, 1);
    } else {
      reactions.push({ emoji: args.emoji, userId, createdAt: Date.now() });
    }

    await ctx.db.patch(args.messageId, { reactions });
    return true;
  },
});

export const editMessage = mutation({
  args: {
    messageId: v.id("teamChallengeChatMessages"),
    newContent: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    const { userId, challenge } = await requireChatParticipant(ctx, message.chatId);

    if (String(message.senderUid) !== String(userId)) {
      throw new Error("You can only edit your own messages");
    }
    const messageType = (message.type as string) || "text";
    if (messageType === "voice") {
      throw new Error("Voice messages cannot be edited");
    }
    const now = Date.now();
    const FIFTEEN_MINUTES = 15 * 60 * 1000;
    if (now - message.createdAt > FIFTEEN_MINUTES) {
      throw new Error("Messages can only be edited within 15 minutes");
    }

    const trimmed = args.newContent.trim();
    if (!trimmed) throw new Error("Edited message cannot be empty");

    await ctx.db.patch(args.messageId, {
      text: trimmed,
      editedAt: now,
    });
    return true;
  },
});

// ============ Pinned messages ============

export const pinMessage = mutation({
  args: {
    chatId: v.string(),
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, challenge } = await requireChatParticipant(ctx, args.chatId);
    // Captain-only for challenge chats
    const isCaptain =
      String(challenge.captainAUid) === String(userId) ||
      String(challenge.captainBUid) === String(userId);
    if (!isCaptain) {
      throw new Error("Only captains can pin messages in challenge chats");
    }

    const chat = await ctx.db
      .query("teamChallengeChats")
      .withIndex("by_chatId", (q: any) => q.eq("chatId", args.chatId))
      .unique();
    if (!chat) throw new Error("Chat not found");

    const pinned: string[] = (chat.pinnedMessageIds as string[]) || [];
    if (pinned.includes(args.messageId)) return true;
    if (pinned.length >= 5) {
      throw new Error("Maximum of 5 pinned messages allowed");
    }

    await ctx.db.patch(chat._id, {
      pinnedMessageIds: [...pinned, args.messageId],
    });
    return true;
  },
});

export const unpinMessage = mutation({
  args: {
    chatId: v.string(),
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, challenge } = await requireChatParticipant(ctx, args.chatId);
    const isCaptain =
      String(challenge.captainAUid) === String(userId) ||
      String(challenge.captainBUid) === String(userId);
    if (!isCaptain) {
      throw new Error("Only captains can unpin messages in challenge chats");
    }

    const chat = await ctx.db
      .query("teamChallengeChats")
      .withIndex("by_chatId", (q: any) => q.eq("chatId", args.chatId))
      .unique();
    if (!chat) throw new Error("Chat not found");

    const pinned: string[] = (chat.pinnedMessageIds as string[]) || [];
    const next = pinned.filter((id) => id !== args.messageId);
    if (next.length !== pinned.length) {
      await ctx.db.patch(chat._id, { pinnedMessageIds: next });
    }
    return true;
  },
});
