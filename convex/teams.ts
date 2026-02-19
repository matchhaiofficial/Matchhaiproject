import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";
import { sendNotification } from "./lib/notifications";

const ROSTER_CAPS: Record<string, number> = {
  cs2: 5,
  fc25: 2,
  fc26: 2,
  tekken8: 2,
  padel: 2,
  pickleball: 2,
  futsal: 7,
  indoor_cricket: 8,
};

const normalizeName = (value: string) => value.trim();
const normalizeNameLower = (value: string) => value.trim().toLowerCase();

async function getTeamById(ctx: any, teamId: string) {
  return await ctx.db.get(teamId as Id<"teams">);
}

export const createTeam = mutation({
  args: {
    name: v.string(),
    game: v.string(),
    description: v.optional(v.string()),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
    maxMembers: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const name = normalizeName(args.name);
    if (!name) throw new ConvexError("Team name required.");

    // Enforce one team per game
    const existingMemberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_memberUid", (q: any) => q.eq("memberUid", user.uid))
      .collect();
    for (const member of existingMemberships) {
      const team = await ctx.db.get(member.teamId as Id<"teams">);
      if (team?.game === args.game) {
        throw new ConvexError(
          `You are already in a ${args.game} team (${team.name}).`
        );
      }
    }

    const nameLower = normalizeNameLower(name);
    const nameCheck = await ctx.db
      .query("teams")
      .withIndex("by_nameLower", (q: any) => q.eq("nameLower", nameLower))
      .unique();
    if (nameCheck) throw new ConvexError("A team with this name already exists.");

    const cap = args.maxMembers ?? ROSTER_CAPS[args.game] ?? 5;
    const now = Date.now();

    const teamId = await ctx.db.insert("teams", {
      name,
      nameLower,
      description: args.description ?? "",
      game: args.game,
      captainUid: user.uid,
      captainUsername: user.username ?? user.displayName ?? "Captain",
      memberUids: [user.uid],
      memberCount: 1,
      maxMembers: cap,
      visibility: args.visibility ?? "public",
      stats: { matchesPlayed: 0, wins: 0, losses: 0, draw: 0 },
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("teamMembers", {
      teamId,
      memberUid: user.uid,
      username: user.username ?? user.displayName ?? "Captain",
      role: "captain",
      joinedAt: now,
      createdAt: now,
    });

    return { ok: true, teamId };
  },
});

export const updateTeam = mutation({
  args: {
    teamId: v.id("teams"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
    logoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const team = await ctx.db.get(args.teamId);
    if (!team) throw new ConvexError("Team not found.");
    if (team.captainUid !== user.uid) throw new ConvexError("Not authorized.");

    const updates: any = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      const name = normalizeName(args.name);
      if (!name) throw new ConvexError("Invalid team name.");
      const nameLower = normalizeNameLower(name);
      const existing = await ctx.db
        .query("teams")
        .withIndex("by_nameLower", (q: any) => q.eq("nameLower", nameLower))
        .unique();
      if (existing && existing._id !== team._id) {
        throw new ConvexError("A team with this name already exists.");
      }
      updates.name = name;
      updates.nameLower = nameLower;
    }
    if (args.description !== undefined) updates.description = args.description ?? "";
    if (args.visibility !== undefined) updates.visibility = args.visibility;
    if (args.logoUrl !== undefined) updates.logoUrl = args.logoUrl ?? null;

    await ctx.db.patch(args.teamId, updates);
    return { ok: true };
  },
});

export const inviteToTeam = mutation({
  args: { teamId: v.id("teams"), toUid: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const team = await ctx.db.get(args.teamId);
    if (!team) throw new ConvexError("Team not found.");
    if (team.captainUid !== user.uid) throw new ConvexError("Not authorized.");
    if ((team.memberUids || []).includes(args.toUid)) {
      return { ok: false, message: "User already in team." };
    }
    if ((team.memberCount || 0) >= (team.maxMembers || 0)) {
      return { ok: false, message: "Team is full." };
    }

    await sendNotification(ctx, {
      type: "team_invite",
      fromUid: user.uid,
      fromUsername: user.username ?? user.displayName ?? "Captain",
      toUid: args.toUid,
      status: "pending",
      entityKey: `team_invite_${team._id}_${args.toUid}`,
      meta: { teamId: team._id, teamName: team.name, game: team.game },
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    return { ok: true };
  },
});

export const respondToTeamInvite = mutation({
  args: {
    notificationId: v.id("notifications"),
    decision: v.union(v.literal("accept"), v.literal("decline")),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const notif = await ctx.db.get(args.notificationId);
    if (!notif) throw new ConvexError("Invite not found.");
    if (notif.toUid !== user.uid) throw new ConvexError("Not authorized.");
    if (notif.type !== "team_invite") throw new ConvexError("Invalid invite.");
    if (notif.status !== "pending") throw new ConvexError("Invite already handled.");

    if (args.decision === "decline") {
      await ctx.db.patch(args.notificationId, { status: "declined", updatedAt: Date.now() });
      return { ok: true };
    }

    const teamId = notif.meta?.teamId as string | undefined;
    if (!teamId) throw new ConvexError("Invite missing team.");
    const team = await ctx.db.get(teamId as Id<"teams">);
    if (!team) throw new ConvexError("Team not found.");

    const memberExists = await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId", (q: any) => q.eq("teamId", teamId))
      .filter((q: any) => q.eq(q.field("memberUid"), user.uid))
      .unique();
    if (memberExists) {
      await ctx.db.patch(args.notificationId, { status: "accepted", updatedAt: Date.now() });
      return { ok: true };
    }

    if ((team.memberCount || 0) >= (team.maxMembers || 0)) {
      throw new ConvexError("Team is full.");
    }

    const now = Date.now();
    await ctx.db.insert("teamMembers", {
      teamId,
      memberUid: user.uid,
      username: user.username ?? user.displayName ?? "Member",
      role: "member",
      joinedAt: now,
      createdAt: now,
    });

    await ctx.db.patch(teamId as Id<"teams">, {
      memberUids: [...(team.memberUids || []), user.uid],
      memberCount: (team.memberCount || 0) + 1,
      updatedAt: now,
    });

    await ctx.db.patch(args.notificationId, { status: "accepted", updatedAt: now });
    return { ok: true };
  },
});

export const requestToJoinTeam = mutation({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const team = await ctx.db.get(args.teamId);
    if (!team) throw new ConvexError("Team not found.");
    if (team.captainUid === user.uid) return { ok: false, message: "You are the captain." };

    await sendNotification(ctx, {
      type: "team_join_request",
      fromUid: user.uid,
      fromUsername: user.username ?? user.displayName ?? "Player",
      toUid: team.captainUid,
      status: "pending",
      entityKey: `team_join_request_${team._id}_${user.uid}`,
      meta: { teamId: team._id, teamName: team.name, game: team.game },
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    return { ok: true };
  },
});

export const respondToJoinRequest = mutation({
  args: {
    notificationId: v.id("notifications"),
    decision: v.union(v.literal("accept"), v.literal("reject")),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const notif = await ctx.db.get(args.notificationId);
    if (!notif) throw new ConvexError("Request not found.");
    if (notif.type !== "team_join_request") throw new ConvexError("Invalid request.");

    const teamId = notif.meta?.teamId as string | undefined;
    if (!teamId) throw new ConvexError("Missing team.");
    const team = await ctx.db.get(teamId as Id<"teams">);
    if (!team) throw new ConvexError("Team not found.");
    if (team.captainUid !== user.uid) throw new ConvexError("Not authorized.");
    if (notif.status !== "pending") throw new ConvexError("Request already handled.");

    if (args.decision === "reject") {
      await ctx.db.patch(args.notificationId, { status: "rejected", updatedAt: Date.now() });
      return { ok: true };
    }

    if ((team.memberCount || 0) >= (team.maxMembers || 0)) {
      throw new ConvexError("Team is full.");
    }

    const fromUid = notif.fromUid;
    if (!fromUid) throw new ConvexError("Request missing sender.");

    const now = Date.now();
    await ctx.db.insert("teamMembers", {
      teamId,
      memberUid: fromUid,
      username: notif.fromUsername ?? "Member",
      role: "member",
      joinedAt: now,
      createdAt: now,
    });

    await ctx.db.patch(teamId as Id<"teams">, {
      memberUids: [...(team.memberUids || []), fromUid],
      memberCount: (team.memberCount || 0) + 1,
      updatedAt: now,
    });

    await ctx.db.patch(args.notificationId, { status: "accepted", updatedAt: now });
    return { ok: true };
  },
});

export const removeMember = mutation({
  args: { teamId: v.id("teams"), memberUid: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const team = await ctx.db.get(args.teamId);
    if (!team) throw new ConvexError("Team not found.");
    if (team.captainUid !== user.uid) throw new ConvexError("Not authorized.");
    if (team.captainUid === args.memberUid) throw new ConvexError("Cannot remove captain.");

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId", (q: any) => q.eq("teamId", team._id))
      .filter((q: any) => q.eq(q.field("memberUid"), args.memberUid))
      .unique();
    if (membership) await ctx.db.delete(membership._id);

    await ctx.db.patch(team._id, {
      memberUids: (team.memberUids || []).filter((uid: string) => uid !== args.memberUid),
      memberCount: Math.max(0, (team.memberCount || 1) - 1),
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});

export const transferCaptain = mutation({
  args: { teamId: v.id("teams"), newCaptainUid: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const team = await ctx.db.get(args.teamId);
    if (!team) throw new ConvexError("Team not found.");
    if (team.captainUid !== user.uid) throw new ConvexError("Not authorized.");

    const member = await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId", (q: any) => q.eq("teamId", team._id))
      .filter((q: any) => q.eq(q.field("memberUid"), args.newCaptainUid))
      .unique();
    if (!member) throw new ConvexError("New captain must be a member.");

    // Update member roles
    await ctx.db.patch(member._id, { role: "captain", updatedAt: Date.now() });
    const oldCaptain = await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId", (q: any) => q.eq("teamId", team._id))
      .filter((q: any) => q.eq(q.field("memberUid"), team.captainUid))
      .unique();
    if (oldCaptain) await ctx.db.patch(oldCaptain._id, { role: "member", updatedAt: Date.now() });

    await ctx.db.patch(team._id, {
      captainUid: args.newCaptainUid,
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});

export const listTeamsForUser = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireUser(ctx);

    const [captainTeams, memberTeams] = await Promise.all([
      ctx.db
        .query("teams")
        .withIndex("by_captainUid", (q: any) => q.eq("captainUid", user.uid))
        .collect(),
      ctx.db
        .query("teams")
        .filter((q: any) => q.contains(q.field("memberUids"), user.uid))
        .collect(),
    ]);

    const map = new Map<string, any>();
    captainTeams.forEach((team) => map.set(team._id, team));
    memberTeams.forEach((team) => map.set(team._id, team));

    return Array.from(map.values()).sort(
      (a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0),
    );
  },
});

export const listPublicTeams = query({
  args: {
    game: v.optional(v.string()),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
    let q = ctx.db
      .query("teams")
      .withIndex("by_visibility", (q: any) => q.eq("visibility", "public"))
      .order("desc");

    let items = await q.take(200);
    if (args.game && args.game !== "all") {
      items = items.filter((t) => t.game === args.game);
    }
    if (args.search) {
      const search = args.search.toLowerCase();
      items = items.filter((t) => (t.nameLower || t.name || "").toLowerCase().includes(search));
    }
    return items.slice(0, limit);
  },
});

export const getTeam = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) return null;
    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId", (q: any) => q.eq("teamId", team._id))
      .collect();
    return { ...team, members };
  },
});
