import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Constants
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Helper: Check if room is expired
function isRoomExpired(room: any): boolean {
  if (room.status === "expired" || room.status === "completed" || room.status === "cancelled") {
    return true;
  }
  if (room.expiresAt && Date.now() > room.expiresAt) {
    return true;
  }
  return false;
}

// Helper: Check if room is locked
function isRoomLocked(room: any): boolean {
  if (room.status === "locked" || room.isLocked) return true;
  if (room.currentPlayers >= room.maxPlayers) return true;
  return false;
}

// Slot validator (matching new schema)
const slotValidator = v.object({
  slotId: v.string(),
  uid: v.optional(v.string()),
  user: v.optional(v.object({
    uid: v.string(),
    username: v.string(),
    photoURL: v.optional(v.string()),
    skillTier: v.optional(v.string()),
  })),
  status: v.union(v.literal("open"), v.literal("reserved"), v.literal("confirmed")),
  reservedFor: v.optional(v.object({
    uid: v.string(),
    username: v.string(),
    photoURL: v.optional(v.string()),
  })),
  reservedForUid: v.optional(v.string()),
  role: v.optional(v.string()),
});

// Player validator
const playerValidator = v.object({
  uid: v.string(),
  username: v.string(),
  joinedAt: v.number(),
  role: v.optional(v.string()),
  skillTier: v.optional(v.string()),
  character: v.optional(v.string()),
  favouriteClub: v.optional(v.string()),
  formation: v.optional(v.string()),
});

// ============================================
// QUERIES
// ============================================

// Get matchroom by ID
export const getById = query({
  args: { matchroomId: v.string() },
  handler: async (ctx, args) => {
    try {
      const id = args.matchroomId as Id<"matchrooms">;
      const room = await ctx.db.get(id);
      if (room) {
        return { ...room, id: room._id };
      }
    } catch {
      // Not a valid Convex ID
    }
    return null;
  },
});

// List matchrooms (with optional filters)
export const list = query({
  args: {
    game: v.optional(v.string()),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let matchrooms;

    if (args.status) {
      matchrooms = await ctx.db
        .query("matchrooms")
        .withIndex("by_status", (q) => q.eq("status", args.status as any))
        .order("desc")
        .take(args.limit || 50);
    } else {
      matchrooms = await ctx.db
        .query("matchrooms")
        .withIndex("by_createdAt")
        .order("desc")
        .take(args.limit || 50);
    }

    let filtered = matchrooms.filter((m) => !isRoomExpired(m));

    if (args.game) {
      filtered = filtered.filter((m) => m.game === args.game);
    }

    return filtered.map((m) => ({ ...m, id: m._id }));
  },
});

// List open matchrooms
export const listOpen = query({
  args: {
    game: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const matchrooms = await ctx.db
      .query("matchrooms")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .order("desc")
      .take(args.limit || 50);

    let filtered = matchrooms.filter((m) => !isRoomExpired(m));

    if (args.game) {
      filtered = filtered.filter((m) => m.game === args.game);
    }

    return filtered.map((m) => ({ ...m, id: m._id }));
  },
});

// List matchrooms by host
export const listByHost = query({
  args: { hostUid: v.string() },
  handler: async (ctx, args) => {
    const matchrooms = await ctx.db
      .query("matchrooms")
      .withIndex("by_hostUid", (q) => q.eq("hostUid", args.hostUid))
      .order("desc")
      .collect();

    return matchrooms
      .filter((m) => !isRoomExpired(m))
      .map((m) => ({ ...m, id: m._id }));
  },
});

// List matchrooms where user is a player
export const listByPlayer = query({
  args: { playerUid: v.string() },
  handler: async (ctx, args) => {
    const allMatchrooms = await ctx.db
      .query("matchrooms")
      .withIndex("by_createdAt")
      .order("desc")
      .take(200);

    return allMatchrooms
      .filter((m) => m.playerUids.includes(args.playerUid) && !isRoomExpired(m))
      .map((m) => ({ ...m, id: m._id }));
  },
});

// Get user's matchrooms (hosted + joined)
export const getUserMatchrooms = query({
  args: { uid: v.string() },
  handler: async (ctx, args) => {
    const allMatchrooms = await ctx.db
      .query("matchrooms")
      .withIndex("by_createdAt")
      .order("desc")
      .take(200);

    const hosted = allMatchrooms
      .filter((m) => m.hostUid === args.uid && !isRoomExpired(m))
      .map((m) => ({ ...m, id: m._id }));

    const joined = allMatchrooms
      .filter((m) => m.playerUids.includes(args.uid) && m.hostUid !== args.uid && !isRoomExpired(m))
      .map((m) => ({ ...m, id: m._id }));

    return { hosted, joined };
  },
});

// List matchrooms by zone
export const listByZone = query({
  args: { zoneId: v.string() },
  handler: async (ctx, args) => {
    const matchrooms = await ctx.db
      .query("matchrooms")
      .withIndex("by_zoneId", (q) => q.eq("zoneId", args.zoneId))
      .order("desc")
      .collect();

    return matchrooms
      .filter((m) => !isRoomExpired(m))
      .map((m) => ({ ...m, id: m._id }));
  },
});

// Check if user has time conflict
export const checkTimeConflict = query({
  args: {
    uid: v.string(),
    scheduledStartAt: v.number(),
    durationMinutes: v.number(),
    excludeRoomId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const targetStart = args.scheduledStartAt;
    const targetEnd = targetStart + args.durationMinutes * 60 * 1000;

    const userRooms = await ctx.db
      .query("matchrooms")
      .withIndex("by_createdAt")
      .order("desc")
      .take(100);

    const activeRooms = userRooms.filter((m) =>
      m.playerUids.includes(args.uid) &&
      ["open", "locked", "in-progress"].includes(m.status) &&
      (!args.excludeRoomId || m._id !== args.excludeRoomId)
    );

    for (const room of activeRooms) {
      if (!room.scheduledStartAt) continue;
      const roomStart = room.scheduledStartAt;
      const roomDuration = (room.durationMinutes || 60) * 60 * 1000;
      const roomEnd = roomStart + roomDuration;

      if (targetStart < roomEnd && targetEnd > roomStart) {
        return {
          conflict: true,
          room: { ...room, id: room._id },
          message: `You already have a match scheduled at this time.`,
        };
      }
    }

    return { conflict: false };
  },
});

// ============================================
// MUTATIONS
// ============================================

// Create a new matchroom
export const create = mutation({
  args: {
    hostUid: v.string(),
    hostName: v.string(),
    game: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    maxPlayers: v.number(),
    players: v.array(playerValidator),
    playerUids: v.array(v.string()),

    // Location
    location: v.optional(v.string()),
    locationMode: v.optional(v.string()),
    zoneId: v.optional(v.string()),
    zoneOwnerUid: v.optional(v.string()),

    // Timing
    scheduledDate: v.optional(v.string()),
    scheduledTime: v.optional(v.string()),
    scheduledStartAt: v.optional(v.number()),
    lockAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    durationMinutes: v.optional(v.number()),

    // Pricing
    pricing: v.object({
      perPlayer: v.number(),
      currency: v.string(),
    }),

    // Slots
    slotsA: v.array(slotValidator),
    slotsB: v.array(slotValidator),
    captainUidA: v.optional(v.string()),
    captainUidB: v.optional(v.string()),

    // Game-specific
    format: v.optional(v.string()),
    selectedMaps: v.optional(v.array(v.string())),
    skillLevel: v.optional(v.string()),
    hostSkillTier: v.optional(v.string()),
    hostRole: v.optional(v.string()),

    // Team mode
    teamMode: v.optional(v.string()),
    teamId: v.optional(v.string()),
    teamName: v.optional(v.string()),
    reservedSlots: v.optional(v.number()),
    teamPaymentMode: v.optional(v.string()),

    // Other
    bookingSource: v.optional(v.string()),
    isPrivate: v.optional(v.boolean()),
    paymentStatus: v.optional(v.string()),
    zoneAdminApproved: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const matchroomId = await ctx.db.insert("matchrooms", {
      hostUid: args.hostUid,
      hostName: args.hostName,
      game: args.game,
      title: args.title,
      description: args.description,
      status: "open",
      maxPlayers: args.maxPlayers,
      currentPlayers: args.players.length,
      players: args.players,
      playerUids: args.playerUids,
      location: args.location,
      locationMode: args.locationMode as any,
      zoneId: args.zoneId,
      zoneOwnerUid: args.zoneOwnerUid,
      scheduledDate: args.scheduledDate,
      scheduledTime: args.scheduledTime,
      scheduledStartAt: args.scheduledStartAt,
      lockAt: args.lockAt,
      expiresAt: args.expiresAt,
      durationMinutes: args.durationMinutes,
      pricing: args.pricing,
      slotsA: args.slotsA,
      slotsB: args.slotsB,
      captainUidA: args.captainUidA || args.hostUid,
      captainUidB: args.captainUidB,
      format: args.format,
      selectedMaps: args.selectedMaps,
      skillLevel: args.skillLevel,
      hostSkillTier: args.hostSkillTier,
      hostRole: args.hostRole,
      teamMode: args.teamMode as any,
      teamId: args.teamId,
      teamName: args.teamName,
      reservedSlots: args.reservedSlots,
      teamPaymentMode: args.teamPaymentMode as any,
      bookingSource: args.bookingSource,
      isPrivate: args.isPrivate,
      paymentStatus: args.paymentStatus as any,
      zoneAdminApproved: args.zoneAdminApproved,
      createdAt: now,
      updatedAt: now,
    });

    return matchroomId;
  },
});

// Join matchroom
export const join = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    uid: v.string(),
    username: v.string(),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new Error("Matchroom not found");

    if (isRoomExpired(room)) {
      throw new Error("This matchroom has expired.");
    }

    if (isRoomLocked(room)) {
      throw new Error("This matchroom is locked (no new players allowed).");
    }

    if (room.playerUids.includes(args.uid)) {
      throw new Error("You are already in this matchroom.");
    }

    const newPlayer = {
      uid: args.uid,
      username: args.username,
      joinedAt: Date.now(),
      role: args.role || "Flex",
    };

    const newPlayers = [...room.players, newPlayer];
    const newPlayerUids = [...room.playerUids, args.uid];
    const newPlayerCount = newPlayers.length;
    const willBeFull = newPlayerCount >= room.maxPlayers;

    const updateData: any = {
      players: newPlayers,
      playerUids: newPlayerUids,
      currentPlayers: newPlayerCount,
      updatedAt: Date.now(),
    };

    if (willBeFull) {
      updateData.status = "locked";
      updateData.isLocked = true;
      updateData.lockedAt = Date.now();
    }

    await ctx.db.patch(args.matchroomId, updateData);

    return { ok: true, willBeFull };
  },
});

// Leave matchroom
export const leave = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    uid: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new Error("Matchroom not found");

    const confirmedCount = [...(room.slotsA || []), ...(room.slotsB || [])]
      .filter((s: any) => s?.status === "confirmed").length;
    if (confirmedCount >= room.maxPlayers) {
      throw new Error("Matchroom is locked (all players confirmed). You cannot leave.");
    }

    const updatedPlayers = room.players.filter((p) => p.uid !== args.uid);
    const updatedUids = room.playerUids.filter((uid) => uid !== args.uid);

    const releaseSlot = (slots: any[]) =>
      slots.map((s: any) => {
        if (s.uid === args.uid || s.reservedFor?.uid === args.uid || s.reservedForUid === args.uid) {
          return {
            slotId: s.slotId,
            status: "open" as const,
            role: s.role,
          };
        }
        return s;
      });

    const updatedSlotsA = releaseSlot(room.slotsA || []);
    const updatedSlotsB = releaseSlot(room.slotsB || []);

    await ctx.db.patch(args.matchroomId, {
      players: updatedPlayers,
      playerUids: updatedUids,
      currentPlayers: updatedPlayers.length,
      slotsA: updatedSlotsA,
      slotsB: updatedSlotsB,
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});

// Update matchroom status
export const updateStatus = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    status: v.union(
      v.literal("open"),
      v.literal("in-progress"),
      v.literal("completed"),
      v.literal("locked"),
      v.literal("expired"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    const updateData: any = {
      status: args.status,
      updatedAt: Date.now(),
    };

    if (args.status === "completed") {
      updateData.completedAt = Date.now();
    }
    if (args.status === "locked") {
      updateData.isLocked = true;
      updateData.lockedAt = Date.now();
    }

    await ctx.db.patch(args.matchroomId, updateData);
    return true;
  },
});

// Start match
export const startMatch = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    hostUid: v.string(),
    team2Captain: v.optional(v.string()),
    initialRatings: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.matchroomId, {
      status: "in-progress",
      startTime: Date.now(),
      captainUidA: args.hostUid,
      captainUidB: args.team2Captain,
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});

// Submit captain report
export const submitCaptainReport = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    captainUid: v.string(),
    winner: v.union(v.literal("team1"), v.literal("team2")),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new Error("Matchroom not found");

    const rv = room.resultVerification || { status: "pending" as const };
    const team1Captain = rv.team1Captain || room.hostUid;
    const team2Captain = rv.team2Captain || room.captainUidB ||
      room.players.find((p) => p.uid !== team1Captain)?.uid || "";

    const captainKey = args.captainUid === team1Captain
      ? "team1Captain"
      : args.captainUid === team2Captain
        ? "team2Captain"
        : null;

    if (!captainKey) throw new Error("Only captains can submit a report");

    const captainReports: any = { ...rv.captainReports };
    captainReports[captainKey] = {
      result: args.winner,
      timestamp: Date.now(),
    };

    await ctx.db.patch(args.matchroomId, {
      resultVerification: {
        status: rv.status || "pending",
        team1Captain,
        team2Captain,
        captainReports,
        participantVotes: rv.participantVotes,
        deadline: rv.deadline,
        votes: rv.votes,
      },
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});

// Submit participant vote
export const submitParticipantVote = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    participantUid: v.string(),
    vote: v.union(v.literal("team1"), v.literal("team2"), v.literal("unknown")),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new Error("Matchroom not found");

    const rv = room.resultVerification || { status: "pending" as const };
    const participantVotes = { ...rv.participantVotes, [args.participantUid]: args.vote };

    await ctx.db.patch(args.matchroomId, {
      resultVerification: {
        status: "participant_vote",
        team1Captain: rv.team1Captain,
        team2Captain: rv.team2Captain,
        captainReports: rv.captainReports,
        participantVotes,
        deadline: rv.deadline,
        votes: rv.votes,
      },
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});

// Admin cancel matchroom
export const adminCancel = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    adminUid: v.string(),
    reason: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new Error("Matchroom not found");

    await ctx.db.patch(args.matchroomId, {
      status: "cancelled",
      isLocked: true,
      cancelledBy: args.adminUid,
      cancelledAt: Date.now(),
      cancelReason: args.reason,
      cancelNote: args.note || "",
      updatedAt: Date.now(),
    });

    // Create notifications for all players
    const now = Date.now();
    for (const uid of room.playerUids) {
      const users = await ctx.db
        .query("users")
        .withIndex("by_authId", (q) => q.eq("authId", uid))
        .take(1);

      if (users.length > 0) {
        await ctx.db.insert("notifications", {
          type: "match_cancelled_admin",
          toUid: users[0]._id,
          title: "Matchroom Closed",
          body: `The matchroom "${room.title}" was closed. Reason: ${args.reason}`,
          status: "pending",
          data: {
            matchroomId: args.matchroomId,
            reason: args.reason,
            note: args.note || "",
          },
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return { ok: true, message: "Lobby cancelled and players notified." };
  },
});

// Delete matchroom
export const remove = mutation({
  args: { matchroomId: v.id("matchrooms") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.matchroomId);
    return { ok: true };
  },
});

// Update slots
export const updateSlots = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    slotsA: v.optional(v.array(slotValidator)),
    slotsB: v.optional(v.array(slotValidator)),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new Error("Matchroom not found");

    const updateData: any = { updatedAt: Date.now() };

    if (args.slotsA) {
      updateData.slotsA = args.slotsA;
    }
    if (args.slotsB) {
      updateData.slotsB = args.slotsB;
    }

    // Recalculate playerUids from slots
    const allSlots = [...(args.slotsA || room.slotsA), ...(args.slotsB || room.slotsB)];
    const playerUids = [room.hostUid];
    allSlots.forEach((slot: any) => {
      if (slot.uid && !playerUids.includes(slot.uid)) {
        playerUids.push(slot.uid);
      }
    });
    updateData.playerUids = playerUids;
    updateData.currentPlayers = playerUids.length;

    await ctx.db.patch(args.matchroomId, updateData);
    return { ok: true };
  },
});

// ============================================
// INTERNAL MUTATIONS
// ============================================

// Check and expire matchrooms (called by scheduled job)
export const checkExpiration = internalMutation({
  args: { matchroomId: v.id("matchrooms") },
  handler: async (ctx, args) => {
    const matchroom = await ctx.db.get(args.matchroomId);
    if (matchroom && matchroom.status === "open") {
      await ctx.db.patch(args.matchroomId, {
        status: "expired",
        updatedAt: Date.now(),
      });
    }
  },
});
