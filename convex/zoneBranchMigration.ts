import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { recordZoneAuditEvent } from "./zoneAudit";

// ============================================
// QUERIES
// ============================================

// Get zone branches from zone document
export const getZoneBranches = query({
  args: { zoneId: v.id("zones") },
  handler: async (ctx, args) => {
    const zone = await ctx.db.get(args.zoneId);
    if (!zone) return [];

    const branches = Array.isArray(zone.branches) ? zone.branches : [];
    return branches.map((b: any, index: number) => ({
      id: b.id || `branch_${index + 1}`,
      zoneId: String(args.zoneId),
      branchDisplayName: b.branchDisplayName || b.name || "Branch",
      city: b.city || "",
      areaLabel: b.areaLabel || "",
      addressLine1: b.addressLine1 || b.address || "",
      source: b.source || "manual",
      resourceModelVersion: b.resourceModelVersion || 0,
      pricing: b.pricing,
      googleMapsUrl: b.googleMapsUrl || null,
      contactPhone: b.contactPhone || null,
      games: b.games,
      notes: b.notes || null,
      specs: b.specs || null,
    }));
  },
});

// ============================================
// MUTATIONS
// ============================================

const sanitizeIdToken = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const toPositiveInt = (value: unknown) => {
  const parsed = parseInt(String(value ?? ""), 10);
  return isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export async function migrateZoneBranchesInternal(ctx: any, zoneId: any) {
  const zone = await ctx.db.get(zoneId);
  if (!zone) throw new Error("Zone not found.");

  const currentRetryCount = Number(zone.migration?.retryCount || 0);
  const now = Date.now();

  if (zone.migration?.perBranchSeatModel) {
    await ctx.db.patch(zoneId, {
      migration: {
        ...zone.migration,
        perBranchSeatModel: true,
        status: "succeeded",
        migratedAt: zone.migration?.migratedAt || now,
        lastAttemptAt: now,
        lastError: undefined,
        branchCount: Number(zone.migration?.branchCount || (Array.isArray(zone.branches) ? zone.branches.length : 0)),
        resourceCount: Number(zone.migration?.resourceCount || 0),
      },
      updatedAt: now,
    });
    return {
      branchCount: Number(zone.migration?.branchCount || (Array.isArray(zone.branches) ? zone.branches.length : 0)),
      resourceCount: Number(zone.migration?.resourceCount || 0),
      skipped: true,
    };
  }

  const legacyBranches = Array.isArray(zone.branches) ? zone.branches : [];
  if (legacyBranches.length === 0) {
    await ctx.db.patch(zoneId, {
      migration: {
        ...zone.migration,
        perBranchSeatModel: false,
        status: "failed",
        lastAttemptAt: now,
        lastError: "No embedded branches found to migrate.",
        retryCount: currentRetryCount + 1,
      },
      updatedAt: now,
    });
    throw new Error("No embedded branches found to migrate.");
  }

  await ctx.db.patch(zoneId, {
    migration: {
      ...zone.migration,
      perBranchSeatModel: false,
      status: "pending",
      lastAttemptAt: now,
      lastError: undefined,
      retryCount: currentRetryCount + 1,
    },
    updatedAt: now,
  });

  let resourceCount = 0;

  for (let branchIndex = 0; branchIndex < legacyBranches.length; branchIndex++) {
    const branch = legacyBranches[branchIndex] as any;
    const branchId = sanitizeIdToken(
      branch.id || branch.branchDisplayName || `branch_${branchIndex + 1}`
    ) || `branch_${branchIndex + 1}`;

    const pricing = branch.pricing || {};

    const seatConfigs = [
      { assetType: "pc", tier: "regular", count: toPositiveInt(pricing.pc?.regular?.count), room: "Regular PCs" },
      { assetType: "pc", tier: "premium", count: toPositiveInt(pricing.pc?.premium?.count), room: "Premium PCs" },
      { assetType: "pc", tier: "elite", count: toPositiveInt(pricing.pc?.elite?.count), room: "Elite PCs" },
      { assetType: "console", tier: "regular", count: toPositiveInt(pricing.console?.regular?.count), room: "Regular Consoles" },
      { assetType: "console", tier: "premium", count: toPositiveInt(pricing.console?.premium?.count), room: "Premium Consoles" },
      { assetType: "console", tier: "elite", count: toPositiveInt(pricing.console?.elite?.count), room: "Elite Consoles" },
      { assetType: "console", tier: "ps5", count: toPositiveInt(pricing.console?.ps5?.count), room: "PS5" },
      { assetType: "console", tier: "xbox", count: toPositiveInt(pricing.console?.xbox?.count), room: "Xbox" },
    ];

    for (const config of seatConfigs) {
      for (let i = 1; i <= config.count; i++) {
        const roomIndex = config.assetType === "pc" ? Math.floor((i - 1) / 5) + 1 : Math.floor((i - 1) / 2) + 1;
        const roomLabel =
          config.assetType === "pc"
            ? `${config.room} Room ${roomIndex}`
            : `${config.room} Bay ${roomIndex}`;
        await ctx.db.insert("zoneResources", {
          zoneId,
          branchId,
          kind: "seat",
          name: `${config.room} ${i}`,
          assetType: config.assetType,
          tier: config.tier,
          roomLabel,
          lifecycleStatus: "available",
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
        resourceCount++;
      }
    }

    const courtTypes = [
      { assetType: "futsal", source: pricing.futsal },
      { assetType: "indoor_cricket", source: pricing.indoorCricket || pricing.indoor_cricket },
      { assetType: "padel", source: pricing.padel },
      { assetType: "pickleball", source: pricing.pickleball },
    ];

    for (const courtType of courtTypes) {
      if (!courtType.source) continue;
      for (const [surfaceKey, surfaceValue] of Object.entries(courtType.source)) {
        const count = toPositiveInt((surfaceValue as any)?.count);
        for (let i = 1; i <= count; i++) {
          await ctx.db.insert("zoneResources", {
            zoneId,
            branchId,
            kind: "court",
            name: `${courtType.assetType.toUpperCase()} ${surfaceKey} ${i}`,
            assetType: courtType.assetType,
            surface: String(surfaceKey),
            lifecycleStatus: "available",
            isActive: true,
            createdAt: now,
            updatedAt: now,
          });
          resourceCount++;
        }
      }
    }
  }

  await ctx.db.patch(zoneId, {
    migration: {
      ...zone.migration,
      perBranchSeatModel: true,
      status: "succeeded",
      resourceModelVersion: 1,
      migratedAt: now,
      lastAttemptAt: now,
      lastError: undefined,
      retryCount: currentRetryCount + 1,
      branchCount: legacyBranches.length,
      resourceCount,
    },
    updatedAt: now,
  });

  return {
    branchCount: legacyBranches.length,
    resourceCount,
    skipped: false,
  };
}

// Migrate zone branches: generate resources from branch pricing data
export const migrateZoneBranches = mutation({
  args: {
    zoneId: v.id("zones"),
    ownerUid: v.string(),
  },
  handler: async (ctx, args) => {
    const zone = await ctx.db.get(args.zoneId);
    if (!zone) throw new Error("Zone not found.");

    if (String(zone.ownerUid) !== args.ownerUid) {
      const user = await ctx.db.get(zone.ownerUid);
      if (!user || user.authId !== args.ownerUid) {
        throw new Error("Only the zone owner can run migration.");
      }
    }

    const result = await migrateZoneBranchesInternal(ctx, args.zoneId);
    await recordZoneAuditEvent(ctx, {
      zoneId: String(args.zoneId),
      module: "migration",
      action: result.skipped ? "run_branch_migration_skipped" : "run_branch_migration",
      actorUid: args.ownerUid,
      targetType: "zone",
      targetId: String(args.zoneId),
      summary: result.skipped
        ? "Migration run skipped because the venue was already on the per-branch resource model."
        : `Migration generated ${result.resourceCount} resources across ${result.branchCount} branches.`,
      details: {
        skipped: result.skipped,
        branchCount: result.branchCount,
        resourceCount: result.resourceCount,
      },
    });
    return {
      branchCount: result.branchCount,
      resourceCount: result.resourceCount,
    };
  },
});
