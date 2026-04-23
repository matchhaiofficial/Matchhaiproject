import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { getStrictAuthenticatedUserId } from "./chatAuth";
import { normalizeChatUserKeys } from "./chatIdentity";

type UserIdString = string;

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

type MatchroomAccessState =
  | { status: "ok"; userId: Id<"users">; matchroom: any; participantUids: UserIdString[] }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "unauthenticated" };

async function getMatchroomActorUserId(ctx: any): Promise<Id<"users">> {
  return await getStrictAuthenticatedUserId(ctx);
}

async function getSenderProfile(ctx: any, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("User profile not found");
  }
  return user;
}

function getMatchroomParticipantUids(matchroom: any) {
  return normalizeChatUserKeys([
    matchroom?.hostUid,
    ...((matchroom?.playerUids || []) as string[]),
    ...(matchroom?.zoneOwnerUid ? [matchroom.zoneOwnerUid] : []),
  ]);
}

function buildLastReadBy(lastReadBy: Record<string, number> | undefined, participantUids: string[], now: number) {
  const next = Object.fromEntries(
    participantUids.map((uid) => [uid, Number(lastReadBy?.[uid] || 0) || now])
  );
  return next;
}

async function getMatchroomAccessState(ctx: any, matchroomId: Id<"matchrooms">): Promise<MatchroomAccessState> {
  const matchroom = await ctx.db.get(matchroomId);
  if (!matchroom) {
    return { status: "not_found" };
  }

  let userId: Id<"users">;
  try {
    userId = await getMatchroomActorUserId(ctx);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthenticated") {
      return { status: "unauthenticated" };
    }
    throw error;
  }

  const participantUids = getMatchroomParticipantUids(matchroom);
  if (!participantUids.includes(String(userId))) {
    return { status: "forbidden" };
  }

  return { status: "ok", userId, matchroom, participantUids };
}

async function requireAuthorizedMatchroomParticipant(ctx: any, matchroomId: Id<"matchrooms">) {
  const state = await getMatchroomAccessState(ctx, matchroomId);
  if (state.status === "not_found") {
    throw new Error("Matchroom not found");
  }
  if (state.status === "forbidden") {
    throw new Error("You are not allowed to access this chat");
  }
  if (state.status === "unauthenticated") {
    throw new Error("Unauthenticated");
  }
  return state;
}

async function requireAuthorizedChatroomParticipant(ctx: any, chatroomId: Id<"chatrooms">) {
  const userId = await getMatchroomActorUserId(ctx);
  const chatroom = await ctx.db.get(chatroomId);
  if (!chatroom) {
    throw new Error("Chatroom not found");
  }

  if (chatroom.type === "dm" || !chatroom.matchroomId) {
    throw new Error("Use the DM chat API for direct messages");
  }

  const matchroom = await ctx.db.get(chatroom.matchroomId);
  if (!matchroom) {
    throw new Error("Matchroom not found");
  }

  const participantUids = getMatchroomParticipantUids(matchroom);
  if (!participantUids.includes(String(userId))) {
    throw new Error("You are not allowed to access this chat");
  }

  return { userId, chatroom, matchroom, participantUids };
}

async function syncMatchroomChatroom(ctx: any, matchroomId: Id<"matchrooms">, now: number) {
  const { userId, matchroom, participantUids } = await requireAuthorizedMatchroomParticipant(ctx, matchroomId);
  let chatroom = await ctx.db
    .query("chatrooms")
    .withIndex("by_matchroomId", (q: any) => q.eq("matchroomId", matchroomId))
    .unique();

  if (!chatroom) {
    const chatroomId = await ctx.db.insert("chatrooms", {
      matchroomId,
      participantUids,
      zoneId: matchroom.zoneId,
      createdAt: now,
      updatedAt: now,
      lastReadBy: buildLastReadBy(undefined, participantUids, now),
    });
    await syncChatroomMembers(ctx, chatroomId, participantUids, now);
    chatroom = await ctx.db.get(chatroomId);
  } else {
    const participantSet = new Set(chatroom.participantUids || []);
    const participantsChanged =
      participantUids.length !== participantSet.size ||
      participantUids.some((uid) => !participantSet.has(uid));

    if (
      participantsChanged ||
      String(chatroom.zoneId || "") !== String(matchroom.zoneId || "")
    ) {
      await ctx.db.patch(chatroom._id, {
        participantUids,
        zoneId: matchroom.zoneId,
        lastReadBy: buildLastReadBy(chatroom.lastReadBy as Record<string, number> | undefined, participantUids, now),
        updatedAt: now,
      });
    }

    await syncChatroomMembers(ctx, chatroom._id, participantUids, now);
    chatroom = await ctx.db.get(chatroom._id);
  }

  if (!chatroom) {
    throw new Error("Chatroom not found");
  }

  return { userId, matchroom, chatroom, participantUids };
}

async function ensureChatroomMember(ctx: any, chatroomId: any, userId: UserIdString, now: number) {
  const existing = await ctx.db
    .query("chatroomMembers")
    .withIndex("by_chatroomId_and_userId", (q: any) =>
      q.eq("chatroomId", chatroomId).eq("userId", userId)
    )
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, { updatedAt: now });
    return existing;
  }

  const memberId = await ctx.db.insert("chatroomMembers", {
    chatroomId,
    userId,
    joinedAt: now,
    lastReadAt: now,
    unreadCount: 0,
    updatedAt: now,
  });

  return await ctx.db.get(memberId);
}

async function syncChatroomMembers(ctx: any, chatroomId: any, participantUids: UserIdString[], now: number) {
  const normalized = normalizeChatUserKeys(participantUids || []);
  const existingMembers = await ctx.db
    .query("chatroomMembers")
    .withIndex("by_chatroomId", (q: any) => q.eq("chatroomId", chatroomId))
    .collect();

  const existingByUserId = new Map(existingMembers.map((member: any) => [String(member.userId), member]));
  for (const userId of normalized) {
    if (!existingByUserId.has(userId)) {
      await ctx.db.insert("chatroomMembers", {
        chatroomId,
        userId,
        joinedAt: now,
        lastReadAt: now,
        unreadCount: 0,
        updatedAt: now,
      });
    }
  }

  for (const member of existingMembers) {
    if (!normalized.includes(String(member.userId))) {
      await ctx.db.delete(member._id);
    }
  }
}

async function updateUnreadCounts(ctx: any, chatroomId: any, senderUid: UserIdString, now: number) {
  const members = await ctx.db
    .query("chatroomMembers")
    .withIndex("by_chatroomId", (q: any) => q.eq("chatroomId", chatroomId))
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

export const getByMatchroom = query({
  args: { matchroomId: v.id("matchrooms") },
  handler: async (ctx, args) => {
    try {
      await requireAuthorizedMatchroomParticipant(ctx, args.matchroomId);
    } catch {
      return null;
    }

    return await ctx.db
      .query("chatrooms")
      .withIndex("by_matchroomId", (q: any) => q.eq("matchroomId", args.matchroomId))
      .unique();
  },
});

export const getMatchroomAccess = query({
  args: { matchroomId: v.id("matchrooms") },
  handler: async (ctx, args) => {
    const state = await getMatchroomAccessState(ctx, args.matchroomId);
    if (state.status !== "ok") {
      return state;
    }

    const chatroom = await ctx.db
      .query("chatrooms")
      .withIndex("by_matchroomId", (q: any) => q.eq("matchroomId", args.matchroomId))
      .unique();

    return {
      status: "ok" as const,
      chatroomId: chatroom?._id ?? null,
      participantUids: state.participantUids,
      userId: state.userId,
    };
  },
});

export const getOrCreateForMatchroom = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    participantUids: v.array(v.string()),
    zoneId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const { chatroom } = await syncMatchroomChatroom(ctx, args.matchroomId, now);
    return chatroom._id;
  },
});

export const listMessages = query({
  args: {
    chatroomId: v.id("chatrooms"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    try {
      await requireAuthorizedChatroomParticipant(ctx, args.chatroomId);
    } catch {
      return [];
    }

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_chatroomId_and_createdAt", (q) => q.eq("chatroomId", args.chatroomId))
      .order("desc")
      .take(args.limit || 100);

    return await Promise.all(
      messages.map(async (message) => ({
        ...message,
        audioUrl: message.audioStorageId ? await ctx.storage.getUrl(message.audioStorageId) : null,
        attachment: await resolveAttachment(ctx, message.attachment),
      }))
    );
  },
});

export const listForUser = query({
  args: {},
  handler: async (ctx) => {
    const actorId = await getMatchroomActorUserId(ctx);

    const memberships = await ctx.db
      .query("chatroomMembers")
      .withIndex("by_userId", (q) => q.eq("userId", String(actorId)))
      .collect();

    return await Promise.all(
      memberships.map(async (membership: any) => {
        const chatroom = (await ctx.db.get(membership.chatroomId)) as any;
        if (!chatroom) return null;
        // Skip DM chatrooms — they are handled by friendChat.listForUser
        if (chatroom.type === "dm" || !chatroom.matchroomId) return null;

        const matchroom = (await ctx.db.get(chatroom.matchroomId)) as any;
        return {
          id: chatroom._id,
          kind: "matchroom" as const,
          matchroomId: chatroom.matchroomId,
          title: matchroom?.title || "Matchroom chat",
          subtitle: matchroom?.location || matchroom?.game || "Match chat",
          participantUids: chatroom.participantUids,
          lastMessage: chatroom.lastMessage || null,
          updatedAt: chatroom.updatedAt || chatroom.createdAt,
          unreadCount: Number(membership.unreadCount || 0),
        };
      })
    ).then((rows) => rows.filter(Boolean));
  },
});

export const listMessagesForMatchroom = query({
  args: {
    matchroomId: v.id("matchrooms"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    try {
      await requireAuthorizedMatchroomParticipant(ctx, args.matchroomId);
    } catch {
      return [];
    }

    const chatroom = await ctx.db
      .query("chatrooms")
      .withIndex("by_matchroomId", (q: any) => q.eq("matchroomId", args.matchroomId))
      .unique();

    if (!chatroom) return [];

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_chatroomId_and_createdAt", (q) => q.eq("chatroomId", chatroom._id))
      .order("desc")
      .take(args.limit || 100);

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
  args: { chatroomId: v.optional(v.id("chatrooms")), matchroomId: v.optional(v.id("matchrooms")) },
  handler: async (ctx, args) => {
    if (args.chatroomId) {
      await requireAuthorizedChatroomParticipant(ctx, args.chatroomId);
    } else if (args.matchroomId) {
      await requireAuthorizedMatchroomParticipant(ctx, args.matchroomId);
    } else {
      throw new Error("Must pass chatroomId or matchroomId");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const sendMessage = mutation({
  args: {
    chatroomId: v.id("chatrooms"),
    content: v.string(),
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
    const { userId, chatroom } = await requireAuthorizedChatroomParticipant(ctx, args.chatroomId);
    const sender = await getSenderProfile(ctx, userId);

    const now = Date.now();
    const messageType = args.type || "text";
    const trimmedContent = args.content.trim();
    if (messageType === "text" && !trimmedContent) {
      throw new Error("Message cannot be empty");
    }
    if (messageType === "voice" && !args.audioStorageId) {
      throw new Error("Voice message is missing audio");
    }
    if ((messageType === "image" || messageType === "file") && !args.attachment) {
      throw new Error("Attachment message is missing attachment data");
    }
    const senderName = sender.fullName || sender.username || "Player";
    const previewText =
      messageType === "voice"
        ? "Voice message"
        : messageType === "image"
          ? "Photo"
          : messageType === "file"
            ? args.attachment?.fileName || "File"
            : trimmedContent;

    const messageId = await ctx.db.insert("chatMessages", {
      chatroomId: args.chatroomId,
      senderUid: userId,
      senderUsername: senderName,
      content: trimmedContent,
      type: messageType,
      audioStorageId: args.audioStorageId,
      audioDurationMs: args.audioDurationMs,
      attachment: args.attachment,
      clientMessageId: args.clientMessageId,
      replyTo: args.replyTo,
      createdAt: now,
    });

    const lastReadBy = { ...((chatroom.lastReadBy as Record<string, number>) || {}), [String(userId)]: now };
    await ctx.db.patch(args.chatroomId, {
      lastMessage: {
        text: previewText,
        senderUid: String(userId),
        senderName,
        type: messageType,
        audioDurationMs: args.audioDurationMs,
        createdAt: now,
      },
      lastReadBy,
      updatedAt: now,
    });

    await ensureChatroomMember(ctx, args.chatroomId, String(userId), now);
    await updateUnreadCounts(ctx, args.chatroomId, String(userId), now);

    // Schedule push notification to other participants
    const recipientIds = (chatroom.participantUids || [])
      .filter((uid: string) => String(uid) !== String(userId))
      .map((uid: string) => uid as Id<"users">);
    if (recipientIds.length > 0) {
      await ctx.scheduler.runAfter(0, (internal as any).pushNotificationsActions.sendChatPush, {
        senderName,
        messagePreview: previewText.slice(0, 100),
        recipientUserIds: recipientIds,
        chatKey: String(args.chatroomId),
        matchroomId: String(chatroom.matchroomId),
      });
    }

    return messageId;
  },
});

export const sendMessageToMatchroom = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    content: v.string(),
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
    const now = Date.now();
    const { userId, matchroom, chatroom } = await syncMatchroomChatroom(ctx, args.matchroomId, now);
    const sender = await getSenderProfile(ctx, userId);

    const messageType = args.type || "text";
    const trimmedContent = args.content.trim();
    if (messageType === "text" && !trimmedContent) {
      throw new Error("Message cannot be empty");
    }
    if (messageType === "voice" && !args.audioStorageId) {
      throw new Error("Voice message is missing audio");
    }
    if ((messageType === "image" || messageType === "file") && !args.attachment) {
      throw new Error("Attachment message is missing attachment data");
    }
    const senderName = sender.fullName || sender.username || "Player";
    const previewText =
      messageType === "voice"
        ? "Voice message"
        : messageType === "image"
          ? "Photo"
          : messageType === "file"
            ? args.attachment?.fileName || "File"
            : trimmedContent;
    const messageId = await ctx.db.insert("chatMessages", {
      chatroomId: chatroom._id,
      senderUid: userId,
      senderUsername: senderName,
      content: trimmedContent,
      type: messageType,
      audioStorageId: args.audioStorageId,
      audioDurationMs: args.audioDurationMs,
      attachment: args.attachment,
      clientMessageId: args.clientMessageId,
      replyTo: args.replyTo,
      createdAt: now,
    });

    const lastReadBy = { ...((chatroom.lastReadBy as Record<string, number>) || {}), [String(userId)]: now };
    await ctx.db.patch(chatroom._id, {
      lastMessage: {
        text: previewText,
        senderUid: String(userId),
        senderName,
        type: messageType,
        audioDurationMs: args.audioDurationMs,
        createdAt: now,
      },
      lastReadBy,
      updatedAt: now,
    });

    await ensureChatroomMember(ctx, chatroom._id, String(userId), now);
    await updateUnreadCounts(ctx, chatroom._id, String(userId), now);

    // Schedule push notification to other participants
    const participantUids = getMatchroomParticipantUids(matchroom);
    const recipientIds = participantUids
      .filter((uid) => String(uid) !== String(userId))
      .map((uid) => uid as Id<"users">);
    if (recipientIds.length > 0) {
      await ctx.scheduler.runAfter(0, (internal as any).pushNotificationsActions.sendChatPush, {
        senderName,
        messagePreview: previewText.slice(0, 100),
        recipientUserIds: recipientIds,
        chatKey: String(chatroom._id),
        matchroomId: String(args.matchroomId),
      });
    }

    return messageId;
  },
});

export const deleteForMe = mutation({
  args: {
    messageId: v.id("chatMessages"),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    const { userId } = await requireAuthorizedChatroomParticipant(ctx, message.chatroomId);

    const deletedFor = message.deletedFor || [];
    if (!deletedFor.includes(String(userId))) {
      await ctx.db.patch(args.messageId, {
        deletedFor: [...deletedFor, String(userId)],
      });
    }
    return true;
  },
});

export const markRead = mutation({
  args: { chatroomId: v.id("chatrooms") },
  handler: async (ctx, args) => {
    const { userId, chatroom } = await requireAuthorizedChatroomParticipant(ctx, args.chatroomId);

    const now = Date.now();
    const lastReadBy = { ...((chatroom.lastReadBy as Record<string, number>) || {}), [String(userId)]: now };
    await ctx.db.patch(args.chatroomId, {
      lastReadBy,
      updatedAt: now,
    });

    const member = await ensureChatroomMember(ctx, args.chatroomId, String(userId), now);
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
    messageId: v.id("chatMessages"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    const { userId } = await requireAuthorizedChatroomParticipant(ctx, message.chatroomId);

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

// ============ Typing indicator ============

export const setTyping = mutation({
  args: { chatKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getMatchroomActorUserId(ctx);
    const user = await ctx.db.get(userId);
    const userName = user?.username || user?.fullName || "Player";
    const now = Date.now();

    const existing = await ctx.db
      .query("chatTypingStatus")
      .withIndex("by_chatKey_and_userId", (q: any) =>
        q.eq("chatKey", args.chatKey).eq("userId", userId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { updatedAt: now, userName });
    } else {
      await ctx.db.insert("chatTypingStatus", {
        chatKey: args.chatKey,
        userId,
        userName,
        updatedAt: now,
      });
    }
  },
});

export const getTypers = query({
  args: { chatKey: v.string() },
  handler: async (ctx, args) => {
    let currentUserId: Id<"users"> | null = null;
    try {
      currentUserId = await getMatchroomActorUserId(ctx);
    } catch {
      return [];
    }

    const cutoff = Date.now() - 4000;
    const rows = await ctx.db
      .query("chatTypingStatus")
      .withIndex("by_chatKey", (q: any) => q.eq("chatKey", args.chatKey))
      .collect();

    return rows
      .filter(
        (r) =>
          r.updatedAt > cutoff && String(r.userId) !== String(currentUserId)
      )
      .map((r) => ({ userId: r.userId, userName: r.userName }));
  },
});

export const editMessage = mutation({
  args: {
    messageId: v.id("chatMessages"),
    newContent: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    const { userId } = await requireAuthorizedChatroomParticipant(ctx, message.chatroomId);

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
      content: trimmed,
      editedAt: now,
    });
    return true;
  },
});

// ============ Pinned messages ============

export const pinMessage = mutation({
  args: {
    chatroomId: v.id("chatrooms"),
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuthorizedChatroomParticipant(ctx, args.chatroomId);
    const chatroom = await ctx.db.get(args.chatroomId);
    if (!chatroom) throw new Error("Chatroom not found");

    const pinned: string[] = (chatroom.pinnedMessageIds as string[]) || [];
    if (pinned.includes(args.messageId)) return true;
    if (pinned.length >= 5) {
      throw new Error("Maximum of 5 pinned messages allowed");
    }

    await ctx.db.patch(args.chatroomId, {
      pinnedMessageIds: [...pinned, args.messageId],
    });
    return true;
  },
});

export const unpinMessage = mutation({
  args: {
    chatroomId: v.id("chatrooms"),
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuthorizedChatroomParticipant(ctx, args.chatroomId);
    const chatroom = await ctx.db.get(args.chatroomId);
    if (!chatroom) throw new Error("Chatroom not found");

    const pinned: string[] = (chatroom.pinnedMessageIds as string[]) || [];
    const next = pinned.filter((id) => id !== args.messageId);
    if (next.length !== pinned.length) {
      await ctx.db.patch(args.chatroomId, { pinnedMessageIds: next });
    }
    return true;
  },
});

export const deleteMessage = mutation({
  args: { messageId: v.id("chatMessages") },
  handler: async () => {
    throw new Error("Full message deletion is disabled.");
  },
});
