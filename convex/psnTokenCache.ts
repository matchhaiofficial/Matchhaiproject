// convex/psnTokenCache.ts
// Internal queries/mutations for PSN token cache
// These must be in a separate file from Node.js actions

import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const getPsnTokenCache = internalQuery({
  args: {},
  handler: async (ctx) => {
    const tokens = await ctx.db.query("psnTokenCache").first();
    return tokens;
  },
});

export const updatePsnTokenCache = internalMutation({
  args: {
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("psnTokenCache").first();
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt: args.expiresAt,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("psnTokenCache", {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt: args.expiresAt,
        updatedAt: now,
      });
    }
  },
});
