import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ============================================
// QUERIES
// ============================================

// Check if a challenge chat exists
export const getChat = query({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    const chats = await ctx.db
      .query("teamChallengeChats")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .take(1);
    return chats[0] ?? null;
  },
});

// List messages for a challenge chat (real-time via useQuery)
export const listMessages = query({
  args: {
    chatId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("teamChallengeChatMessages")
      .withIndex("by_chatId_and_createdAt", (q) => q.eq("chatId", args.chatId))
      .order("asc")
      .take(args.limit || 200);
  },
});

// ============================================
// MUTATIONS
// ============================================

// Send a message in a challenge chat
export const sendMessage = mutation({
  args: {
    chatId: v.string(),
    senderUid: v.string(),
    senderName: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Insert the message
    const messageId = await ctx.db.insert("teamChallengeChatMessages", {
      chatId: args.chatId,
      senderUid: args.senderUid,
      senderName: args.senderName,
      text: args.text,
      createdAt: now,
    });

    // Upsert the chat metadata
    const existingChats = await ctx.db
      .query("teamChallengeChats")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .take(1);

    if (existingChats.length > 0) {
      await ctx.db.patch(existingChats[0]._id, {
        updatedAt: now,
        lastMessage: {
          text: args.text,
          senderUid: args.senderUid,
        },
      });
    } else {
      await ctx.db.insert("teamChallengeChats", {
        chatId: args.chatId,
        lastMessage: {
          text: args.text,
          senderUid: args.senderUid,
        },
        updatedAt: now,
        createdAt: now,
      });
    }

    return messageId;
  },
});
