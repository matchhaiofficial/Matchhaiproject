import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { Id } from "./_generated/dataModel";

async function getAuthenticatedProfile(ctx: any) {
  const authUser = await authComponent.getAuthUser(ctx);
  const authId = String(authUser?.userId || "");
  if (!authId) throw new Error("Not authenticated");

  const profile = await ctx.db
    .query("users")
    .withIndex("by_authId", (q: any) => q.eq("authId", authId))
    .unique();

  if (!profile) throw new Error("User profile not found");
  return profile;
}

async function getOptionalAuthenticatedProfile(ctx: any) {
  let authUser: any = null;
  try {
    authUser = await authComponent.getAuthUser(ctx);
  } catch {
    return null;
  }
  const authId = String(authUser?.userId || "");
  if (!authId) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_authId", (q: any) => q.eq("authId", authId))
    .unique();
}

function supportRoleForUser(user: any) {
  if (user?.role === "super-admin") return "super_admin";
  if (user?.accountType === "zone") return "zone_admin";
  if (user?.accountType === "player") return "player";
  return "unknown";
}

function safeUser(user: any) {
  return {
    id: String(user._id),
    role: supportRoleForUser(user),
    accountType: user.accountType,
    displayName: user.fullName || user.username || "MatchHai user",
    username: user.username,
    onboardingCompleted: Boolean(user.onboardingCompleted),
    onboardingStep: user.onboardingStep,
    isVerified: Boolean(user.isVerified),
    city: user.city,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function safePayment(txn: any) {
  return {
    id: String(txn._id),
    kind: txn.kind,
    status: txn.status,
    amount: txn.amount,
    currency: txn.currency,
    orderRefNum: txn.orderRefNum,
    providerStatus: txn.providerStatus,
    providerDescription: txn.providerDescription,
    providerReference: txn.providerReference,
    bookingIntentId: txn.bookingIntentId ? String(txn.bookingIntentId) : undefined,
    createdAt: txn.createdAt,
    updatedAt: txn.updatedAt,
  };
}

function safeWalletTransaction(txn: any) {
  return {
    id: String(txn._id),
    type: txn.type,
    status: txn.status,
    amount: txn.amount,
    reference: txn.reference,
    createdAt: txn.createdAt,
  };
}

function safeMatchroom(room: any, userId: Id<"users">) {
  const userIdString = String(userId);
  const userPlayer = Array.isArray(room.players)
    ? room.players.find((player: any) => String(player.uid) === userIdString)
    : null;

  return {
    id: String(room._id),
    title: room.title,
    game: room.game,
    status: room.status,
    scheduledDate: room.scheduledDate,
    scheduledTime: room.scheduledTime,
    scheduledStartAt: room.scheduledStartAt,
    paymentStatus: room.paymentStatus,
    paymentAmount: room.paymentAmount,
    currentPlayers: room.currentPlayers,
    maxPlayers: room.maxPlayers,
    isHost: String(room.hostUid) === userIdString,
    userRole: userPlayer?.role,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };
}

function safeBookingIntent(intent: any, matchroom: any | null) {
  return {
    id: String(intent._id),
    matchroomId: String(intent.matchroomId),
    matchroomTitle: matchroom?.title,
    game: intent.game || matchroom?.game,
    status: intent.status,
    paymentStatus: intent.paymentStatus,
    side: intent.side,
    selectedSlots: intent.selectedSlots,
    pricing: intent.pricing,
    createdAt: intent.createdAt,
    updatedAt: intent.updatedAt,
  };
}

function safeZone(zone: any) {
  return {
    id: String(zone._id),
    name: zone.venueBrandName || zone.name,
    status: zone.status,
    onboardingStep: zone.onboardingStep,
    city: zone.city,
    branchCount: Array.isArray(zone.branches) ? zone.branches.length : undefined,
    primaryBranch: zone.primaryBranch
      ? {
          branchDisplayName: zone.primaryBranch.branchDisplayName,
          city: zone.primaryBranch.city,
          areaLabel: zone.primaryBranch.areaLabel,
        }
      : undefined,
    createdAt: zone.createdAt,
    updatedAt: zone.updatedAt,
  };
}

function safeReport(report: any) {
  return {
    id: String(report._id),
    type: report.type,
    status: report.status,
    game: report.game,
    matchroomId: report.matchroomId ? String(report.matchroomId) : undefined,
    zoneId: report.zoneId ? String(report.zoneId) : undefined,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  };
}

function redactTicketText(input: string) {
  return String(input || "")
    .replace(/\b(?:otp|pin|password|token|secret)\s*[:=]?\s*[A-Z0-9@#$%^&*._-]{3,}\b/gi, "[redacted-secret]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/(?:\+?92|0)?3[0-9][\s-]?[0-9]{3}[\s-]?[0-9]{4}\b/g, "[redacted-phone]")
    .replace(/\b\d{5}[-\s]?\d{7}[-\s]?\d\b/g, "[redacted-cnic]")
    .replace(/\b(?:EP|TXN|TRX|PAY|ORD|REF)[-_]?[A-Z0-9-]{6,}\b/gi, "[redacted-reference]")
    .replace(/\b[A-F0-9]{12,}\b/gi, "[redacted-id]")
    .slice(0, 1200);
}

export const getRecentUserPayments = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await getOptionalAuthenticatedProfile(ctx);
    if (!user) {
      return {
        paymentTransactions: [],
        walletTransactions: [],
      };
    }
    const limit = Math.min(args.limit || 5, 10);

    const [paymentTransactions, walletTransactions] = await Promise.all([
      ctx.db
        .query("paymentTransactions")
        .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
        .order("desc")
        .take(limit),
      ctx.db
        .query("walletTransactions")
        .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
        .order("desc")
        .take(limit),
    ]);

    return {
      paymentTransactions: paymentTransactions.map(safePayment),
      walletTransactions: walletTransactions.map(safeWalletTransaction),
    };
  },
});

export const getRecentUserMatchrooms = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await getOptionalAuthenticatedProfile(ctx);
    if (!user) {
      return {
        matchrooms: [],
        bookingIntents: [],
      };
    }
    const limit = Math.min(args.limit || 5, 10);
    const userIdString = String(user._id);

    const recentRooms = await ctx.db
      .query("matchrooms")
      .withIndex("by_createdAt")
      .order("desc")
      .take(50);

    const matchrooms = recentRooms
      .filter((room: any) =>
        String(room.hostUid) === userIdString ||
        (Array.isArray(room.playerUids) && room.playerUids.map(String).includes(userIdString))
      )
      .slice(0, limit)
      .map((room: any) => safeMatchroom(room, user._id));

    const intents = await ctx.db
      .query("bookingIntents")
      .withIndex("by_createdByUid", (q: any) => q.eq("createdByUid", user._id))
      .order("desc")
      .take(limit);

    const bookingIntents = await Promise.all(
      intents.map(async (intent: any) => {
        const matchroom = await ctx.db.get(intent.matchroomId);
        return safeBookingIntent(intent, matchroom);
      }),
    );

    return { matchrooms, bookingIntents };
  },
});

export const getMySupportContext = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalAuthenticatedProfile(ctx);
    if (!user) {
      return null;
    }

    const [zones, recentPayments, recentMatchrooms, recentReports] = await Promise.all([
      ctx.db
        .query("zones")
        .withIndex("by_ownerUid", (q: any) => q.eq("ownerUid", user._id))
        .order("desc")
        .take(3),
      ctx.db
        .query("paymentTransactions")
        .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
        .order("desc")
        .take(5),
      ctx.db
        .query("matchrooms")
        .withIndex("by_createdAt")
        .order("desc")
        .take(50),
      ctx.db
        .query("reports")
        .withIndex("by_reporterUid", (q: any) => q.eq("reporterUid", user._id))
        .order("desc")
        .take(5),
    ]);

    const userIdString = String(user._id);
    const matchrooms = recentMatchrooms
      .filter((room: any) =>
        String(room.hostUid) === userIdString ||
        (Array.isArray(room.playerUids) && room.playerUids.map(String).includes(userIdString))
      )
      .slice(0, 5)
      .map((room: any) => safeMatchroom(room, user._id));

    return {
      user: safeUser(user),
      zones: zones.map(safeZone),
      recentPayments: recentPayments.map(safePayment),
      recentMatchrooms: matchrooms,
      recentReports: recentReports.map(safeReport),
    };
  },
});

export const createSupportTicket = mutation({
  args: {
    userRole: v.optional(v.string()),
    category: v.optional(v.string()),
    issueSummary: v.string(),
    conversationExcerpt: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        text: v.string(),
      })
    ),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedProfile(ctx);
    const now = Date.now();
    const reference = `MH-SUP-${now.toString(36).toUpperCase().slice(-6)}`;

    const ticketId = await ctx.db.insert("supportTickets", {
      reference,
      userId: user._id,
      userRole: args.userRole || supportRoleForUser(user),
      category: args.category,
      issueSummary: redactTicketText(args.issueSummary).slice(0, 500) || "MatchHai support request",
      conversationExcerpt: args.conversationExcerpt.slice(-10).map((message) => ({
        role: message.role,
        text: redactTicketText(message.text),
      })),
      metadata: args.metadata,
      status: "open",
      source: "help_support_chat",
      createdAt: now,
      updatedAt: now,
    });

    return {
      ticketId,
      reference,
      status: "open" as const,
      emailSent: false,
    };
  },
});
