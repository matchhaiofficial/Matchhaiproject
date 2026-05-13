import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { authComponent } from "./auth";
import { api, internal } from "./_generated/api";
import { KYC_VERIFICATION_REQUIRED_MESSAGE, isKycAccessAllowed } from "./kycGate";
import {
  dispatchBroadcastZoneRequestsForMatchroom,
  finalizeBroadcastFailure,
} from "./matchroomBroadcast";

// Constants
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SKILL_JOIN_DELTA = 10;
const MATCH_JOIN_REQUEST_TYPES = new Set(["match_join_request", "match.join_request"]);

function getMatchroomPlayerUids(room: any): string[] {
  const fromPlayerUids = Array.isArray(room.playerUids) ? room.playerUids.map(String) : [];
  const fromPlayers = Array.isArray(room.players) ? room.players.map((player: any) => String(player?.uid || "")).filter(Boolean) : [];
  return Array.from(new Set([...fromPlayerUids, ...fromPlayers]));
}

function resolveResultCaptains(room: any, rv: any = {}) {
  const team1Captain = String(rv.team1Captain || room.captainUidA || room.hostUid || "");
  const team2Captain = String(
    rv.team2Captain ||
    room.captainUidB ||
    (room.players || []).find((player: any) => String(player?.uid || "") !== team1Captain)?.uid ||
    "",
  );
  return { team1Captain, team2Captain };
}

function chooseRandomWinner() {
  return Math.random() < 0.5 ? "team1" as const : "team2" as const;
}

async function notifyResultFinalized(ctx: any, room: any, winner: "team1" | "team2", source: string) {
  const matchroomId = room._id;
  const now = Date.now();
  const title = "Match result finalized";
  const body = `${room.title || "Matchroom"} result finalized: ${winner === "team1" ? "Team 1" : "Team 2"} won.`;

  const recipients = new Map<string, { id: Id<"users">; role?: "zone_admin" | "super_admin" }>();
  if (room.zoneOwnerUid) {
    const zoneOwner = await resolveUserByAnyId(ctx, String(room.zoneOwnerUid));
    if (zoneOwner?._id) {
      recipients.set(String(zoneOwner._id), { id: zoneOwner._id, role: "zone_admin" });
    }
  }

  const superAdmins = await ctx.db
    .query("users")
    .withIndex("by_role", (q: any) => q.eq("role", "super-admin"))
    .collect();
  for (const superAdmin of superAdmins) {
    recipients.set(String(superAdmin._id), { id: superAdmin._id, role: "super_admin" });
  }

  for (const [uid, meta] of recipients.entries()) {
    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "match.result_finalized",
      toUid: meta.id,
      recipientRole: meta.role,
      status: "pending",
      dedupeKey: `match.result_finalized:${String(matchroomId)}:${uid}`,
      dedupePolicy: "upsert_active",
      matchroomId,
      route: meta.role === "super_admin" ? "/super-admin" : `/matchrooms/${String(matchroomId)}`,
      title,
      body,
      data: {
        matchroomId,
        winner,
        source,
        finalizedAt: now,
        href: meta.role === "super_admin" ? "/super-admin" : `/matchrooms/${String(matchroomId)}`,
      },
    });
  }
}

async function finalizeMatchroomResult(
  ctx: any,
  matchroomId: Id<"matchrooms">,
  room: any,
  rv: any,
  winner: "team1" | "team2",
  source: string,
) {
  const now = Date.now();
  const captains = resolveResultCaptains(room, rv);
  const nextVerification = {
    status: "resolved" as const,
    team1Captain: captains.team1Captain,
    team2Captain: captains.team2Captain,
    captainReports: rv.captainReports,
    participantVotes: rv.participantVotes,
    deadline: rv.deadline,
    votes: rv.votes,
    finalWinner: winner,
    resolvedAt: now,
    resolutionSource: source,
  };

  await ctx.db.patch(matchroomId, {
    resultVerification: nextVerification,
    updatedAt: now,
  });
  await notifyResultFinalized(ctx, { ...room, _id: matchroomId }, winner, source);
  return { ok: true, status: "resolved", winner, source };
}

export async function resolveUserByAnyId(ctx: any, value?: string | null) {
  if (!value) return null;

  try {
    const directUser = await ctx.db.get(value as Id<"users">);
    if (directUser) {
      return directUser;
    }
  } catch {
    // Not a valid Convex id, fall through to auth lookup.
  }

  return await ctx.db
    .query("users")
    .withIndex("by_authId", (q: any) => q.eq("authId", value))
    .unique();
}

async function requireVerifiedActor(ctx: any, expectedUid?: string) {
  let authUser: Awaited<ReturnType<typeof authComponent.getAuthUser>> | null = null;
  try {
    authUser = await authComponent.getAuthUser(ctx);
  } catch {
    authUser = null;
  }

  const expectedUser = await resolveUserByAnyId(ctx, expectedUid);

  console.log("[matchrooms] auth gate", {
    authId: authUser?.userId ?? null,
    email: authUser?.email ?? null,
    expectedUid: expectedUid ?? null,
    expectedAuthId: expectedUser?.authId ?? null,
  });

  if (authUser?.userId) {
    const authUserRecord = await resolveUserByAnyId(ctx, authUser.userId);
    if (!authUserRecord) {
      throw new Error("User profile not found");
    }
    if (!isKycAccessAllowed(authUserRecord.kycVerificationStatus)) {
      throw new Error(KYC_VERIFICATION_REQUIRED_MESSAGE);
    }

    if (expectedUser && expectedUser._id !== authUserRecord._id) {
      throw new Error("You can only perform this action for your own account");
    }

    return {
      userId: authUser.userId,
      kycVerified: true,
      email: authUser.email ?? null,
      convexUser: authUserRecord,
    };
  }

  if (expectedUser) {
    if (!isKycAccessAllowed(expectedUser.kycVerificationStatus)) {
      throw new Error(KYC_VERIFICATION_REQUIRED_MESSAGE);
    }
    return {
      userId: expectedUser.authId || String(expectedUser._id),
      kycVerified: isKycAccessAllowed(expectedUser.kycVerificationStatus),
      email: expectedUser.email ?? null,
      convexUser: expectedUser,
    };
  }

  throw new Error("Not authenticated");
}

// Helper: Check if room is expired
export function isRoomExpired(room: any): boolean {
  return false;
}

// Helper: Check if room is locked
export function isRoomLocked(room: any): boolean {
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

function normalizeGameKey(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  switch (normalized) {
    case "cs2":
      return "cs2";
    case "cs16":
    case "cs1.6":
    case "counterstrike1.6":
      return "cs16";
    case "valorant":
      return "valorant";
    case "fc25":
    case "fc26":
      return "fc26";
    case "tekken8":
    case "tekken":
      return "tekken8";
    case "futsal":
      return "futsal";
    case "cricket":
    case "indoorcricket":
    case "indoor_cricket":
      return "indoor_cricket";
    case "padel":
      return "padel";
    case "pickleball":
      return "pickleball";
    default:
      return normalized || null;
  }
}

function getGameLabel(game?: string | null) {
  switch (normalizeGameKey(game)) {
    case "cs2":
      return "CS2";
    case "cs16":
      return "CS 1.6";
    case "valorant":
      return "Valorant";
    case "fc26":
      return "FC26";
    case "tekken8":
      return "Tekken 8";
    case "futsal":
      return "Futsal";
    case "indoor_cricket":
      return "Indoor Cricket";
    case "padel":
      return "Padel";
    case "pickleball":
      return "Pickleball";
    default:
      return String(game || "game").trim() || "game";
  }
}

function getSkillScoreForGame(user: any, game?: string | null) {
  const gameKey = normalizeGameKey(game);
  const scores = user?.skillScores || {};
  if (!gameKey) return null;
  if (gameKey === "tekken8") {
    return scores.tekken8 || scores.tekken || null;
  }
  if (gameKey === "fc26") {
    return scores.fc26 || scores.fc25 || null;
  }
  if (gameKey === "indoor_cricket") {
    return scores.indoor_cricket || scores.cricket || null;
  }
  return scores[gameKey] || null;
}

function isGameEnabledForUser(user: any, game?: string | null) {
  switch (normalizeGameKey(game)) {
    case "cs2":
      return user?.playsCs2 === true;
    case "cs16":
      return user?.playsCs16 === true;
    case "valorant":
      return user?.playsValorant === true;
    case "fc25":
    case "fc26":
      return user?.playsFc === true;
    case "tekken8":
      return user?.playsTekken === true;
    case "futsal":
      return user?.playsFutsal === true;
    case "indoor_cricket":
      return user?.playsIndoorCricket === true;
    case "padel":
      return user?.playsPadel === true;
    case "pickleball":
      return user?.playsPickleball === true;
    default:
      return true;
  }
}

function getDefaultResourceAssetType(game?: string | null) {
  switch (normalizeGameKey(game)) {
    case "cs2":
    case "cs16":
    case "valorant":
      return "pc";
    case "fc26":
    case "tekken8":
      return "console";
    default:
      return undefined;
  }
}

function getZoneRequestPreferredDate(room: any) {
  if (room.scheduledDate) {
    const timestamp = new Date(String(room.scheduledDate)).getTime();
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return typeof room.scheduledStartAt === "number" ? room.scheduledStartAt : undefined;
}

function getConfirmedSlotCount(room: any) {
  return [...(room?.slotsA || []), ...(room?.slotsB || [])].filter((slot: any) =>
    slot?.status === "confirmed" && (slot?.uid || slot?.user?.uid),
  ).length;
}

function getExpectedPaidPlayerCount(room: any) {
  return Math.max(1, Number(room?.maxPlayers || room?.currentPlayers || getConfirmedSlotCount(room) || 1));
}

function getMatchroomGrossAmount(room: any) {
  const explicit = Number(room?.merchantSettlementAmount || room?.paymentAmount || 0);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const perPlayer = Number(room?.pricing?.perPlayer || 0);
  return Math.max(0, perPlayer * getExpectedPaidPlayerCount(room));
}

function isFullPaidZoneRoom(room: any) {
  if (!room || room.locationMode !== "zone" || !room.zoneId) return false;
  if (room.zoneAdminApproved !== true) return false;
  const maxPlayers = getExpectedPaidPlayerCount(room);
  return Number(room.currentPlayers || 0) >= maxPlayers && getConfirmedSlotCount(room) >= maxPlayers;
}

async function markMerchantCapturedForMatchroom(ctx: any, matchroomId: Id<"matchrooms">, roomInput?: any) {
  const room = roomInput || await ctx.db.get(matchroomId);
  if (!isFullPaidZoneRoom(room)) return null;
  if (room.merchantSettlementStatus === "captured") {
    return {
      status: "captured",
      reference: room.merchantSettlementReference || null,
      amount: Number(room.merchantSettlementAmount || 0),
      capturedAt: room.merchantSettlementAt || null,
    };
  }

  const now = Date.now();
  const amount = getMatchroomGrossAmount(room);
  const reference = `merchant_capture:${String(matchroomId)}`;
  await ctx.db.patch(matchroomId, {
    merchantSettlementStatus: "captured",
    merchantSettlementAt: now,
    merchantSettlementAmount: amount,
    merchantSettlementReference: reference,
    updatedAt: now,
  });
  console.log("[settlement] merchant_capture.marked", {
    matchroomId: String(matchroomId),
    amount,
    reference,
  });
  return { status: "captured", reference, amount, capturedAt: now };
}

async function payVenueWalletForCompletedMatchroom(ctx: any, matchroomId: Id<"matchrooms">, roomInput?: any) {
  const room = roomInput || await ctx.db.get(matchroomId);
  if (!room || room.status !== "completed") return null;
  if (!room.zoneOwnerUid) return null;
  if (room.venuePayoutStatus === "paid") {
    return {
      status: "paid",
      reference: room.venuePayoutReference || null,
      amount: Number(room.venuePayoutAmount || 0),
      paidAt: room.venuePayoutAt || null,
    };
  }

  const owner = await resolveUserByAnyId(ctx, String(room.zoneOwnerUid));
  if (!owner) return null;

  const now = Date.now();
  const grossAmount = getMatchroomGrossAmount(room);
  const payoutAmount = Math.round(grossAmount * 0.9 * 100) / 100;
  if (payoutAmount <= 0) return null;

  const reference = `venue_payout:${String(matchroomId)}`;
  await ctx.runMutation(api.wallet.addFunds, {
    userId: owner._id,
    amount: payoutAmount,
    reference,
    metadata: {
      source: "matchroom_completion_payout",
      matchroomId: String(matchroomId),
      grossAmount,
      platformShareAmount: Math.round((grossAmount - payoutAmount) * 100) / 100,
      payoutRate: 0.9,
    },
  });
  await ctx.db.patch(matchroomId, {
    venuePayoutStatus: "paid",
    venuePayoutAt: now,
    venuePayoutAmount: payoutAmount,
    venuePayoutReference: reference,
    updatedAt: now,
  });
  console.log("[settlement] venue_payout.completed", {
    matchroomId: String(matchroomId),
    zoneOwnerUid: String(owner._id),
    grossAmount,
    payoutAmount,
    reference,
  });
  return { status: "paid", reference, amount: payoutAmount, paidAt: now };
}

async function dispatchZoneAdminRequestForFullMatchroom(ctx: any, matchroomId: Id<"matchrooms">) {
  const room = await ctx.db.get(matchroomId);
  if (!room || room.locationMode !== "zone" || !room.zoneId) return null;

  const existing = await ctx.db
    .query("bookingRequests")
    .withIndex("by_matchroomId", (q: any) => q.eq("matchroomId", matchroomId))
    .first();
  if (existing) return existing._id;

  const maxPlayers = Math.max(1, Number(room.maxPlayers || room.currentPlayers || 1));
  if (Number(room.currentPlayers || 0) < maxPlayers) return null;

  const confirmedSlotCount = [...(room.slotsA || []), ...(room.slotsB || [])].filter((slot: any) =>
    slot?.status === "confirmed" && (slot?.uid || slot?.user?.uid),
  ).length;
  if (confirmedSlotCount < maxPlayers) return null;

  const host = await resolveUserByAnyId(ctx, String(room.hostUid || ""));
  if (!host) return null;

  return await ctx.runMutation(api.bookings.createRequest, {
    userId: host._id,
    gameKey: normalizeGameKey(room.game) || String(room.game || ""),
    zoneId: room.zoneId as Id<"zones">,
    userName: room.hostName || host.username || host.fullName || "Player",
    title: room.title || `${getGameLabel(room.game)} booking request`,
    description: room.description || "Full paid matchroom ready for venue allocation.",
    maxPlayers,
    format: room.format,
    seriesType: room.seriesType,
    durationHours: room.durationHours,
    selectedMaps: room.selectedMaps,
    skillLevel: room.skillLevel,
    hostSkillScore: room.hostSkillScore,
    hostSkillTier: room.hostSkillTier,
    hostSkillContext: room.hostSkillContext,
    overs: room.overs ? String(room.overs) : undefined,
    teamMode: room.teamMode,
    teamId: room.teamId,
    reservedSlots: room.reservedSlots,
    preferredDate: getZoneRequestPreferredDate(room),
    preferredTime: room.scheduledTime,
    flexibilityWindow: "Exact time",
    locationMode: "zone",
    budgetPerPlayer: Number(room.pricing?.perPlayer || 0),
    currency: room.pricing?.currency || "PKR",
    playerCount: maxPlayers,
    paymentStatus: "paid",
    paymentAmount: Number(room.pricing?.perPlayer || 0) * maxPlayers,
    paymentReservedSlots: maxPlayers,
    requestedResourceAssetType: room.requestedResourceAssetType || getDefaultResourceAssetType(room.game),
    requestedResourceSurface: room.requestedResourceSurface,
    requestedResourceTier: room.requestedResourceTier,
    selectedZoneRateKey: room.selectedZoneRateKey,
    matchroomId,
    lifecycleStatus: "zone_admin_pending",
    notes: "Auto-sent after every slot was filled and paid.",
  });
}

async function requireUserGameSkill(ctx: any, uid: string, game?: string | null) {
  const user = await resolveUserByAnyId(ctx, uid);
  if (!user) {
    throw new Error("User profile not found");
  }

  if (!isGameEnabledForUser(user, game)) {
    throw new Error(`Please enable ${getGameLabel(game)} in your profile before joining this matchroom.`);
  }

  const skill = getSkillScoreForGame(user, game);
  if (!skill || typeof skill.rating !== "number") {
    throw new Error(`Please complete your ${getGameLabel(game)} skill setup in Profile before joining this matchroom.`);
  }

  return {
    user,
    rating: Number(skill.rating),
    tier: typeof skill.tier === "string" ? skill.tier : undefined,
  };
}

async function buildRoomSkillStats(ctx: any, game: string, playerUids: string[]) {
  const uniquePlayerUids = Array.from(new Set((playerUids || []).map((uid) => String(uid)).filter(Boolean)));
  let totalSkillSum = 0;
  let ratedPlayerCount = 0;

  for (const uid of uniquePlayerUids) {
    const user = await resolveUserByAnyId(ctx, uid);
    const skill = getSkillScoreForGame(user, game);
    if (skill && typeof skill.rating === "number") {
      totalSkillSum += Number(skill.rating);
      ratedPlayerCount += 1;
    }
  }

  return {
    totalSkillSum,
    ratedPlayerCount,
    avgSkillScoreLive: ratedPlayerCount > 0 ? Math.round((totalSkillSum / ratedPlayerCount) * 100) / 100 : undefined,
  };
}

async function createPlayerRecord(
  ctx: any,
  roomGame: string,
  uid: string,
  username: string,
  joinedAt: number,
  role?: string,
) {
  const skill = await requireUserGameSkill(ctx, uid, roomGame);
  return {
    uid: String(skill.user._id),
    username,
    joinedAt,
    role,
    skillTier: skill.tier,
  };
}

function assignPlayerToTeamSlots(
  room: any,
  requesterUid: string,
  requesterUsername: string,
  role: string,
  skillTier?: string,
  targetTeam?: string | null,
  requestedSlotId?: string | null,
) {
  const slotsA = [...(room.slotsA || [])];
  const slotsB = [...(room.slotsB || [])];

  const buildFilledSlot = (slot: any) => ({
    ...slot,
    uid: requesterUid,
    user: { uid: requesterUid, username: requesterUsername, skillTier },
    status: "confirmed" as const,
    role,
  });

  const isOpen = (slot: any) => !slot?.uid && !slot?.user?.uid;
  const normalizedTargetTeam = String(targetTeam || "").trim().toUpperCase();

  if (requestedSlotId) {
    const idxA = slotsA.findIndex((slot: any) => slot.slotId === requestedSlotId);
    if (idxA !== -1) {
      if (!isOpen(slotsA[idxA])) {
        return { ok: false, message: "Selected slot is no longer available." };
      }
      slotsA[idxA] = buildFilledSlot(slotsA[idxA]);
      return { ok: true, slotsA, slotsB, team: "A", updateData: {} as Record<string, any> };
    }

    const idxB = slotsB.findIndex((slot: any) => slot.slotId === requestedSlotId);
    if (idxB !== -1) {
      if (!isOpen(slotsB[idxB])) {
        return { ok: false, message: "Selected slot is no longer available." };
      }
      slotsB[idxB] = buildFilledSlot(slotsB[idxB]);
      return {
        ok: true,
        slotsA,
        slotsB,
        team: "B",
        updateData: room.captainUidB ? {} : { captainUidB: requesterUid },
      };
    }

    return { ok: false, message: "Selected slot was not found." };
  }

  const assignFirstOpen = (slots: any[]) => slots.findIndex((slot: any) => isOpen(slot));

  if (normalizedTargetTeam === "TEAM A" || normalizedTargetTeam === "A") {
    const idxA = assignFirstOpen(slotsA);
    if (idxA === -1) {
      return { ok: false, message: "Team A has no open slots." };
    }
    slotsA[idxA] = buildFilledSlot(slotsA[idxA]);
    return { ok: true, slotsA, slotsB, team: "A", updateData: {} as Record<string, any> };
  }

  if (normalizedTargetTeam === "TEAM B" || normalizedTargetTeam === "B") {
    const idxB = assignFirstOpen(slotsB);
    if (idxB === -1) {
      return { ok: false, message: "Team B has no open slots." };
    }
    slotsB[idxB] = buildFilledSlot(slotsB[idxB]);
    return {
      ok: true,
      slotsA,
      slotsB,
      team: "B",
      updateData: room.captainUidB ? {} : { captainUidB: requesterUid },
    };
  }

  const idxA = assignFirstOpen(slotsA);
  if (idxA !== -1) {
    slotsA[idxA] = buildFilledSlot(slotsA[idxA]);
    return { ok: true, slotsA, slotsB, team: "A", updateData: {} as Record<string, any> };
  }

  const idxB = assignFirstOpen(slotsB);
  if (idxB !== -1) {
    slotsB[idxB] = buildFilledSlot(slotsB[idxB]);
    return {
      ok: true,
      slotsA,
      slotsB,
      team: "B",
      updateData: room.captainUidB ? {} : { captainUidB: requesterUid },
    };
  }

  return { ok: false, message: "No available slot for this matchroom." };
}

function getAvailableCaptainUids(room: any) {
  const captainCandidates = [
    room.captainUidA || room.hostUid,
    room.captainUidB,
  ];
  return Array.from(new Set(captainCandidates.map((uid) => String(uid || "")).filter(Boolean)));
}

export async function buildMatchroomRosterPatch(
  ctx: any,
  room: any,
  requesterUid: string,
  requesterUsername: string,
  role: string,
  targetTeam?: string | null,
  requestedSlotId?: string | null,
) {
  const requesterSkill = await requireUserGameSkill(ctx, requesterUid, room.game);
  const now = Date.now();
  const playerRecord = {
    uid: requesterUid,
    username: requesterUsername,
    joinedAt: now,
    role,
    skillTier: requesterSkill.tier,
  };

  const nextPlayers = [...(room.players || []), playerRecord];
  const nextPlayerUids = [...(room.playerUids || []), requesterUid];
  const slotAssignment = assignPlayerToTeamSlots(
    room,
    requesterUid,
    requesterUsername,
    role,
    requesterSkill.tier,
    targetTeam,
    requestedSlotId,
  );

  if (!slotAssignment.ok) {
    throw new Error(slotAssignment.message);
  }

  const skillStats = await buildRoomSkillStats(ctx, room.game, nextPlayerUids);
  const currentPlayers = nextPlayers.length;
  const willBeFull = currentPlayers >= room.maxPlayers;

  return {
    willBeFull,
    playerRecord,
    requesterSkill,
    patch: {
      players: nextPlayers,
      playerUids: nextPlayerUids,
      currentPlayers,
      slotsA: slotAssignment.slotsA,
      slotsB: slotAssignment.slotsB,
      updatedAt: now,
      totalSkillSum: skillStats.totalSkillSum,
      ratedPlayerCount: skillStats.ratedPlayerCount,
      avgSkillScoreLive: skillStats.avgSkillScoreLive,
      ...slotAssignment.updateData,
      ...(willBeFull
        ? { status: "locked" as const, isLocked: true, lockedAt: now }
        : {}),
    },
  };
}

async function addUserToMatchroomChatroom(ctx: any, matchroomId: Id<"matchrooms">, userUid: string, now: number) {
  const chatrooms = await ctx.db
    .query("chatrooms")
    .withIndex("by_matchroomId", (q: any) => q.eq("matchroomId", matchroomId))
    .take(1);
  if (!chatrooms.length) {
    return;
  }

  const chat = chatrooms[0];
  const participantUids = [...(chat.participantUids || [])];
  if (!participantUids.includes(userUid)) {
    participantUids.push(userUid);
    await ctx.db.patch(chat._id, { participantUids, updatedAt: now });
  }

  const member = await ctx.db
    .query("chatroomMembers")
    .withIndex("by_chatroomId_and_userId", (q: any) =>
      q.eq("chatroomId", chat._id).eq("userId", userUid)
    )
    .unique();
  if (!member) {
    await ctx.db.insert("chatroomMembers", {
      chatroomId: chat._id,
      userId: userUid,
      joinedAt: now,
      lastReadAt: now,
      unreadCount: 0,
      updatedAt: now,
    });
  }
}

function getSlotListForTeam(room: any, side: "A" | "B") {
  return side === "A" ? [...(room.slotsA || [])] : [...(room.slotsB || [])];
}

function getOpenSlotSelection(room: any, targetTeam?: string | null, requestedSlotId?: string | null) {
  const normalizedTargetTeam = String(targetTeam || "").trim().toUpperCase();
  const slotsA = getSlotListForTeam(room, "A");
  const slotsB = getSlotListForTeam(room, "B");

  const findOpenBySlotId = (slots: any[], side: "A" | "B") => {
    const index = slots.findIndex((slot: any) =>
      slot.slotId === requestedSlotId && !slot?.uid && !slot?.user?.uid
    );
    if (index === -1) {
      return null;
    }
    return {
      side,
      slotId: String(slots[index].slotId),
      selectedSlots: [index],
    };
  };

  if (requestedSlotId) {
    return findOpenBySlotId(slotsA, "A") || findOpenBySlotId(slotsB, "B");
  }

  const firstOpenIndex = (slots: any[]) => slots.findIndex((slot: any) => !slot?.uid && !slot?.user?.uid);

  if (normalizedTargetTeam === "TEAM A" || normalizedTargetTeam === "A") {
    const index = firstOpenIndex(slotsA);
    return index === -1 ? null : { side: "A" as const, slotId: String(slotsA[index].slotId), selectedSlots: [index] };
  }

  if (normalizedTargetTeam === "TEAM B" || normalizedTargetTeam === "B") {
    const index = firstOpenIndex(slotsB);
    return index === -1 ? null : { side: "B" as const, slotId: String(slotsB[index].slotId), selectedSlots: [index] };
  }

  const indexA = firstOpenIndex(slotsA);
  if (indexA !== -1) {
    return { side: "A" as const, slotId: String(slotsA[indexA].slotId), selectedSlots: [indexA] };
  }

  const indexB = firstOpenIndex(slotsB);
  if (indexB !== -1) {
    return { side: "B" as const, slotId: String(slotsB[indexB].slotId), selectedSlots: [indexB] };
  }

  return null;
}

async function createSingleSeatBookingIntent(ctx: any, args: {
  room: any;
  createdByUid: Id<"users">;
  createdByUsername: string;
  role: string;
  targetTeam?: string | null;
  requestedSlotId?: string | null;
  source: "direct_join" | "captain_approved_join" | "captain_invite";
  sourceNotificationId?: Id<"notifications">;
}) {
  const selection = getOpenSlotSelection(args.room, args.targetTeam, args.requestedSlotId);
  if (!selection) {
    throw new Error("Selected slot is no longer available.");
  }

  const existingIntents = await ctx.db
    .query("bookingIntents")
    .withIndex("by_createdByUid_matchroomId", (q: any) =>
      q.eq("createdByUid", args.createdByUid).eq("matchroomId", args.room._id)
    )
    .collect();

  const now = Date.now();
  const duplicate = existingIntents.find((intent: any) =>
    String(intent.matchroomId) === String(args.room._id)
    && intent.paymentStatus !== "paid"
    && intent.status !== "cancelled"
    && intent.status !== "expired"
    && (intent.selectedSlotIds || []).includes(selection.slotId)
  );

  if (duplicate) {
    await ctx.db.patch(duplicate._id, {
      updatedAt: now,
      sourceNotificationId: args.sourceNotificationId || duplicate.sourceNotificationId,
      expiresAt: now + 15 * 60 * 1000,
    });
    return duplicate._id;
  }

  return await ctx.db.insert("bookingIntents", {
    matchroomId: args.room._id,
    createdByUid: args.createdByUid,
    createdByUsername: args.createdByUsername,
    side: selection.side,
    selectedSlots: selection.selectedSlots,
    selectedSlotIds: [selection.slotId],
    role: args.role,
    source: args.source,
    sourceNotificationId: args.sourceNotificationId,
    status: "approved_pending_payment",
    pricing: {
      totalCost: Number(args.room.pricing?.perPlayer || 0),
      perPlayerCost: Number(args.room.pricing?.perPlayer || 0),
      currency: String(args.room.pricing?.currency || "PKR"),
    },
    game: args.room.game,
    paymentStatus: "unpaid",
    expiresAt: now + 15 * 60 * 1000,
    createdAt: now,
    updatedAt: now,
  });
}

function isMatchJoinRequestNotification(notification: any) {
  return MATCH_JOIN_REQUEST_TYPES.has(String(notification?.type || ""));
}

function getMatchJoinRequesterUid(notification: any) {
  const data = notification?.data as any;
  return String(notification?.fromUid || data?.requesterUid || "");
}

async function closePendingJoinRequestsForJoinedUser(
  ctx: any,
  matchroomId: Id<"matchrooms">,
  joinedUid: string,
  now: number,
) {
  const notifications = await ctx.db
    .query("notifications")
    .withIndex("by_matchroomId", (q: any) => q.eq("matchroomId", matchroomId))
    .collect();

  for (const notification of notifications) {
    if (
      isMatchJoinRequestNotification(notification) &&
      notification.status === "pending" &&
      getMatchJoinRequesterUid(notification) === joinedUid
    ) {
      await ctx.db.patch(notification._id, {
        status: "accepted",
        updatedAt: now,
      });
    }
  }
}

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
  handler: async (ctx, args): Promise<any> => {
    const room = await ctx.db
      .query("matchrooms")
      .withIndex("by_matchCode", (q: any) => q.eq("matchCode", args.matchCode))
      .unique();
    if (room) {
      return { ...room, id: room._id };
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
    matchCode: v.optional(v.string()),
    maxPlayers: v.number(),
    players: v.array(playerValidator),
    playerUids: v.array(v.string()),

    // Location
    location: v.optional(v.string()),
    locationMode: v.optional(v.string()),
    broadcastAreas: v.optional(v.array(v.string())),
    broadcastRequestStatus: v.optional(v.union(
      v.literal("idle"),
      v.literal("waiting_for_fill"),
      v.literal("waiting_for_zones"),
      v.literal("zone_confirmed"),
      v.literal("expired"),
      v.literal("cancelled"),
    )),
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
    requestedResourceAssetType: v.optional(v.string()),
    requestedResourceSurface: v.optional(v.string()),
    requestedResourceTier: v.optional(v.string()),
    selectedZoneRateKey: v.optional(v.string()),

    // Slots
    slotsA: v.array(slotValidator),
    slotsB: v.array(slotValidator),
    captainUidA: v.optional(v.string()),
    captainUidB: v.optional(v.string()),

    // Game-specific
    format: v.optional(v.string()),
    selectedMaps: v.optional(v.array(v.string())),
    skillLevel: v.optional(v.string()),
    hostSkillScore: v.optional(v.number()),
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
    paymentAmount: v.optional(v.number()),
    paymentReservedSlots: v.optional(v.number()),
    paymentCurrency: v.optional(v.string()),
    zoneAdminApproved: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requireVerifiedActor(ctx, args.hostUid);
    const actorUid = String(actor.convexUser._id);

    if (actorUid !== args.hostUid) {
      throw new Error("You can only create a matchroom as yourself");
    }

    const now = Date.now();

    if (
      args.locationMode === "zone"
      && args.zoneId
      && typeof args.scheduledStartAt === "number"
    ) {
      const existing = await ctx.db
        .query("matchrooms")
        .withIndex("by_zoneId", (q: any) => q.eq("zoneId", args.zoneId))
        .collect();

      const conflict = existing.find((room: any) => {
        if (String(room.game || "") !== String(args.game || "")) return false;
        if (room.scheduledStartAt !== args.scheduledStartAt) return false;
        return !["cancelled", "completed", "expired"].includes(String(room.status || ""));
      });

      if (conflict) {
        throw new Error(
          "This venue already has a matchroom for the same game at the same scheduled time. Please choose a different time or venue."
        );
      }
    }

    const normalizedPlayers = await Promise.all(
      args.players.map((player) =>
        createPlayerRecord(
          ctx,
          args.game,
          String(player.uid),
          player.username,
          typeof player.joinedAt === "number" ? player.joinedAt : now,
          player.role,
        ),
      ),
    );
    const normalizedPlayerUids = Array.from(new Set(normalizedPlayers.map((player) => String(player.uid))));
    const hostSkill = await requireUserGameSkill(ctx, actorUid, args.game);
    const skillStats = await buildRoomSkillStats(ctx, args.game, normalizedPlayerUids);

    const matchroomId = await ctx.db.insert("matchrooms", {
      hostUid: actorUid,
      hostName: args.hostName,
      game: args.game,
      title: args.title,
      description: args.description,
      status: "open",
      maxPlayers: args.maxPlayers,
      currentPlayers: normalizedPlayers.length,
      players: normalizedPlayers,
      playerUids: normalizedPlayerUids,
      location: args.location,
      locationMode: args.locationMode as any,
      broadcastAreas: args.broadcastAreas,
      broadcastRequestStatus:
        args.locationMode === "broadcast"
          ? (args.broadcastRequestStatus || "waiting_for_fill")
          : undefined,
      zoneId: args.zoneId,
      zoneOwnerUid: args.zoneOwnerUid,
      scheduledDate: args.scheduledDate,
      scheduledTime: args.scheduledTime,
      scheduledStartAt: args.scheduledStartAt,
      lockAt: args.lockAt,
      expiresAt: args.expiresAt,
      durationMinutes: args.durationMinutes,
      pricing: args.pricing,
      requestedResourceAssetType: args.requestedResourceAssetType,
      requestedResourceSurface: args.requestedResourceSurface,
      requestedResourceTier: args.requestedResourceTier,
      selectedZoneRateKey: args.selectedZoneRateKey,
      matchCode: args.matchCode,
      slotsA: args.slotsA,
      slotsB: args.slotsB,
      captainUidA: args.captainUidA || actorUid,
      captainUidB: args.captainUidB,
      format: args.format,
      selectedMaps: args.selectedMaps,
      skillLevel: args.skillLevel,
      hostSkillScore: hostSkill.rating,
      hostSkillTier: hostSkill.tier || args.hostSkillTier,
      hostRole: args.hostRole,
      avgSkillScoreLive: skillStats.avgSkillScoreLive,
      totalSkillSum: skillStats.totalSkillSum,
      ratedPlayerCount: skillStats.ratedPlayerCount,
      teamMode: args.teamMode as any,
      teamId: args.teamId,
      teamName: args.teamName,
      reservedSlots: args.reservedSlots,
      teamPaymentMode: args.teamPaymentMode as any,
      bookingSource: args.bookingSource,
      isPrivate: args.isPrivate,
      paymentStatus: args.paymentStatus as any,
      paymentAmount: args.paymentAmount,
      paymentReservedSlots: args.paymentReservedSlots,
      paymentCurrency: args.paymentCurrency,
      zoneAdminApproved: args.zoneAdminApproved,
      createdAt: now,
      updatedAt: now,
    });

    if (
      args.locationMode === "broadcast" &&
      normalizedPlayers.length >= args.maxPlayers
    ) {
      await dispatchBroadcastZoneRequestsForMatchroom(ctx, matchroomId);
    }

    if (
      args.locationMode === "zone" &&
      normalizedPlayers.length >= args.maxPlayers &&
      Number(args.paymentReservedSlots || 0) >= args.maxPlayers
    ) {
      await dispatchZoneAdminRequestForFullMatchroom(ctx, matchroomId);
    }

    return matchroomId;
  },
});

export const getSettlementSummary = query({
  args: { matchroomId: v.id("matchrooms") },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.matchroomId);
    if (!room) return null;
    return {
      matchroomId: String(args.matchroomId),
      grossAmount: getMatchroomGrossAmount(room),
      currency: room.paymentCurrency || room.pricing?.currency || "PKR",
      merchantSettlementStatus: room.merchantSettlementStatus || "pending",
      merchantSettlementAt: room.merchantSettlementAt || null,
      merchantSettlementAmount: room.merchantSettlementAmount || null,
      merchantSettlementReference: room.merchantSettlementReference || null,
      venuePayoutStatus: room.venuePayoutStatus || "pending",
      venuePayoutAt: room.venuePayoutAt || null,
      venuePayoutAmount: room.venuePayoutAmount || null,
      venuePayoutReference: room.venuePayoutReference || null,
    };
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
    const actor = await requireVerifiedActor(ctx, args.uid);
    const actorUid = String(actor.convexUser._id);

    if (actorUid !== args.uid) {
      throw new Error("You can only join a matchroom as yourself");
    }

    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new Error("Matchroom not found");

    if (isRoomExpired(room)) {
      throw new Error("This matchroom has expired.");
    }

    if (isRoomLocked(room)) {
      throw new Error("This matchroom is locked (no new players allowed).");
    }

    if (room.playerUids.includes(actorUid)) {
      throw new Error("You are already in this matchroom.");
    }

    const nextPlayer = await createPlayerRecord(
      ctx,
      room.game,
      actorUid,
      args.username,
      Date.now(),
      args.role || "Flex",
    );
    const nextPlayers = [...room.players, nextPlayer];
    const nextPlayerUids = [...room.playerUids, actorUid];
    const skillStats = await buildRoomSkillStats(ctx, room.game, nextPlayerUids);
    const willBeFull = nextPlayers.length >= room.maxPlayers;

    await ctx.db.patch(args.matchroomId, {
      players: nextPlayers,
      playerUids: nextPlayerUids,
      currentPlayers: nextPlayers.length,
      updatedAt: Date.now(),
      avgSkillScoreLive: skillStats.avgSkillScoreLive,
      totalSkillSum: skillStats.totalSkillSum,
      ratedPlayerCount: skillStats.ratedPlayerCount,
      ...(willBeFull
        ? { status: "locked" as const, isLocked: true, lockedAt: Date.now() }
        : {}),
    });

    if (willBeFull && room.locationMode === "broadcast") {
      await dispatchBroadcastZoneRequestsForMatchroom(ctx, args.matchroomId);
    }

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
    const skillStats = await buildRoomSkillStats(ctx, room.game, updatedUids);

    await ctx.db.patch(args.matchroomId, {
      players: updatedPlayers,
      playerUids: updatedUids,
      currentPlayers: updatedPlayers.length,
      slotsA: updatedSlotsA,
      slotsB: updatedSlotsB,
      updatedAt: Date.now(),
      avgSkillScoreLive: skillStats.avgSkillScoreLive,
      totalSkillSum: skillStats.totalSkillSum,
      ratedPlayerCount: skillStats.ratedPlayerCount,
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
      const room = await ctx.db.get(args.matchroomId);
      const captains = room ? resolveResultCaptains(room, room.resultVerification) : { team1Captain: "", team2Captain: "" };
      updateData.completedAt = Date.now();
      updateData.resultVerification = room?.resultVerification || {
        status: "pending",
        team1Captain: captains.team1Captain,
        team2Captain: captains.team2Captain,
        captainReports: {},
      };
    }
    if (args.status === "locked") {
      updateData.isLocked = true;
      updateData.lockedAt = Date.now();
    }

    await ctx.db.patch(args.matchroomId, updateData);
    if (args.status === "completed") {
      const completedRoom = await ctx.db.get(args.matchroomId);
      await payVenueWalletForCompletedMatchroom(ctx, args.matchroomId, completedRoom);
    }
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
    if (room.status !== "completed") throw new Error("Results can only be submitted after match completion");

    const rv = room.resultVerification || { status: "pending" as const };
    if (rv.status === "resolved") return { ok: true, status: "resolved", winner: rv.finalWinner };

    const { team1Captain, team2Captain } = resolveResultCaptains(room, rv);

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
    const nextRv = {
      status: rv.status || "pending",
      team1Captain,
      team2Captain,
      captainReports,
      participantVotes: rv.participantVotes,
      deadline: rv.deadline,
      votes: rv.votes,
      finalWinner: rv.finalWinner,
      resolvedAt: rv.resolvedAt,
      resolutionSource: rv.resolutionSource,
    };

    const team1Report = captainReports.team1Captain?.result;
    const team2Report = captainReports.team2Captain?.result;
    if (team1Report && team2Report) {
      if (team1Report === team2Report) {
        return await finalizeMatchroomResult(
          ctx,
          args.matchroomId,
          room,
          nextRv,
          team1Report,
          "captain_agreement",
        );
      }

      const participantUids = getMatchroomPlayerUids(room);
      if (participantUids.length <= 2) {
        return await finalizeMatchroomResult(
          ctx,
          args.matchroomId,
          room,
          nextRv,
          chooseRandomWinner(),
          "two_player_random_tiebreak",
        );
      }

      nextRv.status = "participant_vote";
      nextRv.deadline = rv.deadline || Date.now() + ONE_DAY_MS;
      nextRv.participantVotes = rv.participantVotes || {};
    }

    await ctx.db.patch(args.matchroomId, {
      resultVerification: nextRv,
      updatedAt: Date.now(),
    });

    return { ok: true, status: nextRv.status };
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
    if (rv.status === "resolved") return { ok: true, status: "resolved", winner: rv.finalWinner };
    if (rv.status !== "participant_vote") throw new Error("Participant voting is not active");

    const participantUids = getMatchroomPlayerUids(room);
    if (!participantUids.includes(String(args.participantUid))) {
      throw new Error("Only match participants can vote on this result");
    }

    const participantVotes = { ...rv.participantVotes, [args.participantUid]: args.vote };
    const team1Votes = Object.values(participantVotes).filter((vote) => vote === "team1").length;
    const team2Votes = Object.values(participantVotes).filter((vote) => vote === "team2").length;
    const submittedCount = participantUids.filter((uid) => participantVotes[uid] && participantVotes[uid] !== "unknown").length;
    const majority = Math.floor(participantUids.length / 2) + 1;
    const nextRv = {
      status: "participant_vote" as const,
      team1Captain: rv.team1Captain,
      team2Captain: rv.team2Captain,
      captainReports: rv.captainReports,
      participantVotes,
      deadline: rv.deadline,
      votes: rv.votes,
      finalWinner: rv.finalWinner,
      resolvedAt: rv.resolvedAt,
      resolutionSource: rv.resolutionSource,
    };

    if (team1Votes >= majority || team2Votes >= majority) {
      return await finalizeMatchroomResult(
        ctx,
        args.matchroomId,
        room,
        nextRv,
        team1Votes >= majority ? "team1" : "team2",
        "participant_majority",
      );
    }

    if (submittedCount >= participantUids.length && team1Votes !== team2Votes) {
      return await finalizeMatchroomResult(
        ctx,
        args.matchroomId,
        room,
        nextRv,
        team1Votes > team2Votes ? "team1" : "team2",
        "participant_all_votes",
      );
    }

    if (submittedCount >= participantUids.length && team1Votes === team2Votes) {
      return await finalizeMatchroomResult(
        ctx,
        args.matchroomId,
        room,
        nextRv,
        chooseRandomWinner(),
        "participant_random_tiebreak",
      );
    }

    await ctx.db.patch(args.matchroomId, {
      resultVerification: nextRv,
      updatedAt: Date.now(),
    });

    return { ok: true, status: "participant_vote" };
  },
});

export const getPendingResultForUser = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await resolveUserByAnyId(ctx, args.userId);
    const uidCandidates = Array.from(
      new Set([args.userId, identity?.authId, identity?._id ? String(identity._id) : null].filter(Boolean).map(String)),
    );

    const completedRooms = await ctx.db
      .query("matchrooms")
      .withIndex("by_status", (q: any) => q.eq("status", "completed"))
      .collect();

    for (const room of completedRooms) {
      const participantUids = getMatchroomPlayerUids(room);
      const isParticipant = participantUids.some((uid) => uidCandidates.includes(String(uid)));
      if (!isParticipant) continue;

      const rv = room.resultVerification || { status: "pending" as const };
      if (rv.status === "resolved") continue;

      const { team1Captain, team2Captain } = resolveResultCaptains(room, rv);
      const isTeam1Captain = uidCandidates.includes(team1Captain);
      const isTeam2Captain = uidCandidates.includes(team2Captain);

      if (rv.status === "pending") {
        if (isTeam1Captain && !rv.captainReports?.team1Captain) {
          return { room, phase: "captain", captainSlot: "team1Captain" };
        }
        if (isTeam2Captain && !rv.captainReports?.team2Captain) {
          return { room, phase: "captain", captainSlot: "team2Captain" };
        }
      }

      if (rv.status === "participant_vote") {
        const hasVoted = uidCandidates.some((uid) => Boolean(rv.participantVotes?.[uid]));
        if (!hasVoted) {
          return { room, phase: "participant", captainSlot: null };
        }
      }
    }

    return null;
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
        await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
          type: "match.cancelled",
          toUid: users[0]._id,
          status: "pending",
          dedupeKey: `match.cancelled:${String(args.matchroomId)}:${String(users[0]._id)}`,
          dedupePolicy: "upsert_active",
          matchroomId: args.matchroomId,
          route: `/matchrooms/${String(args.matchroomId)}`,
          title: "Matchroom Closed",
          body: `The matchroom "${room.title}" was closed. Reason: ${args.reason}`,
          data: {
            matchroomId: args.matchroomId,
            reason: args.reason,
            note: args.note || "",
            href: `/matchrooms/${String(args.matchroomId)}`,
          },
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
    const captain = await resolveUserByAnyId(ctx, captainUid);
    const actor = await resolveUserByAnyId(ctx, args.fromUid);
    if (!captain || !actor || captain._id !== actor._id) {
      throw new Error(`Only the captain of Team ${args.team} can send invitations for this team.`);
    }

    // Not already in room
    if (room.playerUids.includes(args.toUid)) {
      throw new Error("User is already in this matchroom.");
    }

    const entityKey = `match.seat_invite:${args.matchroomId}:${args.toUid}:${args.slotId}`;
    const now = Date.now();
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;

    // Get fromUser Convex ID
    const fromUserId = actor?._id;

    const notificationResult: any = await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "match.seat_invite",
      toUid: args.toUid,
      fromUid: fromUserId,
      fromUsername: args.fromUsername,
      status: "pending",
      dedupeKey: entityKey,
      dedupePolicy: "replace_active",
      matchroomId: args.matchroomId,
      route: `/matchrooms/${String(args.matchroomId)}`,
      title: "Matchroom Invite",
      body: `You've been invited to join ${room.title}`,
      data: {
        matchroomId: args.matchroomId,
        matchroomTitle: room.title,
        team: args.team,
        slotId: args.slotId,
        role: args.role || "Flex",
        game: room.game,
        href: `/matchrooms/${String(args.matchroomId)}`,
      },
      expiresAt: now + twoDaysMs,
    });

    return notificationResult.notificationId;
  },
});

export const syncLifecycleIfDue = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.matchroomId);
    if (!room) return { changed: false };

    const now = Date.now();
    const scheduledStartAt = room.scheduledStartAt || room.startTime;
    const durationMinutes = Math.max(1, Number(room.durationMinutes || 60));
    let changed = false;

    if (
      scheduledStartAt &&
      ["open", "locked"].includes(room.status) &&
      scheduledStartAt <= now
    ) {
      await ctx.db.patch(args.matchroomId, {
        status: "in-progress",
        startTime: room.startTime || scheduledStartAt,
        captainUidA: room.captainUidA || room.hostUid,
        updatedAt: now,
      });
      changed = true;
    }

    const refreshedRoom = changed ? await ctx.db.get(args.matchroomId) : room;
    if (!refreshedRoom) return { changed };

    const effectiveStart = refreshedRoom.startTime || refreshedRoom.scheduledStartAt;
    const shouldComplete =
      refreshedRoom.status === "in-progress" &&
      effectiveStart &&
      effectiveStart + durationMinutes * 60 * 1000 <= now;

    if (
      refreshedRoom.locationMode === "broadcast" &&
      refreshedRoom.broadcastRequestStatus === "waiting_for_zones" &&
      refreshedRoom.broadcastRequestExpiresAt &&
      refreshedRoom.broadcastRequestExpiresAt <= now
    ) {
      await finalizeBroadcastFailure(ctx, args.matchroomId, "no_zone_response");
      changed = true;
      return { changed };
    }

    if (shouldComplete) {
      const teamTwoCaptain =
        refreshedRoom.captainUidB ||
        refreshedRoom.players?.find((player: any) => player.uid !== refreshedRoom.hostUid)?.uid ||
        undefined;

      await ctx.db.patch(args.matchroomId, {
        status: "completed",
        completedAt: now,
        resultVerification: refreshedRoom.resultVerification || {
          status: "pending",
          team1Captain: refreshedRoom.captainUidA || refreshedRoom.hostUid,
          team2Captain: teamTwoCaptain,
        },
        updatedAt: now,
      });
      const completedRoom = await ctx.db.get(args.matchroomId);
      await payVenueWalletForCompletedMatchroom(ctx, args.matchroomId, completedRoom);
      changed = true;
    }

    return { changed };
  },
});

// Request to join a matchroom (creates notification for host)
export const requestToJoinMatchroom = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    fromUid: v.id("users"),
    fromUsername: v.string(),
    role: v.optional(v.string()),
    targetTeam: v.optional(v.string()),
    slotId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireVerifiedActor(ctx, String(args.fromUid));
    const actorUid = String(actor.convexUser._id);

    if (actorUid !== String(args.fromUid)) {
      throw new Error("You can only request to join a matchroom as yourself");
    }

    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new Error("Matchroom not found");

    if (isRoomExpired(room)) throw new Error("This matchroom has expired.");
    if (isRoomLocked(room)) throw new Error("This matchroom is locked.");
    if (room.playerUids.includes(actorUid)) throw new Error("You are already in this matchroom.");
    const now = Date.now();
    const role = args.role || "Player";
    const targetTeam = args.targetTeam || "Any";
    const approvalGroupKey = `match_join_request_${args.matchroomId}_${actorUid}`;
    const roomNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_matchroomId", (q) => q.eq("matchroomId", args.matchroomId))
      .collect();

    const existingPendingRequest = roomNotifications.find((notification) => {
      return (
        isMatchJoinRequestNotification(notification) &&
        notification.status === "pending" &&
        getMatchJoinRequesterUid(notification) === actorUid
      );
    });

    if (existingPendingRequest) {
      return {
        ok: true,
        alreadyPending: true,
        joined: false,
        notificationIds: [existingPendingRequest._id],
        message: "Your join request is already pending captain approval.",
      };
    }

    const requesterSkill = await requireUserGameSkill(ctx, actorUid, room.game);
    const skillStats = room.avgSkillScoreLive != null && room.ratedPlayerCount
      ? {
          avgSkillScoreLive: room.avgSkillScoreLive,
          totalSkillSum: room.totalSkillSum || 0,
          ratedPlayerCount: room.ratedPlayerCount,
        }
      : await buildRoomSkillStats(ctx, room.game, room.playerUids || []);

    if (typeof skillStats.avgSkillScoreLive !== "number" || !skillStats.ratedPlayerCount) {
      throw new Error("Matchroom skill average is unavailable. Ask the host to recreate the room.");
    }

    const ratingDiff = Math.abs(Number(requesterSkill.rating) - Number(skillStats.avgSkillScoreLive));
    const requesterLevelLabel = requesterSkill.tier
      ? `${requesterSkill.tier} (${Math.round(Number(requesterSkill.rating))})`
      : `Rating ${Math.round(Number(requesterSkill.rating))}`;
    if (ratingDiff <= SKILL_JOIN_DELTA) {
      const intentId = await createSingleSeatBookingIntent(ctx, {
        room,
        createdByUid: actor.convexUser._id,
        createdByUsername: args.fromUsername,
        role,
        targetTeam,
        requestedSlotId: args.slotId || null,
        source: "direct_join",
      });
      return {
        ok: true,
        autoJoined: false,
        joined: false,
        paymentRequired: true,
        intentId,
        message: `Your rating is within ${SKILL_JOIN_DELTA} points of the room average. Please pay now to confirm your slot.`,
      };
    }

    const captainUids = getAvailableCaptainUids(room);
    if (captainUids.length === 0) {
      throw new Error("No available captains found for this matchroom.");
    }

    const oneDayMs = 24 * 60 * 60 * 1000;
    const createdNotificationIds: Id<"notifications">[] = [];
    for (const captainUid of captainUids) {
      const captain = await resolveUserByAnyId(ctx, captainUid);
      if (!captain) {
        continue;
      }

      const notificationResult: any = await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: "match.join_request",
        toUid: captain._id,
        fromUid: args.fromUid,
        fromUsername: args.fromUsername,
        status: "pending",
        dedupeKey: `match.join_request:${approvalGroupKey}:${String(captain._id)}`,
        dedupePolicy: "upsert_active",
        matchroomId: args.matchroomId,
        route: `/matchrooms/${String(args.matchroomId)}`,
        title: "Captain Approval Required",
        body: `${args.fromUsername} (${requesterLevelLabel}) wants to join ${room.title}`,
        data: {
          matchroomId: args.matchroomId,
          fromAuthId: actor.userId,
          matchroomTitle: room.title,
          game: room.game,
          role,
          targetTeam,
          slotId: args.slotId || null,
          approvalGroupKey,
          approvalRequired: true,
          requiredCaptainUids: captainUids,
          requesterUid: actorUid,
          requesterRating: requesterSkill.rating,
          requesterSkillTier: requesterSkill.tier || null,
          roomAverageRating: skillStats.avgSkillScoreLive,
          ratingDifference: ratingDiff,
          href: `/matchrooms/${String(args.matchroomId)}`,
        },
        expiresAt: now + oneDayMs,
      });
      createdNotificationIds.push(notificationResult.notificationId);
    }

    if (!createdNotificationIds.length) {
      throw new Error("No available captains found for this matchroom.");
    }

    return {
      ok: true,
      approvalRequested: true,
      joined: false,
      message: "Your rating is outside the allowed range. All available captains must approve this join request.",
      notificationIds: createdNotificationIds,
    };
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
    if (notif.toUid !== args.userId) throw new Error("Not authorized");
    if (notif.status !== "pending") throw new Error("Invitation already handled.");

    const now = Date.now();
    const invitee = await ctx.db.get(args.userId);
    const inviteeName = invitee?.username || invitee?.fullName || "Player";
    const data = notif.data as any;
    const matchroomId = notif.matchroomId || data?.matchroomId;

    if (!args.accept) {
      await ctx.db.patch(args.notificationId, { status: "declined", updatedAt: now });
      if (notif.fromUid) {
        await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
          type: "match.invite_response",
          toUid: notif.fromUid,
          fromUid: args.userId,
          fromUsername: inviteeName,
          status: "declined",
          dedupeKey: `match.invite_response:${String(args.notificationId)}:declined`,
          dedupePolicy: "replace_active",
          matchroomId: matchroomId as Id<"matchrooms"> | undefined,
          route: matchroomId ? `/matchrooms/${String(matchroomId)}` : "/(player)/inbox",
          title: "Seat Invite Declined",
          body: `${inviteeName} declined the match invitation.`,
          data: {
            inviteNotificationId: String(args.notificationId),
            matchroomId: matchroomId ? String(matchroomId) : null,
            decision: "declined",
            href: matchroomId ? `/matchrooms/${String(matchroomId)}` : "/(player)/inbox",
          },
        });
      }
      return { ok: true };
    }

    if (!matchroomId) throw new Error("Matchroom reference missing");

    const room = await ctx.db.get(matchroomId as Id<"matchrooms">);
    if (!room) throw new Error("Matchroom not found.");
    if (isRoomExpired(room)) throw new Error("This matchroom has expired.");
    if (isRoomLocked(room) || (room.currentPlayers || 0) >= room.maxPlayers) {
      throw new Error("This matchroom is locked.");
    }

    // Already in room
    if (room.playerUids.includes(args.userId as string)) {
      throw new Error("You are already in this matchroom.");
    }

    const team = data?.team;
    const slotId = data?.slotId;
    const role = data?.role || "Flex";
    const intentId = await createSingleSeatBookingIntent(ctx, {
      room,
      createdByUid: args.userId,
      createdByUsername: inviteeName,
      role,
      targetTeam: team,
      requestedSlotId: slotId,
      source: "captain_invite",
    });
    await ctx.db.patch(args.notificationId, { status: "accepted", updatedAt: now });

    const paymentNotificationResult: any = await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "match.payment_required",
      toUid: args.userId,
      fromUid: notif.fromUid,
      fromUsername: notif.fromUsername || "Captain",
      status: "pending",
      isRead: false,
      dedupeKey: `match.payment_required:${String(matchroomId)}:${String(args.userId)}:${String(intentId)}`,
      dedupePolicy: "upsert_active",
      matchroomId: matchroomId as Id<"matchrooms">,
      route: `/matchrooms/${String(matchroomId)}`,
      title: "Pay to Confirm Slot",
      body: `Your invite to ${room.title} was accepted. Pay now to secure your slot.`,
      data: {
        matchroomId: String(matchroomId),
        matchroomTitle: room.title,
        game: room.game,
        role,
        targetTeam: team,
        slotId: slotId || null,
        intentId,
        paymentRequired: true,
        href: `/matchrooms/${String(matchroomId)}`,
      },
      expiresAt: now + 15 * 60 * 1000,
    });
    await ctx.db.patch(intentId, {
      sourceNotificationId: paymentNotificationResult.notificationId,
      updatedAt: now,
    });

    if (notif.fromUid) {
      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: "match.invite_response",
        toUid: notif.fromUid,
        fromUid: args.userId,
        fromUsername: inviteeName,
        status: "accepted",
        dedupeKey: `match.invite_response:${String(args.notificationId)}:accepted`,
        dedupePolicy: "replace_active",
        matchroomId: matchroomId as Id<"matchrooms">,
        route: `/matchrooms/${String(matchroomId)}`,
        title: "Seat Invite Accepted",
        body: `${inviteeName} accepted the match invitation and now needs to pay.`,
        data: {
          inviteNotificationId: String(args.notificationId),
          matchroomId: String(matchroomId),
          intentId: String(intentId),
          decision: "accepted",
          href: `/matchrooms/${String(matchroomId)}`,
        },
      });
    }

    return {
      ok: true,
      paymentRequired: true,
      intentId,
      message: "Please pay now to confirm your invited slot.",
    };
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
    if (!isMatchJoinRequestNotification(notif)) {
      throw new Error("Invalid notification type");
    }
    if (notif.status !== "pending") throw new Error("Request already handled");

    const now = Date.now();
    const data = notif.data as any;
    const matchroomId = notif.matchroomId || data?.matchroomId;
    if (!matchroomId) throw new Error("Matchroom ID missing from request");

    const room = await ctx.db.get(matchroomId as Id<"matchrooms">);
    if (!room) throw new Error("Matchroom not found");
    const actor = await resolveUserByAnyId(ctx, args.hostUid);
    if (!actor) throw new Error("Only captains can respond to join requests");

    const approvalRequired = data?.approvalRequired === true;
    const availableCaptainUids = getAvailableCaptainUids(room);
    const isCaptainResponder = availableCaptainUids.some((uid) => String(uid) === String(actor._id));
    if (!isCaptainResponder) {
      throw new Error("Only captains can respond to join requests");
    }

    if (isRoomExpired(room)) {
      await ctx.db.patch(args.notificationId, { status: "rejected", updatedAt: now });
      return { ok: false, message: "Matchroom expired." };
    }

    const requesterId = String(notif.fromUid || data?.requesterUid || data?.fromAuthId || "");
    const requester = requesterId ? await resolveUserByAnyId(ctx, requesterId) : null;
    const requesterUid = requester ? String(requester._id) : "";
    const requesterUsername = notif.fromUsername || "Player";
    const role = data?.role || "Flex";
    const targetTeam = data?.targetTeam || "Any";
    const relatedNotifications = approvalRequired && requesterUid
      ? (await ctx.db
          .query("notifications")
          .withIndex("by_matchroomId", (q) => q.eq("matchroomId", matchroomId as Id<"matchrooms">))
          .collect()).filter((notification) => {
            return (
              isMatchJoinRequestNotification(notification) &&
              getMatchJoinRequesterUid(notification) === requesterUid
            );
          })
      : [notif];

    if (!requesterUid) {
      await ctx.db.patch(args.notificationId, { status: "rejected", updatedAt: now });
      throw new Error("Requester not found");
    }

    if ((room.currentPlayers || 0) >= room.maxPlayers) {
      await ctx.db.patch(args.notificationId, { status: "rejected", updatedAt: now });
      throw new Error("Matchroom is full");
    }

    // Check if already in room
    if (room.playerUids.includes(requesterUid)) {
      const targetNotifications = approvalRequired ? relatedNotifications : [notif];
      for (const notification of targetNotifications) {
        if (notification.status === "pending") {
          await ctx.db.patch(notification._id, { status: "accepted", updatedAt: now });
        }
      }
      return { ok: true, message: "User is already in the matchroom." };
    }

    if (!args.accept) {
      const targetNotifications = approvalRequired ? relatedNotifications : [notif];
      for (const notification of targetNotifications) {
        if (notification.status === "pending") {
          await ctx.db.patch(notification._id, { status: "rejected", updatedAt: now });
        }
      }
      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: "match.join_request_result",
        toUid: requester._id,
        fromUid: actor._id,
        fromUsername: actor.username || actor.fullName || "Captain",
        status: "rejected",
        dedupeKey: `match.join_request_result:${String(matchroomId)}:${requesterUid}:rejected`,
        dedupePolicy: "replace_active",
        matchroomId: matchroomId as Id<"matchrooms">,
        route: `/matchrooms/${String(matchroomId)}`,
        title: "Join Request Rejected",
        body: approvalRequired
          ? `Your join request for ${room.title} was rejected because the required captain approvals did not come through.`
          : `Your join request for ${room.title} was rejected.`,
        data: {
          matchroomId: String(matchroomId),
          matchroomTitle: room.title,
          decision: "rejected",
          approvalRequired,
          href: `/matchrooms/${String(matchroomId)}`,
        },
      });
      return {
        ok: true,
        message: approvalRequired
          ? "Join request rejected. All captain approvals are required for out-of-range players."
          : "Request rejected.",
      };
    }

    if (!approvalRequired) {
      const intentId = await createSingleSeatBookingIntent(ctx, {
        room,
        createdByUid: requester._id,
        createdByUsername: requesterUsername,
        role,
        targetTeam,
        requestedSlotId: data?.slotId || null,
        source: "captain_approved_join",
      });

      await ctx.db.patch(args.notificationId, { status: "accepted", updatedAt: now });
      const paymentNotificationResult: any = await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: "match.payment_required",
        toUid: requester._id,
        fromUid: actor._id,
        fromUsername: actor.username || actor.fullName || "Captain",
        status: "pending",
        isRead: false,
        dedupeKey: `match.payment_required:${String(matchroomId)}:${requesterUid}:${String(intentId)}`,
        dedupePolicy: "upsert_active",
        matchroomId: matchroomId as Id<"matchrooms">,
        route: `/matchrooms/${String(matchroomId)}`,
        title: "Request Accepted",
        body: `Your request for ${room.title} has been accepted. Pay now to confirm your slot.`,
        data: {
          matchroomId,
          matchroomTitle: room.title,
          game: room.game,
          role,
          targetTeam,
          slotId: data?.slotId || null,
          intentId,
          paymentRequired: true,
          href: `/matchrooms/${String(matchroomId)}`,
        },
        expiresAt: now + 15 * 60 * 1000,
      });
      await ctx.db.patch(intentId, {
        sourceNotificationId: paymentNotificationResult.notificationId,
        updatedAt: now,
      });
      return { ok: true, message: "Approval recorded. Player must now pay to confirm the slot." };
    }

    await ctx.db.patch(args.notificationId, { status: "accepted", updatedAt: now });

    const storedRequiredCaptainIds = Array.from(
      new Set(
        ((data?.requiredCaptainUids as string[] | undefined) || availableCaptainUids)
          .map((uid) => String(uid))
          .filter(Boolean),
      ),
    );
    const requiredCaptainIds = storedRequiredCaptainIds.filter((uid) =>
      availableCaptainUids.some((availableUid) => String(availableUid) === uid),
    );
    const acceptedCaptainIds = new Set(
      relatedNotifications
        .filter((notification) => {
          const notificationData = notification.data as any;
          return notification.status === "accepted" && requiredCaptainIds.includes(String(notification.toUid || notificationData?.toUid || ""));
        })
        .map((notification) => String(notification.toUid)),
    );
    acceptedCaptainIds.add(String(notif.toUid));

    const everyoneApproved = requiredCaptainIds.every((uid) => acceptedCaptainIds.has(String(uid)));
    if (!everyoneApproved) {
      return {
        ok: true,
        message: "Approval recorded. Waiting for the remaining captain approvals.",
      };
    }

    const intentId = await createSingleSeatBookingIntent(ctx, {
      room,
      createdByUid: requester._id,
      createdByUsername: requesterUsername,
      role,
      targetTeam,
      requestedSlotId: data?.slotId || null,
      source: "captain_approved_join",
    });

    for (const notification of relatedNotifications) {
      if (notification.status === "pending") {
        await ctx.db.patch(notification._id, { status: "accepted", updatedAt: now });
      }
    }

    const paymentNotificationResult: any = await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "match.payment_required",
      toUid: requester._id,
      fromUid: actor._id,
      fromUsername: actor.username || actor.fullName || "Captain",
      status: "pending",
      isRead: false,
      dedupeKey: `match.payment_required:${String(matchroomId)}:${requesterUid}:${String(intentId)}`,
      dedupePolicy: "upsert_active",
      matchroomId: matchroomId as Id<"matchrooms">,
      route: `/matchrooms/${String(matchroomId)}`,
      title: "Request Accepted",
      body: `Your request for ${room.title} has been accepted. Pay now to confirm your slot.`,
      data: {
        matchroomId,
        matchroomTitle: room.title,
        game: room.game,
        role,
        targetTeam,
        slotId: data?.slotId || null,
        intentId,
        paymentRequired: true,
        href: `/matchrooms/${String(matchroomId)}`,
      },
      expiresAt: now + 15 * 60 * 1000,
    });
    await ctx.db.patch(intentId, {
      sourceNotificationId: paymentNotificationResult.notificationId,
      updatedAt: now,
    });

    return { ok: true, message: "All captains approved. The player must now pay to confirm the slot." };
  },
});

export const payMatchroomSeatIntent = mutation({
  args: {
    intentId: v.id("bookingIntents"),
    userId: v.optional(v.id("users")),
    externalPaymentReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireVerifiedActor(ctx, args.userId ? String(args.userId) : undefined);
    const payerUid = String(actor.convexUser._id);
    const intent = await ctx.db.get(args.intentId);
    if (!intent) throw new Error("Booking intent not found");
    if (String(intent.createdByUid) !== payerUid) {
      throw new Error("You can only pay for your own slot.");
    }
    const payerUsername =
      intent.createdByUsername || actor.convexUser.username || actor.convexUser.fullName || "Player";
    if (intent.paymentStatus === "paid" || intent.status === "confirmed") {
      return { ok: true, matchroomId: intent.matchroomId, alreadyConfirmed: true };
    }
    if (intent.expiresAt && intent.expiresAt < Date.now()) {
      const now = Date.now();
      await ctx.db.patch(args.intentId, { status: "expired", updatedAt: now });
      if (intent.sourceNotificationId) {
        await ctx.db.patch(intent.sourceNotificationId, {
          status: "expired",
          updatedAt: now,
        });
      }
      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: "match.payment_result",
        toUid: actor.convexUser._id,
        fromUid: actor.convexUser._id,
        fromUsername: payerUsername,
        status: "expired",
        dedupeKey: `match.payment_result:${String(args.intentId)}:expired`,
        dedupePolicy: "replace_active",
        matchroomId: intent.matchroomId,
        route: `/matchrooms/${String(intent.matchroomId)}`,
        title: "Payment Expired",
        body: "Your payment window expired before the slot could be confirmed.",
        data: {
          intentId: String(args.intentId),
          matchroomId: String(intent.matchroomId),
          decision: "expired",
          href: `/matchrooms/${String(intent.matchroomId)}`,
        },
      });
      throw new Error("This payment window expired.");
    }

    const room = await ctx.db.get(intent.matchroomId);
    if (!room) throw new Error("Matchroom not found.");
    if (isRoomExpired(room)) throw new Error("This matchroom has expired.");
    if (isRoomLocked(room) && !(room.playerUids || []).includes(payerUid)) {
      throw new Error("This matchroom is locked.");
    }
    if ((room.playerUids || []).includes(payerUid)) {
      const now = Date.now();
      await ctx.db.patch(args.intentId, {
        status: "confirmed",
        paymentStatus: "paid",
        updatedAt: now,
      });
      await closePendingJoinRequestsForJoinedUser(ctx, room._id, payerUid, now);
      return { ok: true, matchroomId: room._id, alreadyConfirmed: true };
    }

    const side = intent.side;
    const slotId = String((intent.selectedSlotIds || [])[0] || "");
    if (!slotId) {
      throw new Error("Seat reference missing from booking.");
    }

    const targetSlots = side === "A" ? (room.slotsA || []) : (room.slotsB || []);
    const slot = targetSlots.find((entry: any) => String(entry.slotId) === slotId);
    if (!slot || slot?.uid || slot?.user?.uid) {
      await ctx.db.patch(args.intentId, {
        status: "expired",
        updatedAt: Date.now(),
      });
      if (intent.sourceNotificationId) {
        await ctx.db.patch(intent.sourceNotificationId, {
          status: "expired",
          updatedAt: Date.now(),
        });
      }
      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: "match.payment_result",
        toUid: actor.convexUser._id,
        fromUid: actor.convexUser._id,
        fromUsername: payerUsername,
        status: "expired",
        dedupeKey: `match.payment_result:${String(args.intentId)}:slot_unavailable`,
        dedupePolicy: "replace_active",
        matchroomId: intent.matchroomId,
        route: `/matchrooms/${String(intent.matchroomId)}`,
        title: "Payment Expired",
        body: "This slot is no longer available, so the pending payment was closed.",
        data: {
          intentId: String(args.intentId),
          matchroomId: String(intent.matchroomId),
          decision: "expired",
          reason: "slot_unavailable",
          href: `/matchrooms/${String(intent.matchroomId)}`,
        },
      });
      throw new Error("This slot is no longer available.");
    }

    const amount = Number(intent.pricing?.totalCost || room.pricing?.perPlayer || 0);
    const walletBalance = Number(actor.convexUser.walletBalance || 0);
    const isExternalPayment = Boolean(args.externalPaymentReference);
    if (!isExternalPayment && (!Number.isFinite(walletBalance) || walletBalance < amount)) {
      throw new Error("Insufficient wallet balance. Please add funds from Wallet.");
    }

    const role = intent.role || "Player";
    const rosterPatch = await buildMatchroomRosterPatch(
      ctx,
      room,
      payerUid,
      payerUsername,
      role,
      side,
      slotId,
    );

    const now = Date.now();
    if (isExternalPayment) {
      await ctx.db.insert("walletTransactions", {
        userId: actor.convexUser._id,
        type: "booking_payment",
        amount,
        status: "completed",
        reference: args.externalPaymentReference,
        metadata: {
          provider: "easypaisa",
          matchroomId: String(room._id),
          slotId,
          intentId: String(args.intentId),
        },
        createdAt: now,
      });
    } else {
      await ctx.db.patch(actor.convexUser._id, {
        walletBalance: walletBalance - amount,
        updatedAt: now,
      });
      await ctx.db.insert("walletTransactions", {
        userId: actor.convexUser._id,
        type: "withdrawal",
        amount,
        status: "completed",
        reference: `matchroom_slot_${String(room._id)}_${slotId}`,
        metadata: {
          intentId: String(args.intentId),
          matchroomId: String(room._id),
          slotId,
          paymentMethod: "wallet",
        },
        createdAt: now,
      });
    }
    await ctx.db.patch(intent.matchroomId, rosterPatch.patch);
    await ctx.db.patch(args.intentId, {
      status: "confirmed",
      paymentStatus: "paid",
      updatedAt: now,
    });
    if (intent.sourceNotificationId) {
      await ctx.db.patch(intent.sourceNotificationId, {
        status: "accepted",
        updatedAt: now,
      });
    }
    await closePendingJoinRequestsForJoinedUser(ctx, intent.matchroomId, payerUid, now);
    const paidRoom = await ctx.db.get(intent.matchroomId);
    await markMerchantCapturedForMatchroom(ctx, intent.matchroomId, paidRoom);

    const relatedPaymentNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_toUid", (q: any) => q.eq("toUid", actor.convexUser._id))
      .collect();
    for (const notification of relatedPaymentNotifications) {
      const data = notification.data as any;
      if (
        ["match_seat_invitation", "match.payment_required"].includes(String(notification.type || ""))
        && notification.status === "pending"
        && String(data?.intentId || "") === String(args.intentId)
      ) {
        await ctx.db.patch(notification._id, {
          status: "accepted",
          updatedAt: now,
        });
      }
    }

    await addUserToMatchroomChatroom(ctx, intent.matchroomId, payerUid, now);

    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "match.payment_result",
      toUid: actor.convexUser._id,
      fromUid: actor.convexUser._id,
      fromUsername: payerUsername,
      status: "accepted",
      dedupeKey: `match.payment_result:${String(args.intentId)}:paid`,
      dedupePolicy: "replace_active",
      matchroomId: intent.matchroomId,
      route: `/matchrooms/${String(intent.matchroomId)}`,
      title: "Payment Successful",
      body: `Your slot for ${room.title} is now confirmed.`,
      data: {
        intentId: String(args.intentId),
        matchroomId: String(intent.matchroomId),
        matchroomTitle: room.title,
        decision: "paid",
        href: `/matchrooms/${String(intent.matchroomId)}`,
      },
    });

    if (rosterPatch.willBeFull) {
      if (room.locationMode === "broadcast") {
        await dispatchBroadcastZoneRequestsForMatchroom(ctx, intent.matchroomId);
      } else if (room.locationMode === "zone") {
        await dispatchZoneAdminRequestForFullMatchroom(ctx, intent.matchroomId);
      }
    }

    return {
      ok: true,
      matchroomId: room._id,
      willBeFull: rosterPatch.willBeFull,
    };
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

    const caller = await resolveUserByAnyId(ctx, args.callerUid);
    const player = await resolveUserByAnyId(ctx, args.playerUid);
    const roomHost = await resolveUserByAnyId(ctx, room.hostUid);
    const captainA = await resolveUserByAnyId(ctx, room.captainUidA || room.hostUid);
    const captainB = await resolveUserByAnyId(ctx, room.captainUidB);
    if (!caller || !player) throw new Error("User not found.");

    const isHost = !!roomHost && roomHost._id === caller._id;
    const slotsA = room.slotsA || [];
    const slotsB = room.slotsB || [];
    const inTeamA = slotsA.some((s: any) => String(s?.uid || s?.user?.uid || "") === String(player._id));
    const inTeamB = slotsB.some((s: any) => String(s?.uid || s?.user?.uid || "") === String(player._id));
    const isCaptainA = !!captainA && captainA._id === caller._id;
    const isCaptainB = !!captainB && captainB._id === caller._id;
    const canKick = isHost || (inTeamA && isCaptainA) || (inTeamB && isCaptainB);

    if (!canKick) throw new Error("You do not have permission to kick this player.");

    const updatedPlayers = room.players.filter((p) => String(p.uid) !== String(player._id));
    const updatedUids = room.playerUids.filter((uid) => String(uid) !== String(player._id));

    const releaseSlot = (slots: any[]) =>
      slots.map((s: any) => {
        const slotUid = s?.uid || s?.user?.uid;
        const reservedUid = s?.reservedForUid || s?.reservedFor?.uid;
        if (String(slotUid || "") === String(player._id) || String(reservedUid || "") === String(player._id)) {
          return { slotId: s.slotId, status: "open" as const, role: s.role };
        }
        return s;
      });

    const now = Date.now();
    const skillStats = await buildRoomSkillStats(ctx, room.game, updatedUids);
    const updates: any = {
      players: updatedPlayers,
      playerUids: updatedUids,
      currentPlayers: updatedPlayers.length,
      slotsA: releaseSlot(slotsA),
      slotsB: releaseSlot(slotsB),
      updatedAt: now,
      avgSkillScoreLive: skillStats.avgSkillScoreLive,
      totalSkillSum: skillStats.totalSkillSum,
      ratedPlayerCount: skillStats.ratedPlayerCount,
    };

    if (captainA?._id === player._id) updates.captainUidA = undefined;
    if (captainB?._id === player._id) updates.captainUidB = undefined;

    await ctx.db.patch(args.matchroomId, updates);

    // Remove from chatroom
    const chatrooms = await ctx.db
      .query("chatrooms")
      .withIndex("by_matchroomId", (q) => q.eq("matchroomId", args.matchroomId))
      .take(1);
    if (chatrooms.length > 0) {
      const chat = chatrooms[0];
      const participantUids = (chat.participantUids || []).filter((uid) => String(uid) !== String(player._id));
      await ctx.db.patch(chat._id, { participantUids, updatedAt: now });
      const member = await ctx.db
        .query("chatroomMembers")
        .withIndex("by_chatroomId_and_userId", (q: any) =>
          q.eq("chatroomId", chat._id).eq("userId", String(player._id))
        )
        .unique();
      if (member) {
        await ctx.db.delete(member._id);
      }
    }

    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "match.participant_removed",
      toUid: player._id,
      fromUid: caller._id,
      fromUsername: caller.username || caller.fullName || "Captain",
      status: "rejected",
      dedupeKey: `match.participant_removed:${String(args.matchroomId)}:${String(player._id)}:${now}`,
      dedupePolicy: "replace_active",
      matchroomId: args.matchroomId,
      route: `/matchrooms/${String(args.matchroomId)}`,
      title: "Removed from matchroom",
      body: `You were removed from ${room.title}.`,
      data: {
        matchroomId: String(args.matchroomId),
        matchroomTitle: room.title,
        href: `/matchrooms/${String(args.matchroomId)}`,
      },
    });

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
    const caller = await resolveUserByAnyId(ctx, args.callerUid);
    const newCaptain = await resolveUserByAnyId(ctx, args.newCaptainUid);
    const currentCaptain = await resolveUserByAnyId(
      ctx,
      currentCaptainUid || (args.team === "A" ? room.hostUid : undefined),
    );
    const roomHost = await resolveUserByAnyId(ctx, room.hostUid);

    if (!caller || !newCaptain) {
      throw new Error("User not found");
    }

    const isHost = !!roomHost && roomHost._id === caller._id;

    if ((!currentCaptain || currentCaptain._id !== caller._id) && !isHost) {
      throw new Error("Only the current captain or the host can transfer leadership.");
    }

    // Verify new captain is in the team
    const slots = args.team === "A" ? room.slotsA : room.slotsB;
    const isMember = (slots || []).some((s: any) => String(s?.uid || s?.user?.uid || "") === String(newCaptain._id));
    if (!isMember) {
      throw new Error("Target player must be in your team to become captain.");
    }

    const now = Date.now();
    const updateData: any = { updatedAt: now };
    if (args.team === "A") {
      updateData.captainUidA = String(newCaptain._id);
      if (isHost) {
        updateData.hostUid = String(newCaptain._id);
      }
    } else {
      updateData.captainUidB = String(newCaptain._id);
    }

    await ctx.db.patch(args.matchroomId, updateData);
    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "match.captain_transferred",
      toUid: newCaptain._id,
      fromUid: caller._id,
      fromUsername: caller.username || caller.fullName || "Captain",
      status: "accepted",
      dedupeKey: `match.captain_transferred:${String(args.matchroomId)}:${String(newCaptain._id)}:${args.team}`,
      dedupePolicy: "replace_active",
      matchroomId: args.matchroomId,
      route: `/matchrooms/${String(args.matchroomId)}`,
      title: "You are now captain",
      body: `Captaincy for team ${args.team} in ${room.title} was transferred to you.`,
      data: {
        matchroomId: String(args.matchroomId),
        team: args.team,
        href: `/matchrooms/${String(args.matchroomId)}`,
      },
    });

    if (currentCaptain && String(currentCaptain._id) !== String(newCaptain._id)) {
      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: "match.captain_transferred",
        toUid: currentCaptain._id,
        fromUid: newCaptain._id,
        fromUsername: newCaptain.username || newCaptain.fullName || "Captain",
        status: "accepted",
        dedupeKey: `match.captain_transferred:${String(args.matchroomId)}:${String(currentCaptain._id)}:${args.team}`,
        dedupePolicy: "replace_active",
        matchroomId: args.matchroomId,
        route: `/matchrooms/${String(args.matchroomId)}`,
        title: "Captaincy transferred",
        body: `Captaincy for team ${args.team} in ${room.title} was transferred to ${newCaptain.username || newCaptain.fullName || "a teammate"}.`,
        data: {
          matchroomId: String(args.matchroomId),
          team: args.team,
          href: `/matchrooms/${String(args.matchroomId)}`,
        },
      });
    }
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
      (n) => isMatchJoinRequestNotification(n) && n.status === "pending"
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
