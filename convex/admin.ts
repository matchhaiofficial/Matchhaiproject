import { hashPassword } from "better-auth/crypto";
import { v } from "convex/values";

import { components, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { migrateZoneBranchesInternal } from "./zoneBranchMigration";
import { notifyKycStatusUpdated } from "./kycNotifications";
import { notifyZoneAdminWithdrawalDecision } from "./withdrawalNotifications";
import { performAdminCancel } from "./matchrooms";

// Backend authorization email source. Prefer a SERVER-ONLY env var
// (SUPER_ADMIN_EMAIL) so the super-admin identity is not shipped in the public
// client bundle. Falls back to the legacy EXPO_PUBLIC_ var for backwards compat.
// IMPORTANT: there is NO hardcoded default — if neither env is configured the
// allowlist is empty and super-admin access fails closed (CR-03).
const SUPER_ADMIN_EMAIL = (
  process.env.SUPER_ADMIN_EMAIL ||
  process.env.EXPO_PUBLIC_SUPER_ADMIN_EMAIL ||
  ""
).trim().toLowerCase();

// Canonical super-admin role string. The rest of the app uses "super_admin"
// (underscore); legacy data may contain "super-admin" (hyphen) which we still
// accept on read so existing admins are never locked out (CR-05).
const SUPER_ADMIN_ROLE = "super_admin";
const LEGACY_SUPER_ADMIN_ROLE = "super-admin";
const ACTIVE_USER_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const SUPER_ADMIN_ALLOWLIST_NAMES = ["Junaid", "Ehteshan", "Zeerak", "Mubeen", "Saad", "Ovais"] as const;
const SUPER_ADMIN_ALLOWLIST_ENV_KEYS: Record<(typeof SUPER_ADMIN_ALLOWLIST_NAMES)[number], string> = {
  Junaid: "SUPER_ADMIN_EMAIL_JUNAID",
  Ehteshan: "SUPER_ADMIN_EMAIL_EHTESHAN",
  Zeerak: "SUPER_ADMIN_EMAIL_ZEERAK",
  Mubeen: "SUPER_ADMIN_EMAIL_MUBEEN",
  Saad: "SUPER_ADMIN_EMAIL_SAAD",
  Ovais: "SUPER_ADMIN_EMAIL_OVAIS",
};

type SuperAdminAuditStatus = "success" | "failed" | "denied";

type SuperAdminAllowlistEntry = {
  displayName: string;
  email: string;
  role: "super_admin";
  permissions?: string[];
  isActive: boolean;
};

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function normalizeUsername(username: string) {
  return String(username || "").trim().toLowerCase();
}

function normalizePhone(phone?: string | null) {
  const trimmed = String(phone || "").trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return undefined;
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("92")) return `+${digits}`;
  if (digits.startsWith("0")) return `+92${digits.slice(1)}`;
  return `+${digits}`;
}

function addMonthsClamped(timestamp: number, months: number) {
  const start = new Date(timestamp);
  const target = new Date(timestamp);
  const day = start.getDate();
  target.setDate(1);
  target.setMonth(target.getMonth() + months);
  const lastDayOfTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDayOfTargetMonth));
  return target.getTime();
}

function parseSuperAdminAllowlistJson(): SuperAdminAllowlistEntry[] {
  const raw = String(process.env.SUPER_ADMIN_ALLOWLIST_JSON || "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: any) => ({
        displayName: String(entry?.displayName || "").trim(),
        email: normalizeEmail(entry?.email || ""),
        role: "super_admin" as const,
        permissions: Array.isArray(entry?.permissions) ? entry.permissions.map(String) : undefined,
        isActive: entry?.isActive !== false,
      }))
      .filter((entry) => entry.displayName && entry.email);
  } catch {
    return [];
  }
}

function getSuperAdminAllowlist(): SuperAdminAllowlistEntry[] {
  const entries: SuperAdminAllowlistEntry[] = [];
  for (const displayName of SUPER_ADMIN_ALLOWLIST_NAMES) {
    const email = normalizeEmail(process.env[SUPER_ADMIN_ALLOWLIST_ENV_KEYS[displayName]] || "");
    if (email) entries.push({ displayName, email, role: "super_admin", isActive: true });
  }
  entries.push(...parseSuperAdminAllowlistJson());
  if (SUPER_ADMIN_EMAIL) {
    entries.push({ displayName: "MatchHai Super Admin", email: SUPER_ADMIN_EMAIL, role: "super_admin", isActive: true });
  }
  const byEmail = new Map<string, SuperAdminAllowlistEntry>();
  for (const entry of entries) {
    if (!byEmail.has(entry.email)) byEmail.set(entry.email, entry);
  }
  return Array.from(byEmail.values());
}

function findSuperAdminAllowlistEntry(email?: string | null) {
  const normalized = normalizeEmail(email || "");
  if (!normalized) return null;
  return getSuperAdminAllowlist().find((entry) => entry.email === normalized && entry.isActive) || null;
}

function isAuthorizedSuperAdmin(profile: any, email: string) {
  const role = profile?.role;
  const hasAdminRole = role === SUPER_ADMIN_ROLE || role === LEGACY_SUPER_ADMIN_ROLE;
  return Boolean(findSuperAdminAllowlistEntry(email) || hasAdminRole);
}

function resolveSuperAdminAuditIdentity(authUser: any, profile: any) {
  const email = normalizeEmail(authUser?.email || profile?.email || "");
  const allowlistEntry = findSuperAdminAllowlistEntry(email);
  return {
    superAdminUserId: profile?._id,
    superAdminAuthId: String(authUser?._id || authUser?.id || profile?.authId || ""),
    superAdminName: allowlistEntry?.displayName || profile?.fullName || profile?.username || "Unknown Super Admin",
    superAdminEmail: email || "unknown",
  };
}

function sanitizeAuditMetadata(value: any): any {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return value.slice(0, 240);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map(sanitizeAuditMetadata);
  if (typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [key, rawValue] of Object.entries(value).slice(0, 30)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("password") ||
        lowerKey.includes("token") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("cnic") ||
        lowerKey.includes("payload") ||
        lowerKey.includes("body") ||
        lowerKey.includes("conversation") ||
        lowerKey.includes("bankaccount") ||
        lowerKey.includes("accountnumber") ||
        lowerKey.includes("phone")
      ) {
        continue;
      }
      out[key] = sanitizeAuditMetadata(rawValue);
    }
    return out;
  }
  return undefined;
}

function redactSupportText(input: string) {
  return String(input || "")
    .replace(/\b(?:otp|pin|password|token|secret)\s*[:=]?\s*[A-Z0-9@#$%^&*._-]{3,}\b/gi, "[redacted-secret]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/(?:\+?92|0)?3[0-9][\s-]?[0-9]{3}[\s-]?[0-9]{4}\b/g, "[redacted-phone]")
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[redacted-card]")
    .replace(/\b(?:easypaisa|jazzcash|wallet)\s*[:=]?\s*(?:\+?92|0)?3[0-9][\s-]?[0-9]{3}[\s-]?[0-9]{4}\b/gi, "[redacted-wallet]")
    .replace(/\b\d{5}[-\s]?\d{7}[-\s]?\d\b/g, "[redacted-cnic]")
    .replace(/\b(?:EP|TXN|TRX|PAY|ORD|REF)[-_]?(?=[A-Z0-9-]*\d)[A-Z0-9-]{6,}\b/gi, "[redacted-reference]")
    .replace(/\b[A-F0-9]{12,}\b/gi, "[redacted-id]");
}

function supportRecipientRole(value?: string | null): "player" | "zone_admin" {
  return value === "zone_admin" || value === "zone" ? "zone_admin" : "player";
}

function supportRouteForRecipientRole(role: "player" | "zone_admin") {
  return role === "zone_admin" ? "/zone/modules/ai-support" : "/(player)/support";
}

function maskAdminEmail(email?: string | null) {
  const text = normalizeEmail(email || "");
  const [local, domain] = text.split("@");
  if (!local || !domain) return null;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function truncateAdminProviderText(value?: string | null, maxLength = 180) {
  const sanitized = redactSupportText(String(value || "").replace(/\s+/g, " ").trim());
  if (!sanitized) return { text: null, truncated: false };
  if (sanitized.length <= maxLength) return { text: sanitized, truncated: false };
  return { text: `${sanitized.slice(0, maxLength - 3).trimEnd()}...`, truncated: true };
}

async function notifySupportTicketStatusChanged(ctx: any, ticket: any, status: "open" | "in_review" | "resolved") {
  const recipientRole = supportRecipientRole(ticket.userRole);
  const route = supportRouteForRecipientRole(recipientRole);
  await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
    type: "support.ticket_status_changed",
    toUid: ticket.userId,
    recipientRole,
    status: "pending",
    dedupeKey: `support.ticket_status_changed:${String(ticket._id)}:${status}`,
    dedupePolicy: "replace_active",
    pushPolicy: "eligible",
    route,
    entity: { kind: "supportTicket", id: String(ticket._id) },
    entityId: String(ticket._id),
    title: "Support ticket updated",
    body: `Your support ticket ${ticket.reference} has been updated.`,
    data: {
      ticketId: String(ticket._id),
      ticketReference: ticket.reference,
      status,
      userRole: ticket.userRole || null,
      route,
      href: route,
    },
  });
}

function serializeAdminNotification(notification: any) {
  if (!notification) return null;
  return {
    id: String(notification._id),
    _id: String(notification._id),
    type: notification.type,
    status: notification.status,
    title: notification.title || "",
    body: notification.body || "",
    route: notification.route || notification.data?.href || notification.data?.route || null,
    data: notification.data || null,
    isRead: notification.isRead === true,
    isArchived: notification.isArchived === true,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  };
}

async function getOwnedAdminNotification(ctx: any, adminUserId: Id<"users">, notificationId: Id<"notifications">) {
  const notification = await ctx.db.get(notificationId);
  if (!notification || String(notification.toUid) !== String(adminUserId)) {
    throw new Error("Notification not found.");
  }
  if (notification.recipientRole && notification.recipientRole !== "super_admin") {
    throw new Error("Notification not found.");
  }
  return notification;
}

async function insertSuperAdminAuditLog(
  ctx: any,
  admin: { authUser?: any; profile?: any } | null,
  input: {
    action: string;
    module: string;
    targetType?: string;
    targetId?: string;
    status: SuperAdminAuditStatus;
    reason?: string;
    metadataSafe?: any;
  },
) {
  const identity = resolveSuperAdminAuditIdentity(admin?.authUser, admin?.profile);
  await ctx.db.insert("superAdminAuditLogs", {
    superAdminUserId: identity.superAdminUserId,
    superAdminAuthId: identity.superAdminAuthId || undefined,
    superAdminName: identity.superAdminName,
    superAdminEmail: identity.superAdminEmail,
    action: input.action,
    module: input.module,
    targetType: input.targetType,
    targetId: input.targetId,
    status: input.status,
    reason: input.reason?.slice(0, 240),
    metadataSafe: sanitizeAuditMetadata(input.metadataSafe),
    createdAt: Date.now(),
  });
}

async function getAuthenticatedAdmin(ctx: any, sessionToken: string) {
  const session = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "session",
    where: [{ field: "token", operator: "eq", value: sessionToken }],
  });

  if (!session?.userId || session.expiresAt <= Date.now()) {
    throw new Error("Unauthenticated");
  }

  const authUser = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "_id", operator: "eq", value: session.userId }],
  });

  if (!authUser) {
    throw new Error("Unauthenticated");
  }

  const profile = await ctx.db
    .query("users")
    .withIndex("by_authId", (q: any) => q.eq("authId", session.userId))
    .unique();

  const email = normalizeEmail(authUser.email || "");
  const isSuperAdmin = isAuthorizedSuperAdmin(profile, email);

  if (!profile || !isSuperAdmin) {
    throw new Error("Super admin access required");
  }

  return { authUser, profile };
}

async function getAuditIdentityFromSession(ctx: any, sessionToken: string) {
  const session = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "session",
    where: [{ field: "token", operator: "eq", value: sessionToken }],
  });
  if (!session?.userId) return { authUser: null, profile: null };
  const [authUser, profile] = await Promise.all([
    ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "_id", operator: "eq", value: session.userId }],
    }),
    ctx.db
      .query("users")
      .withIndex("by_authId", (q: any) => q.eq("authId", session.userId))
      .unique(),
  ]);
  return { authUser, profile };
}

function toCountMap<T extends string>(items: Array<T>) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {});
}

function formatSupportTicketExcerpt(ticket: any) {
  const messages = Array.isArray(ticket.conversationExcerpt) ? ticket.conversationExcerpt : [];
  const lastUserMessage = [...messages].reverse().find((message) => message?.role === "user");
  const fallback = messages[messages.length - 1];
  return String(lastUserMessage?.text || fallback?.text || "").slice(0, 180);
}

function summarizeSupportTicketMetadata(metadata: any) {
  const knownNonSensitiveDetails = metadata?.knownNonSensitiveDetails || {};
  const safeSupportContext = metadata?.safeSupportContext || {};
  return {
    knownNonSensitiveDetails,
    emailStatus: metadata?.emailStatus || safeSupportContext?.emailStatus || "not_configured",
    aiSummary: metadata?.aiSummary || metadata?.summary,
    user: safeSupportContext?.user
      ? {
          role: safeSupportContext.user.role,
          accountType: safeSupportContext.user.accountType,
          displayName: safeSupportContext.user.displayName,
          username: safeSupportContext.user.username,
          onboardingCompleted: safeSupportContext.user.onboardingCompleted,
          onboardingStep: safeSupportContext.user.onboardingStep,
          isVerified: safeSupportContext.user.isVerified,
          city: safeSupportContext.user.city,
        }
      : undefined,
    zones: Array.isArray(safeSupportContext?.zones)
      ? safeSupportContext.zones.slice(0, 3).map((zone: any) => ({
          id: zone.id,
          name: zone.name,
          status: zone.status,
          onboardingStep: zone.onboardingStep,
          city: zone.city,
          branchCount: zone.branchCount,
          primaryBranch: zone.primaryBranch,
        }))
      : [],
    recentPayments: Array.isArray(safeSupportContext?.recentPayments)
      ? safeSupportContext.recentPayments.slice(0, 3).map((payment: any) => ({
          id: payment.id,
          kind: payment.kind,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          maskedReference: payment.maskedReference || payment.orderRefNum,
          providerStatus: payment.providerStatus,
          providerReference: payment.providerReference,
          createdAt: payment.createdAt,
        }))
      : [],
    recentMatchrooms: Array.isArray(safeSupportContext?.recentMatchrooms)
      ? safeSupportContext.recentMatchrooms.slice(0, 3).map((room: any) => ({
          id: room.id,
          title: room.title,
          game: room.game,
          status: room.status,
          paymentStatus: room.paymentStatus,
          paymentAmount: room.paymentAmount,
          scheduledDate: room.scheduledDate,
          scheduledTime: room.scheduledTime,
          createdAt: room.createdAt,
        }))
      : [],
    recentReports: Array.isArray(safeSupportContext?.recentReports)
      ? safeSupportContext.recentReports.slice(0, 3)
      : [],
  };
}

function isZoneWithdrawalRequest(row: any) {
  return row?.type === "withdrawal" && row?.metadata?.source === "zone_admin_withdrawal_request";
}

async function countUnreadSuperAdminNotifications(ctx: any, adminUserId: Id<"users">, limit = 300) {
  const cappedLimit = Math.min(Math.max(limit, 1), 1000);
  const notifications = await ctx.db
    .query("notifications")
    .withIndex("by_toUid", (q: any) => q.eq("toUid", adminUserId))
    .order("desc")
    .take(cappedLimit);
  return {
    count: notifications.filter((notification: any) =>
      notification.isArchived !== true
      && notification.isRead !== true
      && (!notification.recipientRole || notification.recipientRole === "super_admin")
    ).length,
    capped: notifications.length >= cappedLimit,
  };
}

function sanitizeWithdrawalDecisionReason(reason: string) {
  return String(reason || "")
    .trim()
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, "[number]")
    .slice(0, 300);
}

function serializeAdminZoneWithdrawal(row: any) {
  const metadata = row.metadata || {};
  return {
    id: String(row._id),
    _id: row._id,
    userId: String(row.userId),
    amount: Number(row.amount || 0),
    status: row.status,
    reference: row.reference || null,
    createdAt: row.createdAt,
    branchId: metadata.branchId || null,
    branchName: metadata.branchName || null,
    venueName: metadata.venueName || null,
    bankName: metadata.bankName || null,
    accountNumberMasked: metadata.accountNumberMasked || null,
    accountNumberLast4: metadata.accountNumberLast4 || null,
    ownerName: metadata.ownerName || null,
    adminDecision: metadata.adminDecision || null,
    decidedAt: metadata.decidedAt || null,
  };
}

const KARACHI_OFFSET_MS = 5 * 60 * 60 * 1000;

function getKarachiPeriodStarts(now = Date.now()) {
  const local = new Date(now + KARACHI_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const date = local.getUTCDate();
  const startOfToday = Date.UTC(year, month, date) - KARACHI_OFFSET_MS;
  const day = local.getUTCDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  const startOfWeek = Date.UTC(year, month, date - mondayOffset) - KARACHI_OFFSET_MS;
  const startOfMonth = Date.UTC(year, month, 1) - KARACHI_OFFSET_MS;
  return { startOfToday, startOfWeek, startOfMonth };
}

function addToZoneFinanceBucket(
  buckets: Map<string, any>,
  key: string,
  seed: Partial<{
    zoneId: string | null;
    zoneName: string | null;
    zoneAdminId: string | null;
    zoneAdminName: string | null;
    zoneAdminEmail: string | null;
    availableBalance: number | null;
  }>,
) {
  const existing = buckets.get(key);
  if (existing) {
    Object.assign(existing, Object.fromEntries(Object.entries(seed).filter(([, value]) => value !== undefined && value !== null)));
    return existing;
  }
  const next = {
    id: key,
    zoneId: seed.zoneId || null,
    zoneName: seed.zoneName || "Unknown zone",
    zoneAdminId: seed.zoneAdminId || null,
    zoneAdminName: seed.zoneAdminName || "Unknown admin",
    zoneAdminEmail: seed.zoneAdminEmail || null,
    earnedToday: 0,
    earnedThisWeek: 0,
    earnedThisMonth: 0,
    withdrawnToday: 0,
    withdrawnThisWeek: 0,
    withdrawnThisMonth: 0,
    pendingWithdrawalAmount: 0,
    availableBalance: seed.availableBalance ?? null,
    lastWithdrawalAt: null as number | null,
  };
  buckets.set(key, next);
  return next;
}

function previewFromReportMessage(report: any, message: any, textField: "content" | "text" = "content") {
  if (report?.messagePreview) return String(report.messagePreview).slice(0, 300);
  if (!message) return null;
  const type = String(message.type || "text");
  if (type === "voice") return "Voice message";
  if (type === "image") return "Photo";
  if (type === "file") return message.attachment?.fileName ? `File: ${String(message.attachment.fileName).slice(0, 120)}` : "File";
  return String(message[textField] || "").trim().slice(0, 300) || null;
}

async function enrichAdminReport(ctx: any, report: any, includeDetail = false) {
  const [
    reporter,
    reportedUser,
    zone,
    matchroom,
    reviewedBy,
    resolvedBy,
    chatroom,
    chatMessage,
    teamChallengeMessage,
    supportTicket,
  ] = await Promise.all([
    ctx.db.get(report.reporterUid),
    report.reportedUserId ? ctx.db.get(report.reportedUserId) : Promise.resolve(null),
    report.zoneId ? ctx.db.get(report.zoneId) : Promise.resolve(null),
    report.matchroomId ? ctx.db.get(report.matchroomId) : Promise.resolve(null),
    includeDetail && report.reviewedByUid ? ctx.db.get(report.reviewedByUid) : Promise.resolve(null),
    includeDetail && report.resolvedByUid ? ctx.db.get(report.resolvedByUid) : Promise.resolve(null),
    report.chatroomId ? ctx.db.get(report.chatroomId) : Promise.resolve(null),
    includeDetail && report.chatMessageId ? ctx.db.get(report.chatMessageId) : Promise.resolve(null),
    includeDetail && report.teamChallengeChatMessageId ? ctx.db.get(report.teamChallengeChatMessageId) : Promise.resolve(null),
    report.supportTicketId ? ctx.db.get(report.supportTicketId) : Promise.resolve(null),
  ]);

  let chatContextLabel: string | null = null;
  if (report.type === "friend_chat_message_report") chatContextLabel = "Friend chat message";
  if (report.type === "matchroom_chat_message_report") chatContextLabel = "Matchroom chat message";
  if (report.type === "team_challenge_chat_message_report") chatContextLabel = "Team challenge chat message";
  if (report.source === "support_chatbot_moderation_report") chatContextLabel = "Support chatbot moderation report";

  const targetMissing = Boolean(
    (report.chatMessageId && includeDetail && !chatMessage)
    || (report.teamChallengeChatMessageId && includeDetail && !teamChallengeMessage)
    || (report.matchroomId && !matchroom)
    || (report.zoneId && !zone)
    || (report.reportedUserId && !reportedUser)
    || (report.supportTicketId && !supportTicket)
  );

  return {
    id: report._id,
    ...report,
    chatroomId: report.chatroomId ? String(report.chatroomId) : null,
    chatMessageId: report.chatMessageId ? String(report.chatMessageId) : null,
    teamChallengeChatId: report.teamChallengeChatId ? String(report.teamChallengeChatId) : null,
    teamChallengeChatMessageId: report.teamChallengeChatMessageId ? String(report.teamChallengeChatMessageId) : null,
    supportConversationId: report.supportConversationId ? String(report.supportConversationId) : null,
    supportTicketId: report.supportTicketId ? String(report.supportTicketId) : null,
    source: report.source || null,
    targetType: report.targetType || null,
    targetReference: report.targetReference || null,
    chatContextLabel,
    messagePreview: previewFromReportMessage(
      report,
      chatMessage || teamChallengeMessage,
      teamChallengeMessage ? "text" : "content",
    ),
    targetMissing,
    reporterName: reporter?.fullName || reporter?.username || "Unknown user",
    reportedUserName: reportedUser?.fullName || reportedUser?.username || null,
    reportedUserStatus: reportedUser?.accountStatus || (reportedUser ? "active" : null),
    zoneName: zone?.venueBrandName || zone?.name || null,
    zoneStatus: zone?.status || null,
    matchroomTitle: matchroom?.title || null,
    matchroomStatus: matchroom?.status || null,
    reviewedByName: reviewedBy?.fullName || reviewedBy?.username || null,
    resolvedByName: resolvedBy?.fullName || resolvedBy?.username || null,
  };
}

function buildWithdrawalDecisionMetadata(row: any, input: {
  adminUserId: Id<"users">;
  decision: "approved" | "rejected";
  now: number;
  rejectionReasonSafe?: string;
}) {
  return {
    ...(row.metadata || {}),
    adminDecision: input.decision,
    decidedAt: input.now,
    decidedBy: String(input.adminUserId),
    ...(input.rejectionReasonSafe ? { rejectionReasonSafe: input.rejectionReasonSafe } : {}),
  };
}

async function serializeSupportTicket(ctx: any, ticket: any, includeDetail = false) {
  const user = await ctx.db.get(ticket.userId);
  const assignedAdmin = ticket.assignedAdminId ? await ctx.db.get(ticket.assignedAdminId) : null;
  const base = {
    id: ticket._id,
    _id: ticket._id,
    reference: ticket.reference,
    userRole: ticket.userRole,
    category: ticket.category,
    subcategory: ticket.subcategory,
    intent: ticket.intent,
    priority: ticket.priority,
    issueSummary: ticket.issueSummary,
    suggestedAdminAction: ticket.suggestedAdminAction,
    relatedMatchroomId: ticket.relatedMatchroomId ? String(ticket.relatedMatchroomId) : undefined,
    relatedPaymentId: ticket.relatedPaymentId ? String(ticket.relatedPaymentId) : undefined,
    relatedBookingId: ticket.relatedBookingId ? String(ticket.relatedBookingId) : undefined,
    relatedTeamId: ticket.relatedTeamId ? String(ticket.relatedTeamId) : undefined,
    relatedZoneId: ticket.relatedZoneId ? String(ticket.relatedZoneId) : undefined,
    conversationId: ticket.conversationId ? String(ticket.conversationId) : undefined,
    assignedAdminId: ticket.assignedAdminId ? String(ticket.assignedAdminId) : undefined,
    assignedAdminName: assignedAdmin?.fullName || assignedAdmin?.username || undefined,
    lastAdminResponseAt: ticket.lastAdminResponseAt,
    lastUserResponseAt: ticket.lastUserResponseAt,
    resolutionSummary: ticket.resolutionSummary,
    internalTags: ticket.internalTags || [],
    status: ticket.status,
    source: ticket.source,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    userDisplayName: user?.fullName || user?.username || "Unknown user",
    userEmail: user?.email,
    excerptPreview: formatSupportTicketExcerpt(ticket),
  };

  if (!includeDetail) return base;

  const [notes, supportMessages] = await Promise.all([
    ctx.db
      .query("supportTicketNotes")
      .withIndex("by_ticketId_createdAt", (q: any) => q.eq("ticketId", ticket._id))
      .order("asc")
      .take(50),
    ticket.conversationId
      ? ctx.db
          .query("supportMessages")
          .withIndex("by_conversationId_createdAt", (q: any) => q.eq("conversationId", ticket.conversationId))
          .order("asc")
          .take(80)
      : Promise.resolve([]),
  ]);

  return {
    ...base,
    conversationExcerpt: ticket.conversationExcerpt || [],
    internalNotes: notes.map((note: any) => ({
      id: String(note._id),
      author: note.author,
      adminId: note.adminId ? String(note.adminId) : undefined,
      text: note.textRedacted,
      createdAt: note.createdAt,
    })),
    conversationMessages: supportMessages.map((message: any) => ({
      id: String(message._id),
      role: message.role,
      text: message.textRedacted,
      createdAt: message.createdAt,
      metadata: message.metadata,
    })),
    metadataSummary: summarizeSupportTicketMetadata(ticket.metadata),
  };
}

function zoneStatusNotificationCopy(status: string, rejectionReason?: string | null) {
  switch (status) {
    case "active":
      return {
        title: "Zone approved",
        body: "Your zone is now active and available in MatchHai.",
      };
    case "approved_pending_migration":
      return {
        title: "Zone approved",
        body: "Your zone was approved and is being prepared for activation.",
      };
    case "rejected":
      return {
        title: "Zone rejected",
        body: rejectionReason?.trim()
          ? `Your zone submission was rejected: ${rejectionReason.trim()}`
          : "Your zone submission was rejected.",
      };
    case "suspended":
      return {
        title: "Zone suspended",
        body: "Your zone has been suspended. Review the admin notes for next steps.",
      };
    case "pending-review":
    default:
      return {
        title: "Zone pending review",
        body: "Your zone is pending super-admin review.",
      };
  }
}

export const getDashboardSummary = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const badgeCountLimit = 100;
    const unreadNotificationLimit = 300;

    const [
      allUsers,
      activeZones,
      pendingZones,
      pendingMigrationZones,
      rejectedZones,
      suspendedZones,
      pendingReports,
      reviewedReports,
      resolvedReports,
      openMatches,
      inProgressMatches,
      completedMatches,
      legacyPaidBookingPayments,
      capturedBookingPayments,
      legacyBookingWalletPayments,
      teams,
      notStartedKyc,
      pendingKyc,
      inProgressKyc,
      inReviewKyc,
      openSupportTickets,
      inReviewSupportTickets,
      pendingWithdrawalCandidates,
      unreadNotifications,
    ] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("zones").withIndex("by_status", (q) => q.eq("status", "active")).collect(),
      ctx.db.query("zones").withIndex("by_status", (q) => q.eq("status", "pending-review")).collect(),
      ctx.db.query("zones").withIndex("by_status", (q) => q.eq("status", "approved_pending_migration")).collect(),
      ctx.db.query("zones").withIndex("by_status", (q) => q.eq("status", "rejected")).collect(),
      ctx.db.query("zones").withIndex("by_status", (q) => q.eq("status", "suspended")).collect(),
      ctx.db.query("reports").withIndex("by_status", (q) => q.eq("status", "pending")).collect(),
      ctx.db.query("reports").withIndex("by_status", (q) => q.eq("status", "reviewed")).collect(),
      ctx.db.query("reports").withIndex("by_status", (q) => q.eq("status", "resolved")).collect(),
      ctx.db.query("matchrooms").withIndex("by_status", (q) => q.eq("status", "open")).collect(),
      ctx.db.query("matchrooms").withIndex("by_status", (q) => q.eq("status", "in-progress")).collect(),
      ctx.db.query("matchrooms").withIndex("by_status", (q) => q.eq("status", "completed")).collect(),
      ctx.db.query("paymentTransactions").withIndex("by_status", (q) => q.eq("status", "paid")).collect(),
      ctx.db.query("walletTransactions").withIndex("by_type", (q) => q.eq("type", "hold_capture")).collect(),
      ctx.db.query("walletTransactions").withIndex("by_type", (q) => q.eq("type", "booking_payment")).collect(),
      ctx.db.query("teams").collect(),
      ctx.db.query("identityVerifications").withIndex("by_status_and_submittedAt", (q) => q.eq("status", "not_started")).take(badgeCountLimit),
      ctx.db.query("identityVerifications").withIndex("by_status_and_submittedAt", (q) => q.eq("status", "pending")).take(badgeCountLimit),
      ctx.db.query("identityVerifications").withIndex("by_status_and_submittedAt", (q) => q.eq("status", "in_progress")).take(badgeCountLimit),
      ctx.db.query("identityVerifications").withIndex("by_status_and_submittedAt", (q) => q.eq("status", "in_review")).take(badgeCountLimit),
      ctx.db.query("supportTickets").withIndex("by_status_createdAt", (q) => q.eq("status", "open")).take(badgeCountLimit),
      ctx.db.query("supportTickets").withIndex("by_status_createdAt", (q) => q.eq("status", "in_review")).take(badgeCountLimit),
      ctx.db.query("walletTransactions").withIndex("by_type_and_status", (q) => q.eq("type", "withdrawal").eq("status", "pending")).take(badgeCountLimit),
      countUnreadSuperAdminNotifications(ctx, admin.profile._id, unreadNotificationLimit),
    ]);

    const pendingKycRows = [
      ...notStartedKyc,
      ...pendingKyc,
      ...inProgressKyc,
      ...inReviewKyc,
    ];
    const pendingZoneWithdrawalRows = pendingWithdrawalCandidates.filter(isZoneWithdrawalRequest);

    const legacyBookingWalletReferences = new Set(
      legacyBookingWalletPayments
        .map((row) => String(row.reference || ""))
        .filter(Boolean),
    );
    const legacyPaymentRevenue = legacyPaidBookingPayments
      .filter((row) => row.kind === "booking_intent")
      .filter((row) => row.providerPayload?.bookingFundsMode !== "wallet_hold")
      .filter((row) => !legacyBookingWalletReferences.has(`easypaisa:${row.orderRefNum}`))
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const capturedBookingRevenue = capturedBookingPayments.reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0,
    );
    const legacyBookingWalletRevenue = legacyBookingWalletPayments.reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0,
    );

    const userRoles = toCountMap(allUsers.map((user) => user.role || "none"));
    const accountTypes = toCountMap(allUsers.map((user) => user.accountType || "unknown"));
    const activeCutoff = Date.now() - ACTIVE_USER_WINDOW_MS;
    const activeUsers30d = allUsers.filter((user) => Number(user.lastActiveAt || 0) >= activeCutoff).length;

    return {
      counts: {
        users: allUsers.length,
        zones: activeZones.length + pendingZones.length + pendingMigrationZones.length + rejectedZones.length + suspendedZones.length,
        reports: pendingReports.length + reviewedReports.length + resolvedReports.length,
        matchrooms: openMatches.length + inProgressMatches.length + completedMatches.length,
        teams: teams.length,
      },
      users: {
        active30d: activeUsers30d || allUsers.length,
        activeSource: activeUsers30d ? "lastActiveAt" : "totalUsersFallback",
        players: accountTypes["player"] || 0,
        zoneAdmins: accountTypes["zone"] || 0,
        superAdmins: userRoles["super-admin"] || 0,
      },
      zones: {
        pending: pendingZones.length,
        pendingMigration: pendingMigrationZones.length,
        active: activeZones.length,
        rejected: rejectedZones.length,
        suspended: suspendedZones.length,
      },
      reports: {
        pending: pendingReports.length,
        reviewed: reviewedReports.length,
        resolved: resolvedReports.length,
      },
      matchrooms: {
        open: openMatches.length,
        inProgress: inProgressMatches.length,
        completed: completedMatches.length,
      },
      revenue: {
        total: capturedBookingRevenue + legacyBookingWalletRevenue + legacyPaymentRevenue,
        currency: "PKR",
      },
      badges: {
        pendingZones: pendingZones.length + pendingMigrationZones.length,
        pendingZonesCapped: false,
        pendingKyc: pendingKycRows.length,
        pendingKycCapped: [notStartedKyc, pendingKyc, inProgressKyc, inReviewKyc].some((rows) => rows.length >= badgeCountLimit),
        supportNeedsAttention: openSupportTickets.length + inReviewSupportTickets.length,
        supportNeedsAttentionCapped: [openSupportTickets, inReviewSupportTickets].some((rows) => rows.length >= badgeCountLimit),
        pendingReports: pendingReports.length,
        pendingWithdrawals: pendingZoneWithdrawalRows.length,
        pendingWithdrawalsCapped: pendingWithdrawalCandidates.length >= badgeCountLimit,
        unreadNotifications: unreadNotifications.count,
        unreadNotificationsCapped: unreadNotifications.capped,
      },
    };
  },
});

export const getSuperAdminAllowlistConfig = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await getAuthenticatedAdmin(ctx, args.sessionToken);
    return getSuperAdminAllowlist().map((entry) => ({
      displayName: entry.displayName,
      email: entry.email,
      role: entry.role,
      permissions: entry.permissions || [],
      isActive: entry.isActive,
    }));
  },
});

export const recordSuperAdminAudit = mutation({
  args: {
    sessionToken: v.string(),
    action: v.string(),
    module: v.string(),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    status: v.union(v.literal("success"), v.literal("failed"), v.literal("denied")),
    reason: v.optional(v.string()),
    metadataSafe: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    if (args.status === "denied") {
      const auditIdentity = await getAuditIdentityFromSession(ctx, args.sessionToken);
      await insertSuperAdminAuditLog(ctx, auditIdentity, {
        action: args.action,
        module: args.module,
        targetType: args.targetType,
        targetId: args.targetId,
        status: "denied",
        reason: args.reason || "not_authorized",
        metadataSafe: args.metadataSafe,
      });
      return { ok: true };
    }

    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    await insertSuperAdminAuditLog(ctx, admin, {
      action: args.action,
      module: args.module,
      targetType: args.targetType,
      targetId: args.targetId,
      status: args.status,
      reason: args.reason,
      metadataSafe: args.metadataSafe,
    });
    return { ok: true };
  },
});

export const listSuperAdminAuditLogs = query({
  args: {
    sessionToken: v.string(),
    superAdminEmail: v.optional(v.string()),
    action: v.optional(v.string()),
    module: v.optional(v.string()),
    status: v.optional(v.union(v.literal("success"), v.literal("failed"), v.literal("denied"))),
    targetId: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const limit = Math.max(1, Math.min(args.limit || 100, 200));
    let rows = await ctx.db.query("superAdminAuditLogs").withIndex("by_createdAt").order("desc").take(limit * 3);
    rows = rows.filter((row) => {
      if (args.superAdminEmail && row.superAdminEmail !== normalizeEmail(args.superAdminEmail)) return false;
      if (args.action && row.action !== args.action) return false;
      if (args.module && row.module !== args.module) return false;
      if (args.status && row.status !== args.status) return false;
      if (args.targetId && !String(row.targetId || "").toLowerCase().includes(args.targetId.toLowerCase())) return false;
      if (args.from && row.createdAt < args.from) return false;
      if (args.to && row.createdAt > args.to) return false;
      return true;
    });
    return rows.slice(0, limit).map((row) => ({
      id: row._id,
      superAdminUserId: row.superAdminUserId || null,
      superAdminAuthId: row.superAdminAuthId || null,
      superAdminName: row.superAdminName,
      superAdminEmail: row.superAdminEmail,
      action: row.action,
      module: row.module,
      targetType: row.targetType || null,
      targetId: row.targetId || null,
      status: row.status,
      reason: row.reason || null,
      metadataSafe: row.metadataSafe || null,
      createdAt: row.createdAt,
    }));
  },
});

export const listIdentityVerifications = query({
  args: {
    sessionToken: v.string(),
    status: v.optional(v.string()),
    role: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedAdmin(ctx, args.sessionToken);
    const limit = Math.max(1, Math.min(args.limit || 100, 200));
    const pendingLikeStatuses = new Set(["not_started", "pending", "in_progress", "in_review"]);
    const rows = args.status === "pending"
      ? (await ctx.db
          .query("identityVerifications")
          .order("desc")
          .take(Math.min(limit * 4, 500)))
          .filter((row) => pendingLikeStatuses.has(row.status))
          .slice(0, limit)
      : args.status
        ? await ctx.db
          .query("identityVerifications")
          .withIndex("by_status_and_submittedAt", (q) => q.eq("status", args.status as any))
          .order("desc")
          .take(limit)
        : await ctx.db.query("identityVerifications").order("desc").take(limit);
    const filtered = args.role ? rows.filter((row) => row.role === args.role) : rows;
    return await Promise.all(
      filtered.map(async (row) => {
        const user = await ctx.db.get(row.userId);
        return {
          id: row._id,
          userId: row.userId,
          userName: user?.fullName || user?.username || "Unknown user",
          userEmail: user?.email || null,
          role: row.role,
          provider: row.provider,
          workflowId: row.workflowId,
          status: row.status,
          submittedAt: row.submittedAt,
          verifiedAt: row.verifiedAt || null,
          rejectedAt: row.rejectedAt || null,
          rejectionReason: row.rejectionReason || null,
          emailVerificationStatus: row.emailVerificationStatus || null,
          idVerificationStatus: row.idVerificationStatus || null,
          livenessStatus: row.livenessStatus || null,
          faceMatchStatus: row.faceMatchStatus || null,
          amlStatus: row.amlStatus || null,
          ipAnalysisStatus: row.ipAnalysisStatus || null,
        };
      }),
    );
  },
});

export const manuallyVerifyIdentityVerification = mutation({
  args: {
    sessionToken: v.string(),
    verificationId: v.id("identityVerifications"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const reason = String(args.reason || "").trim();
    if (reason.length < 8) {
      throw new Error("Manual verification reason is required.");
    }

    const verification = await ctx.db.get(args.verificationId);
    if (!verification) throw new Error("Identity verification not found.");
    const user = await ctx.db.get(verification.userId);
    if (!user) throw new Error("User profile not found.");

    const now = Date.now();
    const safeReason = reason.slice(0, 240);

    await ctx.db.patch(args.verificationId, {
      status: "verified",
      decision: "manual_super_admin_approved",
      rejectionReason: undefined,
      verifiedAt: now,
      reviewedAt: now,
      updatedAt: now,
    });

    const userPatch: Record<string, unknown> = {
      kycVerificationStatus: "verified",
      kycVerifiedAt: now,
      kycProvider: "didit",
      identityVerificationId: String(args.verificationId),
      updatedAt: now,
    };

    let pendingEmailAuthSyncStatus: "not_attempted" | "synced" | "missing_auth_id" | "failed" = "not_attempted";
    if (user.pendingEmail) {
      const pendingEmailToSync = normalizeEmail(user.pendingEmail);
      if (user.authId) {
        try {
          await ctx.runMutation(components.betterAuth.adapter.updateOne, {
            input: {
              model: "user",
              where: [{ field: "_id", operator: "eq", value: user.authId }],
              update: {
                email: pendingEmailToSync,
                emailVerified: true,
                updatedAt: now,
              },
            },
          });
          userPatch.email = pendingEmailToSync;
          userPatch.pendingEmail = null;
          pendingEmailAuthSyncStatus = "synced";
        } catch {
          pendingEmailAuthSyncStatus = "failed";
        }
      } else {
        pendingEmailAuthSyncStatus = "missing_auth_id";
      }
    }

    await ctx.db.patch(verification.userId, userPatch);

    await insertSuperAdminAuditLog(ctx, admin, {
      action: "manual_kyc_verify",
      module: "identity",
      targetType: "identityVerification",
      targetId: String(args.verificationId),
      status: "success",
      reason: safeReason,
      metadataSafe: {
        userId: String(verification.userId),
        previousStatus: verification.status,
        role: verification.role,
        provider: verification.provider,
        pendingEmailAuthSyncStatus,
      },
    });

    if (verification.status !== "verified") {
      await notifyKycStatusUpdated(ctx, {
        verificationId: args.verificationId,
        userId: verification.userId,
        role: verification.role,
        status: "verified",
        now,
      });
    }

    return { ok: true };
  },
});

function isRoomFull(room: any) {
  const slots = [...(room.slotsA || []), ...(room.slotsB || [])];
  if (slots.length > 0) {
    return slots.every((slot: any) => String(slot?.status || "").toLowerCase() === "confirmed");
  }
  return Number(room.currentPlayers || 0) >= Number(room.maxPlayers || 0);
}

function needsZoneApproval(room: any) {
  return Boolean(room.zoneId || room.confirmedZoneId || room.locationMode === "zone" || room.broadcastRequestStatus);
}

function mapMatchroomLifecycle(room: any) {
  const status = String(room.status || "").toLowerCase();
  if (status === "in-progress") return "in-progress";
  if (status === "completed") return "completed";
  if (status === "cancelled" || status === "expired") return "cancelled_expired";

  const zoneApprovalNeeded = needsZoneApproval(room);
  const zoneApproved = !zoneApprovalNeeded || room.zoneAdminApproved === true || room.broadcastRequestStatus === "zone_confirmed";
  const paid = room.paymentStatus === "paid";

  if (!zoneApproved) return "waiting_zone_approval";
  if (!isRoomFull(room)) return "waiting_lobby_fill";
  if (paid || status === "locked") return "confirmed";
  return "created_open";
}

function mapAdminMatchroom(room: any) {
  return {
    id: room._id,
    _id: room._id,
    title: room.title,
    game: room.game,
    location: room.location || room.confirmedBranchId || room.branchId || "Location TBD",
    status: room.status,
    lifecycleStatus: mapMatchroomLifecycle(room),
    paymentStatus: room.paymentStatus || null,
    zoneAdminApproved: room.zoneAdminApproved ?? null,
    broadcastRequestStatus: room.broadcastRequestStatus || null,
    resultVerificationStatus: room.resultVerification?.status || null,
    scheduledDate: room.scheduledDate || null,
    scheduledTime: room.scheduledTime || null,
    scheduledStartAt: room.scheduledStartAt || room.startTime || null,
    currentPlayers: room.currentPlayers,
    maxPlayers: room.maxPlayers,
    hostName: room.hostName,
    matchCode: room.matchCode || null,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };
}

export const listSuperAdminMatchrooms = query({
  args: {
    sessionToken: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedAdmin(ctx, args.sessionToken);
    const limit = Math.max(1, Math.min(args.limit || 100, 200));
    const docs = await ctx.db.query("matchrooms").withIndex("by_createdAt").order("desc").take(limit);
    return docs.map(mapAdminMatchroom);
  },
});

export const getSuperAdminMatchroomById = query({
  args: {
    sessionToken: v.string(),
    matchroomId: v.id("matchrooms"),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedAdmin(ctx, args.sessionToken);
    const room = await ctx.db.get(args.matchroomId);
    if (!room) return null;
    const [zone, host] = await Promise.all([
      room.zoneId ? ctx.db.get(room.zoneId as Id<"zones">) : Promise.resolve(null),
      ctx.db
        .query("users")
        .withIndex("by_authId", (q: any) => q.eq("authId", String(room.hostUid || "")))
        .unique()
        .catch(() => null),
    ]);
    return {
      ...mapAdminMatchroom(room),
      description: room.description || null,
      zoneName: zone?.venueBrandName || zone?.name || null,
      hostUserName: host?.fullName || host?.username || room.hostName || null,
      players: room.players || [],
      slotsA: room.slotsA || [],
      slotsB: room.slotsB || [],
      pricing: room.pricing,
    };
  },
});

export const listEasypaisaTransactions = query({
  args: {
    sessionToken: v.string(),
    orderRefNum: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedAdmin(ctx, args.sessionToken);

    const limit = Math.max(1, Math.min(args.limit || 20, 50));
    const orderRefFilter = String(args.orderRefNum || "").trim().toLowerCase();
    const statuses = [
      "created",
      "redirected",
      "token_received",
      "pending",
      "paid",
      "failed",
      "expired",
      "cancelled",
    ] as const;

    const grouped = await Promise.all(
      statuses.map((status) =>
        ctx.db
          .query("paymentTransactions")
          .withIndex("by_status", (q) => q.eq("status", status))
          .order("desc")
          .take(limit)
      )
    );

    const deduped = new Map<string, any>();
    for (const rows of grouped) {
      for (const row of rows) {
        deduped.set(String(row._id), row);
      }
    }

    const filtered = [...deduped.values()]
      .filter((row) => {
        if (row.provider !== "easypaisa") return false;
        if (!orderRefFilter) return true;
        return String(row.orderRefNum || "").toLowerCase().includes(orderRefFilter);
      })
      .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0))
      .slice(0, limit);

    return await Promise.all(filtered.map(async (row) => {
      const owner: any = await ctx.db.get(row.userId);
      return {
        id: row._id,
        _id: row._id,
        kind: row.kind,
        amount: row.amount,
        currency: row.currency,
        orderRefNum: row.orderRefNum,
        status: row.status,
        accountOwnerName: owner?.fullName || owner?.username || "Unknown user",
        providerStatus: row.providerStatus || null,
        providerDescription: row.providerDescription || null,
        providerReference: row.providerReference || null,
        processedAt: row.processedAt || null,
        lastError: row.lastError || null,
        callbackCount: row.callbackCount || 0,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        providerPayload: {
          ipn: row.providerPayload?.ipn || null,
          hosted: row.providerPayload?.hosted || null,
          lastProviderStatus: row.providerPayload?.lastProviderStatus || null,
          lastSyncAt: row.providerPayload?.lastSyncAt || null,
          flow: row.providerPayload?.flow || null,
        },
      };
    }));
  },
});

export const getPaymentDetailByOrderRefNum = query({
  args: {
    sessionToken: v.string(),
    orderRefNum: v.string(),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedAdmin(ctx, args.sessionToken);

    const orderRefNum = String(args.orderRefNum || "").trim();
    if (!orderRefNum) return null;

    const paymentRows = await ctx.db
      .query("paymentTransactions")
      .withIndex("by_orderRefNum", (q) => q.eq("orderRefNum", orderRefNum))
      .collect();

    const payment = paymentRows
      .filter((row) => row.provider === "easypaisa")
      .sort((left, right) => {
        const createdDiff = Number(right.createdAt || 0) - Number(left.createdAt || 0);
        if (createdDiff !== 0) return createdDiff;
        return Number(right._creationTime || 0) - Number(left._creationTime || 0);
      })[0];

    if (!payment) return null;

    const walletRows = await ctx.db
      .query("walletTransactions")
      .withIndex("by_reference", (q) => q.eq("reference", `easypaisa:${orderRefNum}`))
      .collect();
    const walletTransaction = walletRows
      .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0))[0] || null;

    const [bookingIntent, linkedUser] = await Promise.all([
      payment.bookingIntentId ? ctx.db.get(payment.bookingIntentId as Id<"bookingIntents">) : Promise.resolve(null),
      ctx.db.get(payment.userId),
    ]);
    const linkedMatchroom = bookingIntent?.matchroomId
      ? await ctx.db.get(bookingIntent.matchroomId as Id<"matchrooms">)
      : null;

    const providerDescription = truncateAdminProviderText(payment.providerDescription || null);
    const providerAnomaly = payment.providerPayload?.anomaly || null;
    const paymentIsPaid = payment.status === "paid";
    const walletTxExists = Boolean(walletTransaction);
    const bookingIntentMissing = payment.kind === "booking_intent" && Boolean(payment.bookingIntentId) && !bookingIntent;
    const matchroomMissing = Boolean(bookingIntent?.matchroomId) && !linkedMatchroom;
    const reconciliationMessages = [
      paymentIsPaid && !walletTxExists ? "Payment is paid but no linked wallet transaction was found." : null,
      walletTxExists && !paymentIsPaid ? "A linked wallet transaction exists while the payment is not paid." : null,
      paymentIsPaid && bookingIntent?.paymentStatus === "unpaid" ? "Payment is paid but the linked booking intent is still unpaid." : null,
      payment.status === "failed" && walletTxExists ? "Payment failed but a linked wallet transaction exists." : null,
      ["created", "redirected", "token_received", "pending"].includes(payment.status) && Boolean(payment.expiresAt) && Number(payment.expiresAt) < Date.now()
        ? "Payment is still pending after its expiry time."
        : null,
      bookingIntentMissing ? "Payment points to a booking intent that was not found." : null,
      matchroomMissing ? "Booking intent points to a matchroom that was not found." : null,
      providerAnomaly?.reason === "provider_amount_mismatch"
        ? "Provider amount does not match the expected payment amount."
        : null,
      providerAnomaly?.reason === "provider_order_reference_mismatch"
        ? "Provider order reference does not match this payment transaction."
        : null,
    ].filter(Boolean) as string[];

    return {
      paymentTransaction: {
        _id: String(payment._id),
        orderRefNum: payment.orderRefNum,
        kind: payment.kind,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        provider: payment.provider,
        paymentMethod: payment.paymentMethod || null,
        providerReference: payment.providerReference || null,
        providerStatus: payment.providerStatus || null,
        providerDescription: providerDescription.text,
        providerDescriptionTruncated: providerDescription.truncated,
        createdAt: payment.createdAt,
        expiresAt: payment.expiresAt || null,
        processedAt: payment.processedAt || null,
        updatedAt: payment.updatedAt,
        callbackCount: payment.callbackCount || 0,
        lastCallbackAt: payment.lastCallbackAt || null,
        lastError: payment.lastError || null,
      },
      providerContext: {
        flow: payment.providerPayload?.flow || null,
        lastSyncAt: payment.providerPayload?.lastSyncAt || null,
        lastProviderStatus: payment.providerPayload?.lastProviderStatus || null,
        anomaly: providerAnomaly
          ? {
              reason: providerAnomaly.reason || null,
              source: providerAnomaly.source || null,
              expectedOrderRefNum: providerAnomaly.expectedOrderRefNum || null,
              providerOrderRef: providerAnomaly.providerOrderRef || null,
              expectedAmount: typeof providerAnomaly.expectedAmount === "number" ? providerAnomaly.expectedAmount : null,
              providerAmount: typeof providerAnomaly.providerAmount === "number" ? providerAnomaly.providerAmount : null,
              detectedAt: typeof providerAnomaly.detectedAt === "number" ? providerAnomaly.detectedAt : null,
            }
          : null,
      },
      linkedWalletTransaction: walletTransaction
        ? {
            _id: String(walletTransaction._id),
            type: walletTransaction.type,
            status: walletTransaction.status,
            amount: walletTransaction.amount,
            createdAt: walletTransaction.createdAt,
            reference: walletTransaction.reference || null,
            metadataSource: walletTransaction.metadata?.source || null,
          }
        : null,
      linkedBookingIntent: bookingIntent
        ? {
            _id: String(bookingIntent._id),
            matchroomId: String(bookingIntent.matchroomId),
            paymentStatus: bookingIntent.paymentStatus,
            pricingTotalCost: bookingIntent.pricing?.totalCost || null,
            createdAt: bookingIntent.createdAt,
          }
        : null,
      linkedMatchroom: linkedMatchroom
        ? {
            _id: String(linkedMatchroom._id),
            title: linkedMatchroom.title || linkedMatchroom.matchCode || "Untitled matchroom",
            status: linkedMatchroom.status,
            scheduledDate: linkedMatchroom.scheduledDate || null,
            scheduledTime: linkedMatchroom.scheduledTime || null,
            scheduledStartAt: linkedMatchroom.scheduledStartAt || null,
            createdAt: linkedMatchroom.createdAt,
          }
        : null,
      linkedUser: linkedUser
        ? {
            _id: String(linkedUser._id),
            displayName: linkedUser.fullName || linkedUser.username || "Unknown user",
            username: linkedUser.username || null,
            emailMasked: maskAdminEmail(linkedUser.email),
          }
        : null,
      support: {
        orderRefNum: payment.orderRefNum,
        paymentTransactionId: String(payment._id),
        walletTransactionId: walletTransaction ? String(walletTransaction._id) : null,
        bookingIntentId: bookingIntent ? String(bookingIntent._id) : payment.bookingIntentId ? String(payment.bookingIntentId) : null,
        matchroomId: linkedMatchroom ? String(linkedMatchroom._id) : bookingIntent?.matchroomId ? String(bookingIntent.matchroomId) : null,
        userId: String(payment.userId),
      },
      reconciliation: {
        paymentPaidNoWalletTx: paymentIsPaid && !walletTxExists,
        walletTxWithoutPaid: walletTxExists && !paymentIsPaid,
        bookingIntentUnpaidButPaymentPaid: paymentIsPaid && bookingIntent?.paymentStatus === "unpaid",
        paymentFailedButWalletTxExists: payment.status === "failed" && walletTxExists,
        paymentPendingPastExpiry: ["created", "redirected", "token_received", "pending"].includes(payment.status)
          && Boolean(payment.expiresAt)
          && Number(payment.expiresAt) < Date.now(),
        bookingIntentMissing,
        matchroomMissing,
        messages: reconciliationMessages,
      },
    };
  },
});

// Read-only, additive payments list. Unlike listEasypaisaTransactions (per-status take +
// dedupe of ~20 rows), this orders by createdAt via index and supports server-side status,
// kind, date and amount filtering so the admin UI filters are honest. No payment/wallet/
// reconciliation WRITES occur here. Reconciliation flags are page-scoped and opt-in
// (includeReconciliation), computed only over the returned rows — never the full table.
export const listPaymentsV2 = query({
  args: {
    sessionToken: v.string(),
    status: v.optional(
      v.union(
        v.literal("created"),
        v.literal("redirected"),
        v.literal("token_received"),
        v.literal("pending"),
        v.literal("paid"),
        v.literal("failed"),
        v.literal("expired"),
        v.literal("cancelled"),
      ),
    ),
    kind: v.optional(v.union(v.literal("booking_intent"), v.literal("wallet_topup"))),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
    amountMin: v.optional(v.number()),
    amountMax: v.optional(v.number()),
    search: v.optional(v.string()),
    includeReconciliation: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedAdmin(ctx, args.sessionToken);

    const limit = Math.max(1, Math.min(args.limit || 50, 100));
    // Scan a wider window than `limit` because kind/amount/search are applied in memory.
    const scanLimit = Math.min(Math.max(limit * 5, limit), 500);
    const searchNeedle = String(args.search || "").trim().toLowerCase();

    // Push status + date bounds into the index range; createdAt ordering comes from the index.
    const rows = args.status
      ? await ctx.db
          .query("paymentTransactions")
          .withIndex("by_status_and_createdAt", (q: any) => {
            let r = q.eq("status", args.status);
            if (args.dateFrom !== undefined) r = r.gte("createdAt", args.dateFrom);
            if (args.dateTo !== undefined) r = r.lte("createdAt", args.dateTo);
            return r;
          })
          .order("desc")
          .take(scanLimit)
      : await ctx.db
          .query("paymentTransactions")
          .withIndex("by_createdAt", (q: any) => {
            let r = q;
            if (args.dateFrom !== undefined) r = r.gte("createdAt", args.dateFrom);
            if (args.dateTo !== undefined) r = r.lte("createdAt", args.dateTo);
            return r;
          })
          .order("desc")
          .take(scanLimit);

    const filtered = rows
      .filter((row) => {
        if (row.provider !== "easypaisa") return false;
        if (args.kind && row.kind !== args.kind) return false;
        const amount = Number(row.amount || 0);
        if (args.amountMin !== undefined && amount < args.amountMin) return false;
        if (args.amountMax !== undefined && amount > args.amountMax) return false;
        if (searchNeedle) {
          const haystack = `${row.orderRefNum || ""} ${row.providerReference || ""}`.toLowerCase();
          if (!haystack.includes(searchNeedle)) return false;
        }
        return true;
      })
      .slice(0, limit);

    return await Promise.all(
      filtered.map(async (row) => {
        const owner: any = await ctx.db.get(row.userId);
        const providerDescription = truncateAdminProviderText(row.providerDescription || null);

        let reconciliation: {
          paidNoWalletTx: boolean;
          walletTxWithoutPaid: boolean;
          bookingIntentUnpaidButPaymentPaid: boolean;
          pendingPastExpiry: boolean;
          failedButWalletTxExists: boolean;
        } | null = null;

        if (args.includeReconciliation) {
          // Page-scoped joins only (same lookups as getPaymentDetailByOrderRefNum). Read-only.
          const pendingPastExpiry =
            ["created", "redirected", "token_received", "pending"].includes(row.status) &&
            Boolean(row.expiresAt) &&
            Number(row.expiresAt) < Date.now();

          const walletRows = await ctx.db
            .query("walletTransactions")
            .withIndex("by_reference", (q) => q.eq("reference", `easypaisa:${row.orderRefNum}`))
            .collect();
          const walletTxExists = walletRows.length > 0;

          const bookingIntent = row.bookingIntentId
            ? await ctx.db.get(row.bookingIntentId as Id<"bookingIntents">)
            : null;
          const paymentIsPaid = row.status === "paid";

          reconciliation = {
            paidNoWalletTx: paymentIsPaid && !walletTxExists,
            walletTxWithoutPaid: walletTxExists && !paymentIsPaid,
            bookingIntentUnpaidButPaymentPaid: paymentIsPaid && bookingIntent?.paymentStatus === "unpaid",
            pendingPastExpiry,
            failedButWalletTxExists: row.status === "failed" && walletTxExists,
          };
        }

        return {
          id: row._id,
          _id: row._id,
          paymentTransactionId: String(row._id),
          orderRefNum: row.orderRefNum,
          kind: row.kind,
          status: row.status,
          amount: row.amount,
          currency: row.currency,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          processedAt: row.processedAt || null,
          expiresAt: row.expiresAt || null,
          providerStatus: row.providerStatus || null,
          providerReference: row.providerReference || null,
          providerDescription: providerDescription.text,
          accountOwnerName: owner?.fullName || owner?.username || "Unknown user",
          bookingIntentId: row.bookingIntentId ? String(row.bookingIntentId) : null,
          lastError: row.lastError || null,
          callbackCount: row.callbackCount || 0,
          providerPayload: {
            lastProviderStatus: row.providerPayload?.lastProviderStatus || null,
            lastSyncAt: row.providerPayload?.lastSyncAt || null,
            flow: row.providerPayload?.flow || null,
          },
          reconciliation,
        };
      }),
    );
  },
});

export const listPaymentsPageV2 = query({
  args: {
    sessionToken: v.string(),
    status: v.optional(v.union(
      v.literal("created"),
      v.literal("redirected"),
      v.literal("token_received"),
      v.literal("pending"),
      v.literal("paid"),
      v.literal("failed"),
      v.literal("expired"),
      v.literal("cancelled"),
    )),
    kind: v.optional(v.union(v.literal("booking_intent"), v.literal("wallet_topup"))),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
    amountMin: v.optional(v.number()),
    amountMax: v.optional(v.number()),
    search: v.optional(v.string()),
    includeReconciliation: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedAdmin(ctx, args.sessionToken);
    const limit = Math.max(1, Math.min(args.limit || 50, 100));
    const offset = Math.max(0, Number(args.cursor || 0) || 0);
    const scanLimit = Math.min(Math.max((offset + limit) * 5, limit), 1000);
    const searchNeedle = String(args.search || "").trim().toLowerCase();
    const rows = args.status
      ? await ctx.db
          .query("paymentTransactions")
          .withIndex("by_status_and_createdAt", (q: any) => {
            let r = q.eq("status", args.status);
            if (args.dateFrom !== undefined) r = r.gte("createdAt", args.dateFrom);
            if (args.dateTo !== undefined) r = r.lte("createdAt", args.dateTo);
            return r;
          })
          .order("desc")
          .take(scanLimit)
      : await ctx.db
          .query("paymentTransactions")
          .withIndex("by_createdAt", (q: any) => {
            let r = q;
            if (args.dateFrom !== undefined) r = r.gte("createdAt", args.dateFrom);
            if (args.dateTo !== undefined) r = r.lte("createdAt", args.dateTo);
            return r;
          })
          .order("desc")
          .take(scanLimit);

    const filtered = rows.filter((row) => {
      if (row.provider !== "easypaisa") return false;
      if (args.kind && row.kind !== args.kind) return false;
      const amount = Number(row.amount || 0);
      if (args.amountMin !== undefined && amount < args.amountMin) return false;
      if (args.amountMax !== undefined && amount > args.amountMax) return false;
      if (searchNeedle) {
        const haystack = `${row.orderRefNum || ""} ${row.providerReference || ""}`.toLowerCase();
        if (!haystack.includes(searchNeedle)) return false;
      }
      return true;
    });
    const pageRows = filtered.slice(offset, offset + limit);
    const page = await Promise.all(
      pageRows.map(async (row) => {
        const owner: any = await ctx.db.get(row.userId);
        const providerDescription = truncateAdminProviderText(row.providerDescription || null);
        return {
          id: row._id,
          _id: row._id,
          paymentTransactionId: String(row._id),
          orderRefNum: row.orderRefNum,
          kind: row.kind,
          status: row.status,
          amount: row.amount,
          currency: row.currency,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          processedAt: row.processedAt || null,
          expiresAt: row.expiresAt || null,
          providerStatus: row.providerStatus || null,
          providerReference: row.providerReference || null,
          providerDescription: providerDescription.text,
          accountOwnerName: owner?.fullName || owner?.username || "Unknown user",
          bookingIntentId: row.bookingIntentId ? String(row.bookingIntentId) : null,
          lastError: row.lastError || null,
          callbackCount: row.callbackCount || 0,
          providerPayload: {
            lastProviderStatus: row.providerPayload?.lastProviderStatus || null,
            lastSyncAt: row.providerPayload?.lastSyncAt || null,
            flow: row.providerPayload?.flow || null,
          },
          reconciliation: null,
        };
      }),
    );
    const nextOffset = offset + page.length;
    const capped = rows.length >= scanLimit;
    return {
      page,
      isDone: nextOffset >= filtered.length && !capped,
      continueCursor: nextOffset >= filtered.length && !capped ? null : String(nextOffset),
      total: filtered.length,
      capped,
    };
  },
});

export const listZones = query({
  args: {
    sessionToken: v.string(),
    status: v.optional(
      v.union(
        v.literal("pending-review"),
        v.literal("approved_pending_migration"),
        v.literal("active"),
        v.literal("rejected"),
        v.literal("suspended")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedAdmin(ctx, args.sessionToken);

    const limit = args.limit || 100;
    const docs = args.status
      ? await ctx.db
          .query("zones")
          .withIndex("by_status_updatedAt", (q) => q.eq("status", args.status!))
          .order("desc")
          .take(limit)
      : await ctx.db.query("zones").withIndex("by_updatedAt").order("desc").take(limit);

    return docs
      .map((zone) => ({
        id: zone._id,
        ...zone,
      }));
  },
});

export const getZoneById = query({
  args: {
    sessionToken: v.string(),
    zoneId: v.id("zones"),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedAdmin(ctx, args.sessionToken);
    const zone = await ctx.db.get(args.zoneId);
    if (!zone) return null;
    return {
      id: zone._id,
      ...zone,
    };
  },
});

export const listUsers = query({
  args: {
    sessionToken: v.string(),
    accountType: v.optional(v.union(v.literal("player"), v.literal("zone"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedAdmin(ctx, args.sessionToken);

    const limit = args.limit || 150;
    const docs = args.accountType
      ? await ctx.db
          .query("users")
          .withIndex("by_accountType_updatedAt", (q) => q.eq("accountType", args.accountType!))
          .order("desc")
          .take(limit)
      : await ctx.db.query("users").withIndex("by_updatedAt").order("desc").take(limit);

    return docs
      .map((user) => ({
        id: user._id,
        ...user,
      }));
  },
});

export const listReports = query({
  args: {
    sessionToken: v.string(),
    status: v.optional(
      v.union(v.literal("pending"), v.literal("reviewed"), v.literal("resolved"))
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedAdmin(ctx, args.sessionToken);

    const limit = args.limit || 100;
    const docs = args.status
      ? await ctx.db
          .query("reports")
          .withIndex("by_status_updatedAt", (q) => q.eq("status", args.status!))
          .order("desc")
          .take(limit)
      : await ctx.db.query("reports").withIndex("by_updatedAt").order("desc").take(limit);

    return await Promise.all(docs.map((report) => enrichAdminReport(ctx, report, false)));
  },
});

export const listReportsPage = query({
  args: {
    sessionToken: v.string(),
    status: v.optional(v.union(v.literal("pending"), v.literal("reviewed"), v.literal("resolved"))),
    typeGroup: v.optional(v.string()),
    game: v.optional(v.string()),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedAdmin(ctx, args.sessionToken);
    const limit = Math.max(1, Math.min(args.limit || 50, 100));
    const offset = Math.max(0, Number(args.cursor || 0) || 0);
    const scanLimit = Math.min(Math.max((offset + limit) * 4, limit), 1000);
    const needle = String(args.search || "").trim().toLowerCase();
    const docs = args.status
      ? await ctx.db
          .query("reports")
          .withIndex("by_status_updatedAt", (q) => q.eq("status", args.status!))
          .order("desc")
          .take(scanLimit)
      : await ctx.db.query("reports").withIndex("by_updatedAt").order("desc").take(scanLimit);
    const filtered = docs.filter((report: any) => {
      if (args.game && args.game !== "All" && String(report.game || "") !== args.game) return false;
      const createdAt = Number(report.createdAt || 0);
      if (args.dateFrom !== undefined && createdAt < args.dateFrom) return false;
      if (args.dateTo !== undefined && createdAt > args.dateTo) return false;
      if (args.typeGroup && args.typeGroup !== "Any") {
        const source = String(report.source || "");
        const type = String(report.type || "");
        const group =
          source === "support_chatbot_moderation_report" ? "support"
          : type.includes("chat_message_report") ? "chat"
          : type === "zone_complaint" ? "zone"
          : type === "matchroom_complaint" ? "matchroom"
          : "player";
        if (group !== args.typeGroup) return false;
      }
      if (needle) {
        const haystack = [
          report.reason,
          report.description,
          report.game,
          report.type,
          report.source,
          report.targetType,
          report.targetReference,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
    const pageRows = filtered.slice(offset, offset + limit);
    const page = await Promise.all(pageRows.map((report) => enrichAdminReport(ctx, report, false)));
    const nextOffset = offset + page.length;
    const capped = docs.length >= scanLimit;
    return {
      page,
      isDone: nextOffset >= filtered.length && !capped,
      continueCursor: nextOffset >= filtered.length && !capped ? null : String(nextOffset),
      total: filtered.length,
      capped,
    };
  },
});

export const getReportById = query({
  args: {
    sessionToken: v.string(),
    reportId: v.id("reports"),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedAdmin(ctx, args.sessionToken);

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      return null;
    }

    return await enrichAdminReport(ctx, report, true);
  },
});

export const listSupportTickets = query({
  args: {
    sessionToken: v.string(),
    status: v.optional(
      v.union(v.literal("open"), v.literal("in_review"), v.literal("resolved"))
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedAdmin(ctx, args.sessionToken);

    const limit = args.limit || 100;
    const docs = args.status
      ? await ctx.db
          .query("supportTickets")
          .withIndex("by_status_createdAt", (q) => q.eq("status", args.status!))
          .order("desc")
          .take(limit)
      : await ctx.db.query("supportTickets").order("desc").take(limit);

    return await Promise.all(docs.map((ticket) => serializeSupportTicket(ctx, ticket, false)));
  },
});

export const listZoneWithdrawalRequests = query({
  args: {
    sessionToken: v.string(),
    status: v.optional(v.union(
      v.literal("any"),
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed"),
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedAdmin(ctx, args.sessionToken);
    const limit = Math.max(1, Math.min(args.limit || 50, 100));
    const scanLimit = Math.min(limit * 10, 200);
    const status = args.status || "pending";
    const rows = await ctx.db
      .query("walletTransactions")
      .withIndex("by_type", (q) => q.eq("type", "withdrawal"))
      .order("desc")
      .take(scanLimit);

    return rows
      .filter(isZoneWithdrawalRequest)
      .filter((row) => status === "any" || row.status === status)
      .slice(0, limit)
      .map(serializeAdminZoneWithdrawal);
  },
});

export const listZoneWithdrawalRequestsPage = query({
  args: {
    sessionToken: v.string(),
    status: v.optional(v.union(
      v.literal("any"),
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed"),
    )),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
    amountMin: v.optional(v.number()),
    amountMax: v.optional(v.number()),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedAdmin(ctx, args.sessionToken);
    const limit = Math.max(1, Math.min(args.limit || 50, 100));
    const offset = Math.max(0, Number(args.cursor || 0) || 0);
    const scanLimit = Math.min(Math.max((offset + limit) * 8, limit), 1000);
    const status = args.status || "pending";
    const rows = status !== "any"
      ? await ctx.db
          .query("walletTransactions")
          .withIndex("by_type_and_status_and_createdAt", (q: any) => {
            let r = q.eq("type", "withdrawal").eq("status", status);
            if (args.dateFrom !== undefined) r = r.gte("createdAt", args.dateFrom);
            if (args.dateTo !== undefined) r = r.lte("createdAt", args.dateTo);
            return r;
          })
          .order("desc")
          .take(scanLimit)
      : await ctx.db
          .query("walletTransactions")
          .withIndex("by_type", (q) => q.eq("type", "withdrawal"))
          .order("desc")
          .take(scanLimit);
    const needle = String(args.search || "").trim().toLowerCase();
    const filtered = rows
      .filter(isZoneWithdrawalRequest)
      .filter((row) => {
        const createdAt = Number(row.createdAt || 0);
        if (args.dateFrom !== undefined && createdAt < args.dateFrom) return false;
        if (args.dateTo !== undefined && createdAt > args.dateTo) return false;
        const amount = Number(row.amount || 0);
        if (args.amountMin !== undefined && amount < args.amountMin) return false;
        if (args.amountMax !== undefined && amount > args.amountMax) return false;
        if (needle) {
          const metadata = row.metadata || {};
          const haystack = [
            row.reference,
            metadata.ownerName,
            metadata.ownerEmail,
            metadata.venueName,
            metadata.branchName,
            metadata.bankName,
            metadata.accountNumberMasked,
            String(row.amount || ""),
          ].filter(Boolean).join(" ").toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        return true;
      });
    const page = filtered.slice(offset, offset + limit).map(serializeAdminZoneWithdrawal);
    const nextOffset = offset + page.length;
    const capped = rows.length >= scanLimit;
    return {
      page,
      isDone: nextOffset >= filtered.length && !capped,
      continueCursor: nextOffset >= filtered.length && !capped ? null : String(nextOffset),
      total: filtered.length,
      capped,
    };
  },
});

export const listZoneFinanceSummaries = query({
  args: {
    sessionToken: v.string(),
    limit: v.optional(v.number()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedAdmin(ctx, args.sessionToken);
    const limit = Math.max(1, Math.min(args.limit || 50, 100));
    const scanLimit = 1000;
    const { startOfToday, startOfWeek, startOfMonth } = getKarachiPeriodStarts();

    const [payoutRows, completedWithdrawalRows, pendingWithdrawalRows] = await Promise.all([
      ctx.db
        .query("walletTransactions")
        .withIndex("by_type_and_status_and_createdAt", (q: any) =>
          q.eq("type", "deposit").eq("status", "completed").gte("createdAt", startOfMonth)
        )
        .take(scanLimit),
      ctx.db
        .query("walletTransactions")
        .withIndex("by_type_and_status_and_createdAt", (q: any) =>
          q.eq("type", "withdrawal").eq("status", "completed").gte("createdAt", startOfMonth)
        )
        .take(scanLimit),
      ctx.db
        .query("walletTransactions")
        .withIndex("by_type_and_status", (q: any) => q.eq("type", "withdrawal").eq("status", "pending"))
        .take(scanLimit),
    ]);

    const buckets = new Map<string, any>();
    const userCache = new Map<string, any>();
    const zoneCache = new Map<string, any>();
    const getUser = async (userId: any) => {
      const key = String(userId || "");
      if (!key) return null;
      if (!userCache.has(key)) userCache.set(key, await ctx.db.get(userId));
      return userCache.get(key);
    };
    const getZone = async (zoneId: any) => {
      const key = String(zoneId || "");
      if (!key) return null;
      if (!zoneCache.has(key)) {
        try {
          zoneCache.set(key, await ctx.db.get(zoneId));
        } catch {
          zoneCache.set(key, null);
        }
      }
      return zoneCache.get(key);
    };

    for (const row of payoutRows) {
      const metadata = row.metadata || {};
      if (metadata.source !== "matchroom_completion_payout") continue;
      let zoneId = metadata.zoneId || null;
      let zone: any = null;
      if (!zoneId && metadata.matchroomId) {
        try {
          const matchroom = await ctx.db.get(metadata.matchroomId as Id<"matchrooms">);
          zoneId = matchroom?.zoneId || null;
        } catch {
          zoneId = null;
        }
      }
      if (zoneId) zone = await getZone(zoneId);
      const owner = zone?.ownerUid ? await getUser(zone.ownerUid) : await getUser(row.userId);
      const key = zoneId ? `zone:${String(zoneId)}` : `owner:${String(row.userId)}`;
      const bucket = addToZoneFinanceBucket(buckets, key, {
        zoneId: zoneId ? String(zoneId) : null,
        zoneName: zone?.venueBrandName || zone?.name || metadata.venueName || null,
        zoneAdminId: owner?._id ? String(owner._id) : String(row.userId),
        zoneAdminName: owner?.fullName || owner?.username || null,
        zoneAdminEmail: owner?.email || null,
        availableBalance: Number(owner?.walletBalance || 0),
      });
      const amount = Number(row.amount || 0);
      const createdAt = Number(row.createdAt || 0);
      if (createdAt >= startOfToday) bucket.earnedToday += amount;
      if (createdAt >= startOfWeek) bucket.earnedThisWeek += amount;
      if (createdAt >= startOfMonth) bucket.earnedThisMonth += amount;
    }

    for (const row of [...completedWithdrawalRows, ...pendingWithdrawalRows]) {
      if (!isZoneWithdrawalRequest(row)) continue;
      const metadata = row.metadata || {};
      const zoneId = metadata.zoneId || null;
      const zone = zoneId ? await getZone(zoneId) : null;
      const owner = await getUser(row.userId);
      const key = zoneId ? `zone:${String(zoneId)}` : `owner:${String(row.userId)}`;
      const bucket = addToZoneFinanceBucket(buckets, key, {
        zoneId: zoneId ? String(zoneId) : null,
        zoneName: zone?.venueBrandName || zone?.name || metadata.venueName || null,
        zoneAdminId: owner?._id ? String(owner._id) : String(row.userId),
        zoneAdminName: owner?.fullName || owner?.username || metadata.ownerName || null,
        zoneAdminEmail: owner?.email || metadata.ownerEmail || null,
        availableBalance: Number(owner?.walletBalance || 0),
      });
      const amount = Number(row.amount || 0);
      const createdAt = Number(row.createdAt || 0);
      if (row.status === "pending") {
        bucket.pendingWithdrawalAmount += amount;
      } else if (row.status === "completed") {
        if (createdAt >= startOfToday) bucket.withdrawnToday += amount;
        if (createdAt >= startOfWeek) bucket.withdrawnThisWeek += amount;
        if (createdAt >= startOfMonth) bucket.withdrawnThisMonth += amount;
        bucket.lastWithdrawalAt = Math.max(Number(bucket.lastWithdrawalAt || 0), createdAt) || null;
      }
    }

    const needle = String(args.search || "").trim().toLowerCase();
    const rows = Array.from(buckets.values())
      .filter((row) => {
        if (!needle) return true;
        return [
          row.zoneName,
          row.zoneAdminName,
          row.zoneAdminEmail,
          row.zoneId,
          row.zoneAdminId,
        ].filter(Boolean).join(" ").toLowerCase().includes(needle);
      })
      .sort((a, b) =>
        Number(b.pendingWithdrawalAmount || 0) - Number(a.pendingWithdrawalAmount || 0)
        || Number(b.earnedThisMonth || 0) - Number(a.earnedThisMonth || 0)
        || String(a.zoneName || "").localeCompare(String(b.zoneName || ""))
      );

    return {
      rows: rows.slice(0, limit),
      capped: payoutRows.length >= scanLimit || completedWithdrawalRows.length >= scanLimit || pendingWithdrawalRows.length >= scanLimit,
      periodStarts: { today: startOfToday, week: startOfWeek, month: startOfMonth, timezone: "Asia/Karachi", weekStartsOn: "Monday" },
    };
  },
});

export const listMyNotifications = query({
  args: {
    sessionToken: v.string(),
    tab: v.union(v.literal("unread"), v.literal("read")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const limit = Math.min(Math.max(args.limit || 50, 1), 100);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_toUid", (q: any) => q.eq("toUid", admin.profile._id))
      .order("desc")
      .take(limit * 4);

    return notifications
      .filter((notification: any) => notification.isArchived !== true)
      .filter((notification: any) => !notification.recipientRole || notification.recipientRole === "super_admin")
      .filter((notification: any) => (args.tab === "read" ? notification.isRead === true : notification.isRead !== true))
      .slice(0, limit)
      .map(serializeAdminNotification);
  },
});

export const countMyUnreadNotifications = query({
  args: {
    sessionToken: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const result = await countUnreadSuperAdminNotifications(ctx, admin.profile._id, args.limit || 300);
    return result.count;
  },
});

export const markMyNotificationRead = mutation({
  args: {
    sessionToken: v.string(),
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const notification = await getOwnedAdminNotification(ctx, admin.profile._id, args.notificationId);
    if (notification.isRead === true) return { ok: true };
    const now = Date.now();
    await ctx.db.patch(args.notificationId, {
      isRead: true,
      readAt: now,
      updatedAt: now,
    });
    return { ok: true };
  },
});

export const archiveMyNotification = mutation({
  args: {
    sessionToken: v.string(),
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    await getOwnedAdminNotification(ctx, admin.profile._id, args.notificationId);
    const now = Date.now();
    await ctx.db.patch(args.notificationId, {
      isArchived: true,
      archivedAt: now,
      updatedAt: now,
    });
    return { ok: true };
  },
});

export const getSupportTicketById = query({
  args: {
    sessionToken: v.string(),
    ticketId: v.id("supportTickets"),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedAdmin(ctx, args.sessionToken);

    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) return null;
    return await serializeSupportTicket(ctx, ticket, true);
  },
});

export const approveZoneWithdrawal = mutation({
  args: {
    sessionToken: v.string(),
    withdrawalId: v.id("walletTransactions"),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const withdrawal = await ctx.db.get(args.withdrawalId);
    if (!withdrawal || !isZoneWithdrawalRequest(withdrawal)) {
      throw new Error("Withdrawal request not found.");
    }

    const previousStatus = withdrawal.status;
    if (previousStatus !== "pending") {
      await insertSuperAdminAuditLog(ctx, admin, {
        action: "approve_withdrawal_noop",
        module: "withdrawals",
        targetType: "walletTransaction",
        targetId: String(args.withdrawalId),
        status: "success",
        metadataSafe: {
          changed: false,
          previousStatus,
          newStatus: previousStatus,
          amountRounded: Math.round(Number(withdrawal.amount || 0)),
        },
      });
      return { ok: true, changed: false, status: previousStatus };
    }

    const user = await ctx.db.get(withdrawal.userId);
    if (!user) {
      throw new Error("Withdrawal owner not found.");
    }

    const amount = Number(withdrawal.amount || 0);
    const currentBalance = Number(user.walletBalance || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Invalid withdrawal amount.");
    }
    if (!Number.isFinite(currentBalance) || currentBalance < amount) {
      throw new Error("Wallet balance is no longer sufficient for this withdrawal.");
    }

    const now = Date.now();
    await ctx.db.patch(user._id, {
      walletBalance: currentBalance - amount,
      updatedAt: now,
    });
    await ctx.db.patch(args.withdrawalId, {
      status: "completed",
      metadata: buildWithdrawalDecisionMetadata(withdrawal, {
        adminUserId: admin.profile._id,
        decision: "approved",
        now,
      }),
    });

    await notifyZoneAdminWithdrawalDecision(ctx, {
      withdrawalId: args.withdrawalId,
      zoneAdminUserId: withdrawal.userId,
      decision: "approved",
    });

    await insertSuperAdminAuditLog(ctx, admin, {
      action: "approve_withdrawal",
      module: "withdrawals",
      targetType: "walletTransaction",
      targetId: String(args.withdrawalId),
      status: "success",
      metadataSafe: {
        changed: true,
        previousStatus,
        newStatus: "completed",
        amountRounded: Math.round(amount),
      },
    });
    return { ok: true, changed: true, status: "completed" };
  },
});

export const rejectZoneWithdrawal = mutation({
  args: {
    sessionToken: v.string(),
    withdrawalId: v.id("walletTransactions"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const withdrawal = await ctx.db.get(args.withdrawalId);
    if (!withdrawal || !isZoneWithdrawalRequest(withdrawal)) {
      throw new Error("Withdrawal request not found.");
    }

    const reason = sanitizeWithdrawalDecisionReason(args.reason);
    if (!reason) {
      throw new Error("Rejection reason is required.");
    }

    const previousStatus = withdrawal.status;
    if (previousStatus !== "pending") {
      await insertSuperAdminAuditLog(ctx, admin, {
        action: "reject_withdrawal_noop",
        module: "withdrawals",
        targetType: "walletTransaction",
        targetId: String(args.withdrawalId),
        status: "success",
        metadataSafe: {
          changed: false,
          previousStatus,
          newStatus: previousStatus,
          amountRounded: Math.round(Number(withdrawal.amount || 0)),
          hasReason: true,
          reasonLength: reason.length,
        },
      });
      return { ok: true, changed: false, status: previousStatus };
    }

    const now = Date.now();
    await ctx.db.patch(args.withdrawalId, {
      status: "failed",
      metadata: buildWithdrawalDecisionMetadata(withdrawal, {
        adminUserId: admin.profile._id,
        decision: "rejected",
        now,
        rejectionReasonSafe: reason,
      }),
    });

    await notifyZoneAdminWithdrawalDecision(ctx, {
      withdrawalId: args.withdrawalId,
      zoneAdminUserId: withdrawal.userId,
      decision: "rejected",
    });

    await insertSuperAdminAuditLog(ctx, admin, {
      action: "reject_withdrawal",
      module: "withdrawals",
      targetType: "walletTransaction",
      targetId: String(args.withdrawalId),
      status: "success",
      metadataSafe: {
        changed: true,
        previousStatus,
        newStatus: "failed",
        amountRounded: Math.round(Number(withdrawal.amount || 0)),
        hasReason: true,
        reasonLength: reason.length,
      },
    });
    return { ok: true, changed: true, status: "failed" };
  },
});

export const setZoneStatus = mutation({
  args: {
    sessionToken: v.string(),
    zoneId: v.id("zones"),
    status: v.union(
      v.literal("pending-review"),
      v.literal("approved_pending_migration"),
      v.literal("active"),
      v.literal("rejected"),
      v.literal("suspended")
    ),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const zone = await ctx.db.get(args.zoneId);
    if (!zone) {
      throw new Error("Zone not found.");
    }

    const now = Date.now();
    const patch: Record<string, unknown> = {
      updatedAt: now,
    };

    if (args.status === "active") {
      patch.approvedAt = now;
      patch.rejectedAt = undefined;
      patch.rejectionReason = undefined;

      const migrationReady = Boolean(zone.migration?.perBranchSeatModel);
      if (!migrationReady && Array.isArray(zone.branches) && zone.branches.length > 0) {
        await ctx.db.patch(args.zoneId, {
          status: "approved_pending_migration",
          approvedAt: patch.approvedAt as number,
          rejectedAt: undefined,
          rejectionReason: undefined,
          migration: {
            ...zone.migration,
            perBranchSeatModel: false,
            status: "pending",
            lastAttemptAt: now,
            lastError: undefined,
          },
          updatedAt: now,
        });

        try {
          const migrationResult = await migrateZoneBranchesInternal(ctx, args.zoneId);
          const migrationCompletedAt = Date.now();
          patch.status = "active";
          patch.migration = {
            ...zone.migration,
            perBranchSeatModel: true,
            status: "succeeded",
            migratedAt: migrationCompletedAt,
            lastAttemptAt: migrationCompletedAt,
            lastError: undefined,
            branchCount: migrationResult.branchCount,
            resourceCount: migrationResult.resourceCount,
            resourceModelVersion: 1,
          };
        } catch (error: any) {
          const migrationFailedAt = Date.now();
          patch.status = "approved_pending_migration";
          patch.migration = {
            ...zone.migration,
            perBranchSeatModel: false,
            status: "failed",
            lastAttemptAt: migrationFailedAt,
            lastError: error?.message || "Migration failed.",
          };
        }
      } else {
        patch.status = "active";
        patch.migration = migrationReady
          ? {
              ...zone.migration,
              perBranchSeatModel: true,
              status: "succeeded",
              lastError: undefined,
            }
          : zone.migration;
      }
    }

    if (args.status === "rejected") {
      patch.status = "rejected";
      patch.rejectedAt = now;
      patch.rejectionReason = args.rejectionReason || "Rejected by super admin";
    }

    if (args.status === "pending-review") {
      patch.status = "pending-review";
      patch.rejectedAt = undefined;
      patch.rejectionReason = undefined;
    }

    if (args.status === "suspended") {
      patch.status = "suspended";
    }

    const shouldStartPilot =
      args.status === "active"
      && zone.status === "pending-review"
      && !zone.pilotStartedAt
      && patch.status === "active";

    if (shouldStartPilot) {
      patch.pilotStatus = "active";
      patch.pilotStartedAt = now;
      patch.pilotEndsAt = addMonthsClamped(now, 1);
      patch.pilotEndedAt = undefined;
      patch.pilotPayoutRate = 1.0;
      patch.normalPayoutRate = 0.9;
    }

    await ctx.db.patch(args.zoneId, patch);

    if (zone.ownerUid) {
      const nextStatus = String((patch.status || zone.status) || "pending-review");
      const copy = zoneStatusNotificationCopy(nextStatus, String(patch.rejectionReason || ""));
      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: "zone.status_updated",
        toUid: zone.ownerUid,
        recipientRole: "zone_admin",
        status: nextStatus === "rejected" ? "rejected" : "accepted",
        dedupeKey: `zone.status_updated:${String(args.zoneId)}:${nextStatus}`,
        dedupePolicy: "replace_active",
        route: "/zone/(tabs)/profile",
        entity: { kind: "zone", id: String(args.zoneId) },
        entityId: String(args.zoneId),
        title: copy.title,
        body: copy.body,
        data: {
          zoneId: String(args.zoneId),
          status: nextStatus,
          rejectionReason: patch.rejectionReason || null,
          href: "/zone/(tabs)/profile",
        },
      });
    }
    if (zone.ownerUid && shouldStartPilot) {
      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: "zone.pilot_started",
        toUid: zone.ownerUid,
        recipientRole: "zone_admin",
        status: "pending",
        dedupeKey: `zone.pilot_started:${String(args.zoneId)}`,
        dedupePolicy: "replace_active",
        pushPolicy: "force",
        route: "/zone/(tabs)/profile",
        entity: { kind: "zone", id: String(args.zoneId) },
        entityId: String(args.zoneId),
        title: "Pilot period started",
        body: "Your zone has been approved. For the first month, you'll receive 100% of Matchhai booking payouts. After the pilot period ends, the standard 90% payout rate will apply.",
        data: {
          zoneId: String(args.zoneId),
          pilotStartedAt: patch.pilotStartedAt,
          pilotEndsAt: patch.pilotEndsAt,
          pilotPayoutRate: patch.pilotPayoutRate,
          normalPayoutRate: patch.normalPayoutRate,
          route: "/zone/(tabs)/profile",
          href: "/zone/(tabs)/profile",
        },
      });
    }
    await insertSuperAdminAuditLog(ctx, admin, {
      action: args.status === "active" ? "approve_zone" : args.status === "rejected" ? "reject_zone" : "update_zone_status",
      module: "zones",
      targetType: "zone",
      targetId: String(args.zoneId),
      status: "success",
      metadataSafe: { previousStatus: zone.status, status: args.status, pilotStarted: shouldStartPilot },
    });
    return true;
  },
});

export const retryZoneMigration = mutation({
  args: {
    sessionToken: v.string(),
    zoneId: v.id("zones"),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const zone = await ctx.db.get(args.zoneId);
    if (!zone) {
      throw new Error("Zone not found.");
    }

    if (zone.status !== "approved_pending_migration") {
      throw new Error("Retry is only available while a venue is waiting on migration.");
    }

    if (!Array.isArray(zone.branches) || zone.branches.length === 0) {
      throw new Error("No branches found to migrate.");
    }

    try {
      const result = await migrateZoneBranchesInternal(ctx, args.zoneId);
      await ctx.db.patch(args.zoneId, {
        status: "active",
        approvedAt: zone.approvedAt || Date.now(),
        migration: {
          ...zone.migration,
          perBranchSeatModel: true,
          status: "succeeded",
          migratedAt: Date.now(),
          lastAttemptAt: Date.now(),
          lastError: undefined,
          branchCount: result.branchCount,
          resourceCount: result.resourceCount,
          resourceModelVersion: 1,
        },
        updatedAt: Date.now(),
      });
      await insertSuperAdminAuditLog(ctx, admin, {
        action: "retry_zone_migration",
        module: "zones",
        targetType: "zone",
        targetId: String(args.zoneId),
        status: "success",
        metadataSafe: { branchCount: result.branchCount, resourceCount: result.resourceCount },
      });
      return { ok: true };
    } catch (error: any) {
      await ctx.db.patch(args.zoneId, {
        status: "approved_pending_migration",
        migration: {
          ...zone.migration,
          perBranchSeatModel: false,
          status: "failed",
          lastAttemptAt: Date.now(),
          lastError: error?.message || "Migration failed.",
        },
        updatedAt: Date.now(),
      });
      throw error;
    }
  },
});

export const setReportStatus = mutation({
  args: {
    sessionToken: v.string(),
    reportId: v.id("reports"),
    status: v.union(v.literal("pending"), v.literal("reviewed"), v.literal("resolved")),
    reviewerNote: v.optional(v.string()),
    resolutionSummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const { profile } = admin;

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found.");
    }

    const now = Date.now();
    const previousStatus = report.status;
    const newStatus = args.status;
    const hasReviewerNoteArg = Object.prototype.hasOwnProperty.call(args, "reviewerNote");
    const hasResolutionSummaryArg = Object.prototype.hasOwnProperty.call(args, "resolutionSummary");
    const reviewerNote = args.reviewerNote?.trim() || undefined;
    const resolutionSummary = args.resolutionSummary?.trim() || undefined;
    const reviewerNoteChanged = hasReviewerNoteArg
      && (reviewerNote || undefined) !== (report.reviewerNote || undefined);
    const resolutionSummaryChanged = hasResolutionSummaryArg
      && (resolutionSummary || undefined) !== (report.resolutionSummary || undefined);
    const statusChanged = previousStatus !== newStatus;
    const anyChange = statusChanged || reviewerNoteChanged || resolutionSummaryChanged;

    const patch: Record<string, unknown> = {
      status: newStatus,
      updatedAt: now,
    };

    if (newStatus === "reviewed") {
      patch.reviewedByUid = profile._id;
      patch.reviewedAt = now;
      patch.reviewerNote = reviewerNote;
      patch.resolvedByUid = undefined;
      patch.resolvedAt = undefined;
      patch.resolutionSummary = undefined;
    }

    if (newStatus === "resolved") {
      if (!report.reviewedAt || !report.reviewedByUid) {
        patch.reviewedByUid = profile._id;
        patch.reviewedAt = now;
      }
      patch.reviewerNote = reviewerNote ?? report.reviewerNote;
      patch.resolvedByUid = profile._id;
      patch.resolvedAt = now;
      patch.resolutionSummary = resolutionSummary;
    }

    if (newStatus === "pending") {
      patch.reviewedByUid = undefined;
      patch.reviewedAt = undefined;
      patch.reviewerNote = undefined;
      patch.resolvedByUid = undefined;
      patch.resolvedAt = undefined;
      patch.resolutionSummary = undefined;
    }

    await ctx.db.patch(args.reportId, patch);

    if (statusChanged) {
      if (!report.reporterUid) {
        console.warn("[admin] report status notification skipped", {
          reportId: String(args.reportId),
          newStatus,
          reason: "missing_reporter_user_id",
        });
      } else {
        const reportRoute = "/(player)/reports";
        const title = newStatus === "reviewed"
          ? "Report reviewed"
          : newStatus === "resolved"
            ? "Report resolved"
            : newStatus === "pending"
              ? "Report reopened"
              : "Report updated";
        const body = newStatus === "resolved"
          ? "Your report has been resolved."
          : newStatus === "reviewed"
            ? "Your report has been reviewed."
            : newStatus === "pending"
              ? "Your report has been reopened for review."
              : "Your report status was updated.";

        try {
          await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
            type: "moderation.report_updated",
            toUid: report.reporterUid,
            status: "pending",
            dedupeKey: `moderation.report_updated:${String(args.reportId)}:${newStatus}`,
            dedupePolicy: "replace_active",
            pushPolicy: "eligible",
            route: reportRoute,
            entity: { kind: "report", id: String(args.reportId) },
            entityId: String(args.reportId),
            title,
            body,
            data: {
              reportId: String(args.reportId),
              status: newStatus,
              route: reportRoute,
              href: reportRoute,
            },
          });
        } catch {
          console.warn("[admin] report status notification failed", {
            reportId: String(args.reportId),
            previousStatus,
            newStatus,
            statusChanged,
            notificationType: "moderation.report_updated",
          });
        }
      }
    }

    await insertSuperAdminAuditLog(ctx, admin, {
      action: "update_report_status",
      module: "reports",
      targetType: "report",
      targetId: String(args.reportId),
      status: "success",
      metadataSafe: {
        previousStatus,
        status: newStatus,
        changed: statusChanged,
        updatedReviewerNote: reviewerNoteChanged,
        updatedResolutionSummary: resolutionSummaryChanged,
        anyChange,
      },
    });
    return true;
  },
});

// ============================================
// REPORT MODERATION ACTIONS (super-admin only)
// ============================================

const MODERATION_NOTE_MAX_LENGTH = 1000;

function makeModerationNote(
  admin: { authUser?: any; profile?: any },
  note: string,
  action: string,
) {
  const identity = resolveSuperAdminAuditIdentity(admin.authUser, admin.profile);
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    note: String(note || "").trim().slice(0, MODERATION_NOTE_MAX_LENGTH),
    action,
    authorUid: admin.profile?._id,
    authorName: identity.superAdminName,
    createdAt: Date.now(),
  };
}

function appendModerationNote(report: any, entry: ReturnType<typeof makeModerationNote>) {
  const existing = Array.isArray(report.moderationNotes) ? report.moderationNotes : [];
  return [...existing, entry];
}

// Promote a still-pending report to "reviewed" when a concrete moderation action is
// taken, so it leaves the triage queue and the timeline reflects the action.
function reportReviewedStamp(report: any, admin: { profile?: any }, now: number) {
  if (report.status !== "pending") return {};
  return {
    status: "reviewed" as const,
    reviewedByUid: report.reviewedByUid || admin.profile._id,
    reviewedAt: report.reviewedAt || now,
  };
}

async function requireReportForAdmin(ctx: any, reportId: Id<"reports">) {
  const report = await ctx.db.get(reportId);
  if (!report) {
    throw new Error("Report not found.");
  }
  return report;
}

export const addReportModerationNote = mutation({
  args: {
    sessionToken: v.string(),
    reportId: v.id("reports"),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const report = await requireReportForAdmin(ctx, args.reportId);
    const note = args.note.trim();
    if (!note) {
      throw new Error("A note is required.");
    }

    const entry = makeModerationNote(admin, note, "note");
    await ctx.db.patch(args.reportId, {
      moderationNotes: appendModerationNote(report, entry),
      updatedAt: Date.now(),
    });

    await insertSuperAdminAuditLog(ctx, admin, {
      action: "add_report_moderation_note",
      module: "reports",
      targetType: report.type,
      targetId: String(args.reportId),
      status: "success",
      metadataSafe: { reportType: report.type },
    });

    return { ok: true };
  },
});

export const warnReportedUser = mutation({
  args: {
    sessionToken: v.string(),
    reportId: v.id("reports"),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const report = await requireReportForAdmin(ctx, args.reportId);
    const offenderId = report.reportedUserId as Id<"users"> | undefined;
    if (!offenderId) {
      throw new Error("This report has no reported user to warn.");
    }

    const now = Date.now();
    const noteText = args.note.trim();
    if (!noteText) {
      throw new Error("A warning message is required.");
    }

    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "moderation.account_warning",
      toUid: offenderId,
      status: "pending",
      dedupeKey: `moderation.account_warning:${String(args.reportId)}:${String(offenderId)}`,
      dedupePolicy: "upsert_active",
      pushPolicy: "eligible",
      route: "/profile",
      entity: { kind: "user", id: String(offenderId) },
      entityId: String(offenderId),
      title: "Account warning",
      body: "A report involving your account was reviewed. Please follow MatchHai community rules.",
      data: { userId: String(offenderId), reportId: String(args.reportId), href: "/profile" },
    });

    const entry = makeModerationNote(admin, noteText, "warn_user");
    await ctx.db.patch(args.reportId, {
      moderationNotes: appendModerationNote(report, entry),
      ...reportReviewedStamp(report, admin, now),
      updatedAt: now,
    });

    await insertSuperAdminAuditLog(ctx, admin, {
      action: "warn_reported_user",
      module: "reports",
      targetType: "user",
      targetId: String(offenderId),
      status: "success",
      reason: noteText,
      metadataSafe: { reportId: String(args.reportId), reportType: report.type },
    });

    return { ok: true };
  },
});

export const warnReportedZoneAdmin = mutation({
  args: {
    sessionToken: v.string(),
    reportId: v.id("reports"),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const report = await requireReportForAdmin(ctx, args.reportId);
    const zoneId = report.zoneId as Id<"zones"> | undefined;
    if (!zoneId) {
      throw new Error("This report has no linked zone to warn.");
    }
    const zone = await ctx.db.get(zoneId);
    if (!zone) {
      throw new Error("Zone not found.");
    }
    const noteText = args.note.trim();
    if (!noteText) {
      throw new Error("A warning message is required.");
    }

    const now = Date.now();
    if (!zone.ownerUid) {
      throw new Error("This zone has no owner account to warn.");
    }

    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "moderation.account_warning",
      toUid: zone.ownerUid,
      recipientRole: "zone_admin",
      status: "pending",
      dedupeKey: `moderation.account_warning:${String(args.reportId)}:zone:${String(zoneId)}`,
      dedupePolicy: "upsert_active",
      pushPolicy: "eligible",
      route: "/zone/(tabs)/profile",
      entity: { kind: "zone", id: String(zoneId) },
      entityId: String(zoneId),
      title: "Zone warning",
      body: "A report involving your zone was reviewed. Please review MatchHai rules and improve your venue experience.",
      data: { zoneId: String(zoneId), reportId: String(args.reportId), href: "/zone/(tabs)/profile" },
    });

    const entry = makeModerationNote(admin, noteText, "warn_zone_admin");
    await ctx.db.patch(args.reportId, {
      moderationNotes: appendModerationNote(report, entry),
      ...reportReviewedStamp(report, admin, now),
      updatedAt: now,
    });

    await insertSuperAdminAuditLog(ctx, admin, {
      action: "warn_reported_zone_admin",
      module: "reports",
      targetType: "zone",
      targetId: String(zoneId),
      status: "success",
      reason: noteText,
      metadataSafe: { reportId: String(args.reportId) },
    });

    return { ok: true };
  },
});

export const suspendReportedUser = mutation({
  args: {
    sessionToken: v.string(),
    reportId: v.id("reports"),
    mode: v.union(v.literal("temporary"), v.literal("permanent")),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const report = await requireReportForAdmin(ctx, args.reportId);
    const offenderId = report.reportedUserId as Id<"users"> | undefined;
    if (!offenderId) {
      throw new Error("This report has no reported user to suspend.");
    }
    const reason = args.reason.trim();
    if (!reason) {
      throw new Error("A reason is required to suspend a user.");
    }

    const now = Date.now();
    const suspendedUntil = args.mode === "temporary" ? now + 7 * 24 * 60 * 60 * 1000 : null;

    await applyUserSuspension(ctx, admin, {
      userId: offenderId,
      status: "suspended",
      reason,
      suspendedUntil,
      auditAction: "suspend_reported_user",
      auditMetadataExtra: {
        reportId: String(args.reportId),
        mode: args.mode,
        durationDays: args.mode === "temporary" ? 7 : null,
        reportType: report.type,
      },
    });

    const noteLabel = args.mode === "temporary" ? "7-day suspension" : "Permanent suspension";
    const entry = makeModerationNote(admin, `${noteLabel}: ${reason}`, "suspend_user");
    await ctx.db.patch(args.reportId, {
      moderationNotes: appendModerationNote(report, entry),
      ...reportReviewedStamp(report, admin, now),
      updatedAt: now,
    });

    return { ok: true };
  },
});

export const reactivateReportedUser = mutation({
  args: {
    sessionToken: v.string(),
    reportId: v.id("reports"),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const report = await requireReportForAdmin(ctx, args.reportId);
    const offenderId = report.reportedUserId as Id<"users"> | undefined;
    if (!offenderId) {
      throw new Error("This report has no reported user to reactivate.");
    }

    const now = Date.now();
    await applyUserSuspension(ctx, admin, {
      userId: offenderId,
      status: "active",
      auditAction: "reactivate_reported_user",
      auditMetadataExtra: { reportId: String(args.reportId), reportType: report.type },
    });

    const entry = makeModerationNote(admin, "Account reactivated from report review.", "reactivate_user");
    await ctx.db.patch(args.reportId, {
      moderationNotes: appendModerationNote(report, entry),
      updatedAt: now,
    });

    return { ok: true };
  },
});

export const flagReportedZone = mutation({
  args: {
    sessionToken: v.string(),
    reportId: v.id("reports"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const report = await requireReportForAdmin(ctx, args.reportId);
    const zoneId = report.zoneId as Id<"zones"> | undefined;
    if (!zoneId) {
      throw new Error("This report has no linked zone to flag.");
    }
    const zone = await ctx.db.get(zoneId);
    if (!zone) {
      throw new Error("Zone not found.");
    }

    const now = Date.now();
    const noteText = args.note?.trim() || "Zone flagged for review.";
    const entry = makeModerationNote(admin, noteText, "flag_zone");

    await ctx.db.patch(args.reportId, {
      flaggedForReview: true,
      flaggedAt: now,
      moderationNotes: appendModerationNote(report, entry),
      ...reportReviewedStamp(report, admin, now),
      updatedAt: now,
    });

    if (zone.ownerUid) {
      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: "moderation.report_updated",
        toUid: zone.ownerUid,
        recipientRole: "zone_admin",
        status: "pending",
        dedupeKey: `moderation.report_updated:${String(args.reportId)}:zone_flagged`,
        dedupePolicy: "replace_active",
        pushPolicy: "eligible",
        route: `/zone/modules/support?reportId=${String(args.reportId)}`,
        entity: { kind: "report", id: String(args.reportId) },
        entityId: String(args.reportId),
        title: "Zone review update",
        body: "A report involving your zone has been reviewed. Please check your zone dashboard for updates.",
        data: { reportId: String(args.reportId), zoneId: String(zoneId), href: `/zone/modules/support?reportId=${String(args.reportId)}` },
      });
    }

    await insertSuperAdminAuditLog(ctx, admin, {
      action: "flag_reported_zone",
      module: "reports",
      targetType: "zone",
      targetId: String(zoneId),
      status: "success",
      reason: noteText,
      metadataSafe: { reportId: String(args.reportId) },
    });

    return { ok: true };
  },
});

export const suspendReportedZone = mutation({
  args: {
    sessionToken: v.string(),
    reportId: v.id("reports"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const report = await requireReportForAdmin(ctx, args.reportId);
    const zoneId = report.zoneId as Id<"zones"> | undefined;
    if (!zoneId) {
      throw new Error("This report has no linked zone to suspend.");
    }
    const reason = args.reason.trim();
    if (!reason) {
      throw new Error("A reason is required to suspend a zone.");
    }
    const zone = await ctx.db.get(zoneId);
    if (!zone) {
      throw new Error("Zone not found.");
    }
    if (zone.status === "suspended") {
      throw new Error("This zone is already suspended.");
    }

    const now = Date.now();
    await ctx.db.patch(zoneId, { status: "suspended", updatedAt: now });

    if (zone.ownerUid) {
      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: "zone.status_updated",
        toUid: zone.ownerUid,
        recipientRole: "zone_admin",
        status: "rejected",
        dedupeKey: `zone.status_updated:${String(zoneId)}:suspended`,
        dedupePolicy: "replace_active",
        route: "/zone/(tabs)/profile",
        entity: { kind: "zone", id: String(zoneId) },
        entityId: String(zoneId),
        title: "Zone status updated",
        body: "Your zone status has been updated after report review.",
        data: { zoneId: String(zoneId), status: "suspended", href: "/zone/(tabs)/profile" },
      });
    }

    const entry = makeModerationNote(admin, `Zone suspended: ${reason}`, "suspend_zone");
    await ctx.db.patch(args.reportId, {
      flaggedForReview: true,
      flaggedAt: now,
      moderationNotes: appendModerationNote(report, entry),
      ...reportReviewedStamp(report, admin, now),
      updatedAt: now,
    });

    await insertSuperAdminAuditLog(ctx, admin, {
      action: "suspend_reported_zone",
      module: "reports",
      targetType: "zone",
      targetId: String(zoneId),
      status: "success",
      reason,
      metadataSafe: { reportId: String(args.reportId), previousStatus: zone.status },
    });

    return { ok: true };
  },
});

export const reactivateReportedZone = mutation({
  args: {
    sessionToken: v.string(),
    reportId: v.id("reports"),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const report = await requireReportForAdmin(ctx, args.reportId);
    const zoneId = report.zoneId as Id<"zones"> | undefined;
    if (!zoneId) {
      throw new Error("This report has no linked zone to reactivate.");
    }
    const zone = await ctx.db.get(zoneId);
    if (!zone) {
      throw new Error("Zone not found.");
    }
    if (zone.status !== "suspended") {
      throw new Error("This zone is not suspended.");
    }

    const now = Date.now();
    // Minimal reactivation: a previously-suspended zone was already approved/migrated,
    // so we only restore the active status (no migration re-run).
    await ctx.db.patch(zoneId, { status: "active", updatedAt: now });

    if (zone.ownerUid) {
      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: "zone.status_updated",
        toUid: zone.ownerUid,
        recipientRole: "zone_admin",
        status: "accepted",
        dedupeKey: `zone.status_updated:${String(zoneId)}:active`,
        dedupePolicy: "replace_active",
        route: "/zone/(tabs)/profile",
        entity: { kind: "zone", id: String(zoneId) },
        entityId: String(zoneId),
        title: "Zone status updated",
        body: "Your zone status has been updated after report review.",
        data: { zoneId: String(zoneId), status: "active", href: "/zone/(tabs)/profile" },
      });
    }

    const entry = makeModerationNote(admin, "Zone reactivated from report review.", "reactivate_zone");
    await ctx.db.patch(args.reportId, {
      moderationNotes: appendModerationNote(report, entry),
      updatedAt: now,
    });

    await insertSuperAdminAuditLog(ctx, admin, {
      action: "reactivate_reported_zone",
      module: "reports",
      targetType: "zone",
      targetId: String(zoneId),
      status: "success",
      metadataSafe: { reportId: String(args.reportId) },
    });

    return { ok: true };
  },
});

export const markReportedMatchroomForReview = mutation({
  args: {
    sessionToken: v.string(),
    reportId: v.id("reports"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const report = await requireReportForAdmin(ctx, args.reportId);
    const matchroomId = report.matchroomId as Id<"matchrooms"> | undefined;
    if (!matchroomId) {
      throw new Error("This report has no linked matchroom.");
    }

    const now = Date.now();
    const noteText = args.note?.trim() || "Matchroom flagged for admin review.";
    const entry = makeModerationNote(admin, noteText, "flag_matchroom");

    await ctx.db.patch(args.reportId, {
      flaggedForReview: true,
      flaggedAt: now,
      moderationNotes: appendModerationNote(report, entry),
      ...reportReviewedStamp(report, admin, now),
      updatedAt: now,
    });

    await insertSuperAdminAuditLog(ctx, admin, {
      action: "flag_reported_matchroom",
      module: "reports",
      targetType: "matchroom",
      targetId: String(matchroomId),
      status: "success",
      reason: noteText,
      metadataSafe: { reportId: String(args.reportId) },
    });

    return { ok: true };
  },
});

export const cancelReportedMatchroom = mutation({
  args: {
    sessionToken: v.string(),
    reportId: v.id("reports"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const report = await requireReportForAdmin(ctx, args.reportId);
    const matchroomId = report.matchroomId as Id<"matchrooms"> | undefined;
    if (!matchroomId) {
      throw new Error("This report has no linked matchroom to cancel.");
    }
    const reason = args.reason.trim();
    if (!reason) {
      throw new Error("A reason is required to cancel a matchroom.");
    }

    const now = Date.now();
    const adminUid = String(admin.profile?.authId || admin.profile._id);
    const result = await performAdminCancel(ctx, {
      matchroomId,
      adminUid,
      reason,
      note: `Cancelled from report ${String(args.reportId)} review.`,
    });

    const entry = makeModerationNote(
      admin,
      result.alreadyCancelled ? `Matchroom already cancelled. ${reason}` : `Matchroom cancelled: ${reason}`,
      "cancel_matchroom",
    );
    await ctx.db.patch(args.reportId, {
      moderationNotes: appendModerationNote(report, entry),
      ...reportReviewedStamp(report, admin, now),
      updatedAt: now,
    });

    await insertSuperAdminAuditLog(ctx, admin, {
      action: "cancel_reported_matchroom",
      module: "reports",
      targetType: "matchroom",
      targetId: String(matchroomId),
      status: "success",
      reason,
      metadataSafe: { reportId: String(args.reportId), alreadyCancelled: result.alreadyCancelled },
    });

    return { ok: true, alreadyCancelled: result.alreadyCancelled };
  },
});

export const updateSupportTicketStatus = mutation({
  args: {
    sessionToken: v.string(),
    ticketId: v.id("supportTickets"),
    status: v.union(v.literal("open"), v.literal("in_review"), v.literal("resolved")),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);

    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) {
      throw new Error("Support ticket not found.");
    }

    await ctx.db.patch(args.ticketId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    if (ticket.status !== args.status) {
      await notifySupportTicketStatusChanged(ctx, ticket, args.status);
    }

    await insertSuperAdminAuditLog(ctx, admin, {
      action: "update_support_ticket_status",
      module: "support",
      targetType: "supportTicket",
      targetId: String(args.ticketId),
      status: "success",
      metadataSafe: { previousStatus: ticket.status, status: args.status, reference: ticket.reference },
    });
    return { ok: true };
  },
});

export const addSupportTicketInternalNote = mutation({
  args: {
    sessionToken: v.string(),
    ticketId: v.id("supportTickets"),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Support ticket not found.");

    const text = String(args.note || "").trim();
    if (!text) throw new Error("Internal note is required.");

    await ctx.db.insert("supportTicketNotes", {
      ticketId: args.ticketId,
      adminId: admin.profile._id,
      author: "admin",
      textRedacted: redactSupportText(text).slice(0, 1200),
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.ticketId, { updatedAt: Date.now() });

    await insertSuperAdminAuditLog(ctx, admin, {
      action: "add_support_ticket_internal_note",
      module: "support",
      targetType: "supportTicket",
      targetId: String(args.ticketId),
      status: "success",
      metadataSafe: { reference: ticket.reference },
    });
    return { ok: true };
  },
});

export const replyToSupportTicketUser = mutation({
  args: {
    sessionToken: v.string(),
    ticketId: v.id("supportTickets"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Support ticket not found.");
    if (!ticket.conversationId) throw new Error("This ticket is not linked to a support conversation.");

    const conversation = await ctx.db.get(ticket.conversationId);
    if (!conversation || String(conversation.userId) !== String(ticket.userId)) {
      throw new Error("Support conversation not found.");
    }

    const text = String(args.message || "").trim();
    if (!text) throw new Error("Reply message is required.");

    const now = Date.now();
    const safeText = redactSupportText(text).slice(0, 2000);
    const messageId = await ctx.db.insert("supportMessages", {
      conversationId: ticket.conversationId,
      role: "admin",
      textRedacted: safeText,
      metadata: {
        source: "super_admin_reply",
        ticketId: String(args.ticketId),
        ticketReference: ticket.reference,
      },
      createdAt: now,
    });

    await ctx.db.patch(ticket.conversationId, {
      activeTicketId: args.ticketId,
      lastMessageAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(args.ticketId, {
      status: ticket.status === "open" ? "in_review" : ticket.status,
      assignedAdminId: ticket.assignedAdminId || admin.profile._id,
      lastAdminResponseAt: now,
      updatedAt: now,
    });

    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "support.admin_reply",
      toUid: ticket.userId,
      fromUid: admin.profile._id,
      fromUsername: admin.profile.fullName || admin.profile.username || "MatchHai Support",
      status: "pending",
      dedupeKey: `support.admin_reply:${String(args.ticketId)}:${String(messageId)}`,
      dedupePolicy: "replace_active",
      route: ticket.userRole === "zone_admin" ? "/zone/modules/ai-support" : "/(player)/support",
      title: "Support replied",
      body: `MatchHai Support replied to ${ticket.reference}.`,
      data: {
        ticketId: String(args.ticketId),
        ticketReference: ticket.reference,
        conversationId: String(ticket.conversationId),
        href: ticket.userRole === "zone_admin" ? "/zone/modules/ai-support" : "/(player)/support",
      },
    });

    await insertSuperAdminAuditLog(ctx, admin, {
      action: "reply_to_support_ticket_user",
      module: "support",
      targetType: "supportTicket",
      targetId: String(args.ticketId),
      status: "success",
      metadataSafe: { reference: ticket.reference },
    });
    return { ok: true, messageId };
  },
});

export const assignSupportTicket = mutation({
  args: {
    sessionToken: v.string(),
    ticketId: v.id("supportTickets"),
    assignedAdminId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Support ticket not found.");

    await ctx.db.patch(args.ticketId, {
      assignedAdminId: args.assignedAdminId || admin.profile._id,
      status: ticket.status === "open" ? "in_review" : ticket.status,
      updatedAt: Date.now(),
    });

    await insertSuperAdminAuditLog(ctx, admin, {
      action: "assign_support_ticket",
      module: "support",
      targetType: "supportTicket",
      targetId: String(args.ticketId),
      status: "success",
      metadataSafe: { reference: ticket.reference },
    });
    return { ok: true };
  },
});

export const linkSupportTicketEntities = mutation({
  args: {
    sessionToken: v.string(),
    ticketId: v.id("supportTickets"),
    relatedMatchroomId: v.optional(v.id("matchrooms")),
    relatedBookingId: v.optional(v.id("bookingIntents")),
    relatedPaymentId: v.optional(v.id("paymentTransactions")),
    relatedTeamId: v.optional(v.id("teams")),
    relatedZoneId: v.optional(v.id("zones")),
    internalTags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Support ticket not found.");

    await ctx.db.patch(args.ticketId, {
      relatedMatchroomId: args.relatedMatchroomId || ticket.relatedMatchroomId,
      relatedBookingId: args.relatedBookingId || ticket.relatedBookingId,
      relatedPaymentId: args.relatedPaymentId || ticket.relatedPaymentId,
      relatedTeamId: args.relatedTeamId || ticket.relatedTeamId,
      relatedZoneId: args.relatedZoneId || ticket.relatedZoneId,
      internalTags: args.internalTags?.map((tag) => String(tag).trim().slice(0, 40)).filter(Boolean).slice(0, 10) || ticket.internalTags,
      updatedAt: Date.now(),
    });

    await insertSuperAdminAuditLog(ctx, admin, {
      action: "link_support_ticket_entities",
      module: "support",
      targetType: "supportTicket",
      targetId: String(args.ticketId),
      status: "success",
      metadataSafe: { reference: ticket.reference },
    });
    return { ok: true };
  },
});

export const resolveSupportTicket = mutation({
  args: {
    sessionToken: v.string(),
    ticketId: v.id("supportTickets"),
    resolutionSummary: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Support ticket not found.");

    const summary = String(args.resolutionSummary || "").trim();
    if (!summary) throw new Error("Resolution summary is required.");

    await ctx.db.patch(args.ticketId, {
      status: "resolved",
      assignedAdminId: ticket.assignedAdminId || admin.profile._id,
      resolutionSummary: redactSupportText(summary).slice(0, 1000),
      updatedAt: Date.now(),
    });

    if (ticket.status !== "resolved") {
      await notifySupportTicketStatusChanged(ctx, ticket, "resolved");
    }

    await insertSuperAdminAuditLog(ctx, admin, {
      action: "resolve_support_ticket",
      module: "support",
      targetType: "supportTicket",
      targetId: String(args.ticketId),
      status: "success",
      metadataSafe: { reference: ticket.reference },
    });
    return { ok: true };
  },
});

export const setUserRole = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    const { profile } = admin;

    if (profile._id === args.userId && !args.role) {
      throw new Error("You cannot remove your own super admin access.");
    }

    // Canonicalize any admin role to the single source-of-truth value (CR-05).
    // Empty/undefined removes the elevated role; non-admin roles pass through.
    const normalizedRole = (() => {
      const raw = String(args.role || "").trim().toLowerCase();
      if (!raw) return undefined;
      if (raw === SUPER_ADMIN_ROLE || raw === LEGACY_SUPER_ADMIN_ROLE || raw === "superadmin") {
        return SUPER_ADMIN_ROLE;
      }
      return args.role;
    })();

    await ctx.db.patch(args.userId, {
      role: normalizedRole,
      updatedAt: Date.now(),
    });

    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "account.role_changed",
      toUid: args.userId,
      status: "pending",
      dedupeKey: `account.role_changed:${String(args.userId)}:${String(args.role || "player")}`,
      dedupePolicy: "replace_active",
      route: "/profile",
      entity: { kind: "user", id: String(args.userId) },
      entityId: String(args.userId),
      title: "Account access updated",
      body: args.role
        ? `Your account role was updated to ${args.role}.`
        : "Your elevated account role was removed.",
      data: {
        userId: String(args.userId),
        role: args.role || null,
        href: "/profile",
      },
    });

    await insertSuperAdminAuditLog(ctx, admin, {
      action: "update_user_status",
      module: "users",
      targetType: "user",
      targetId: String(args.userId),
      status: "success",
      metadataSafe: { role: args.role || null },
    });
    return true;
  },
});

// Shared user suspend/reactivate logic. Caller MUST have already authenticated the
// super admin via getAuthenticatedAdmin. Patches the user, fires the account-status
// notification, and writes the audit log. Returns the prior status so callers can
// record richer context (e.g. a report moderation trail).
async function applyUserSuspension(
  ctx: any,
  admin: { authUser?: any; profile?: any },
  args: {
    userId: Id<"users">;
    status: "active" | "suspended";
    reason?: string | null;
    suspendedUntil?: number | null;
    auditAction?: string;
    auditMetadataExtra?: Record<string, unknown>;
  },
) {
  const target = await ctx.db.get(args.userId);
  if (!target) {
    throw new Error("User not found.");
  }

  if (String(admin.profile._id) === String(args.userId) && args.status === "suspended") {
    throw new Error("You cannot suspend your own Super Admin account.");
  }

  const now = Date.now();
  const reason = args.reason?.trim();
  const patch: Record<string, unknown> = {
    accountStatus: args.status,
    updatedAt: now,
  };

  if (args.status === "suspended") {
    patch.suspendedAt = now;
    patch.suspendedUntil = args.suspendedUntil ?? null;
    patch.suspensionReason = reason || "Suspended by Super Admin";
    patch.suspendedByAdminUserId = admin.profile._id;
  } else {
    patch.suspendedAt = undefined;
    patch.suspendedUntil = null;
    patch.suspensionReason = null;
    patch.suspendedByAdminUserId = undefined;
  }

  await ctx.db.patch(args.userId, patch);

  const isTemporarySuspension = args.status === "suspended" && (args.suspendedUntil ?? null) !== null;
  const suspensionBody = isTemporarySuspension
    ? "Your MatchHai account has been suspended for 7 days. Please review community rules."
    : "Your MatchHai account has been suspended. Contact support if you believe this was a mistake.";

  await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
    type: "account.status_updated",
    toUid: args.userId,
    status: args.status === "suspended" ? "rejected" : "accepted",
    dedupeKey: `account.status_updated:${String(args.userId)}:${args.status}`,
    dedupePolicy: "replace_active",
    route: "/profile",
    entity: { kind: "user", id: String(args.userId) },
    entityId: String(args.userId),
    title: args.status === "suspended" ? "Account suspended" : "Account reactivated",
    body: args.status === "suspended"
      ? suspensionBody
      : "Your MatchHai account has been reactivated.",
    data: {
      userId: String(args.userId),
      status: args.status,
      href: "/profile",
    },
  });

  await insertSuperAdminAuditLog(ctx, admin, {
    action: args.auditAction || (args.status === "suspended" ? "suspend_user" : "reactivate_user"),
    module: "users",
    targetType: "user",
    targetId: String(args.userId),
    status: "success",
    reason: reason || undefined,
    metadataSafe: {
      previousStatus: target.accountStatus || "active",
      status: args.status,
      hasReason: Boolean(reason),
      suspendedUntil: args.suspendedUntil ?? null,
      ...(args.auditMetadataExtra || {}),
    },
  });

  return { target, previousStatus: target.accountStatus || "active" };
}

export const setUserSuspension = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
    status: v.union(v.literal("active"), v.literal("suspended")),
    reason: v.optional(v.string()),
    suspendedUntil: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthenticatedAdmin(ctx, args.sessionToken);
    await applyUserSuspension(ctx, admin, {
      userId: args.userId,
      status: args.status,
      reason: args.reason,
      suspendedUntil: args.suspendedUntil ?? null,
    });
    return { ok: true };
  },
});

export const bootstrapInitialSuperAdmin = mutation({
  args: {
    password: v.string(),
    fullName: v.optional(v.string()),
    username: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Fail closed: never bootstrap an admin against an empty/default email (CR-03).
    if (!SUPER_ADMIN_EMAIL) {
      throw new Error(
        "SUPER_ADMIN_EMAIL is not configured. Set it in the Convex deployment environment before bootstrapping.",
      );
    }
    const [existingSuperAdmins, existingEmail] = await Promise.all([
      ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", "super-admin"))
        .take(1),
      ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", SUPER_ADMIN_EMAIL))
        .unique(),
    ]);

    const existingSuperAdmin = existingSuperAdmins[0];

    if (existingSuperAdmin) {
      return {
        ok: true,
        created: false,
        email: existingSuperAdmin.email,
        message: "Super admin already exists.",
      };
    }

    if (existingEmail) {
      await ctx.db.patch(existingEmail._id, {
        role: SUPER_ADMIN_ROLE,
        updatedAt: Date.now(),
      });
      return {
        ok: true,
        created: false,
        email: existingEmail.email,
        message: "Existing user promoted to super admin.",
      };
    }

    const now = Date.now();
    const phone = normalizePhone(args.phone);
    const username = normalizeUsername(args.username || "superadmin");
    const authPassword = await hashPassword(args.password);

    const authUserData: {
      email: string;
      name: string;
      emailVerified: boolean;
      createdAt: number;
      updatedAt: number;
      phoneNumber?: string;
      phoneNumberVerified?: boolean;
    } = {
      email: SUPER_ADMIN_EMAIL,
      name: args.fullName?.trim() || "MatchHai Super Admin",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    };

    if (phone) {
      authUserData.phoneNumber = phone;
      authUserData.phoneNumberVerified = false;
    }

    const authUser = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: authUserData,
      },
    });

    const authUserId = String((authUser as any).id || (authUser as any)?._id || "");
    if (!authUserId) {
      throw new Error("Failed to create Better Auth user.");
    }

    await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "account",
        data: {
          accountId: authUserId,
          providerId: "credential",
          password: authPassword,
          userId: authUserId,
          createdAt: now,
          updatedAt: now,
        },
      },
    });

    const userId = await ctx.db.insert("users", {
      authId: authUserId,
      email: SUPER_ADMIN_EMAIL,
      fullName: args.fullName?.trim() || "MatchHai Super Admin",
      username,
      usernameLower: username,
      phone,
      accountType: "player",
      isOnline: false,
      onboardingCompleted: true,
      onboardingStep: 4,
      role: SUPER_ADMIN_ROLE,
      phoneValidated: false,
      createdAt: now,
      updatedAt: now,
    });

    return {
      ok: true,
      created: true,
      email: SUPER_ADMIN_EMAIL,
      userId,
      message: "Super admin created.",
    };
  },
});
