import { v } from "convex/values";

import { authComponent } from "./auth";
import { api, internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { KYC_VERIFICATION_REQUIRED_MESSAGE, assertKycAccessAllowed } from "./kycGate";

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
  handler: async (ctx, args) => {
    const challenger = await ctx.db.get(args.challengerTeamId);
    const opponent = await ctx.db.get(args.opponentTeamId);
    if (!challenger || !opponent) throw new Error("Team not found");

    const actorId = await getAuthenticatedUserId(ctx, challenger.captainUid);
    if (challenger.captainUid !== actorId) {
      throw new Error("Only the challenging captain can create this challenge");
    }

    const now = Date.now();
    return await ctx.db.insert("teamChallenges", {
      challengerTeamId: args.challengerTeamId,
      challengerTeamName: args.challengerTeamName || challenger.name,
      opponentTeamId: args.opponentTeamId,
      opponentTeamName: args.opponentTeamName || opponent.name,
      game: args.game,
      gameKey: args.game,
      status: "pending",
      captainAUid: challenger.captainUid,
      captainAName: challenger.captainUsername || "Captain",
      captainBUid: opponent.captainUid,
      captainBName: opponent.captainUsername || "Captain",
      message: args.message,
      commonAreas: [],
      createdAt: now,
      updatedAt: now,
    });
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
    const refundResult = args.accept
      ? { refunded: false, amount: 0 }
      : await refundChallengerPaymentForRejectedChallenge(ctx, args.challengeId, challenge);

    await ctx.db.patch(args.challengeId, {
      status: nextStatus,
      chatId,
      lineupB: args.accept ? args.lineupB || challenge.lineupB : challenge.lineupB,
      teamAPaymentStatus: !args.accept && refundResult.refunded ? "unpaid" : challenge.teamAPaymentStatus,
      teamBPaymentStatus: args.accept ? args.teamBPaymentStatus || challenge.teamBPaymentStatus || "paid" : challenge.teamBPaymentStatus,
      teamBPaymentAmount: args.accept ? args.teamBPaymentAmount ?? challenge.teamBPaymentAmount : challenge.teamBPaymentAmount,
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

    await ctx.db.patch(args.challengeId, {
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

    await ctx.db.patch(args.challengeId, {
      status: "venue_confirmed",
      zoneName: challenge.confirmedVenue.venueName,
      updatedAt: Date.now(),
    });

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
  handler: async (ctx, args) => {
    await requireCaptain(ctx, args.challengeId, args.actorUid);
    await ctx.db.patch(args.challengeId, {
      status: "completed",
      result: {
        winnerId: args.winnerId,
        score: args.score,
      },
      updatedAt: Date.now(),
    });

    return true;
  },
});

export const cancel = mutation({
  args: { challengeId: v.id("teamChallenges"), actorUid: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const { challenge, userId } = await requireCaptain(ctx, args.challengeId, args.actorUid);
    if (challenge.captainAUid !== userId) {
      throw new Error("Only the challenging captain can cancel");
    }
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

    const challengeId = await ctx.db.insert("teamChallenges", {
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
      teamAPaymentStatus: args.teamAPaymentStatus ?? "unpaid",
      teamBPaymentStatus: args.teamBPaymentStatus ?? "unpaid",
      teamAPaymentAmount: args.teamAPaymentAmount,
      teamBPaymentAmount: args.teamBPaymentAmount,
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
    });

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
        teamAPaymentStatus: args.teamAPaymentStatus ?? "unpaid",
        teamBPaymentStatus: args.teamBPaymentStatus ?? "unpaid",
        seriesType: args.seriesType ?? null,
        proposedVenueByCaptainA: args.proposedVenueByCaptainA,
      },
    });

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
    await requireCaptain(ctx, args.challengeId, args.actorUid);
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

    await ctx.db.patch(challengeId, patch);
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
