import {
  query,
  mutation,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";

// ============================================
// QUERIES
// ============================================

// Get team by ID
export const getById = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.teamId);
  },
});

// Get team with members
export const getWithMembers = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) return null;

    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .collect();

    return { ...team, members };
  },
});

// List teams by captain
export const listByCaptain = query({
  args: { captainUid: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("teams")
      .withIndex("by_captainUid", (q) => q.eq("captainUid", args.captainUid))
      .collect();
  },
});

// List teams where user is a member
export const listByMember = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Get all team memberships for this user
    const memberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_userId", (q) => q.eq("odxerId", args.userId as any))
      .collect();

    // Get the teams
    const teams = await Promise.all(
      memberships.map((m) => ctx.db.get(m.teamId))
    );

    return teams.filter((t) => t !== null);
  },
});

// List teams by game
export const listByGame = query({
  args: { game: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("teams")
      .withIndex("by_game", (q) => q.eq("game", args.game))
      .take(args.limit || 50);
  },
});

// Search teams by name
export const searchByName = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const searchLower = args.query.toLowerCase();
    const allTeams = await ctx.db
      .query("teams")
      .order("desc")
      .take(200);

    return allTeams
      .filter((t) => t.nameLower.includes(searchLower))
      .slice(0, args.limit || 20);
  },
});

// Get user's teams (by memberUids array)
export const getUserTeams = query({
  args: { uid: v.string() },
  handler: async (ctx, args) => {
    const allTeams = await ctx.db
      .query("teams")
      .order("desc")
      .take(200);

    return allTeams.filter((t) => t.memberUids.includes(args.uid));
  },
});

// Get user's teams for a specific game
export const getUserTeamsForGame = query({
  args: { uid: v.string(), game: v.string() },
  handler: async (ctx, args) => {
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_game", (q) => q.eq("game", args.game))
      .collect();

    return teams.filter((t) => t.memberUids.includes(args.uid));
  },
});

// Get team by ID (string version for compatibility)
export const getByIdString = query({
  args: { teamId: v.string() },
  handler: async (ctx, args) => {
    try {
      const id = args.teamId as any;
      const team = await ctx.db.get(id);
      if (team) {
        return { ...team, id: team._id };
      }
    } catch {
      // Not a valid Convex ID
    }
    return null;
  },
});

// ============================================
// MUTATIONS
// ============================================

// Create a new team
export const create = mutation({
  args: {
    name: v.string(),
    tag: v.optional(v.string()),
    game: v.string(),
    captainUid: v.id("users"),
    captainUsername: v.string(),
    maxMembers: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Create the team
    const teamId = await ctx.db.insert("teams", {
      name: args.name,
      nameLower: args.name.toLowerCase(),
      tag: args.tag,
      game: args.game,
      captainUid: args.captainUid,
      captainUsername: args.captainUsername,
      memberUids: [args.captainUid],
      memberCount: 1,
      maxMembers: args.maxMembers || 10,
      description: args.description,
      stats: {
        wins: 0,
        losses: 0,
        matchesPlayed: 0,
      },
      createdAt: now,
      updatedAt: now,
    });

    // Create captain's member record
    await ctx.db.insert("teamMembers", {
      teamId,
      odxerId: args.captainUid,
      username: args.captainUsername,
      role: "captain",
      joinedAt: now,
    });

    return teamId;
  },
});

// Update team
export const update = mutation({
  args: {
    teamId: v.id("teams"),
    name: v.optional(v.string()),
    tag: v.optional(v.string()),
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { teamId, ...updates } = args;
    const now = Date.now();

    const updateData: Record<string, unknown> = { updatedAt: now };

    if (updates.name !== undefined) {
      updateData.name = updates.name;
      updateData.nameLower = updates.name.toLowerCase();
    }
    if (updates.tag !== undefined) updateData.tag = updates.tag;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.logoUrl !== undefined) updateData.logoUrl = updates.logoUrl;
    if (updates.logoStorageId !== undefined) updateData.logoStorageId = updates.logoStorageId;

    await ctx.db.patch(teamId, updateData);
    return true;
  },
});

// Add member to team
export const addMember = mutation({
  args: {
    teamId: v.id("teams"),
    userId: v.id("users"),
    username: v.string(),
  },
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("Team not found");

    // Check if already a member
    if (team.memberUids.includes(args.userId)) {
      throw new Error("User is already a member");
    }

    // Check roster cap
    if (team.memberCount >= team.maxMembers) {
      throw new Error("Team is full");
    }

    const now = Date.now();

    // Add to memberUids
    const memberUids = [...team.memberUids, args.userId];

    await ctx.db.patch(args.teamId, {
      memberUids,
      memberCount: team.memberCount + 1,
      updatedAt: now,
    });

    // Create member record
    await ctx.db.insert("teamMembers", {
      teamId: args.teamId,
      odxerId: args.userId,
      username: args.username,
      role: "member",
      joinedAt: now,
    });

    return true;
  },
});

// Remove member from team
export const removeMember = mutation({
  args: {
    teamId: v.id("teams"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("Team not found");

    // Can't remove captain
    if (team.captainUid === args.userId) {
      throw new Error("Cannot remove the captain");
    }

    // Check if is a member
    if (!team.memberUids.includes(args.userId)) {
      throw new Error("User is not a member");
    }

    // Remove from memberUids
    const memberUids = team.memberUids.filter((uid) => uid !== args.userId);

    await ctx.db.patch(args.teamId, {
      memberUids,
      memberCount: team.memberCount - 1,
      updatedAt: Date.now(),
    });

    // Delete member record
    const memberRecord = await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId_and_userId", (q) =>
        q.eq("teamId", args.teamId).eq("odxerId", args.userId)
      )
      .unique();

    if (memberRecord) {
      await ctx.db.delete(memberRecord._id);
    }

    return true;
  },
});

// Transfer captain
export const transferCaptain = mutation({
  args: {
    teamId: v.id("teams"),
    newCaptainUid: v.id("users"),
    newCaptainUsername: v.string(),
  },
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("Team not found");

    // Check if new captain is a member
    if (!team.memberUids.includes(args.newCaptainUid)) {
      throw new Error("New captain must be a team member");
    }

    const now = Date.now();

    // Update team
    await ctx.db.patch(args.teamId, {
      captainUid: args.newCaptainUid,
      captainUsername: args.newCaptainUsername,
      updatedAt: now,
    });

    // Update old captain's role
    const oldCaptainRecord = await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId_and_userId", (q) =>
        q.eq("teamId", args.teamId).eq("odxerId", team.captainUid)
      )
      .unique();

    if (oldCaptainRecord) {
      await ctx.db.patch(oldCaptainRecord._id, { role: "member" });
    }

    // Update new captain's role
    const newCaptainRecord = await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId_and_userId", (q) =>
        q.eq("teamId", args.teamId).eq("odxerId", args.newCaptainUid)
      )
      .unique();

    if (newCaptainRecord) {
      await ctx.db.patch(newCaptainRecord._id, { role: "captain" });
    }

    return true;
  },
});

// Update team stats
export const updateStats = mutation({
  args: {
    teamId: v.id("teams"),
    wins: v.optional(v.number()),
    losses: v.optional(v.number()),
    matchesPlayed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("Team not found");

    const currentStats = team.stats || { wins: 0, losses: 0, matchesPlayed: 0 };

    await ctx.db.patch(args.teamId, {
      stats: {
        wins: args.wins !== undefined ? args.wins : currentStats.wins,
        losses: args.losses !== undefined ? args.losses : currentStats.losses,
        matchesPlayed:
          args.matchesPlayed !== undefined
            ? args.matchesPlayed
            : currentStats.matchesPlayed,
      },
      updatedAt: Date.now(),
    });

    return true;
  },
});

// Delete team
export const remove = mutation({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    // Delete all member records first
    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .collect();

    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    // Delete the team
    await ctx.db.delete(args.teamId);
    return true;
  },
});
