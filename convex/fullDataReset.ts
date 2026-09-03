import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation } from "./_generated/server";
import { getRuntimeEnv } from "./runtimeEnv";

const REQUIRED_CONFIRMATION = "WIPE_ALL_MATCHHAI_DATA";
const RESET_ENABLED_ENV = "MATCHHAI_FULL_RESET_ENABLED";
const RESET_TARGET_ENV = "MATCHHAI_FULL_RESET_TARGET";
const RESET_TOKEN_ENV = "MATCHHAI_FULL_RESET_TOKEN";
const LEGACY_RESET_ENABLED_ENV = "MATCHHAI_ALLOW_UNPROTECTED_RESET";

const APP_TABLES_IN_DELETE_ORDER = [
  "supportAgentRateLimits",
  "supportAgentAuditLogs",
  "supportTicketNotes",
  "supportMessages",
  "supportConversations",
  "supportTickets",
  "supportKnowledgeChunks",
  "supportKnowledgeDocuments",
  "chatTypingStatus",
  "chatMessages",
  "chatroomMembers",
  "chatrooms",
  "pushTickets",
  "pushDevices",
  "notifications",
  "teamChallengeChatMembers",
  "teamChallengeChatMessages",
  "teamChallengeChats",
  "teamChallenges",
  "ratingHistory",
  "teamMembers",
  "teams",
  "matchroomMembers",
  "bookingRequests",
  "bookingIntents",
  "zoneOffers",
  "matchrooms",
  "zoneAuditEvents",
  "zoneResources",
  "pricingRules",
  "reports",
  "paymentTransactions",
  "walletTransactions",
  "phoneVerifications",
  "identityVerifications",
  "friendships",
  "userBlocks",
  "psnTokenCache",
  "superAdminAuditLogs",
  "zones",
  "users",
] as const;

const AUTH_MODELS_IN_DELETE_ORDER = [
  "session",
  "account",
  "verification",
  "twoFactor",
  "passkey",
  "oauthAccessToken",
  "oauthConsent",
  "oauthApplication",
  "rateLimit",
  "user",
] as const;

type AppTableName = (typeof APP_TABLES_IN_DELETE_ORDER)[number];

function assertAppTableName(tableName: string): asserts tableName is AppTableName {
  if (!APP_TABLES_IN_DELETE_ORDER.includes(tableName as AppTableName)) {
    throw new Error(`Refusing to wipe unknown table: ${tableName}`);
  }
}

function asStorageId(value: unknown): Id<"_storage"> | null {
  return typeof value === "string" && value.length > 0
    ? (value as Id<"_storage">)
    : null;
}

function attachmentStorageId(value: unknown): Id<"_storage"> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return asStorageId((value as Record<string, unknown>).storageId);
}

function storageIdsForDocument(
  tableName: AppTableName,
  document: Record<string, unknown>,
): Id<"_storage">[] {
  const storageIds = new Set<Id<"_storage">>();
  const add = (storageId: Id<"_storage"> | null) => {
    if (storageId) storageIds.add(storageId);
  };

  if (tableName === "users") {
    add(asStorageId(document.profileImageStorageId));
  }
  if (tableName === "teams") {
    add(asStorageId(document.logoStorageId));
  }
  if (tableName === "chatMessages" || tableName === "teamChallengeChatMessages") {
    add(asStorageId(document.audioStorageId));
    add(attachmentStorageId(document.attachment));
  }

  return [...storageIds];
}

export const deleteApplicationTableBatch = internalMutation({
  args: {
    tableName: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    assertAppTableName(args.tableName);
    const safeLimit = Math.max(1, Math.min(Math.floor(args.limit), 250));
    const documents = await ctx.db.query(args.tableName).take(safeLimit);
    let storageDeleted = 0;

    for (const document of documents) {
      for (const storageId of storageIdsForDocument(
        args.tableName,
        document as unknown as Record<string, unknown>,
      )) {
        await ctx.storage.delete(storageId);
        storageDeleted += 1;
      }
      await ctx.db.delete(document._id);
    }

    return { deleted: documents.length, storageDeleted };
  },
});

export const wipeAllData = action({
  args: {
    confirm: v.string(),
    resetToken: v.string(),
    target: v.union(v.literal("dev"), v.literal("prod")),
    includeAuth: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (getRuntimeEnv(LEGACY_RESET_ENABLED_ENV) !== "1") {
      throw new Error(
        "This unprotected reset is disabled. Use protectedDataReset:wipeAllData instead.",
      );
    }
    const resetEnabled = getRuntimeEnv(RESET_ENABLED_ENV) === "1";
    const configuredTarget = getRuntimeEnv(RESET_TARGET_ENV);
    const configuredToken = getRuntimeEnv(RESET_TOKEN_ENV);

    if (!resetEnabled) {
      throw new Error(`${RESET_ENABLED_ENV} must be set to "1" before wiping data.`);
    }
    if (configuredTarget !== args.target) {
      throw new Error(
        `${RESET_TARGET_ENV} must match the requested reset target exactly.`,
      );
    }
    if (!configuredToken || configuredToken !== args.resetToken) {
      throw new Error("The reset token is invalid for this deployment.");
    }
    if (args.confirm !== REQUIRED_CONFIRMATION) {
      throw new Error(
        `Pass confirm: "${REQUIRED_CONFIRMATION}" to perform the data wipe.`,
      );
    }
    if (!args.includeAuth) {
      throw new Error("includeAuth must be true for a complete MatchHai reset.");
    }

    const applicationDeleted: Record<string, number> = {};
    let storageDeleted = 0;

    for (const tableName of APP_TABLES_IN_DELETE_ORDER) {
      let tableDeleted = 0;
      while (true) {
        const result = await ctx.runMutation(
          internal.fullDataReset.deleteApplicationTableBatch,
          { tableName, limit: 250 },
        );
        tableDeleted += result.deleted;
        storageDeleted += result.storageDeleted;
        if (result.deleted === 0) break;
      }
      applicationDeleted[tableName] = tableDeleted;
    }

    const authDeleted: Record<string, number> = {};
    for (const model of AUTH_MODELS_IN_DELETE_ORDER) {
      let cursor: string | null = null;
      let modelDeleted = 0;
      while (true) {
        const result: {
          count: number;
          isDone: boolean;
          continueCursor: string;
        } = await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
          input: { model },
          paginationOpts: { cursor, numItems: 250 },
        });
        modelDeleted += result.count;
        if (result.isDone) break;
        if (result.count === 0) {
          throw new Error(`Auth reset made no progress while deleting ${model}.`);
        }
        cursor = result.continueCursor;
      }
      authDeleted[model] = modelDeleted;
    }

    return {
      ok: true,
      target: args.target,
      applicationDeleted,
      authDeleted,
      storageDeleted,
      preservedAuthInfrastructure: ["jwks"],
    };
  },
});
