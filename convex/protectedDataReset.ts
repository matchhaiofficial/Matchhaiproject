import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  type ActionCtx,
} from "./_generated/server";
import { getRuntimeEnv } from "./runtimeEnv";

const REQUIRED_CONFIRMATION = "WIPE_ALL_MATCHHAI_DATA";
const RESET_ENABLED_ENV = "MATCHHAI_FULL_RESET_ENABLED";
const RESET_TARGET_ENV = "MATCHHAI_FULL_RESET_TARGET";
const RESET_TOKEN_ENV = "MATCHHAI_FULL_RESET_TOKEN";

const PROTECTED_ZONES = [
  {
    name: "Nuke town",
    aliases: ["Nuke town", "Nuke Town", "Nuke Town Zone"],
  },
  { name: "Panda Gaming Zone", aliases: ["Panda Gaming Zone", "Panda Gaming"] },
  { name: "Deadshot", aliases: ["Deadshot", "Deadshot Esports Arena"] },
] as const;

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

const AUTH_MODELS_WITH_USER_ID = new Set([
  "session",
  "account",
  "twoFactor",
  "passkey",
  "oauthAccessToken",
  "oauthConsent",
  "oauthApplication",
]);

type AppTableName = (typeof APP_TABLES_IN_DELETE_ORDER)[number];
type AuthModelName = (typeof AUTH_MODELS_IN_DELETE_ORDER)[number];

type ProtectedZone = {
  protectedName: string;
  zoneId: string;
  ownerUserId: string;
  name: string;
  venueBrandName: string | null;
};

type AuthDeleteResult = {
  count: number;
  isDone: boolean;
  continueCursor: string;
};

function assertAppTableName(tableName: string): asserts tableName is AppTableName {
  if (!APP_TABLES_IN_DELETE_ORDER.includes(tableName as AppTableName)) {
    throw new Error(`Refusing to wipe unknown table: ${tableName}`);
  }
}

function normalizeZoneName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
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

  if (tableName === "users") add(asStorageId(document.profileImageStorageId));
  if (tableName === "teams") add(asStorageId(document.logoStorageId));
  if (tableName === "chatMessages" || tableName === "teamChallengeChatMessages") {
    add(asStorageId(document.audioStorageId));
    add(attachmentStorageId(document.attachment));
  }

  return [...storageIds];
}

function shouldPreserveDocument(
  tableName: AppTableName,
  document: Record<string, unknown>,
  protectedZoneIds: Set<string>,
  protectedOwnerIds: Set<string>,
): boolean {
  if (tableName === "users") {
    return protectedOwnerIds.has(String(document._id));
  }
  if (tableName === "zones") {
    return protectedZoneIds.has(String(document._id));
  }
  if (
    tableName === "pricingRules" ||
    tableName === "zoneResources" ||
    tableName === "zoneAuditEvents"
  ) {
    return protectedZoneIds.has(String(document.zoneId));
  }
  return false;
}

async function findProtectedZones(ctx: ActionCtx): Promise<ProtectedZone[]> {
  const byProtectedName = new Map<string, ProtectedZone[]>();
  let cursor: string | null = null;

  while (true) {
    const result: {
      page: Array<{
        zoneId: string;
        ownerUserId: string;
        name: string;
        venueBrandName: string | null;
      }>;
      isDone: boolean;
      continueCursor: string;
    } = await ctx.runQuery(internal.protectedDataReset.listZonesPage, {
      paginationOpts: { cursor, numItems: 250 },
    });

    for (const zone of result.page) {
      const zoneNames = new Set(
        [zone.name, zone.venueBrandName]
          .filter((name): name is string => Boolean(name))
          .map(normalizeZoneName),
      );
      for (const protectedZone of PROTECTED_ZONES) {
        const matchesProtectedZone = protectedZone.aliases.some((alias) =>
          zoneNames.has(normalizeZoneName(alias)),
        );
        if (!matchesProtectedZone) continue;
        const matchingZones = byProtectedName.get(protectedZone.name) ?? [];
        if (!matchingZones.some((candidate) => candidate.zoneId === zone.zoneId)) {
          matchingZones.push({ protectedName: protectedZone.name, ...zone });
          byProtectedName.set(protectedZone.name, matchingZones);
        }
      }
    }

    if (result.isDone) break;
    cursor = result.continueCursor;
  }

  return PROTECTED_ZONES.flatMap((zone) => byProtectedName.get(zone.name) ?? []);
}

async function deleteAuthModelBatch(
  ctx: ActionCtx,
  model: AuthModelName,
  protectedAuthUserIds: string[],
  cursor: string | null,
): Promise<AuthDeleteResult> {
  const paginationOpts = { cursor, numItems: 250 };
  if (
    protectedAuthUserIds.length === 0 ||
    (!AUTH_MODELS_WITH_USER_ID.has(model) && model !== "user")
  ) {
    return (await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: { model },
      paginationOpts,
    })) as AuthDeleteResult;
  }

  if (model === "user") {
    return (await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: {
        model: "user",
        where: [{ field: "_id", operator: "not_in", value: protectedAuthUserIds }],
      },
      paginationOpts,
    })) as AuthDeleteResult;
  }

  switch (model) {
    case "session":
    case "account":
    case "twoFactor":
    case "passkey":
    case "oauthAccessToken":
    case "oauthConsent":
    case "oauthApplication":
      return (await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: {
          model,
          where: [
            { field: "userId", operator: "not_in", value: protectedAuthUserIds },
          ],
        },
        paginationOpts,
      })) as AuthDeleteResult;
    default:
      throw new Error(`Unsupported Better Auth model: ${model}`);
  }
}

export const listZonesPage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const result = await ctx.db.query("zones").paginate(args.paginationOpts);
    return {
      page: result.page.map((zone) => ({
        zoneId: String(zone._id),
        ownerUserId: String(zone.ownerUid),
        name: zone.name,
        venueBrandName: zone.venueBrandName ?? null,
      })),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const getProtectedZoneOwnerAuthIds = internalQuery({
  args: { ownerUserIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const owners = [] as Array<{ userId: string; authId: string | null }>;
    for (const ownerUserId of args.ownerUserIds) {
      const user = await ctx.db.get(ownerUserId as Id<"users">);
      owners.push({ userId: ownerUserId, authId: user?.authId ?? null });
    }
    return owners;
  },
});

export const deleteApplicationTableBatch = internalMutation({
  args: {
    tableName: v.string(),
    protectedZoneIds: v.array(v.string()),
    protectedOwnerIds: v.array(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    assertAppTableName(args.tableName);
    const protectedZoneIds = new Set(args.protectedZoneIds);
    const protectedOwnerIds = new Set(args.protectedOwnerIds);
    const result = await ctx.db.query(args.tableName).paginate({
      cursor: args.paginationOpts.cursor,
      numItems: Math.max(1, Math.min(Math.floor(args.paginationOpts.numItems), 250)),
    });
    let deleted = 0;
    let preserved = 0;
    let storageDeleted = 0;

    for (const document of result.page) {
      const documentRecord = document as unknown as Record<string, unknown>;
      if (
        shouldPreserveDocument(
          args.tableName,
          documentRecord,
          protectedZoneIds,
          protectedOwnerIds,
        )
      ) {
        preserved += 1;
        continue;
      }

      for (const storageId of storageIdsForDocument(args.tableName, documentRecord)) {
        await ctx.storage.delete(storageId);
        storageDeleted += 1;
      }
      await ctx.db.delete(document._id);
      deleted += 1;
    }

    return {
      deleted,
      preserved,
      storageDeleted,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const resetProtectedZoneResourcesPage = internalMutation({
  args: {
    zoneId: v.id("zones"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("zoneResources")
      .withIndex("by_zoneId", (query) => query.eq("zoneId", args.zoneId))
      .paginate(args.paginationOpts);
    const now = Date.now();

    for (const resource of result.page) {
      await ctx.db.patch(resource._id, {
        lifecycleStatus: "available",
        bookingRequestId: undefined,
        matchroomId: undefined,
        bookedAt: undefined,
        bookedByUid: undefined,
        updatedAt: now,
      });
    }

    return {
      reset: result.page.length,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
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
    if (getRuntimeEnv(RESET_ENABLED_ENV) !== "1") {
      throw new Error(`${RESET_ENABLED_ENV} must be set to "1" before wiping data.`);
    }
    if (getRuntimeEnv(RESET_TARGET_ENV) !== args.target) {
      throw new Error(`${RESET_TARGET_ENV} must match the requested reset target exactly.`);
    }
    if (getRuntimeEnv(RESET_TOKEN_ENV) !== args.resetToken) {
      throw new Error("The reset token is invalid for this deployment.");
    }
    if (args.confirm !== REQUIRED_CONFIRMATION) {
      throw new Error(`Pass confirm: "${REQUIRED_CONFIRMATION}" to perform the data wipe.`);
    }
    if (!args.includeAuth) {
      throw new Error("includeAuth must be true for a complete MatchHai reset.");
    }

    const protectedZones = await findProtectedZones(ctx);
    const zonesByName = new Map<string, ProtectedZone[]>();
    for (const zone of protectedZones) {
      const matchingZones = zonesByName.get(zone.protectedName) ?? [];
      matchingZones.push(zone);
      zonesByName.set(zone.protectedName, matchingZones);
    }
    const missingProtectedZones = PROTECTED_ZONES.filter(
      (zone) => (zonesByName.get(zone.name)?.length ?? 0) === 0,
    ).map((zone) => zone.name);
    const duplicatedProtectedZones = PROTECTED_ZONES.filter(
      (zone) => (zonesByName.get(zone.name)?.length ?? 0) > 1,
    ).map((zone) => zone.name);
    const hasRequiredProtectedZones =
      args.target === "prod" ? missingProtectedZones.length === 0 : protectedZones.length > 0;
    if (!hasRequiredProtectedZones || duplicatedProtectedZones.length > 0) {
      throw new Error(
        `Reset aborted. ${
          args.target === "prod"
            ? "Production requires exactly one of each protected zone."
            : "Dev requires at least one protected zone to be found."
        } Missing: ${missingProtectedZones.join(", ") || "none"}. Duplicates: ${duplicatedProtectedZones.join(", ") || "none"}.`,
      );
    }

    const protectedZoneIds = [...new Set(protectedZones.map((zone) => zone.zoneId))];
    const protectedOwnerIds = [
      ...new Set(protectedZones.map((zone) => zone.ownerUserId)),
    ];
    const protectedOwners: Array<{ userId: string; authId: string | null }> =
      await ctx.runQuery(internal.protectedDataReset.getProtectedZoneOwnerAuthIds, {
        ownerUserIds: protectedOwnerIds,
      });
    if (protectedOwners.some((owner) => !owner.authId)) {
      throw new Error(
        "Reset aborted because a protected zone owner is missing its Better Auth identity.",
      );
    }
    const protectedAuthUserIds = protectedOwners.flatMap((owner) =>
      owner.authId ? [owner.authId] : [],
    );

    const applicationDeleted: Record<string, number> = {};
    const applicationPreserved: Record<string, number> = {};
    let storageDeleted = 0;

    for (const tableName of APP_TABLES_IN_DELETE_ORDER) {
      let tableDeleted = 0;
      let tablePreserved = 0;
      let cursor: string | null = null;
      while (true) {
        const result: {
          deleted: number;
          preserved: number;
          storageDeleted: number;
          isDone: boolean;
          continueCursor: string;
        } = await ctx.runMutation(
          internal.protectedDataReset.deleteApplicationTableBatch,
          {
            tableName,
            protectedZoneIds,
            protectedOwnerIds,
            paginationOpts: { cursor, numItems: 250 },
          },
        );
        tableDeleted += result.deleted;
        tablePreserved += result.preserved;
        storageDeleted += result.storageDeleted;
        if (result.isDone) break;
        cursor = result.continueCursor;
      }
      applicationDeleted[tableName] = tableDeleted;
      applicationPreserved[tableName] = tablePreserved;
    }

    let protectedResourcesReset = 0;
    for (const zoneId of protectedZoneIds) {
      let cursor: string | null = null;
      while (true) {
        const result: {
          reset: number;
          isDone: boolean;
          continueCursor: string;
        } = await ctx.runMutation(
          internal.protectedDataReset.resetProtectedZoneResourcesPage,
          {
            zoneId: zoneId as Id<"zones">,
            paginationOpts: { cursor, numItems: 250 },
          },
        );
        protectedResourcesReset += result.reset;
        if (result.isDone) break;
        cursor = result.continueCursor;
      }
    }

    const authDeleted: Record<string, number> = {};
    for (const model of AUTH_MODELS_IN_DELETE_ORDER) {
      let cursor: string | null = null;
      let modelDeleted = 0;
      while (true) {
        const result = await deleteAuthModelBatch(
          ctx,
          model,
          protectedAuthUserIds,
          cursor,
        );
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
      applicationPreserved,
      authDeleted,
      storageDeleted,
      protectedZones: protectedZones.map((zone) => ({
        name: zone.protectedName,
        zoneId: zone.zoneId,
        ownerUserId: zone.ownerUserId,
      })),
      protectedResourcesReset,
      preservedAuthInfrastructure: ["jwks"],
    };
  },
});
