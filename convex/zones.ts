import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireUser, requireRole } from "./lib/auth";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const normalizeString = (value: unknown) => String(value || "").trim().toLowerCase();

const parseTimeMinutes = (timeHHmm: string) => {
  const match = String(timeHHmm || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hh = Number.parseInt(match[1], 10);
  const mm = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return null;
  }
  return hh * 60 + mm;
};

const toDateOnlyKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toIntOrNull = (value: string | undefined | null): number | null => {
  if (!value) return null;
  const n = Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(n) ? n : null;
};

const normalizePhone = (raw?: string | null): string | null => {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
};

const isRuleDateMatch = (rule: any, at: Date) => {
  const currentDate = toDateOnlyKey(at);
  if (rule.validFrom && currentDate < rule.validFrom) return false;
  if (rule.validTo && currentDate > rule.validTo) return false;
  return true;
};

const isRuleDayMatch = (rule: any, at: Date) => {
  if (!Array.isArray(rule.daysOfWeek) || !rule.daysOfWeek.length) return true;
  return rule.daysOfWeek.includes(at.getDay());
};

const isRuleTimeMatch = (rule: any, at: Date) => {
  const start = parseTimeMinutes(rule.timeStart || "00:00");
  const end = parseTimeMinutes(rule.timeEnd || "23:59");
  if (start == null || end == null) return false;

  const current = at.getHours() * 60 + at.getMinutes();
  if (start <= end) {
    return current >= start && current <= end;
  }
  return current >= start || current <= end;
};

const doesRuleMatchContext = (
  rule: any,
  context: { assetType: string; branchId?: string | null; tier?: string | null; surface?: string | null },
  at: Date
) => {
  if (rule.isEnabled === false) return false;
  if (normalizeString(rule.assetType) !== normalizeString(context.assetType)) return false;

  if (rule.branchId && normalizeString(rule.branchId) !== normalizeString(context.branchId)) return false;
  if (rule.tier && normalizeString(rule.tier) !== normalizeString(context.tier)) return false;
  if (rule.surface && normalizeString(rule.surface) !== normalizeString(context.surface)) return false;

  if (!isRuleDateMatch(rule, at)) return false;
  if (!isRuleDayMatch(rule, at)) return false;
  if (!isRuleTimeMatch(rule, at)) return false;

  return true;
};

const sortRules = (rules: any[]) =>
  [...rules].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (a.ruleType !== b.ruleType) {
      if (a.ruleType === "fixed_override") return -1;
      if (b.ruleType === "fixed_override") return 1;
    }
    return 0;
  });

async function assertZoneOwnerOrAdmin(ctx: any, zoneId: string) {
  const { user, role } = await requireUser(ctx);
  const zone = await ctx.db.get(zoneId as Id<"zones">);
  if (!zone) throw new ConvexError("Zone not found.");
  if (zone.ownerUid !== user.uid && role !== "superAdmin") {
    throw new ConvexError("Not authorized.");
  }
  return { user, role, zone };
}

export const registerZone = mutation({
  args: {
    step1: v.any(),
    branches: v.any(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const step1 = (args.step1 || {}) as any;
    const branches = Array.isArray(args.branches) ? args.branches : [];

    if (!step1.ownerFullName || !step1.venueBrandName || !step1.contactEmail || branches.length === 0) {
      throw new ConvexError("Missing zone details.");
    }

    const primaryBranch = branches[0];
    const normalizedPhone = normalizePhone(step1.contactPhone);

    const games = {
      supportsCs2: branches.some((b: any) => b.supportsCs2),
      supportsFc25: branches.some((b: any) => b.supportsFc25),
      supportsTekken8: branches.some((b: any) => b.supportsTekken8),
      supportsFutsal: branches.some((b: any) => b.supportsFutsal),
      supportsIndoorCricket: branches.some((b: any) => b.supportsIndoorCricket),
      supportsPadel: branches.some((b: any) => b.supportsPadel),
      supportsPickleball: branches.some((b: any) => b.supportsPickleball),
    };

    const capacity = {
      pcSeats: branches.reduce(
        (sum: number, b: any) =>
          sum +
          (toIntOrNull(b.pricing?.pc?.regular?.count) || 0) +
          (toIntOrNull(b.pricing?.pc?.premium?.count) || 0) +
          (toIntOrNull(b.pricing?.pc?.elite?.count) || 0),
        0
      ),
      consoleSeats: branches.reduce(
        (sum: number, b: any) =>
          sum +
          (toIntOrNull(b.pricing?.console?.ps5?.count) || 0) +
          (toIntOrNull(b.pricing?.console?.xbox?.count) || 0),
        0
      ),
      consolePlatform:
        branches.some((b: any) => b.pricing?.console?.ps5) &&
        branches.some((b: any) => b.pricing?.console?.xbox)
          ? "mixed"
          : branches.some((b: any) => b.pricing?.console?.ps5)
            ? "ps5"
            : branches.some((b: any) => b.pricing?.console?.xbox)
              ? "xbox"
              : null,
      futsalCourts: branches.reduce(
        (sum: number, b: any) =>
          sum +
          Object.values(b.pricing?.futsal || {}).reduce(
            (s: number, v: any) => s + (toIntOrNull(v?.count) || 0),
            0
          ),
        0
      ),
      futsalCourtType: null,
      indoorCricketNets: branches.reduce(
        (sum: number, b: any) =>
          sum +
          Object.values(b.pricing?.indoor_cricket || {}).reduce(
            (s: number, v: any) => s + (toIntOrNull(v?.count) || 0),
            0
          ),
        0
      ),
      indoorCricketSurface: null,
      padelCourts: branches.reduce(
        (sum: number, b: any) =>
          sum +
          Object.values(b.pricing?.padel || {}).reduce(
            (s: number, v: any) => s + (toIntOrNull(v?.count) || 0),
            0
          ),
        0
      ),
      padelCourtSurface: null,
      pickleballCourts: branches.reduce(
        (sum: number, b: any) =>
          sum +
          Object.values(b.pricing?.pickleball || {}).reduce(
            (s: number, v: any) => s + (toIntOrNull(v?.count) || 0),
            0
          ),
        0
      ),
      pickleballSurface: null,
    };

    const mappedBranches = branches.map((b: any) => ({
      id: b.id,
      branchDisplayName: String(b.branchDisplayName || "").trim(),
      city: String(b.city || "").trim(),
      areaLabel: String(b.areaLabel || "").trim(),
      addressLine1: String(b.addressLine1 || "").trim(),
      googleMapsUrl: String(b.googleMapsUrl || "").trim() || null,
      games: {
        supportsCs2: !!b.supportsCs2,
        supportsFc25: !!b.supportsFc25,
        supportsTekken8: !!b.supportsTekken8,
        supportsFutsal: !!b.supportsFutsal,
        supportsIndoorCricket: !!b.supportsIndoorCricket,
        supportsPadel: !!b.supportsPadel,
        supportsPickleball: !!b.supportsPickleball,
      },
      pricing: {
        pc: b.pricing?.pc
          ? {
              regular: b.pricing.pc.regular
                ? {
                    count: toIntOrNull(b.pricing.pc.regular.count) || 0,
                    price: toIntOrNull(b.pricing.pc.regular.price) || 0,
                  }
                : null,
              premium: b.pricing.pc.premium
                ? {
                    count: toIntOrNull(b.pricing.pc.premium.count) || 0,
                    price: toIntOrNull(b.pricing.pc.premium.price) || 0,
                  }
                : null,
              elite: b.pricing.pc.elite
                ? {
                    count: toIntOrNull(b.pricing.pc.elite.count) || 0,
                    price: toIntOrNull(b.pricing.pc.elite.price) || 0,
                  }
                : null,
            }
          : null,
        console: b.pricing?.console
          ? {
              ps5: b.pricing.console.ps5
                ? {
                    count: toIntOrNull(b.pricing.console.ps5.count) || 0,
                    price1v1: toIntOrNull(b.pricing.console.ps5.price1v1) || 0,
                    price2v2: toIntOrNull(b.pricing.console.ps5.price2v2) || 0,
                  }
                : null,
              xbox: b.pricing.console.xbox
                ? {
                    count: toIntOrNull(b.pricing.console.xbox.count) || 0,
                    price1v1: toIntOrNull(b.pricing.console.xbox.price1v1) || 0,
                    price2v2: toIntOrNull(b.pricing.console.xbox.price2v2) || 0,
                  }
                : null,
            }
          : null,
        futsal: b.pricing?.futsal
          ? Object.entries(b.pricing.futsal).reduce(
              (acc: Record<string, any>, [k, v]: [string, any]) => ({
                ...acc,
                [k]: {
                  count: toIntOrNull(v?.count) || 0,
                  price: toIntOrNull(v?.price) || 0,
                },
              }),
              {}
            )
          : null,
        indoorCricket: b.pricing?.indoor_cricket
          ? Object.entries(b.pricing.indoor_cricket).reduce(
              (acc: Record<string, any>, [k, v]: [string, any]) => ({
                ...acc,
                [k]: {
                  count: toIntOrNull(v?.count) || 0,
                  price: toIntOrNull(v?.price) || 0,
                },
              }),
              {}
            )
          : null,
        padel: b.pricing?.padel
          ? Object.entries(b.pricing.padel).reduce(
              (acc: Record<string, any>, [k, v]: [string, any]) => ({
                ...acc,
                [k]: {
                  count: toIntOrNull(v?.count) || 0,
                  price: toIntOrNull(v?.price) || 0,
                },
              }),
              {}
            )
          : null,
        pickleball: b.pricing?.pickleball
          ? Object.entries(b.pricing.pickleball).reduce(
              (acc: Record<string, any>, [k, v]: [string, any]) => ({
                ...acc,
                [k]: {
                  count: toIntOrNull(v?.count) || 0,
                  price: toIntOrNull(v?.price) || 0,
                },
              }),
              {}
            )
          : null,
      },
      notes: String(b.notes || "").trim() || null,
      specs: String(b.specs || "").trim() || null,
    }));

    const now = Date.now();

    const zoneId = await ctx.db.insert("zones", {
      ownerUid: user.uid,
      ownerFullName: String(step1.ownerFullName || "").trim() || user.fullName || user.displayName || undefined,
      venueBrandName: String(step1.venueBrandName || "").trim() || undefined,
      contactEmail: String(step1.contactEmail || "").trim().toLowerCase() || user.email || undefined,
      contactPhone: normalizedPhone ?? undefined,
      type: step1.type ?? undefined,
      status: "pending-review",
      onboardingStep: 4,
      primaryBranch: {
        branchDisplayName: String(primaryBranch?.branchDisplayName || "").trim(),
        city: String(primaryBranch?.city || "").trim(),
        areaLabel: String(primaryBranch?.areaLabel || "").trim(),
        addressLine1: String(primaryBranch?.addressLine1 || "").trim(),
        googleMapsUrl: String(primaryBranch?.googleMapsUrl || "").trim() || null,
      },
      branches: mappedBranches,
      games,
      capacity,
      pricing: mappedBranches[0]?.pricing ?? null,
      notes: String(primaryBranch?.notes || "").trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });

    return { ok: true, zoneId };
  },
});

export const createZone = mutation({
  args: {
    venueBrandName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    type: v.optional(v.string()),
    primaryArea: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const now = Date.now();
    const zoneId = await ctx.db.insert("zones", {
      ownerUid: user.uid,
      ownerFullName: user.fullName ?? user.displayName ?? undefined,
      venueBrandName: args.venueBrandName ?? undefined,
      contactEmail: args.contactEmail ?? user.email ?? undefined,
      contactPhone: args.contactPhone ?? undefined,
      type: args.type ?? undefined,
      status: "draft",
      primaryArea: args.primaryArea ?? undefined,
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true, zoneId };
  },
});

export const updateZone = mutation({
  args: {
    zoneId: v.id("zones"),
    venueBrandName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    status: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    primaryArea: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, role } = await requireUser(ctx);
    const zone = await ctx.db.get(args.zoneId);
    if (!zone) throw new ConvexError("Zone not found.");
    if (zone.ownerUid !== user.uid && role !== "superAdmin") {
      throw new ConvexError("Not authorized.");
    }

    const updates: any = { updatedAt: Date.now() };
    if (args.venueBrandName !== undefined) updates.venueBrandName = args.venueBrandName ?? null;
    if (args.contactEmail !== undefined) updates.contactEmail = args.contactEmail ?? null;
    if (args.contactPhone !== undefined) updates.contactPhone = args.contactPhone ?? null;
    if (args.status !== undefined) updates.status = args.status;
    if (args.rejectionReason !== undefined) updates.rejectionReason = args.rejectionReason ?? null;
    if (args.primaryArea !== undefined) updates.primaryArea = args.primaryArea ?? null;
    if (args.notes !== undefined) updates.notes = args.notes ?? null;

    await ctx.db.patch(args.zoneId, updates);
    return { ok: true };
  },
});

export const submitZone = mutation({
  args: { zoneId: v.id("zones") },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const zone = await ctx.db.get(args.zoneId);
    if (!zone) throw new ConvexError("Zone not found.");
    if (zone.ownerUid !== user.uid) throw new ConvexError("Not authorized.");
    await ctx.db.patch(args.zoneId, { status: "submitted", updatedAt: Date.now() });
    return { ok: true };
  },
});

export const createBranch = mutation({
  args: {
    zoneId: v.id("zones"),
    branchDisplayName: v.string(),
    city: v.optional(v.string()),
    areaLabel: v.optional(v.string()),
    addressLine1: v.optional(v.string()),
    googleMapsUrl: v.optional(v.string()),
    games: v.optional(v.any()),
    pricing: v.optional(v.any()),
    notes: v.optional(v.string()),
    specs: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const zone = await ctx.db.get(args.zoneId);
    if (!zone) throw new ConvexError("Zone not found.");
    if (zone.ownerUid !== user.uid) throw new ConvexError("Not authorized.");
    const now = Date.now();
    const branchId = await ctx.db.insert("zoneBranches", {
      zoneId: zone._id,
      branchDisplayName: args.branchDisplayName,
      city: args.city ?? undefined,
      areaLabel: args.areaLabel ?? undefined,
      addressLine1: args.addressLine1 ?? undefined,
      googleMapsUrl: args.googleMapsUrl ?? undefined,
      games: args.games ?? undefined,
      pricing: args.pricing ?? undefined,
      notes: args.notes ?? undefined,
      specs: args.specs ?? undefined,
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true, branchId };
  },
});

export const updateBranch = mutation({
  args: {
    branchId: v.id("zoneBranches"),
    branchDisplayName: v.optional(v.string()),
    city: v.optional(v.string()),
    areaLabel: v.optional(v.string()),
    addressLine1: v.optional(v.string()),
    googleMapsUrl: v.optional(v.string()),
    games: v.optional(v.any()),
    pricing: v.optional(v.any()),
    notes: v.optional(v.string()),
    specs: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const branch = await ctx.db.get(args.branchId);
    if (!branch) throw new ConvexError("Branch not found.");
    const zone = await ctx.db.get(branch.zoneId as Id<"zones">);
    if (!zone || zone.ownerUid !== user.uid) throw new ConvexError("Not authorized.");

    const updates: any = { updatedAt: Date.now() };
    if (args.branchDisplayName !== undefined) updates.branchDisplayName = args.branchDisplayName ?? null;
    if (args.city !== undefined) updates.city = args.city ?? null;
    if (args.areaLabel !== undefined) updates.areaLabel = args.areaLabel ?? null;
    if (args.addressLine1 !== undefined) updates.addressLine1 = args.addressLine1 ?? null;
    if (args.googleMapsUrl !== undefined) updates.googleMapsUrl = args.googleMapsUrl ?? null;
    if (args.games !== undefined) updates.games = args.games ?? null;
    if (args.pricing !== undefined) updates.pricing = args.pricing ?? null;
    if (args.notes !== undefined) updates.notes = args.notes ?? null;
    if (args.specs !== undefined) updates.specs = args.specs ?? null;

    await ctx.db.patch(args.branchId, updates);
    return { ok: true };
  },
});

export const deleteBranch = mutation({
  args: { branchId: v.id("zoneBranches") },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const branch = await ctx.db.get(args.branchId);
    if (!branch) throw new ConvexError("Branch not found.");
    const zone = await ctx.db.get(branch.zoneId as Id<"zones">);
    if (!zone || zone.ownerUid !== user.uid) throw new ConvexError("Not authorized.");
    await ctx.db.delete(args.branchId);
    return { ok: true };
  },
});

export const createResource = mutation({
  args: {
    zoneId: v.id("zones"),
    branchId: v.id("zoneBranches"),
    kind: v.optional(v.string()),
    lifecycleStatus: v.optional(v.string()),
    label: v.optional(v.string()),
    roomLabel: v.optional(v.string()),
    assetType: v.optional(v.string()),
    tier: v.optional(v.string()),
    surface: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    allocation: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const zone = await ctx.db.get(args.zoneId);
    if (!zone || zone.ownerUid !== user.uid) throw new ConvexError("Not authorized.");
    const now = Date.now();
    const resourceId = await ctx.db.insert("zoneResources", {
      zoneId: zone._id,
      branchId: args.branchId,
      kind: args.kind ?? undefined,
      lifecycleStatus: args.lifecycleStatus ?? undefined,
      label: args.label ?? undefined,
      roomLabel: args.roomLabel ?? undefined,
      assetType: args.assetType ?? undefined,
      tier: args.tier ?? undefined,
      surface: args.surface ?? undefined,
      isActive: args.isActive ?? true,
      allocation: args.allocation ?? undefined,
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true, resourceId };
  },
});

export const updateResource = mutation({
  args: {
    resourceId: v.id("zoneResources"),
    lifecycleStatus: v.optional(v.string()),
    label: v.optional(v.string()),
    roomLabel: v.optional(v.string()),
    assetType: v.optional(v.string()),
    tier: v.optional(v.string()),
    surface: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    allocation: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const resource = await ctx.db.get(args.resourceId);
    if (!resource) throw new ConvexError("Resource not found.");
    const zone = await ctx.db.get(resource.zoneId as Id<"zones">);
    if (!zone || zone.ownerUid !== user.uid) throw new ConvexError("Not authorized.");

    const updates: any = { updatedAt: Date.now() };
    if (args.lifecycleStatus !== undefined) updates.lifecycleStatus = args.lifecycleStatus ?? null;
    if (args.label !== undefined) updates.label = args.label ?? null;
    if (args.roomLabel !== undefined) updates.roomLabel = args.roomLabel ?? null;
    if (args.assetType !== undefined) updates.assetType = args.assetType ?? null;
    if (args.tier !== undefined) updates.tier = args.tier ?? null;
    if (args.surface !== undefined) updates.surface = args.surface ?? null;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    if (args.allocation !== undefined) updates.allocation = args.allocation ?? null;

    await ctx.db.patch(args.resourceId, updates);
    return { ok: true };
  },
});

export const createPricingRule = mutation({
  args: {
    zoneId: v.id("zones"),
    name: v.optional(v.string()),
    isEnabled: v.optional(v.boolean()),
    assetType: v.optional(v.string()),
    branchId: v.optional(v.string()),
    tier: v.optional(v.string()),
    surface: v.optional(v.string()),
    ruleType: v.optional(v.string()),
    value: v.optional(v.number()),
    daysOfWeek: v.optional(v.array(v.number())),
    timeStart: v.optional(v.string()),
    timeEnd: v.optional(v.string()),
    validFrom: v.optional(v.string()),
    validTo: v.optional(v.string()),
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const zone = await ctx.db.get(args.zoneId);
    if (!zone || zone.ownerUid !== user.uid) throw new ConvexError("Not authorized.");
    const now = Date.now();
    const ruleId = await ctx.db.insert("zonePricingRules", {
      zoneId: zone._id,
      name: args.name ?? undefined,
      isEnabled: args.isEnabled ?? true,
      assetType: args.assetType ?? undefined,
      branchId: args.branchId ?? undefined,
      tier: args.tier ?? undefined,
      surface: args.surface ?? undefined,
      ruleType: args.ruleType ?? undefined,
      value: args.value ?? undefined,
      daysOfWeek: args.daysOfWeek ?? undefined,
      timeStart: args.timeStart ?? undefined,
      timeEnd: args.timeEnd ?? undefined,
      validFrom: args.validFrom ?? undefined,
      validTo: args.validTo ?? undefined,
      priority: args.priority ?? undefined,
      createdByUid: user.uid,
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true, ruleId };
  },
});

export const updatePricingRule = mutation({
  args: {
    ruleId: v.id("zonePricingRules"),
    isEnabled: v.optional(v.boolean()),
    value: v.optional(v.number()),
    timeStart: v.optional(v.string()),
    timeEnd: v.optional(v.string()),
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const rule = await ctx.db.get(args.ruleId);
    if (!rule) throw new ConvexError("Rule not found.");
    const zone = await ctx.db.get(rule.zoneId as Id<"zones">);
    if (!zone || zone.ownerUid !== user.uid) throw new ConvexError("Not authorized.");

    const updates: any = { updatedAt: Date.now() };
    if (args.isEnabled !== undefined) updates.isEnabled = args.isEnabled;
    if (args.value !== undefined) updates.value = args.value;
    if (args.timeStart !== undefined) updates.timeStart = args.timeStart ?? null;
    if (args.timeEnd !== undefined) updates.timeEnd = args.timeEnd ?? null;
    if (args.priority !== undefined) updates.priority = args.priority ?? null;

    await ctx.db.patch(args.ruleId, updates);
    return { ok: true };
  },
});

export const deletePricingRule = mutation({
  args: { ruleId: v.id("zonePricingRules") },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const rule = await ctx.db.get(args.ruleId);
    if (!rule) throw new ConvexError("Rule not found.");
    const zone = await ctx.db.get(rule.zoneId as Id<"zones">);
    if (!zone || zone.ownerUid !== user.uid) throw new ConvexError("Not authorized.");
    await ctx.db.delete(args.ruleId);
    return { ok: true };
  },
});

export const getZoneBookingQueue = query({
  args: { zoneOwnerUid: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { user, role } = await requireUser(ctx);
    const zoneOwnerUid = args.zoneOwnerUid ?? user.uid;
    if (zoneOwnerUid !== user.uid && role !== "superAdmin") {
      throw new ConvexError("Not authorized.");
    }

    return await ctx.db
      .query("bookingRequests")
      .withIndex("by_zoneOwnerUid", (q) => q.eq("zoneOwnerUid", zoneOwnerUid))
      .order("desc")
      .collect();
  },
});

export const getZoneMatchrooms = query({
  args: { zoneId: v.string() },
  handler: async (ctx, args) => {
    await assertZoneOwnerOrAdmin(ctx, args.zoneId);
    return await ctx.db
      .query("matchrooms")
      .withIndex("by_zoneId", (q) => q.eq("zoneId", args.zoneId))
      .order("desc")
      .collect();
  },
});

export const getZoneAnalytics = query({
  args: { zoneId: v.string() },
  handler: async (ctx, args) => {
    const { zone } = await assertZoneOwnerOrAdmin(ctx, args.zoneId);
    const [requests, offers, matchrooms] = await Promise.all([
      ctx.db
        .query("bookingRequests")
        .withIndex("by_zoneId", (q) => q.eq("zoneId", args.zoneId))
        .collect(),
      ctx.db
        .query("bookingOffers")
        .withIndex("by_zoneOwnerUid", (q) => q.eq("zoneOwnerUid", zone.ownerUid))
        .collect(),
      ctx.db
        .query("matchrooms")
        .withIndex("by_zoneId", (q) => q.eq("zoneId", args.zoneId))
        .collect(),
    ]);

    return {
      bookingRequests: requests.length,
      bookingOffers: offers.length,
      matchrooms: matchrooms.length,
    };
  },
});

export const listActiveZones = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
    return await ctx.db
      .query("zones")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .order("desc")
      .take(limit);
  },
});

export const listPendingZones = query({
  args: {},
  handler: async (ctx) => {
    const { role } = await requireUser(ctx);
    requireRole(role, ["superAdmin"]);
    return await ctx.db
      .query("zones")
      .withIndex("by_status", (q) => q.eq("status", "submitted"))
      .order("desc")
      .collect();
  },
});

export const listPricingRules = query({
  args: { zoneId: v.string() },
  handler: async (ctx, args) => {
    await assertZoneOwnerOrAdmin(ctx, args.zoneId);
    return await ctx.db
      .query("zonePricingRules")
      .withIndex("by_zoneId", (q) => q.eq("zoneId", args.zoneId))
      .collect();
  },
});

export const applyPricingRules = query({
  args: {
    zoneId: v.string(),
    assetType: v.string(),
    baseRate: v.number(),
    branchId: v.optional(v.string()),
    tier: v.optional(v.string()),
    surface: v.optional(v.string()),
    at: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertZoneOwnerOrAdmin(ctx, args.zoneId);

    const rules = await ctx.db
      .query("zonePricingRules")
      .withIndex("by_zoneId", (q) => q.eq("zoneId", args.zoneId))
      .collect();

    const rate = Number(args.baseRate || 0);
    if (!Number.isFinite(rate) || rate <= 0) {
      return { rate: 0, appliedRule: null };
    }

    const at = new Date(args.at ?? Date.now());
    const matching = sortRules(
      rules.filter((rule) =>
        doesRuleMatchContext(
          rule,
          {
            assetType: args.assetType,
            branchId: args.branchId ?? null,
            tier: args.tier ?? null,
            surface: args.surface ?? null,
          },
          at
        )
      )
    );

    if (!matching.length) {
      return { rate, appliedRule: null };
    }

    const selected = matching[0];
    let nextRate = rate;
    if (selected.ruleType === "fixed_override") {
      nextRate = clamp(toNumber(selected.value), 0, 999999);
    } else {
      const discount = clamp(toNumber(selected.value), 0, 100);
      nextRate = rate * (1 - discount / 100);
    }

    return {
      rate: Math.max(0, Math.round(nextRate)),
      appliedRule: selected,
    };
  },
});
