import {
  query,
  mutation,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { api, internal } from "./_generated/api";
import { KYC_VERIFICATION_REQUIRED_MESSAGE, assertKycAccessAllowed } from "./kycGate";

function doesUserPlayGame(user: any, game: string): boolean {
  switch (game) {
    case "cs2": return !!user?.playsCs2;
    case "cs16": return !!user?.playsCs16;
    case "valorant": return !!user?.playsValorant;
    case "fc25":
    case "fc26": return !!user?.playsFc;
    case "tekken8": return !!user?.playsTekken;
    case "futsal": return !!user?.playsFutsal;
    case "indoor_cricket": return !!user?.playsIndoorCricket;
    case "padel": return !!user?.playsPadel;
    case "pickleball": return !!user?.playsPickleball;
    default: return false;
  }
}

function getGameLabel(game: string): string {
  const labels: Record<string, string> = {
    cs2: "CS2", cs16: "CS 1.6", valorant: "Valorant",
    fc25: "FC26", fc26: "FC26", tekken8: "Tekken 8",
    futsal: "Futsal", indoor_cricket: "Indoor Cricket",
    padel: "Padel", pickleball: "Pickleball",
  };
  return labels[game] || game.toUpperCase();
}

function getRosterRule(game: string) {
  const key = String(game || "").toLowerCase();
  if (key === "cs2" || key === "cs16" || key === "valorant") {
    return { mainSize: 5, maxSubstitutes: 2 };
  }
  if (key === "fc25" || key === "fc26" || key === "tekken8") {
    return { mainSize: 2, maxSubstitutes: 1 };
  }
  return { mainSize: 5, maxSubstitutes: 0 };
}

function getTeamMainRosterSize(team: any) {
  const configured = Number(team?.mainRosterSize || 0);
  if (Number.isFinite(configured) && configured > 0) return configured;
  return getRosterRule(team?.game).mainSize;
}

function getTeamSubstituteSlots(team: any) {
  const configured = Number(team?.maxSubstitutes);
  if (Number.isFinite(configured) && configured >= 0) return configured;
  const maxMembers = Number(team?.maxMembers || 0);
  return Math.max(0, Math.min(getRosterRule(team?.game).maxSubstitutes, maxMembers - getTeamMainRosterSize(team)));
}

function getTeamRosterCapacity(team: any) {
  return getTeamMainRosterSize(team) + getTeamSubstituteSlots(team);
}

function isTeamDeleted(team: any) {
  return Boolean(team?.deletedAt || team?.status === "deleted");
}

function isActiveTeam(team: any) {
  return Boolean(team) && !isTeamDeleted(team);
}

function assertActiveTeam<T>(team: T | null | undefined, message = "Team not found"): asserts team is NonNullable<T> {
  if (!isActiveTeam(team)) throw new Error(message);
}

async function getNextRosterRole(ctx: any, team: any) {
  const mainSize = getTeamMainRosterSize(team);
  const members = await ctx.db
    .query("teamMembers")
    .withIndex("by_teamId", (q: any) => q.eq("teamId", team._id))
    .collect();
  const sortedMembers = members.sort((a: any, b: any) => Number(a.rosterOrder ?? 0) - Number(b.rosterOrder ?? 0));
  const mainCount = sortedMembers.filter((member: any, index: number) => {
    const fallbackRole = index < mainSize ? "main" : "substitute";
    return (member.rosterRole || fallbackRole) === "main";
  }).length;
  return mainCount < mainSize ? "main" : "substitute";
}

async function resolveUserByAnyId(ctx: any, value?: string | null) {
  if (!value) return null;

  try {
    const directUser = await ctx.db.get(value);
    if (directUser) return directUser;
  } catch {
    // Not a valid Convex document id.
  }

  return await ctx.db
    .query("users")
    .withIndex("by_authId", (q: any) => q.eq("authId", value))
    .unique();
}

async function getAuthenticatedConvexUser(ctx: any, expectedUid?: string) {
  let authUser: Awaited<ReturnType<typeof authComponent.getAuthUser>> | null = null;
  try {
    authUser = await authComponent.getAuthUser(ctx);
  } catch {
    authUser = null;
  }

  const expectedUser = await resolveUserByAnyId(ctx, expectedUid);
  console.log("[teams] auth gate", {
    authId: authUser?.userId ?? null,
    email: authUser?.email ?? null,
    expectedUid: expectedUid ?? null,
    expectedAuthId: expectedUser?.authId ?? null,
  });

  if (authUser?.userId) {
    const user = await resolveUserByAnyId(ctx, authUser.userId);
    if (!user) {
      throw new Error("User profile not found");
    }
    assertKycAccessAllowed(user, KYC_VERIFICATION_REQUIRED_MESSAGE);
    if (expectedUser && expectedUser._id !== user._id) {
      throw new Error("You can only perform this action for your own account");
    }
    return user;
  }

  if (!expectedUser) {
    throw new Error("Not authenticated");
  }
  assertKycAccessAllowed(expectedUser, KYC_VERIFICATION_REQUIRED_MESSAGE);

  return expectedUser;
}

// ============================================
// QUERIES
// ============================================

// Get team by ID
export const getById = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    return isActiveTeam(team) ? team : null;
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
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_captainUid", (q) => q.eq("captainUid", args.captainUid))
      .collect();

    return teams.filter(isActiveTeam);
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

    return teams.filter(isActiveTeam);
  },
});

// List teams by game
export const listByGame = query({
  args: { game: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_game", (q) => q.eq("game", args.game))
      .take(200);

    return teams.filter(isActiveTeam).slice(0, args.limit || 50);
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
      .filter((t) => isActiveTeam(t) && t.nameLower.includes(searchLower))
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

    return allTeams.filter((t) => isActiveTeam(t) && t.memberUids.includes(args.uid));
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

    return teams.filter((t) => isActiveTeam(t) && t.memberUids.includes(args.uid));
  },
});

// Get team by ID (string version for compatibility)
export const getByIdString = query({
  args: { teamId: v.string() },
  handler: async (ctx, args) => {
    try {
      const id = args.teamId as any;
      const team = await ctx.db.get(id);
      if (isActiveTeam(team)) {
        const activeTeam = team as NonNullable<typeof team>;
        return { ...activeTeam, id: activeTeam._id };
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
    mainRosterSize: v.optional(v.number()),
    maxSubstitutes: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<any> => {
    const actor = await getAuthenticatedConvexUser(ctx, args.captainUid);
    if (actor._id !== args.captainUid) {
      throw new Error("You can only create a team for your own account");
    }

    const now = Date.now();
    const rule = getRosterRule(args.game);
    const mainRosterSize = args.mainRosterSize || rule.mainSize;
    const maxSubstitutes = Math.max(0, Math.min(args.maxSubstitutes ?? 0, rule.maxSubstitutes));
    const maxMembers = args.maxMembers || mainRosterSize + maxSubstitutes;

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
      maxMembers,
      mainRosterSize,
      maxSubstitutes,
      description: args.description,
      stats: {
        wins: 0,
        losses: 0,
        matchesPlayed: 0,
      },
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    // Create captain's member record
    await ctx.db.insert("teamMembers", {
      teamId,
      odxerId: args.captainUid,
      username: args.captainUsername,
      role: "captain",
      rosterRole: "main",
      rosterOrder: 0,
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

    const team = await ctx.db.get(teamId);
    assertActiveTeam(team);

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
    const actor = await getAuthenticatedConvexUser(ctx, args.userId);
    if (actor._id !== args.userId) {
      throw new Error("You can only join a team as yourself");
    }

    const team = await ctx.db.get(args.teamId);
    assertActiveTeam(team);

    // Check if already a member
    if (team.memberUids.includes(args.userId)) {
      throw new Error("User is already a member");
    }

    // Check roster cap
    if (team.memberCount >= getTeamRosterCapacity(team)) {
      throw new Error("Team is full");
    }

    // Check player has this game in their profile
    if (team.game && !doesUserPlayGame(actor, team.game)) {
      const label = getGameLabel(team.game);
      throw new Error(`You need to add ${label} to your game profile before joining this team. Go to Edit Profile → Games to add it.`);
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
      rosterRole: await getNextRosterRole(ctx, team),
      rosterOrder: team.memberCount,
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
    assertActiveTeam(team);

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

    const now = Date.now();

    await ctx.db.patch(args.teamId, {
      memberUids,
      memberCount: team.memberCount - 1,
      updatedAt: now,
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

    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "team.member_removed",
      toUid: args.userId,
      fromUid: team.captainUid,
      fromUsername: team.captainUsername || "Captain",
      status: "pending",
      dedupeKey: `team.member_removed:${String(args.teamId)}:${String(args.userId)}:${now}`,
      dedupePolicy: "versioned_new",
      teamId: args.teamId,
      teamName: team.name,
      route: "/teams",
      title: "Removed from team",
      body: `You were removed from ${team.name}.`,
      data: {
        teamId: String(args.teamId),
        teamName: team.name,
        game: team.game,
        href: "/teams",
      },
    });

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
    assertActiveTeam(team);
    const previousCaptainUid = team.captainUid;
    const previousCaptainUsername = team.captainUsername || "Captain";

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

    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "team.captain_transferred",
      toUid: args.newCaptainUid,
      fromUid: previousCaptainUid,
      fromUsername: previousCaptainUsername,
      status: "pending",
      dedupeKey: `team.captain_transferred:${String(args.teamId)}:${String(args.newCaptainUid)}:${now}`,
      dedupePolicy: "versioned_new",
      teamId: args.teamId,
      teamName: team.name,
      route: `/teams/${args.teamId}`,
      title: "You are now captain",
      body: `Captaincy for ${team.name} was transferred to you.`,
      data: {
        teamId: String(args.teamId),
        teamName: team.name,
        game: team.game,
        href: `/teams/${args.teamId}`,
      },
    });

    if (String(previousCaptainUid) !== String(args.newCaptainUid)) {
      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: "team.captain_transferred",
        toUid: previousCaptainUid,
        fromUid: args.newCaptainUid,
        fromUsername: args.newCaptainUsername,
        status: "pending",
        dedupeKey: `team.captain_transferred:${String(args.teamId)}:${String(previousCaptainUid)}:${now}`,
        dedupePolicy: "versioned_new",
        teamId: args.teamId,
        teamName: team.name,
        route: `/teams/${args.teamId}`,
        title: "Captaincy transferred",
        body: `You transferred captaincy of ${team.name} to ${args.newCaptainUsername}.`,
        data: {
          teamId: String(args.teamId),
          teamName: team.name,
          game: team.game,
          href: `/teams/${args.teamId}`,
        },
      });
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
    assertActiveTeam(team);

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
    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("Team not found");
    if (isTeamDeleted(team)) return true;

    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .collect();

    const notifiedMemberIds = new Set<string>();
    const recipientIds = [
      team.captainUid,
      ...members.map((member) => member.odxerId),
      ...team.memberUids,
    ].filter(Boolean);
    const now = Date.now();
    for (const memberId of recipientIds) {
      const memberKey = String(memberId);
      if (!memberId || notifiedMemberIds.has(memberKey)) continue;
      notifiedMemberIds.add(memberKey);
      const memberUser = await resolveUserByAnyId(ctx, memberKey);
      if (!memberUser) continue;
      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: "team.deleted",
        toUid: memberUser._id,
        fromUid: team.captainUid,
        fromUsername: team.captainUsername || "Captain",
        status: "pending",
        dedupeKey: `team.deleted:${String(args.teamId)}:${memberId}:${now}`,
        dedupePolicy: "versioned_new",
        teamId: args.teamId,
        teamName: team.name,
        route: `/teams/${String(args.teamId)}`,
        title: "Team deleted",
        body: `${team.name} was deleted.`,
        data: {
          teamId: String(args.teamId),
          teamName: team.name,
          game: team.game,
          href: `/teams/${String(args.teamId)}`,
        },
      });
    }

    await ctx.db.patch(args.teamId, {
      status: "deleted",
      deletedAt: now,
      deletedByUid: team.captainUid,
      updatedAt: now,
    });
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

    const existingTeam = allTeams.find((t) => isActiveTeam(t) && t.memberUids.includes(args.uid));
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
    const existingTeams = await ctx.db
      .query("teams")
      .withIndex("by_nameLower", (q) => q.eq("nameLower", args.name.toLowerCase()))
      .collect();
    return !existingTeams.some(isActiveTeam);
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
    assertActiveTeam(team);
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
    const entityKey = `team.invite:${args.teamId}:${args.toUid}`;

    // Check for existing pending invite
    const existing = await ctx.db
      .query("notifications")
      .withIndex("by_entityKey", (q) => q.eq("entityKey", entityKey))
      .unique();

    if (existing && existing.status === "pending") {
      if (!existing.expiresAt || existing.expiresAt > Date.now()) {
        return {
          ok: true,
          notificationId: existing._id,
          alreadyPending: true,
          message: "Invitation already pending",
        };
      }
      // Expired - delete old one
      await ctx.db.delete(existing._id);
    } else if (existing) {
      await ctx.db.delete(existing._id);
    }

    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    const fromUser = await ctx.db.get(args.fromUid);

    const notificationResult: any = await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "team.invite",
      toUid: args.toUid,
      fromUid: args.fromUid,
      fromUsername: fromUser?.username || team.captainUsername || "Captain",
      status: "pending",
      dedupeKey: entityKey,
      dedupePolicy: "replace_active",
      teamId: args.teamId,
      teamName: team.name,
      route: `/teams/${args.teamId}`,
      title: "Team Invite",
      body: `You've been invited to join ${team.name}`,
      data: { teamId: args.teamId, teamName: team.name, game: team.game, href: `/teams/${args.teamId}` },
      expiresAt: now + sevenDaysMs,
    });

    return {
      ok: true,
      notificationId: notificationResult.notificationId,
      alreadyPending: false,
      message: "Invitation sent",
    };
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
    if (!["team_invite", "team.invite"].includes(String(notif.type || ""))) {
      throw new Error("Invalid notification type");
    }
    if (notif.toUid !== args.userId) throw new Error("Not authorized");
    if (notif.status !== "pending") throw new Error("Invite already processed");

    // Expiry check
    if (notif.expiresAt && notif.expiresAt < Date.now()) {
      throw new Error("Invitation has expired");
    }

    const now = Date.now();
    const invitee = await ctx.db.get(args.userId);
    const inviteeName = invitee?.username || invitee?.fullName || "Player";

    if (!args.accept) {
      await ctx.db.patch(args.notificationId, { status: "declined", updatedAt: now });
      if (notif.fromUid) {
        await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
          type: "team.invite_response",
          toUid: notif.fromUid,
          fromUid: args.userId,
          fromUsername: inviteeName,
          status: "pending",
          dedupeKey: `team.invite_response:${String(args.notificationId)}:declined`,
          dedupePolicy: "replace_active",
          teamId: notif.teamId,
          teamName: notif.teamName,
          route: `/teams/${String(notif.teamId)}`,
          title: "Team Invite Declined",
          body: `${inviteeName} declined your invite to ${notif.teamName || "the team"}.`,
          data: {
            teamId: String(notif.teamId || ""),
            teamName: notif.teamName || null,
            decision: "declined",
            inviteNotificationId: String(args.notificationId),
            href: `/teams/${String(notif.teamId || "")}`,
          },
        });
      }
      return { ok: true, message: "Invite declined." };
    }

    // Accept: get team
    const teamId = notif.teamId;
    if (!teamId) throw new Error("Team reference missing");

    const team = await ctx.db.get(teamId);
    assertActiveTeam(team, "Team no longer exists");

    // Check user not already in a team for this game
    const gameTeams = await ctx.db
      .query("teams")
      .withIndex("by_game", (q) => q.eq("game", team.game))
      .collect();
    const existingTeam = gameTeams.find((t) => isActiveTeam(t) && t.memberUids.includes(args.userId) && t._id !== teamId);
    if (existingTeam) {
      throw new Error(`You are already in a ${team.game} team (${existingTeam.name}). You must leave it to join a new one.`);
    }

    // Already a member check
    if (team.memberUids.includes(args.userId)) {
      await ctx.db.patch(args.notificationId, { status: "accepted", updatedAt: now });
      return { ok: true, message: "Already a member." };
    }

    // Capacity check
    if (team.memberCount >= getTeamRosterCapacity(team)) {
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
      rosterRole: await getNextRosterRole(ctx, team),
      rosterOrder: team.memberCount,
      joinedAt: now,
    });

    await ctx.db.patch(args.notificationId, { status: "accepted", updatedAt: now });

    if (notif.fromUid) {
      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: "team.invite_response",
        toUid: notif.fromUid,
        fromUid: args.userId,
        fromUsername: username,
        status: "pending",
        dedupeKey: `team.invite_response:${String(args.notificationId)}:accepted`,
        dedupePolicy: "replace_active",
        teamId,
        teamName: team.name,
        route: `/teams/${teamId}`,
        title: "Team Invite Accepted",
        body: `${username} accepted your invite to join ${team.name}.`,
        data: {
          teamId: String(teamId),
          teamName: team.name,
          decision: "accepted",
          inviteNotificationId: String(args.notificationId),
          href: `/teams/${teamId}`,
        },
      });
    }

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
    assertActiveTeam(team);
    if (team.captainUid !== args.captainUid) throw new Error("Only the current captain can respond");

    if (!args.accept) {
      await ctx.db.patch(args.notificationId, { status: "rejected", updatedAt: now });
      const captain = await ctx.db.get(args.captainUid);
      if (notif.fromUid) {
        await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
          type: "team.join_request_decision",
          toUid: notif.fromUid,
          fromUid: args.captainUid,
          fromUsername: captain?.username || team.captainUsername || "Captain",
          status: "pending",
          teamId,
          teamName: team.name,
          dedupeKey: `team.join_request_decision:${teamId}:${String(notif.fromUid)}:rejected`,
          dedupePolicy: "replace_active",
          route: `/teams/${teamId}`,
          title: "Join Request Rejected",
          body: `Your request to join ${team.name} was declined.`,
          data: { teamId, teamName: team.name, game: team.game, decision: "rejected", href: `/teams/${teamId}` },
        });
      }
      return { ok: true };
    }

    // Accept flow
    const requesterUid = notif.fromUid;
    if (!requesterUid) throw new Error("Requester not found");

    // Check capacity
    if (team.memberCount >= getTeamRosterCapacity(team)) {
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
    const existingTeam = gameTeams.find((t) => isActiveTeam(t) && t.memberUids.includes(requesterUid) && t._id !== teamId);
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
      rosterRole: await getNextRosterRole(ctx, team),
      rosterOrder: team.memberCount,
      joinedAt: now,
    });

    await ctx.db.patch(args.notificationId, { status: "accepted", updatedAt: now });

    // Notify requester
    const captain = await ctx.db.get(args.captainUid);
    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "team.join_request_decision",
      toUid: requesterUid,
      fromUid: args.captainUid,
      fromUsername: captain?.username || team.captainUsername || "Captain",
      status: "pending",
      teamId,
      teamName: team.name,
      dedupeKey: `team.join_request_decision:${teamId}:${requesterUid}:accepted`,
      dedupePolicy: "replace_active",
      route: `/teams/${teamId}`,
      title: "Join Request Accepted",
      body: `Your request to join ${team.name} was accepted!`,
      data: { teamId, teamName: team.name, game: team.game, decision: "accepted", href: `/teams/${teamId}` },
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
    assertActiveTeam(team);

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
  handler: async (ctx, args): Promise<any> => {
    const actor = await getAuthenticatedConvexUser(ctx, args.fromUid);
    if (actor._id !== args.fromUid) {
      throw new Error("You can only request to join a team as yourself");
    }

    const team = await ctx.db.get(args.teamId);
    assertActiveTeam(team);

    if (team.memberCount >= getTeamRosterCapacity(team)) throw new Error("Team is full");

    // Check player has this game in their profile
    if (team.game && !doesUserPlayGame(actor, team.game)) {
      const label = getGameLabel(team.game);
      throw new Error(`You need to add ${label} to your game profile before joining this team. Go to Edit Profile → Games to add it.`);
    }

    // Already a member?
    if (team.memberUids.includes(args.fromUid)) throw new Error("Already a member");

    // Dedup key
    const entityKey = `team.join_request:${args.teamId}:${args.fromUid}`;

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

    const notificationResult: any = await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "team.join_request",
      toUid: team.captainUid,
      fromUid: args.fromUid,
      fromUsername: args.fromUsername,
      status: "pending",
      dedupeKey: entityKey,
      dedupePolicy: "upsert_active",
      teamId: args.teamId,
      teamName: team.name,
      route: `/teams/${args.teamId}`,
      title: "Join Request",
      body: `${args.fromUsername} wants to join ${team.name}`,
      data: { teamId: args.teamId, teamName: team.name, game: team.game, href: `/teams/${args.teamId}` },
      expiresAt: now + sevenDaysMs,
    });

    return notificationResult.notificationId;
  },
});
