import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { requireCurrentUser } from "./authz";
import { KYC_VERIFICATION_REQUIRED_MESSAGE, assertKycAccessAllowed } from "./kycGate";

const notificationStatus = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("rejected"),
  v.literal("declined"),
  v.literal("read"),
  v.literal("expired")
);

const recipientRoleValidator = v.union(
  v.literal("player"),
  v.literal("zone_admin"),
  v.literal("super_admin")
);

const pushPolicyValidator = v.union(
  v.literal("none"),
  v.literal("eligible"),
  v.literal("force")
);

const pushStateValidator = v.union(
  v.literal("queued"),
  v.literal("sending"),
  v.literal("pending"),
  v.literal("sent"),
  v.literal("receipt_ok"),
  v.literal("failed"),
  v.literal("no_device"),
  v.literal("skipped")
);

const dedupePolicyValidator = v.union(
  v.literal("upsert_active"),
  v.literal("replace_active"),
  v.literal("versioned_new")
);

const DEFAULT_LIMIT = 50;
const DEFAULT_INBOX_LIMIT = 100;
const PUSH_SEND_STALE_MS = 10 * 60 * 1000;

type NotificationStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "declined"
  | "read"
  | "expired";
type RecipientRole = "player" | "zone_admin" | "super_admin";
type PushPolicy = "none" | "eligible" | "force";
type PushState =
  | "queued"
  | "sending"
  | "pending"
  | "sent"
  | "receipt_ok"
  | "failed"
  | "no_device"
  | "skipped";
type DedupePolicy = "upsert_active" | "replace_active" | "versioned_new";

type CanonicalInput = {
  toUid: any;
  fromUid?: any;
  fromUsername?: string;
  type: string;
  status?: NotificationStatus;
  title?: string;
  body?: string;
  route?: string;
  recipientRole?: RecipientRole;
  dedupeKey?: string;
  dedupePolicy?: DedupePolicy;
  pushPolicy?: PushPolicy;
  entity?: { kind?: string | null; id?: string | null } | null;
  entityKey?: string;
  entityId?: string;
  teamId?: any;
  teamName?: string;
  matchroomId?: any;
  data?: Record<string, any> | null;
  expiresAt?: number;
  isRead?: boolean;
};

function asStringId(value: unknown) {
  return value == null ? undefined : String(value);
}

function normalizeNotificationGameKey(value: unknown) {
  const gameKey = String(value || "").trim().toLowerCase();
  return gameKey === "fc25" ? "fc26" : gameKey || undefined;
}

function canonicalizeType(rawType: string) {
  switch (rawType) {
    case "friend_request":
    case "social.friend_request":
      return "social.friend_request";
    case "social.friend_request_result":
      return "social.friend_request_result";
    case "team_invite":
    case "team.invite":
      return "team.invite";
    case "team.invite_response":
      return "team.invite_response";
    case "team_join_request":
    case "team.join_request":
      return "team.join_request";
    case "team_join_decision":
    case "team.join_request_decision":
      return "team.join_request_decision";
    case "match_join_request":
    case "match.join_request":
      return "match.join_request";
    case "match_join_request_result":
    case "match.join_request_result":
      return "match.join_request_result";
    case "match_seat_invitation":
    case "match.seat_invite":
      return "match.seat_invite";
    case "match_payment_required":
    case "match.payment_required":
      return "match.payment_required";
    case "match_created_nearby":
    case "match.created_nearby":
      return "match.created_nearby";
    case "match_cancelled_admin":
    case "match.cancelled":
      return "match.cancelled";
    case "booking_update":
    case "booking.request_submitted":
      return "booking.request_submitted";
    case "booking_request_accepted":
    case "booking.request_accepted":
      return "booking.request_accepted";
    case "booking_request_rejected":
    case "booking.request_rejected":
      return "booking.request_rejected";
    case "booking_counter_offer":
    case "booking.counter_offer":
      return "booking.counter_offer";
    case "team_match_challenge":
    case "team.challenge_received":
      return "team.challenge_received";
    case "team_challenge_payment_required":
    case "team.challenge_payment_required":
      return "team.challenge_payment_required";
    case "team_match_challenge_update":
    case "team.challenge_updated":
      return "team.challenge_updated";
    case "team.member_removed":
      return "team.member_removed";
    case "team.captain_transferred":
      return "team.captain_transferred";
    case "team.deleted":
      return "team.deleted";
    case "resource.allocation_action":
      return "resource.allocation_action";
    case "moderation.report_submitted":
      return "moderation.report_submitted";
    case "moderation.report_updated":
      return "moderation.report_updated";
    case "moderation.review_needed":
      return "moderation.review_needed";
    case "match.invite_response":
      return "match.invite_response";
    case "match.payment_result":
      return "match.payment_result";
    case "match.participant_removed":
      return "match.participant_removed";
    case "match.captain_transferred":
      return "match.captain_transferred";
    case "booking.counter_offer_result":
      return "booking.counter_offer_result";
    case "booking.request_closed_elsewhere":
      return "booking.request_closed_elsewhere";
    case "zone.registration_submitted":
      return "zone.registration_submitted";
    case "zone.status_updated":
      return "zone.status_updated";
    case "zone_live_nearby":
    case "zone.live_nearby":
      return "zone.live_nearby";
    case "wallet.topup_result":
      return "wallet.topup_result";
    case "account.role_changed":
      return "account.role_changed";
    case "kyc.status_updated":
      return "kyc.status_updated";
    case "kyc.review_needed":
      return "kyc.review_needed";
    case "operations.general":
      return "operations.general";
    case "payments.attention_required":
      return "payments.attention_required";
    case "general":
    case "system.general":
      return "system.general";
    default:
      return rawType;
  }
}

function inferLegacyType(type: string) {
  switch (type) {
    case "social.friend_request":
    case "social.friend_request_result":
      return "friend_request";
    case "team.invite":
    case "team.invite_response":
      return "team_invite";
    case "team.join_request":
      return "team_join_request";
    case "team.join_request_decision":
      return "team_join_decision";
    case "match.join_request":
      return "match_join_request";
    case "match.seat_invite":
    case "match.invite_response":
    case "match.payment_result":
      return "match_seat_invitation";
    case "match.payment_required":
      return "match_seat_invitation";
    case "match.created_nearby":
      return "match_created_nearby";
    case "zone.live_nearby":
      return "zone_live_nearby";
    case "match.cancelled":
      return "match_cancelled_admin";
    case "booking.request_submitted":
      return "booking_update";
    case "booking.request_accepted":
      return "booking_request_accepted";
    case "booking.request_rejected":
      return "booking_request_rejected";
    case "booking.counter_offer":
    case "booking.counter_offer_result":
      return "booking_counter_offer";
    case "team.challenge_received":
      return "team_match_challenge";
    case "team.challenge_payment_required":
      return "team_match_challenge_update";
    case "team.challenge_updated":
      return "team_match_challenge_update";
    case "system.general":
      return "general";
    default:
      return type;
  }
}

function inferRecipientRole(recipient: any): RecipientRole {
  const role = String(recipient?.role || recipient?.accountType || "").toLowerCase();
  if (role === "zone") return "zone_admin";
  if (role === "super_admin" || role === "super-admin") return "super_admin";
  return "player";
}

function defaultPushPolicy(type: string): PushPolicy {
  if (type === "match.cancelled") return "force";
  return "eligible";
}

function defaultDedupePolicy(type: string): DedupePolicy {
  switch (type) {
    case "social.friend_request":
    case "team.join_request":
    case "match.join_request":
    case "match.payment_required":
    case "match.created_nearby":
    case "match.cancelled":
    case "booking.request_submitted":
    case "booking.counter_offer":
    case "team.challenge_received":
    case "team.challenge_payment_required":
    case "moderation.report_submitted":
    case "moderation.review_needed":
    case "payments.attention_required":
    case "zone.live_nearby":
      return "upsert_active";
    case "team.invite":
    case "team.invite_response":
    case "team.join_request_decision":
    case "match.join_request_result":
    case "match.seat_invite":
    case "match.invite_response":
    case "match.payment_result":
    case "booking.request_accepted":
    case "booking.request_rejected":
    case "booking.counter_offer_result":
    case "booking.request_closed_elsewhere":
    case "resource.allocation_action":
    case "zone.registration_submitted":
    case "zone.status_updated":
    case "wallet.topup_result":
    case "account.role_changed":
    case "kyc.status_updated":
    case "kyc.review_needed":
      return "replace_active";
    default:
      return "versioned_new";
  }
}

function isNotificationActive(notification: any) {
  const now = Date.now();
  return notification?.isArchived !== true
    && notification?.status !== "expired"
    && (!notification?.expiresAt || notification.expiresAt > now);
}

const IN_FLIGHT_PUSH_STATES = new Set<PushState>(["queued", "sending", "pending"]);
const RETRYABLE_PUSH_STATES = new Set<PushState>(["failed", "no_device"]);
const COMPLETED_PUSH_STATES = new Set<PushState>(["sent", "receipt_ok"]);

function safePayloadString(value: unknown) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return String(value ?? "");
  }
}

function hasNotificationPushPayloadChanged(
  active: any,
  next: {
    title?: string;
    body?: string;
    route?: string;
    data?: Record<string, any> | null;
    pushPolicy: PushPolicy;
  }
) {
  return (
    active.title !== next.title ||
    active.body !== next.body ||
    active.route !== next.route ||
    active.pushPolicy !== next.pushPolicy ||
    safePayloadString(active.data || {}) !== safePayloadString(next.data || {})
  );
}

function normalizePushState(value: unknown): PushState | undefined {
  const state = String(value || "");
  if (
    state === "queued" ||
    state === "sending" ||
    state === "pending" ||
    state === "sent" ||
    state === "receipt_ok" ||
    state === "failed" ||
    state === "no_device" ||
    state === "skipped"
  ) {
    return state;
  }
  return undefined;
}

function shouldQueuePushAfterActiveUpsert(
  active: any,
  pushPolicy: PushPolicy,
  payloadChanged: boolean
) {
  if (pushPolicy === "none" || !isNotificationActive(active)) return false;

  const state = normalizePushState(active.pushState);
  if (!state) return true;
  if (IN_FLIGHT_PUSH_STATES.has(state)) return false;
  if (RETRYABLE_PUSH_STATES.has(state)) return true;
  if (state === "skipped") return payloadChanged || active.pushPolicy === "none";
  if (COMPLETED_PUSH_STATES.has(state)) return payloadChanged;
  return payloadChanged;
}

async function scheduleNotificationPush(ctx: any, notificationId: any, shouldSchedule: boolean) {
  if (!shouldSchedule) return false;
  await ctx.scheduler.runAfter(
    0,
    (internal as any).pushNotificationsActions.sendForNotification,
    { notificationId }
  );
  return true;
}

const HIDDEN_INBOX_TYPES_WHEN_REJECTED = new Set([
  "team.challenge_received",
  "team.challenge_updated",
]);

function isHiddenFromInbox(notification: any) {
  const type = canonicalizeType(String(notification?.type || ""));
  const status = String(notification?.status || "");
  return status === "rejected" && HIDDEN_INBOX_TYPES_WHEN_REJECTED.has(type);
}

function sortByCreatedAtDesc<T = any>(items: T[]) {
  return [...items].sort(
    (a: any, b: any) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0)
  );
}

function getPendingMatchJoinDedupeKey(notification: any) {
  if (notification?.status !== "pending") return "";
  if (canonicalizeType(String(notification?.type || "")) !== "match.join_request") return "";
  const data = notification?.data as any;
  const matchroomId = String(notification?.matchroomId || data?.matchroomId || "");
  const requesterUid = String(notification?.fromUid || data?.requesterUid || "");
  if (!matchroomId || !requesterUid) return "";
  return `match.join_request:${matchroomId}:${requesterUid}`;
}

function collapsePendingMatchJoinDuplicates<T = any>(notifications: T[]) {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const notification of notifications as any[]) {
    const key = getPendingMatchJoinDedupeKey(notification);
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    result.push(notification);
  }
  return result;
}

function inferEntity(type: string, input: CanonicalInput) {
  if (input.entity?.kind || input.entity?.id) {
    return {
      kind: input.entity?.kind || null,
      id: input.entity?.id || null,
    };
  }

  if (input.matchroomId) return { kind: "matchroom", id: String(input.matchroomId) };
  if (input.teamId) return { kind: "team", id: String(input.teamId) };

  const rawData = input.data || {};
  if (rawData.offerId) return { kind: "booking_offer", id: String(rawData.offerId) };
  if (rawData.requestId) return { kind: "booking_request", id: String(rawData.requestId) };
  if (rawData.challengeId) return { kind: "challenge", id: String(rawData.challengeId) };
  if (rawData.reportId) return { kind: "report", id: String(rawData.reportId) };
  if (rawData.verificationId) return { kind: "identityVerification", id: String(rawData.verificationId) };

  if (type.startsWith("booking.")) return { kind: "booking_request", id: input.entityId || null };
  if (type.startsWith("team.")) return { kind: "team", id: input.entityId || asStringId(input.teamId) || null };
  if (type.startsWith("match.")) return { kind: "matchroom", id: input.entityId || asStringId(input.matchroomId) || null };
  if (type.startsWith("kyc.")) return { kind: "identityVerification", id: input.entityId || null };
  return { kind: "system", id: input.entityId || null };
}

function routeValue(value: unknown) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function routeWithQuery(pathname: string, params: Record<string, unknown>) {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  return query ? `${pathname}?${query}` : pathname;
}

function matchroomRoute(matchroomId: unknown) {
  const id = routeValue(matchroomId);
  return id ? `/matchrooms/${encodeURIComponent(id)}` : "/(player)/inbox";
}

function superAdminMatchroomRoute(matchroomId: unknown) {
  const id = routeValue(matchroomId);
  return id ? `/super-admin/matchroom/${encodeURIComponent(id)}` : "/super-admin";
}

function matchroomPaymentRoute(intentId: unknown, matchroomId: unknown) {
  const id = routeValue(intentId);
  return id ? `/matchrooms/book/pay/${encodeURIComponent(id)}` : matchroomRoute(matchroomId);
}

function teamRoute(teamId: unknown) {
  const id = routeValue(teamId);
  return id ? `/teams/${encodeURIComponent(id)}` : "/teams";
}

function teamChallengeRoute(challengeId: unknown) {
  const id = routeValue(challengeId);
  return id ? routeWithQuery("/teams/challenge", { id }) : "/teams/challenges";
}

function zoneBookingRequestRoute(requestId: unknown) {
  return routeWithQuery("/zone/modules/bookings", {
    segment: "requests",
    requestId,
    expandedRequestId: requestId,
    focusRequestId: requestId,
  });
}

function zoneBookingMatchroomRoute(matchroomId: unknown, requestId?: unknown) {
  return routeWithQuery("/zone/modules/bookings", {
    segment: "matchrooms",
    matchroomId,
    requestId,
  });
}

function superAdminReportRoute(reportId: unknown) {
  const id = routeValue(reportId);
  return id ? `/super-admin/report/${encodeURIComponent(id)}` : "/super-admin/reports";
}

function playerReportRoute(reportId: unknown) {
  const id = routeValue(reportId);
  return id ? `/(player)/report/${encodeURIComponent(id)}` : "/(player)/reports";
}

function superAdminSupportTicketRoute(ticketId: unknown) {
  const id = routeValue(ticketId);
  return id ? `/super-admin/support-ticket/${encodeURIComponent(id)}` : "/super-admin/support-tickets";
}

function normalizeExplicitNotificationRoute(route?: unknown) {
  const text = routeValue(route);
  if (!text) return undefined;
  if (text === "/zone/profile") return "/zone/(tabs)/profile";
  if (text === "/super-admin/reports") return "/super-admin/reports";
  return text;
}

function buildCanonicalRoute(source: {
  type: string;
  route?: string;
  recipientRole?: RecipientRole;
  matchroomId?: unknown;
  teamId?: unknown;
  data?: Record<string, any> | null;
}) {
  const rawData = source.data || {};
  const type = canonicalizeType(String(source.type || rawData.canonicalType || ""));
  const recipientRole = String(source.recipientRole || rawData.recipientRole || "").toLowerCase();
  const explicitRoute = normalizeExplicitNotificationRoute(source.route || rawData.route || rawData.href);
  const requestId = routeValue(rawData.requestId || rawData.requestRef);
  const matchroomId = asStringId(source.matchroomId) || asStringId(rawData.matchroomId);
  const teamId = asStringId(source.teamId) || asStringId(rawData.teamId);
  const intentId = routeValue(rawData.intentId);
  const challengeId = routeValue(rawData.challengeId);
  const offerId = routeValue(rawData.offerId);
  const reportId = routeValue(rawData.reportId);
  const ticketId = routeValue(rawData.ticketId || rawData.supportTicketId);

  if (type === "booking.request_submitted") {
    return recipientRole === "zone_admin" ? zoneBookingRequestRoute(requestId) : matchroomRoute(matchroomId);
  }
  if (type === "booking.counter_offer_result") {
    return String(rawData.decision || "").toLowerCase() === "accepted" && matchroomId
      ? zoneBookingMatchroomRoute(matchroomId, requestId)
      : zoneBookingRequestRoute(requestId);
  }
  if (type === "booking.counter_offer") return "/(player)/inbox";
  if (
    type === "booking.request_accepted" ||
    type === "booking.request_rejected" ||
    type === "booking.request_closed_elsewhere"
  ) {
    return matchroomRoute(matchroomId);
  }

  if (type === "match.payment_required") return matchroomPaymentRoute(intentId, matchroomId);
  if (type === "match.join_request" || type === "match.join_request_result" || type.startsWith("match.")) {
    return matchroomRoute(matchroomId);
  }
  if (type === "zone.matchroom_full") return zoneBookingMatchroomRoute(matchroomId);

  if (
    type === "team.challenge_received" ||
    type === "team.challenge_payment_required" ||
    type === "team.challenge_updated"
  ) {
    return teamChallengeRoute(challengeId);
  }
  if (type.startsWith("team.")) return teamRoute(teamId);

  if (type.startsWith("withdrawal.")) {
    if (recipientRole === "super_admin" || recipientRole === "super-admin") return "/super-admin/withdrawals";
    return "/zone/wallet";
  }

  if (type === "payments.booking_credit") {
    if (recipientRole === "super_admin" || recipientRole === "super-admin") {
      return superAdminMatchroomRoute(matchroomId);
    }
    return explicitRoute || matchroomRoute(matchroomId);
  }

  if (type === "kyc.review_needed") return "/super-admin/identity-verifications";
  if (type === "kyc.status_updated") {
    return recipientRole === "zone_admin" ? "/zone/(tabs)/profile" : "/auth/verification-required";
  }

  if (type.startsWith("support.")) {
    if (recipientRole === "super_admin") return superAdminSupportTicketRoute(ticketId);
    if (recipientRole === "zone_admin") return "/zone/modules/support";
    return "/(player)/support";
  }
  if (type.startsWith("moderation.") || type.includes("report")) {
    if (recipientRole === "super_admin") return superAdminReportRoute(reportId);
    if (recipientRole === "zone_admin") {
      return reportId ? `/zone/report/${encodeURIComponent(reportId)}` : "/zone/modules/support";
    }
    return playerReportRoute(reportId);
  }

  if (challengeId) return teamChallengeRoute(challengeId);
  if (offerId && recipientRole === "zone_admin") return zoneBookingRequestRoute(requestId);
  if (requestId && recipientRole === "zone_admin") return zoneBookingRequestRoute(requestId);
  if (matchroomId) {
    if (recipientRole === "super_admin" || recipientRole === "super-admin") {
      return superAdminMatchroomRoute(matchroomId);
    }
    return matchroomRoute(matchroomId);
  }
  if (teamId) return teamRoute(teamId);
  if (explicitRoute) return explicitRoute;

  if (recipientRole === "zone_admin") return "/zone/modules/notifications";
  if (recipientRole === "super_admin") return "/super-admin";
  return "/(player)/inbox";
}

function buildCanonicalNotificationData(source: {
  _id?: unknown;
  type?: string;
  route?: string;
  dedupeKey?: string;
  entity?: { kind?: string | null; id?: string | null } | null;
  recipientRole?: RecipientRole;
  pushPolicy?: PushPolicy;
  entityId?: unknown;
  teamId?: unknown;
  teamName?: unknown;
  matchroomId?: unknown;
  fromUid?: unknown;
  toUid?: unknown;
  data?: Record<string, any> | null;
}) {
  const rawData = source.data || {};
  return {
    ...rawData,
    notificationId: asStringId(source._id) || asStringId(rawData.notificationId),
    canonicalType: source.type || rawData.canonicalType,
    legacyType: rawData.legacyType,
    route: source.route || rawData.route || rawData.href || null,
    dedupeKey: source.dedupeKey || rawData.dedupeKey || null,
    recipientRole: source.recipientRole || rawData.recipientRole || null,
    pushPolicy: source.pushPolicy || rawData.pushPolicy || null,
    entity: source.entity || rawData.entity || null,
    entityId: asStringId(source.entityId) || asStringId(rawData.entityId),
    teamId: asStringId(source.teamId) || asStringId(rawData.teamId),
    teamName: source.teamName || rawData.teamName || null,
    matchroomId: asStringId(source.matchroomId) || asStringId(rawData.matchroomId),
    fromUid: asStringId(source.fromUid) || asStringId(rawData.fromUid),
    toUid: asStringId(source.toUid) || asStringId(rawData.toUid),
    intentId: asStringId(rawData.intentId),
    requestId: asStringId(rawData.requestId),
    offerId: asStringId(rawData.offerId),
    challengeId: asStringId(rawData.challengeId),
    zoneId: asStringId(rawData.zoneId),
    branchId: asStringId(rawData.branchId),
    gameKey: normalizeNotificationGameKey(rawData.gameKey || rawData.game),
  };
}

function serializeNotification(notification: any) {
  if (!notification) return notification;
  const type = canonicalizeType(String(notification.type || ""));
  const route = buildCanonicalRoute({
    type,
    route: notification.route,
    recipientRole: notification.recipientRole,
    matchroomId: notification.matchroomId,
    teamId: notification.teamId,
    data: notification.data,
  });
  const entity = notification.data?.entity || inferEntity(type, notification);

  return {
    ...notification,
    _id: String(notification._id),
    type,
    legacyType: inferLegacyType(type),
    fromUid: notification.fromUid ? String(notification.fromUid) : undefined,
    toUid: String(notification.toUid),
    entityId: notification.entityId ? String(notification.entityId) : undefined,
    teamId: notification.teamId ? String(notification.teamId) : undefined,
    matchroomId: notification.matchroomId ? String(notification.matchroomId) : undefined,
    recipientRole: notification.recipientRole || "player",
    route,
    entity,
    isArchived: notification.isArchived === true,
    dedupeKey: notification.dedupeKey,
    pushPolicy: notification.pushPolicy || defaultPushPolicy(type),
    pushState: notification.pushState,
    data: buildCanonicalNotificationData({
      ...notification,
      type,
      route,
      entity,
      recipientRole: notification.recipientRole || "player",
      pushPolicy: notification.pushPolicy || defaultPushPolicy(type),
    }),
  };
}

async function listNotificationsForUserBase(
  ctx: any,
  args: { userId: any; status?: NotificationStatus; limit?: number }
) {
  const limit = args.limit || DEFAULT_LIMIT;
  if (args.status) {
    return await ctx.db
      .query("notifications")
      .withIndex("by_toUid_status_createdAt", (q: any) =>
        q.eq("toUid", args.userId).eq("status", args.status!)
      )
      .order("desc")
      .take(limit);
  }

  return await ctx.db
    .query("notifications")
    .withIndex("by_toUid", (q: any) => q.eq("toUid", args.userId))
    .order("desc")
    .take(limit);
}

async function listUnreadNotificationsForUser(ctx: any, userId: any, limit: number) {
  return await ctx.db
    .query("notifications")
    .withIndex("by_toUid_isRead_createdAt", (q: any) =>
      q.eq("toUid", userId).eq("isRead", false)
    )
    .order("desc")
    .take(limit);
}

async function findActiveNotificationByDedupeKey(ctx: any, dedupeKey?: string) {
  if (!dedupeKey) return null;
  const rows = await ctx.db
    .query("notifications")
    .withIndex("by_dedupeKey", (q: any) => q.eq("dedupeKey", dedupeKey))
    .collect();
  return sortByCreatedAtDesc(rows).find(isNotificationActive) || null;
}

async function archiveNotificationById(ctx: any, notificationId: any, now: number) {
  const current = await ctx.db.get(notificationId);
  if (!current || current.isArchived === true) return false;
  await ctx.db.patch(notificationId, {
    isArchived: true,
    archivedAt: now,
    updatedAt: now,
  });
  return true;
}

async function enforceAuthGate(ctx: any, type: string) {
  if (!["team.join_request", "match.join_request", "team.challenge_received"].includes(type)) {
    return;
  }
  const authUser = await authComponent.getAuthUser(ctx);
  if (!authUser?.userId) throw new Error("Not authenticated");
  const profile = await ctx.db
    .query("users")
    .withIndex("by_authId", (q: any) => q.eq("authId", authUser.userId))
    .unique();
  assertKycAccessAllowed(profile, KYC_VERIFICATION_REQUIRED_MESSAGE);
}

async function requireNotificationOwner(ctx: any, notificationId: any) {
  const actor = await requireCurrentUser(ctx);
  const notification = await ctx.db.get(notificationId);
  if (!notification || String(notification.toUid) !== String(actor.user._id)) {
    throw new Error("Notification not found");
  }
  return { actor, notification };
}

async function requireActorCanReadMatchroomNotifications(ctx: any, matchroomId: any) {
  const actor = await requireCurrentUser(ctx);
  const room = await ctx.db.get(matchroomId);
  if (!room) throw new Error("Matchroom not found");
  const actorId = String(actor.user._id);
  const isHost = String(room.hostUid || "") === actorId;
  const isCaptain = String(room.captainUidA || "") === actorId || String(room.captainUidB || "") === actorId;
  const isPlayer = Array.isArray(room.playerUids) && room.playerUids.map(String).includes(actorId);
  let isZoneOwner = false;
  if (room.zoneId) {
    try {
      const zone = await ctx.db.get(room.zoneId);
      isZoneOwner = String(zone?.ownerUid || "") === actorId;
    } catch {
      isZoneOwner = false;
    }
  }
  if (!isHost && !isCaptain && !isPlayer && !isZoneOwner) {
    throw new Error("Not authorized");
  }
  return actor;
}

async function createCanonicalInternal(ctx: any, input: CanonicalInput, skipAuthGate = false) {
  const now = Date.now();
  const type = canonicalizeType(String(input.type || ""));
  if (!skipAuthGate) await enforceAuthGate(ctx, type);

  const recipient = await ctx.db.get(input.toUid);
  const recipientRole = input.recipientRole || inferRecipientRole(recipient);
  const entity = inferEntity(type, input);
  const route = buildCanonicalRoute({
    type,
    route: input.route,
    recipientRole,
    matchroomId: input.matchroomId,
    teamId: input.teamId,
    data: input.data,
  });
  const pushPolicy = input.pushPolicy || defaultPushPolicy(type);
  const dedupePolicy = input.dedupePolicy || defaultDedupePolicy(type);
  const baseDedupeKey = input.dedupeKey || input.entityKey;
  const effectiveDedupeKey =
    dedupePolicy === "versioned_new" && baseDedupeKey
      ? `${baseDedupeKey}#${now}`
      : baseDedupeKey;

  if (baseDedupeKey) {
    const active = await findActiveNotificationByDedupeKey(ctx, baseDedupeKey);
    if (active) {
      if (dedupePolicy === "upsert_active") {
        const nextTitle = input.title ?? active.title;
        const nextBody = input.body ?? active.body;
        const nextData = {
          ...(active.data || {}),
          ...(input.data || {}),
          legacyType: inferLegacyType(type),
          route,
          entity,
          dedupeKey: baseDedupeKey,
          recipientRole,
          pushPolicy,
        };
        const payloadChanged = hasNotificationPushPayloadChanged(active, {
          title: nextTitle,
          body: nextBody,
          route,
          data: nextData,
          pushPolicy,
        });
        const shouldQueuePush = shouldQueuePushAfterActiveUpsert(active, pushPolicy, payloadChanged);
        const currentPushState = normalizePushState(active.pushState);
        const shouldSkipPendingPush =
          pushPolicy === "none" &&
          currentPushState !== "sent" &&
          currentPushState !== "receipt_ok";

        await ctx.db.patch(active._id, {
          title: nextTitle,
          body: nextBody,
          route,
          entityKey: input.entityKey ?? active.entityKey ?? baseDedupeKey,
          recipientRole,
          pushPolicy,
          ...(shouldQueuePush
            ? {
                pushState: "queued" as const,
                pushAttemptedAt: undefined,
                pushDeliveredAt: undefined,
                pushError: undefined,
              }
            : shouldSkipPendingPush
              ? {
                  pushState: "skipped" as const,
                  pushAttemptedAt: undefined,
                  pushDeliveredAt: undefined,
                  pushError: undefined,
                }
              : {}),
          entityId: input.entityId ?? active.entityId,
          teamId: input.teamId ?? active.teamId,
          teamName: input.teamName ?? active.teamName,
          matchroomId: input.matchroomId ?? active.matchroomId,
          data: nextData,
          expiresAt: input.expiresAt ?? active.expiresAt,
          updatedAt: now,
        });
        const scheduledPush = await scheduleNotificationPush(ctx, active._id, shouldQueuePush);
        return { notificationId: active._id, created: false, scheduledPush };
      }

      if (dedupePolicy === "replace_active") {
        await archiveNotificationById(ctx, active._id, now);
      }
    }
  }

  const notificationId = await ctx.db.insert("notifications", {
    toUid: input.toUid,
    fromUid: input.fromUid,
    fromUsername: input.fromUsername,
    type,
    status: input.status || "pending",
    isRead: input.isRead === true,
    entityKey: input.entityKey || baseDedupeKey,
    isArchived: false,
    readAt: input.isRead === true ? now : undefined,
    archivedAt: undefined,
    recipientRole,
    route,
    dedupeKey: effectiveDedupeKey,
    pushPolicy,
    pushState: pushPolicy === "none" ? "skipped" : "queued",
    pushAttemptedAt: undefined,
    pushDeliveredAt: undefined,
    pushError: undefined,
    entityId: input.entityId,
    teamId: input.teamId,
    teamName: input.teamName,
    matchroomId: input.matchroomId,
    title: input.title,
    body: input.body,
    data: {
      ...(input.data || {}),
      canonicalType: type,
      legacyType: inferLegacyType(type),
      route,
      entity,
      dedupeKey: effectiveDedupeKey,
      recipientRole,
      pushPolicy,
    },
    expiresAt: input.expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  const scheduledPush = await scheduleNotificationPush(ctx, notificationId, pushPolicy !== "none");

  return { notificationId, created: true, scheduledPush };
}

export const resolveCanonicalRoute = query({
  args: {
    type: v.string(),
    route: v.optional(v.string()),
    recipientRole: v.optional(recipientRoleValidator),
    matchroomId: v.optional(v.union(v.id("matchrooms"), v.string())),
    teamId: v.optional(v.union(v.id("teams"), v.string())),
    data: v.optional(v.any()),
  },
  handler: async (_ctx, args) =>
    buildCanonicalRoute({
      type: canonicalizeType(args.type),
      route: args.route,
      recipientRole: args.recipientRole,
      matchroomId: args.matchroomId,
      teamId: args.teamId,
      data: args.data,
    }),
});

export const getById = query({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const { notification } = await requireNotificationOwner(ctx, args.notificationId);
    return serializeNotification(notification);
  },
});

export const listForUser = query({
  args: {
    userId: v.id("users"),
    status: v.optional(notificationStatus),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actor = await requireCurrentUser(ctx);
    const notifications = await listNotificationsForUserBase(ctx, { ...args, userId: actor.user._id });
    return notifications.filter(isNotificationActive).map(serializeNotification);
  },
});

export const listUnreadForUser = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actor = await requireCurrentUser(ctx);
    const notifications = await listUnreadNotificationsForUser(
      ctx,
      actor.user._id,
      args.limit || DEFAULT_LIMIT
    );
    return notifications.filter(isNotificationActive).map(serializeNotification);
  },
});

export const listInboxPage = query({
  args: {
    userId: v.id("users"),
    tab: v.union(v.literal("pending"), v.literal("resolved")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actor = await requireCurrentUser(ctx);
    const baseLimit = args.limit || DEFAULT_INBOX_LIMIT;
    const recent = await ctx.db
      .query("notifications")
      .withIndex("by_toUid", (q: any) => q.eq("toUid", actor.user._id))
      .order("desc")
      .take(baseLimit * 4);

    const visible = recent
      .filter(isNotificationActive)
      .filter((notification: any) => !isHiddenFromInbox(notification));
    if (args.tab === "pending") {
      return collapsePendingMatchJoinDuplicates(visible)
        .filter((notification: any) => notification.status === "pending")
        .slice(0, baseLimit)
        .map(serializeNotification);
    }

    return visible
      .filter((notification: any) => notification.status !== "pending")
      .slice(0, baseLimit)
      .map(serializeNotification);
  },
});

export const countPendingFast = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const actor = await requireCurrentUser(ctx);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_toUid_status_createdAt", (q: any) =>
        q.eq("toUid", actor.user._id).eq("status", "pending")
      )
      .collect();
    return collapsePendingMatchJoinDuplicates(
      notifications.filter(isNotificationActive),
    ).length;
  },
});

export const countPending = countPendingFast;

export const countUnreadFast = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const actor = await requireCurrentUser(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_toUid_isRead_createdAt", (q: any) =>
        q.eq("toUid", actor.user._id).eq("isRead", false)
      )
      .collect();
    return collapsePendingMatchJoinDuplicates(
      unread
        .filter(isNotificationActive)
        .filter((notification: any) => !isHiddenFromInbox(notification)),
    ).length;
  },
});

export const countUnread = countUnreadFast;

export const checkExists = query({
  args: { entityKey: v.string() },
  handler: async (ctx, args) => (await findActiveNotificationByDedupeKey(ctx, args.entityKey)) !== null,
});

export const listByFromUidAndType = query({
  args: {
    fromUid: v.id("users"),
    type: v.string(),
    status: v.optional(notificationStatus),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actor = await requireCurrentUser(ctx);
    const limit = args.limit || DEFAULT_LIMIT;
    const canonicalType = canonicalizeType(args.type);
    if (String(args.fromUid) !== String(actor.user._id)) throw new Error("Not authorized");
    const notifications = args.status
      ? await ctx.db
          .query("notifications")
          .withIndex("by_fromUid_type_status", (q: any) =>
            q.eq("fromUid", args.fromUid).eq("type", canonicalType).eq("status", args.status!)
          )
          .take(limit)
      : await ctx.db
          .query("notifications")
          .withIndex("by_fromUid", (q: any) => q.eq("fromUid", args.fromUid))
          .order("desc")
          .take(limit * 2);

    return notifications
      .filter((notification: any) => canonicalizeType(String(notification.type || "")) === canonicalType)
      .filter(isNotificationActive)
      .map(serializeNotification)
      .slice(0, limit);
  },
});

export const listOutgoingMatchroomJoinRequests = query({
  args: {
    fromUid: v.id("users"),
    matchroomId: v.optional(v.id("matchrooms")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actor = await requireCurrentUser(ctx);
    const limit = args.limit || DEFAULT_LIMIT;
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_fromUid_type_status", (q: any) =>
        q.eq("fromUid", actor.user._id).eq("type", "match.join_request").eq("status", "pending")
      )
      .order("desc")
      .take(limit * 3);

    return collapsePendingMatchJoinDuplicates(notifications)
      .filter(isNotificationActive)
      .filter((notification: any) => {
        if (!args.matchroomId) return true;
        const data = notification.data as any;
        return String(notification.matchroomId || data?.matchroomId || "") === String(args.matchroomId);
      })
      .map(serializeNotification)
      .slice(0, limit);
  },
});

export const listByFromUid = query({
  args: {
    fromUid: v.id("users"),
    type: v.optional(v.string()),
    status: v.optional(notificationStatus),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actor = await requireCurrentUser(ctx);
    if (String(args.fromUid) !== String(actor.user._id)) throw new Error("Not authorized");
    let notifications = await ctx.db
      .query("notifications")
      .withIndex("by_fromUid", (q: any) => q.eq("fromUid", args.fromUid))
      .order("desc")
      .take((args.limit || DEFAULT_LIMIT) * 2);

    if (args.type) {
      const canonicalType = canonicalizeType(args.type);
      notifications = notifications.filter(
        (notification: any) => canonicalizeType(String(notification.type || "")) === canonicalType
      );
    }
    if (args.status) {
      notifications = notifications.filter((notification: any) => notification.status === args.status);
    }

    return notifications
      .filter(isNotificationActive)
      .map(serializeNotification)
      .slice(0, args.limit || DEFAULT_LIMIT);
  },
});

export const checkPendingFriendRequest = query({
  args: {
    fromUid: v.id("users"),
    toUid: v.id("users"),
  },
  handler: async (ctx, args) => {
    const actor = await requireCurrentUser(ctx);
    if (String(args.fromUid) !== String(actor.user._id)) throw new Error("Not authorized");
    const dedupeKey = `social.friend_request:${args.fromUid}:${args.toUid}`;
    const existing = await findActiveNotificationByDedupeKey(ctx, dedupeKey);
    if (existing && existing.status === "pending") {
      return { exists: true, notificationId: existing._id };
    }
    return { exists: false, notificationId: null };
  },
});

export const listMatchroomRequests = query({
  args: {
    matchroomId: v.id("matchrooms"),
    type: v.optional(v.string()),
    status: v.optional(notificationStatus),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireActorCanReadMatchroomNotifications(ctx, args.matchroomId);
    const limit = args.limit || DEFAULT_LIMIT;
    const canonicalType = canonicalizeType(args.type || "match.join_request");
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_matchroomId", (q: any) => q.eq("matchroomId", args.matchroomId))
      .order("desc")
      .take(limit * 3);

    return notifications
      .filter((notification: any) => canonicalizeType(String(notification.type || "")) === canonicalType)
      .filter((notification: any) => !args.status || notification.status === args.status)
      .filter(isNotificationActive)
      .map(serializeNotification)
      .slice(0, limit);
  },
});

export const listMatchroomJoinRequests = query({
  args: {
    matchroomId: v.id("matchrooms"),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireActorCanReadMatchroomNotifications(ctx, args.matchroomId);
    const room = await ctx.db.get(args.matchroomId);
    const joinedUids = new Set(
      ((room as any)?.playerUids || []).map((uid: unknown) => String(uid)),
    );
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_matchroomId", (q: any) => q.eq("matchroomId", args.matchroomId))
      .order("desc")
      .take(DEFAULT_LIMIT * 3);

    return collapsePendingMatchJoinDuplicates(notifications)
      .filter((notification: any) => canonicalizeType(String(notification.type || "")) === "match.join_request")
      .filter((notification: any) => !args.status || notification.status === args.status)
      .filter((notification: any) => {
        const data = notification.data as any;
        const requesterUid = String(
          notification.fromUid || data?.requesterUid || "",
        );
        return !requesterUid || !joinedUids.has(requesterUid);
      })
      .filter(isNotificationActive)
      .map(serializeNotification)
      .slice(0, DEFAULT_LIMIT);
  },
});

export const listTeamJoinRequests = query({
  args: {
    captainUid: v.id("users"),
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const actor = await requireCurrentUser(ctx);
    if (String(args.captainUid) !== String(actor.user._id)) throw new Error("Not authorized");
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_toUid_status_createdAt", (q: any) =>
        q.eq("toUid", args.captainUid).eq("status", "pending")
      )
      .order("desc")
      .collect();

    return notifications
      .filter(
        (notification: any) =>
          canonicalizeType(String(notification.type || "")) === "team.join_request"
          && String(notification.teamId || "") === String(args.teamId)
          && isNotificationActive(notification)
      )
      .map(serializeNotification);
  },
});

export const checkPendingTeamJoinRequest = query({
  args: { entityKey: v.string() },
  handler: async (ctx, args) => {
    const existing = await findActiveNotificationByDedupeKey(ctx, args.entityKey);
    return existing !== null && existing.status === "pending";
  },
});

export const createCanonical = mutation({
  args: {
    toUid: v.id("users"),
    fromUid: v.optional(v.id("users")),
    fromUsername: v.optional(v.string()),
    type: v.string(),
    status: v.optional(notificationStatus),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    route: v.optional(v.string()),
    recipientRole: v.optional(recipientRoleValidator),
    dedupeKey: v.optional(v.string()),
    dedupePolicy: v.optional(dedupePolicyValidator),
    pushPolicy: v.optional(pushPolicyValidator),
    entity: v.optional(v.any()),
    entityKey: v.optional(v.string()),
    entityId: v.optional(v.string()),
    teamId: v.optional(v.id("teams")),
    teamName: v.optional(v.string()),
    matchroomId: v.optional(v.id("matchrooms")),
    data: v.optional(v.any()),
    expiresAt: v.optional(v.number()),
    isRead: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requireCurrentUser(ctx);
    if (args.fromUid && String(args.fromUid) !== String(actor.user._id)) throw new Error("Not authorized");
    return createCanonicalInternal(ctx, { ...args, fromUid: args.fromUid || actor.user._id });
  },
});

// Internal version for server-to-server calls (skips auth gate since caller already authenticated)
export const createCanonicalFromServer = internalMutation({
  args: {
    toUid: v.id("users"),
    fromUid: v.optional(v.id("users")),
    fromUsername: v.optional(v.string()),
    type: v.string(),
    status: v.optional(notificationStatus),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    route: v.optional(v.string()),
    recipientRole: v.optional(recipientRoleValidator),
    dedupeKey: v.optional(v.string()),
    dedupePolicy: v.optional(dedupePolicyValidator),
    pushPolicy: v.optional(pushPolicyValidator),
    entity: v.optional(v.any()),
    entityKey: v.optional(v.string()),
    entityId: v.optional(v.string()),
    teamId: v.optional(v.id("teams")),
    teamName: v.optional(v.string()),
    matchroomId: v.optional(v.id("matchrooms")),
    data: v.optional(v.any()),
    expiresAt: v.optional(v.number()),
    isRead: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => createCanonicalInternal(ctx, args, true),
});

export const create = mutation({
  args: {
    toUid: v.id("users"),
    fromUid: v.optional(v.id("users")),
    fromUsername: v.optional(v.string()),
    type: v.string(),
    entityKey: v.optional(v.string()),
    entityId: v.optional(v.string()),
    teamId: v.optional(v.id("teams")),
    teamName: v.optional(v.string()),
    matchroomId: v.optional(v.id("matchrooms")),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    data: v.optional(v.any()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actor = await requireCurrentUser(ctx);
    if (args.fromUid && String(args.fromUid) !== String(actor.user._id)) throw new Error("Not authorized");
    const result = await createCanonicalInternal(ctx, {
      ...args,
      fromUid: args.fromUid || actor.user._id,
      dedupeKey: args.entityKey,
    });
    return result.notificationId;
  },
});

export const updateStatus = mutation({
  args: {
    notificationId: v.id("notifications"),
    status: notificationStatus,
  },
  handler: async (ctx, args) => {
    await requireNotificationOwner(ctx, args.notificationId);
    const now = Date.now();
    await ctx.db.patch(args.notificationId, {
      status: args.status,
      isRead: true,
      readAt: now,
      updatedAt: now,
    });
    return true;
  },
});

export const markAsRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    await requireNotificationOwner(ctx, args.notificationId);
    const now = Date.now();
    await ctx.db.patch(args.notificationId, {
      isRead: true,
      readAt: now,
      updatedAt: now,
    });
    return true;
  },
});

export const markManyAsRead = mutation({
  args: { notificationIds: v.array(v.id("notifications")) },
  handler: async (ctx, args) => {
    const now = Date.now();
    let updated = 0;
    for (const notificationId of args.notificationIds) {
      const notification = await ctx.db.get(notificationId);
      const actor = await requireCurrentUser(ctx);
      if (!notification || notification.isRead === true || String(notification.toUid) !== String(actor.user._id)) continue;
      await ctx.db.patch(notificationId, {
        isRead: true,
        readAt: now,
        updatedAt: now,
      });
      updated += 1;
    }
    return updated;
  },
});

export const markAllAsReadFast = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const actor = await requireCurrentUser(ctx);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_toUid_isRead_createdAt", (q: any) =>
        q.eq("toUid", actor.user._id).eq("isRead", false)
      )
      .collect();
    const now = Date.now();
    let updated = 0;
    for (const notification of notifications) {
      if (!isNotificationActive(notification)) continue;
      await ctx.db.patch(notification._id, {
        isRead: true,
        readAt: now,
        updatedAt: now,
      });
      updated += 1;
    }
    return updated;
  },
});

export const markAllAsRead = markAllAsReadFast;

export const archive = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    await requireNotificationOwner(ctx, args.notificationId);
    return archiveNotificationById(ctx, args.notificationId, Date.now());
  },
});

export const archiveMany = mutation({
  args: { notificationIds: v.array(v.id("notifications")) },
  handler: async (ctx, args) => {
    const now = Date.now();
    let archived = 0;
    for (const notificationId of args.notificationIds) {
      await requireNotificationOwner(ctx, notificationId);
      if (await archiveNotificationById(ctx, notificationId, now)) {
        archived += 1;
      }
    }
    return archived;
  },
});

export const remove = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    await requireNotificationOwner(ctx, args.notificationId);
    await ctx.db.delete(args.notificationId);
    return true;
  },
});

export const removeMany = mutation({
  args: { notificationIds: v.array(v.id("notifications")) },
  handler: async (ctx, args) => {
    let removed = 0;
    for (const notificationId of args.notificationIds) {
      const notification = await ctx.db.get(notificationId);
      const actor = await requireCurrentUser(ctx);
      if (!notification || String(notification.toUid) !== String(actor.user._id)) continue;
      await ctx.db.delete(notificationId);
      removed += 1;
    }
    return removed;
  },
});

export const removeAllForUserFast = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const actor = await requireCurrentUser(ctx);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_toUid", (q: any) => q.eq("toUid", actor.user._id))
      .collect();
    const now = Date.now();
    let archived = 0;
    for (const notification of notifications) {
      if (await archiveNotificationById(ctx, notification._id, now)) {
        archived += 1;
      }
    }
    return archived;
  },
});

export const removeAllForUser = removeAllForUserFast;

export const markPushState = internalMutation({
  args: {
    notificationId: v.id("notifications"),
    state: pushStateValidator,
    attemptedAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.notificationId);
    if (!existing) return false;
    await ctx.db.patch(args.notificationId, {
      pushState: args.state,
      pushAttemptedAt: args.attemptedAt,
      pushDeliveredAt: args.deliveredAt,
      pushError: args.error,
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const claimPushSend = internalMutation({
  args: {
    notificationId: v.id("notifications"),
    attemptedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.notificationId);
    if (!existing) return { ok: false, reason: "notification_not_found" };

    const state = String(existing.pushState || "queued");
    if (state === "sending") {
      const attemptedAt = Number(existing.pushAttemptedAt || 0);
      if (attemptedAt && args.attemptedAt - attemptedAt < PUSH_SEND_STALE_MS) {
        return { ok: false, reason: "already_sending" };
      }
    }
    if (["sent", "receipt_ok", "skipped", "no_device"].includes(state)) {
      return { ok: false, reason: "already_processed" };
    }

    await ctx.db.patch(args.notificationId, {
      pushState: "sending",
      pushAttemptedAt: args.attemptedAt,
      pushError: undefined,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const refreshPushStateFromTickets = internalMutation({
  args: {
    notificationId: v.id("notifications"),
    checkedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) return false;

    const tickets = await ctx.db
      .query("pushTickets")
      .withIndex("by_notificationId", (q) => q.eq("notificationId", args.notificationId))
      .take(100);

    if (!tickets.length) return false;

    const hasPendingReceipt = tickets.some(
      (ticket) => ticket.ticketStatus === "ok" && !ticket.receiptCheckedAt
    );
    if (hasPendingReceipt) return false;

    const hasOkReceipt = tickets.some((ticket) => ticket.receiptStatus === "ok");
    const hasTicketOkWithoutReceipt = tickets.some(
      (ticket) => ticket.ticketStatus === "ok" && !ticket.receiptStatus
    );

    await ctx.db.patch(args.notificationId, {
      pushState: hasOkReceipt || hasTicketOkWithoutReceipt ? "receipt_ok" : "failed",
      pushDeliveredAt: hasOkReceipt ? args.checkedAt : notification.pushDeliveredAt,
      pushError: hasOkReceipt || hasTicketOkWithoutReceipt ? undefined : "expo_push_receipts_failed",
      updatedAt: Date.now(),
    });
    return true;
  },
});
