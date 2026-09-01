import { v } from "convex/values";

import { authComponent } from "./auth";
import { api, internal } from "./_generated/api";
import { mutation, query, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { KYC_VERIFICATION_REQUIRED_MESSAGE, assertKycAccessAllowed } from "./kycGate";
import { listSuperAdminNotificationRecipients } from "./superAdminAccess";
import {
  CHALLENGE_ABANDON_TTL_MS,
  CHALLENGE_ACCEPT_TTL_MS,
  getTeamChallengeLifecycleDueAt,
  withTeamChallengeLifecycleDueAt,
} from "./maintenanceDue";
import { isMaintenanceJobEnabled, isRuntimeFlagEnabled } from "./runtimeEnv";

const venueChoiceValidator = v.object({
  zoneId: v.string(),
  venueName: v.string(),
  areaLabel: v.optional(v.union(v.string(), v.null())),
});

const challengeStatuses = new Set([
  "pending",
  "accepted",
  "venue_proposed",
  "venue_confirmed",
  "admin_pending",
  "completed",
  "rejected",
  "expired",
]);

async function patchTeamChallengeWithLifecycleDueAt(
  ctx: any,
  challenge: any,
  patch: Record<string, any>,
  now = Date.now(),
) {
  const lifecyclePatch = withTeamChallengeLifecycleDueAt(challenge, patch, now);
  await ctx.db.patch(challenge._id, lifecyclePatch);
}

const TEAM_CHALLENGE_MIN_SCHEDULE_DAYS = 2;
const TEAM_CHALLENGE_MAX_SCHEDULE_MONTHS = 2;
const TEAM_CHALLENGE_MIN_SCHEDULE_MS = TEAM_CHALLENGE_MIN_SCHEDULE_DAYS * 24 * 60 * 60 * 1000;

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function validateTeamChallengeScheduledAt(scheduledAt: unknown, nowMs = Date.now()) {
  if (typeof scheduledAt !== "number" || !Number.isFinite(scheduledAt)) {
    throw new Error("Invalid challenge date/time.");
  }

  const now = new Date(nowMs);
  const minAt = nowMs + TEAM_CHALLENGE_MIN_SCHEDULE_MS;
  const maxAt = addMonths(now, TEAM_CHALLENGE_MAX_SCHEDULE_MONTHS).getTime();

  if (scheduledAt < minAt) {
    throw new Error("Team challenges must be scheduled at least 2 days in advance.");
  }
  if (scheduledAt > maxAt) {
    throw new Error("Team challenges cannot be scheduled more than 2 months in advance.");
  }
}

async function resolveUserByAnyId(ctx: any, value?: string | null) {
  if (!value) return null;

  try {
    const directUser = await ctx.db.get(value as Id<"users">);
    if (directUser) return directUser;
  } catch {
    // Not a Convex document id; fall through to authId lookup.
  }

  return await ctx.db
    .query("users")
    .withIndex("by_authId", (q: any) => q.eq("authId", value))
    .unique();
}

async function getAuthenticatedUserId(ctx: any, expectedUid?: string | null): Promise<Id<"users">> {
  let authUser: Awaited<ReturnType<typeof authComponent.getAuthUser>> | null = null;
  try {
    authUser = await authComponent.getAuthUser(ctx);
  } catch {
    authUser = null;
  }

  const authRecordId = typeof authUser?._id === "string" ? authUser._id : null;
  const linkedAppUserId = typeof authUser?.userId === "string" ? authUser.userId : null;
  const expectedUser = await resolveUserByAnyId(ctx, expectedUid);

  console.log("[teamChallenges] auth gate", {
    authId: authRecordId,
    linkedAppUserId,
    email: authUser?.email ?? null,
    expectedUid: expectedUid ?? null,
    expectedAuthId: expectedUser?.authId ?? null,
  });

  if (linkedAppUserId || authRecordId) {
    const user = await resolveUserByAnyId(ctx, linkedAppUserId) || await resolveUserByAnyId(ctx, authRecordId);
    if (!user) {
      throw new Error("User profile not found");
    }
    assertKycAccessAllowed(user, KYC_VERIFICATION_REQUIRED_MESSAGE);
    if (expectedUser && String(expectedUser._id) !== String(user._id)) {
      throw new Error("You can only perform this action for your own account");
    }
    return user._id;
  }

  if (expectedUser) {
    assertKycAccessAllowed(expectedUser, KYC_VERIFICATION_REQUIRED_MESSAGE);
    return expectedUser._id;
  }

  throw new Error("Not authenticated");
}

async function requireChallenge(ctx: any, challengeId: Id<"teamChallenges">) {
  const challenge = await ctx.db.get(challengeId);
  if (!challenge) {
    throw new Error("Challenge not found");
  }
  return challenge;
}

function isCaptain(challenge: any, userId: Id<"users">) {
  return challenge.captainAUid === userId || challenge.captainBUid === userId;
}

async function requireCaptain(ctx: any, challengeId: Id<"teamChallenges">, expectedUid?: string | null) {
  const userId = await getAuthenticatedUserId(ctx, expectedUid);
  const challenge = await requireChallenge(ctx, challengeId);
  if (!isCaptain(challenge, userId)) {
    throw new Error("Only captains can update this challenge");
  }
  return { challenge, userId };
}

function buildCaptainChoices(challenge: any, updates: Record<string, any>) {
  return {
    ...(challenge.captainVenueChoices || {}),
    ...updates,
  };
}

function toChallengeRoute(challengeId: Id<"teamChallenges">) {
  return `/teams/challenge?id=${String(challengeId)}`;
}

async function createChallengeNotification(
  ctx: any,
  args: {
    type: string;
    toUid: Id<"users">;
    fromUid: Id<"users">;
    fromUsername: string;
    challengeId: Id<"teamChallenges">;
    dedupeKey: string;
    dedupePolicy: "upsert_active" | "replace_active" | "versioned_new";
    title: string;
    body: string;
    updateKind?: string;
    extraData?: Record<string, any>;
  }
) {
  return await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
    type: args.type,
    toUid: args.toUid,
    fromUid: args.fromUid,
    fromUsername: args.fromUsername,
    dedupeKey: args.dedupeKey,
    dedupePolicy: args.dedupePolicy,
    route: toChallengeRoute(args.challengeId),
    title: args.title,
    body: args.body,
    data: {
      challengeId: String(args.challengeId),
      updateKind: args.updateKind,
      href: toChallengeRoute(args.challengeId),
      ...args.extraData,
    },
  });
}

async function refundChallengerPaymentForRejectedChallenge(ctx: any, challengeId: Id<"teamChallenges">, challenge: any) {
  if (challenge.teamAPaymentStatus !== "paid") {
    return { refunded: false, amount: 0, created: false };
  }

  const captainAUid = challenge.captainAUid as Id<"users"> | undefined;
  if (!captainAUid) {
    return { refunded: false, amount: 0, created: false };
  }

  const walletTransactions = await ctx.db
    .query("walletTransactions")
    .withIndex("by_userId", (q: any) => q.eq("userId", captainAUid))
    .collect();

  const challengeCreatedAt = Number(challenge.createdAt || 0);
  const sourcePayment = walletTransactions
    .filter((transaction: any) => {
      if (transaction.type !== "withdrawal") return false;
      if (transaction.status !== "completed") return false;
      const metadata = transaction.metadata || {};
      if (metadata.flow !== "team_challenge" || metadata.side !== "teamA") return false;
      if (String(metadata.challengeId || "") === String(challengeId)) return true;
      const reference = String(transaction.reference || "");
      if (!reference.startsWith(`team_challenge:create:${String(challenge.challengerTeamId)}:`)) return false;
      const transactionCreatedAt = Number(transaction.createdAt || 0);
      return !challengeCreatedAt || (
        transactionCreatedAt >= challengeCreatedAt - 10 * 60 * 1000 &&
        transactionCreatedAt <= challengeCreatedAt + 60 * 1000
      );
    })
    .sort((a: any, b: any) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0];

  const amount = Math.ceil(Number(challenge.teamAPaymentAmount || sourcePayment?.amount || 0));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { refunded: false, amount: 0, created: false };
  }

  const refundReference = `team_challenge_refund:${String(challengeId)}:teamA`;
  const existingRefund = await ctx.db
    .query("walletTransactions")
      .withIndex("by_reference", (q: any) => q.eq("reference", refundReference))
      .unique();
  if (existingRefund) {
    return { refunded: true, amount: Number(existingRefund.amount || amount), created: false };
  }

  const captainA = await ctx.db.get(captainAUid);
  if (!captainA) {
    return { refunded: false, amount: 0, created: false };
  }

  const now = Date.now();
  await ctx.db.patch(captainAUid, {
    walletBalance: Number(captainA.walletBalance || 0) + amount,
    updatedAt: now,
  });

  await ctx.db.insert("walletTransactions", {
    userId: captainAUid,
    type: "refund",
    amount,
    status: "completed",
    reference: refundReference,
    metadata: {
      flow: "team_challenge",
      reason: "challenge_rejected",
      challengeId: String(challengeId),
      challengerTeamId: String(challenge.challengerTeamId || ""),
      opponentTeamId: String(challenge.opponentTeamId || ""),
      originalTransactionId: sourcePayment?._id ? String(sourcePayment._id) : null,
      originalReference: sourcePayment?.reference || null,
      originalPaymentStatus: challenge.teamAPaymentStatus || null,
    },
    createdAt: now,
  });

  return { refunded: true, amount, created: true };
}

// Get challenge by ID
export const getById = query({
  args: { challengeId: v.id("teamChallenges"), actorUid: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx, args.actorUid);
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) return null;
    if (!isCaptain(challenge, userId)) {
      return null;
    }
    return challenge;
  },
});

// Get challenge with teams
export const getWithTeams = query({
  args: { challengeId: v.id("teamChallenges"), actorUid: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx, args.actorUid);
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge || !isCaptain(challenge, userId)) return null;

    const challengerTeam = await ctx.db.get(challenge.challengerTeamId);
    const opponentTeam = await ctx.db.get(challenge.opponentTeamId);

    return {
      ...challenge,
      challengerTeam,
      opponentTeam,
    };
  },
});

export const listByChallengerTeam = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const team = await ctx.db.get(args.teamId);
    if (!team || team.captainUid !== userId) return [];
    return await ctx.db
      .query("teamChallenges")
      .withIndex("by_challengerTeamId", (q) => q.eq("challengerTeamId", args.teamId))
      .order("desc")
      .collect();
  },
});

export const listByOpponentTeam = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const team = await ctx.db.get(args.teamId);
    if (!team || team.captainUid !== userId) return [];
    return await ctx.db
      .query("teamChallenges")
      .withIndex("by_opponentTeamId", (q) => q.eq("opponentTeamId", args.teamId))
      .order("desc")
      .collect();
  },
});

export const listForTeam = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const team = await ctx.db.get(args.teamId);
    if (!team || team.captainUid !== userId) return [];

    const asChallenger = await ctx.db
      .query("teamChallenges")
      .withIndex("by_challengerTeamId", (q) => q.eq("challengerTeamId", args.teamId))
      .collect();
    const asOpponent = await ctx.db
      .query("teamChallenges")
      .withIndex("by_opponentTeamId", (q) => q.eq("opponentTeamId", args.teamId))
      .collect();

    return [...asChallenger, ...asOpponent].sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const listPendingForTeam = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const team = await ctx.db.get(args.teamId);
    if (!team || team.captainUid !== userId) return [];

    const challenges = await ctx.db
      .query("teamChallenges")
      .withIndex("by_opponentTeamId", (q) => q.eq("opponentTeamId", args.teamId))
      .collect();

    return challenges.filter((challenge) => challenge.status === "pending");
  },
});

export const getPendingForOpponentByCaptain = query({
  args: {
    opponentTeamId: v.id("teams"),
    actorUid: v.optional(v.id("users")),
    challengerTeamId: v.optional(v.id("teams")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx, args.actorUid);
    const challengerTeams = args.challengerTeamId
      ? [await ctx.db.get(args.challengerTeamId)]
      : await ctx.db
          .query("teams")
          .withIndex("by_captainUid", (q) => q.eq("captainUid", userId))
          .collect();
    const challengerTeamIds = new Set(
      challengerTeams
        .filter((team: any) => team && team.captainUid === userId)
        .map((team: any) => String(team._id)),
    );
    if (challengerTeamIds.size === 0) return null;

    const challenges = await ctx.db
      .query("teamChallenges")
      .withIndex("by_opponentTeamId", (q) => q.eq("opponentTeamId", args.opponentTeamId))
      .collect();
    const pending = challenges
      .filter((challenge: any) => challenge.status === "pending")
      .filter((challenge: any) => String(challenge.captainAUid || "") === String(userId))
      .filter((challenge: any) => challengerTeamIds.has(String(challenge.challengerTeamId)))
      .sort((a: any, b: any) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0];
    if (!pending) return null;

    return {
      challengeId: pending._id,
      challengerTeamId: pending.challengerTeamId,
      opponentTeamId: pending.opponentTeamId,
      status: pending.status,
    };
  },
});

export const create = mutation({
  args: {
    challengerTeamId: v.id("teams"),
    challengerTeamName: v.optional(v.string()),
    opponentTeamId: v.id("teams"),
    opponentTeamName: v.optional(v.string()),
    game: v.string(),
    message: v.optional(v.string()),
  },
  handler: async () => {
    throw new Error("Deprecated Team Challenge lifecycle endpoint is disabled.");
  },
});

export const respond = mutation({
  args: {
    challengeId: v.id("teamChallenges"),
    accept: v.boolean(),
    lineupB: v.optional(v.array(v.string())),
    teamBPaymentStatus: v.optional(v.union(v.literal("unpaid"), v.literal("pending"), v.literal("paid"))),
    teamBPaymentAmount: v.optional(v.number()),
    actorUid: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { challenge, userId } = await requireCaptain(ctx, args.challengeId, args.actorUid);
    if (challenge.status !== "pending") {
      if (!args.accept && challenge.status === "rejected") {
        // New captain-paid model: return any held captain funds to wallets.
        await releaseChallengeHolds(ctx, args.challengeId, "challenge_rejected");
        const refundResult = await refundChallengerPaymentForRejectedChallenge(ctx, args.challengeId, challenge);
        if (refundResult.refunded && challenge.teamAPaymentStatus === "paid") {
          await ctx.db.patch(args.challengeId, {
            teamAPaymentStatus: "unpaid",
            updatedAt: Date.now(),
          });
        }
        return { ok: true, status: "rejected", chatId: challenge.chatId, refund: refundResult };
      }
      throw new Error("Challenge is not pending");
    }

    if (args.accept && challenge.captainBUid && challenge.captainBUid !== userId) {
      throw new Error("Only the challenged captain can accept at this stage");
    }

    const nextStatus = args.accept ? "accepted" : "rejected";
    const chatId = args.accept ? challenge.chatId || String(args.challengeId) : challenge.chatId;
    if (!args.accept) {
      // New captain-paid model: Team B declined → return Team A captain's held
      // funds (and any Team B hold) to their wallets.
      await releaseChallengeHolds(ctx, args.challengeId, "challenge_rejected");
    }
    const refundResult = args.accept
      ? { refunded: false, amount: 0 }
      : await refundChallengerPaymentForRejectedChallenge(ctx, args.challengeId, challenge);

    await patchTeamChallengeWithLifecycleDueAt(ctx, challenge, {
      status: nextStatus,
      chatId,
      lineupB: args.accept ? args.lineupB || challenge.lineupB : challenge.lineupB,
      teamAPaymentStatus: !args.accept && refundResult.refunded ? "unpaid" : challenge.teamAPaymentStatus,
      // Team Challenge paid flow is disabled for launch: never trust a
      // client-asserted "paid" status and never persist a payment amount.
      // (Previously this defaulted to "paid" even when the arg was omitted.)
      teamBPaymentStatus: args.accept ? "unpaid" : challenge.teamBPaymentStatus,
      teamBPaymentAmount: args.accept ? undefined : challenge.teamBPaymentAmount,
      updatedAt: Date.now(),
    });

    const recipientUid = challenge.captainAUid === userId ? challenge.captainBUid : challenge.captainAUid;
    const senderName =
      challenge.captainAUid === userId ? challenge.captainAName : challenge.captainBName;

    if (recipientUid) {
      await createChallengeNotification(ctx, {
        type: "team.challenge_updated",
        toUid: recipientUid,
        fromUid: userId,
        fromUsername: senderName || "Captain",
        challengeId: args.challengeId,
        dedupeKey: `team.challenge_updated:${String(args.challengeId)}:${String(recipientUid)}:${nextStatus}`,
        dedupePolicy: "versioned_new",
        title: args.accept ? "Challenge accepted" : "Challenge declined",
        body: args.accept
          ? `${challenge.opponentTeamName || "Opponent"} accepted the team challenge.`
          : refundResult.refunded && recipientUid === challenge.captainAUid
            ? `${challenge.opponentTeamName || "Opponent"} declined the team challenge. PKR ${refundResult.amount} was refunded to your wallet.`
            : `${challenge.opponentTeamName || "Opponent"} declined the team challenge.`,
        updateKind: nextStatus,
        extraData: !args.accept && refundResult.refunded
          ? {
              refundAmount: refundResult.amount,
              refundReference: `team_challenge_refund:${String(args.challengeId)}:teamA`,
            }
          : undefined,
      });
    }

    if (args.accept) {
      const freshChallenge = await ctx.db.get(args.challengeId);
      await notifyChallengePaymentRequired(ctx, freshChallenge || challenge, "teamB", "challenge_accepted");
    }

    return { ok: true, status: nextStatus, chatId };
  },
});

export const repairRejectedRefundsForCaptain = mutation({
  args: { actorUid: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx, args.actorUid);
    const rejectedChallenges = await ctx.db
      .query("teamChallenges")
      .withIndex("by_status", (q) => q.eq("status", "rejected"))
      .collect();

    let repairedCount = 0;
    let creditedAmount = 0;

    for (const challenge of rejectedChallenges) {
      if (String(challenge.captainAUid || "") !== String(userId)) continue;
      if (challenge.teamAPaymentStatus !== "paid") continue;

      const refundResult = await refundChallengerPaymentForRejectedChallenge(ctx, challenge._id, challenge);
      if (!refundResult.refunded) continue;

      await ctx.db.patch(challenge._id, {
        teamAPaymentStatus: "unpaid",
        updatedAt: Date.now(),
      });

      repairedCount += 1;
      if (refundResult.created) {
        creditedAmount += refundResult.amount;
      }
    }

    return { ok: true, repairedCount, creditedAmount };
  },
});

export const proposeVenue = mutation({
  args: {
    challengeId: v.id("teamChallenges"),
    zoneId: v.id("zones"),
    zoneName: v.optional(v.string()),
    areaLabel: v.optional(v.union(v.string(), v.null())),
    actorUid: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { challenge, userId } = await requireCaptain(ctx, args.challengeId, args.actorUid);
    if (!["accepted", "venue_proposed", "venue_confirmed"].includes(challenge.status)) {
      throw new Error("Challenge is not in venue proposal state");
    }

    const zone = await ctx.db.get(args.zoneId);
    const venue = {
      zoneId: String(args.zoneId),
      venueName: args.zoneName || zone?.name || "Zone",
      areaLabel: args.areaLabel ?? null,
    };

    const isCaptainAActor = challenge.captainAUid === userId;
    const captainVenueChoices = buildCaptainChoices(challenge, {
      [String(userId)]: venue,
    });
    const captainAChoice = isCaptainAActor ? venue : captainVenueChoices[String(challenge.captainAUid)];
    const captainBChoice = !isCaptainAActor ? venue : captainVenueChoices[String(challenge.captainBUid)];
    const bothConfirmed =
      captainAChoice &&
      captainBChoice &&
      captainAChoice.zoneId === captainBChoice.zoneId;

    await patchTeamChallengeWithLifecycleDueAt(ctx, challenge, {
      status: bothConfirmed ? "venue_confirmed" : "venue_proposed",
      zoneId: bothConfirmed ? args.zoneId : undefined,
      zoneName: bothConfirmed ? venue.venueName : undefined,
      proposedVenueByCaptainA: isCaptainAActor ? venue : challenge.proposedVenueByCaptainA,
      alternativeVenueByCaptainB: !isCaptainAActor ? venue : challenge.alternativeVenueByCaptainB,
      captainVenueChoices,
      confirmedVenue: bothConfirmed ? venue : challenge.confirmedVenue,
      updatedAt: Date.now(),
    });

    const recipientUid = challenge.captainAUid === userId ? challenge.captainBUid : challenge.captainAUid;
    const senderName =
      challenge.captainAUid === userId ? challenge.captainAName : challenge.captainBName;

    if (recipientUid) {
      await createChallengeNotification(ctx, {
        type: "team.challenge_updated",
        toUid: recipientUid,
        fromUid: userId,
        fromUsername: senderName || "Captain",
        challengeId: args.challengeId,
        dedupeKey: `team.challenge_updated:${String(args.challengeId)}:${String(recipientUid)}:${bothConfirmed ? "venue_confirmed" : "venue_proposed"}`,
        dedupePolicy: "versioned_new",
        title: bothConfirmed ? "Venue confirmed" : "Alternative zone proposed",
        body: bothConfirmed
          ? `${venue.venueName} has been confirmed for the team challenge.`
          : `${venue.venueName} was proposed for the team challenge.`,
        updateKind: bothConfirmed ? "venue_confirmed" : "venue_proposed",
        extraData: {
          proposedVenueByCaptainA: isCaptainAActor ? venue : challenge.proposedVenueByCaptainA,
          alternativeVenueByCaptainB: !isCaptainAActor ? venue : challenge.alternativeVenueByCaptainB,
          confirmedVenue: bothConfirmed ? venue : undefined,
        },
      });
    }

    if (bothConfirmed) {
      // If both captains have already paid, this confirmation is the last gate
      // before the linked matchroom is created + sent to the zone admin.
      const latest = await ctx.db.get(args.challengeId);
      await maybeFinalizeChallengeBooking(ctx, latest);
    }

    return {
      ok: true,
      confirmedVenue: bothConfirmed ? venue : null,
      status: bothConfirmed ? "venue_confirmed" : "venue_proposed",
    };
  },
});

export const confirmVenue = mutation({
  args: { challengeId: v.id("teamChallenges"), actorUid: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const { challenge } = await requireCaptain(ctx, args.challengeId, args.actorUid);
    if (!challenge.confirmedVenue) {
      throw new Error("No confirmed venue to finalize");
    }

    await patchTeamChallengeWithLifecycleDueAt(ctx, challenge, {
      status: "venue_confirmed",
      zoneName: challenge.confirmedVenue.venueName,
      updatedAt: Date.now(),
    });

    const latest = await ctx.db.get(args.challengeId);
    await maybeFinalizeChallengeBooking(ctx, latest);

    return true;
  },
});

export const complete = mutation({
  args: {
    challengeId: v.id("teamChallenges"),
    winnerId: v.id("teams"),
    score: v.optional(v.string()),
    actorUid: v.optional(v.id("users")),
  },
  handler: async () => {
    throw new Error("Deprecated Team Challenge lifecycle endpoint is disabled.");
  },
});

export const cancel = mutation({
  args: { challengeId: v.id("teamChallenges"), actorUid: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const { challenge, userId } = await requireCaptain(ctx, args.challengeId, args.actorUid);
    if (challenge.captainAUid !== userId) {
      throw new Error("Only the challenging captain can cancel");
    }
    // Return any held captain funds to their wallets BEFORE removing the row, so
    // escrowed money is never stranded by the delete.
    await releaseChallengeHolds(ctx, args.challengeId, "challenge_cancelled");
    await ctx.db.delete(args.challengeId);
    return true;
  },
});

export const createFull = mutation({
  args: {
    challengerTeamId: v.id("teams"),
    challengerTeamName: v.string(),
    opponentTeamId: v.id("teams"),
    opponentTeamName: v.string(),
    game: v.string(),
    status: v.string(),
    message: v.optional(v.string()),
    captainAUid: v.id("users"),
    captainAName: v.string(),
    captainBUid: v.id("users"),
    captainBName: v.string(),
    gameKey: v.string(),
    format: v.optional(v.union(v.string(), v.null())),
    seriesType: v.optional(v.union(v.string(), v.null())),
    maxPlayers: v.number(),
    scheduledDate: v.optional(v.string()),
    scheduledTime: v.optional(v.string()),
    scheduledAt: v.optional(v.number()),
    pricePerPlayer: v.optional(v.number()),
    zoneRateKey: v.optional(v.string()),
    zoneRateLabel: v.optional(v.string()),
    zoneRatePrice: v.optional(v.number()),
    teamAPaymentStatus: v.optional(v.union(v.literal("unpaid"), v.literal("pending"), v.literal("paid"))),
    teamBPaymentStatus: v.optional(v.union(v.literal("unpaid"), v.literal("pending"), v.literal("paid"))),
    teamAPaymentAmount: v.optional(v.number()),
    teamBPaymentAmount: v.optional(v.number()),
    proposedVenueByCaptainA: v.optional(venueChoiceValidator),
    alternativeVenueByCaptainB: v.optional(venueChoiceValidator),
    commonAreas: v.optional(v.array(v.string())),
    adminReviewStatus: v.optional(
      v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"), v.null())
    ),
    lineupA: v.optional(v.array(v.string())),
    lineupB: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    if (!challengeStatuses.has(args.status)) {
      throw new Error("Unsupported challenge status");
    }

    const challenger = await ctx.db.get(args.challengerTeamId);
    const opponent = await ctx.db.get(args.opponentTeamId);
    if (!challenger || !opponent) {
      throw new Error("Team not found");
    }

    let actorId: Id<"users"> = args.captainAUid;
    try {
      actorId = await getAuthenticatedUserId(ctx, args.captainAUid);
    } catch (error) {
      console.warn("[teamChallenges] createFull auth context unavailable; validating via captain ids", {
        captainAUid: String(args.captainAUid),
        challengerCaptainUid: String(challenger.captainUid),
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (String(actorId) !== String(args.captainAUid)) {
      throw new Error("Only the challenging captain can create this challenge");
    }
    if (challenger.captainUid !== actorId) {
      throw new Error("Only the challenging captain can create this challenge");
    }
    if (opponent.captainUid !== args.captainBUid) {
      throw new Error("Opponent captain does not match this challenge");
    }

    // Team Challenge paid flow is disabled for launch. The server NEVER trusts a
    // client-asserted payment status and NEVER persists payment amounts, so a
    // crafted client cannot create a "paid" challenge or imply money was
    // collected. Challenges are stored free/social-only until the safe
    // hold/escrow model is rebuilt (see TEMP_MATCHHAI_PAYMENT_HOLD_WALLET_CREDIT_POLICY.md).
    const safeTeamAPaymentStatus = "unpaid" as const;
    const safeTeamBPaymentStatus = "unpaid" as const;

    const now = Date.now();
    const scheduledAt = typeof args.scheduledAt === "number" ? args.scheduledAt : undefined;
    validateTeamChallengeScheduledAt(scheduledAt, now);

    // Prevent spamming the same opponent team with duplicate pending challenges until the proposed time passes.
    if (args.status === "pending" && scheduledAt && scheduledAt > now) {
      const existing = await ctx.db
        .query("teamChallenges")
        .withIndex("by_challengerTeamId", (q) => q.eq("challengerTeamId", args.challengerTeamId))
        .filter((q) =>
          q.and(
            q.eq(q.field("opponentTeamId"), args.opponentTeamId),
            q.eq(q.field("status"), "pending"),
          ),
        )
        .collect();

      const active = existing.find((row: any) => typeof row?.scheduledAt === "number" && row.scheduledAt > now);
      if (active) {
        throw new Error("You already have a pending challenge for this team. Wait until the scheduled time passes before challenging again.");
      }
    }

    const challengeDocument = {
      challengerTeamId: args.challengerTeamId,
      challengerTeamName: args.challengerTeamName,
      opponentTeamId: args.opponentTeamId,
      opponentTeamName: args.opponentTeamName,
      game: args.game,
      gameKey: args.gameKey,
      status: args.status as any,
      message: args.message,
      captainAUid: args.captainAUid,
      captainAName: args.captainAName,
      captainBUid: args.captainBUid,
      captainBName: args.captainBName,
      format: args.format ?? undefined,
      seriesType: args.seriesType ?? undefined,
      maxPlayers: args.maxPlayers,
      scheduledDate: args.scheduledDate,
      scheduledTime: args.scheduledTime,
      scheduledAt,
      pricePerPlayer: args.pricePerPlayer,
      zoneRateKey: args.zoneRateKey,
      zoneRateLabel: args.zoneRateLabel,
      zoneRatePrice: args.zoneRatePrice,
      teamAPaymentStatus: safeTeamAPaymentStatus,
      teamBPaymentStatus: safeTeamBPaymentStatus,
      teamAPaymentAmount: undefined,
      teamBPaymentAmount: undefined,
      proposedVenueByCaptainA: args.proposedVenueByCaptainA,
      alternativeVenueByCaptainB: args.alternativeVenueByCaptainB,
      captainVenueChoices: args.proposedVenueByCaptainA
        ? {
            [String(args.captainAUid)]: args.proposedVenueByCaptainA,
          }
        : undefined,
      commonAreas: args.commonAreas || [],
      adminReviewStatus: args.adminReviewStatus ?? null,
      lineupA: args.lineupA,
      lineupB: args.lineupB,
      createdAt: now,
      updatedAt: now,
    };
    const challengeId = await ctx.db.insert(
      "teamChallenges",
      withTeamChallengeLifecycleDueAt(null, challengeDocument, now),
    );

    await createChallengeNotification(ctx, {
      type: "team.challenge_received",
      toUid: args.captainBUid,
      fromUid: args.captainAUid,
      fromUsername: args.captainAName || "Captain",
      challengeId,
      dedupeKey: `team.challenge_received:${String(challengeId)}:${String(args.captainBUid)}`,
      dedupePolicy: "upsert_active",
      title: "New team challenge",
      body: `${args.challengerTeamName} challenged ${args.opponentTeamName || "your team"}`,
      extraData: {
        challengerTeamId: String(args.challengerTeamId),
        challengerTeamName: args.challengerTeamName,
        opponentTeamId: String(args.opponentTeamId),
        opponentTeamName: args.opponentTeamName,
        gameKey: args.gameKey,
        scheduledDate: args.scheduledDate,
        scheduledTime: args.scheduledTime,
        scheduledAt,
        pricePerPlayer: args.pricePerPlayer,
        zoneRateLabel: args.zoneRateLabel,
        teamAPaymentStatus: safeTeamAPaymentStatus,
        teamBPaymentStatus: safeTeamBPaymentStatus,
        seriesType: args.seriesType ?? null,
        proposedVenueByCaptainA: args.proposedVenueByCaptainA,
      },
    });

    const freshChallenge = await ctx.db.get(challengeId);
    await notifyChallengePaymentRequired(ctx, freshChallenge || { _id: challengeId, ...args }, "teamA", "challenge_created");

    return challengeId;
  },
});

export const update = mutation({
  args: {
    challengeId: v.id("teamChallenges"),
    status: v.optional(v.string()),
    zoneId: v.optional(v.id("zones")),
    zoneName: v.optional(v.string()),
    scheduledAt: v.optional(v.number()),
    message: v.optional(v.string()),
    adminReviewStatus: v.optional(
      v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"), v.null())
    ),
    proposedVenueByCaptainA: v.optional(venueChoiceValidator),
    alternativeVenueByCaptainB: v.optional(venueChoiceValidator),
    confirmedVenue: v.optional(venueChoiceValidator),
    chatId: v.optional(v.string()),
    matchroomId: v.optional(v.id("matchrooms")),
    actorUid: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { challenge } = await requireCaptain(ctx, args.challengeId, args.actorUid);
    const { challengeId, actorUid: _actorUid, ...updates } = args;
    const patch: Record<string, any> = { updatedAt: Date.now() };
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.zoneId !== undefined) patch.zoneId = updates.zoneId;
    if (updates.zoneName !== undefined) patch.zoneName = updates.zoneName;
    if (updates.scheduledAt !== undefined) {
      validateTeamChallengeScheduledAt(updates.scheduledAt);
      patch.scheduledAt = updates.scheduledAt;
    }
    if (updates.message !== undefined) patch.message = updates.message;
    if (updates.adminReviewStatus !== undefined) patch.adminReviewStatus = updates.adminReviewStatus;
    if (updates.proposedVenueByCaptainA !== undefined) patch.proposedVenueByCaptainA = updates.proposedVenueByCaptainA;
    if (updates.alternativeVenueByCaptainB !== undefined) patch.alternativeVenueByCaptainB = updates.alternativeVenueByCaptainB;
    if (updates.confirmedVenue !== undefined) patch.confirmedVenue = updates.confirmedVenue;
    if (updates.chatId !== undefined) patch.chatId = updates.chatId;
    if (updates.matchroomId !== undefined) patch.matchroomId = updates.matchroomId;

    await patchTeamChallengeWithLifecycleDueAt(ctx, challenge, patch);
    return true;
  },
});

export const listForCaptain = query({
  args: { captainUid: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx, args.captainUid);
    if (String(userId) !== String(args.captainUid)) {
      return [];
    }

    return await ctx.db
      .query("teamChallenges")
      .order("desc")
      .filter((q) =>
        q.or(
          q.eq(q.field("captainAUid"), userId),
          q.eq(q.field("captainBUid"), userId)
        )
      )
      .collect();
  },
});

// ============================================================================
// CAPTAIN-PAID PAYMENT MODEL (server-owned hold / capture / release)
// ============================================================================
// Only the captain of each team pays the FULL team amount. Funds are HELD on
// create (Team A) / accept (Team B), CAPTURED when the challenge becomes final,
// or RELEASED to the captain's wallet on any failure. Reuses the same wallet
// hold primitives and deterministic-reference idempotency as solo matchrooms.
//
// IMPORTANT: this model intentionally does NOT write the legacy
// `teamAPaymentStatus`/`teamBPaymentStatus` fields. They remain "unpaid" so the
// legacy `refundChallengerPaymentForRejectedChallenge` path (which only fires
// when that status === "paid") stays dormant and can never double-credit
// alongside `releaseChallengeSide`. UI reads the new `*PaymentState` fields.

type ChallengeSide = "teamA" | "teamB";

function challengeTeamSize(challenge: any): number {
  const max = Number(challenge?.maxPlayers || 0);
  if (Number.isFinite(max) && max >= 2) return Math.max(1, Math.floor(max / 2));
  return 1;
}

function challengeSideAmount(challenge: any): number {
  const perPlayer = Number(challenge?.pricePerPlayer || 0);
  if (!Number.isFinite(perPlayer) || perPlayer <= 0) return 0;
  return Math.max(0, Math.ceil(perPlayer * challengeTeamSize(challenge)));
}

function sideState(challenge: any, side: ChallengeSide): string {
  return String((side === "teamA" ? challenge.teamAPaymentState : challenge.teamBPaymentState) || "unpaid");
}
function sidePayerUid(challenge: any, side: ChallengeSide): Id<"users"> | undefined {
  return (side === "teamA" ? challenge.teamAPayerUid : challenge.teamBPayerUid) || undefined;
}
function sideAmountDue(challenge: any, side: ChallengeSide): number {
  return Number((side === "teamA" ? challenge.teamAAmountDue : challenge.teamBAmountDue) || 0);
}
function sideCaptainUid(challenge: any, side: ChallengeSide): Id<"users"> | undefined {
  return (side === "teamA" ? challenge.captainAUid : challenge.captainBUid) || undefined;
}
function sideHoldRef(challengeId: any, side: ChallengeSide) {
  return `team_challenge_hold:${String(challengeId)}:${side}`;
}
function sideCaptureRef(challengeId: any, side: ChallengeSide) {
  return `team_challenge_capture:${String(challengeId)}:${side}`;
}
function sideReleaseRef(challengeId: any, side: ChallengeSide) {
  return `team_challenge_release:${String(challengeId)}:${side}`;
}

// Maps generic side values to the concrete teamA*/teamB* schema fields.
function buildSidePatch(side: ChallengeSide, values: {
  paymentState?: string;
  payerUid?: Id<"users">;
  amountDue?: number;
  holdReference?: string | null;
  providerOrderRef?: string | null;
  heldAt?: number;
  capturedAt?: number;
  releasedAt?: number;
}): Record<string, any> {
  const p: Record<string, any> = {};
  const set = (a: string, b: string, val: any) => {
    if (val !== undefined) p[side === "teamA" ? a : b] = val;
  };
  set("teamAPaymentState", "teamBPaymentState", values.paymentState);
  set("teamAPayerUid", "teamBPayerUid", values.payerUid);
  set("teamAAmountDue", "teamBAmountDue", values.amountDue);
  set("teamAHoldReference", "teamBHoldReference", values.holdReference);
  set("teamAProviderOrderRef", "teamBProviderOrderRef", values.providerOrderRef);
  set("teamAHeldAt", "teamBHeldAt", values.heldAt);
  set("teamACapturedAt", "teamBCapturedAt", values.capturedAt);
  set("teamAReleasedAt", "teamBReleasedAt", values.releasedAt);
  return p;
}

async function notifySuperAdminsChallengePayment(
  ctx: any,
  args: { challenge: any; title: string; body: string; dedupeKey: string },
) {
  const superAdmins = await listSuperAdminNotificationRecipients(ctx);
  for (const admin of superAdmins) {
    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "operations.general",
      toUid: admin._id,
      recipientRole: "super_admin",
      status: "pending",
      dedupeKey: `${args.dedupeKey}:${String(admin._id)}`,
      dedupePolicy: "replace_active",
      route: toChallengeRoute(args.challenge._id),
      title: args.title,
      body: args.body,
      data: {
        challengeId: String(args.challenge._id),
        href: toChallengeRoute(args.challenge._id),
      },
    });
  }
}

async function notifyChallengeWalletCredit(
  ctx: any,
  challenge: any,
  side: ChallengeSide,
  amount: number,
  reason: string,
) {
  const captainUid = sideCaptainUid(challenge, side);
  if (captainUid) {
    await createChallengeNotification(ctx, {
      type: "team.challenge_updated",
      toUid: captainUid,
      fromUid: captainUid,
      fromUsername: "MatchHai",
      challengeId: challenge._id,
      dedupeKey: `team.challenge_payment_returned:${String(challenge._id)}:${side}`,
      dedupePolicy: "versioned_new",
      title: "Payment returned to wallet",
      body: `Your Team Challenge payment of PKR ${amount} was added back to your MatchHai wallet.`,
      updateKind: "payment_released",
      extraData: { side, amount, reason },
    });
  }
  await notifySuperAdminsChallengePayment(ctx, {
    challenge,
    title: "Team Challenge payment returned",
    body: `PKR ${amount} (${side}) was returned to a captain's wallet (${reason}).`,
    dedupeKey: `team.challenge_payment_returned_admin:${String(challenge._id)}:${side}:${reason}`,
  });
}

async function notifyChallengePaymentHeld(ctx: any, challenge: any, side: ChallengeSide, amount: number) {
  const captainUid = sideCaptainUid(challenge, side);
  if (!captainUid) return;
  await createChallengeNotification(ctx, {
    type: "team.challenge_updated",
    toUid: captainUid,
    fromUid: captainUid,
    fromUsername: "MatchHai",
    challengeId: challenge._id,
    dedupeKey: `team.challenge_payment_held:${String(challenge._id)}:${side}`,
    dedupePolicy: "versioned_new",
    title: "Team payment held",
    body: `PKR ${amount} is held for your team. It will be charged only once the challenge is confirmed, and returned to your wallet if it is cancelled or expires.`,
    updateKind: "payment_held",
    extraData: { side, amount },
  });
}

async function notifyChallengePaymentRequired(
  ctx: any,
  challenge: any,
  side: ChallengeSide,
  reason: "challenge_created" | "challenge_accepted",
) {
  const captainUid = sideCaptainUid(challenge, side);
  if (!captainUid) return;

  const amount = challengeSideAmount(challenge);
  if (amount <= 0) return;

  const state = sideState(challenge, side);
  if (!["unpaid", "payment_required", "failed"].includes(state)) return;

  await createChallengeNotification(ctx, {
    type: "team.challenge_payment_required",
    toUid: captainUid,
    fromUid: captainUid,
    fromUsername: "MatchHai",
    challengeId: challenge._id,
    dedupeKey: `team.challenge_payment_required:${String(challenge._id)}:${side}`,
    dedupePolicy: "upsert_active",
    title: "Team Challenge payment required",
    body: `Pay PKR ${amount} for your team to continue this Team Challenge.`,
    updateKind: "payment_required",
    extraData: {
      side,
      amount,
      reason,
      paymentState: state,
    },
  });
}

// Places the captain's hold for a side. Idempotent: re-running while already
// held/captured is a no-op. holdFunds throws on insufficient balance (surfaced
// to the caller). When `providerOrderRef` is set the wallet has already been
// topped up by the provider flow, so the hold cannot fail on balance.
async function holdChallengeSide(
  ctx: any,
  challenge: any,
  side: ChallengeSide,
  payerUid: Id<"users">,
  amount: number,
  opts?: { providerOrderRef?: string | null },
) {
  const state = sideState(challenge, side);
  if (state === "held" || state === "captured") {
    return { ok: true as const, alreadyApplied: true, amount: sideAmountDue(challenge, side) || amount };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false as const, reason: "no_amount" };
  }

  const holdRef = sideHoldRef(challenge._id, side);
  await ctx.runMutation(internal.wallet.holdFunds, {
    userId: payerUid,
    amount,
    reference: holdRef,
    metadata: {
      flow: "team_challenge",
      side,
      challengeId: String(challenge._id),
      provider: opts?.providerOrderRef ? "easypaisa" : "wallet",
      orderRef: opts?.providerOrderRef || null,
    },
  });

  const now = Date.now();
  await ctx.db.patch(challenge._id, {
    paymentMode: "paid",
    ...buildSidePatch(side, {
      paymentState: "held",
      payerUid,
      amountDue: amount,
      holdReference: holdRef,
      providerOrderRef: opts?.providerOrderRef ?? undefined,
      heldAt: now,
    }),
    updatedAt: now,
  });

  const fresh = await ctx.db.get(challenge._id);
  await notifyChallengePaymentHeld(ctx, fresh || challenge, side, amount);
  return { ok: true as const, alreadyApplied: false, amount };
}

async function releaseChallengeSide(ctx: any, challenge: any, side: ChallengeSide, reason: string) {
  if (sideState(challenge, side) !== "held") return { released: false as const };
  const amount = sideAmountDue(challenge, side);
  const payerUid = sidePayerUid(challenge, side);
  if (!payerUid || !Number.isFinite(amount) || amount <= 0) return { released: false as const };

  await ctx.runMutation(internal.wallet.releaseHeldFunds, {
    userId: payerUid,
    amount,
    reference: sideReleaseRef(challenge._id, side),
    originalHoldReference: sideHoldRef(challenge._id, side),
    metadata: { source: "team_challenge_release", side, challengeId: String(challenge._id), reason },
  });

  const now = Date.now();
  await ctx.db.patch(challenge._id, {
    ...buildSidePatch(side, { paymentState: "released", releasedAt: now }),
    updatedAt: now,
  });
  await notifyChallengeWalletCredit(ctx, challenge, side, amount, reason);
  return { released: true as const, amount };
}

async function captureChallengeSide(ctx: any, challenge: any, side: ChallengeSide, reason: string) {
  if (sideState(challenge, side) !== "held") return { captured: false as const };
  const amount = sideAmountDue(challenge, side);
  const payerUid = sidePayerUid(challenge, side);
  if (!payerUid || !Number.isFinite(amount) || amount <= 0) return { captured: false as const };

  await ctx.runMutation(internal.wallet.captureHeldFunds, {
    userId: payerUid,
    amount,
    reference: sideCaptureRef(challenge._id, side),
    originalHoldReference: sideHoldRef(challenge._id, side),
    metadata: { source: "team_challenge_capture", side, challengeId: String(challenge._id), reason },
  });

  const now = Date.now();
  await ctx.db.patch(challenge._id, {
    ...buildSidePatch(side, { paymentState: "captured", capturedAt: now }),
    updatedAt: now,
  });
  return { captured: true as const, amount };
}

// Releases any held challenge holds (both sides). Safe to call from challenge
// reject/cancel/expire paths before a linked matchroom exists.
export async function releaseChallengeHolds(ctx: any, challengeId: Id<"teamChallenges">, reason: string) {
  for (const side of ["teamA", "teamB"] as const) {
    const fresh = await ctx.db.get(challengeId);
    if (!fresh) break;
    await releaseChallengeSide(ctx, fresh, side, reason);
  }
}

async function maybeMarkChallengeFundsReady(ctx: any, challenge: any) {
  if (!challenge) return;
  const bothHeld = sideState(challenge, "teamA") === "held" && sideState(challenge, "teamB") === "held";
  if (!bothHeld) return;
  // Both captains have paid. Notify both that funds are reserved.
  for (const side of ["teamA", "teamB"] as const) {
    const captainUid = sideCaptainUid(challenge, side);
    if (!captainUid) continue;
    await createChallengeNotification(ctx, {
      type: "team.challenge_updated",
      toUid: captainUid,
      fromUid: captainUid,
      fromUsername: "MatchHai",
      challengeId: challenge._id,
      dedupeKey: `team.challenge_both_paid:${String(challenge._id)}:${side}`,
      dedupePolicy: "versioned_new",
      title: "Both teams paid",
      body: "Both captains' payments are held. The challenge will proceed to venue confirmation.",
      updateKind: "both_paid",
    });
  }
  await maybeFinalizeChallengeBooking(ctx, challenge);
}

// Once both captains are held AND a venue is confirmed, create the linked,
// zone-owned matchroom server-side and enter the zone-admin approval pipeline.
// Idempotent: no-op if already linked or preconditions unmet.
async function maybeFinalizeChallengeBooking(ctx: any, challenge: any) {
  if (!challenge || challenge.matchroomId) return;
  const bothHeld = sideState(challenge, "teamA") === "held" && sideState(challenge, "teamB") === "held";
  if (!bothHeld) return;
  if (!challenge.confirmedVenue?.zoneId) return;
  await ctx.runMutation(internal.matchrooms.createTeamChallengeMatchroom, {
    challengeId: challenge._id,
  });
}

// Public: captain pays their team's full amount from MatchHai wallet (escrow hold).
export const payTeamChallengeSideFromWallet = mutation({
  args: { challengeId: v.id("teamChallenges"), actorUid: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const { challenge, userId } = await requireCaptain(ctx, args.challengeId, args.actorUid);

    const side: ChallengeSide | null =
      String(challenge.captainAUid || "") === String(userId)
        ? "teamA"
        : String(challenge.captainBUid || "") === String(userId)
          ? "teamB"
          : null;
    if (!side) throw new Error("Only a team captain can pay for their team.");

    if (["rejected", "expired", "completed"].includes(String(challenge.status))) {
      throw new Error("This challenge is no longer active.");
    }

    if (side === "teamB") {
      if (!["accepted", "venue_proposed", "venue_confirmed", "admin_pending"].includes(String(challenge.status))) {
        throw new Error("Accept the challenge before paying for your team.");
      }
      const teamAState = sideState(challenge, "teamA");
      if (teamAState !== "held" && teamAState !== "captured") {
        throw new Error("Waiting for the challenging captain's payment before you can pay.");
      }
    }

    const current = sideState(challenge, side);
    if (current === "held" || current === "captured") {
      return { ok: true, side, state: current, amount: sideAmountDue(challenge, side), alreadyApplied: true };
    }

    const amount = challengeSideAmount(challenge);
    if (amount <= 0) {
      await ctx.db.patch(challenge._id, {
        paymentMode: "free",
        ...buildSidePatch(side, { paymentState: "unpaid" }),
        updatedAt: Date.now(),
      });
      return { ok: true, side, state: "unpaid", amount: 0, free: true };
    }

    const result = await holdChallengeSide(ctx, challenge, side, userId, amount);
    if (!result.ok) throw new Error("Could not place the team payment hold.");

    const fresh = await ctx.db.get(challenge._id);
    await maybeMarkChallengeFundsReady(ctx, fresh);

    return { ok: true, side, state: "held", amount };
  },
});

// Public: per-side payment summary for the challenge UI (captain-gated).
export const getChallengePaymentSummary = query({
  args: { challengeId: v.id("teamChallenges"), actorUid: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx, args.actorUid);
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge || !isCaptain(challenge, userId)) return null;

    const amount = challengeSideAmount(challenge);
    const mySide: ChallengeSide | null =
      String(challenge.captainAUid || "") === String(userId)
        ? "teamA"
        : String(challenge.captainBUid || "") === String(userId)
          ? "teamB"
          : null;

    return {
      paymentMode: challenge.paymentMode || (Number(challenge.pricePerPlayer || 0) > 0 ? "paid" : "free"),
      perPlayer: Number(challenge.pricePerPlayer || 0),
      teamSize: challengeTeamSize(challenge),
      amountDuePerCaptain: amount,
      mySide,
      teamA: {
        state: sideState(challenge, "teamA"),
        amountDue: sideAmountDue(challenge, "teamA") || amount,
        captainUid: challenge.captainAUid || null,
      },
      teamB: {
        state: sideState(challenge, "teamB"),
        amountDue: sideAmountDue(challenge, "teamB") || amount,
        captainUid: challenge.captainBUid || null,
      },
    };
  },
});

// Internal: capture or release both sides for a linked matchroom (driven by the
// matchroom lifecycle — completion captures, cancel/expire/zone-reject releases).
export const settleForMatchroom = internalMutation({
  args: {
    matchroomId: v.id("matchrooms"),
    action: v.union(v.literal("capture"), v.literal("release")),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db
      .query("teamChallenges")
      .withIndex("by_matchroomId", (q: any) => q.eq("matchroomId", args.matchroomId))
      .first();
    if (!challenge) return { ok: true, found: false };

    for (const side of ["teamA", "teamB"] as const) {
      const fresh = await ctx.db.get(challenge._id);
      if (!fresh) break;
      if (args.action === "capture") {
        await captureChallengeSide(ctx, fresh, side, args.reason);
      } else {
        await releaseChallengeSide(ctx, fresh, side, args.reason);
      }
    }
    return { ok: true, found: true };
  },
});

// Internal: place a captain hold from a provider (Easypaisa) payment. Called by
// applyProviderUpdate AFTER the wallet has been topped up with the paid amount.
// DEFENSIVE BY DESIGN: never throws on a recoverable condition — if the hold
// cannot be placed (challenge gone / wrong captain / inactive), the captain
// simply keeps the credited amount as MatchHai wallet credit (the provider top-up
// already committed) and Super Admin is alerted, rather than rolling back the
// credited payment.
export const holdSideFromProvider = internalMutation({
  args: {
    challengeId: v.id("teamChallenges"),
    side: v.union(v.literal("teamA"), v.literal("teamB")),
    userId: v.id("users"),
    amount: v.number(),
    orderRefNum: v.string(),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      return { held: false as const, reason: "challenge_not_found" };
    }
    const captainUid = sideCaptainUid(challenge, args.side);
    if (!captainUid || String(captainUid) !== String(args.userId)) {
      return { held: false as const, reason: "not_side_captain" };
    }
    if (["rejected", "expired", "completed"].includes(String(challenge.status))) {
      await notifySuperAdminsChallengePayment(ctx, {
        challenge,
        title: "Team Challenge payment kept as wallet credit",
        body: `A captain's Easypaisa payment (${args.side}) could not be held because the challenge is ${challenge.status}; the amount stays in their MatchHai wallet.`,
        dedupeKey: `team.challenge_provider_credit_only:${String(challenge._id)}:${args.side}`,
      });
      return { held: false as const, reason: "challenge_inactive" };
    }
    if (args.side === "teamB") {
      const aState = sideState(challenge, "teamA");
      if (aState !== "held" && aState !== "captured") {
        return { held: false as const, reason: "teamA_not_held" };
      }
    }
    const current = sideState(challenge, args.side);
    if (current === "held" || current === "captured") {
      return { held: true as const, alreadyApplied: true, amount: sideAmountDue(challenge, args.side) };
    }

    // Hold the amount the captain actually paid via the provider (the wallet was
    // just credited this exact amount, so the hold cannot fail on balance).
    const amount = Math.max(0, Math.ceil(Number(args.amount || 0)));
    if (amount <= 0) {
      return { held: false as const, reason: "no_amount" };
    }
    const result = await holdChallengeSide(ctx, challenge, args.side, args.userId, amount, {
      providerOrderRef: args.orderRefNum,
    });
    if (!result.ok) {
      return { held: false as const, reason: "hold_failed" };
    }
    const fresh = await ctx.db.get(args.challengeId);
    await maybeMarkChallengeFundsReady(ctx, fresh);
    return { held: true as const, amount };
  },
});

// Cron: expire stale Team Challenges that never reached a linked matchroom and
// RELEASE any held captain funds back to their wallets. Without this, a
// paid-but-unaccepted challenge (Team A held, Team B never accepts) would strand
// the captain's escrow forever. Challenges that already have a linked matchroom
// are owned by the matchroom lifecycle sweep (which releases via
// settleForMatchroom), so they are skipped here.
export const expireStaleChallenges = internalMutation({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, args) => {
    if (!isMaintenanceJobEnabled("MATCHHAI_ENABLE_TEAM_CHALLENGE_EXPIRY_CRON")) {
      return {
        disabled: true,
        ok: true,
        expiredCount: 0,
        releasedSides: 0,
        useIndexedSweep: false,
      };
    }

    const now = Date.now();
    const batchSize = Math.min(100, Math.max(1, Number(args.batchSize || 25)));
    const nonTerminalStatuses = ["pending", "accepted", "venue_proposed", "venue_confirmed"] as const;
    const useIndexedSweep = isRuntimeFlagEnabled("MATCHHAI_USE_INDEXED_TEAM_CHALLENGE_EXPIRY_SWEEP");

    let expiredCount = 0;
    let releasedSides = 0;
    let remaining = batchSize;

    for (const status of nonTerminalStatuses) {
      if (remaining <= 0) break;
      const rows = useIndexedSweep
        ? await ctx.db
            .query("teamChallenges")
            .withIndex("by_status_and_lifecycleDueAt", (q) =>
              q
                .eq("status", status)
                .gte("lifecycleDueAt", 0)
                .lte("lifecycleDueAt", now),
            )
            .take(remaining)
        : await ctx.db
            .query("teamChallenges")
            .withIndex("by_status", (q) => q.eq("status", status))
            .take(remaining);

      for (const challenge of rows) {
        if (remaining <= 0) break;
        remaining -= 1;
        // A linked matchroom exists → the matchroom lifecycle owns expiry/release.
        if (challenge.matchroomId) {
          if (challenge.lifecycleDueAt !== undefined) {
            await ctx.db.patch(challenge._id, { lifecycleDueAt: undefined });
          }
          continue;
        }

        const scheduledAt = Number(challenge.scheduledAt || 0);
        const createdAt = Number(challenge.createdAt || 0);
        const pastSchedule = scheduledAt > 0 && scheduledAt < now;
        const acceptTimedOut =
          status === "pending" && createdAt > 0 && createdAt + CHALLENGE_ACCEPT_TTL_MS < now;
        const abandoned = scheduledAt <= 0 && createdAt > 0 && createdAt + CHALLENGE_ABANDON_TTL_MS < now;

        if (!pastSchedule && !acceptTimedOut && !abandoned) {
          const lifecycleDueAt = getTeamChallengeLifecycleDueAt(challenge, now);
          if (challenge.lifecycleDueAt !== lifecycleDueAt) {
            await ctx.db.patch(challenge._id, { lifecycleDueAt });
          }
          continue;
        }

        const reason = pastSchedule ? "challenge_expired" : "challenge_abandoned";
        // Return any held captain funds to wallets BEFORE marking expired
        // (idempotent — releaseHeldFunds dedupes by reference).
        const aWasHeld = sideState(challenge, "teamA") === "held";
        const bWasHeld = sideState(challenge, "teamB") === "held";
        await releaseChallengeHolds(ctx, challenge._id, reason);
        if (aWasHeld) releasedSides += 1;
        if (bWasHeld) releasedSides += 1;

        await patchTeamChallengeWithLifecycleDueAt(ctx, challenge, {
          status: "expired",
          updatedAt: now,
        }, now);

        for (const captainUid of [challenge.captainAUid, challenge.captainBUid]) {
          if (!captainUid) continue;
          await createChallengeNotification(ctx, {
            type: "team.challenge_updated",
            toUid: captainUid,
            fromUid: captainUid,
            fromUsername: "MatchHai",
            challengeId: challenge._id,
            dedupeKey: `team.challenge_expired:${String(challenge._id)}:${String(captainUid)}`,
            dedupePolicy: "versioned_new",
            title: "Team Challenge expired",
            body: "This team challenge expired before it was confirmed. Any held payment was added back to your MatchHai wallet.",
            updateKind: "expired",
          });
        }

        expiredCount += 1;
      }
    }

    return { ok: true, expiredCount, releasedSides, useIndexedSweep };
  },
});
