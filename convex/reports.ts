import { v } from "convex/values";

import { authComponent } from "./auth";
import { internal } from "./_generated/api";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

const DUPLICATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_DESCRIPTION_LENGTH = 1000;

type ReportStatus = "pending" | "reviewed" | "resolved";

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
  type: "matchroom_complaint" | "user_report" | "zone_complaint";
  reason: string;
  matchroomId?: Id<"matchrooms">;
  reportedUserId?: Id<"users">;
  zoneId?: Id<"zones">;
  branchId?: string;
  branchLabel?: string;
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
  let authUser: Awaited<ReturnType<typeof authComponent.getAuthUser>> | null = null;
  try {
    authUser = await authComponent.getAuthUser(ctx);
  } catch {
    authUser = null;
  }

  const expectedUser = await resolveUserByAnyId(ctx, expectedUid);

  if (authUser?.userId) {
    const user = await resolveUserByAnyId(ctx, authUser.userId);
    if (!user) {
      throw new Error("User profile not found");
    }

    if (expectedUser && String(expectedUser._id) !== String(user._id)) {
      throw new Error("You can only perform this action for your own account.");
    }

    return { authUser, user };
  }

  if (expectedUser) {
    return { authUser: null, user: expectedUser };
  }

  throw new Error("Not authenticated");
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
  type: "matchroom_complaint" | "user_report" | "zone_complaint";
  reason: string;
  matchroomId?: Id<"matchrooms">;
  reportedUserId?: Id<"users">;
  zoneId?: Id<"zones">;
  branchId?: string;
  branchLabel?: string;
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
  type: "matchroom_complaint" | "user_report" | "zone_complaint";
  matchroomId?: Id<"matchrooms">;
  reportedUserId?: Id<"users">;
  zoneId?: Id<"zones">;
  branchId?: string;
  branchLabel?: string;
  game?: string;
  reason: string;
  description?: string;
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
  const reportId = await ctx.db.insert("reports", {
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
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_reporterUid", (q) => q.eq("reporterUid", args.reporterUid))
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
