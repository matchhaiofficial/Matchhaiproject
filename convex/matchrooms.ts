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

// Get matchroom by matchCode (fallback lookup)
export const getByMatchCode = query({
  args: { matchCode: v.string() },
  handler: async (ctx, args) => {
    const rooms = await ctx.db
      .query("matchrooms")
      .filter((q) => q.eq(q.field("matchCode"), args.matchCode))
      .take(1);
    if (rooms.length > 0) {
      return { ...rooms[0], id: rooms[0]._id };
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

// Invite to matchroom (creates notification)
export const inviteToMatchroom = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    fromUid: v.string(),
    fromUsername: v.string(),
    toUid: v.id("users"),
    team: v.union(v.literal("A"), v.literal("B")),
    slotId: v.string(),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new Error("Matchroom not found");

    // Verify captain
    const captainUid = args.team === "A"
      ? (room.captainUidA || room.hostUid)
      : room.captainUidB;
    if (captainUid !== args.fromUid) {
      throw new Error(`Only the captain of Team ${args.team} can send invitations for this team.`);
    }

    // Not already in room
    if (room.playerUids.includes(args.toUid)) {
      throw new Error("User is already in this matchroom.");
    }

    const entityKey = `match_invite_${args.matchroomId}_${args.toUid}_${args.slotId}`;
    const now = Date.now();
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;

    // Get fromUser Convex ID
    const fromUsers = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.fromUid))
      .take(1);
    const fromUserId = fromUsers[0]?._id;

    const notifId = await ctx.db.insert("notifications", {
      type: "match_seat_invitation",
      toUid: args.toUid,
      fromUid: fromUserId,
      fromUsername: args.fromUsername,
      status: "pending",
      entityKey,
      matchroomId: args.matchroomId,
      title: "Matchroom Invite",
      body: `You've been invited to join ${room.title}`,
      data: {
        matchroomId: args.matchroomId,
        matchroomTitle: room.title,
        team: args.team,
        slotId: args.slotId,
        role: args.role || "Flex",
        game: room.game,
      },
      expiresAt: now + twoDaysMs,
      createdAt: now,
      updatedAt: now,
    });

    return notifId;
  },
});

// Respond to matchroom invite
export const respondToMatchroomInvite = mutation({
  args: {
    notificationId: v.id("notifications"),
    userId: v.id("users"),
    accept: v.boolean(),
  },
  handler: async (ctx, args) => {
    const notif = await ctx.db.get(args.notificationId);
    if (!notif) throw new Error("Notification not found");
    if (notif.status !== "pending") throw new Error("Invitation already handled.");

    const now = Date.now();

    if (!args.accept) {
      await ctx.db.patch(args.notificationId, { status: "declined", updatedAt: now });
      return { ok: true };
    }

    // Get user
    const user = await ctx.db.get(args.userId);
    const username = user?.username || "Player";

    const data = notif.data as any;
    const matchroomId = notif.matchroomId || data?.matchroomId;
    if (!matchroomId) throw new Error("Matchroom reference missing");

    const room = await ctx.db.get(matchroomId as Id<"matchrooms">);
    if (!room) throw new Error("Matchroom not found.");

    // Already in room
    if (room.playerUids.includes(args.userId as string)) {
      throw new Error("You are already in this matchroom.");
    }

    const team = data?.team;
    const slotId = data?.slotId;
    const role = data?.role || "Flex";

    // Find and fill slot
    const slots: any[] = team === "A" ? [...(room.slotsA || [])] : [...(room.slotsB || [])];
    const slotIdx = slots.findIndex((s: any) => s.slotId === slotId);
    if (slotIdx === -1) throw new Error("Target slot not found.");
    if (slots[slotIdx].user || slots[slotIdx].uid) throw new Error("This slot is already taken.");

    slots[slotIdx] = {
      ...slots[slotIdx],
      uid: args.userId as string,
      user: { uid: args.userId as string, username },
      status: "confirmed" as const,
      role,
    };

    const newPlayers = [...room.players, {
      uid: args.userId as string,
      username,
      joinedAt: now,
      role,
    }];
    const newPlayerUids = [...room.playerUids, args.userId as string];
    const newPlayerCount = newPlayers.length;
    const willBeFull = newPlayerCount >= room.maxPlayers;

    const updateData: any = {
      [team === "A" ? "slotsA" : "slotsB"]: slots,
      players: newPlayers,
      playerUids: newPlayerUids,
      currentPlayers: newPlayerCount,
      updatedAt: now,
    };

    if (willBeFull) {
      updateData.status = "locked";
      updateData.isLocked = true;
      updateData.lockedAt = now;
    }

    await ctx.db.patch(matchroomId as Id<"matchrooms">, updateData);
    await ctx.db.patch(args.notificationId, { status: "accepted", updatedAt: now });

    // Add to chatroom participants
    const chatrooms = await ctx.db
      .query("chatrooms")
      .withIndex("by_matchroomId", (q) => q.eq("matchroomId", matchroomId as Id<"matchrooms">))
      .take(1);
    if (chatrooms.length > 0) {
      const chat = chatrooms[0];
      const participantUids = [...(chat.participantUids || [])];
      if (!participantUids.includes(args.userId as string)) {
        participantUids.push(args.userId as string);
        await ctx.db.patch(chat._id, { participantUids, updatedAt: now });
      }
    }

    return { ok: true, willBeFull };
  },
});

// Respond to matchroom join request (host accepts/rejects)
export const respondToMatchroomJoinRequest = mutation({
  args: {
    notificationId: v.id("notifications"),
    hostUid: v.string(),
    accept: v.boolean(),
  },
  handler: async (ctx, args) => {
    const notif = await ctx.db.get(args.notificationId);
    if (!notif) throw new Error("Request not found");
    if (notif.type !== "match_join_request") throw new Error("Invalid notification type");
    if (notif.status !== "pending") throw new Error("Request already handled");

    const now = Date.now();
    const data = notif.data as any;
    const matchroomId = notif.matchroomId || data?.matchroomId;
    if (!matchroomId) throw new Error("Matchroom ID missing from request");

    const room = await ctx.db.get(matchroomId as Id<"matchrooms">);
    if (!room) throw new Error("Matchroom not found");

    if (room.hostUid !== args.hostUid) {
      throw new Error("Only the host can respond to join requests");
    }

    if (isRoomExpired(room)) {
      await ctx.db.patch(args.notificationId, { status: "rejected", updatedAt: now });
      return { ok: false, message: "Matchroom expired." };
    }

    if (!args.accept) {
      await ctx.db.patch(args.notificationId, { status: "rejected", updatedAt: now });
      return { ok: true, message: "Request rejected." };
    }

    const requesterUid = notif.fromUid ? (await ctx.db.get(notif.fromUid))?.authId || (notif.fromUid as string) : "";
    const requesterUsername = notif.fromUsername || "Player";
    const role = data?.role || "Flex";
    const targetTeam = data?.targetTeam || role;

    if ((room.currentPlayers || 0) >= room.maxPlayers) {
      await ctx.db.patch(args.notificationId, { status: "rejected", updatedAt: now });
      throw new Error("Matchroom is full");
    }

    // Check if already in room
    const fromUidStr = notif.data?.fromAuthId || requesterUid;
    if (room.playerUids.includes(fromUidStr)) {
      await ctx.db.patch(args.notificationId, { status: "accepted", updatedAt: now });
      return { ok: true, message: "User is already in the matchroom." };
    }

    // Add player
    const newPlayers = [...room.players, {
      uid: fromUidStr,
      username: requesterUsername,
      joinedAt: now,
      role,
    }];
    const newPlayerUids = [...room.playerUids, fromUidStr];
    const newPlayerCount = newPlayers.length;
    const willBeFull = newPlayerCount >= room.maxPlayers;

    const updateData: any = {
      players: newPlayers,
      playerUids: newPlayerUids,
      currentPlayers: newPlayerCount,
      updatedAt: now,
    };

    // Slot assignment
    const slotsA = [...(room.slotsA || [])];
    const slotsB = [...(room.slotsB || [])];
    const requestedSlotId = data?.slotId;

    const assignToSlots = (slots: any[], slotId?: string) => {
      let idx = -1;
      if (slotId) {
        idx = slots.findIndex((s: any) => s.slotId === slotId && !s.user && !s.uid);
      } else {
        idx = slots.findIndex((s: any) => !s.user && !s.uid);
      }
      if (idx === -1) return { slots, assigned: false };
      const updated = [...slots];
      updated[idx] = {
        ...updated[idx],
        uid: fromUidStr,
        user: { uid: fromUidStr, username: requesterUsername },
        status: "confirmed" as const,
        role,
      };
      return { slots: updated, assigned: true };
    };

    let assigned = false;
    if (slotsA.length > 0 || slotsB.length > 0) {
      if (requestedSlotId) {
        const resA = assignToSlots(slotsA, requestedSlotId);
        if (resA.assigned) {
          updateData.slotsA = resA.slots;
          assigned = true;
        } else {
          const resB = assignToSlots(slotsB, requestedSlotId);
          if (resB.assigned) {
            updateData.slotsB = resB.slots;
            assigned = true;
            if (!room.captainUidB) updateData.captainUidB = fromUidStr;
          }
        }
      }

      if (!assigned) {
        if (targetTeam === "Team A" || targetTeam === "A") {
          const resA = assignToSlots(slotsA);
          if (resA.assigned) { updateData.slotsA = resA.slots; assigned = true; }
        } else if (targetTeam === "Team B" || targetTeam === "B") {
          const resB = assignToSlots(slotsB);
          if (resB.assigned) {
            updateData.slotsB = resB.slots;
            assigned = true;
            if (!room.captainUidB) updateData.captainUidB = fromUidStr;
          }
        } else {
          const resA = assignToSlots(slotsA);
          if (resA.assigned) { updateData.slotsA = resA.slots; assigned = true; }
          else {
            const resB = assignToSlots(slotsB);
            if (resB.assigned) {
              updateData.slotsB = resB.slots;
              assigned = true;
              if (!room.captainUidB) updateData.captainUidB = fromUidStr;
            }
          }
        }
      }

      if (!assigned) {
        await ctx.db.patch(args.notificationId, { status: "rejected", updatedAt: now });
        return { ok: false, message: "No available slot for this matchroom." };
      }
    }

    if (willBeFull) {
      updateData.status = "locked";
      updateData.isLocked = true;
      updateData.lockedAt = now;
    }

    await ctx.db.patch(matchroomId as Id<"matchrooms">, updateData);
    await ctx.db.patch(args.notificationId, { status: "accepted", updatedAt: now });

    return { ok: true, message: "Player added to matchroom." };
  },
});

// Kick player from matchroom
export const kickFromMatchroom = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    callerUid: v.string(),
    playerUid: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.playerUid === args.callerUid) throw new Error("You cannot kick yourself.");

    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new Error("Matchroom not found.");

    const isHost = room.hostUid === args.callerUid;
    const slotsA = room.slotsA || [];
    const slotsB = room.slotsB || [];
    const inTeamA = slotsA.some((s: any) => s.uid === args.playerUid);
    const inTeamB = slotsB.some((s: any) => s.uid === args.playerUid);
    const isCaptainA = room.captainUidA === args.callerUid;
    const isCaptainB = room.captainUidB === args.callerUid;
    const canKick = isHost || (inTeamA && isCaptainA) || (inTeamB && isCaptainB);

    if (!canKick) throw new Error("You do not have permission to kick this player.");

    const updatedPlayers = room.players.filter((p) => p.uid !== args.playerUid);
    const updatedUids = room.playerUids.filter((uid) => uid !== args.playerUid);

    const releaseSlot = (slots: any[]) =>
      slots.map((s: any) => {
        if (s.uid === args.playerUid || s.reservedForUid === args.playerUid) {
          return { slotId: s.slotId, status: "open" as const, role: s.role };
        }
        return s;
      });

    const now = Date.now();
    const updates: any = {
      players: updatedPlayers,
      playerUids: updatedUids,
      currentPlayers: updatedPlayers.length,
      slotsA: releaseSlot(slotsA),
      slotsB: releaseSlot(slotsB),
      updatedAt: now,
    };

    if (room.captainUidA === args.playerUid) updates.captainUidA = undefined;
    if (room.captainUidB === args.playerUid) updates.captainUidB = undefined;

    await ctx.db.patch(args.matchroomId, updates);

    // Remove from chatroom
    const chatrooms = await ctx.db
      .query("chatrooms")
      .withIndex("by_matchroomId", (q) => q.eq("matchroomId", args.matchroomId))
      .take(1);
    if (chatrooms.length > 0) {
      const chat = chatrooms[0];
      const participantUids = (chat.participantUids || []).filter((uid) => uid !== args.playerUid);
      await ctx.db.patch(chat._id, { participantUids, updatedAt: now });
    }

    return { ok: true, message: "Player kicked successfully." };
  },
});

// Transfer matchroom captain
export const transferMatchroomCaptain = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    callerUid: v.string(),
    team: v.union(v.literal("A"), v.literal("B")),
    newCaptainUid: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new Error("Matchroom not found");

    const currentCaptainUid = args.team === "A" ? room.captainUidA : room.captainUidB;
    const isHost = room.hostUid === args.callerUid;

    if (currentCaptainUid !== args.callerUid && !isHost) {
      throw new Error("Only the current captain or the host can transfer leadership.");
    }

    // Verify new captain is in the team
    const slots = args.team === "A" ? room.slotsA : room.slotsB;
    const isMember = (slots || []).some((s: any) => s.uid === args.newCaptainUid);
    if (!isMember) {
      throw new Error("Target player must be in your team to become captain.");
    }

    const updateData: any = { updatedAt: Date.now() };
    if (args.team === "A") {
      updateData.captainUidA = args.newCaptainUid;
      if (room.hostUid === args.callerUid) {
        updateData.hostUid = args.newCaptainUid;
      }
    } else {
      updateData.captainUidB = args.newCaptainUid;
    }

    await ctx.db.patch(args.matchroomId, updateData);
    return { ok: true, message: `Captaincy successfully transferred to ${args.team} teammate.` };
  },
});

// Cancel all pending matchroom join requests for a user
export const cancelUserPendingMatchroomRequests = mutation({
  args: { userUid: v.id("users") },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_fromUid", (q) => q.eq("fromUid", args.userUid))
      .collect();

    const pending = notifications.filter(
      (n) => n.type === "match_join_request" && n.status === "pending"
    );

    const now = Date.now();
    for (const notif of pending) {
      await ctx.db.patch(notif._id, { status: "expired", updatedAt: now });
    }

    return { ok: true, count: pending.length };
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
