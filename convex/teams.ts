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

// Check if user is already in a team for this game
export const checkUserTeamLimit = query({
  args: { uid: v.string(), game: v.string() },
  handler: async (ctx, args) => {
    const allTeams = await ctx.db
      .query("teams")
      .withIndex("by_game", (q) => q.eq("game", args.game))
      .collect();

    const existingTeam = allTeams.find((t) => t.memberUids.includes(args.uid));
    if (existingTeam) {
      return { inTeam: true, teamName: existingTeam.name };
    }
    return { inTeam: false, teamName: null };
  },
});

// Check team name uniqueness
export const isNameAvailable = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("teams")
      .withIndex("by_nameLower", (q) => q.eq("nameLower", args.name.toLowerCase()))
      .unique();
    return existing === null;
  },
});

// Invite to team (creates notification)
export const inviteToTeam = mutation({
  args: {
    teamId: v.id("teams"),
    fromUid: v.id("users"),
    toUid: v.id("users"),
  },
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("Team not found");
    if (team.captainUid !== args.fromUid) throw new Error("Only captain can invite members");

    // Check if already a member
    if (team.memberUids.includes(args.toUid)) {
      throw new Error("User is already a member");
    }

    // Check if friends
    const friendship = await ctx.db
      .query("friendships")
      .withIndex("by_userId_and_friendId", (q) =>
        q.eq("userId", args.fromUid).eq("friendId", args.toUid)
      )
      .unique();
    if (!friendship) throw new Error("Can only invite friends");

    // Dedup key
    const entityKey = `team_invite__${args.teamId}__${args.toUid}`;

    // Check for existing pending invite
    const existing = await ctx.db
      .query("notifications")
      .withIndex("by_entityKey", (q) => q.eq("entityKey", entityKey))
      .unique();

    if (existing && existing.status === "pending") {
      if (!existing.expiresAt || existing.expiresAt > Date.now()) {
        throw new Error("Invitation already pending");
      }
      // Expired - delete old one
      await ctx.db.delete(existing._id);
    } else if (existing) {
      await ctx.db.delete(existing._id);
    }

    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    const fromUser = await ctx.db.get(args.fromUid);

    const notificationId = await ctx.db.insert("notifications", {
      type: "team_invite",
      toUid: args.toUid,
      fromUid: args.fromUid,
      fromUsername: fromUser?.username || team.captainUsername || "Captain",
      status: "pending",
      entityKey,
      teamId: args.teamId,
      teamName: team.name,
      title: "Team Invite",
      body: `You've been invited to join ${team.name}`,
      data: { teamId: args.teamId, teamName: team.name, game: team.game },
      expiresAt: now + sevenDaysMs,
      createdAt: now,
      updatedAt: now,
    });

    return notificationId;
  },
});

// Respond to team invite
export const respondToTeamInvite = mutation({
  args: {
    notificationId: v.id("notifications"),
    userId: v.id("users"),
    accept: v.boolean(),
  },
  handler: async (ctx, args) => {
    const notif = await ctx.db.get(args.notificationId);
    if (!notif) throw new Error("Invite not found");
    if (notif.type !== "team_invite") throw new Error("Invalid notification type");
    if (notif.toUid !== args.userId) throw new Error("Not authorized");
    if (notif.status !== "pending") throw new Error("Invite already processed");

    // Expiry check
    if (notif.expiresAt && notif.expiresAt < Date.now()) {
      throw new Error("Invitation has expired");
    }

    const now = Date.now();

    if (!args.accept) {
      await ctx.db.patch(args.notificationId, { status: "declined", updatedAt: now });
      return { ok: true, message: "Invite declined." };
    }

    // Accept: get team
    const teamId = notif.teamId;
    if (!teamId) throw new Error("Team reference missing");

    const team = await ctx.db.get(teamId);
    if (!team) throw new Error("Team no longer exists");

    // Check user not already in a team for this game
    const gameTeams = await ctx.db
      .query("teams")
      .withIndex("by_game", (q) => q.eq("game", team.game))
      .collect();
    const existingTeam = gameTeams.find((t) => t.memberUids.includes(args.userId) && t._id !== teamId);
    if (existingTeam) {
      throw new Error(`You are already in a ${team.game} team (${existingTeam.name}). You must leave it to join a new one.`);
    }

    // Already a member check
    if (team.memberUids.includes(args.userId)) {
      await ctx.db.patch(args.notificationId, { status: "accepted", updatedAt: now });
      return { ok: true, message: "Already a member." };
    }

    // Capacity check
    if (team.memberCount >= team.maxMembers) {
      await ctx.db.patch(args.notificationId, { status: "rejected", updatedAt: now });
      throw new Error("Team is full");
    }

    // Get user
    const user = await ctx.db.get(args.userId);
    const username = user?.username || "Member";

    // Add member
    const memberUids = [...team.memberUids, args.userId];
    await ctx.db.patch(teamId, {
      memberUids,
      memberCount: team.memberCount + 1,
      updatedAt: now,
    });

    await ctx.db.insert("teamMembers", {
      teamId,
      odxerId: args.userId,
      username,
      role: "member",
      joinedAt: now,
    });

    await ctx.db.patch(args.notificationId, { status: "accepted", updatedAt: now });

    return { ok: true, message: "Joined team successfully!" };
  },
});

// Respond to join request (captain responds)
export const respondToJoinRequest = mutation({
  args: {
    notificationId: v.id("notifications"),
    captainUid: v.id("users"),
    accept: v.boolean(),
  },
  handler: async (ctx, args) => {
    const notif = await ctx.db.get(args.notificationId);
    if (!notif) throw new Error("Request not found");
    if (notif.status !== "pending") throw new Error("Already handled");

    const now = Date.now();

    // Get team from notification data
    const teamId = notif.teamId;
    if (!teamId) throw new Error("Team reference missing");

    const team = await ctx.db.get(teamId);
    if (!team) throw new Error("Team not found");
    if (team.captainUid !== args.captainUid) throw new Error("Only the current captain can respond");

    if (!args.accept) {
      await ctx.db.patch(args.notificationId, { status: "rejected", updatedAt: now });
      return { ok: true };
    }

    // Accept flow
    const requesterUid = notif.fromUid;
    if (!requesterUid) throw new Error("Requester not found");

    // Check capacity
    if (team.memberCount >= team.maxMembers) {
      await ctx.db.patch(args.notificationId, { status: "rejected", updatedAt: now });
      throw new Error("Team is full");
    }

    // Already a member?
    if (team.memberUids.includes(requesterUid)) {
      await ctx.db.patch(args.notificationId, { status: "accepted", updatedAt: now });
      return { ok: true, message: "User is already a member." };
    }

    // Check user not already in a team for this game
    const gameTeams = await ctx.db
      .query("teams")
      .withIndex("by_game", (q) => q.eq("game", team.game))
      .collect();
    const existingTeam = gameTeams.find((t) => t.memberUids.includes(requesterUid) && t._id !== teamId);
    if (existingTeam) {
      await ctx.db.patch(args.notificationId, { status: "rejected", updatedAt: now });
      throw new Error(`User is already in a ${team.game} team`);
    }

    // Add member
    const requester = await ctx.db.get(requesterUid);
    const username = requester?.username || notif.fromUsername || "Unknown";

    const memberUids = [...team.memberUids, requesterUid];
    await ctx.db.patch(teamId, {
      memberUids,
      memberCount: team.memberCount + 1,
      updatedAt: now,
    });

    await ctx.db.insert("teamMembers", {
      teamId,
      odxerId: requesterUid,
      username,
      role: "member",
      joinedAt: now,
    });

    await ctx.db.patch(args.notificationId, { status: "accepted", updatedAt: now });

    // Notify requester
    const captain = await ctx.db.get(args.captainUid);
    await ctx.db.insert("notifications", {
      type: "team_join_decision",
      toUid: requesterUid,
      fromUid: args.captainUid,
      fromUsername: captain?.username || team.captainUsername || "Captain",
      status: "pending",
      teamId,
      teamName: team.name,
      title: "Join Request Accepted",
      body: `Your request to join ${team.name} was accepted!`,
      data: { teamId, teamName: team.name, game: team.game },
      createdAt: now,
      updatedAt: now,
    });

    return { ok: true };
  },
});

// Leave team (for non-captains)
export const leaveTeam = mutation({
  args: {
    teamId: v.id("teams"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("Team not found");

    if (team.captainUid === args.userId) {
      throw new Error("Captains cannot leave. Delete the team instead.");
    }

    if (!team.memberUids.includes(args.userId)) {
      throw new Error("You are not a member of this team");
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

// Request to join team (full version with dedup + snapshot)
export const requestToJoinTeam = mutation({
  args: {
    teamId: v.id("teams"),
    fromUid: v.id("users"),
    fromUsername: v.string(),
  },
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("Team not found");

    if (team.memberCount >= team.maxMembers) throw new Error("Team is full");

    // Already a member?
    if (team.memberUids.includes(args.fromUid)) throw new Error("Already a member");

    // Dedup key
    const entityKey = `team_join_request_${args.teamId}_${args.fromUid}`;

    // Check existing
    const existing = await ctx.db
      .query("notifications")
      .withIndex("by_entityKey", (q) => q.eq("entityKey", entityKey))
      .unique();

    if (existing && existing.status === "pending") {
      if (!existing.expiresAt || existing.expiresAt > Date.now()) {
        throw new Error("Request already pending");
      }
      // Expired - overwrite
      await ctx.db.delete(existing._id);
    } else if (existing) {
      await ctx.db.delete(existing._id);
    }

    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    const notificationId = await ctx.db.insert("notifications", {
      type: "team_join_request",
      toUid: team.captainUid,
      fromUid: args.fromUid,
      fromUsername: args.fromUsername,
      status: "pending",
      entityKey,
      teamId: args.teamId,
      teamName: team.name,
      title: "Join Request",
      body: `${args.fromUsername} wants to join ${team.name}`,
      data: { teamId: args.teamId, teamName: team.name, game: team.game },
      expiresAt: now + sevenDaysMs,
      createdAt: now,
      updatedAt: now,
    });

    return notificationId;
  },
});
