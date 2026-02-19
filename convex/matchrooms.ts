import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";
import { sendNotification } from "./lib/notifications";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseScheduledAt = (date?: string | null, time?: string | null) => {
  const d = String(date || "").trim();
  const t = String(time || "").trim();
  if (!d || !t) return null;
  const dt = new Date(`${d}T${t}`);
  return Number.isNaN(dt.getTime()) ? null : dt.getTime();
};

const buildSearchText = (args: {
  title?: string | null;
  game?: string | null;
  location?: string | null;
  format?: string | null;
  seriesType?: string | null;
}) => {
  const parts = [
    args.title,
    args.game,
    args.location,
    args.format,
    args.seriesType,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return parts.join(" ");
};

const ensureHostInPlayers = (
  players: Array<any>,
  hostUid: string,
  hostName: string
) => {
  const hasHost = players.some((p) => p?.uid === hostUid);
  if (!hasHost) {
    players.unshift({ uid: hostUid, username: hostName, joinedAt: Date.now(), role: "Host" });
  }
  return players;
};

const derivePlayerUids = (players: Array<any>, fallback: string[]) => {
  const uids = new Set<string>();
  fallback.forEach((uid) => uid && uids.add(uid));
  players.forEach((player) => player?.uid && uids.add(player.uid));
  return Array.from(uids);
};

const createSlots = (maxPlayers: number) => {
  if (!Number.isFinite(maxPlayers) || maxPlayers <= 0) return { slotsA: [], slotsB: [] };
  if (maxPlayers % 2 !== 0) {
    const slotsA = Array.from({ length: maxPlayers }, (_, idx) => ({
      slotId: `A${idx + 1}`,
      status: "open",
      role: "Player",
    }));
    return { slotsA, slotsB: [] };
  }
  const teamSize = maxPlayers / 2;
  const slotsA = Array.from({ length: teamSize }, (_, idx) => ({
    slotId: `A${idx + 1}`,
    status: "open",
    role: "Player",
  }));
  const slotsB = Array.from({ length: teamSize }, (_, idx) => ({
    slotId: `B${idx + 1}`,
    status: "open",
    role: "Player",
  }));
  return { slotsA, slotsB };
};

const isRoomLocked = (room: any) => room?.isLocked === true || room?.status === "locked";

const applySlotReservation = (
  slots: Array<any>,
  slotId: string,
  payload: { uid: string; username: string; status: "reserved" | "confirmed"; role?: string }
) => {
  const idx = slots.findIndex((slot) => slot.slotId === slotId);
  if (idx === -1) return { ok: false as const, message: "Slot not found." };
  const slot = slots[idx];
  if (slot?.uid || slot?.user || slot?.reservedForUid || slot?.status === "confirmed") {
    return { ok: false as const, message: "Slot already taken." };
  }

  const next = {
    ...slot,
    uid: payload.uid,
    user: { uid: payload.uid, username: payload.username },
    status: payload.status,
    role: payload.role || slot.role || "Player",
  };
  if (payload.status === "reserved") {
    next.reservedFor = { uid: payload.uid, username: payload.username };
    next.reservedForUid = payload.uid;
  }

  const updated = [...slots];
  updated[idx] = next;
  return { ok: true as const, slots: updated };
};

const releaseSlotsForUser = (slots: Array<any>, uid: string) =>
  slots.map((slot) => {
    const isOccupant = slot?.uid === uid || slot?.reservedForUid === uid || slot?.reservedFor?.uid === uid;
    if (!isOccupant) return slot;
    return {
      slotId: slot.slotId,
      status: "open",
      role: slot.role || "Player",
    };
  });

const updateChatParticipants = async (ctx: any, matchroomId: string, updater: (uids: string[]) => string[]) => {
  const existing = await ctx.db
    .query("chatrooms")
    .withIndex("by_matchroomId", (q: any) => q.eq("matchroomId", matchroomId))
    .unique();
  if (!existing) return;
  const current = Array.isArray(existing.participantUids) ? existing.participantUids : [];
  const next = updater(current);
  await ctx.db.patch(existing._id, { participantUids: next, updatedAt: Date.now() });
};

export const createMatchroom = mutation({
  args: {
    game: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    maxPlayers: v.optional(v.number()),
    pricing: v.optional(v.any()),
    location: v.optional(v.string()),
    locationMode: v.optional(v.string()),
    zoneId: v.optional(v.string()),
    scheduledDate: v.optional(v.string()),
    scheduledTime: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    format: v.optional(v.string()),
    seriesType: v.optional(v.string()),
    durationHours: v.optional(v.number()),
    selectedMaps: v.optional(v.array(v.string())),
    skillLevel: v.optional(v.string()),
    hostRole: v.optional(v.string()),
    teamMode: v.optional(v.string()),
    teamId: v.optional(v.string()),
    reservedSlots: v.optional(v.number()),
    teamPaymentMode: v.optional(v.string()),
    assignedTeamMembers: v.optional(v.any()),
    isPrivate: v.optional(v.boolean()),
    isLocked: v.optional(v.boolean()),
    slotsA: v.optional(v.any()),
    slotsB: v.optional(v.any()),
    broadcastAreas: v.optional(v.array(v.string())),
    bookingSource: v.optional(v.string()),
    skipBookingRequest: v.optional(v.boolean()),
    zoneAdminApproved: v.optional(v.boolean()),
    paymentStatus: v.optional(v.string()),
    paymentAmount: v.optional(v.number()),
    paymentReservedSlots: v.optional(v.number()),
    paymentCurrency: v.optional(v.string()),
    walkIn: v.optional(v.any()),
    players: v.optional(v.array(v.any())),
    playerUids: v.optional(v.array(v.string())),
    captainUidA: v.optional(v.string()),
    captainUidB: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const now = Date.now();

    const hostName = user.username ?? user.displayName ?? "Host";
    const maxPlayers = Math.max(1, toNumber(args.maxPlayers, 10));

    const players = ensureHostInPlayers(
      Array.isArray(args.players) ? [...args.players] : [],
      user.uid,
      hostName
    );
    const playerUids = derivePlayerUids(players, Array.isArray(args.playerUids) ? args.playerUids : []);

    const scheduledAt = parseScheduledAt(args.scheduledDate, args.scheduledTime);
    const lockAt = scheduledAt ? scheduledAt - ONE_DAY_MS : undefined;

    let zoneOwnerUid: string | undefined;
    if (args.zoneId) {
      const zone = await ctx.db.get(args.zoneId as Id<"zones">);
      zoneOwnerUid = zone?.ownerUid;
    }

    const { slotsA, slotsB } =
      args.slotsA || args.slotsB
        ? { slotsA: args.slotsA ?? [], slotsB: args.slotsB ?? [] }
        : createSlots(maxPlayers);

    const isLocked =
      args.isLocked === true || (args.paymentStatus ? args.paymentStatus !== "paid" : false);

    const matchroomId = await ctx.db.insert("matchrooms", {
      hostUid: user.uid,
      hostName,
      game: args.game,
      title: args.title,
      description: args.description ?? "",
      status: isLocked ? "locked" : "open",
      maxPlayers,
      currentPlayers: players.length,
      players,
      playerUids,
      createdAt: now,
      updatedAt: now,
      location: args.location ?? undefined,
      locationMode: args.locationMode ?? undefined,
      broadcastAreas: args.broadcastAreas ?? undefined,
      zoneId: args.zoneId ?? undefined,
      zoneOwnerUid: zoneOwnerUid ?? undefined,
      scheduledDate: args.scheduledDate ?? undefined,
      scheduledTime: args.scheduledTime ?? undefined,
      scheduledAt: scheduledAt ?? undefined,
      scheduledStartAt: scheduledAt ?? undefined,
      lockAt: lockAt ?? undefined,
      expiresAt: lockAt ?? undefined,
      durationMinutes: args.durationMinutes ?? undefined,
      pricing: args.pricing ?? undefined,
      format: args.format ?? undefined,
      seriesType: args.seriesType ?? undefined,
      durationHours: args.durationHours ?? undefined,
      selectedMaps: args.selectedMaps ?? undefined,
      skillLevel: args.skillLevel ?? undefined,
      hostRole: args.hostRole ?? undefined,
      teamMode: args.teamMode ?? undefined,
      teamId: args.teamId ?? undefined,
      reservedSlots: args.reservedSlots ?? undefined,
      teamPaymentMode: args.teamPaymentMode ?? undefined,
      assignedTeamMembers: args.assignedTeamMembers ?? undefined,
      isPrivate: args.isPrivate ?? false,
      isLocked,
      slotsA,
      slotsB,
      captainUidA: args.captainUidA ?? user.uid,
      captainUidB: args.captainUidB ?? undefined,
      bookingSource: args.bookingSource ?? undefined,
      skipBookingRequest: args.skipBookingRequest ?? undefined,
      zoneAdminApproved: args.zoneAdminApproved ?? undefined,
      paymentStatus: args.paymentStatus ?? undefined,
      paymentAmount: args.paymentAmount ?? undefined,
      paymentReservedSlots: args.paymentReservedSlots ?? undefined,
      paymentCurrency: args.paymentCurrency ?? undefined,
      walkIn: args.walkIn ?? undefined,
      searchText: buildSearchText({
        title: args.title,
        game: args.game,
        location: args.location,
        format: args.format,
        seriesType: args.seriesType,
      }),
    });

    const participantUids = Array.from(new Set([user.uid, ...playerUids, ...(zoneOwnerUid ? [zoneOwnerUid] : [])]));
    await ctx.db.insert("chatrooms", {
      matchroomId,
      participantUids,
      createdAt: now,
      updatedAt: now,
    });

    return { ok: true, matchroomId };
  },
});

export const getMatchroom = query({
  args: { matchroomId: v.id("matchrooms") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.matchroomId);
  },
});

const sortByCreatedAtDesc = (rooms: Array<Record<string, any>>) =>
  [...rooms].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

export const listRecentMatchrooms = query({
  args: {
    limit: v.optional(v.number()),
    search: v.optional(v.string()),
    game: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 40, 1), 100);
    const search = String(args.search ?? "").trim();
    const gameFilter = args.game && args.game !== "all" ? args.game : null;

    if (search) {
      const searchResults = await ctx.db
        .query("matchrooms")
        .withSearchIndex("search_text", (q) => {
          let builder = q.search("searchText", search);
          if (gameFilter) builder = builder.eq("game", gameFilter);
          return builder;
        })
        .take(limit);

      if (searchResults.length >= limit) {
        return searchResults;
      }

      const fallbackPool = await ctx.db
        .query("matchrooms")
        .withIndex("by_createdAt")
        .order("desc")
        .take(200);

      const searchLower = search.toLowerCase();
      const fallbackMatches = fallbackPool.filter((room) => {
        const title = String(room.title || "").toLowerCase();
        const game = String(room.game || "").toLowerCase();
        const location = String(room.location || "").toLowerCase();
        const matches =
          title.includes(searchLower) ||
          game.includes(searchLower) ||
          location.includes(searchLower);
        if (!matches) return false;
        if (gameFilter && room.game !== gameFilter) return false;
        return true;
      });

      const merged = new Map<string, any>();
      searchResults.forEach((room) => merged.set(String(room._id), room));
      fallbackMatches.forEach((room) => merged.set(String(room._id), room));

      return Array.from(merged.values()).slice(0, limit);
    }

    let q = ctx.db
      .query("matchrooms")
      .withIndex("by_createdAt")
      .order("desc");

    if (gameFilter) {
      q = q.filter((q) => q.eq(q.field("game"), gameFilter));
    }

    return await q.take(limit);
  },
});

export const listUserMatchrooms = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireUser(ctx);
    const [hosted, joinedRaw] = await Promise.all([
      ctx.db
        .query("matchrooms")
        .withIndex("by_hostUid", (q) => q.eq("hostUid", user.uid))
        .collect(),
      ctx.db
        .query("matchrooms")
        // Convex supports multikey indexes on array fields, but types expect the full array.
        .withIndex("by_playerUid", (q) => q.eq("playerUids", user.uid as any))
        .collect(),
    ]);

    const joined = joinedRaw.filter((room) => room.hostUid !== user.uid);

    return {
      hosted: sortByCreatedAtDesc(hosted),
      joined: sortByCreatedAtDesc(joined),
    };
  },
});

export const joinMatchroom = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    role: v.optional(v.string()),
    team: v.optional(v.union(v.literal("A"), v.literal("B"))),
    slotId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new ConvexError("Matchroom not found.");

    if (room.expiresAt && room.expiresAt < Date.now()) {
      await ctx.db.patch(room._id, { status: "expired", updatedAt: Date.now() });
      throw new ConvexError("Matchroom expired.");
    }

    if (isRoomLocked(room)) throw new ConvexError("Matchroom is locked.");

    const alreadyIn = Array.isArray(room.playerUids) && room.playerUids.includes(user.uid);
    if (alreadyIn) return { ok: true };

    let slotsA = Array.isArray(room.slotsA) ? [...room.slotsA] : [];
    let slotsB = Array.isArray(room.slotsB) ? [...room.slotsB] : [];

    if (args.slotId) {
      const targetTeam = args.team ?? (args.slotId.startsWith("B") ? "B" : "A");
      if (targetTeam === "A") {
        const result = applySlotReservation(slotsA, args.slotId, {
          uid: user.uid,
          username: user.username ?? user.displayName ?? "Player",
          status: "confirmed",
          role: args.role,
        });
        if (!result.ok) throw new ConvexError(result.message);
        slotsA = result.slots;
      } else {
        const result = applySlotReservation(slotsB, args.slotId, {
          uid: user.uid,
          username: user.username ?? user.displayName ?? "Player",
          status: "confirmed",
          role: args.role,
        });
        if (!result.ok) throw new ConvexError(result.message);
        slotsB = result.slots;
      }
    }

    const players = Array.isArray(room.players) ? [...room.players] : [];
    players.push({
      uid: user.uid,
      username: user.username ?? user.displayName ?? "Player",
      joinedAt: Date.now(),
      role: args.role ?? "Flex",
    });

    const playerUids = Array.from(new Set([...(room.playerUids || []), user.uid]));
    const currentPlayers = players.length;
    const maxPlayers = Number(room.maxPlayers || 0);
    const willBeFull = maxPlayers > 0 && currentPlayers >= maxPlayers;

    await ctx.db.patch(room._id, {
      players,
      playerUids,
      currentPlayers,
      slotsA,
      slotsB,
      status: willBeFull ? "locked" : room.status ?? "open",
      isLocked: willBeFull ? true : room.isLocked,
      lockedAt: willBeFull ? Date.now() : room.lockedAt,
      updatedAt: Date.now(),
    });

    await updateChatParticipants(ctx, room._id, (uids) => Array.from(new Set([...uids, user.uid])));

    return { ok: true };
  },
});

export const leaveMatchroom = mutation({
  args: { matchroomId: v.id("matchrooms") },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new ConvexError("Matchroom not found.");

    const players = Array.isArray(room.players) ? room.players.filter((p: any) => p?.uid !== user.uid) : [];
    const playerUids = Array.isArray(room.playerUids) ? room.playerUids.filter((uid: string) => uid !== user.uid) : [];

    const slotsA = releaseSlotsForUser(Array.isArray(room.slotsA) ? room.slotsA : [], user.uid);
    const slotsB = releaseSlotsForUser(Array.isArray(room.slotsB) ? room.slotsB : [], user.uid);

    const currentPlayers = players.length;
    const maxPlayers = Number(room.maxPlayers || 0);
    const shouldUnlock = room.status === "locked" && maxPlayers > 0 && currentPlayers < maxPlayers;

    await ctx.db.patch(room._id, {
      players,
      playerUids,
      currentPlayers,
      slotsA,
      slotsB,
      status: shouldUnlock ? "open" : room.status,
      isLocked: shouldUnlock ? false : room.isLocked,
      updatedAt: Date.now(),
    });

    await updateChatParticipants(ctx, room._id, (uids) => uids.filter((uid) => uid !== user.uid));

    return { ok: true };
  },
});

export const reserveSlot = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    slotId: v.string(),
    team: v.optional(v.union(v.literal("A"), v.literal("B"))),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new ConvexError("Matchroom not found.");

    let slotsA = Array.isArray(room.slotsA) ? [...room.slotsA] : [];
    let slotsB = Array.isArray(room.slotsB) ? [...room.slotsB] : [];

    const targetTeam = args.team ?? (args.slotId.startsWith("B") ? "B" : "A");
    if (targetTeam === "A") {
      const result = applySlotReservation(slotsA, args.slotId, {
        uid: user.uid,
        username: user.username ?? user.displayName ?? "Player",
        status: "reserved",
      });
      if (!result.ok) throw new ConvexError(result.message);
      slotsA = result.slots;
    } else {
      const result = applySlotReservation(slotsB, args.slotId, {
        uid: user.uid,
        username: user.username ?? user.displayName ?? "Player",
        status: "reserved",
      });
      if (!result.ok) throw new ConvexError(result.message);
      slotsB = result.slots;
    }

    await ctx.db.patch(room._id, { slotsA, slotsB, updatedAt: Date.now() });
    return { ok: true };
  },
});

export const inviteToMatchroom = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    toUid: v.string(),
    team: v.union(v.literal("A"), v.literal("B")),
    slotId: v.string(),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new ConvexError("Matchroom not found.");

    const captainUidA = room.captainUidA || room.hostUid;
    const captainUidB = room.captainUidB || room.hostUid;
    const captainUid = args.team === "A" ? captainUidA : captainUidB;

    if (captainUid !== user.uid && room.hostUid !== user.uid) {
      throw new ConvexError("Not authorized.");
    }

    await sendNotification(ctx, {
      type: "match_seat_invitation",
      fromUid: user.uid,
      fromUsername: user.username ?? user.displayName ?? "Captain",
      toUid: args.toUid,
      status: "pending",
      entityKey: `match_invite_${room._id}_${args.toUid}_${args.slotId}`,
      meta: {
        matchroomId: room._id,
        matchroomTitle: room.title,
        team: args.team,
        slotId: args.slotId,
        role: args.role ?? "Flex",
        game: room.game,
      },
      expiresAt: Date.now() + 2 * ONE_DAY_MS,
    });

    return { ok: true };
  },
});

export const respondToMatchroomInvite = mutation({
  args: {
    notificationId: v.id("notifications"),
    decision: v.union(v.literal("accept"), v.literal("decline")),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const notif = await ctx.db.get(args.notificationId);
    if (!notif) throw new ConvexError("Invite not found.");
    if (notif.toUid !== user.uid) throw new ConvexError("Not authorized.");
    if (notif.type !== "match_seat_invitation") throw new ConvexError("Invalid invite.");
    if (notif.status !== "pending") throw new ConvexError("Invite already handled.");

    if (args.decision === "decline") {
      await ctx.db.patch(args.notificationId, { status: "declined", updatedAt: Date.now() });
      return { ok: true };
    }

    const matchroomId = notif.meta?.matchroomId as string | undefined;
    const slotId = notif.meta?.slotId as string | undefined;
    const team = (notif.meta?.team as "A" | "B" | undefined) ?? (slotId?.startsWith("B") ? "B" : "A");
    const role = (notif.meta?.role as string | undefined) ?? "Flex";

    if (!matchroomId || !slotId) throw new ConvexError("Invite missing data.");

    const room = await ctx.db.get(matchroomId as Id<"matchrooms">);
    if (!room) throw new ConvexError("Matchroom not found.");

    if (Array.isArray(room.playerUids) && room.playerUids.includes(user.uid)) {
      await ctx.db.patch(args.notificationId, { status: "accepted", updatedAt: Date.now() });
      return { ok: true };
    }

    let slotsA = Array.isArray(room.slotsA) ? [...room.slotsA] : [];
    let slotsB = Array.isArray(room.slotsB) ? [...room.slotsB] : [];

    if (team === "A") {
      const result = applySlotReservation(slotsA, slotId, {
        uid: user.uid,
        username: user.username ?? user.displayName ?? "Player",
        status: "confirmed",
        role,
      });
      if (!result.ok) throw new ConvexError(result.message);
      slotsA = result.slots;
    } else {
      const result = applySlotReservation(slotsB, slotId, {
        uid: user.uid,
        username: user.username ?? user.displayName ?? "Player",
        status: "confirmed",
        role,
      });
      if (!result.ok) throw new ConvexError(result.message);
      slotsB = result.slots;
    }

    const players = Array.isArray(room.players) ? [...room.players] : [];
    players.push({ uid: user.uid, username: user.username ?? user.displayName ?? "Player", joinedAt: Date.now(), role });
    const playerUids = Array.from(new Set([...(room.playerUids || []), user.uid]));
    const currentPlayers = players.length;
    const maxPlayers = Number(room.maxPlayers || 0);
    const willBeFull = maxPlayers > 0 && currentPlayers >= maxPlayers;

    await ctx.db.patch(room._id, {
      players,
      playerUids,
      currentPlayers,
      slotsA,
      slotsB,
      status: willBeFull ? "locked" : room.status ?? "open",
      isLocked: willBeFull ? true : room.isLocked,
      lockedAt: willBeFull ? Date.now() : room.lockedAt,
      updatedAt: Date.now(),
    });

    await ctx.db.patch(args.notificationId, { status: "accepted", updatedAt: Date.now() });
    await updateChatParticipants(ctx, room._id, (uids) => Array.from(new Set([...uids, user.uid])));

    return { ok: true };
  },
});

export const requestJoinMatchroom = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    role: v.optional(v.string()),
    targetTeam: v.optional(v.string()),
    slotId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new ConvexError("Matchroom not found.");

    await sendNotification(ctx, {
      type: "match_join_request",
      fromUid: user.uid,
      fromUsername: user.username ?? user.displayName ?? "Player",
      toUid: room.hostUid,
      status: "pending",
      entityKey: `match_join_request_${room._id}_${user.uid}`,
      meta: {
        matchroomId: room._id,
        matchroomTitle: room.title,
        game: room.game,
        role: args.role ?? "Flex",
        targetTeam: args.targetTeam ?? "Any",
        slotId: args.slotId ?? null,
      },
      expiresAt: Date.now() + ONE_DAY_MS,
    });

    return { ok: true };
  },
});

export const respondToMatchJoinRequest = mutation({
  args: {
    notificationId: v.id("notifications"),
    decision: v.union(v.literal("accept"), v.literal("reject")),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const notif = await ctx.db.get(args.notificationId);
    if (!notif) throw new ConvexError("Request not found.");
    if (notif.type !== "match_join_request") throw new ConvexError("Invalid request.");
    if (notif.status !== "pending") throw new ConvexError("Request already handled.");

    const matchroomId = notif.meta?.matchroomId as string | undefined;
    if (!matchroomId) throw new ConvexError("Missing matchroom.");

    const room = await ctx.db.get(matchroomId as Id<"matchrooms">);
    if (!room) throw new ConvexError("Matchroom not found.");

    if (room.hostUid !== user.uid && room.zoneOwnerUid !== user.uid) {
      throw new ConvexError("Not authorized.");
    }

    if (args.decision === "reject") {
      await ctx.db.patch(args.notificationId, { status: "rejected", updatedAt: Date.now() });
      return { ok: true };
    }

    const requesterUid = notif.fromUid;
    if (!requesterUid) throw new ConvexError("Request missing user.");

    const alreadyIn = Array.isArray(room.playerUids) && room.playerUids.includes(requesterUid);
    if (alreadyIn) {
      await ctx.db.patch(args.notificationId, { status: "accepted", updatedAt: Date.now() });
      return { ok: true };
    }

    const players = Array.isArray(room.players) ? [...room.players] : [];
    players.push({
      uid: requesterUid,
      username: notif.fromUsername ?? "Player",
      joinedAt: Date.now(),
      role: notif.meta?.role ?? "Flex",
    });

    const playerUids = Array.from(new Set([...(room.playerUids || []), requesterUid]));
    const currentPlayers = players.length;
    const maxPlayers = Number(room.maxPlayers || 0);
    const willBeFull = maxPlayers > 0 && currentPlayers >= maxPlayers;

    await ctx.db.patch(room._id, {
      players,
      playerUids,
      currentPlayers,
      status: willBeFull ? "locked" : room.status ?? "open",
      isLocked: willBeFull ? true : room.isLocked,
      lockedAt: willBeFull ? Date.now() : room.lockedAt,
      updatedAt: Date.now(),
    });

    await ctx.db.patch(args.notificationId, { status: "accepted", updatedAt: Date.now() });
    await updateChatParticipants(ctx, room._id, (uids) => Array.from(new Set([...uids, requesterUid])));

    return { ok: true };
  },
});

export const startMatchroom = mutation({
  args: { matchroomId: v.id("matchrooms") },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new ConvexError("Matchroom not found.");
    if (room.hostUid !== user.uid && room.zoneOwnerUid !== user.uid) {
      throw new ConvexError("Not authorized.");
    }
    await ctx.db.patch(room._id, { status: "in-progress", startTime: Date.now(), updatedAt: Date.now() });
    return { ok: true };
  },
});

export const completeMatchroom = mutation({
  args: { matchroomId: v.id("matchrooms") },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new ConvexError("Matchroom not found.");
    if (room.hostUid !== user.uid && room.zoneOwnerUid !== user.uid) {
      throw new ConvexError("Not authorized.");
    }
    await ctx.db.patch(room._id, { status: "completed", completedAt: Date.now(), updatedAt: Date.now() });
    return { ok: true };
  },
});

export const submitMatchResult = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    winner: v.union(v.literal("team1"), v.literal("team2")),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new ConvexError("Matchroom not found.");

    const captainA = room.captainUidA || room.hostUid;
    const captainB = room.captainUidB || null;

    const isCaptain = user.uid === captainA || user.uid === captainB || user.uid === room.hostUid;
    if (!isCaptain) throw new ConvexError("Not authorized to submit result.");

    const now = Date.now();
    const rv = room.resultVerification || {};
    const captainReports = { ...(rv.captainReports || {}) };

    if (user.uid === captainA || user.uid === room.hostUid) {
      captainReports.team1Captain = { result: args.winner, timestamp: now };
    } else if (user.uid === captainB) {
      captainReports.team2Captain = { result: args.winner, timestamp: now };
    }

    let status = rv.status || "pending";
    let resolvedWinner = rv.resolvedWinner || null;
    let resolutionSource = rv.resolutionSource || null;

    const team1Vote = captainReports.team1Captain?.result;
    const team2Vote = captainReports.team2Captain?.result;

    if (team1Vote && team2Vote && team1Vote === team2Vote) {
      status = "resolved";
      resolvedWinner = team1Vote;
      resolutionSource = "captain_consensus";
    } else if (team1Vote && team2Vote && team1Vote !== team2Vote) {
      status = "participant_vote";
    } else {
      status = "pending";
    }

    await ctx.db.patch(room._id, {
      resultVerification: {
        ...rv,
        status,
        captainReports,
        resolvedWinner,
        resolvedByUid: status === "resolved" ? user.uid : rv.resolvedByUid,
        resolvedAt: status === "resolved" ? now : rv.resolvedAt,
        resolutionSource,
      },
      updatedAt: now,
    });

    return { ok: true };
  },
});

export const voteMatchResult = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    vote: v.union(v.literal("team1"), v.literal("team2"), v.literal("unknown")),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new ConvexError("Matchroom not found.");

    const participantUids = new Set<string>();
    (room.playerUids || []).forEach((uid: string) => uid && participantUids.add(uid));
    (room.players || []).forEach((player: any) => player?.uid && participantUids.add(player.uid));

    if (!participantUids.has(user.uid)) {
      throw new ConvexError("Not authorized to vote.");
    }

    const now = Date.now();
    const rv = room.resultVerification || {};
    const participantVotes = { ...(rv.participantVotes || {}) };
    participantVotes[user.uid] = args.vote;

    const votes = Object.values(participantVotes);
    const summary = {
      team1Votes: votes.filter((v) => v === "team1").length,
      team2Votes: votes.filter((v) => v === "team2").length,
      unknownVotes: votes.filter((v) => v === "unknown").length,
      totalVotes: votes.length,
      totalParticipants: participantUids.size,
    };

    const majority = Math.ceil(summary.totalParticipants / 2);
    let resolvedWinner = rv.resolvedWinner || null;
    let status = rv.status || "participant_vote";
    let resolutionSource = rv.resolutionSource || null;

    if (summary.team1Votes >= majority) {
      resolvedWinner = "team1";
      status = "resolved";
      resolutionSource = "participant_vote";
    } else if (summary.team2Votes >= majority) {
      resolvedWinner = "team2";
      status = "resolved";
      resolutionSource = "participant_vote";
    }

    await ctx.db.patch(room._id, {
      resultVerification: {
        ...rv,
        status,
        participantVotes,
        voteSummary: summary,
        resolvedWinner,
        resolvedByUid: status === "resolved" ? user.uid : rv.resolvedByUid,
        resolvedAt: status === "resolved" ? now : rv.resolvedAt,
        resolutionSource,
      },
      updatedAt: now,
    });

    return { ok: true };
  },
});
