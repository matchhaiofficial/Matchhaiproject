import { v } from "convex/values";

import { httpAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

const SUPPORT_AGENT_TOKEN_TTL_MS = 5 * 60 * 1000;
const SUPPORT_AGENT_MAX_MESSAGE_CHARS = 2000;
const SUPPORT_AGENT_MAX_RECENT_MESSAGES = 12;
const SUPPORT_AGENT_MAX_TICKETS_PER_DAY = 3;
const SUPPORT_AGENT_RATE_WINDOW_MS = 5 * 60 * 1000;
const SUPPORT_AGENT_RATE_LIMIT_PER_USER = 10;
const SUPPORT_AGENT_RATE_LIMIT_PER_CONVERSATION = 4;
const SUPPORT_SERVER_DEBUG = String(process.env.SUPPORT_DEBUG || "") === "1";

type SupportModule = "player" | "zone_admin" | "super_admin";
type SupportPriority = "low" | "medium" | "high" | "urgent";
type AgentActionStatus = "executed" | "denied" | "failed" | "rate_limited";

const safeContextText = (value: unknown) => redactSupportText(String(value || "")).slice(0, 1200);

function supportDebug(event: string, data: Record<string, unknown> = {}) {
  if (!SUPPORT_SERVER_DEBUG) return;
  console.log("[SupportAgent]", event, data);
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function signSupportPayload(payloadBase64: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadBase64));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function createSignedSupportToken(payload: Record<string, unknown>, secret: string) {
  const payloadBase64 = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await signSupportPayload(payloadBase64, secret);
  return `${payloadBase64}.${signature}`;
}

async function verifySignedSupportToken(token: string, secret: string) {
  const [payloadBase64, signature] = String(token || "").split(".");
  if (!payloadBase64 || !signature) throw new Error("Invalid support token");
  const expected = await signSupportPayload(payloadBase64, secret);
  if (expected !== signature) throw new Error("Invalid support token");
  const payloadText = new TextDecoder().decode(base64UrlToBytes(payloadBase64));
  const payload = JSON.parse(payloadText);
  if (!payload?.expMs || Number(payload.expMs) <= Date.now()) throw new Error("Expired support token");
  return payload;
}

function getSupportSecret() {
  const secret = String(process.env.SUPPORT_AI_SHARED_SECRET || "").trim();
  if (!secret) throw new Error("Support AI shared secret is not configured");
  return secret;
}

function normalizeSupportModule(value: string): SupportModule {
  if (value === "zone_admin" || value === "super_admin") return value;
  return "player";
}

function normalizePriority(value: unknown): SupportPriority {
  if (value === "urgent" || value === "high" || value === "low") return value;
  return "medium";
}

function maskReference(value?: string | null) {
  const text = String(value || "").trim();
  if (!text) return undefined;
  if (text.length <= 6) return text;
  return `${text.slice(0, 3)}...${text.slice(-4)}`;
}

async function getAuthenticatedProfile(ctx: any) {
  const profile = await getOptionalAuthenticatedProfile(ctx);
  if (!profile) throw new Error("Not authenticated");
  return profile;
}

async function getOptionalAuthenticatedProfile(ctx: any) {
  const candidateAuthIds: string[] = [];
  let componentAuthAvailable = false;
  let convexIdentityAvailable = false;

  try {
    const authUser = await authComponent.getAuthUser(ctx);
    const authId = String(authUser?.userId || "").trim();
    if (authId) {
      componentAuthAvailable = true;
      candidateAuthIds.push(authId);
    }
  } catch {
    componentAuthAvailable = false;
  }

  try {
    const identity = await ctx.auth.getUserIdentity();
    const subject = String(identity?.subject || "").trim();
    const tokenIdentifier = String(identity?.tokenIdentifier || "").trim();
    if (subject) {
      convexIdentityAvailable = true;
      candidateAuthIds.push(subject);
    }
    if (tokenIdentifier && tokenIdentifier !== subject) {
      convexIdentityAvailable = true;
      candidateAuthIds.push(tokenIdentifier);
    }
  } catch {
    convexIdentityAvailable = false;
  }

  const uniqueAuthIds = [...new Set(candidateAuthIds.filter(Boolean))];
  supportDebug("profile_auth_lookup", {
    componentAuthAvailable,
    convexIdentityAvailable,
    candidateCount: uniqueAuthIds.length,
  });

  for (const authId of uniqueAuthIds) {
    const profile = await ctx.db
      .query("users")
      .withIndex("by_authId", (q: any) => q.eq("authId", authId))
      .unique();
    if (profile) {
      supportDebug("profile_auth_lookup_success", {
        userId: String(profile._id),
        source: componentAuthAvailable ? "component_or_identity" : "convex_identity",
      });
      return profile;
    }
  }

  supportDebug("profile_auth_lookup_missing", {
    componentAuthAvailable,
    convexIdentityAvailable,
    candidateCount: uniqueAuthIds.length,
  });
  return null;
}

function supportRoleForUser(user: any) {
  if (user?.role === "super-admin") return "super_admin";
  if (user?.accountType === "zone") return "zone_admin";
  if (user?.accountType === "player") return "player";
  return "unknown";
}

function supportRecipientRole(value?: string | null): "player" | "zone_admin" {
  return value === "zone_admin" || value === "zone" ? "zone_admin" : "player";
}

function supportRouteForRecipientRole(role: "player" | "zone_admin") {
  return role === "zone_admin" ? "/zone/modules/ai-support" : "/(player)/support";
}

async function notifySupportTicketCreated(ctx: any, input: {
  ticketId: Id<"supportTickets">;
  ticketReference: string;
  userId: Id<"users">;
  userRole?: string;
  category?: string;
  priority?: string;
}) {
  const recipientRole = supportRecipientRole(input.userRole);
  const userRoute = supportRouteForRecipientRole(recipientRole);

  await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
    type: "support.ticket_created",
    toUid: input.userId,
    recipientRole,
    status: "pending",
    dedupeKey: `support.ticket_created:${String(input.ticketId)}`,
    dedupePolicy: "replace_active",
    pushPolicy: "none",
    route: userRoute,
    entity: { kind: "supportTicket", id: String(input.ticketId) },
    entityId: String(input.ticketId),
    title: "Support ticket created",
    body: `We received your ticket ${input.ticketReference}. A support agent will reply soon.`,
    data: {
      ticketId: String(input.ticketId),
      ticketReference: input.ticketReference,
      userId: String(input.userId),
      userRole: input.userRole || null,
      route: userRoute,
      href: userRoute,
    },
  });

  const superAdmins = await ctx.db
    .query("users")
    .withIndex("by_role", (q: any) => q.eq("role", "super-admin"))
    .take(50);

  for (const admin of superAdmins) {
    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "support.new_ticket",
      toUid: admin._id,
      recipientRole: "super_admin",
      status: "pending",
      dedupeKey: `support.new_ticket:${String(input.ticketId)}:${String(admin._id)}`,
      dedupePolicy: "replace_active",
      pushPolicy: "force",
      route: "/super-admin/support-tickets",
      entity: { kind: "supportTicket", id: String(input.ticketId) },
      entityId: String(input.ticketId),
      title: "New support ticket",
      body: `A new support ticket ${input.ticketReference} needs review.`,
      data: {
        ticketId: String(input.ticketId),
        ticketReference: input.ticketReference,
        userId: String(input.userId),
        userRole: input.userRole || null,
        category: input.category || null,
        priority: input.priority || null,
        route: "/super-admin/support-tickets",
        href: "/super-admin/support-tickets",
      },
    });
  }
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
    maskedReference: maskReference(txn.orderRefNum),
    providerStatus: txn.providerStatus,
    providerReference: maskReference(txn.providerReference),
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
    reference: maskReference(txn.reference),
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
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[redacted-card]")
    .replace(/\b(?:easypaisa|jazzcash|wallet)\s*[:=]?\s*(?:\+?92|0)?3[0-9][\s-]?[0-9]{3}[\s-]?[0-9]{4}\b/gi, "[redacted-wallet]")
    .replace(/\b\d{5}[-\s]?\d{7}[-\s]?\d\b/g, "[redacted-cnic]")
    .replace(/\b(?:EP|TXN|TRX|PAY|ORD|REF)[-_]?(?=[A-Z0-9-]*\d)[A-Z0-9-]{6,}\b/gi, "[redacted-reference]")
    .replace(/\b[A-F0-9]{12,}\b/gi, "[redacted-id]")
    .slice(0, 1200);
}

function redactSupportText(input: string) {
  return redactTicketText(input);
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

export const getAuthenticatedSupportIdentity = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedProfile(ctx);
    return {
      userId: user._id,
      role: supportRoleForUser(user),
    };
  },
});

export const issueWorkerToken = mutation({
  args: {
    module: v.union(v.literal("player"), v.literal("zone_admin"), v.literal("super_admin")),
    conversationId: v.optional(v.id("supportConversations")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedProfile(ctx);
    supportDebug("worker_token_issued", {
      userId: String(user._id),
      module: args.module,
      hasConversationId: Boolean(args.conversationId),
    });
    const now = Date.now();
    const expMs = now + SUPPORT_AGENT_TOKEN_TTL_MS;
    const token = await createSignedSupportToken(
      {
        v: 1,
        sub: String(user._id),
        userId: String(user._id),
        module: args.module,
        conversationId: args.conversationId ? String(args.conversationId) : null,
        iatMs: now,
        expMs,
        nonce: `${now}-${Math.random().toString(36).slice(2)}`,
      },
      getSupportSecret(),
    );
    return { token, expMs };
  },
});

export const getOrCreateConversation = mutation({
  args: {
    module: v.union(v.literal("player"), v.literal("zone_admin"), v.literal("super_admin")),
  },
  handler: async (ctx, args) => {
    supportDebug("conversation_get_or_create_started", { module: args.module });
    const user = await getOptionalAuthenticatedProfile(ctx);
    if (!user) {
      supportDebug("conversation_get_or_create_auth_required", { module: args.module });
      return {
        conversationId: null,
        conversation: null,
        messages: [],
        authRequired: true,
      };
    }
    const now = Date.now();
    const existing = await ctx.db
      .query("supportConversations")
      .withIndex("by_userId_status_updatedAt", (q: any) => q.eq("userId", user._id).eq("status", "open"))
      .order("desc")
      .take(5);

    const conversation = existing.find((item: any) => item.module === args.module);
    if (conversation) {
      supportDebug("conversation_get_or_create_existing", {
        userId: String(user._id),
        module: args.module,
        conversationId: String(conversation._id),
      });
      const messages = await ctx.db
        .query("supportMessages")
        .withIndex("by_conversationId_createdAt", (q: any) => q.eq("conversationId", conversation._id))
        .order("desc")
        .take(SUPPORT_AGENT_MAX_RECENT_MESSAGES);
      return {
        conversationId: conversation._id,
        conversation,
        messages: messages.reverse(),
      };
    }

    const conversationId = await ctx.db.insert("supportConversations", {
      userId: user._id,
      module: args.module,
      status: "open",
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
    });
    supportDebug("conversation_get_or_create_created", {
      userId: String(user._id),
      module: args.module,
      conversationId: String(conversationId),
    });

    return {
      conversationId,
      conversation: await ctx.db.get(conversationId),
      messages: [],
    };
  },
});

export const listConversationMessages = query({
  args: {
    conversationId: v.id("supportConversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getOptionalAuthenticatedProfile(ctx);
    if (!user) {
      return [];
    }
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || String(conversation.userId) !== String(user._id)) {
      throw new Error("Support conversation not found");
    }
    const limit = Math.max(1, Math.min(args.limit || SUPPORT_AGENT_MAX_RECENT_MESSAGES, 50));
    const messages = await ctx.db
      .query("supportMessages")
      .withIndex("by_conversationId_createdAt", (q: any) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .take(limit);
    return messages.reverse();
  },
});

export const appendUserMessage = mutation({
  args: {
    conversationId: v.id("supportConversations"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedProfile(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || String(conversation.userId) !== String(user._id)) {
      throw new Error("Support conversation not found");
    }
    const now = Date.now();
    const messageId = await ctx.db.insert("supportMessages", {
      conversationId: args.conversationId,
      role: "user",
      textRedacted: redactSupportText(args.text).slice(0, SUPPORT_AGENT_MAX_MESSAGE_CHARS),
      createdAt: now,
    });
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: now,
      updatedAt: now,
    });
    if (conversation.activeTicketId) {
      await ctx.db.patch(conversation.activeTicketId, {
        lastUserResponseAt: now,
        updatedAt: now,
      });
    }
    return messageId;
  },
});

export const appendAssistantMessage = mutation({
  args: {
    conversationId: v.id("supportConversations"),
    text: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedProfile(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || String(conversation.userId) !== String(user._id)) {
      throw new Error("Support conversation not found");
    }
    const now = Date.now();
    const messageId = await ctx.db.insert("supportMessages", {
      conversationId: args.conversationId,
      role: "assistant",
      textRedacted: redactSupportText(args.text).slice(0, SUPPORT_AGENT_MAX_MESSAGE_CHARS),
      metadata: args.metadata,
      createdAt: now,
    });
    await ctx.db.patch(args.conversationId, {
      summary: args.metadata?.summary ? safeContextText(args.metadata.summary).slice(0, 500) : conversation.summary,
      priority: args.metadata?.priority ? normalizePriority(args.metadata.priority) : conversation.priority,
      lastIntent: args.metadata?.intent ? String(args.metadata.intent).slice(0, 80) : conversation.lastIntent,
      lastMessageAt: now,
      updatedAt: now,
    });
    return messageId;
  },
});

async function insertAuditLog(ctx: any, input: {
  requestId: string;
  userId?: Id<"users">;
  conversationId?: Id<"supportConversations">;
  actionType: string;
  actionStatus: AgentActionStatus;
  reasonCategory?: string;
  ticketId?: Id<"supportTickets">;
  ticketReference?: string;
}) {
  await ctx.db.insert("supportAgentAuditLogs", {
    requestId: String(input.requestId || "unknown").slice(0, 80),
    userId: input.userId,
    conversationId: input.conversationId,
    actionType: String(input.actionType || "unknown").slice(0, 80),
    actionStatus: input.actionStatus,
    reasonCategory: input.reasonCategory ? String(input.reasonCategory).slice(0, 120) : undefined,
    ticketId: input.ticketId,
    ticketReference: input.ticketReference ? String(input.ticketReference).slice(0, 40) : undefined,
    timestamp: Date.now(),
  });
}

async function enforceAgentRateLimit(ctx: any, key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const existing = await ctx.db
    .query("supportAgentRateLimits")
    .withIndex("by_key", (q: any) => q.eq("key", key))
    .unique();
  if (!existing || now - Number(existing.windowStart || 0) >= windowMs) {
    if (existing) {
      await ctx.db.patch(existing._id, { windowStart: now, count: 1, updatedAt: now });
    } else {
      await ctx.db.insert("supportAgentRateLimits", { key, windowStart: now, count: 1, updatedAt: now });
    }
    return true;
  }
  if (existing.count >= limit) return false;
  await ctx.db.patch(existing._id, { count: existing.count + 1, updatedAt: now });
  return true;
}

function assertAgentIdentity(payload: any) {
  return {
    userId: payload.userId as Id<"users">,
    module: normalizeSupportModule(String(payload.module || "player")),
    conversationId: payload.conversationId ? payload.conversationId as Id<"supportConversations"> : undefined,
  };
}

async function getSafeContextForUser(ctx: any, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found");
  const userIdString = String(userId);
  const [zones, recentPayments, recentMatchrooms, recentReports] = await Promise.all([
    ctx.db.query("zones").withIndex("by_ownerUid", (q: any) => q.eq("ownerUid", userId)).order("desc").take(3),
    ctx.db.query("paymentTransactions").withIndex("by_userId", (q: any) => q.eq("userId", userId)).order("desc").take(5),
    ctx.db.query("matchrooms").withIndex("by_createdAt").order("desc").take(50),
    ctx.db.query("reports").withIndex("by_reporterUid", (q: any) => q.eq("reporterUid", userId)).order("desc").take(5),
  ]);
  const matchrooms = recentMatchrooms
    .filter((room: any) =>
      String(room.hostUid) === userIdString ||
      (Array.isArray(room.playerUids) && room.playerUids.map(String).includes(userIdString))
    )
    .slice(0, 5)
    .map((room: any) => safeMatchroom(room, userId));
  return {
    user: safeUser(user),
    zones: zones.map(safeZone),
    recentPayments: recentPayments.map(safePayment),
    recentMatchrooms: matchrooms,
    recentReports: recentReports.map(safeReport),
  };
}

function asId(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return null;
  return text as any;
}

function isUserInMatchroom(room: any, userId: Id<"users">) {
  const userIdString = String(userId);
  return (
    String(room?.hostUid || "") === userIdString ||
    String(room?.captainUidA || "") === userIdString ||
    String(room?.captainUidB || "") === userIdString ||
    (Array.isArray(room?.playerUids) && room.playerUids.map(String).includes(userIdString)) ||
    (Array.isArray(room?.players) && room.players.some((player: any) => String(player?.uid || "") === userIdString)) ||
    (Array.isArray(room?.slotsA) && room.slotsA.some((slot: any) => String(slot?.uid || slot?.user?.uid || "") === userIdString)) ||
    (Array.isArray(room?.slotsB) && room.slotsB.some((slot: any) => String(slot?.uid || slot?.user?.uid || "") === userIdString))
  );
}

function getUserRoleInRoom(room: any, userId: Id<"users">) {
  const userIdString = String(userId);
  if (String(room?.hostUid || "") === userIdString) return "host";
  if (String(room?.captainUidA || "") === userIdString || String(room?.captainUidB || "") === userIdString) return "captain";
  if (isUserInMatchroom(room, userId)) return "player";
  return "none";
}

function buildMatchroomNextSafeAction(room: any, intent?: any | null) {
  if (!room) return "Open Discover and refresh your matchrooms.";
  if (room.status === "cancelled" || room.status === "expired") return "Check Wallet history for any refund transaction, or create a support ticket if money is missing.";
  if (room.status === "completed") return "Check completed matchroom details and result status.";
  if (intent?.status === "approved_pending_payment" || intent?.paymentStatus === "unpaid") return "Complete payment from the matchroom request screen.";
  if (room.locationMode === "broadcast" && room.broadcastRequestStatus === "waiting_for_zones") return "Wait for an eligible zone to accept, or check again later.";
  if (room.status === "open") return "Wait for the room to fill or invite players.";
  return "Open the matchroom details screen for the latest status.";
}

async function getOwnedMatchroom(ctx: any, userId: Id<"users">, matchroomId?: unknown) {
  if (matchroomId) {
    const room = await ctx.db.get(asId(matchroomId));
    return room && isUserInMatchroom(room, userId) ? room : null;
  }
  const recent = await ctx.db.query("matchrooms").withIndex("by_createdAt").order("desc").take(80);
  return recent.find((room: any) => isUserInMatchroom(room, userId)) || null;
}

async function getMyMatchroomStatus(ctx: any, identity: ReturnType<typeof assertAgentIdentity>, payload: any) {
  const room = await getOwnedMatchroom(ctx, identity.userId, payload?.matchroomId);
  if (!room) return { found: false, reasonSummary: "No matching matchroom was found for this account.", nextSafeAction: "Ask for support ticket creation if this looks wrong." };
  const intent = await ctx.db
    .query("bookingIntents")
    .withIndex("by_createdByUid_matchroomId", (q: any) => q.eq("createdByUid", identity.userId).eq("matchroomId", room._id))
    .order("desc")
    .first();
  const joinedPlayers = Math.max(
    Number(room.currentPlayers || 0),
    Array.isArray(room.playerUids) ? room.playerUids.length : 0,
  );
  return {
    found: true,
    matchroomId: String(room._id),
    game: room.game,
    status: room.status,
    requiredPlayers: room.maxPlayers,
    joinedPlayers,
    userRoleInRoom: getUserRoleInRoom(room, identity.userId),
    captainApprovalStatus: intent?.captainApproval ? (intent.captainApproval.approved ? "approved" : "pending") : null,
    zoneApprovalStatus: room.zoneAdminApproved === true || intent?.zoneApproval?.approved ? "approved" : room.locationMode === "zone" || room.locationMode === "broadcast" ? "pending" : null,
    bookingIntentStatus: intent?.status || null,
    paymentStatus: intent?.paymentStatus || room.paymentStatus || "unpaid",
    expiresAt: intent?.expiresAt || room.expiresAt || room.broadcastRequestExpiresAt || null,
    nextSafeAction: buildMatchroomNextSafeAction(room, intent),
    reasonSummary: room.cancelReason || room.cancelNote || room.broadcastRequestStatus || room.status,
  };
}

async function getMyPaymentBookingStatus(ctx: any, identity: ReturnType<typeof assertAgentIdentity>, payload: any) {
  const recentPayments = await ctx.db
    .query("paymentTransactions")
    .withIndex("by_userId", (q: any) => q.eq("userId", identity.userId))
    .order("desc")
    .take(20);
  const reference = String(payload?.providerReference || payload?.reference || "").trim();
  const payment = payload?.paymentId
    ? recentPayments.find((row: any) => String(row._id) === String(payload.paymentId))
    : reference
      ? recentPayments.find((row: any) => row.orderRefNum === reference || row.providerReference === reference)
      : recentPayments[0];
  let bookingIntent = payment?.bookingIntentId ? await ctx.db.get(payment.bookingIntentId) : null;
  if (!bookingIntent && payload?.bookingId) {
    const candidate = await ctx.db.get(asId(payload.bookingId));
    if (candidate && String(candidate.createdByUid) === String(identity.userId)) bookingIntent = candidate;
  }
  const matchroom = bookingIntent?.matchroomId ? await ctx.db.get(bookingIntent.matchroomId) : null;
  const refund = payment
    ? await ctx.db
        .query("walletTransactions")
        .withIndex("by_userId", (q: any) => q.eq("userId", identity.userId))
        .order("desc")
        .take(20)
    : [];
  const linkedRefund = Array.isArray(refund)
    ? refund.find((row: any) => row.type === "refund" && String(row.reference || "").includes(String(payment?._id || payment?.orderRefNum || "")))
    : null;
  return {
    found: Boolean(payment || bookingIntent),
    paymentStatus: payment?.status || bookingIntent?.paymentStatus || null,
    amount: payment?.amount || bookingIntent?.pricing?.totalCost || null,
    currency: payment?.currency || bookingIntent?.pricing?.currency || "PKR",
    createdAt: payment?.createdAt || bookingIntent?.createdAt || null,
    bookingStatus: bookingIntent?.status || null,
    matchroomStatus: matchroom?.status || null,
    refundStatus: linkedRefund?.status || matchroom?.refundStatus || null,
    providerReferenceMasked: maskReference(payment?.providerReference || payment?.orderRefNum),
    nextSafeAction: payment?.status === "paid" || bookingIntent?.paymentStatus === "paid"
      ? "Open the related matchroom or booking details. If it still looks unpaid, create a support ticket."
      : "Retry payment only if the provider did not deduct money. If money was deducted, create a support ticket.",
  };
}

async function getMyRefundStatus(ctx: any, identity: ReturnType<typeof assertAgentIdentity>, payload: any) {
  const walletRows = await ctx.db
    .query("walletTransactions")
    .withIndex("by_userId", (q: any) => q.eq("userId", identity.userId))
    .order("desc")
    .take(30);
  const refund = walletRows.find((row: any) => row.type === "refund" && (!payload?.reference || String(row.reference || "").includes(String(payload.reference))));
  const paymentStatus = await getMyPaymentBookingStatus(ctx, identity, payload);
  return {
    refundStatus: refund?.status || paymentStatus.refundStatus || "not_found",
    paymentStatus: paymentStatus.paymentStatus,
    bookingStatus: paymentStatus.bookingStatus,
    expectedNextStep: refund
      ? "Refund is recorded in Wallet history."
      : "No matching wallet refund was found. Create a support ticket if a cancellation/refund was expected.",
    supportTicketRecommended: !refund,
  };
}

async function getMyTeamChallengeStatus(ctx: any, identity: ReturnType<typeof assertAgentIdentity>, payload: any) {
  const userTeams = await ctx.db
    .query("teamMembers")
    .withIndex("by_userId", (q: any) => q.eq("odxerId", identity.userId))
    .take(30);
  const captainedTeams = await ctx.db
    .query("teams")
    .withIndex("by_captainUid", (q: any) => q.eq("captainUid", identity.userId))
    .take(30);
  const teamIds = new Set([...userTeams.map((row: any) => String(row.teamId)), ...captainedTeams.map((row: any) => String(row._id))]);
  let challenge: any = null;
  if (payload?.challengeId) {
    const candidate = await ctx.db.get(asId(payload.challengeId));
    if (candidate && (teamIds.has(String(candidate.challengerTeamId)) || teamIds.has(String(candidate.opponentTeamId)))) challenge = candidate;
  }
  if (!challenge) {
    for (const teamId of teamIds) {
      const outgoing = await ctx.db.query("teamChallenges").withIndex("by_challengerTeamId", (q: any) => q.eq("challengerTeamId", teamId as Id<"teams">)).order("desc").first();
      const incoming = await ctx.db.query("teamChallenges").withIndex("by_opponentTeamId", (q: any) => q.eq("opponentTeamId", teamId as Id<"teams">)).order("desc").first();
      challenge = outgoing || incoming;
      if (challenge) break;
    }
  }
  const userTeamRole = challenge
    ? String(challenge.captainAUid) === String(identity.userId) ? "challenger_captain"
      : String(challenge.captainBUid) === String(identity.userId) ? "opponent_captain"
        : "team_member"
    : captainedTeams.length ? "captain" : userTeams.length ? "member" : "none";
  const targetTeam = challenge?.opponentTeamId ? await ctx.db.get(challenge.opponentTeamId) : null;
  return {
    found: Boolean(challenge),
    userTeamRole,
    isCaptain: userTeamRole.includes("captain") || captainedTeams.length > 0,
    challengeStatus: challenge?.status || null,
    targetTeamStatus: targetTeam?.status || null,
    game: challenge?.game || captainedTeams[0]?.game || null,
    reasonUserCannotChallenge: !captainedTeams.length ? "Only a team captain can challenge another team." : targetTeam?.status === "deleted" ? "The target team was deleted." : null,
    nextSafeAction: challenge ? "Open the challenge details screen for accept/reject/payment status." : "Create or captain an eligible team before sending a challenge.",
  };
}

async function getMyZoneRequestStatus(ctx: any, identity: ReturnType<typeof assertAgentIdentity>, payload: any) {
  const zones = await ctx.db
    .query("zones")
    .withIndex("by_ownerUid", (q: any) => q.eq("ownerUid", identity.userId))
    .order("desc")
    .take(10);
  const zone = payload?.zoneId
    ? zones.find((row: any) => String(row._id) === String(payload.zoneId))
    : zones[0];
  if (!zone) return { found: false, nextSafeAction: "Complete zone registration first." };
  const missingFields = [
    !zone.venueBrandName && !zone.name ? "venue name" : null,
    !zone.contactPhone ? "contact phone" : null,
    !zone.city ? "city" : null,
    !zone.primaryBranch && (!Array.isArray(zone.branches) || zone.branches.length === 0) ? "branch details" : null,
  ].filter(Boolean);
  return {
    found: true,
    zoneId: String(zone._id),
    branchId: payload?.branchId || zone.primaryBranch?.id || null,
    approvalStatus: zone.status,
    missingFields,
    rejectionReasonPublic: zone.status === "rejected" ? zone.rejectionReasonPublic || zone.rejectionReason || "Your zone request needs changes before approval." : null,
    nextSafeAction: zone.status === "active" ? "Your zone is active. Check zone bookings for requests." : missingFields.length ? "Complete the missing zone setup fields." : "Wait for MatchHai super-admin review.",
  };
}

async function getMyRecentSupportEntities(ctx: any, identity: ReturnType<typeof assertAgentIdentity>) {
  const [safeContext, teams, teamMemberships, tickets, bookings] = await Promise.all([
    getSafeContextForUser(ctx, identity.userId),
    ctx.db.query("teams").withIndex("by_captainUid", (q: any) => q.eq("captainUid", identity.userId)).order("desc").take(5),
    ctx.db.query("teamMembers").withIndex("by_userId", (q: any) => q.eq("odxerId", identity.userId)).order("desc").take(5),
    ctx.db.query("supportTickets").withIndex("by_userId", (q: any) => q.eq("userId", identity.userId)).order("desc").take(5),
    ctx.db.query("bookingIntents").withIndex("by_createdByUid", (q: any) => q.eq("createdByUid", identity.userId)).order("desc").take(5),
  ]);
  return {
    matchrooms: safeContext.recentMatchrooms,
    bookings: bookings.map((booking: any) => safeBookingIntent(booking, null)),
    payments: safeContext.recentPayments,
    teams: teams.map((team: any) => ({ teamId: String(team._id), name: team.name, game: team.game, status: team.status || "active", role: "captain" })),
    teamMemberships: teamMemberships.map((member: any) => ({ teamId: String(member.teamId), role: member.role, joinedAt: member.joinedAt })),
    zoneRequests: safeContext.zones,
    tickets: tickets.map((ticket: any) => ({ ticketId: String(ticket._id), reference: ticket.reference, status: ticket.status, category: ticket.category, priority: ticket.priority, createdAt: ticket.createdAt })),
  };
}

async function createAgentTicket(ctx: any, identity: ReturnType<typeof assertAgentIdentity>, requestId: string, payload: any) {
  if (!identity.conversationId) throw new Error("Conversation is required");
  const conversation = await ctx.db.get(identity.conversationId);
  if (!conversation || String(conversation.userId) !== String(identity.userId)) {
    throw new Error("Conversation not found");
  }

  const since = Date.now() - 24 * 60 * 60 * 1000;
  const recentTickets = await ctx.db
    .query("supportTickets")
    .withIndex("by_conversationId_createdAt", (q: any) => q.eq("conversationId", identity.conversationId!))
    .order("desc")
    .take(SUPPORT_AGENT_MAX_TICKETS_PER_DAY);
  if (recentTickets.filter((ticket: any) => Number(ticket.createdAt || 0) >= since).length >= SUPPORT_AGENT_MAX_TICKETS_PER_DAY) {
    await insertAuditLog(ctx, {
      requestId,
      userId: identity.userId,
      conversationId: identity.conversationId,
      actionType: "create_support_ticket",
      actionStatus: "rate_limited",
      reasonCategory: "ticket_daily_limit",
    });
    return { ok: false, reason: "ticket_daily_limit" };
  }

  const messages = await ctx.db
    .query("supportMessages")
    .withIndex("by_conversationId_createdAt", (q: any) => q.eq("conversationId", identity.conversationId!))
    .order("desc")
    .take(10);
  const now = Date.now();
  const reference = `MH-SUP-${now.toString(36).toUpperCase().slice(-6)}`;
  const ticketId = await ctx.db.insert("supportTickets", {
    reference,
    userId: identity.userId,
    userRole: identity.module,
    category: payload.category ? String(payload.category).slice(0, 80) : payload.intent ? String(payload.intent).slice(0, 80) : undefined,
    subcategory: payload.subcategory ? String(payload.subcategory).slice(0, 80) : undefined,
    intent: payload.intent ? String(payload.intent).slice(0, 80) : undefined,
    priority: normalizePriority(payload.priority),
    issueSummary: redactSupportText(payload.issueSummary || payload.summary || "MatchHai support issue").slice(0, 500),
    conversationExcerpt: messages.reverse().map((message: any) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      text: redactSupportText(message.textRedacted),
    })).filter((message: any) => message.role === "user" || message.role === "assistant"),
    suggestedAdminAction: payload.suggestedAdminAction ? safeContextText(payload.suggestedAdminAction).slice(0, 500) : undefined,
    relatedMatchroomId: payload.relatedMatchroomId,
    relatedPaymentId: payload.relatedPaymentId,
    relatedBookingId: payload.relatedBookingId,
    relatedZoneId: payload.relatedZoneId,
    conversationId: identity.conversationId,
    metadata: {
      safeContextSnapshot: payload.safeContextSnapshot || null,
      emailStatus: "not_configured",
    },
    status: "open",
    source: "help_support_ai_agent",
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.patch(identity.conversationId, {
    activeTicketId: ticketId,
    priority: normalizePriority(payload.priority),
    lastIntent: payload.intent ? String(payload.intent).slice(0, 80) : conversation.lastIntent,
    updatedAt: now,
  });
  await insertAuditLog(ctx, {
    requestId,
    userId: identity.userId,
    conversationId: identity.conversationId,
    actionType: "create_support_ticket",
    actionStatus: "executed",
    reasonCategory: payload.intent ? String(payload.intent).slice(0, 80) : "support_escalation",
    ticketId,
    ticketReference: reference,
  });
  return { ok: true, ticketId, reference, status: "open" };
}

const DANGEROUS_AGENT_ACTIONS = new Set([
  "refund_payment",
  "modify_wallet_balance",
  "ban_user",
  "suspend_user",
  "release_venue_payout",
  "override_match_result",
  "delete_account",
  "cancel_confirmed_matchroom",
]);

function normalizeModerationReportType(value: unknown): "matchroom_complaint" | "user_report" | "zone_complaint" {
  const text = String(value || "").trim();
  if (text === "matchroom_complaint" || text.includes("matchroom")) return "matchroom_complaint";
  if (text === "zone_complaint" || text.includes("zone") || text.includes("venue")) return "zone_complaint";
  return "user_report";
}

function buildSupportReportDedupeKey(input: {
  reporterUid: Id<"users">;
  type: "matchroom_complaint" | "user_report" | "zone_complaint";
  reason: string;
  conversationId?: Id<"supportConversations">;
}) {
  return [
    "support_ai_agent",
    String(input.reporterUid),
    input.type,
    input.conversationId ? String(input.conversationId) : "",
    String(input.reason || "").trim().toLowerCase().slice(0, 120),
  ].filter(Boolean).join("|");
}

async function createModerationReportFromAgent(
  ctx: any,
  identity: ReturnType<typeof assertAgentIdentity>,
  requestId: string,
  payload: any,
) {
  if (!identity.conversationId) {
    return { ok: false, reason: "missing_conversation" };
  }
  const conversation = await ctx.db.get(identity.conversationId);
  if (!conversation || String(conversation.userId) !== String(identity.userId)) {
    return { ok: false, reason: "conversation_not_found" };
  }

  const type = normalizeModerationReportType(payload.type || payload.reportType || payload.targetType);
  const reason = safeContextText(payload.reason || payload.issueSummary || payload.summary || "Reported via MatchHai support chat").slice(0, 180);
  const description = safeContextText(payload.description || payload.details || payload.conversationSummary || reason).slice(0, 1000);
  const dedupeKey = buildSupportReportDedupeKey({
    reporterUid: identity.userId,
    type,
    reason,
    conversationId: identity.conversationId,
  });
  const existing = await ctx.db
    .query("reports")
    .withIndex("by_dedupeKey", (q: any) => q.eq("dedupeKey", dedupeKey))
    .unique();
  if (existing) {
    await insertAuditLog(ctx, {
      requestId,
      userId: identity.userId,
      conversationId: identity.conversationId,
      actionType: "create_moderation_report",
      actionStatus: "executed",
      reasonCategory: "duplicate_existing_report",
    });
    return { ok: true, reportId: existing._id, created: false, status: existing.status };
  }

  const now = Date.now();
  const reportId = await ctx.db.insert("reports", {
    reporterUid: identity.userId,
    type,
    status: "pending",
    reason,
    dedupeKey,
    description,
    createdAt: now,
    updatedAt: now,
  });
  await insertAuditLog(ctx, {
    requestId,
    userId: identity.userId,
    conversationId: identity.conversationId,
    actionType: "create_moderation_report",
    actionStatus: "executed",
    reasonCategory: type,
  });
  return { ok: true, reportId, created: true, status: "pending", reportType: type };
}

export const executeAgentToolGateway = internalMutation({
  args: {
    requestId: v.string(),
    identityToken: v.string(),
    ipKey: v.optional(v.string()),
    tools: v.array(v.object({
      type: v.string(),
      payload: v.optional(v.any()),
      reason: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const payload = await verifySignedSupportToken(args.identityToken, getSupportSecret());
    const identity = assertAgentIdentity(payload);
    const userLimitOk = await enforceAgentRateLimit(
      ctx,
      `support-agent:user:${String(identity.userId)}`,
      SUPPORT_AGENT_RATE_LIMIT_PER_USER,
      SUPPORT_AGENT_RATE_WINDOW_MS,
    );
    const conversationLimitOk = identity.conversationId
      ? await enforceAgentRateLimit(
          ctx,
          `support-agent:conversation:${String(identity.conversationId)}`,
          SUPPORT_AGENT_RATE_LIMIT_PER_CONVERSATION,
          60 * 1000,
        )
      : true;
    const ipLimitOk = args.ipKey
      ? await enforceAgentRateLimit(ctx, `support-agent:ip:${args.ipKey}`, 20, SUPPORT_AGENT_RATE_WINDOW_MS)
      : true;
    if (!userLimitOk || !conversationLimitOk || !ipLimitOk) {
      await insertAuditLog(ctx, {
        requestId: args.requestId,
        userId: identity.userId,
        conversationId: identity.conversationId,
        actionType: "rate_limit",
        actionStatus: "rate_limited",
        reasonCategory: !userLimitOk ? "user" : !conversationLimitOk ? "conversation" : "ip",
      });
      return { ok: false, rateLimited: true, results: [] };
    }

    const results = [];
    for (const tool of args.tools.slice(0, 5)) {
      if (DANGEROUS_AGENT_ACTIONS.has(tool.type)) {
        await insertAuditLog(ctx, {
          requestId: args.requestId,
          userId: identity.userId,
          conversationId: identity.conversationId,
          actionType: tool.type,
          actionStatus: "denied",
          reasonCategory: "dangerous_action_blocked",
        });
        results.push({ type: tool.type, ok: false, denied: true, reason: "dangerous_action_blocked" });
        continue;
      }

      try {
        if (tool.type === "check_rate_limit") {
          results.push({ type: tool.type, ok: true });
        } else if (tool.type === "get_user_support_context" || tool.type === "get_recent_payments" || tool.type === "get_recent_matchrooms" || tool.type === "get_zone_admin_context") {
          const safeContext = await getSafeContextForUser(ctx, identity.userId);
          await insertAuditLog(ctx, {
            requestId: args.requestId,
            userId: identity.userId,
            conversationId: identity.conversationId,
            actionType: tool.type,
            actionStatus: "executed",
            reasonCategory: "safe_read",
          });
          results.push({ type: tool.type, ok: true, data: safeContext });
        } else if (tool.type === "get_my_matchroom_status") {
          const data = await getMyMatchroomStatus(ctx, identity, tool.payload || {});
          await insertAuditLog(ctx, {
            requestId: args.requestId,
            userId: identity.userId,
            conversationId: identity.conversationId,
            actionType: tool.type,
            actionStatus: "executed",
            reasonCategory: "safe_matchroom_read",
          });
          results.push({ type: tool.type, ok: true, data });
        } else if (tool.type === "get_my_payment_booking_status") {
          const data = await getMyPaymentBookingStatus(ctx, identity, tool.payload || {});
          await insertAuditLog(ctx, {
            requestId: args.requestId,
            userId: identity.userId,
            conversationId: identity.conversationId,
            actionType: tool.type,
            actionStatus: "executed",
            reasonCategory: "safe_payment_booking_read",
          });
          results.push({ type: tool.type, ok: true, data });
        } else if (tool.type === "get_my_refund_status") {
          const data = await getMyRefundStatus(ctx, identity, tool.payload || {});
          await insertAuditLog(ctx, {
            requestId: args.requestId,
            userId: identity.userId,
            conversationId: identity.conversationId,
            actionType: tool.type,
            actionStatus: "executed",
            reasonCategory: "safe_refund_read",
          });
          results.push({ type: tool.type, ok: true, data });
        } else if (tool.type === "get_my_team_challenge_status") {
          const data = await getMyTeamChallengeStatus(ctx, identity, tool.payload || {});
          await insertAuditLog(ctx, {
            requestId: args.requestId,
            userId: identity.userId,
            conversationId: identity.conversationId,
            actionType: tool.type,
            actionStatus: "executed",
            reasonCategory: "safe_team_challenge_read",
          });
          results.push({ type: tool.type, ok: true, data });
        } else if (tool.type === "get_my_zone_request_status") {
          const data = await getMyZoneRequestStatus(ctx, identity, tool.payload || {});
          await insertAuditLog(ctx, {
            requestId: args.requestId,
            userId: identity.userId,
            conversationId: identity.conversationId,
            actionType: tool.type,
            actionStatus: "executed",
            reasonCategory: "safe_zone_read",
          });
          results.push({ type: tool.type, ok: true, data });
        } else if (tool.type === "get_my_recent_support_entities") {
          const data = await getMyRecentSupportEntities(ctx, identity);
          await insertAuditLog(ctx, {
            requestId: args.requestId,
            userId: identity.userId,
            conversationId: identity.conversationId,
            actionType: tool.type,
            actionStatus: "executed",
            reasonCategory: "safe_recent_entities_read",
          });
          results.push({ type: tool.type, ok: true, data });
        } else if (tool.type === "create_support_ticket" || tool.type === "create_admin_escalation") {
          const result = await createAgentTicket(ctx, identity, args.requestId, tool.payload || {});
          results.push({ type: tool.type, ...result });
        } else if (tool.type === "create_moderation_report") {
          const result = await createModerationReportFromAgent(ctx, identity, args.requestId, tool.payload || {});
          results.push({ type: tool.type, ...result });
        } else if (tool.type === "add_support_ticket_note") {
          const ticketId = tool.payload?.ticketId as Id<"supportTickets"> | undefined;
          const ticket = ticketId ? await ctx.db.get(ticketId) : null;
          if (!ticket || String(ticket.userId) !== String(identity.userId)) throw new Error("Ticket not found");
          const existingTicketId = ticketId as Id<"supportTickets">;
          await ctx.db.insert("supportTicketNotes", {
            ticketId: existingTicketId,
            author: "agent",
            textRedacted: safeContextText(tool.payload?.note || tool.reason || "Support agent note"),
            createdAt: Date.now(),
          });
          await insertAuditLog(ctx, {
            requestId: args.requestId,
            userId: identity.userId,
            conversationId: identity.conversationId,
            actionType: tool.type,
            actionStatus: "executed",
            reasonCategory: "ticket_note",
            ticketId: existingTicketId,
            ticketReference: ticket.reference,
          });
          results.push({ type: tool.type, ok: true });
        } else if (tool.type === "prepare_email_draft") {
          await insertAuditLog(ctx, {
            requestId: args.requestId,
            userId: identity.userId,
            conversationId: identity.conversationId,
            actionType: tool.type,
            actionStatus: "executed",
            reasonCategory: "draft_only",
          });
          results.push({ type: tool.type, ok: true, data: { emailStatus: "drafted" } });
        } else if (tool.type === "record_agent_event") {
          await insertAuditLog(ctx, {
            requestId: args.requestId,
            userId: identity.userId,
            conversationId: identity.conversationId,
            actionType: String(tool.payload?.actionType || "agent_event").slice(0, 80),
            actionStatus: (["executed", "denied", "failed", "rate_limited"].includes(tool.payload?.actionStatus) ? tool.payload.actionStatus : "executed") as AgentActionStatus,
            reasonCategory: tool.payload?.reasonCategory ? String(tool.payload.reasonCategory).slice(0, 120) : undefined,
          });
          results.push({ type: tool.type, ok: true });
        } else {
          await insertAuditLog(ctx, {
            requestId: args.requestId,
            userId: identity.userId,
            conversationId: identity.conversationId,
            actionType: tool.type,
            actionStatus: "denied",
            reasonCategory: "unknown_tool",
          });
          results.push({ type: tool.type, ok: false, denied: true, reason: "unknown_tool" });
        }
      } catch {
        await insertAuditLog(ctx, {
          requestId: args.requestId,
          userId: identity.userId,
          conversationId: identity.conversationId,
          actionType: tool.type,
          actionStatus: "failed",
          reasonCategory: "tool_error",
        });
        results.push({ type: tool.type, ok: false, reason: "tool_error" });
      }
    }

    return { ok: true, rateLimited: false, results };
  },
});

export const supportAgentTools = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Headers": "Content-Type, X-Support-Agent-Service",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), { status: 405 });
  }
  const serviceToken = request.headers.get("X-Support-Agent-Service") || "";
  if (!serviceToken || serviceToken !== getSupportSecret()) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401 });
  }
  const body = await request.json().catch(() => null) as any;
  if (!body?.identityToken || !Array.isArray(body?.tools)) {
    return new Response(JSON.stringify({ ok: false, error: "invalid_request" }), { status: 400 });
  }
  const requestId = String(body.requestId || "unknown").slice(0, 80);
  const tools = body.tools.slice(0, 5).map((tool: any) => ({
    type: String(tool?.type || "unknown").slice(0, 80),
    reason: tool?.reason ? safeContextText(tool.reason).slice(0, 200) : undefined,
    payload: tool?.payload || {},
  }));
  const knowledgeTools = tools.filter((tool: any) => tool.type === "search_support_knowledge");
  const regularTools = tools.filter((tool: any) => tool.type !== "search_support_knowledge");
  const results: any[] = [];
  if (regularTools.length) {
    const regularResult = await ctx.runMutation((internal as any).support.executeAgentToolGateway, {
      requestId,
      identityToken: String(body.identityToken),
      ipKey: body.ipKey ? String(body.ipKey).slice(0, 80) : undefined,
      tools: regularTools,
    });
    results.push(...(regularResult.results || []));
    if (regularResult.rateLimited) {
      return new Response(JSON.stringify({ ok: false, rateLimited: true, results }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
  for (const tool of knowledgeTools) {
    try {
      const searchResult = await ctx.runAction((internal as any).supportKnowledge.searchKnowledgeForAgent, {
        requestId,
        identityToken: String(body.identityToken),
        query: String(tool.payload?.query || tool.reason || "").slice(0, 1200),
        locale: tool.payload?.locale,
        category: tool.payload?.category ? String(tool.payload.category).slice(0, 80) : undefined,
        limit: typeof tool.payload?.limit === "number" ? tool.payload.limit : undefined,
      });
      results.push({ type: tool.type, ok: true, data: searchResult });
    } catch {
      results.push({ type: tool.type, ok: false, reason: "tool_error" });
    }
  }
  const result = { ok: true, rateLimited: false, results };
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

export const createSupportTicket = mutation({
  args: {
    userRole: v.optional(v.string()),
    category: v.optional(v.string()),
    subcategory: v.optional(v.string()),
    intent: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
    issueSummary: v.string(),
    conversationExcerpt: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        text: v.string(),
      })
    ),
    conversationId: v.optional(v.id("supportConversations")),
    suggestedAdminAction: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedProfile(ctx);
    const now = Date.now();
    const reference = `MH-SUP-${now.toString(36).toUpperCase().slice(-6)}`;

    const userRole = args.userRole || supportRoleForUser(user);
    const ticketId = await ctx.db.insert("supportTickets", {
      reference,
      userId: user._id,
      userRole,
      category: args.category,
      subcategory: args.subcategory,
      intent: args.intent,
      priority: args.priority,
      issueSummary: redactTicketText(args.issueSummary).slice(0, 500) || "MatchHai support request",
      conversationExcerpt: args.conversationExcerpt.slice(-10).map((message) => ({
        role: message.role,
        text: redactTicketText(message.text),
      })),
      conversationId: args.conversationId,
      suggestedAdminAction: args.suggestedAdminAction ? redactTicketText(args.suggestedAdminAction).slice(0, 500) : undefined,
      metadata: args.metadata,
      status: "open",
      source: "help_support_chat",
      createdAt: now,
      updatedAt: now,
    });

    await notifySupportTicketCreated(ctx, {
      ticketId,
      ticketReference: reference,
      userId: user._id,
      userRole,
      category: args.category,
      priority: args.priority,
    });

    return {
      ticketId,
      reference,
      status: "open" as const,
      emailSent: false,
    };
  },
});

export const getSupportTicketEmailPayload = query({
  args: {
    ticketId: v.id("supportTickets"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedProfile(ctx);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket || String(ticket.userId) !== String(user._id)) {
      throw new Error("Support ticket not found");
    }
    return {
      ticketId: ticket._id,
      reference: ticket.reference,
      issueSummary: redactTicketText(ticket.issueSummary).slice(0, 500),
      priority: ticket.priority || "medium",
      category: ticket.category || "general_help",
      userRole: ticket.userRole || supportRoleForUser(user),
      conversationExcerpt: (ticket.conversationExcerpt || []).slice(-8).map((message: any) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        text: redactTicketText(message.text).slice(0, 700),
      })),
    };
  },
});

export const markSupportTicketEmailStatus = mutation({
  args: {
    ticketId: v.id("supportTickets"),
    emailStatus: v.union(v.literal("sent"), v.literal("failed"), v.literal("not_configured")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedProfile(ctx);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket || String(ticket.userId) !== String(user._id)) {
      throw new Error("Support ticket not found");
    }
    await ctx.db.patch(args.ticketId, {
      metadata: {
        ...(ticket.metadata || {}),
        emailStatus: args.emailStatus,
        emailStatusUpdatedAt: Date.now(),
      },
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});
