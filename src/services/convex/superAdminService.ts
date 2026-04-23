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

export type EasypaisaAdminTransaction = {
  id: string;
  _id: string;
  kind: "booking_intent" | "wallet_topup";
  amount: number;
  currency: string;
  orderRefNum: string;
  status: string;
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
    return { ok: true, data: users as SuperAdminUser[] };
  } catch (error: any) {
    console.error("[superAdminService] getUsers error", error);
    return { ok: false, message: "Failed to load users." };
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
    return { ok: true, data: reports as SuperAdminReport[] };
  } catch (error: any) {
    console.error("[superAdminService] getReports error", error);
    return { ok: false, message: "Failed to load reports." };
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
    return { ok: true, data: transactions as EasypaisaAdminTransaction[] };
  } catch (error: any) {
    console.error("[superAdminService] getEasypaisaTransactions error", error);
    return { ok: false, message: "Failed to load Easypaisa transactions." };
  }
}

export async function getReportById(reportId: string): Promise<Result<SuperAdminReport | null>> {
  try {
    const sessionToken = await getRequiredSessionToken();
    const report = await convex.query(api.admin.getReportById, {
      sessionToken,
      reportId: reportId as Id<"reports">,
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
