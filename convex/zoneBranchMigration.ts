import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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
      // Also check authId
      const user = await ctx.db.get(zone.ownerUid);
      if (!user || user.authId !== args.ownerUid) {
        throw new Error("Only the zone owner can run migration.");
      }
    }

    const legacyBranches = Array.isArray(zone.branches) ? zone.branches : [];
    if (legacyBranches.length === 0) {
      throw new Error("No embedded branches found to migrate.");
    }

    const now = Date.now();
    let resourceCount = 0;

    const sanitizeIdToken = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

    const toPositiveInt = (value: unknown) => {
      const parsed = parseInt(String(value ?? ""), 10);
      return isFinite(parsed) && parsed > 0 ? parsed : 0;
    };

    for (let branchIndex = 0; branchIndex < legacyBranches.length; branchIndex++) {
      const branch = legacyBranches[branchIndex] as any;
      const branchId = sanitizeIdToken(
        branch.id || branch.branchDisplayName || `branch_${branchIndex + 1}`
      ) || `branch_${branchIndex + 1}`;

      const pricing = branch.pricing || {};

      // Generate seat resources from pricing
      const seatConfigs = [
        { assetType: "pc", tier: "regular", count: toPositiveInt(pricing.pc?.regular?.count), room: "PC Regular" },
        { assetType: "pc", tier: "premium", count: toPositiveInt(pricing.pc?.premium?.count), room: "PC Premium" },
        { assetType: "pc", tier: "elite", count: toPositiveInt(pricing.pc?.elite?.count), room: "PC Elite" },
        { assetType: "console", tier: "ps5", count: toPositiveInt(pricing.console?.ps5?.count), room: "PS5" },
        { assetType: "console", tier: "xbox", count: toPositiveInt(pricing.console?.xbox?.count), room: "Xbox" },
      ];

      for (const config of seatConfigs) {
        for (let i = 1; i <= config.count; i++) {
          await ctx.db.insert("zoneResources", {
            zoneId: args.zoneId,
            branchId,
            kind: "seat",
            name: `${config.room} ${i}`,
            assetType: config.assetType,
            lifecycleStatus: "available",
            createdAt: now,
            updatedAt: now,
          });
          resourceCount++;
        }
      }

      // Generate court resources
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
              zoneId: args.zoneId,
              branchId,
              kind: "court",
              name: `${courtType.assetType.toUpperCase()} ${surfaceKey} ${i}`,
              assetType: courtType.assetType,
              lifecycleStatus: "available",
              createdAt: now,
              updatedAt: now,
            });
            resourceCount++;
          }
        }
      }
    }

    // Update zone with migration metadata
    await ctx.db.patch(args.zoneId, {
      updatedAt: now,
    });

    return {
      branchCount: legacyBranches.length,
      resourceCount,
    };
  },
});
