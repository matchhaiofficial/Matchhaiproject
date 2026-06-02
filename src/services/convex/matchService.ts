// src/services/convex/matchService.ts
// Convex-based matchroom service that maintains the same interface as the Firebase version

import { convex } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { currentUser, requireKycAccess } from "./authService";
import { normalizeGameKey } from "../../features/discover/utils/gameKeys";
import { initializeSkillIfMissing, type GameKey, type GameSkillScore } from "../skillRatingService";
import { isProfileGameEnabled } from "../userService";
import { getCanonicalGameLabel } from "../../utils/gameLabels";
import {
  getMatchroomLockAtMs,
  validateMatchroomScheduleWindow,
} from "../../constants/timing";
import {
  cleanConvexErrorMessage,
  getUserFacingErrorMessage,
  isAuthSessionError,
} from "../../utils/userFacingErrors";

export interface Slot {
  slotId: string;
  uid?: string;
  user?: {
    uid: string;
    username: string;
    photoURL?: string;
    skillTier?: "Beginner" | "Intermediate" | "Advanced" | "Pro" | "Elite";
  };
  status: "open" | "reserved" | "confirmed";
  reservedFor?: {
    uid: string;
    username: string;
    photoURL?: string;
  };
  reservedForUid?: string;
  role?: string;
}

export interface Matchroom {
  id?: string;
  _id?: string;
  friendJoinedCount?: number;
  hostUid: string;
  hostName: string;
  game: string;
  title: string;
  description?: string;
  status: "open" | "in-progress" | "completed" | "locked" | "expired" | "cancelled";
  maxPlayers: number;
  currentPlayers: number;
  players: Array<{
    uid: string;
    username: string;
    joinedAt: any;
    role?: string;
    skillTier?: "Beginner" | "Intermediate" | "Advanced" | "Pro" | "Elite";
  }>;
  playerUids?: string[];
  createdAt: any;
  completedAt?: any;

  // Location fields
  location?: string;
  coordinates?: { latitude: number; longitude: number };
  locationMode?: "zone" | "broadcast";
  broadcastAreas?: string[];
  broadcastRequestStatus?:
    | "idle"
    | "waiting_for_fill"
    | "waiting_for_zones"
    | "zone_confirmed"
    | "failed"
    | "expired"
    | "cancelled";
  broadcastRequestStartedAt?: number;
  broadcastRequestExpiresAt?: number;
  confirmedZoneId?: string;
  confirmedBranchId?: string;
  venueConfirmedAt?: number;
  zoneId?: string;
  zoneOwnerUid?: string;
  branchId?: string;
  resourceIds?: string[];
  // P1: per-attempt idempotency key for the direct wallet/free create path.
  clientCreateRequestId?: string;

  // Timing & Pricing
  startTime?: any;
  scheduledDate?: string;
  scheduledTime?: string;
  scheduledStartAt?: number;
  lockAt?: number;
  expiresAt?: number;
  durationMinutes?: number;
  pricing: { perPlayer: number; currency: string };
  requestedResourceAssetType?: string;
  requestedResourceSurface?: string;
  requestedResourceTier?: string;
  selectedZoneRateKey?: string;
  matchCode?: string | null;
  // Server-derived: true only for host/captain/joined participants/owning zone
  // admin/super admin. Outsiders receive `false` and a null matchCode.
  canViewCheckIn?: boolean;
  flexibility?: string;
  bookingSource?: string;
  skipBookingRequest?: boolean;

  // Game-Specific Fields
  format?: string;
  seriesType?: string | null;
  durationHours?: number | null;
  selectedMaps?: string[];
  skillLevel?: string;
  hostSkillScore?: number | null;
  hostSkillTier?: "Beginner" | "Intermediate" | "Advanced" | "Pro" | "Any";
  hostRole?: string;
  hostSkillContext?: { gameKey: string; answers: Record<string, any> };

  // Live Fairness Stats
  avgSkillScoreLive?: number;
  totalSkillSum?: number;
  ratedPlayerCount?: number;

  // Game-specific options
  playstyle?: string | null;
  rankRequirement?: string | null;
  overs?: number | null;
  sidePreference?: string | null;
  composition?: string | null;
  battingOrder?: string | null;
  battingStyle?: string | null;
  bowlingStyle?: string | null;
  bowlingOrder?: string | null;
  ruleset?: Record<string, any>;

  // Slot-based System
  slotsA: Slot[];
  slotsB: Slot[];
  captainUidA?: string;
  captainUidB?: string;

  // Team fields
  teamMode?: "team" | "solo";
  teamId?: string | null;
  teamName?: string | null;
  reservedSlots?: number;
  teamPaymentMode?: "captain_pays_all" | "captain_pays_self";
  assignedTeamMembers?: Array<{ uid: string; username: string; role: string }>;

  isPrivate?: boolean;
  isLocked?: boolean;
  lockedAt?: any;
  zoneAdminApproved?: boolean;

  // Payment
  paymentStatus?: "paid" | "unpaid";
  paymentAmount?: number;
  paymentReservedSlots?: number;
  paymentCurrency?: string;
  refundStatus?: "none" | "pending" | "completed";
  refundCompletedAt?: number;

  // Result verification
  resultVerification?: {
    status: "pending" | "participant_vote" | "admin_review" | "resolved";
    team1Captain?: string;
    team2Captain?: string;
    captainReports?: {
      team1Captain?: { result: "team1" | "team2"; timestamp?: any };
      team2Captain?: { result: "team1" | "team2"; timestamp?: any };
    };
    participantVotes?: Record<string, "team1" | "team2" | "unknown">;
    deadline?: any;
    votes?: Record<string, string>;
    finalWinner?: "team1" | "team2";
    resolvedAt?: any;
    resolutionSource?: string;
    adminReviewReason?: string;
    validationError?: string;
  };
}

type SuccessResult<T> = { ok: true; data?: T; id?: string; message?: string };
type ErrorResult = { ok: false; message: string; code?: string };
type Result<T = void> = SuccessResult<T> | ErrorResult;

function normalizeMatchroomRequestError(error: any) {
  const message = cleanConvexErrorMessage(error, "Failed to send request");
  if (message.includes("Request already pending")) {
    return "Your join request is already pending captain approval.";
  }
  return message || "Failed to send request";
}

export type MatchParticipationPreparation =
  | {
      status: "ready";
      gameKey: GameKey | null;
      gameLabel: string;
      profile: any;
      skill: GameSkillScore | null;
    }
  | {
      status: "needs_activation";
      gameKey: GameKey;
      gameLabel: string;
      profile: any;
      skill: null;
    }
  | {
      status: "needs_assessment";
      gameKey: GameKey;
      gameLabel: string;
      profile: any;
      skill: null;
    };

export function getParticipationGameLabel(gameKey: GameKey) {
  return getCanonicalGameLabel(gameKey);
}

export function getEnablePatchForGame(gameKey: GameKey) {
  switch (gameKey) {
    case "cs2":
      return { playsCs2: true };
    case "cs16":
      return { playsCs16: true };
    case "valorant":
      return { playsValorant: true };
    case "fc25":
    case "fc26":
      return { playsFc: true };
    case "tekken8":
      return { playsTekken: true };
    case "futsal":
      return { playsFutsal: true };
    case "indoor_cricket":
      return { playsIndoorCricket: true };
    case "padel":
      return { playsPadel: true };
    case "pickleball":
      return { playsPickleball: true };
    default:
      return {};
  }
}

export function getExistingSkillForGame(profile: any, gameKey: GameKey): GameSkillScore | null {
  const scores = profile?.skillScores || {};
  if (gameKey === "tekken8") return scores.tekken8 || scores.tekken || null;
  if (gameKey === "indoor_cricket") return scores.indoor_cricket || scores.cricket || null;
  return scores[gameKey] || null;
}

export async function prepareProfileForMatchParticipation(
  userId: string,
  profile: any,
  rawGameKey: string | null | undefined,
): Promise<MatchParticipationPreparation> {
  const normalizedGameKey = normalizeGameKey(rawGameKey) as GameKey | null;

  if (!normalizedGameKey) {
    return {
      status: "ready",
      gameKey: null,
      gameLabel: "Game",
      profile,
      skill: null,
    };
  }

  if (!isProfileGameEnabled(profile, normalizedGameKey)) {
    return {
      status: "needs_activation",
      gameKey: normalizedGameKey,
      gameLabel: getParticipationGameLabel(normalizedGameKey),
      profile,
      skill: null,
    };
  }

  let workingProfile = profile;
  let skill = getExistingSkillForGame(workingProfile, normalizedGameKey);

  if (!skill) {
    const initializedSkill = await initializeSkillIfMissing(userId, normalizedGameKey, workingProfile);
    if (initializedSkill) {
      workingProfile = {
        ...workingProfile,
        skillScores: { ...(workingProfile.skillScores || {}), [normalizedGameKey]: initializedSkill },
      };
      skill = initializedSkill;
    }
  }

  if (!skill) {
    return {
      status: "needs_assessment",
      gameKey: normalizedGameKey,
      gameLabel: getParticipationGameLabel(normalizedGameKey),
      profile: workingProfile,
      skill: null,
    };
  }

  return {
    status: "ready",
    gameKey: normalizedGameKey,
    gameLabel: getParticipationGameLabel(normalizedGameKey),
    profile: workingProfile,
    skill,
  };
}

async function getCurrentIdentity() {
  const authUser = await currentUser();
  if (!authUser) {
    throw new Error("Not authenticated");
  }

  const convexUser = await convex.query(api.users.getByAuthId, { authId: authUser.id });
  if (!convexUser) {
    throw new Error("User profile not found");
  }

  return {
    authId: authUser.id,
    convexId: convexUser._id,
    username: convexUser.username,
  };
}

async function getUserByAnyId(uid: string) {
  try {
    const directUser = await convex.query(api.users.getById, { userId: uid as Id<"users"> });
    if (directUser) {
      return directUser;
    }
  } catch {
    // Not a Convex user id, fall back to authId lookup.
  }

  return await convex.query(api.users.getByAuthId, { authId: uid });
}

// Helper to parse scheduled date/time
function parseScheduledStartAt(scheduledDate?: string, scheduledTime?: string): number | null {
  const date = String(scheduledDate || "").trim();
  const time = String(scheduledTime || "").trim();
  if (!date || !time) return null;
  const dt = new Date(`${date}T${time}`);
  return Number.isNaN(dt.getTime()) ? null : dt.getTime();
}

// Helper to generate slots
function generateSlots(teamSize: number, side: "A" | "B", players: any[] = []): Slot[] {
  return Array.from({ length: teamSize }, (_, i) => {
    const seatNum = i + 1;
    const player = players[i];
    return {
      slotId: `${side}${seatNum}`,
      status: player ? ("confirmed" as const) : ("open" as const),
      role: player?.role || "Player",
      uid: player?.uid,
      user: player
        ? { uid: player.uid, username: player.username, skillTier: player.skillTier }
        : undefined,
    };
  });
}

function normalizeMaxPlayersForFixedFormats(roomData: Matchroom): number {
  const normalizedGameKey = normalizeGameKey(roomData.game) as GameKey | null;
  const gameKey = normalizedGameKey || (roomData.game as any);
  const format = String(roomData.format || "").trim();

  if (gameKey === "fc25" || gameKey === "fc26" || gameKey === "tekken8") {
    if (format === "2v2") return 4;
    if (format === "1v1") return 2;
    return roomData.maxPlayers;
  }

  if (gameKey === "padel") {
    return 4;
  }

  if (gameKey === "pickleball") {
    if (format === "2v2") return 4;
    if (format === "1v1") return 2;
    return roomData.maxPlayers;
  }

  return roomData.maxPlayers;
}

/**
 * Build the Convex mutation args for a matchroom create request.
 * Used by both direct creates and payment-backed create drafts.
 */
export function buildMatchroomCreateMutationArgs(roomData: Matchroom) {
  const normalizedMaxPlayers = normalizeMaxPlayersForFixedFormats(roomData);

  // Prepare players array
  let players = roomData.players || [];
  if (players.length === 0) {
    players = [
      {
        uid: roomData.hostUid,
        username: roomData.hostName,
        joinedAt: Date.now(),
        role: "Host",
      },
    ];
  }

  const playerUids = roomData.playerUids || players.map((p) => p.uid);

  // Generate slots if not provided
  let slotsA = roomData.slotsA || [];
  let slotsB = roomData.slotsB || [];

  if (
    (!slotsA.length || !slotsB.length) &&
    normalizedMaxPlayers &&
    normalizedMaxPlayers % 2 === 0
  ) {
    const teamSize = normalizedMaxPlayers / 2;
    slotsA = generateSlots(teamSize, "A", players.slice(0, teamSize));
    slotsB = generateSlots(teamSize, "B", players.slice(teamSize));
  }

  // Calculate timing
  const scheduledStartAt = parseScheduledStartAt(
    roomData.scheduledDate,
    roomData.scheduledTime
  ) ?? undefined;
  const lockAt = getMatchroomLockAtMs(scheduledStartAt) ?? undefined;
  const expiresAt = undefined;

  return {
    hostUid: roomData.hostUid,
    hostName: roomData.hostName,
    game: roomData.game,
    title: roomData.title || `${roomData.game} Match`,
    description: roomData.description,
    maxPlayers: normalizedMaxPlayers,
    players: players.map((p) => ({
      uid: p.uid,
      username: p.username,
      joinedAt: typeof p.joinedAt === "number" ? p.joinedAt : Date.now(),
      role: p.role,
      skillTier: p.skillTier,
    })),
    playerUids,
    location: roomData.location,
    locationMode: roomData.locationMode,
    broadcastAreas: roomData.broadcastAreas,
    broadcastRequestStatus: roomData.broadcastRequestStatus,
    zoneId: roomData.zoneId,
    zoneOwnerUid: roomData.zoneOwnerUid,
    scheduledDate: roomData.scheduledDate,
    scheduledTime: roomData.scheduledTime,
    scheduledStartAt,
    lockAt,
    expiresAt,
    durationMinutes: roomData.durationMinutes,
    pricing: roomData.pricing,
    requestedResourceAssetType: roomData.requestedResourceAssetType,
    requestedResourceSurface: roomData.requestedResourceSurface,
    requestedResourceTier: roomData.requestedResourceTier,
    selectedZoneRateKey: roomData.selectedZoneRateKey,
    // P1: server-side price-validation inputs (recomputed authoritatively on the
    // backend; not all are persisted on the room).
    branchId: roomData.branchId ?? undefined,
    seriesType: roomData.seriesType ?? undefined,
    overs: roomData.overs ?? undefined,
    durationHours: roomData.durationHours ?? undefined,
    // P1: per-attempt idempotency key for the wallet/free create path.
    clientCreateRequestId: (roomData as any).clientCreateRequestId ?? undefined,
    slotsA,
    slotsB,
    captainUidA: roomData.captainUidA || roomData.hostUid,
    captainUidB: roomData.captainUidB,
    format: roomData.format,
    selectedMaps: roomData.selectedMaps,
    skillLevel: roomData.skillLevel,
    hostSkillScore: roomData.hostSkillScore ?? undefined,
    hostSkillTier: roomData.hostSkillTier,
    hostRole: roomData.hostRole,
    teamMode: roomData.teamMode,
    teamId: roomData.teamId || undefined,
    teamName: roomData.teamName || undefined,
    reservedSlots: roomData.reservedSlots,
    teamPaymentMode: roomData.teamPaymentMode,
    bookingSource: roomData.bookingSource,
    isPrivate: roomData.isPrivate,
    paymentStatus: roomData.paymentStatus,
    paymentAmount: roomData.paymentAmount,
    paymentReservedSlots: roomData.paymentReservedSlots,
    paymentCurrency: roomData.paymentCurrency,
    zoneAdminApproved: roomData.zoneAdminApproved,
  };
}

/**
 * Create a new matchroom
 */
export async function createMatchroom(
  roomData: Matchroom
): Promise<Result<{ id: string }>> {
  try {
    const verificationGate = await requireKycAccess();
    if (!verificationGate.ok) {
      return { ok: false, message: verificationGate.message, code: verificationGate.code };
    }

    // Validate lead time for non-walk-ins
    if (roomData.bookingSource !== "walkin") {
      const scheduledStartAt = parseScheduledStartAt(
        roomData.scheduledDate,
        roomData.scheduledTime
      );
      if (!scheduledStartAt) {
        return { ok: false, message: "Scheduled date/time is required." };
      }

      const scheduleValidation = validateMatchroomScheduleWindow(scheduledStartAt, Date.now());
      if (!scheduleValidation.ok) {
        return {
          ok: false,
          message: scheduleValidation.message,
        };
      }
    }

    const mutationArgs = buildMatchroomCreateMutationArgs(roomData) as any;
    let matchroomId: any;
    try {
      matchroomId = await convex.mutation(api.matchrooms.create, mutationArgs);
    } catch (error) {
      if (!isAuthSessionError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
      matchroomId = await convex.mutation(api.matchrooms.create, mutationArgs);
    }

    return { ok: true, id: matchroomId };
  } catch (error: any) {
    const message = getUserFacingErrorMessage(error, "Failed to create matchroom");
    return { ok: false, message };
  }
}

export async function checkMatchroomCreateAvailability(input: {
  game: string;
  locationMode?: "zone" | "broadcast";
  scheduledDate?: string;
  scheduledTime?: string;
  zoneId?: string | null;
}): Promise<Result<{ available: boolean; message?: string | null; reason?: string | null }>> {
  try {
    const scheduledStartAt = parseScheduledStartAt(input.scheduledDate, input.scheduledTime);
    if (!scheduledStartAt) {
      return { ok: false, message: "Scheduled date/time is required." };
    }

    const scheduleValidation = validateMatchroomScheduleWindow(scheduledStartAt, Date.now());
    if (!scheduleValidation.ok) {
      return {
        ok: true,
        data: {
          available: false,
          message: scheduleValidation.message,
          reason: "invalid_schedule",
        },
      };
    }

    const result = await convex.query((api as any).matchrooms.checkCreateAvailability, {
      game: input.game,
      locationMode: input.locationMode,
      scheduledStartAt,
      zoneId: input.zoneId || undefined,
    });

    return {
      ok: true,
      data: {
        available: Boolean(result?.available),
        message: result?.message ? String(result.message) : null,
        reason: result?.reason ? String(result.reason) : null,
      },
    };
  } catch (error: any) {
    console.error("[matchService] checkMatchroomCreateAvailability error:", error);
    return {
      ok: false,
      message: cleanConvexErrorMessage(error, "Could not verify this time slot. Please try again."),
    };
  }
}

/**
 * Get all matchrooms (with optional limit)
 */
export async function getMatchrooms(
  limitCount = 20
): Promise<Result<Matchroom[]>> {
  try {
    const rooms = await convex.query(api.matchrooms.list, {
      limit: limitCount,
    });
    return { ok: true, data: rooms as Matchroom[] };
  } catch (error: any) {
    console.error("[matchService] getMatchrooms error:", error);
    return { ok: false, message: "Failed to fetch matchrooms" };
  }
}

/**
 * Get a single matchroom by ID
 */
export async function getMatchroom(id: string): Promise<Result<Matchroom>> {
  try {
    try {
      await convex.mutation(api.matchrooms.syncLifecycleIfDue, {
        matchroomId: id as Id<"matchrooms">,
      });
    } catch {
      // Ignore invalid ids and fall back to the read path.
    }

    const room = await convex.query(api.matchrooms.getById, { matchroomId: id });
    if (!room) {
      return { ok: false, message: "Matchroom not found" };
    }
    return { ok: true, data: room as Matchroom };
  } catch (error: any) {
    console.error("[matchService] getMatchroom error:", error);
    return { ok: false, message: "Failed to load matchroom" };
  }
}

// Alias for backwards compatibility
export const getMatchroomById = getMatchroom;

/**
 * Get user's matchrooms (hosted + joined)
 */
export async function getUserMatchrooms(
  uid: string
): Promise<Result<{ hosted: Matchroom[]; joined: Matchroom[] }>> {
  try {
    const result = await convex.query(api.matchrooms.getUserMatchrooms, { uid });
    return {
      ok: true,
      data: {
        hosted: result.hosted as Matchroom[],
        joined: result.joined as Matchroom[],
      },
    };
  } catch (error: any) {
    console.error("[matchService] getUserMatchrooms error:", error);
    return { ok: false, message: "Failed to fetch your matchrooms" };
  }
}

export type UserMatchroomsTab = "hosted" | "joined";

export type UserMatchroomsFilters = {
  searchText?: string;
  status?: string;
  game?: string;
  dateRange?: string;
};

export type UserMatchroomsPage = {
  page: Matchroom[];
  isDone: boolean;
  continueCursor: string | null;
  total?: number;
};

export async function getUserMatchroomsPage(input: {
  uid: string;
  tab: UserMatchroomsTab;
  limit?: number;
  cursor?: string | null;
  filters?: UserMatchroomsFilters;
}): Promise<Result<UserMatchroomsPage>> {
  try {
    const result = await convex.query((api as any).matchrooms.listUserMatchroomsPage, {
      uid: input.uid,
      tab: input.tab,
      limit: input.limit || 20,
      cursor: input.cursor ?? null,
      filters: input.filters,
    });
    return {
      ok: true,
      data: {
        page: (result?.page || []) as Matchroom[],
        isDone: Boolean(result?.isDone),
        continueCursor: result?.continueCursor ?? null,
        total: Number(result?.total || 0),
      },
    };
  } catch (error: any) {
    console.error("[matchService] getUserMatchroomsPage error:", error);
    return { ok: false, message: "Failed to fetch your matchrooms" };
  }
}

export type UserScheduleTab = "upcoming" | "waiting" | "history";

export type UserScheduleFilters = {
  game?: string;
  dateRange?: string;
  venue?: string;
  paymentStatus?: string;
  searchText?: string;
  statusGroup?: string;
};

export type UserSchedulePage = {
  page: Matchroom[];
  isDone: boolean;
  continueCursor: string | null;
  total?: number;
};

export async function getUserScheduleMatchroomsPage(input: {
  uid: string;
  tab: UserScheduleTab;
  limit?: number;
  cursor?: string | null;
  filters?: UserScheduleFilters;
}): Promise<Result<UserSchedulePage>> {
  try {
    const result = await convex.query((api as any).matchrooms.listForUserSchedule, {
      uid: input.uid,
      tab: input.tab,
      limit: input.limit || 20,
      cursor: input.cursor ?? null,
      filters: input.filters,
    });
    return {
      ok: true,
      data: {
        page: (result?.page || []) as Matchroom[],
        isDone: Boolean(result?.isDone),
        continueCursor: result?.continueCursor ?? null,
        total: Number(result?.total || 0),
      },
    };
  } catch (error: any) {
    console.error("[matchService] getUserScheduleMatchroomsPage error:", error);
    return { ok: false, message: "Failed to fetch your schedule" };
  }
}

/**
 * Join a matchroom
 */
export async function joinMatchroom(
  roomId: string,
  user: { uid: string; username: string },
  role?: string,
  _joinCode?: string
): Promise<Result> {
  try {
    const verificationGate = await requireKycAccess();
    if (!verificationGate.ok) {
      return { ok: false, message: verificationGate.message, code: verificationGate.code };
    }

    // Check time conflicts first
    const room = await convex.query(api.matchrooms.getById, { matchroomId: roomId });
    if (!room) {
      return { ok: false, message: "Matchroom not found" };
    }

    if (room.scheduledStartAt) {
      const conflict = await convex.query(api.matchrooms.checkTimeConflict, {
        uid: user.uid,
        scheduledStartAt: room.scheduledStartAt,
        durationMinutes: room.durationMinutes || 60,
        excludeRoomId: roomId,
      });

      if (conflict.conflict) {
        return { ok: false, message: conflict.message || "Time conflict with another match" };
      }
    }

    await convex.mutation(api.matchrooms.join, {
      matchroomId: roomId as Id<"matchrooms">,
      uid: user.uid,
      username: user.username,
      role,
    });

    return { ok: true };
  } catch (error: any) {
    console.error("[matchService] joinMatchroom error:", error);
    return { ok: false, message: getUserFacingErrorMessage(error, "Failed to join matchroom") };
  }
}

/**
 * Leave a matchroom
 */
export async function leaveMatchroom(
  roomId: string,
  userUid: string
): Promise<Result> {
  try {
    await convex.mutation(api.matchrooms.leave, {
      matchroomId: roomId as Id<"matchrooms">,
      uid: userUid,
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[matchService] leaveMatchroom error:", error);
    return {
      ok: false,
      message: error?.message || "Failed to leave matchroom",
    };
  }
}

/**
 * Delete a matchroom
 */
export async function deleteMatchroom(roomId: string): Promise<Result> {
  try {
    await convex.mutation(api.matchrooms.remove, {
      matchroomId: roomId as Id<"matchrooms">,
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[matchService] deleteMatchroom error:", error);
    return { ok: false, message: "Failed to delete matchroom" };
  }
}

/**
 * Start a match
 */
export async function startMatch(
  roomId: string,
  ratings: Record<string, number>,
  hostUid: string,
  team2Captain?: string
): Promise<Result> {
  try {
    await convex.mutation(api.matchrooms.startMatch, {
      matchroomId: roomId as Id<"matchrooms">,
      hostUid,
      team2Captain,
      initialRatings: ratings,
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[matchService] startMatch error:", error);
    return { ok: false, message: "Failed to start match" };
  }
}

/**
 * Submit captain report
 */
export async function submitCaptainReport(
  matchroomId: string,
  captainUid: string,
  winner: "team1" | "team2"
): Promise<Result> {
  try {
    await convex.mutation(api.matchrooms.submitCaptainReport, {
      matchroomId: matchroomId as Id<"matchrooms">,
      captainUid,
      winner,
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[matchService] submitCaptainReport error:", error);
    return { ok: false, message: getUserFacingErrorMessage(error, "Failed to submit report") };
  }
}

/**
 * Submit participant vote
 */
export async function submitParticipantVote(
  matchroomId: string,
  participantUid: string,
  vote: "team1" | "team2" | "unknown"
): Promise<Result> {
  try {
    await convex.mutation(api.matchrooms.submitParticipantVote, {
      matchroomId: matchroomId as Id<"matchrooms">,
      participantUid,
      vote,
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[matchService] submitParticipantVote error:", error);
    return { ok: false, message: getUserFacingErrorMessage(error, "Failed to submit vote") };
  }
}

/**
 * Admin cancel matchroom
 */
export async function adminCancelMatchroom(
  roomId: string,
  adminUid: string,
  reason: string,
  note?: string
): Promise<Result> {
  try {
    const result = await convex.mutation(api.matchrooms.adminCancel, {
      matchroomId: roomId as Id<"matchrooms">,
      adminUid,
      reason,
      note,
    });
    return { ok: true, message: result.message };
  } catch (error: any) {
    console.error("[matchService] adminCancelMatchroom error:", error);
    return { ok: false, message: getUserFacingErrorMessage(error, "Failed to cancel lobby") };
  }
}

/**
 * Check if user has time conflict
 */
export async function findUserTimeConflict(
  uid: string,
  targetRoom: Matchroom,
  excludeRoomId?: string
): Promise<{ conflict: true; room: Matchroom; message: string } | { conflict: false }> {
  try {
    if (!targetRoom.scheduledStartAt) {
      return { conflict: false };
    }

    const result = await convex.query(api.matchrooms.checkTimeConflict, {
      uid,
      scheduledStartAt: targetRoom.scheduledStartAt,
      durationMinutes: targetRoom.durationMinutes || 60,
      excludeRoomId,
    });

    if (result.conflict) {
      return {
        conflict: true,
        room: result.room as Matchroom,
        message: result.message || "Time conflict with another match",
      };
    }

    return { conflict: false };
  } catch (error) {
    console.error("[matchService] findUserTimeConflict error:", error);
    return { conflict: false };
  }
}

/**
 * Check if user is in active matchroom
 */
export async function isUserInActiveMatchroom(
  uid: string,
  targetRoom?: Matchroom
): Promise<{ inRoom: boolean; roomId?: string; message?: string }> {
  if (!targetRoom) return { inRoom: false };

  const conflict = await findUserTimeConflict(uid, targetRoom, targetRoom.id || targetRoom._id);
  if (conflict.conflict) {
    return {
      inRoom: true,
      roomId: conflict.room.id || conflict.room._id,
      message: conflict.message,
    };
  }
  return { inRoom: false };
}

/**
 * Request to join a matchroom (creates notification)
 */
export async function requestJoinMatchroom(
  room: Matchroom,
  user: { uid: string; username: string },
  role?: string,
  targetTeam?: string,
  slotId?: string
): Promise<Result<{ id: string }>> {
  try {
    // Note: email verification and time conflict checks are already performed
    // by useMatchroomJoinFlow.startJoin() before this function is called.

    const roomId = room.id || room._id;
    if (!roomId) {
      return { ok: false, message: "Matchroom ID missing" };
    }

    const result = await convex.mutation(api.matchrooms.requestToJoinMatchroom, {
      matchroomId: roomId as Id<"matchrooms">,
      fromUid: user.uid as Id<"users">,
      fromUsername: user.username,
      role: role || "Player",
      targetTeam: targetTeam || "Any",
      slotId: slotId || undefined,
    });

    return {
      ok: true,
      id: Array.isArray((result as any)?.notificationIds)
        ? String((result as any).notificationIds[0] || "")
        : (typeof (result as any)?._id === "string" ? (result as any)._id : undefined),
      data: result as any,
      message: (result as any)?.message,
    };
  } catch (error: any) {
    console.error("[matchService] requestJoinMatchroom error:", error);
    return { ok: false, message: normalizeMatchroomRequestError(error) };
  }
}

/**
 * Cancel join request
 */
export async function cancelMatchJoinRequest(
  roomId: string,
  _userId: string
): Promise<Result> {
  try {
    const me = await getCurrentIdentity();
    const requests = await convex.query(api.notifications.listOutgoingMatchroomJoinRequests, {
      fromUid: me.convexId,
      matchroomId: roomId as Id<"matchrooms">,
      limit: 100,
    });

    const targets = requests.filter((item: any) => String(item.matchroomId || item.data?.matchroomId) === roomId);
    if (!targets.length) {
      return { ok: false, message: "No pending request found" };
    }

    await Promise.all(
      targets.map((target: any) =>
        convex.mutation(api.notifications.updateStatus, {
          notificationId: target._id,
          status: "expired",
        }),
      ),
    );
    return { ok: true };
  } catch (error: any) {
    console.error("[matchService] cancelMatchJoinRequest error:", error);
    return { ok: false, message: "Failed to cancel request" };
  }
}

/**
 * Respond to join request
 */
export async function respondToMatchJoinRequest(
  requestId: string,
  decision: "accept" | "reject",
  _adminUid: string
): Promise<Result> {
  try {
    const me = await getCurrentIdentity();
    const result = await convex.mutation(api.matchrooms.respondToMatchroomJoinRequest, {
      notificationId: requestId as Id<"notifications">,
      hostUid: me.convexId,
      accept: decision === "accept",
    });
    return { ok: true, message: result.message };
  } catch (error: any) {
    console.error("[matchService] respondToMatchJoinRequest error:", error);
    return { ok: false, message: getUserFacingErrorMessage(error, "Failed to process request") };
  }
}
