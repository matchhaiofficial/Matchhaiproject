import { v } from "convex/values";

import { internal } from "./_generated/api";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireCurrentUser, requireSuperAdmin } from "./authz";

const DUPLICATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_DESCRIPTION_LENGTH = 1000;

type ReportStatus = "pending" | "reviewed" | "resolved";
type ReportType =
  | "matchroom_complaint"
  | "user_report"
  | "zone_complaint"
  | "friend_chat_message_report"
  | "matchroom_chat_message_report"
  | "team_challenge_chat_message_report"
  | "team_report";

function normalizeReason(value: string) {
  return String(value || "").trim();
}

function normalizeDescription(value?: string | null) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_DESCRIPTION_LENGTH);
}

function normalizeOptionalString(value?: string | null) {
  const trimmed = String(value || "").trim();
  return trimmed || undefined;
}

function buildReportDedupeKey(args: {
  reporterUid: Id<"users">;
  type: ReportType;
  reason: string;
  matchroomId?: Id<"matchrooms">;
  reportedUserId?: Id<"users">;
  zoneId?: Id<"zones">;
  branchId?: string;
  branchLabel?: string;
  chatroomId?: Id<"chatrooms">;
  chatMessageId?: Id<"chatMessages">;
  teamChallengeChatId?: string;
  teamChallengeChatMessageId?: Id<"teamChallengeChatMessages">;
  supportConversationId?: Id<"supportConversations">;
  supportTicketId?: Id<"supportTickets">;
}) {
  return [
    String(args.reporterUid),
    args.type,
    String(args.reason || "").trim().toLowerCase(),
    args.matchroomId ? `matchroom:${String(args.matchroomId)}` : "",
    args.reportedUserId ? `user:${String(args.reportedUserId)}` : "",
    args.zoneId ? `zone:${String(args.zoneId)}` : "",
    args.zoneId && (args.branchId || args.branchLabel)
      ? `branch:${String(args.branchId || args.branchLabel).trim().toLowerCase()}`
      : "",
    args.chatroomId ? `chatroom:${String(args.chatroomId)}` : "",
    args.chatMessageId ? `chatMessage:${String(args.chatMessageId)}` : "",
    args.teamChallengeChatId ? `teamChallengeChat:${String(args.teamChallengeChatId)}` : "",
    args.teamChallengeChatMessageId ? `teamChallengeChatMessage:${String(args.teamChallengeChatMessageId)}` : "",
    args.supportConversationId ? `supportConversation:${String(args.supportConversationId)}` : "",
    args.supportTicketId ? `supportTicket:${String(args.supportTicketId)}` : "",
  ]
    .filter(Boolean)
    .join("|");
}

async function resolveUserByAnyId(ctx: any, value?: string | null) {
  if (!value) return null;

  try {
    const directUser = await ctx.db.get(value);
    if (directUser) return directUser;
  } catch {
    // Ignore invalid document IDs and fall back to authId lookup.
  }

  return await ctx.db
    .query("users")
    .withIndex("by_authId", (q: any) => q.eq("authId", value))
    .unique();
}

async function getAuthenticatedConvexUser(ctx: any, expectedUid?: string | null) {
  const expectedUser = await resolveUserByAnyId(ctx, expectedUid);
  const actor = await requireCurrentUser(ctx);
  if (expectedUser && String(expectedUser._id) !== String(actor.user._id)) {
    throw new Error("You can only perform this action for your own account.");
  }
  return { authUser: actor.authUser, user: actor.user };
}

async function getOwnedZone(ctx: any, ownerUid: Id<"users">) {
  return await ctx.db
    .query("zones")
    .withIndex("by_ownerUid", (q: any) => q.eq("ownerUid", ownerUid))
    .unique();
}

async function listSuperAdminUsers(ctx: any) {
  return await ctx.db
    .query("users")
    .withIndex("by_role", (q: any) => q.eq("role", "super-admin"))
    .collect();
}

async function findRecentDuplicate(ctx: any, args: {
  reporterUid: Id<"users">;
  type: ReportType;
  reason: string;
  matchroomId?: Id<"matchrooms">;
  reportedUserId?: Id<"users">;
  zoneId?: Id<"zones">;
  branchId?: string;
  branchLabel?: string;
  chatroomId?: Id<"chatrooms">;
  chatMessageId?: Id<"chatMessages">;
  teamChallengeChatId?: string;
  teamChallengeChatMessageId?: Id<"teamChallengeChatMessages">;
  supportConversationId?: Id<"supportConversations">;
  supportTicketId?: Id<"supportTickets">;
}) {
  const dedupeKey = buildReportDedupeKey(args);
  const duplicateCandidates = await ctx.db
    .query("reports")
    .withIndex("by_dedupeKey", (q: any) => q.eq("dedupeKey", dedupeKey))
    .collect();

  const now = Date.now();
  const directDuplicate = duplicateCandidates.find((report: any) => now - Number(report.createdAt || 0) <= DUPLICATE_WINDOW_MS);
  if (directDuplicate) {
    return directDuplicate;
  }

  const recent = await ctx.db
    .query("reports")
    .withIndex("by_reporterUid", (q: any) => q.eq("reporterUid", args.reporterUid))
    .collect();

  return recent.find((report: any) => {
    if (report.type !== args.type) return false;
    if (String(report.reason || "") !== args.reason) return false;
    if (args.matchroomId && String(report.matchroomId || "") !== String(args.matchroomId)) return false;
    if (args.reportedUserId && String(report.reportedUserId || "") !== String(args.reportedUserId)) return false;
    if (args.zoneId && String(report.zoneId || "") !== String(args.zoneId)) return false;
    if (args.chatroomId && String(report.chatroomId || "") !== String(args.chatroomId)) return false;
    if (args.chatMessageId && String(report.chatMessageId || "") !== String(args.chatMessageId)) return false;
    if (args.teamChallengeChatId && String(report.teamChallengeChatId || "") !== String(args.teamChallengeChatId)) return false;
    if (args.teamChallengeChatMessageId && String(report.teamChallengeChatMessageId || "") !== String(args.teamChallengeChatMessageId)) return false;
    if (args.supportConversationId && String(report.supportConversationId || "") !== String(args.supportConversationId)) return false;
    if (args.supportTicketId && String(report.supportTicketId || "") !== String(args.supportTicketId)) return false;
    if (args.zoneId) {
      const expectedBranch = String(args.branchId || args.branchLabel || "").trim().toLowerCase();
      const reportBranch = String(report.branchId || report.branchLabel || "").trim().toLowerCase();
      if (expectedBranch !== reportBranch) return false;
    }
    return now - Number(report.createdAt || 0) <= DUPLICATE_WINDOW_MS;
  });
}

async function insertReport(ctx: any, args: {
  reporterUid: Id<"users">;
  type: ReportType;
  matchroomId?: Id<"matchrooms">;
  reportedUserId?: Id<"users">;
  zoneId?: Id<"zones">;
  branchId?: string;
  branchLabel?: string;
  game?: string;
  reason: string;
  description?: string;
  source?: string;
  targetType?: string;
  chatroomId?: Id<"chatrooms">;
  chatMessageId?: Id<"chatMessages">;
  teamChallengeChatId?: string;
  teamChallengeChatMessageId?: Id<"teamChallengeChatMessages">;
  supportConversationId?: Id<"supportConversations">;
  supportTicketId?: Id<"supportTickets">;
  messagePreview?: string;
  targetReference?: string;
}) {
  const duplicate = await findRecentDuplicate(ctx, args);
  if (duplicate) {
    return {
      reportId: duplicate._id,
      created: false,
      message: "A similar report was already submitted recently.",
    };
  }

  const now = Date.now();
  const reportId = await (ctx.db as any).insert("reports", {
    reporterUid: args.reporterUid,
    type: args.type,
    status: "pending",
    matchroomId: args.matchroomId,
    reportedUserId: args.reportedUserId,
    zoneId: args.zoneId,
    branchId: args.branchId,
    branchLabel: args.branchLabel,
    game: args.game,
    reason: args.reason,
    dedupeKey: buildReportDedupeKey(args),
    description: args.description,
    source: args.source,
    targetType: args.targetType,
    chatroomId: args.chatroomId,
    chatMessageId: args.chatMessageId,
    teamChallengeChatId: args.teamChallengeChatId,
    teamChallengeChatMessageId: args.teamChallengeChatMessageId,
    supportConversationId: args.supportConversationId,
    supportTicketId: args.supportTicketId,
    messagePreview: args.messagePreview,
    targetReference: args.targetReference,
    createdAt: now,
    updatedAt: now,
  });

  await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
    type: "moderation.report_submitted",
    toUid: args.reporterUid,
    status: "pending",
    dedupeKey: `moderation.report_submitted:reporter:${String(reportId)}`,
    dedupePolicy: "replace_active",
    route: "/(player)/reports",
    entity: { kind: "report", id: String(reportId) },
    entityId: String(reportId),
    title: "Report received",
    body: "Your report was submitted and is now pending review.",
    data: {
      reportId: String(reportId),
      reportType: args.type,
      href: "/(player)/reports",
    },
  });

  const superAdmins = await listSuperAdminUsers(ctx);
  for (const superAdmin of superAdmins) {
    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "moderation.review_needed",
      toUid: superAdmin._id,
      recipientRole: "super_admin",
      status: "pending",
      dedupeKey: `moderation.review_needed:${String(reportId)}:${String(superAdmin._id)}`,
      dedupePolicy: "upsert_active",
      route: `/super-admin/report/${String(reportId)}`,
      entity: { kind: "report", id: String(reportId) },
      entityId: String(reportId),
      title: "New report needs review",
      body: `A new ${args.type.replace(/_/g, " ")} was submitted.`,
      data: {
        reportId: String(reportId),
        reportType: args.type,
        href: `/super-admin/report/${String(reportId)}`,
      },
    });
  }

  if (args.zoneId) {
    const zone = await ctx.db.get(args.zoneId);
    if (zone?.ownerUid) {
      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: "moderation.report_submitted",
        toUid: zone.ownerUid,
        recipientRole: "zone_admin",
        status: "pending",
        dedupeKey: `moderation.report_submitted:zone:${String(reportId)}`,
        dedupePolicy: "replace_active",
        route: `/zone/modules/support?reportId=${String(reportId)}`,
        entity: { kind: "report", id: String(reportId) },
        entityId: String(reportId),
        title: "Venue complaint submitted",
        body: "A new report was submitted about your venue.",
        data: {
          reportId: String(reportId),
          reportType: args.type,
          zoneId: String(args.zoneId),
          href: `/zone/modules/support?reportId=${String(reportId)}`,
        },
      });
    }
  }

  return {
    reportId,
    created: true,
    message: "Report submitted successfully.",
  };
}

async function createMatchroomComplaintInternal(ctx: any, args: {
  matchroomId: Id<"matchrooms">;
  reason: string;
  description?: string;
  reporterUid?: Id<"users">;
  branchId?: string;
  branchLabel?: string;
}) {
  const { user } = await getAuthenticatedConvexUser(ctx, args.reporterUid);
  const room = await ctx.db.get(args.matchroomId);
  if (!room) {
    throw new Error("Matchroom not found");
  }

  const isParticipant = (room.playerUids || []).some((uid: any) => String(uid) === String(user._id))
    || (room.players || []).some((player: any) => String(player.uid) === String(user._id));

  let isZoneOwner = false;
  if (room.zoneId) {
    const zone = await ctx.db.get(room.zoneId as Id<"zones">);
    isZoneOwner = Boolean(zone && String(zone.ownerUid) === String(user._id));
  }

  if (!isParticipant && !isZoneOwner) {
    throw new Error("You do not have permission to report this matchroom.");
  }

  const reason = normalizeReason(args.reason);
  if (!reason) {
    throw new Error("Reason is required.");
  }

  return await insertReport(ctx, {
    reporterUid: user._id,
    type: "matchroom_complaint",
    matchroomId: args.matchroomId,
    zoneId: room.zoneId as Id<"zones"> | undefined,
    game: String(room.game || "").trim() || undefined,
    reason,
    description: normalizeDescription(args.description),
  });
}

async function createUserReportInternal(ctx: any, args: {
  reportedUserId: Id<"users">;
  reason: string;
  description?: string;
  reporterUid?: Id<"users">;
  branchId?: string;
  branchLabel?: string;
}) {
  const { user } = await getAuthenticatedConvexUser(ctx, args.reporterUid);
  if (String(user._id) === String(args.reportedUserId)) {
    throw new Error("You cannot report yourself.");
  }

  const reportedUser = await ctx.db.get(args.reportedUserId);
  if (!reportedUser) {
    throw new Error("User not found");
  }

  const reason = normalizeReason(args.reason);
  if (!reason) {
    throw new Error("Reason is required.");
  }

  return await insertReport(ctx, {
    reporterUid: user._id,
    type: "user_report",
    reportedUserId: args.reportedUserId,
    reason,
    description: normalizeDescription(args.description),
  });
}

async function createZoneComplaintInternal(ctx: any, args: {
  zoneId: Id<"zones">;
  reason: string;
  description?: string;
  reporterUid?: Id<"users">;
  branchId?: string;
  branchLabel?: string;
}) {
  const { user } = await getAuthenticatedConvexUser(ctx, args.reporterUid);
  const zone = await ctx.db.get(args.zoneId);
  if (!zone) {
    throw new Error("Zone not found");
  }

  const reason = normalizeReason(args.reason);
  if (!reason) {
    throw new Error("Reason is required.");
  }

  return await insertReport(ctx, {
    reporterUid: user._id,
    type: "zone_complaint",
    zoneId: args.zoneId,
    branchId: normalizeOptionalString(args.branchId),
    branchLabel: normalizeOptionalString(args.branchLabel),
    reason,
    description: normalizeDescription(args.description),
  });
}

function messagePreviewFrom(message: any, textField: "content" | "text" = "content") {
  if (!message) return undefined;
  const type = String(message.type || "text");
  if (type === "voice") return "Voice message";
  if (type === "image") return "Photo";
  if (type === "file") return message.attachment?.fileName ? `File: ${String(message.attachment.fileName).slice(0, 120)}` : "File";
  return String(message[textField] || "").trim().slice(0, 300) || "Text message";
}

function ensureReporterCanSeeChatroom(userId: Id<"users">, chatroom: any) {
  if (!chatroom || !Array.isArray(chatroom.participantUids)) {
    throw new Error("Chat not found.");
  }
  if (!chatroom.participantUids.map(String).includes(String(userId))) {
    throw new Error("You can only report messages from chats you can access.");
  }
}

async function createChatMessageReportInternal(ctx: any, args: {
  chatMessageId: Id<"chatMessages">;
  chatroomId?: Id<"chatrooms">;
  reason: string;
  description?: string;
  reporterUid?: Id<"users">;
  expectedChatType: "dm" | "matchroom";
}) {
  const { user } = await getAuthenticatedConvexUser(ctx, args.reporterUid);
  const message = await ctx.db.get(args.chatMessageId);
  if (!message) throw new Error("Message not found.");

  const chatroomId = args.chatroomId || message.chatroomId;
  const chatroom = await ctx.db.get(chatroomId);
  ensureReporterCanSeeChatroom(user._id, chatroom);
  const chatType = String(chatroom.type || "matchroom");
  if (args.expectedChatType === "dm" && chatType !== "dm") throw new Error("This is not a friend chat message.");
  if (args.expectedChatType === "matchroom" && chatType === "dm") throw new Error("This is not a matchroom chat message.");
  if (String(message.chatroomId) !== String(chatroomId)) throw new Error("Message does not belong to this chat.");
  if (String(message.senderUid) === String(user._id)) throw new Error("You cannot report your own message.");

  const reason = normalizeReason(args.reason);
  if (!reason) throw new Error("Reason is required.");

  let zoneId: Id<"zones"> | undefined;
  let game: string | undefined;
  if (chatroom.matchroomId) {
    const room = await ctx.db.get(chatroom.matchroomId);
    zoneId = room?.zoneId as Id<"zones"> | undefined;
    game = String(room?.game || "").trim() || undefined;
  }

  return await insertReport(ctx, {
    reporterUid: user._id,
    type: args.expectedChatType === "dm" ? "friend_chat_message_report" : "matchroom_chat_message_report",
    reportedUserId: message.senderUid,
    matchroomId: chatroom.matchroomId,
    zoneId,
    game,
    reason,
    description: normalizeDescription(args.description),
    source: "chat_message_report",
    targetType: args.expectedChatType === "dm" ? "friend_chat" : "matchroom_chat",
    chatroomId,
    chatMessageId: args.chatMessageId,
    messagePreview: messagePreviewFrom(message),
    targetReference: `${args.expectedChatType === "dm" ? "Friend chat" : "Matchroom chat"} message ${String(args.chatMessageId)}`,
  });
}

async function createTeamChallengeChatMessageReportInternal(ctx: any, args: {
  chatId: string;
  messageId: Id<"teamChallengeChatMessages">;
  reason: string;
  description?: string;
  reporterUid?: Id<"users">;
}) {
  const { user } = await getAuthenticatedConvexUser(ctx, args.reporterUid);
  const message = await ctx.db.get(args.messageId);
  if (!message || String(message.chatId) !== String(args.chatId)) throw new Error("Message not found.");

  const chat = await ctx.db
    .query("teamChallengeChats")
    .withIndex("by_chatId", (q: any) => q.eq("chatId", args.chatId))
    .unique();
  const challengeId = chat?.challengeId || (args.chatId as Id<"teamChallenges">);
  const challenge = challengeId ? await ctx.db.get(challengeId) : null;
  const participants = (chat?.participantUids || [challenge?.captainAUid, challenge?.captainBUid].filter(Boolean)).map(String);
  if (!participants.includes(String(user._id))) {
    throw new Error("You can only report messages from chats you can access.");
  }
  if (String(message.senderUid) === String(user._id)) throw new Error("You cannot report your own message.");

  const reason = normalizeReason(args.reason);
  if (!reason) throw new Error("Reason is required.");
  const reportedUser = await resolveUserByAnyId(ctx, message.senderUid);

  return await insertReport(ctx, {
    reporterUid: user._id,
    type: "team_challenge_chat_message_report",
    reportedUserId: reportedUser?._id,
    game: String(challenge?.game || "").trim() || undefined,
    reason,
    description: normalizeDescription(args.description),
    source: "chat_message_report",
    targetType: "team_challenge_chat",
    teamChallengeChatId: args.chatId,
    teamChallengeChatMessageId: args.messageId,
    messagePreview: messagePreviewFrom(message, "text"),
    targetReference: `Team challenge chat ${args.chatId}`,
  });
}

async function requireOwnedZoneForReport(ctx: any, reportId: Id<"reports">) {
  const { user } = await getAuthenticatedConvexUser(ctx);
  const zone = await getOwnedZone(ctx, user._id);
  if (!zone) {
    throw new Error("Zone account not found");
  }

  const report = await ctx.db.get(reportId);
  if (!report) {
    throw new Error("Report not found");
  }

  if (!report.zoneId || String(report.zoneId) !== String(zone._id)) {
    throw new Error("You can only access reports tied to your own zone.");
  }

  return { user, zone, report };
}

function sortReportsDesc(items: any[]) {
  return [...items].sort(
    (a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0),
  );
}

async function enrichReportForReporter(ctx: any, report: any) {
  const [zone, matchroom, reportedUser] = await Promise.all([
    report.zoneId ? ctx.db.get(report.zoneId) : Promise.resolve(null),
    report.matchroomId ? ctx.db.get(report.matchroomId) : Promise.resolve(null),
    report.reportedUserId ? ctx.db.get(report.reportedUserId) : Promise.resolve(null),
  ]);

  return {
    ...report,
    zoneName: zone?.venueBrandName || zone?.name || null,
    branchLabel: report.branchLabel || null,
    matchroomTitle: matchroom?.title || null,
    reportedUserName: reportedUser?.fullName || reportedUser?.username || null,
  };
}

async function sanitizeZoneVisibleReport(ctx: any, report: any) {
  const enriched = await enrichReportForReporter(ctx, report);
  const {
    reporterUid,
    reportedUserId,
    reportedUserName,
    ...safeReport
  } = enriched;
  return safeReport;
}

export const getById = query({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    return await ctx.db.get(args.reportId);
  },
});

export const getMineById = query({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedConvexUser(ctx);
    const report = await ctx.db.get(args.reportId);
    if (!report || String(report.reporterUid) !== String(user._id)) {
      throw new Error("Report not found.");
    }
    return await enrichReportForReporter(ctx, report);
  },
});

export const getForMyZoneById = query({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    const { report } = await requireOwnedZoneForReport(ctx, args.reportId);
    return await sanitizeZoneVisibleReport(ctx, report);
  },
});

export const listByReporter = query({
  args: { reporterUid: v.id("users") },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedConvexUser(ctx, args.reporterUid);
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_reporterUid", (q) => q.eq("reporterUid", user._id))
      .order("desc")
      .collect();

    return await Promise.all(reports.map((report) => enrichReportForReporter(ctx, report)));
  },
});

export const listMine = query({
  args: { status: v.optional(v.union(v.literal("pending"), v.literal("reviewed"), v.literal("resolved"))) },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedConvexUser(ctx);
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_reporterUid", (q: any) => q.eq("reporterUid", user._id))
      .collect();

    const filtered = args.status ? reports.filter((report: any) => report.status === args.status) : reports;
    return await Promise.all(sortReportsDesc(filtered).map((report) => enrichReportForReporter(ctx, report)));
  },
});

export const listByStatus = query({
  args: {
    status: v.union(v.literal("pending"), v.literal("reviewed"), v.literal("resolved")),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    return await ctx.db
      .query("reports")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .order("desc")
      .collect();
  },
});

export const listPending = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    return await ctx.db
      .query("reports")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .collect();
  },
});

export const listForMyZone = query({
  args: { status: v.optional(v.union(v.literal("pending"), v.literal("reviewed"), v.literal("resolved"))) },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedConvexUser(ctx);
    const zone = await getOwnedZone(ctx, user._id);
    if (!zone) {
      return [];
    }

    const reports = await ctx.db
      .query("reports")
      .withIndex("by_zoneId", (q: any) => q.eq("zoneId", zone._id))
      .collect();

    const filtered = args.status ? reports.filter((report: any) => report.status === args.status) : reports;
    return await Promise.all(sortReportsDesc(filtered).map((report) => sanitizeZoneVisibleReport(ctx, report)));
  },
});

export const createMatchroomComplaint = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    reason: v.string(),
    description: v.optional(v.string()),
    reporterUid: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    return await createMatchroomComplaintInternal(ctx, args);
  },
});

export const createUserReport = mutation({
  args: {
    reportedUserId: v.id("users"),
    reason: v.string(),
    description: v.optional(v.string()),
    reporterUid: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    return await createUserReportInternal(ctx, args);
  },
});

export const createZoneComplaint = mutation({
  args: {
    zoneId: v.id("zones"),
    reason: v.string(),
    description: v.optional(v.string()),
    reporterUid: v.optional(v.id("users")),
    branchId: v.optional(v.string()),
    branchLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await createZoneComplaintInternal(ctx, args);
  },
});

export const createFriendChatMessageReport = mutation({
  args: {
    chatroomId: v.id("chatrooms"),
    chatMessageId: v.id("chatMessages"),
    reason: v.string(),
    description: v.optional(v.string()),
    reporterUid: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    return await createChatMessageReportInternal(ctx, {
      chatroomId: args.chatroomId,
      chatMessageId: args.chatMessageId,
      reason: args.reason,
      description: args.description,
      reporterUid: args.reporterUid,
      expectedChatType: "dm",
    });
  },
});

export const createMatchroomChatMessageReport = mutation({
  args: {
    chatroomId: v.optional(v.id("chatrooms")),
    chatMessageId: v.id("chatMessages"),
    reason: v.string(),
    description: v.optional(v.string()),
    reporterUid: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    return await createChatMessageReportInternal(ctx, {
      chatroomId: args.chatroomId,
      chatMessageId: args.chatMessageId,
      reason: args.reason,
      description: args.description,
      reporterUid: args.reporterUid,
      expectedChatType: "matchroom",
    });
  },
});

export const createTeamChallengeChatMessageReport = mutation({
  args: {
    chatId: v.string(),
    messageId: v.id("teamChallengeChatMessages"),
    reason: v.string(),
    description: v.optional(v.string()),
    reporterUid: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    return await createTeamChallengeChatMessageReportInternal(ctx, args);
  },
});

export const create = mutation({
  args: {
    type: v.union(
      v.literal("matchroom_complaint"),
      v.literal("user_report"),
      v.literal("zone_complaint"),
    ),
    matchroomId: v.optional(v.id("matchrooms")),
    reportedUserId: v.optional(v.id("users")),
    zoneId: v.optional(v.id("zones")),
    branchId: v.optional(v.string()),
    branchLabel: v.optional(v.string()),
    reason: v.string(),
    description: v.optional(v.string()),
    reporterUid: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    if (args.type === "matchroom_complaint") {
      if (!args.matchroomId) throw new Error("matchroomId is required");
      return await createMatchroomComplaintInternal(ctx, {
        matchroomId: args.matchroomId,
        reason: args.reason,
        description: args.description,
        reporterUid: args.reporterUid,
      });
    }

    if (args.type === "user_report") {
      if (!args.reportedUserId) throw new Error("reportedUserId is required");
      return await createUserReportInternal(ctx, {
        reportedUserId: args.reportedUserId,
        reason: args.reason,
        description: args.description,
        reporterUid: args.reporterUid,
      });
    }

    if (!args.zoneId) throw new Error("zoneId is required");
    return await createZoneComplaintInternal(ctx, {
      zoneId: args.zoneId,
      reason: args.reason,
      description: args.description,
      reporterUid: args.reporterUid,
      branchId: args.branchId,
      branchLabel: args.branchLabel,
    });
  },
});

export const updateStatus = mutation({
  args: {
    reportId: v.id("reports"),
    status: v.union(v.literal("pending"), v.literal("reviewed"), v.literal("resolved")),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedConvexUser(ctx);
    const report = await ctx.db.get(args.reportId);
    if (!report || String(report.reporterUid) !== String(user._id)) {
      throw new Error("Report not found.");
    }

    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: Date.now(),
    };
    if (args.status === "reviewed") {
      patch.reviewedByUid = user._id;
      patch.reviewedAt = Date.now();
    }
    if (args.status === "resolved") {
      patch.resolvedByUid = user._id;
      patch.resolvedAt = Date.now();
    }

    await ctx.db.patch(args.reportId, patch);
    return true;
  },
});

export const markZoneReportReviewed = mutation({
  args: {
    reportId: v.id("reports"),
    reviewerNote: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, report } = await requireOwnedZoneForReport(ctx, args.reportId);

    if (report.status === "resolved") {
      throw new Error("Resolved reports cannot be changed from the zone side.");
    }

    if (report.status === "reviewed") {
      return { ok: true, message: "Report already reviewed." };
    }

    const now = Date.now();
    const reviewerNote = args.reviewerNote.trim();
    if (!reviewerNote) {
      throw new Error("A review note is required.");
    }

    await ctx.db.patch(args.reportId, {
      status: "reviewed" as ReportStatus,
      reviewedByUid: user._id,
      reviewedAt: now,
      reviewerNote,
      updatedAt: now,
    });

    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "moderation.report_updated",
      toUid: report.reporterUid,
      status: "pending",
      dedupeKey: `moderation.report_updated:${String(report._id)}:reviewed`,
      dedupePolicy: "replace_active",
      route: "/(player)/reports",
      entity: { kind: "report", id: String(report._id) },
      entityId: String(report._id),
      title: "Report reviewed",
      body: "Your report has been reviewed by the venue team.",
      data: {
        reportId: String(report._id),
        reportType: report.type,
        status: "reviewed",
        href: "/(player)/reports",
      },
    });

    return { ok: true, message: "Report marked as reviewed." };
  },
});

export const remove = mutation({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedConvexUser(ctx);
    const report = await ctx.db.get(args.reportId);
    if (!report || String(report.reporterUid) !== String(user._id)) {
      throw new Error("Report not found.");
    }
    await ctx.db.delete(args.reportId);
    return true;
  },
});
