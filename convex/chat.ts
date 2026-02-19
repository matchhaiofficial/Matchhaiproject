import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";

const ensureParticipant = (chatroom: any, uid: string) => {
  const participants = Array.isArray(chatroom.participantUids) ? chatroom.participantUids : [];
  if (participants.length === 0) return;
  if (!participants.includes(uid)) {
    throw new ConvexError("Not authorized for this chat.");
  }
};

export const createChatroom = mutation({
  args: {
    matchroomId: v.optional(v.string()),
    zoneId: v.optional(v.string()),
    participantUids: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);

    if (args.matchroomId) {
      const existing = await ctx.db
        .query("chatrooms")
        .withIndex("by_matchroomId", (q: any) => q.eq("matchroomId", args.matchroomId))
        .unique();
      if (existing) return { ok: true, chatroomId: existing._id };
    }

    const now = Date.now();
    const participants = Array.isArray(args.participantUids) && args.participantUids.length
      ? Array.from(new Set(args.participantUids))
      : [user.uid];

    const chatroomId = await ctx.db.insert("chatrooms", {
      matchroomId: args.matchroomId ?? undefined,
      zoneId: args.zoneId ?? undefined,
      participantUids: participants,
      createdAt: now,
      updatedAt: now,
    });

    return { ok: true, chatroomId };
  },
});

export const getChatroomByMatchroom = query({
  args: { matchroomId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chatrooms")
      .withIndex("by_matchroomId", (q: any) => q.eq("matchroomId", args.matchroomId))
      .unique();
  },
});

export const postMessage = mutation({
  args: {
    chatroomId: v.id("chatrooms"),
    text: v.string(),
    replyTo: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const chatroom = await ctx.db.get(args.chatroomId);
    if (!chatroom) throw new ConvexError("Chatroom not found.");
    ensureParticipant(chatroom, user.uid);

    const now = Date.now();
    const messageId = await ctx.db.insert("chatMessages", {
      chatroomId: chatroom._id,
      text: args.text,
      senderUid: user.uid,
      senderName: user.username ?? user.displayName ?? "Player",
      createdAt: now,
      replyTo: args.replyTo ?? undefined,
    });

    await ctx.db.patch(chatroom._id, {
      lastMessage: {
        id: messageId,
        text: args.text,
        senderUid: user.uid,
        senderName: user.username ?? user.displayName ?? "Player",
        createdAt: now,
      },
      updatedAt: now,
    });

    return { ok: true, messageId };
  },
});

export const listMessages = query({
  args: {
    chatroomId: v.id("chatrooms"),
    limit: v.optional(v.number()),
    cursorCreatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const chatroom = await ctx.db.get(args.chatroomId);
    if (!chatroom) throw new ConvexError("Chatroom not found.");
    ensureParticipant(chatroom, user.uid);

    const limit = Math.min(Math.max(args.limit ?? 30, 1), 100);
    let q = ctx.db
      .query("chatMessages")
      .withIndex("by_chatroomId_createdAt", (q: any) => q.eq("chatroomId", chatroom._id))
      .order("desc");

    if (args.cursorCreatedAt) {
      q = q.filter((q: any) => q.lt(q.field("createdAt"), args.cursorCreatedAt!));
    }

    const rawItems = await q.take(limit * 2);
    const filtered = rawItems.filter((item: any) => {
      const deletedFor = Array.isArray(item.deletedFor) ? item.deletedFor : [];
      return !deletedFor.includes(user.uid);
    });

    const items = filtered.slice(0, limit).reverse();
    const nextCursor = items.length ? items[0].createdAt : null;

    return { items, nextCursor };
  },
});

export const markChatSeen = mutation({
  args: { chatroomId: v.id("chatrooms") },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const chatroom = await ctx.db.get(args.chatroomId);
    if (!chatroom) throw new ConvexError("Chatroom not found.");
    ensureParticipant(chatroom, user.uid);

    const lastReadBy = { ...(chatroom.lastReadBy || {}) };
    lastReadBy[user.uid] = Date.now();
    await ctx.db.patch(chatroom._id, { lastReadBy, updatedAt: Date.now() });
    return { ok: true };
  },
});

export const deleteMessageForMe = mutation({
  args: { messageId: v.id("chatMessages") },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new ConvexError("Message not found.");
    const deletedFor = new Set(Array.isArray(message.deletedFor) ? message.deletedFor : []);
    deletedFor.add(user.uid);
    await ctx.db.patch(args.messageId, { deletedFor: Array.from(deletedFor) });
    return { ok: true };
  },
});
