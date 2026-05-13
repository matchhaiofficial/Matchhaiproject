import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { components } from "./_generated/api";

const APP_TABLES_IN_DELETE_ORDER = [
  "chatMessages",
  "chatrooms",
  "notifications",
  "teamChallengeChatMessages",
  "teamChallengeChats",
  "teamChallenges",
  "teamMembers",
  "teams",
  "bookingIntents",
  "zoneOffers",
  "bookingRequests",
  "zoneResources",
  "pricingRules",
  "matchrooms",
  "walletTransactions",
  "friendships",
  "userBlocks",
  "reports",
  "psnTokenCache",
  "zones",
  "users",
] as const;

async function clearTable(ctx: any, tableName: string) {
  const rows = await ctx.db.query(tableName).collect();
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
  return rows.length;
}

const AUTH_DELETE_PAGINATION = {
  cursor: null,
  numItems: 100000,
};

export const resetDevelopmentData = internalMutation({
  args: { confirm: v.string() },
  handler: async (ctx, args) => {
    // Hard guard to prevent accidental use from client code.
    if (args.confirm !== "DELETE_ALL_MATCHHAI_DEV_DATA") {
      throw new Error(
        'Pass confirm: "DELETE_ALL_MATCHHAI_DEV_DATA" to run resetDevelopmentData.'
      );
    }
    const deleted: Record<string, number> = {};

    for (const tableName of APP_TABLES_IN_DELETE_ORDER) {
      deleted[tableName] = await clearTable(ctx, tableName);
    }

    await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: { model: "session" },
      paginationOpts: AUTH_DELETE_PAGINATION,
    });
    await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: { model: "account" },
      paginationOpts: AUTH_DELETE_PAGINATION,
    });
    await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: { model: "verification" },
      paginationOpts: AUTH_DELETE_PAGINATION,
    });
    await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: { model: "user" },
      paginationOpts: AUTH_DELETE_PAGINATION,
    });

    return {
      ok: true,
      deleted,
      authCleared: ["session", "account", "verification", "user"],
    };
  },
});
