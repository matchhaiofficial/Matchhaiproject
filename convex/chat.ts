import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ============================================
// CHATROOM QUERIES
// ============================================

// Get chatroom by matchroom
export const getByMatchroom = query({
  args: { matchroomId: v.id("matchrooms") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chatrooms")
      .withIndex("by_matchroomId", (q) => q.eq("matchroomId", args.matchroomId))
      .unique();
  },
});

// Get or create chatroom for matchroom
export const getOrCreateForMatchroom = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    participantUids: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if chatroom exists
    const existing = await ctx.db
      .query("chatrooms")
      .withIndex("by_matchroomId", (q) => q.eq("matchroomId", args.matchroomId))
      .unique();

    if (existing) {
      // Update participants if needed
      const existingSet = new Set(existing.participantUids);
      const newParticipants = args.participantUids.filter(
        (uid) => !existingSet.has(uid)
      );

      if (newParticipants.length > 0) {
        await ctx.db.patch(existing._id, {
          participantUids: [...existing.participantUids, ...newParticipants],
        });
      }

      return existing._id;
    }

    // Create new chatroom
    const chatroomId = await ctx.db.insert("chatrooms", {
      matchroomId: args.matchroomId,
      participantUids: args.participantUids,
      createdAt: Date.now(),
    });

    return chatroomId;
  },
});

// ============================================
// MESSAGE QUERIES
// ============================================

// List messages for chatroom
export const listMessages = query({
  args: {
    chatroomId: v.id("chatrooms"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_chatroomId_and_createdAt", (q) =>
        q.eq("chatroomId", args.chatroomId)
      )
      .order("desc")
      .take(args.limit || 100);
  },
});

// List messages for matchroom (convenience)
export const listMessagesForMatchroom = query({
  args: {
    matchroomId: v.id("matchrooms"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const chatroom = await ctx.db
      .query("chatrooms")
      .withIndex("by_matchroomId", (q) => q.eq("matchroomId", args.matchroomId))
      .unique();

    if (!chatroom) return [];

    return await ctx.db
      .query("chatMessages")
      .withIndex("by_chatroomId_and_createdAt", (q) =>
        q.eq("chatroomId", chatroom._id)
      )
      .order("desc")
      .take(args.limit || 100);
  },
});

// ============================================
// MESSAGE MUTATIONS
// ============================================

// Send message
export const sendMessage = mutation({
  args: {
    chatroomId: v.id("chatrooms"),
    senderUid: v.id("users"),
    senderUsername: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const chatroom = await ctx.db.get(args.chatroomId);
    if (!chatroom) throw new Error("Chatroom not found");

    // Check if sender is a participant
    if (!chatroom.participantUids.includes(args.senderUid)) {
      throw new Error("You are not a participant in this chat");
    }

    const messageId = await ctx.db.insert("chatMessages", {
      chatroomId: args.chatroomId,
      senderUid: args.senderUid,
      senderUsername: args.senderUsername,
      content: args.content,
      createdAt: Date.now(),
    });

    return messageId;
  },
});

// Send message to matchroom (convenience - auto-creates chatroom if needed)
export const sendMessageToMatchroom = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    senderUid: v.id("users"),
    senderUsername: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Get or create chatroom
    let chatroom = await ctx.db
      .query("chatrooms")
      .withIndex("by_matchroomId", (q) => q.eq("matchroomId", args.matchroomId))
      .unique();

    if (!chatroom) {
      // Get matchroom to get participants
      const matchroom = await ctx.db.get(args.matchroomId);
      if (!matchroom) throw new Error("Matchroom not found");

      const chatroomId = await ctx.db.insert("chatrooms", {
        matchroomId: args.matchroomId,
        participantUids: matchroom.playerUids,
        createdAt: Date.now(),
      });

      chatroom = await ctx.db.get(chatroomId);
    }

    if (!chatroom) throw new Error("Failed to create chatroom");

    // Add sender to participants if not already
    if (!chatroom.participantUids.includes(args.senderUid)) {
      await ctx.db.patch(chatroom._id, {
        participantUids: [...chatroom.participantUids, args.senderUid],
      });
    }

    const messageId = await ctx.db.insert("chatMessages", {
      chatroomId: chatroom._id,
      senderUid: args.senderUid,
      senderUsername: args.senderUsername,
      content: args.content,
      createdAt: Date.now(),
    });

    return messageId;
  },
});

// Delete message
export const deleteMessage = mutation({
  args: { messageId: v.id("chatMessages") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.messageId);
    return true;
  },
});
