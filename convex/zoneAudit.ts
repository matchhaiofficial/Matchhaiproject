import { query } from "./_generated/server";
import { v } from "convex/values";

async function resolveUserByAnyId(ctx: any, value?: string | null) {
  if (!value) return null;

  try {
    const directUser = await ctx.db.get(value);
    if (directUser) return directUser;
  } catch {
    // Ignore invalid direct ids and fall back to authId.
  }

  return await ctx.db
    .query("users")
    .withIndex("by_authId", (q: any) => q.eq("authId", value))
    .unique();
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

export async function recordZoneAuditEvent(
  ctx: any,
  input: {
    zoneId: string;
    module: "bookings" | "resources" | "pricing" | "migration";
    action: string;
    actorUid?: string | null;
    targetType: string;
    targetId?: string | null;
    summary: string;
    details?: Record<string, any> | null;
    createdAt?: number;
  },
) {
  const actor = await resolveUserByAnyId(ctx, input.actorUid);
  const actorLabel = actor
    ? actor.username || actor.fullName || actor.email || normalizeText(input.actorUid)
    : normalizeText(input.actorUid) || undefined;

  await ctx.db.insert("zoneAuditEvents", {
    zoneId: normalizeText(input.zoneId),
    module: input.module,
    action: normalizeText(input.action),
    actorUid: actor ? String(actor._id) : normalizeText(input.actorUid) || undefined,
    actorLabel,
    targetType: normalizeText(input.targetType),
    targetId: normalizeText(input.targetId) || undefined,
    summary: normalizeText(input.summary),
    details: input.details || undefined,
    createdAt: Number(input.createdAt || Date.now()),
  });
}

export const listZoneAuditEvents = query({
  args: {
    zoneId: v.string(),
    module: v.optional(v.string()),
    action: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit || 150, 1), 300);

    let rows: any[] = [];
    if (args.module) {
      rows = await ctx.db
        .query("zoneAuditEvents")
        .withIndex("by_zoneId_module_createdAt", (q) =>
          q.eq("zoneId", args.zoneId).eq("module", args.module!),
        )
        .order("desc")
        .take(limit);
    } else if (args.action) {
      rows = await ctx.db
        .query("zoneAuditEvents")
        .withIndex("by_zoneId_action_createdAt", (q) =>
          q.eq("zoneId", args.zoneId).eq("action", args.action!),
        )
        .order("desc")
        .take(limit);
    } else {
      rows = await ctx.db
        .query("zoneAuditEvents")
        .withIndex("by_zoneId_createdAt", (q) => q.eq("zoneId", args.zoneId))
        .order("desc")
        .take(limit);
    }

    return rows.map((row) => ({
      id: String(row._id),
      zoneId: String(row.zoneId),
      module: row.module,
      action: row.action,
      actorUid: row.actorUid || undefined,
      actorLabel: row.actorLabel || undefined,
      targetType: row.targetType,
      targetId: row.targetId || undefined,
      summary: row.summary,
      details: row.details || undefined,
      createdAt: row.createdAt,
    }));
  },
});
