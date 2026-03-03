import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ============================================
// QUERIES
// ============================================

// Get challenge by ID
export const getById = query({
  args: { challengeId: v.id("teamChallenges") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.challengeId);
  },
});

// Get challenge with teams
export const getWithTeams = query({
  args: { challengeId: v.id("teamChallenges") },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) return null;

    const challengerTeam = await ctx.db.get(challenge.challengerTeamId);
    const opponentTeam = await ctx.db.get(challenge.opponentTeamId);

    return {
      ...challenge,
      challengerTeam,
      opponentTeam,
    };
  },
});

// List challenges by challenger team
export const listByChallengerTeam = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("teamChallenges")
      .withIndex("by_challengerTeamId", (q) => q.eq("challengerTeamId", args.teamId))
      .order("desc")
      .collect();
  },
});

// List challenges by opponent team
export const listByOpponentTeam = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("teamChallenges")
      .withIndex("by_opponentTeamId", (q) => q.eq("opponentTeamId", args.teamId))
      .order("desc")
      .collect();
  },
});

// List all challenges for a team (both as challenger and opponent)
export const listForTeam = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const aschallenger = await ctx.db
      .query("teamChallenges")
      .withIndex("by_challengerTeamId", (q) => q.eq("challengerTeamId", args.teamId))
      .collect();

    const asOpponent = await ctx.db
      .query("teamChallenges")
      .withIndex("by_opponentTeamId", (q) => q.eq("opponentTeamId", args.teamId))
      .collect();

    // Combine and sort by createdAt desc
    const all = [...aschallenger, ...asOpponent];
    all.sort((a, b) => b.createdAt - a.createdAt);

    return all;
  },
});

// List pending challenges for a team
export const listPendingForTeam = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    // Get challenges where this team is the opponent and status is pending
    const challenges = await ctx.db
      .query("teamChallenges")
      .withIndex("by_opponentTeamId", (q) => q.eq("opponentTeamId", args.teamId))
      .collect();

    return challenges.filter((c) => c.status === "pending");
  },
});

// ============================================
// MUTATIONS
// ============================================

// Create a challenge
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
    const now = Date.now();

    // Get team names if not provided
    let challengerTeamName = args.challengerTeamName;
    let opponentTeamName = args.opponentTeamName;

    if (!challengerTeamName) {
      const team = await ctx.db.get(args.challengerTeamId);
      challengerTeamName = team?.name;
    }
    if (!opponentTeamName) {
      const team = await ctx.db.get(args.opponentTeamId);
      opponentTeamName = team?.name;
    }

    const challengeId = await ctx.db.insert("teamChallenges", {
      challengerTeamId: args.challengerTeamId,
      challengerTeamName,
      opponentTeamId: args.opponentTeamId,
      opponentTeamName,
      game: args.game,
      status: "pending",
      message: args.message,
      createdAt: now,
      updatedAt: now,
    });

    return challengeId;
  },
});

// Respond to challenge (accept/reject)
export const respond = mutation({
  args: {
    challengeId: v.id("teamChallenges"),
    accept: v.boolean(),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) throw new Error("Challenge not found");
    if (challenge.status !== "pending") {
      throw new Error("Challenge is not pending");
    }

    await ctx.db.patch(args.challengeId, {
      status: args.accept ? "accepted" : "rejected",
      updatedAt: Date.now(),
    });

    return true;
  },
});

// Propose venue
export const proposeVenue = mutation({
  args: {
    challengeId: v.id("teamChallenges"),
    zoneId: v.id("zones"),
    zoneName: v.optional(v.string()),
    scheduledAt: v.number(),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) throw new Error("Challenge not found");
    if (challenge.status !== "accepted") {
      throw new Error("Challenge must be accepted before proposing venue");
    }

    let zoneName = args.zoneName;
    if (!zoneName) {
      const zone = await ctx.db.get(args.zoneId);
      zoneName = zone?.name;
    }

    await ctx.db.patch(args.challengeId, {
      status: "venue_proposed",
      zoneId: args.zoneId,
      zoneName,
      scheduledAt: args.scheduledAt,
      updatedAt: Date.now(),
    });

    return true;
  },
});

// Confirm venue
export const confirmVenue = mutation({
  args: { challengeId: v.id("teamChallenges") },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) throw new Error("Challenge not found");
    if (challenge.status !== "venue_proposed") {
      throw new Error("No venue proposed to confirm");
    }

    await ctx.db.patch(args.challengeId, {
      status: "confirmed",
      updatedAt: Date.now(),
    });

    return true;
  },
});

// Complete challenge with result
export const complete = mutation({
  args: {
    challengeId: v.id("teamChallenges"),
    winnerId: v.id("teams"),
    score: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) throw new Error("Challenge not found");

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

// Cancel challenge
export const cancel = mutation({
  args: { challengeId: v.id("teamChallenges") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.challengeId);
    return true;
  },
});
