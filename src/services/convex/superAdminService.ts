import { convex } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { authClient } from "../../lib/auth-client";
import { Zone } from "./zoneService";

export type SuperAdminSummary = {
  counts: {
    users: number;
    zones: number;
    reports: number;
    matchrooms: number;
    teams: number;
  };
  users: {
    active30d: number;
    activeSource?: string;
    players: number;
    zoneAdmins: number;
    superAdmins: number;
  };
  zones: {
    pending: number;
    pendingMigration: number;
    active: number;
    rejected: number;
    suspended: number;
  };
  reports: {
    pending: number;
    reviewed: number;
    resolved: number;
  };
  matchrooms: {
    open: number;
    inProgress: number;
    completed: number;
  };
  revenue?: {
    total: number;
    currency: string;
  };
};

export type SuperAdminUser = {
  id: string;
  _id: string;
  fullName: string;
  username: string;
  email: string;
  phone?: string;
  accountType: "player" | "zone";
  role?: string;
  createdAt: number;
  updatedAt: number;
};

export type SuperAdminReport = {
  id: string;
  _id: string;
  type: "matchroom_complaint" | "user_report" | "zone_complaint";
  status: "pending" | "reviewed" | "resolved";
  reason: string;
  description?: string;
  game?: string;
  createdAt: number;
  updatedAt: number;
  reporterName: string;
  reportedUserName?: string | null;
  zoneName?: string | null;
  branchId?: string | null;
  branchLabel?: string | null;
  matchroomId?: string | null;
  matchroomTitle?: string | null;
  reviewedByUid?: string | null;
  reviewedAt?: number | null;
  reviewedByName?: string | null;
  reviewerNote?: string | null;
  resolvedByUid?: string | null;
  resolvedAt?: number | null;
  resolvedByName?: string | null;
  resolutionSummary?: string | null;
};

export type SuperAdminSupportTicketStatus = "open" | "in_review" | "resolved";

export type SuperAdminSupportTicket = {
  id: string;
  _id: string;
  reference: string;
  userRole?: string;
  category?: string;
  subcategory?: string;
  intent?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  issueSummary: string;
  suggestedAdminAction?: string;
  relatedMatchroomId?: string;
  relatedPaymentId?: string;
  relatedBookingId?: string;
  relatedTeamId?: string;
  relatedZoneId?: string;
  conversationId?: string;
  assignedAdminId?: string;
  assignedAdminName?: string;
  lastAdminResponseAt?: number;
  lastUserResponseAt?: number;
  resolutionSummary?: string;
  internalTags?: string[];
  status: SuperAdminSupportTicketStatus;
  source: "help_support_chat" | "help_support_ai_agent";
  createdAt: number;
  updatedAt: number;
  userDisplayName?: string;
  userEmail?: string;
  excerptPreview?: string;
  conversationExcerpt?: Array<{
    role: "user" | "assistant";
    text: string;
  }>;
  metadataSummary?: {
    knownNonSensitiveDetails?: Record<string, unknown>;
    emailStatus?: string;
    aiSummary?: string;
    user?: Record<string, unknown>;
    zones?: Array<Record<string, unknown>>;
    recentPayments?: Array<Record<string, unknown>>;
    recentMatchrooms?: Array<Record<string, unknown>>;
    recentReports?: Array<Record<string, unknown>>;
  };
  internalNotes?: Array<{
    id: string;
    author: "agent" | "admin" | "system";
    adminId?: string;
    text: string;
    createdAt: number;
  }>;
  conversationMessages?: Array<{
    id: string;
    role: "user" | "assistant" | "system" | "admin";
    text: string;
    createdAt: number;
    metadata?: Record<string, unknown>;
  }>;
};

export type EasypaisaAdminTransaction = {
  id: string;
  _id: string;
  kind: "booking_intent" | "wallet_topup";
  amount: number;
  currency: string;
  orderRefNum: string;
  status: string;
  accountOwnerName?: string;
  providerStatus?: string | null;
  providerDescription?: string | null;
  providerReference?: string | null;
  processedAt?: number | null;
  lastError?: string | null;
  callbackCount: number;
  createdAt: number;
  updatedAt: number;
  providerPayload: {
    rest?: any;
    ipn?: any;
    hosted?: any;
    lastProviderStatus?: string | null;
    lastSyncAt?: number | null;
    flow?: string | null;
  };
};

export type SuperAdminMatchroomLifecycle =
  | "created_open"
  | "waiting_lobby_fill"
  | "waiting_zone_approval"
  | "confirmed"
  | "in-progress"
  | "completed"
  | "cancelled_expired";

export type SuperAdminMatchroom = {
  id: string;
  _id: string;
  title: string;
  game: string;
  location: string;
  status: string;
  lifecycleStatus: SuperAdminMatchroomLifecycle;
  paymentStatus?: string | null;
  zoneAdminApproved?: boolean | null;
  broadcastRequestStatus?: string | null;
  resultVerificationStatus?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  scheduledStartAt?: number | null;
  currentPlayers?: number;
  maxPlayers?: number;
  hostName?: string;
  hostUserName?: string | null;
  matchCode?: string | null;
  description?: string | null;
  zoneName?: string | null;
  players?: any[];
  slotsA?: any[];
  slotsB?: any[];
  pricing?: any;
  createdAt: number;
  updatedAt: number;
};

export type SuperAdminIdentityVerification = {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string | null;
  role: string;
  provider: "didit";
  workflowId: string;
  status: string;
  submittedAt: number;
  verifiedAt?: number | null;
  rejectedAt?: number | null;
  rejectionReason?: string | null;
  emailVerificationStatus?: string | null;
  idVerificationStatus?: string | null;
  livenessStatus?: string | null;
  faceMatchStatus?: string | null;
  amlStatus?: string | null;
  ipAnalysisStatus?: string | null;
};

export type SuperAdminAuditLog = {
  id: string;
  superAdminUserId?: string | null;
  superAdminAuthId?: string | null;
  superAdminName: string;
  superAdminEmail: string;
  action: string;
  module: string;
  targetType?: string | null;
  targetId?: string | null;
  status: "success" | "failed" | "denied";
  reason?: string | null;
  metadataSafe?: Record<string, unknown> | null;
  createdAt: number;
};

type Result<T> = { ok: true; data: T } | { ok: false; message: string };
type BasicResult = { ok: true } | { ok: false; message: string };

type CacheEntry<T> = {
  expiresAt: number;
  data: T;
};

const SUPER_ADMIN_CACHE_TTL_MS = 20 * 1000;
const superAdminCache = new Map<string, CacheEntry<unknown>>();

async function getRequiredSessionToken() {
  const { data } = await authClient.getSession();
  const token = data?.session?.token;
  if (!token) {
    throw new Error("Not signed in");
  }
  return token;
}

function readCache<T>(key: string): T | null {
  const entry = superAdminCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    superAdminCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function writeCache<T>(key: string, data: T) {
  superAdminCache.set(key, {
    expiresAt: Date.now() + SUPER_ADMIN_CACHE_TTL_MS,
    data,
  });
}

function clearSuperAdminCache() {
  superAdminCache.clear();
}

async function recordSuperAdminAuditSafe(input: {
  action: string;
  module: string;
  targetType?: string;
  targetId?: string;
  status?: "success" | "failed" | "denied";
  reason?: string;
  metadataSafe?: Record<string, unknown>;
}) {
  try {
    const sessionToken = await getRequiredSessionToken();
    await convex.mutation(api.admin.recordSuperAdminAudit, {
      sessionToken,
      action: input.action,
      module: input.module,
      targetType: input.targetType,
      targetId: input.targetId,
      status: input.status || "success",
      reason: input.reason,
      metadataSafe: input.metadataSafe,
    });
  } catch {
    // Audit failures must not break admin read flows.
  }
}

export async function recordSuperAdminRouteAccess(route = "/super-admin"): Promise<void> {
  await recordSuperAdminAuditSafe({
    action: "super_admin_route_access",
    module: "super_admin",
    status: "success",
    metadataSafe: { route },
  });
}

export async function recordSuperAdminAccessDenied(route = "/super-admin", reason = "not_authorized"): Promise<void> {
  await recordSuperAdminAuditSafe({
    action: "super_admin_access_denied",
    module: "super_admin",
    status: "denied",
    reason,
    metadataSafe: { route },
  });
}

async function getCachedOrLoad<T>(key: string, loader: () => Promise<T>) {
  const cached = readCache<T>(key);
  if (cached) {
    return cached;
  }
  const data = await loader();
  writeCache(key, data);
  return data;
}

function mapZone(doc: any): Zone {
  return {
    id: doc.id || doc._id,
    ...doc,
    ownerFullName: doc.ownerFullName || doc.ownerUsername,
    venueBrandName: doc.venueBrandName || doc.name,
    contactPhone: doc.contactPhone || doc.phone,
  } as Zone;
}

export async function getDashboardSummary(): Promise<Result<SuperAdminSummary>> {
  try {
    const sessionToken = await getRequiredSessionToken();
    const summary = await getCachedOrLoad(
      `summary:${sessionToken}`,
      () => convex.query(api.admin.getDashboardSummary, { sessionToken })
    );
    await recordSuperAdminAuditSafe({ action: "super_admin_route_access", module: "super_admin", metadataSafe: { screen: "dashboard" } });
    return { ok: true, data: summary };
  } catch (error: any) {
    console.error("[superAdminService] getDashboardSummary error", error);
    return { ok: false, message: "Failed to load dashboard summary." };
  }
}

export async function getZones(
  status?: "pending-review" | "approved_pending_migration" | "active" | "rejected" | "suspended"
): Promise<Result<Zone[]>> {
  try {
    const sessionToken = await getRequiredSessionToken();
    const zones = await getCachedOrLoad(
      `zones:${sessionToken}:${status || "all"}`,
      () =>
        convex.query(api.admin.listZones, {
          sessionToken,
          status,
          limit: 100,
        })
    );
    await recordSuperAdminAuditSafe({ action: "view_zone", module: "zones", metadataSafe: { status: status || "all", count: zones.length } });
    return { ok: true, data: zones.map(mapZone) };
  } catch (error: any) {
    console.error("[superAdminService] getZones error", error);
    return { ok: false, message: "Failed to load zones." };
  }
}

export async function getPendingZones(): Promise<Result<Zone[]>> {
  return getZones("pending-review");
}

export async function getUsers(
  accountType?: "player" | "zone"
): Promise<Result<SuperAdminUser[]>> {
  try {
    const sessionToken = await getRequiredSessionToken();
    const users = await getCachedOrLoad(
      `users:${sessionToken}:${accountType || "all"}`,
      () =>
        convex.query(api.admin.listUsers, {
          sessionToken,
          accountType,
          limit: 150,
        })
    );
    await recordSuperAdminAuditSafe({ action: "view_user", module: "users", metadataSafe: { accountType: accountType || "all", count: users.length } });
    return { ok: true, data: users as SuperAdminUser[] };
  } catch (error: any) {
    console.error("[superAdminService] getUsers error", error);
    return { ok: false, message: "Failed to load users." };
  }
}

export async function getIdentityVerifications(input?: {
  status?: string;
  role?: string;
}): Promise<Result<SuperAdminIdentityVerification[]>> {
  try {
    const sessionToken = await getRequiredSessionToken();
    const rows = await getCachedOrLoad(
      `identityVerifications:${sessionToken}:${input?.status || "all"}:${input?.role || "all"}`,
      () =>
        convex.query(api.admin.listIdentityVerifications, {
          sessionToken,
          status: input?.status,
          role: input?.role,
          limit: 150,
        }),
    );
    await recordSuperAdminAuditSafe({
      action: "view_identity_verifications",
      module: "identity",
      metadataSafe: { status: input?.status || "all", role: input?.role || "all", count: rows.length },
    });
    return { ok: true, data: rows as SuperAdminIdentityVerification[] };
  } catch (error: any) {
    console.error("[superAdminService] getIdentityVerifications error", error);
    return { ok: false, message: "Failed to load identity verifications." };
  }
}

export async function getSuperAdminAuditLogs(input?: {
  superAdminEmail?: string;
  action?: string;
  module?: string;
  status?: "success" | "failed" | "denied";
  targetId?: string;
  from?: number;
  to?: number;
}): Promise<Result<SuperAdminAuditLog[]>> {
  try {
    const sessionToken = await getRequiredSessionToken();
    const rows = await convex.query(api.admin.listSuperAdminAuditLogs, {
      sessionToken,
      superAdminEmail: input?.superAdminEmail || undefined,
      action: input?.action || undefined,
      module: input?.module || undefined,
      status: input?.status,
      targetId: input?.targetId || undefined,
      from: input?.from,
      to: input?.to,
      limit: 150,
    });
    await recordSuperAdminAuditSafe({
      action: "view_super_admin_audit_logs",
      module: "super_admin",
      metadataSafe: {
        filtered: Boolean(input?.superAdminEmail || input?.action || input?.module || input?.status || input?.targetId),
        count: rows.length,
      },
    });
    return { ok: true, data: rows as SuperAdminAuditLog[] };
  } catch (error: any) {
    console.error("[superAdminService] getSuperAdminAuditLogs error", error);
    return { ok: false, message: "Failed to load audit logs." };
  }
}

export async function getReports(
  status?: "pending" | "reviewed" | "resolved"
): Promise<Result<SuperAdminReport[]>> {
  try {
    const sessionToken = await getRequiredSessionToken();
    const reports = await getCachedOrLoad(
      `reports:${sessionToken}:${status || "all"}`,
      () =>
        convex.query(api.admin.listReports, {
          sessionToken,
          status,
          limit: 100,
        })
    );
    await recordSuperAdminAuditSafe({ action: "view_reports", module: "reports", metadataSafe: { status: status || "all", count: reports.length } });
    return { ok: true, data: reports as SuperAdminReport[] };
  } catch (error: any) {
    console.error("[superAdminService] getReports error", error);
    return { ok: false, message: "Failed to load reports." };
  }
}

export async function getSupportTickets(
  status?: SuperAdminSupportTicketStatus
): Promise<Result<SuperAdminSupportTicket[]>> {
  try {
    const sessionToken = await getRequiredSessionToken();
    const tickets = await getCachedOrLoad(
      `supportTickets:${sessionToken}:${status || "all"}`,
      () =>
        convex.query(api.admin.listSupportTickets, {
          sessionToken,
          status,
          limit: 100,
        })
    );
    await recordSuperAdminAuditSafe({ action: "view_support_tickets", module: "support", metadataSafe: { status: status || "all", count: tickets.length } });
    return { ok: true, data: tickets as SuperAdminSupportTicket[] };
  } catch (error: any) {
    console.error("[superAdminService] getSupportTickets error", error);
    return { ok: false, message: "Failed to load support tickets." };
  }
}

export async function getSupportTicketById(ticketId: string): Promise<Result<SuperAdminSupportTicket | null>> {
  try {
    const sessionToken = await getRequiredSessionToken();
    const ticket = await convex.query(api.admin.getSupportTicketById, {
      sessionToken,
      ticketId: ticketId as Id<"supportTickets">,
    });
    await recordSuperAdminAuditSafe({
      action: "view_support_ticket_detail",
      module: "support",
      targetType: "supportTicket",
      targetId: ticketId,
      metadataSafe: { found: Boolean(ticket) },
    });
    return { ok: true, data: ticket as SuperAdminSupportTicket | null };
  } catch (error: any) {
    console.error("[superAdminService] getSupportTicketById error", error);
    return { ok: false, message: "Failed to load support ticket." };
  }
}

export async function updateSupportTicketStatus(
  ticketId: string,
  status: SuperAdminSupportTicketStatus
): Promise<BasicResult> {
  try {
    const sessionToken = await getRequiredSessionToken();
    await convex.mutation(api.admin.updateSupportTicketStatus, {
      sessionToken,
      ticketId: ticketId as Id<"supportTickets">,
      status,
    });
    clearSuperAdminCache();
    return { ok: true };
  } catch (error: any) {
    console.error("[superAdminService] updateSupportTicketStatus error", error);
    return { ok: false, message: "Failed to update support ticket status." };
  }
}

export async function addSupportTicketInternalNote(ticketId: string, note: string): Promise<BasicResult> {
  try {
    const sessionToken = await getRequiredSessionToken();
    await convex.mutation(api.admin.addSupportTicketInternalNote, {
      sessionToken,
      ticketId: ticketId as Id<"supportTickets">,
      note,
    });
    clearSuperAdminCache();
    return { ok: true };
  } catch (error: any) {
    console.error("[superAdminService] addSupportTicketInternalNote error", error);
    return { ok: false, message: error?.message || "Failed to add internal note." };
  }
}

export async function replyToSupportTicketUser(ticketId: string, message: string): Promise<BasicResult> {
  try {
    const sessionToken = await getRequiredSessionToken();
    await convex.mutation(api.admin.replyToSupportTicketUser, {
      sessionToken,
      ticketId: ticketId as Id<"supportTickets">,
      message,
    });
    clearSuperAdminCache();
    return { ok: true };
  } catch (error: any) {
    console.error("[superAdminService] replyToSupportTicketUser error", error);
    return { ok: false, message: error?.message || "Failed to send support reply." };
  }
}

export async function assignSupportTicket(ticketId: string): Promise<BasicResult> {
  try {
    const sessionToken = await getRequiredSessionToken();
    await convex.mutation(api.admin.assignSupportTicket, {
      sessionToken,
      ticketId: ticketId as Id<"supportTickets">,
    });
    clearSuperAdminCache();
    return { ok: true };
  } catch (error: any) {
    console.error("[superAdminService] assignSupportTicket error", error);
    return { ok: false, message: error?.message || "Failed to assign support ticket." };
  }
}

export async function resolveSupportTicket(ticketId: string, resolutionSummary: string): Promise<BasicResult> {
  try {
    const sessionToken = await getRequiredSessionToken();
    await convex.mutation(api.admin.resolveSupportTicket, {
      sessionToken,
      ticketId: ticketId as Id<"supportTickets">,
      resolutionSummary,
    });
    clearSuperAdminCache();
    return { ok: true };
  } catch (error: any) {
    console.error("[superAdminService] resolveSupportTicket error", error);
    return { ok: false, message: error?.message || "Failed to resolve support ticket." };
  }
}

export async function getEasypaisaTransactions(
  orderRefNum?: string
): Promise<Result<EasypaisaAdminTransaction[]>> {
  try {
    const sessionToken = await getRequiredSessionToken();
    const transactions = await convex.query(api.admin.listEasypaisaTransactions, {
      sessionToken,
      orderRefNum,
      limit: 20,
    });
    await recordSuperAdminAuditSafe({
      action: "view_payment_transaction",
      module: "payments",
      metadataSafe: { orderRefNum: orderRefNum ? "filtered" : "all", count: transactions.length },
    });
    return { ok: true, data: transactions as EasypaisaAdminTransaction[] };
  } catch (error: any) {
    console.error("[superAdminService] getEasypaisaTransactions error", error);
    return { ok: false, message: "Failed to load Easypaisa transactions." };
  }
}

export async function getSuperAdminMatchrooms(): Promise<Result<SuperAdminMatchroom[]>> {
  try {
    const sessionToken = await getRequiredSessionToken();
    const rooms = await convex.query(api.admin.listSuperAdminMatchrooms, {
      sessionToken,
      limit: 150,
    });
    await recordSuperAdminAuditSafe({ action: "view_matchrooms", module: "matchrooms", metadataSafe: { count: rooms.length } });
    return { ok: true, data: rooms as SuperAdminMatchroom[] };
  } catch (error: any) {
    console.error("[superAdminService] getSuperAdminMatchrooms error", error);
    return { ok: false, message: "Failed to load matchrooms." };
  }
}

export async function getSuperAdminMatchroomById(matchroomId: string): Promise<Result<SuperAdminMatchroom | null>> {
  try {
    const sessionToken = await getRequiredSessionToken();
    const room = await convex.query(api.admin.getSuperAdminMatchroomById, {
      sessionToken,
      matchroomId: matchroomId as Id<"matchrooms">,
    });
    await recordSuperAdminAuditSafe({
      action: "view_matchroom",
      module: "matchrooms",
      targetType: "matchroom",
      targetId: matchroomId,
      metadataSafe: { found: Boolean(room) },
    });
    return { ok: true, data: room as SuperAdminMatchroom | null };
  } catch (error: any) {
    console.error("[superAdminService] getSuperAdminMatchroomById error", error);
    return { ok: false, message: "Failed to load matchroom." };
  }
}

export async function getReportById(reportId: string): Promise<Result<SuperAdminReport | null>> {
  try {
    const sessionToken = await getRequiredSessionToken();
    const report = await convex.query(api.admin.getReportById, {
      sessionToken,
      reportId: reportId as Id<"reports">,
    });
    await recordSuperAdminAuditSafe({
      action: "view_report",
      module: "reports",
      targetType: "report",
      targetId: reportId,
      metadataSafe: { found: Boolean(report) },
    });
    return { ok: true, data: report as SuperAdminReport | null };
  } catch (error: any) {
    console.error("[superAdminService] getReportById error", error);
    return { ok: false, message: "Failed to load report." };
  }
}

export async function setZoneStatus(
  zoneId: string,
  status: "pending-review" | "approved_pending_migration" | "active" | "rejected" | "suspended",
  rejectionReason?: string
): Promise<BasicResult> {
  try {
    const sessionToken = await getRequiredSessionToken();
    await convex.mutation(api.admin.setZoneStatus, {
      sessionToken,
      zoneId: zoneId as Id<"zones">,
      status,
      rejectionReason,
    });
    clearSuperAdminCache();
    return { ok: true };
  } catch (error: any) {
    console.error("[superAdminService] setZoneStatus error", error);
    return { ok: false, message: error?.message || "Failed to update zone status." };
  }
}

export async function approveZone(zoneId: string): Promise<BasicResult> {
  return setZoneStatus(zoneId, "active");
}

export async function rejectZone(zoneId: string, reason: string): Promise<BasicResult> {
  return setZoneStatus(zoneId, "rejected", reason);
}

export async function suspendZone(zoneId: string): Promise<BasicResult> {
  return setZoneStatus(zoneId, "suspended");
}

export async function reactivateZone(zoneId: string): Promise<BasicResult> {
  return setZoneStatus(zoneId, "active");
}

export async function retryZoneMigration(zoneId: string): Promise<BasicResult> {
  try {
    const sessionToken = await getRequiredSessionToken();
    await convex.mutation(api.admin.retryZoneMigration, {
      sessionToken,
      zoneId: zoneId as Id<"zones">,
    });
    clearSuperAdminCache();
    return { ok: true };
  } catch (error: any) {
    console.error("[superAdminService] retryZoneMigration error", error);
    return { ok: false, message: error?.message || "Failed to retry zone migration." };
  }
}

export async function updateReportStatus(
  reportId: string,
  status: "pending" | "reviewed" | "resolved",
  options?: {
    reviewerNote?: string;
    resolutionSummary?: string;
  }
): Promise<BasicResult> {
  try {
    const sessionToken = await getRequiredSessionToken();
    await convex.mutation(api.admin.setReportStatus, {
      sessionToken,
      reportId: reportId as Id<"reports">,
      status,
      reviewerNote: options?.reviewerNote,
      resolutionSummary: options?.resolutionSummary,
    });
    clearSuperAdminCache();
    return { ok: true };
  } catch (error: any) {
    console.error("[superAdminService] updateReportStatus error", error);
    return { ok: false, message: "Failed to update report status." };
  }
}

export async function updateUserRole(
  userId: string,
  role?: string
): Promise<BasicResult> {
  try {
    const sessionToken = await getRequiredSessionToken();
    await convex.mutation(api.admin.setUserRole, {
      sessionToken,
      userId: userId as Id<"users">,
      role,
    });
    clearSuperAdminCache();
    return { ok: true };
  } catch (error: any) {
    console.error("[superAdminService] updateUserRole error", error);
    return { ok: false, message: "Failed to update user role." };
  }
}

export async function bootstrapInitialSuperAdmin(input: {
  password: string;
  fullName?: string;
  username?: string;
  phone?: string;
}): Promise<Result<{ created: boolean; email: string; message: string }>> {
  try {
    const result = await convex.mutation(api.admin.bootstrapInitialSuperAdmin, input);
    clearSuperAdminCache();
    return {
      ok: true,
      data: {
        created: Boolean((result as any).created),
        email: String((result as any).email),
        message: String((result as any).message),
      },
    };
  } catch (error: any) {
    console.error("[superAdminService] bootstrapInitialSuperAdmin error", error);
    return { ok: false, message: "Failed to bootstrap super admin." };
  }
}
