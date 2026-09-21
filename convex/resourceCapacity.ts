import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";

const MAX_BRANCH_RESOURCES = 500;

export async function refreshBranchResourceCapacitySnapshot(ctx: any, input: {
  zoneId: Id<"zones">;
  branchId: string;
  now?: number;
}) {
  const page = await ctx.db.query("zoneResources")
    .withIndex("by_zoneId_and_branchId", (q: any) =>
      q.eq("zoneId", input.zoneId).eq("branchId", input.branchId),
    )
    .take(MAX_BRANCH_RESOURCES + 1);
  const capacityByKey: Record<string, number> = {};
  for (const resource of page.slice(0, MAX_BRANCH_RESOURCES)) {
    if (resource.isActive === false || resource.lifecycleStatus === "maintenance") continue;
    const assetType = String(resource.assetType || "").trim().toLowerCase();
    if (!assetType) continue;
    const tier = String(resource.tier || "").trim().toLowerCase();
    const surface = String(resource.surface || "").trim().toLowerCase();
    for (const key of new Set([
      assetType,
      tier ? `${assetType}:${tier}` : "",
      surface ? `${assetType}:${surface}` : "",
    ].filter(Boolean))) {
      capacityByKey[key] = (capacityByKey[key] || 0) + 1;
    }
  }

  const existing = await ctx.db.query("zoneResourceCapacitySnapshots")
    .withIndex("by_zoneId_and_branchId", (q: any) =>
      q.eq("zoneId", input.zoneId).eq("branchId", input.branchId),
    )
    .unique();
  const value = {
    capacityByKey,
    complete: page.length <= MAX_BRANCH_RESOURCES,
    updatedAt: input.now || Date.now(),
  };
  if (existing) await ctx.db.patch(existing._id, value);
  else await ctx.db.insert("zoneResourceCapacitySnapshots", {
    zoneId: input.zoneId,
    branchId: input.branchId,
    ...value,
  });
  return value;
}

// Operations-only helper for migrations and development verification.
export const refreshBranchSnapshot = internalMutation({
  args: { zoneId: v.id("zones"), branchId: v.string() },
  handler: async (ctx, args) => refreshBranchResourceCapacitySnapshot(ctx, args),
});
