import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";

const CONFIRM_TOKEN = "DELETE_ALL_MATCHHAI_DEV_DATA";

const APP_TABLES_IN_DELETE_ORDER = [
  "supportAgentRateLimits",
  "supportAgentAuditLogs",
  "supportTicketNotes",
  "supportMessages",
  "supportConversations",
  "supportTickets",
  "chatTypingStatus",
  "chatMessages",
  "chatroomMembers",
  "chatrooms",
  "pushDevices",
  "notifications",
  "teamChallengeChatMembers",
  "teamChallengeChatMessages",
  "teamChallengeChats",
  "teamChallenges",
  "teamMembers",
  "teams",
  "bookingRequests",
  "bookingIntents",
  "matchrooms",
  "zoneAuditEvents",
  "zoneOffers",
  "zoneResources",
  "pricingRules",
  "reports",
  "phoneVerifications",
  "identityVerifications",
  "paymentTransactions",
  "walletTransactions",
  "friendships",
  "userBlocks",
  "psnTokenCache",
  "zones",
  "users",
] as const;

type AppTableName = (typeof APP_TABLES_IN_DELETE_ORDER)[number];

function assertAppTableName(tableName: string): asserts tableName is AppTableName {
  if (!APP_TABLES_IN_DELETE_ORDER.includes(tableName as AppTableName)) {
    throw new Error(`Refusing to wipe unknown table: ${tableName}`);
  }
}

export const deleteTableBatch = internalMutation({
  args: {
    tableName: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    assertAppTableName(args.tableName);
    const safeLimit = Math.max(1, Math.min(args.limit, 1000));
    const docs = await ctx.db.query(args.tableName).take(safeLimit);
    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }
    return { deleted: docs.length };
  },
});

const AUTH_DELETE_PAGINATION = {
  cursor: null,
  numItems: 100000,
};

export const wipeAllDevData = internalAction({
  args: {
    confirm: v.string(),
    includeAuth: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const deployment = process.env.CONVEX_DEPLOYMENT ?? null;

    if (deployment && /^prod:/i.test(deployment)) {
      throw new Error(
        `Refusing to run on production deployment (${deployment}). This cleanup is dev/staging-only.`
      );
    }

    if (args.confirm !== CONFIRM_TOKEN) {
      throw new Error(
        `Missing required confirmation token. Pass confirm: "${CONFIRM_TOKEN}".`
      );
    }

    const deleted: Record<string, number> = {};
    const skipped: Record<string, string> = {};

    for (const tableName of APP_TABLES_IN_DELETE_ORDER) {
      let tableDeleted = 0;
      try {
        while (true) {
          const { deleted: batchDeleted } = await ctx.runMutation(
            internal.devCleanup.deleteTableBatch,
            { tableName, limit: 500 }
          );
          tableDeleted += batchDeleted;
          if (batchDeleted === 0) break;
        }
        deleted[tableName] = tableDeleted;
      } catch (error) {
        skipped[tableName] = error instanceof Error ? error.message : String(error);
      }
    }

    let authCleared: string[] | undefined;
    if (args.includeAuth) {
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
      authCleared = ["session", "account", "verification", "user"];
    }

    return {
      ok: true,
      deployment,
      deleted,
      skipped,
      authCleared,
      storageDeleted: false,
    };
  },
});

