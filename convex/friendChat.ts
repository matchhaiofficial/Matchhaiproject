import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { getStrictAuthenticatedUserId } from "./chatAuth";
import { markUserPresent } from "./presence";

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

function makeDmPairKey(a: string, b: string): string {
  return [a, b].sort().join("_");
}

async function resolveAttachment(ctx: any, attachment: any) {
  if (!attachment?.storageId) return null;
  return {
    ...attachment,
    url: await ctx.storage.getUrl(attachment.storageId),
  };
}

async function ensureFriendship(ctx: any, userId: Id<"users">, friendId: Id<"users">) {
  const friendship = await ctx.db
    .query("friendships")
    .withIndex("by_userId_and_friendId", (q: any) =>
      q.eq("userId", userId).eq("friendId", friendId)
    )
    .unique();
  if (!friendship) {
    throw new Error("You can only chat with friends. Add this player as a friend first.");
  }

  // Check blocks
  const blocked = await ctx.db
    .query("userBlocks")
    .withIndex("by_userId_and_blockedUserId", (q: any) =>
      q.eq("userId", userId).eq("blockedUserId", friendId)
    )
    .unique();
  if (blocked) throw new Error("Cannot chat with a blocked user.");

  const blockedBy = await ctx.db
    .query("userBlocks")
    .withIndex("by_userId_and_blockedUserId", (q: any) =>
      q.eq("userId", friendId).eq("blockedUserId", userId)
    )
    .unique();
  if (blockedBy) throw new Error("Cannot chat with this user.");
}

async function ensureChatroomMember(ctx: any, chatroomId: Id<"chatrooms">, userId: string, now: number) {
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

async function updateUnreadCounts(ctx: any, chatroomId: Id<"chatrooms">, senderUid: string, now: number) {
  const members = await ctx.db
    .query("chatroomMembers")
    .withIndex("by_chatroomId", (q: any) => q.eq("chatroomId", chatroomId))
    .collect();

  for (const member of members) {
    if (String(member.userId) === String(senderUid)) {
      await ctx.db.patch(member._id, { unreadCount: 0, lastReadAt: now, updatedAt: now });
      continue;
    }
    await ctx.db.patch(member._id, {
      unreadCount: Number(member.unreadCount || 0) + 1,
      updatedAt: now,
    });
  }
}

// ============================================
// GET OR CREATE DM CHATROOM
// ============================================
export const getOrCreateDM = mutation({
  args: { friendId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await getStrictAuthenticatedUserId(ctx);
    await ensureFriendship(ctx, userId, args.friendId);

    const pairKey = makeDmPairKey(String(userId), String(args.friendId));
    const now = Date.now();

    // Check for existing DM chatroom
    const existing = await ctx.db
      .query("chatrooms")
      .withIndex("by_dmPairKey", (q: any) => q.eq("dmPairKey", pairKey))
      .unique();

    if (existing) {
      return existing._id;
    }

    // Create new DM chatroom
    const participantUids = [String(userId), String(args.friendId)];
    const chatroomId = await ctx.db.insert("chatrooms", {
      type: "dm",
      dmPairKey: pairKey,
      participantUids,
      createdAt: now,
      updatedAt: now,
      lastReadBy: Object.fromEntries(participantUids.map((uid) => [uid, now])),
    });

    // Create member records for both users
    for (const uid of participantUids) {
      await ensureChatroomMember(ctx, chatroomId, uid, now);
    }

    return chatroomId;
  },
});

// ============================================
// GET DM ACCESS (for query-side auth check)
// ============================================
export const getDMAccess = query({
  args: { friendId: v.id("users") },
  handler: async (ctx, args) => {
    let userId: Id<"users">;
    try {
      userId = await getStrictAuthenticatedUserId(ctx);
    } catch {
      return { status: "unauthenticated" as const };
    }

    const pairKey = makeDmPairKey(String(userId), String(args.friendId));
    const chatroom = await ctx.db
      .query("chatrooms")
      .withIndex("by_dmPairKey", (q: any) => q.eq("dmPairKey", pairKey))
      .unique();

    return {
      status: "ok" as const,
      chatroomId: chatroom?._id ?? null,
      userId,
    };
  },
});

// ============================================
// GET DM CHATROOM (for lastReadBy / seen status)
// ============================================
export const getChatroom = query({
  args: { chatroomId: v.id("chatrooms") },
  handler: async (ctx, args) => {
    const userId = await getStrictAuthenticatedUserId(ctx);
    const chatroom = await ctx.db.get(args.chatroomId);
    if (!chatroom || chatroom.type !== "dm") return null;
    if (!chatroom.participantUids.includes(String(userId))) return null;
    return chatroom;
  },
});

// ============================================
// LIST DM MESSAGES
// ============================================
export const listMessages = query({
  args: {
    chatroomId: v.id("chatrooms"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getStrictAuthenticatedUserId(ctx);
    const chatroom = await ctx.db.get(args.chatroomId);
    if (!chatroom || chatroom.type !== "dm") return [];
    if (!chatroom.participantUids.includes(String(userId))) return [];

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

// ============================================
// SEND DM MESSAGE
// ============================================
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
    const userId = await getStrictAuthenticatedUserId(ctx);
    const chatroom = await ctx.db.get(args.chatroomId);
    if (!chatroom || chatroom.type !== "dm") throw new Error("DM chatroom not found");
    if (!chatroom.participantUids.includes(String(userId))) {
      throw new Error("You are not a participant of this chat");
    }

    const sender = await ctx.db.get(userId);
    if (!sender) throw new Error("User profile not found");

    const now = Date.now();
    await markUserPresent(ctx, userId, now);

    const messageType = args.type || "text";
    const trimmedContent = args.content.trim();

    if (messageType === "text" && !trimmedContent) throw new Error("Message cannot be empty");
    if (messageType === "voice" && !args.audioStorageId) throw new Error("Voice message is missing audio");
    if ((messageType === "image" || messageType === "file") && !args.attachment) {
      throw new Error("Attachment message is missing attachment data");
    }

    const senderName = sender.fullName || sender.username || "Player";
    const previewText =
      messageType === "voice" ? "Voice message"
        : messageType === "image" ? "Photo"
          : messageType === "file" ? (args.attachment?.fileName || "File")
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

    // Push notification to the other participant
    const recipientIds = chatroom.participantUids
      .filter((uid: string) => String(uid) !== String(userId))
      .map((uid: string) => uid as Id<"users">);
    if (recipientIds.length > 0) {
      await ctx.scheduler.runAfter(0, (internal as any).pushNotificationsActions.sendChatPush, {
        senderName,
        messagePreview: previewText.slice(0, 100),
        recipientUserIds: recipientIds,
        chatKey: String(args.chatroomId),
      });
    }

    return messageId;
  },
});

// ============================================
// MARK READ
// ============================================
export const markRead = mutation({
  args: { chatroomId: v.id("chatrooms") },
  handler: async (ctx, args) => {
    const userId = await getStrictAuthenticatedUserId(ctx);
    const chatroom = await ctx.db.get(args.chatroomId);
    if (!chatroom || chatroom.type !== "dm") return;
    if (!chatroom.participantUids.includes(String(userId))) return;

    const now = Date.now();
    const lastReadBy = { ...((chatroom.lastReadBy as Record<string, number>) || {}), [String(userId)]: now };
    await ctx.db.patch(args.chatroomId, { lastReadBy, updatedAt: now });

    const member = await ctx.db
      .query("chatroomMembers")
      .withIndex("by_chatroomId_and_userId", (q: any) =>
        q.eq("chatroomId", args.chatroomId).eq("userId", String(userId))
      )
      .unique();
    if (member) {
      await ctx.db.patch(member._id, { unreadCount: 0, lastReadAt: now, updatedAt: now });
    }
  },
});

// ============================================
// LIST ALL DM CONVERSATIONS FOR USER
// ============================================
export const listForUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getStrictAuthenticatedUserId(ctx);

    const memberships = await ctx.db
      .query("chatroomMembers")
      .withIndex("by_userId", (q) => q.eq("userId", String(userId)))
      .collect();

    const results: any[] = [];
    for (const membership of memberships) {
      const chatroom = await ctx.db.get(membership.chatroomId);
      if (!chatroom || chatroom.type !== "dm") continue;

      // Get the other participant
      const otherUid = chatroom.participantUids.find(
        (uid: string) => String(uid) !== String(userId)
      );
      const otherUser = otherUid ? await ctx.db.get(otherUid as Id<"users">) : null;
      const friendName = otherUser?.fullName || otherUser?.username || "Friend";
      const friendPhotoURL = otherUser?.photoURL || null;

      results.push({
        id: chatroom._id,
        kind: "dm" as const,
        friendId: otherUid,
        title: friendName,
        subtitle: "Direct message",
        photoURL: friendPhotoURL,
        participantUids: chatroom.participantUids,
        lastMessage: chatroom.lastMessage || null,
        updatedAt: chatroom.updatedAt || chatroom.createdAt,
        unreadCount: Number(membership.unreadCount || 0),
      });
    }

    return results;
  },
});

// ============================================
// GET UNREAD COUNTS PER FRIEND (for friends list badges)
// ============================================
export const getUnreadCounts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getStrictAuthenticatedUserId(ctx);

    const memberships = await ctx.db
      .query("chatroomMembers")
      .withIndex("by_userId", (q) => q.eq("userId", String(userId)))
      .collect();

    const result: Record<string, number> = {};
    for (const membership of memberships) {
      if (!membership.unreadCount || membership.unreadCount <= 0) continue;
      const chatroom = await ctx.db.get(membership.chatroomId);
      if (!chatroom || chatroom.type !== "dm") continue;

      const friendUid = chatroom.participantUids.find(
        (uid: string) => String(uid) !== String(userId)
      );
      if (friendUid) {
        result[friendUid] = Number(membership.unreadCount);
      }
    }
    return result;
  },
});

// ============================================
// GENERATE UPLOAD URL FOR DM ATTACHMENTS
// ============================================
export const generateUploadUrl = mutation({
  args: { chatroomId: v.id("chatrooms") },
  handler: async (ctx, args) => {
    const userId = await getStrictAuthenticatedUserId(ctx);
    const chatroom = await ctx.db.get(args.chatroomId);
    if (!chatroom || chatroom.type !== "dm") throw new Error("DM chatroom not found");
    if (!chatroom.participantUids.includes(String(userId))) {
      throw new Error("You are not a participant of this chat");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

// ============================================
// DELETE FOR ME (soft delete)
// ============================================
export const deleteForMe = mutation({
  args: { messageId: v.id("chatMessages") },
  handler: async (ctx, args) => {
    const userId = await getStrictAuthenticatedUserId(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");

    const chatroom = await ctx.db.get(message.chatroomId);
    if (!chatroom || chatroom.type !== "dm") throw new Error("DM chatroom not found");
    if (!chatroom.participantUids.includes(String(userId))) {
      throw new Error("You are not a participant of this chat");
    }

    const deletedFor = message.deletedFor || [];
    if (!deletedFor.includes(String(userId))) {
      await ctx.db.patch(args.messageId, {
        deletedFor: [...deletedFor, String(userId)],
      });
    }
    return true;
  },
});

// ============================================
// TOGGLE REACTION
// ============================================
export const toggleReaction = mutation({
  args: {
    messageId: v.id("chatMessages"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getStrictAuthenticatedUserId(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");

    const chatroom = await ctx.db.get(message.chatroomId);
    if (!chatroom || chatroom.type !== "dm") throw new Error("DM chatroom not found");
    if (!chatroom.participantUids.includes(String(userId))) {
      throw new Error("You are not a participant of this chat");
    }

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

// ============================================
// EDIT MESSAGE
// ============================================
export const editMessage = mutation({
  args: {
    messageId: v.id("chatMessages"),
    newContent: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getStrictAuthenticatedUserId(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");

    const chatroom = await ctx.db.get(message.chatroomId);
    if (!chatroom || chatroom.type !== "dm") throw new Error("DM chatroom not found");
    if (!chatroom.participantUids.includes(String(userId))) {
      throw new Error("You are not a participant of this chat");
    }

    if (String(message.senderUid) !== String(userId)) {
      throw new Error("You can only edit your own messages");
    }
    if ((message.type as string) === "voice") {
      throw new Error("Voice messages cannot be edited");
    }

    const now = Date.now();
    const FIFTEEN_MINUTES = 15 * 60 * 1000;
    if (now - message.createdAt > FIFTEEN_MINUTES) {
      throw new Error("Messages can only be edited within 15 minutes");
    }

    const trimmed = args.newContent.trim();
    if (!trimmed) throw new Error("Edited message cannot be empty");

    await ctx.db.patch(args.messageId, { content: trimmed, editedAt: now });
    return true;
  },
});
