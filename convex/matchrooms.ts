import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { authComponent } from "./auth";
import { api, internal } from "./_generated/api";
import { KYC_VERIFICATION_REQUIRED_MESSAGE, assertKycAccessAllowed } from "./kycGate";
import { requireCurrentUser, requireSuperAdmin, getCurrentUser, isSuperAdminProfile } from "./authz";
import { isUserHiddenFromPublic } from "./userVisibility";
import { deductWalletFunds } from "./wallet";
import {
  dispatchBroadcastZoneRequestsForMatchroom,
  finalizeBroadcastFailure,
} from "./matchroomBroadcast";
import {
  INVITE_TTL_MS,
  JOIN_REQUEST_TTL_MS,
  PAYMENT_INTENT_TTL_MS,
  URGENT_REPLACEMENT_WINDOW_MS,
  capExpiryAtLockTime,
  getMatchroomLockAt,
  validateMatchroomScheduleWindow,
} from "./timing";
import {
  type MatchCategory,
  type MatchOutcome,
  average,
  applyEloDelta,
  computePlayerEloDelta,
  computeTeamEloDelta,
  deriveEloFromRating,
  deriveRatingFromElo,
  DEFAULT_ELO,
} from "./ratingEngine";

// Constants
const ONE_DAY_MS = JOIN_REQUEST_TTL_MS;
const SKILL_JOIN_DELTA = 10;
const MATCH_JOIN_REQUEST_TYPES = new Set(["match_join_request", "match.join_request"]);
export const MATCHROOM_LOCKED_MESSAGE =
  "This matchroom is locked because it starts within 24 hours or has been confirmed by the zone. Contact support if you need help.";
const MATCHROOM_VENUE_TIME_CONFLICT_MESSAGE =
  "This venue already has a matchroom for the same game at the same scheduled time. Please choose a different time or venue.";

function getMatchroomPlayerUids(room: any): string[] {
  const fromPlayerUids = Array.isArray(room.playerUids) ? room.playerUids.map(String) : [];
  const fromPlayers = Array.isArray(room.players) ? room.players.map((player: any) => String(player?.uid || "")).filter(Boolean) : [];
  return Array.from(new Set([...fromPlayerUids, ...fromPlayers]));
}

function getSlotUserUid(slot: any): string {
  return String(slot?.uid || slot?.user?.uid || "").trim();
}

function getAllMatchroomSlots(room: any): any[] {
  return [...(room?.slotsA || []), ...(room?.slotsB || [])];
}

function getRequiredPlayerCount(room: any): number {
  const maxPlayers = Number(room?.maxPlayers || 0);
  if (Number.isFinite(maxPlayers) && maxPlayers > 0) return maxPlayers;
  const slotCount = getAllMatchroomSlots(room).length;
  return Math.max(1, slotCount || Number(room?.currentPlayers || 0) || 1);
}

function getConfirmedPlayerCount(room: any): number {
  const slots = getAllMatchroomSlots(room);
  const confirmedSlotUids = slots
    .filter((slot: any) => slot?.status === "confirmed" && getSlotUserUid(slot))
    .map(getSlotUserUid);
  if (slots.length > 0) {
    return new Set(confirmedSlotUids).size;
  }
  return getMatchroomPlayerUids(room).length;
}

function isRosterFull(room: any): boolean {
  const required = getRequiredPlayerCount(room);
  const slotsA = room?.slotsA || [];
  const slotsB = room?.slotsB || [];
  if (slotsA.length > 0 || slotsB.length > 0) {
    const teamAFilled = slotsA.length === 0 || slotsA.every((slot: any) => slot?.status === "confirmed" && getSlotUserUid(slot));
    const teamBFilled = slotsB.length === 0 || slotsB.every((slot: any) => slot?.status === "confirmed" && getSlotUserUid(slot));
    return teamAFilled && teamBFilled && getConfirmedPlayerCount(room) >= required;
  }
  return getConfirmedPlayerCount(room) >= required;
}

function getScheduleRoomStartMs(room: any): number | null {
  const candidates = [room?.startTime, room?.scheduledStartAt]
    .map((value) => Number(value || 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (candidates[0]) return candidates[0];
  const date = String(room?.scheduledDate || "").trim();
  const time = String(room?.scheduledTime || "").trim();
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}`).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function shouldExpireForNotFull(room: any, now = Date.now()): boolean {
  if (!room) return false;
  if (!["open", "locked"].includes(String(room.status || ""))) return false;
  const scheduledStartAt = Number(room.scheduledStartAt || room.startTime || 0);
  if (!Number.isFinite(scheduledStartAt) || scheduledStartAt <= 0) return false;
  return scheduledStartAt <= now && !isRosterFull(room);
}

function shouldExpireInProgressRoom(room: any, now = Date.now()): boolean {
  if (!room || String(room.status || "") !== "in-progress") return false;
  if (room.startedWithFullRoster === true) return false;
  const scheduledStartAt = Number(room.scheduledStartAt || room.startTime || 0);
  if (!Number.isFinite(scheduledStartAt) || scheduledStartAt <= 0) return false;
  return scheduledStartAt <= now && !isRosterFull(room);
}

async function findVenueGameTimeConflict(
  ctx: any,
  args: { zoneId?: string | null; game: string; scheduledStartAt: number },
) {
  if (!args.zoneId || typeof args.scheduledStartAt !== "number") return null;

  const existing = await ctx.db
    .query("matchrooms")
    .withIndex("by_zoneId", (q: any) => q.eq("zoneId", args.zoneId))
    .take(100);

  return existing.find((room: any) => {
    if (String(room.game || "") !== String(args.game || "")) return false;
    if (room.scheduledStartAt !== args.scheduledStartAt) return false;
    return !["cancelled", "completed", "expired"].includes(String(room.status || ""));
  }) || null;
}

function canStartMatchroom(room: any, now = Date.now()) {
  if (!room || !["open", "locked"].includes(String(room.status || ""))) {
    return { ok: false, reason: "invalid_status" };
  }
  const scheduledStartAt = Number(room.scheduledStartAt || 0);
  if (!Number.isFinite(scheduledStartAt) || scheduledStartAt <= 0) {
    return { ok: false, reason: "missing_start_time" };
  }
  if (scheduledStartAt > now) {
    return { ok: false, reason: "start_time_not_due" };
  }
  if (!isRosterFull(room)) {
    return { ok: false, reason: "roster_not_full" };
  }
  return { ok: true, reason: "valid" };
}

function canCompleteMatchroom(room: any, now = Date.now()) {
  if (!room || String(room.status || "") !== "in-progress") {
    return { ok: false, reason: "invalid_status" };
  }
  if (room.startedWithFullRoster !== true && !isRosterFull(room)) {
    return { ok: false, reason: "not_started_with_full_roster" };
  }
  const startMs = getScheduleRoomStartMs(room);
  if (!startMs) {
    return { ok: false, reason: "missing_start_time" };
  }
  const durationMinutes = Math.max(1, Number(room.durationMinutes || 60));
  if (startMs + durationMinutes * 60 * 1000 > now) {
    return { ok: false, reason: "duration_not_elapsed" };
  }
  return { ok: true, reason: "valid" };
}

function canEnterResultVerification(room: any) {
  if (!room || String(room.status || "") !== "completed") {
    return { ok: false, reason: "invalid_status" };
  }
  if (room.startedWithFullRoster !== true && !isRosterFull(room)) {
    return { ok: false, reason: "invalid_or_incomplete_roster" };
  }
  const captains = resolveResultCaptains(room, room.resultVerification || {});
  if (!captains.team1Captain || !captains.team2Captain) {
    return { ok: false, reason: "missing_result_captains" };
  }
  return { ok: true, reason: "valid" };
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

  // Also notify the match participants (players/captains) of the final result.
  for (const participantUid of getMatchroomPlayerUids(room).slice(0, 20)) {
    const participant = await resolveUserByAnyId(ctx, participantUid);
    if (participant?._id && !recipients.has(String(participant._id))) {
      recipients.set(String(participant._id), { id: participant._id });
    }
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

// Returns true if ANY notification (active, read or archived) already exists for
// this dedupe key. Used to make cron-driven notifications fire exactly once even
// after the recipient reads/archives them.
async function notificationExistsByDedupeKey(ctx: any, dedupeKey: string) {
  const existing = await ctx.db
    .query("notifications")
    .withIndex("by_dedupeKey", (q: any) => q.eq("dedupeKey", dedupeKey))
    .first();
  return Boolean(existing);
}

// Ordered smallest-first so the current bucket is the first window whose
// threshold the remaining time has crossed (prevents firing all three at once).
const MATCH_REMINDER_WINDOWS = [
  { key: "30m", ms: 30 * 60 * 1000, title: "Match in 30 minutes", body: "Your match starts in 30 minutes. Make sure your team is ready." },
  { key: "2h", ms: 2 * 60 * 60 * 1000, title: "Match in 2 hours", body: "Your match starts soon. Open MatchHai to review the details." },
  { key: "24h", ms: 24 * 60 * 60 * 1000, title: "Match tomorrow", body: "Your match is scheduled in about 24 hours." },
];

// Server-backed pre-match reminders. Idempotent (per uid, per window) via a
// fixed dedupe key checked before creation. Only fires for valid, future rooms.
async function maybeSendMatchroomReminders(ctx: any, room: any, now: number) {
  if (!room) return;
  const status = String(room.status || "");
  if (status === "cancelled" || status === "expired" || status === "completed" || status === "in-progress") return;
  const startAt = getScheduleRoomStartMs(room);
  if (!startAt || !Number.isFinite(startAt) || startAt <= now) return;
  const remaining = startAt - now;
  const windowToFire = MATCH_REMINDER_WINDOWS.find((w) => remaining <= w.ms);
  if (!windowToFire) return; // more than 24h away — nothing to send yet

  for (const participantUid of getMatchroomPlayerUids(room).slice(0, 20)) {
    const participant = await resolveUserByAnyId(ctx, participantUid);
    if (!participant?._id) continue;
    const dedupeKey = `match.reminder_${windowToFire.key}:${String(room._id)}:${String(participant._id)}`;
    if (await notificationExistsByDedupeKey(ctx, dedupeKey)) continue;
    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: `match.reminder_${windowToFire.key}`,
      toUid: participant._id,
      recipientRole: "player",
      status: "pending",
      dedupeKey,
      dedupePolicy: "upsert_active",
      pushPolicy: "eligible",
      matchroomId: room._id,
      route: `/matchrooms/${String(room._id)}`,
      title: windowToFire.title,
      body: windowToFire.body,
      data: {
        matchroomId: room._id,
        reminderWindow: windowToFire.key,
        scheduledStartAt: startAt,
        href: `/matchrooms/${String(room._id)}`,
      },
    });
  }
}

// Tells captains they need to submit/confirm the result once a match completes.
// Fired idempotently from the lifecycle sweep while verification is still open.
async function maybeSendResultVerificationRequired(ctx: any, room: any) {
  const { team1Captain, team2Captain } = resolveResultCaptains(room, room?.resultVerification || {});
  const captainUids = Array.from(new Set([team1Captain, team2Captain].filter(Boolean)));
  for (const captainUid of captainUids) {
    const captain = await resolveUserByAnyId(ctx, captainUid);
    if (!captain?._id) continue;
    const dedupeKey = `match.result_verification_required:${String(room._id)}:${String(captain._id)}`;
    if (await notificationExistsByDedupeKey(ctx, dedupeKey)) continue;
    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "match.result_verification_required",
      toUid: captain._id,
      recipientRole: "player",
      status: "pending",
      dedupeKey,
      dedupePolicy: "upsert_active",
      pushPolicy: "eligible",
      matchroomId: room._id,
      route: `/matchrooms/${String(room._id)}`,
      title: "Confirm your match result",
      body: "Your match has finished. Submit the result to finalize it.",
      data: { matchroomId: room._id, href: `/matchrooms/${String(room._id)}` },
    });
  }
}

// Notifies all participants when captains disagree and the result goes to a vote.
async function notifyResultDisputed(ctx: any, room: any, matchroomId: Id<"matchrooms">) {
  for (const participantUid of getMatchroomPlayerUids(room).slice(0, 20)) {
    const participant = await resolveUserByAnyId(ctx, participantUid);
    if (!participant?._id) continue;
    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "match.result_disputed",
      toUid: participant._id,
      recipientRole: "player",
      status: "pending",
      dedupeKey: `match.result_disputed:${String(matchroomId)}:${String(participant._id)}`,
      dedupePolicy: "upsert_active",
      pushPolicy: "eligible",
      matchroomId,
      route: `/matchrooms/${String(matchroomId)}`,
      title: "Result needs your vote",
      body: "Captains disagreed on the result. Cast your vote to help resolve it.",
      data: { matchroomId, href: `/matchrooms/${String(matchroomId)}` },
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SKILL RATING (ELO) APPLICATION — server-authoritative, idempotent.
// Triggered ONLY from finalizeMatchroomResult (i.e. a verified, finalized
// result). All math lives in convex/ratingEngine.ts. Clients never compute or
// submit deltas/averages.
// ═══════════════════════════════════════════════════════════════════════════

// 0-100 display tier mapping (kept consistent with the client UI helper so card
// display behavior is unchanged). `elo` remains the internal source of truth.
function ratingTier(rating: number): string {
  if (rating <= 30) return "Beginner";
  if (rating <= 50) return "Casual";
  if (rating <= 70) return "Intermediate";
  if (rating <= 85) return "Advanced";
  if (rating <= 95) return "Pro";
  return "Elite";
}

// Read a stored per-game skill score, tolerating the legacy fc25/tekken aliases.
function getStoredScoreForGame(scores: any, game: string): any {
  if (!scores) return undefined;
  if (scores[game] !== undefined) return scores[game];
  if (game === "fc26") return scores.fc25;
  if (game === "tekken8") return scores.tekken;
  return undefined;
}

// Current ELO for a player: stored elo if present, else seeded from the 0-100
// rating (default rating 45 when nothing exists).
function getPlayerElo(score: any): number {
  if (score && typeof score.elo === "number") {
    return applyEloDelta(score.elo, 0); // clamp into valid range
  }
  const rating = score && typeof score.rating === "number" ? score.rating : 45;
  return deriveEloFromRating(rating);
}

function collectSideSlotUids(slots: any[]): string[] {
  if (!Array.isArray(slots)) return [];
  return slots
    .map((slot) => getSlotUserUid(slot))
    .filter((uid) => Boolean(uid));
}

// Resolve a list of slot uids to canonical, de-duplicated real-user ids.
// Unresolved entries (bots / walk-in placeholders) are excluded and flagged.
async function resolveRealUserIds(ctx: any, uids: string[]) {
  const realIds: Id<"users">[] = [];
  const seen = new Set<string>();
  let hadNonUser = false;
  for (const uid of uids) {
    const user = await resolveUserByAnyId(ctx, uid);
    if (user?._id) {
      const key = String(user._id);
      if (!seen.has(key)) {
        seen.add(key);
        realIds.push(user._id);
      }
    } else {
      hadNonUser = true;
    }
  }
  return { realIds, hadNonUser };
}

function resolveMatchCategory(
  room: any,
  source: string,
  info: { hadNonUser: boolean; realACount: number; realBCount: number },
): MatchCategory {
  const teamMode = String(room?.teamMode || "");
  const bookingSource = String(room?.bookingSource || "").toLowerCase();
  const shortTeam =
    teamMode === "team" && (info.realACount < 2 || info.realBCount < 2);
  if (info.hadNonUser || shortTeam) return "bot_short";
  if (bookingSource.includes("walkin") || bookingSource.includes("walk_in") || bookingSource.includes("walk-in")) {
    return "walkin";
  }
  if (source === "admin_resolved") return "admin";
  // Coin-flip resolutions carry low confidence → reduced movement.
  if (source === "two_player_random_tiebreak" || source === "participant_random_tiebreak") {
    return "casual";
  }
  // captain_agreement / participant_majority / participant_all_votes
  return "normal";
}

async function markRatingApplied(
  ctx: any,
  matchroomId: Id<"matchrooms">,
  source: string,
  reason: string,
) {
  await ctx.db.patch(matchroomId, {
    skillRatingAppliedAt: Date.now(),
    skillRatingAppliedBy: `${source}:${reason}`,
    skillRatingVersion: 1,
  });
}

async function applyTeamRatingsForChallenge(
  ctx: any,
  matchroomId: Id<"matchrooms">,
  game: string,
  challenge: any,
  winner: "team1" | "team2",
  source: string,
  memberAvgA: number,
  memberAvgB: number,
) {
  const teamA = await ctx.db.get(challenge.challengerTeamId);
  const teamB = await ctx.db.get(challenge.opponentTeamId);
  if (!teamA || !teamB) return;

  // slotsA (team1) is hosted by the challenger; team2 is the opponent.
  const teamAWon = winner === "team1";
  const now = Date.now();

  const getTeamElo = (team: any, seedAvg: number): number => {
    const stored = team?.eloByGame?.[game];
    if (typeof stored === "number") return applyEloDelta(stored, 0);
    return applyEloDelta(seedAvg || DEFAULT_ELO, 0);
  };

  const eloA = getTeamElo(teamA, memberAvgA);
  const eloB = getTeamElo(teamB, memberAvgB);
  const outcomeA: MatchOutcome = teamAWon ? "win" : "loss";
  const outcomeB: MatchOutcome = teamAWon ? "loss" : "win";

  const dA = computeTeamEloDelta(eloA, eloB, outcomeA);
  const dB = computeTeamEloDelta(eloB, eloA, outcomeB);
  const newEloA = applyEloDelta(eloA, dA.delta);
  const newEloB = applyEloDelta(eloB, dB.delta);

  const patchTeam = async (team: any, won: boolean, newElo: number) => {
    const stats = team.stats || { wins: 0, losses: 0, matchesPlayed: 0 };
    await ctx.db.patch(team._id, {
      stats: {
        wins: stats.wins + (won ? 1 : 0),
        losses: stats.losses + (won ? 0 : 1),
        matchesPlayed: stats.matchesPlayed + 1,
      },
      eloByGame: { ...(team.eloByGame || {}), [game]: newElo },
      updatedAt: now,
    });
  };

  await patchTeam(teamA, teamAWon, newEloA);
  await patchTeam(teamB, !teamAWon, newEloB);

  await ctx.db.insert("ratingHistory", {
    matchroomId,
    game,
    subjectType: "team" as const,
    teamId: teamA._id,
    teamSide: "team1" as const,
    oldElo: eloA,
    newElo: newEloA,
    delta: dA.delta,
    teamAverageElo: eloA,
    opponentAverageElo: eloB,
    expectedScore: dA.expected,
    actualScore: dA.actual,
    kFactor: dA.kFactor,
    resultSource: source,
    appliedAt: now,
  });
  await ctx.db.insert("ratingHistory", {
    matchroomId,
    game,
    subjectType: "team" as const,
    teamId: teamB._id,
    teamSide: "team2" as const,
    oldElo: eloB,
    newElo: newEloB,
    delta: dB.delta,
    teamAverageElo: eloB,
    opponentAverageElo: eloA,
    expectedScore: dB.expected,
    actualScore: dB.actual,
    kFactor: dB.kFactor,
    resultSource: source,
    appliedAt: now,
  });

  // Record the challenge outcome if not already set (was previously never set).
  if (!challenge.result) {
    await ctx.db.patch(challenge._id, {
      result: { winnerId: teamAWon ? teamA._id : teamB._id },
      updatedAt: now,
    });
  }
}

// Applies player (and, for team-vs-team challenges, team) ELO updates for a
// finalized verified result. Idempotent via the matchroom rating marker.
async function applyRatingsForFinalizedMatch(
  ctx: any,
  matchroomId: Id<"matchrooms">,
  winner: "team1" | "team2",
  source: string,
) {
  const room = await ctx.db.get(matchroomId);
  if (!room) return;
  // Idempotency: never apply twice for the same match.
  if (room.skillRatingAppliedAt) return;
  // Never rate cancelled/expired/no-contest matches.
  if (["cancelled", "expired"].includes(String(room.status || ""))) {
    await markRatingApplied(ctx, matchroomId, source, "ineligible_status");
    return;
  }

  const game = normalizeGameKey(room.game);
  if (!game) {
    await markRatingApplied(ctx, matchroomId, source, "no_game");
    return;
  }

  // Canonical sides: slotsA = team1, slotsB = team2.
  const sideA = await resolveRealUserIds(ctx, collectSideSlotUids(room.slotsA));
  const sideB = await resolveRealUserIds(ctx, collectSideSlotUids(room.slotsB));

  // Need at least one real user on each side for a meaningful exchange.
  if (sideA.realIds.length === 0 || sideB.realIds.length === 0) {
    await markRatingApplied(ctx, matchroomId, source, "insufficient_real_players");
    return;
  }

  const category = resolveMatchCategory(room, source, {
    hadNonUser: sideA.hadNonUser || sideB.hadNonUser,
    realACount: sideA.realIds.length,
    realBCount: sideB.realIds.length,
  });

  // Load docs + current elo for every real participant.
  const docs = new Map<string, any>();
  const eloByUser = new Map<string, number>();
  for (const id of [...sideA.realIds, ...sideB.realIds]) {
    const user = await ctx.db.get(id);
    if (!user) continue;
    docs.set(String(id), user);
    const score = getStoredScoreForGame(user.skillScores, game);
    eloByUser.set(String(id), getPlayerElo(score));
  }

  const elosA = sideA.realIds.map((id) => eloByUser.get(String(id)) ?? DEFAULT_ELO);
  const elosB = sideB.realIds.map((id) => eloByUser.get(String(id)) ?? DEFAULT_ELO);
  const avgA = average(elosA);
  const avgB = average(elosB);
  const roomAvg = average([...elosA, ...elosB]);
  const now = Date.now();

  const applySide = async (
    ids: Id<"users">[],
    side: "A" | "B",
    won: boolean,
  ) => {
    const teamAvg = side === "A" ? avgA : avgB;
    const oppAvg = side === "A" ? avgB : avgA;
    const teamSide = side === "A" ? "team1" : "team2";
    const outcome: MatchOutcome = won ? "win" : "loss";
    for (const id of ids) {
      const user = docs.get(String(id));
      if (!user) continue;
      const existingScores = (user.skillScores || {}) as Record<string, any>;
      const existing = getStoredScoreForGame(existingScores, game);
      const oldElo = eloByUser.get(String(id)) ?? DEFAULT_ELO;
      const matchesPlayed = Number(existing?.matchesPlayed || 0);

      const result = computePlayerEloDelta({
        playerElo: oldElo,
        teamAverageElo: teamAvg,
        opponentAverageElo: oppAvg,
        matchroomAverageElo: roomAvg,
        outcome,
        category,
        matchesPlayed,
      });

      const newElo = applyEloDelta(oldElo, result.delta);
      const newRating = deriveRatingFromElo(newElo);

      const nextScore = {
        rating: newRating,
        tier: ratingTier(newRating),
        elo: newElo,
        matchesPlayed: matchesPlayed + 1,
        wins: Number(existing?.wins || 0) + (won ? 1 : 0),
        losses: Number(existing?.losses || 0) + (won ? 0 : 1),
        initialSource: existing?.initialSource,
        initialRating: existing?.initialRating,
        lastMatchDate: now,
        lastUpdated: now,
      };

      await ctx.db.patch(id, {
        skillScores: { ...existingScores, [game]: nextScore },
        updatedAt: now,
      });

      await ctx.db.insert("ratingHistory", {
        matchroomId,
        game,
        subjectType: "player" as const,
        userId: id,
        teamSide: teamSide as "team1" | "team2",
        oldElo,
        newElo,
        delta: result.delta,
        teamAverageElo: teamAvg,
        opponentAverageElo: oppAvg,
        matchroomAverageElo: roomAvg,
        expectedScore: result.expected,
        actualScore: result.actual,
        kFactor: result.kFactor,
        adjustmentFactors: {
          individual: result.individualFactor,
          matchroom: result.matchroomFactor,
        },
        resultSource: source,
        appliedAt: now,
      });
    }
  };

  const sideAWon = winner === "team1";
  await applySide(sideA.realIds, "A", sideAWon);
  await applySide(sideB.realIds, "B", !sideAWon);

  // Team-vs-team challenge? Update team stats + team ELO (idempotent via marker).
  const challenge = await ctx.db
    .query("teamChallenges")
    .withIndex("by_matchroomId", (q: any) => q.eq("matchroomId", matchroomId))
    .first();
  if (challenge && challenge.challengerTeamId && challenge.opponentTeamId) {
    await applyTeamRatingsForChallenge(
      ctx,
      matchroomId,
      game,
      challenge,
      winner,
      source,
      avgA,
      avgB,
    );
  }

  await markRatingApplied(ctx, matchroomId, source, "applied");
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

  // Apply server-authoritative ELO after the result is finalized. Best-effort:
  // a rating failure must never roll back the finalized result. Idempotent.
  try {
    await applyRatingsForFinalizedMatch(ctx, matchroomId, winner, source);
  } catch (error) {
    console.error("[matchrooms] applyRatingsForFinalizedMatch failed", {
      matchroomId: String(matchroomId),
      error: String(error),
    });
  }

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
  const actor = await requireCurrentUser(ctx);
  const expectedUser = await resolveUserByAnyId(ctx, expectedUid);

  console.log("[matchrooms] auth gate", {
    authId: actor.authUser?.userId ?? actor.identity?.tokenIdentifier ?? actor.identity?.subject ?? null,
    email: actor.authUser?.email ?? actor.identity?.email ?? null,
    expectedUid: expectedUid ?? null,
    expectedAuthId: expectedUser?.authId ?? null,
  });

  assertKycAccessAllowed(actor.user, KYC_VERIFICATION_REQUIRED_MESSAGE);

  if (expectedUser && expectedUser._id !== actor.user._id) {
    throw new Error("You can only perform this action for your own account");
  }

  return {
    userId: actor.user.authId || String(actor.user._id),
    kycVerified: true,
    email: actor.authUser?.email ?? actor.identity?.email ?? null,
    convexUser: actor.user,
  };
}

async function requireRoomActor(ctx: any, room: any, allowed: Array<"host" | "captain" | "participant" | "zoneOwner">) {
  const actor = await requireCurrentUser(ctx);
  const actorId = String(actor.user._id);
  const isHost = String(room.hostUid || "") === actorId;
  const isCaptain = String(room.captainUidA || "") === actorId || String(room.captainUidB || "") === actorId || isHost;
  const isParticipant = Array.isArray(room.playerUids) && room.playerUids.map(String).includes(actorId);
  let isZoneOwner = false;
  if (room.zoneId) {
    const zone = await ctx.db.get(room.zoneId as Id<"zones">);
    isZoneOwner = String(zone?.ownerUid || "") === actorId;
  }
  if (
    (allowed.includes("host") && isHost) ||
    (allowed.includes("captain") && isCaptain) ||
    (allowed.includes("participant") && isParticipant) ||
    (allowed.includes("zoneOwner") && isZoneOwner)
  ) {
    assertKycAccessAllowed(actor.user, KYC_VERIFICATION_REQUIRED_MESSAGE);
    return actor;
  }
  throw new Error("Not authorized");
}

// Helper: Check if room is expired
export function isRoomExpired(room: any): boolean {
  if (!room) return false;
  if (room.status === "expired" || room.status === "cancelled") return true;
  const now = Date.now();
  if (shouldExpireForNotFull(room, now)) return true;
  const expiresAt = Number(room.expiresAt || 0);
  return Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= now && !isRosterFull(room);
}

// Helper: Check if room is locked
function getRoomLockAtMs(room: any) {
  const explicitLockAt = Number(room?.lockAt || 0);
  if (Number.isFinite(explicitLockAt) && explicitLockAt > 0) return explicitLockAt;
  return getMatchroomLockAt(room?.scheduledStartAt || room?.startTime);
}

export function isJoinLocked(room: any, now = Date.now()): boolean {
  if (!room || room.status === "cancelled" || room.status === "expired") return true;
  if (isRosterFull(room)) return true;
  const lockAt = getRoomLockAtMs(room);
  return typeof lockAt === "number" && lockAt <= now;
}

export function isLeaveLocked(room: any, now = Date.now()): boolean {
  if (!room) return false;
  if (room.status === "cancelled" || room.status === "expired") return true;
  if (room.venueConfirmedAt || room.confirmedZoneId || room.zoneAdminApproved === true) return true;
  const lockAt = getRoomLockAtMs(room);
  return typeof lockAt === "number" && lockAt <= now;
}

// Legacy alias for call sites not yet split by intent.
export function isRoomLocked(room: any): boolean {
  return isJoinLocked(room);
}

function getCappedMatchroomExpiryOrThrow(
  room: any,
  ttlMs: number,
  label: string,
  now = Date.now(),
) {
  const desiredExpiry = now + ttlMs;
  const expiry = capExpiryAtLockTime(now, desiredExpiry, room?.scheduledStartAt || room?.startTime);
  if (!expiry) {
    throw new Error(`${label} cannot be created because this matchroom is locked.`);
  }
  return expiry;
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
  let zone: any = null;
  if (room.zoneId) {
    try {
      zone = await ctx.db.get(room.zoneId as Id<"zones">);
    } catch {
      zone = null;
    }
  }
  const grossAmount = getMatchroomGrossAmount(room);
  const normalPayoutRate = Number.isFinite(Number(zone?.normalPayoutRate)) ? Number(zone.normalPayoutRate) : 0.9;
  const pilotPayoutRate = Number.isFinite(Number(zone?.pilotPayoutRate)) ? Number(zone.pilotPayoutRate) : 1.0;
  // Pilot eligibility is decided at payout calculation time using backend time, not client-sent data.
  const pilotApplied = zone?.pilotStatus === "active" && typeof zone?.pilotEndsAt === "number" && now <= zone.pilotEndsAt;
  const payoutRateRaw = pilotApplied ? pilotPayoutRate : normalPayoutRate;
  const payoutRate = Math.min(1, Math.max(0, payoutRateRaw));
  const platformRate = Math.round((1 - payoutRate) * 10000) / 10000;
  const payoutAmount = Math.round(grossAmount * payoutRate * 100) / 100;
  const platformShareAmount = Math.round((grossAmount - payoutAmount) * 100) / 100;
  if (payoutAmount <= 0) return null;

  const reference = `venue_payout:${String(matchroomId)}`;
  await ctx.runMutation(internal.wallet.addFunds, {
    userId: owner._id,
    amount: payoutAmount,
    reference,
    metadata: {
      source: "matchroom_completion_payout",
      matchroomId: String(matchroomId),
      grossAmount,
      platformShareAmount,
      payoutRate,
      platformRate,
      pilotApplied,
      pilotStartedAt: zone?.pilotStartedAt || null,
      pilotEndsAt: zone?.pilotEndsAt || null,
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
    payoutRate,
    platformRate,
    pilotApplied,
    reference,
  });
  return { status: "paid", reference, amount: payoutAmount, paidAt: now };
}

function getBookingHoldReference(intentId: Id<"bookingIntents">, sourceReference?: string | null) {
  const source = String(sourceReference || "wallet").replace(/[^a-zA-Z0-9:_-]/g, "_");
  return `hold:booking_intent:${String(intentId)}:${source}`;
}

function getBookingCaptureReference(intentId: Id<"bookingIntents">) {
  return `capture:booking_intent:${String(intentId)}`;
}

function getBookingReleaseReference(intentId: Id<"bookingIntents">, reason: string) {
  return `release:booking_intent:${String(intentId)}`;
}

function getBookingRefundReference(intentId: Id<"bookingIntents">, reason: string) {
  return `refund:booking_intent:${String(intentId)}`;
}

function getHoldCaptureAt(room: any) {
  const candidates = [
    Number(room?.scheduledStartAt || 0),
    Number(room?.startTime || 0),
  ].filter((value) => Number.isFinite(value) && value > 0);
  return candidates[0] || Date.now();
}

async function scheduleBookingHoldCapture(ctx: any, intentId: Id<"bookingIntents">, room: any) {
  const captureScheduledAt = getHoldCaptureAt(room);
  const delayMs = Math.max(0, captureScheduledAt - Date.now());
  const captureScheduledFnId = await ctx.scheduler.runAfter(
    delayMs,
    internal.matchrooms.captureBookingIntentHold,
    { intentId },
  );
  return { captureScheduledAt, captureScheduledFnId: String(captureScheduledFnId) };
}

async function releaseBookingIntentHold(ctx: any, intent: any, reason: string) {
  if (!intent || intent.heldStatus !== "held" || !intent.heldReference) {
    return { released: false, reason: "not_held" };
  }

  const amount = Number(intent.heldAmount || intent.pricing?.totalCost || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { released: false, reason: "invalid_amount" };
  }

  const releaseReference = getBookingReleaseReference(intent._id, reason);
  await ctx.runMutation(internal.wallet.releaseHeldFunds, {
    userId: intent.createdByUid,
    amount,
    reference: releaseReference,
    originalHoldReference: intent.heldReference,
    metadata: {
      source: "booking_hold_release",
      intentId: String(intent._id),
      matchroomId: String(intent.matchroomId),
      reason,
    },
  });

  await ctx.db.patch(intent._id, {
    heldStatus: "released",
    heldReleasedAt: Date.now(),
    updatedAt: Date.now(),
  });

  return { released: true, reference: releaseReference, amount };
}

async function releaseHeldBookingIntentsForMatchroom(ctx: any, matchroomId: Id<"matchrooms">, reason: string) {
  const intents = await ctx.db
    .query("bookingIntents")
    .withIndex("by_matchroomId", (q: any) => q.eq("matchroomId", matchroomId))
    .collect();

  let releasedCount = 0;
  for (const intent of intents) {
    const result = await releaseBookingIntentHold(ctx, intent, reason);
    if (result.released) releasedCount += 1;
  }

  return { releasedCount };
}

async function refundCapturedBookingIntentHold(ctx: any, intent: any, reason: string) {
  if (!intent || intent.heldStatus !== "captured") {
    return { refunded: false, reason: "not_captured" };
  }

  const amount = Number(intent.heldAmount || intent.pricing?.totalCost || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { refunded: false, reason: "invalid_amount" };
  }

  const refundReference = getBookingRefundReference(intent._id, reason);
  await ctx.runMutation(internal.wallet.refundFunds, {
    userId: intent.createdByUid,
    amount,
    reference: refundReference,
    metadata: {
      source: "booking_hold_capture_refund",
      intentId: String(intent._id),
      matchroomId: String(intent.matchroomId),
      originalHoldReference: intent.heldReference || null,
      originalCaptureReference: getBookingCaptureReference(intent._id),
      reason,
    },
  });

  await ctx.db.patch(intent._id, {
    heldStatus: "refunded",
    heldReleasedAt: Date.now(),
    updatedAt: Date.now(),
  });

  return { refunded: true, reference: refundReference, amount };
}

async function refundCapturedBookingIntentsForMatchroom(ctx: any, matchroomId: Id<"matchrooms">, reason: string) {
  const intents = await ctx.db
    .query("bookingIntents")
    .withIndex("by_matchroomId", (q: any) => q.eq("matchroomId", matchroomId))
    .collect();

  let refundedCount = 0;
  for (const intent of intents) {
    const result = await refundCapturedBookingIntentHold(ctx, intent, reason);
    if (result.refunded) refundedCount += 1;
  }

  return { refundedCount };
}

async function expireBookingIntentsForMatchroom(ctx: any, matchroomId: Id<"matchrooms">, reason: string) {
  const intents = await ctx.db
    .query("bookingIntents")
    .withIndex("by_matchroomId", (q: any) => q.eq("matchroomId", matchroomId))
    .collect();

  const terminalStatuses = new Set(["expired", "cancelled", "rejected"]);
  const now = Date.now();
  let expiredCount = 0;
  for (const intent of intents) {
    if (terminalStatuses.has(String(intent.status || ""))) continue;
    await ctx.db.patch(intent._id, {
      status: "expired",
      updatedAt: now,
    });
    expiredCount += 1;
  }

  return { expiredCount, reason };
}

async function expirePendingMatchroomNotifications(ctx: any, matchroomId: Id<"matchrooms">, reason: string) {
  const notifications = await ctx.db
    .query("notifications")
    .withIndex("by_matchroomId", (q: any) => q.eq("matchroomId", matchroomId))
    .collect();
  const expirableTypes = new Set(["match.join_request", "match_join_request", "match.payment_required", "match.seat_invite"]);
  const now = Date.now();
  let expiredCount = 0;
  for (const notification of notifications) {
    if (notification.status !== "pending") continue;
    if (!expirableTypes.has(String(notification.type || ""))) continue;
    await ctx.db.patch(notification._id, {
      status: "expired",
      updatedAt: now,
      data: {
        ...(notification.data || {}),
        expiredReason: reason,
      },
    });
    expiredCount += 1;
  }
  return { expiredCount };
}

async function expireMatchroomForInvalidLifecycle(
  ctx: any,
  matchroomId: Id<"matchrooms">,
  roomInput: any,
  reason: string,
) {
  const room = roomInput || await ctx.db.get(matchroomId);
  if (!room) return { changed: false, reason: "missing_room" };
  if (room.status === "expired" || room.status === "cancelled") {
    return { changed: false, reason: "already_terminal" };
  }

  const now = Date.now();
  await ctx.db.patch(matchroomId, {
    status: "expired",
    isLocked: true,
    cancelReason: reason,
    resultVerification:
      room.resultVerification && room.resultVerification.status !== "resolved"
        ? {
            ...room.resultVerification,
            status: "admin_review",
            adminReviewReason: reason,
            validationError: "Matchroom expired before a valid full roster could start.",
          }
        : room.resultVerification,
    updatedAt: now,
  });
  await expireBookingIntentsForMatchroom(ctx, matchroomId, reason);
  await expirePendingMatchroomNotifications(ctx, matchroomId, reason);
  await releaseHeldBookingIntentsForMatchroom(ctx, matchroomId, reason);
  await refundCapturedBookingIntentsForMatchroom(ctx, matchroomId, reason);
  return { changed: true, reason };
}

async function markInvalidResultVerificationForAdminReview(
  ctx: any,
  matchroomId: Id<"matchrooms">,
  room: any,
  reason: string,
) {
  const now = Date.now();
  const rv = room?.resultVerification || {};
  await ctx.db.patch(matchroomId, {
    resultVerification: {
      ...rv,
      status: "admin_review",
      adminReviewReason: reason,
      validationError: "This matchroom did not pass lifecycle validation for result verification.",
    },
    updatedAt: now,
  });

  // Alert super admins that this result needs manual review.
  const superAdmins = await ctx.db
    .query("users")
    .withIndex("by_role", (q: any) => q.eq("role", "super-admin"))
    .collect();
  for (const superAdmin of superAdmins) {
    const dedupeKey = `match.result_admin_review:${String(matchroomId)}:${String(superAdmin._id)}`;
    if (await notificationExistsByDedupeKey(ctx, dedupeKey)) continue;
    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "match.result_admin_review",
      toUid: superAdmin._id,
      recipientRole: "super_admin",
      status: "pending",
      dedupeKey,
      dedupePolicy: "upsert_active",
      pushPolicy: "eligible",
      matchroomId,
      route: "/super-admin",
      title: "Match needs admin review",
      body: "A match result could not be verified automatically and needs review.",
      data: { matchroomId, reason, href: "/super-admin" },
    });
  }

  return { ok: false, status: "admin_review", reason };
}

async function captureHeldBookingIntentsForMatchroom(ctx: any, matchroomId: Id<"matchrooms">) {
  const intents = await ctx.db
    .query("bookingIntents")
    .withIndex("by_matchroomId", (q: any) => q.eq("matchroomId", matchroomId))
    .collect();

  let capturedCount = 0;
  for (const intent of intents) {
    if (intent.heldStatus === "held") {
      const result: any = await ctx.runMutation(internal.matchrooms.captureBookingIntentHold, {
        intentId: intent._id,
      });
      if (result?.captured) capturedCount += 1;
    }
  }

  return { capturedCount };
}

async function maybeMarkMerchantCapturedAfterHoldCapture(ctx: any, matchroomId: Id<"matchrooms">) {
  const room = await ctx.db.get(matchroomId);
  if (!room) return null;

  const intents = await ctx.db
    .query("bookingIntents")
    .withIndex("by_matchroomId", (q: any) => q.eq("matchroomId", matchroomId))
    .collect();
  const hasUncapturedHold = intents.some((intent: any) => intent.heldStatus === "held");
  if (hasUncapturedHold) return null;

  return await markMerchantCapturedForMatchroom(ctx, matchroomId, room);
}

async function dispatchZoneAdminRequestForFullMatchroom(ctx: any, matchroomId: Id<"matchrooms">) {
  const room = await ctx.db.get(matchroomId);
  if (!room || room.locationMode !== "zone" || !room.zoneId) return null;

  const existing = await ctx.db
    .query("bookingRequests")
    .withIndex("by_matchroomId", (q: any) => q.eq("matchroomId", matchroomId))
    .first();
  if (existing) {
    // Booking request already exists — still notify the zone admin if not yet done.
    await maybeNotifyZoneAdminMatchroomFull(ctx, matchroomId, room);
    return existing._id;
  }

  const maxPlayers = Math.max(1, Number(room.maxPlayers || room.currentPlayers || 1));
  if (Number(room.currentPlayers || 0) < maxPlayers) return null;

  const confirmedSlotCount = [...(room.slotsA || []), ...(room.slotsB || [])].filter((slot: any) =>
    slot?.status === "confirmed" && (slot?.uid || slot?.user?.uid),
  ).length;
  if (confirmedSlotCount < maxPlayers) return null;

  const host = await resolveUserByAnyId(ctx, String(room.hostUid || ""));
  if (!host) return null;

  const now = Date.now();
  const requestId = await ctx.db.insert("bookingRequests", {
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
    status: "open",
    createdAt: now,
    updatedAt: now,
  });

  // Notify the zone admin that the matchroom is full and ready for confirmation.
  await maybeNotifyZoneAdminMatchroomFull(ctx, matchroomId, room);

  return requestId;
}

// Sends a ONE-TIME idempotent notification to the zone owner when a zone-linked
// matchroom becomes full. Dedupe key ensures this fires at most once per matchroom.
async function maybeNotifyZoneAdminMatchroomFull(ctx: any, matchroomId: Id<"matchrooms">, room: any) {
  if (!room?.zoneId) return;

  let zone: any = null;
  try {
    zone = await ctx.db.get(room.zoneId as Id<"zones">);
  } catch {
    zone = null;
  }
  if (!zone?.ownerUid) return;

  const dedupeKey = `zone.matchroom_full:${String(matchroomId)}`;
  if (await notificationExistsByDedupeKey(ctx, dedupeKey)) return;

  const zoneOwner = await resolveUserByAnyId(ctx, String(zone.ownerUid));
  if (!zoneOwner?._id) return;

  await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
    type: "zone.matchroom_full",
    toUid: zoneOwner._id,
    recipientRole: "zone_admin" as const,
    status: "pending",
    dedupeKey,
    dedupePolicy: "upsert_active",
    pushPolicy: "eligible",
    matchroomId,
    route: `/matchrooms/${String(matchroomId)}`,
    title: "Matchroom is ready",
    body: `${room.title || "Matchroom"} is full and ready for zone confirmation.`,
    data: {
      matchroomId: String(matchroomId),
      matchroomTitle: room.title || null,
      zoneId: String(room.zoneId),
      href: `/matchrooms/${String(matchroomId)}`,
    },
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
  const expiresAt = getCappedMatchroomExpiryOrThrow(
    args.room,
    PAYMENT_INTENT_TTL_MS,
    "Payment intent",
    now,
  );
  const duplicate = existingIntents.find((intent: any) =>
    String(intent.matchroomId) === String(args.room._id)
    && intent.paymentStatus !== "paid"
    && intent.status !== "cancelled"
    && intent.status !== "expired"
    && (intent.selectedSlotIds || []).includes(selection.slotId)
  );

  if (duplicate) {
    const patch: Record<string, any> = {
      updatedAt: now,
      sourceNotificationId: args.sourceNotificationId || duplicate.sourceNotificationId,
      expiresAt,
    };

    if (duplicate.status === "pending_approvals" || duplicate.status === "approved") {
      patch.status = "approved_pending_payment";
      patch.pricing = {
        totalCost: Number(args.room.pricing?.perPlayer || 0),
        perPlayerCost: Number(args.room.pricing?.perPlayer || 0),
        currency: String(args.room.pricing?.currency || "PKR"),
      };
    }

    await ctx.db.patch(duplicate._id, patch);
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
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });
}

async function createPendingApprovalBookingIntent(ctx: any, args: {
  room: any;
  createdByUid: Id<"users">;
  createdByUsername: string;
  role: string;
  targetTeam?: string | null;
  requestedSlotId?: string | null;
  sourceNotificationId?: Id<"notifications">;
  expiresAt: number;
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
      status: duplicate.status === "approved_pending_payment" ? duplicate.status : "pending_approvals",
      updatedAt: now,
      sourceNotificationId: args.sourceNotificationId || duplicate.sourceNotificationId,
      expiresAt: args.expiresAt,
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
    source: "direct_join",
    sourceNotificationId: args.sourceNotificationId,
    status: "pending_approvals",
    pricing: {
      totalCost: Number(args.room.pricing?.perPlayer || 0),
      perPlayerCost: Number(args.room.pricing?.perPlayer || 0),
      currency: String(args.room.pricing?.currency || "PKR"),
    },
    game: args.room.game,
    paymentStatus: "unpaid",
    expiresAt: args.expiresAt,
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
// Non-throwing access check for matchroom check-in details (QR + match code).
// Authorized: host, either captain, any joined participant (playerUids or slots),
// the owning zone's admin, and super admins. Everyone else is an "outsider".
async function resolveCheckInAccess(ctx: any, room: any): Promise<boolean> {
  try {
    const actor = await getCurrentUser(ctx);
    const viewer = actor.user;
    if (!viewer) return false;
    const viewerId = String(viewer._id);

    if (String(room.hostUid || "") === viewerId) return true;
    if (String(room.captainUidA || "") === viewerId) return true;
    if (String(room.captainUidB || "") === viewerId) return true;
    if (
      Array.isArray(room.playerUids) &&
      room.playerUids.map(String).includes(viewerId)
    ) {
      return true;
    }

    const slotUids = [...(room.slotsA || []), ...(room.slotsB || [])]
      .map((slot: any) => slot?.user?._id || slot?.user?.uid || slot?.uid)
      .filter(Boolean)
      .map(String);
    if (slotUids.includes(viewerId)) return true;

    if (isSuperAdminProfile(viewer, actor.authUser?.email || actor.identity?.email)) {
      return true;
    }

    if (room.zoneId) {
      const zone = await ctx.db.get(room.zoneId as Id<"zones">);
      if (zone && String(zone.ownerUid || "") === viewerId) return true;
    }

    return false;
  } catch {
    return false;
  }
}

export const getById = query({
  args: { matchroomId: v.string() },
  handler: async (ctx, args) => {
    try {
      const id = args.matchroomId as Id<"matchrooms">;
      const room = await ctx.db.get(id);
      if (room) {
        // Gate the check-in code: outsiders never receive the real matchCode, so
        // the secret can't leak via the payload even if a client renders it.
        const canViewCheckIn = await resolveCheckInAccess(ctx, room);
        const result: any = { ...room, id: room._id, canViewCheckIn };
        if (!canViewCheckIn) {
          result.matchCode = null;
        }
        return result;
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

// ─── Player-scoped matchroom membership (matchroomMembers join table) ───
// Reconcile member rows to the room's current playerUids. Called after every
// membership-changing write so user-scoped lists are correct & scalable instead
// of scanning the global newest-200 rooms.
async function syncMatchroomMembers(
  ctx: any,
  matchroomId: Id<"matchrooms">,
  playerUids: string[],
) {
  const desired = new Set((playerUids || []).map((u) => String(u)).filter(Boolean));
  const existing = await ctx.db
    .query("matchroomMembers")
    .withIndex("by_matchroomId", (q: any) => q.eq("matchroomId", matchroomId))
    .collect();
  const existingUids = new Set<string>();
  for (const row of existing) {
    existingUids.add(String(row.uid));
    if (!desired.has(String(row.uid))) {
      await ctx.db.delete(row._id);
    }
  }
  for (const uid of desired) {
    if (!existingUids.has(uid)) {
      await ctx.db.insert("matchroomMembers", { matchroomId, uid, createdAt: Date.now() });
    }
  }
}

// Rooms a user is in, via the member index, defensively filtered against the
// live playerUids so a stale member row can never surface a wrong room.
async function getRoomsForUserViaMembers(ctx: any, uid: string) {
  const memberRows = await ctx.db
    .query("matchroomMembers")
    .withIndex("by_uid", (q: any) => q.eq("uid", String(uid)))
    .collect();
  const rooms: any[] = [];
  const seen = new Set<string>();
  for (const row of memberRows) {
    const key = String(row.matchroomId);
    if (seen.has(key)) continue;
    seen.add(key);
    const room = await ctx.db.get(row.matchroomId);
    if (
      room &&
      Array.isArray(room.playerUids) &&
      room.playerUids.map(String).includes(String(uid))
    ) {
      rooms.push(room);
    }
  }
  return rooms;
}

type UserScheduleTab = "upcoming" | "waiting" | "history";

function isUserConfirmedForSchedule(room: any, uid: string) {
  if (String(room?.hostUid || "") === String(uid)) return true;
  if ((room?.playerUids || []).map(String).includes(String(uid))) return true;
  return getAllMatchroomSlots(room).some((slot: any) => {
    const slotUid = String(slot?.uid || slot?.user?.uid || "");
    return slotUid === String(uid) && String(slot?.status || "").toLowerCase() === "confirmed";
  });
}

function getScheduleStatus(room: any, uid: string, now: number) {
  const roomStatus = String(room?.status || "").toLowerCase();
  const startMs = getScheduleRoomStartMs(room);
  if (roomStatus === "cancelled") {
    return { tab: "history" as UserScheduleTab, status: "Cancelled", reason: "Lobby was cancelled.", tone: "danger" };
  }
  if (roomStatus === "expired") {
    return { tab: "history" as UserScheduleTab, status: "Expired", reason: "Lobby expired before it was played.", tone: "danger" };
  }
  if (roomStatus === "completed") {
    return { tab: "history" as UserScheduleTab, status: "Completed", reason: "Match completed.", tone: "success" };
  }
  if (startMs !== null && startMs < now - 15 * 60 * 1000) {
    return { tab: "history" as UserScheduleTab, status: "Past", reason: "Match time has passed.", tone: "neutral" };
  }
  if (String(room?.paymentStatus || "unpaid") !== "paid" && Number(room?.paymentAmount || 0) > 0) {
    return { tab: "waiting" as UserScheduleTab, status: "Pending Payment", reason: "Payment is still pending.", tone: "warning" };
  }
  if (!isUserConfirmedForSchedule(room, uid)) {
    return { tab: "waiting" as UserScheduleTab, status: "Pending Approval", reason: "Your slot is not confirmed yet.", tone: "warning" };
  }
  if (!isRosterFull(room)) {
    return { tab: "waiting" as UserScheduleTab, status: "Waiting Lobby", reason: "Lobby is waiting for all players.", tone: "warning" };
  }
  const isZoneRoom = Boolean(room?.zoneId || room?.confirmedZoneId) || room?.locationMode === "zone";
  if (isZoneRoom && room?.zoneAdminApproved !== true) {
    return { tab: "waiting" as UserScheduleTab, status: "Waiting Venue", reason: "Venue admin approval is pending.", tone: "warning" };
  }
  const broadcastStatus = String(room?.broadcastRequestStatus || "");
  if (["waiting_for_fill", "waiting_for_zones"].includes(broadcastStatus)) {
    return { tab: "waiting" as UserScheduleTab, status: "Waiting Broadcast", reason: "Broadcast venue confirmation is pending.", tone: "warning" };
  }
  return { tab: "upcoming" as UserScheduleTab, status: "Confirmed", reason: "Lobby is confirmed and ready.", tone: "success" };
}

function matchesUserScheduleFilters(room: any, derived: any, filters?: any) {
  if (!filters) return true;
  const searchText = String(filters.searchText || "").trim().toLowerCase();
  if (searchText) {
    const haystack = [
      room?.title,
      room?.game,
      room?.location,
      room?.scheduledDate,
      room?.scheduledTime,
      derived?.status,
      derived?.reason,
    ].filter(Boolean).join(" ").toLowerCase();
    if (!haystack.includes(searchText)) return false;
  }
  const game = String(filters.game || "all").toLowerCase();
  if (game && game !== "all" && String(room?.game || "").toLowerCase() !== game) return false;
  const venue = String(filters.venue || "all").toLowerCase();
  if (venue && venue !== "all") {
    const isZoneRoom = Boolean(room?.zoneId || room?.confirmedZoneId) || room?.locationMode === "zone";
    if (venue === "zone" && !isZoneRoom) return false;
    if (venue === "broadcast" && isZoneRoom) return false;
  }
  const paymentStatus = String(filters.paymentStatus || "all").toLowerCase();
  if (paymentStatus && paymentStatus !== "all") {
    const roomPayment = String(room?.paymentStatus || "unpaid").toLowerCase();
    if (paymentStatus === "paid" && roomPayment !== "paid") return false;
    if (paymentStatus === "unpaid" && roomPayment === "paid") return false;
  }
  const statusGroup = String(filters.statusGroup || "all").toLowerCase();
  if (statusGroup && statusGroup !== "all") {
    const status = String(derived?.status || "").toLowerCase();
    if (statusGroup === "upcoming" && status !== "confirmed") return false;
    if (statusGroup === "needs_action" && !["pending payment", "pending approval", "waiting lobby", "waiting venue", "waiting broadcast"].includes(status)) return false;
    if (statusGroup === "completed" && status !== "completed") return false;
    if (statusGroup === "cancelled" && !["cancelled", "expired"].includes(status)) return false;
  }
  const dateRange = String(filters.dateRange || "all").toLowerCase();
  if (dateRange && dateRange !== "all") {
    const startMs = getScheduleRoomStartMs(room);
    if (!startMs) return false;
    const start = new Date(startMs);
    const now = new Date();
    const sameDay =
      start.getFullYear() === now.getFullYear() &&
      start.getMonth() === now.getMonth() &&
      start.getDate() === now.getDate();
    if (dateRange === "today" && !sameDay) return false;
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow =
      start.getFullYear() === tomorrow.getFullYear() &&
      start.getMonth() === tomorrow.getMonth() &&
      start.getDate() === tomorrow.getDate();
    if (dateRange === "tomorrow" && !isTomorrow) return false;
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 7);
    if (dateRange === "week" && (start < now || start > weekEnd)) return false;
  }
  return true;
}

async function getUserScheduleCandidateRooms(ctx: any, uid: string) {
  const hostedRooms = await ctx.db
    .query("matchrooms")
    .withIndex("by_hostUid", (q: any) => q.eq("hostUid", uid))
    .order("desc")
    .collect();
  const memberRooms = await getRoomsForUserViaMembers(ctx, uid);
  const byId = new Map<string, any>();
  [...hostedRooms, ...memberRooms].forEach((room) => {
    if (room?._id) byId.set(String(room._id), room);
  });
  return Array.from(byId.values());
}

export const listForUserSchedule = query({
  args: {
    uid: v.string(),
    tab: v.union(v.literal("upcoming"), v.literal("waiting"), v.literal("history")),
    limit: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
    filters: v.optional(v.object({
      game: v.optional(v.string()),
      dateRange: v.optional(v.string()),
      venue: v.optional(v.string()),
      paymentStatus: v.optional(v.string()),
      searchText: v.optional(v.string()),
      statusGroup: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(50, Math.floor(Number(args.limit || 20))));
    const offset = Math.max(0, Number(args.cursor || 0) || 0);
    const now = Date.now();
    const rows = (await getUserScheduleCandidateRooms(ctx, args.uid))
      .map((room) => {
        const derived = getScheduleStatus(room, args.uid, now);
        return {
          ...room,
          id: room._id,
          derivedScheduleState: derived.status,
          scheduleReason: derived.reason,
          scheduleTone: derived.tone,
          scheduleTab: derived.tab,
        };
      })
      .filter((room) => room.scheduleTab === args.tab)
      .filter((room) => matchesUserScheduleFilters(room, {
        status: room.derivedScheduleState,
        reason: room.scheduleReason,
      }, args.filters))
      .sort((left, right) => {
        const leftStart = getScheduleRoomStartMs(left) || Number(left.createdAt || 0);
        const rightStart = getScheduleRoomStartMs(right) || Number(right.createdAt || 0);
        return args.tab === "history" ? rightStart - leftStart : leftStart - rightStart;
      });
    const page = rows.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    return {
      page,
      isDone: nextOffset >= rows.length,
      continueCursor: nextOffset >= rows.length ? null : String(nextOffset),
      total: rows.length,
    };
  },
});

// One-time backfill of matchroomMembers from existing matchrooms.playerUids.
// Run via `npx convex run matchrooms:backfillMatchroomMembers` after deploy.
// NOTE: collects all matchrooms in a single transaction — fine for current
// scale; convert to a paginated job if the table grows very large.
export const backfillMatchroomMembers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rooms = await ctx.db.query("matchrooms").collect();
    for (const room of rooms) {
      await syncMatchroomMembers(ctx, room._id, (room.playerUids || []) as string[]);
    }
    return { processed: rooms.length };
  },
});

// List matchrooms where user is a player
export const listByPlayer = query({
  args: { playerUid: v.string() },
  handler: async (ctx, args) => {
    const rooms = await getRoomsForUserViaMembers(ctx, args.playerUid);
    return rooms
      .filter((m) => !isRoomExpired(m))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .map((m) => ({ ...m, id: m._id }));
  },
});

// Get user's matchrooms (hosted + joined). Hosted via by_hostUid (complete);
// joined via the member index (correct at any scale).
export const getUserMatchrooms = query({
  args: { uid: v.string() },
  handler: async (ctx, args) => {
    const hostedRooms = await ctx.db
      .query("matchrooms")
      .withIndex("by_hostUid", (q) => q.eq("hostUid", args.uid))
      .order("desc")
      .collect();

    const memberRooms = await getRoomsForUserViaMembers(ctx, args.uid);

    const hosted = hostedRooms
      .filter((m) => !isRoomExpired(m))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .map((m) => ({ ...m, id: m._id }));

    const joined = memberRooms
      .filter((m) => m.hostUid !== args.uid && !isRoomExpired(m))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .map((m) => ({ ...m, id: m._id }));

    return { hosted, joined };
  },
});

export const listUserMatchroomsPage = query({
  args: {
    uid: v.string(),
    tab: v.union(v.literal("hosted"), v.literal("joined")),
    limit: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
    filters: v.optional(v.object({
      searchText: v.optional(v.string()),
      status: v.optional(v.string()),
      game: v.optional(v.string()),
      dateRange: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(50, Math.floor(Number(args.limit || 20))));
    const offset = Math.max(0, Number(args.cursor || 0) || 0);
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayStart = startOfToday.getTime();
    const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;
    const nextSevenDays = now + 7 * 24 * 60 * 60 * 1000;
    const filters = args.filters || {};
    const searchNeedle = String(filters.searchText || "").trim().toLowerCase();
    const statusFilter = String(filters.status || "all").toLowerCase();
    const gameFilter = String(filters.game || "all").toLowerCase();
    const dateRange = String(filters.dateRange || "all").toLowerCase();

    const hostedRooms = args.tab === "hosted"
      ? await ctx.db
          .query("matchrooms")
          .withIndex("by_hostUid", (q) => q.eq("hostUid", args.uid))
          .order("desc")
          .collect()
      : [];
    const joinedRooms = args.tab === "joined"
      ? (await getRoomsForUserViaMembers(ctx, args.uid)).filter((m) => String(m.hostUid) !== String(args.uid))
      : [];

    const rows = [...hostedRooms, ...joinedRooms]
      .filter((room) => {
        if (isRoomExpired(room)) return false;
        if (statusFilter !== "all" && String(room.status || "").toLowerCase() !== statusFilter) return false;
        if (gameFilter !== "all" && String(room.game || "").toLowerCase() !== gameFilter) return false;
        const start = getScheduleRoomStartMs(room) || Number(room.createdAt || 0);
        if (dateRange === "today" && !(start >= todayStart && start < tomorrowStart)) return false;
        if (dateRange === "this_week" && !(start >= now && start <= nextSevenDays)) return false;
        if (dateRange === "past" && !(start < todayStart)) return false;
        if (searchNeedle) {
          const haystack = [
            room.title,
            room.game,
            room.status,
            room.location,
            room.scheduledDate,
            room.scheduledTime,
          ].filter(Boolean).join(" ").toLowerCase();
          if (!haystack.includes(searchNeedle)) return false;
        }
        return true;
      })
      .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0))
      .map((room) => ({ ...room, id: room._id }));

    const page = rows.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    return {
      page,
      isDone: nextOffset >= rows.length,
      continueCursor: nextOffset >= rows.length ? null : String(nextOffset),
      total: rows.length,
    };
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

    const userRooms = await getRoomsForUserViaMembers(ctx, args.uid);

    const activeRooms = userRooms.filter((m) =>
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

export const checkCreateAvailability = query({
  args: {
    locationMode: v.optional(v.string()),
    zoneId: v.optional(v.string()),
    game: v.string(),
    scheduledStartAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const scheduleValidation = validateMatchroomScheduleWindow(args.scheduledStartAt, now);
    if (!scheduleValidation.ok) {
      return {
        available: false,
        message: scheduleValidation.message,
        reason: "invalid_schedule",
      };
    }

    if (args.locationMode === "zone" && args.zoneId) {
      const conflict = await findVenueGameTimeConflict(ctx, {
        game: args.game,
        scheduledStartAt: args.scheduledStartAt,
        zoneId: args.zoneId,
      });

      if (conflict) {
        return {
          available: false,
          conflictId: String(conflict._id),
          message: MATCHROOM_VENUE_TIME_CONFLICT_MESSAGE,
          reason: "venue_time_conflict",
        };
      }
    }

    return {
      available: true,
      message: null,
      reason: null,
    };
  },
});

// ============================================
// MUTATIONS
// ============================================

const createMatchroomArgsValidator = {
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
      v.literal("failed"),
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
    sourcePaymentOrderRefNum: v.optional(v.string()),
};

async function createMatchroomFromValidatedArgs(ctx: any, args: any, options?: {
  trustedHostUid?: boolean;
  sourcePaymentOrderRefNum?: string | null;
}) {
  const actor = options?.trustedHostUid
    ? {
        convexUser: await ctx.db.get(args.hostUid as Id<"users">),
      }
    : await requireVerifiedActor(ctx, args.hostUid);
  if (!actor.convexUser) {
    throw new Error("User profile not found");
  }
  const actorUid = String(actor.convexUser._id);

  if (actorUid !== args.hostUid) {
    throw new Error("You can only create a matchroom as yourself");
  }

  const sourcePaymentOrderRefNum = String(options?.sourcePaymentOrderRefNum || args.sourcePaymentOrderRefNum || "").trim();
  if (sourcePaymentOrderRefNum) {
    const existing = await ctx.db
      .query("matchrooms")
      .withIndex("by_sourcePaymentOrderRefNum", (q: any) => q.eq("sourcePaymentOrderRefNum", sourcePaymentOrderRefNum))
      .unique();
    if (existing) {
      return existing._id;
    }
  }

  const now = Date.now();
  const scheduleValidation = validateMatchroomScheduleWindow(args.scheduledStartAt, now);
  if (!scheduleValidation.ok) {
    throw new Error(scheduleValidation.message);
  }

  if (
    args.locationMode === "zone"
    && args.zoneId
    && typeof args.scheduledStartAt === "number"
  ) {
    const conflict = await findVenueGameTimeConflict(ctx, {
      game: args.game,
      scheduledStartAt: args.scheduledStartAt,
      zoneId: args.zoneId,
    });
    if (conflict) {
      throw new Error(MATCHROOM_VENUE_TIME_CONFLICT_MESSAGE);
    }
  }

  const normalizedPlayers = await Promise.all(
    args.players.map((player: any) =>
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
    lockAt: args.lockAt || getMatchroomLockAt(args.scheduledStartAt) || undefined,
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
    sourcePaymentOrderRefNum: sourcePaymentOrderRefNum || undefined,
    zoneAdminApproved: args.zoneAdminApproved,
    createdAt: now,
    updatedAt: now,
  });

  await syncMatchroomMembers(ctx, matchroomId, normalizedPlayerUids);

  if (
    args.locationMode === "broadcast" &&
    (args.broadcastAreas || []).length > 0
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
}

// Create a new matchroom
export const create = mutation({
  args: createMatchroomArgsValidator,
  handler: async (ctx, args) => {
    const matchroomId = await createMatchroomFromValidatedArgs(ctx, args);

    // Charge the host's wallet inside the same authenticated transaction so
    // creation and payment succeed or fail together. If the deduction throws
    // (insufficient funds or auth), the whole mutation rolls back and we never
    // leave an unpaid matchroom behind. This replaces the previous fragile
    // two-step client flow (create, then a separate deductFunds mutation that
    // could fail with "Authentication required"). The Easypaisa-funded flow
    // goes through finalizePaidCreateFromProvider and deducts on its own, so it
    // is unaffected by this public-create deduction.
    const paymentAmount = Math.max(0, Math.ceil(Number(args.paymentAmount || 0)));
    if (String(args.paymentStatus || "") === "paid" && paymentAmount > 0) {
      await deductWalletFunds(ctx, {
        amount: paymentAmount,
        metadata: {
          flow:
            args.locationMode === "broadcast"
              ? "broadcast_matchroom_create"
              : "zone_matchroom_create",
          matchroomId: String(matchroomId),
        },
        reference: `matchroom_create:${String(matchroomId)}`,
        source: "matchroom_create",
        userId: args.hostUid as Id<"users">,
      });
    }

    return matchroomId;
  },
});

export const finalizePaidCreateFromProvider = internalMutation({
  args: {
    orderRefNum: v.string(),
    userId: v.id("users"),
    amount: v.number(),
    matchroomCreateArgs: v.object(createMatchroomArgsValidator),
  },
  handler: async (ctx, args) => {
    if (String(args.matchroomCreateArgs.hostUid) !== String(args.userId)) {
      throw new Error("Payment user does not match matchroom host.");
    }
    const expectedAmount = Number(args.matchroomCreateArgs.paymentAmount || 0);
    if (expectedAmount > 0 && Math.ceil(expectedAmount) !== Math.ceil(Number(args.amount || 0))) {
      throw new Error("Payment amount does not match matchroom request.");
    }
    const matchroomId = await createMatchroomFromValidatedArgs(ctx, args.matchroomCreateArgs, {
      trustedHostUid: true,
      sourcePaymentOrderRefNum: args.orderRefNum,
    });
    return { ok: true, matchroomId };
  },
});

export const getSettlementSummary = query({
  args: { matchroomId: v.id("matchrooms") },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.matchroomId);
    if (!room) return null;
    await requireRoomActor(ctx, room, ["host", "captain", "participant", "zoneOwner"]);
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

    if (isJoinLocked(room)) {
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

    await syncMatchroomMembers(ctx, args.matchroomId, nextPlayerUids);

    if (willBeFull && room.locationMode === "broadcast") {
      await dispatchBroadcastZoneRequestsForMatchroom(ctx, args.matchroomId);
    }

    return { ok: true, willBeFull };
  },
});

// Urgent replacement notifications: when a player makes a PERMITTED leave (i.e.
// before lock) within URGENT_REPLACEMENT_WINDOW_MS of the lock time and the roster
// was full, alert the captains/host (invite a friend) and the zone admin
// (accommodate a walk-in). Lock stays authoritative — this never fires for a leave
// that was blocked. See the 24h-lock vs "1 hour before match" note in the tracker.
async function notifyUrgentReplacementOnLeave(
  ctx: any,
  room: any,
  matchroomId: Id<"matchrooms">,
  leavingUid: string,
) {
  const now = Date.now();
  const lockAt = getRoomLockAtMs(room);
  const withinUrgentWindow =
    typeof lockAt === "number" &&
    lockAt > now &&
    lockAt - now <= URGENT_REPLACEMENT_WINDOW_MS;
  // Only meaningful when a previously-full roster just opened a seat.
  if (!withinUrgentWindow || !isRosterFull(room)) return;

  const mIdStr = String(matchroomId);
  const route = `/matchrooms/${mIdStr}`;
  const leaving = String(leavingUid);

  // 1) Captains / host — invite a replacement from friends.
  const captainAuthIds = Array.from(
    new Set(
      [room.hostUid, room.captainUidA, room.captainUidB]
        .filter(Boolean)
        .map((value: any) => String(value))
        .filter((value: string) => value !== leaving),
    ),
  );
  for (const authId of captainAuthIds) {
    const users = await ctx.db
      .query("users")
      .withIndex("by_authId", (q: any) => q.eq("authId", authId))
      .take(1);
    if (users.length === 0) continue;
    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "match.replacement_needed",
      toUid: users[0]._id,
      status: "pending",
      dedupeKey: `match.replacement_needed:${mIdStr}:${leaving}:${String(users[0]._id)}`,
      dedupePolicy: "upsert_active",
      matchroomId,
      route,
      title: "Replacement needed",
      body: "A player left close to the match time. Invite a replacement from your friends as soon as possible.",
      data: { matchroomId: mIdStr, leavingUid: leaving, href: route },
    });
  }

  // 2) Zone admin — accommodate one walk-in (only for zone-linked matchrooms).
  if (room.zoneOwnerUid) {
    const owner = await resolveUserByAnyId(ctx, String(room.zoneOwnerUid));
    if (owner?._id && String(owner._id) !== leaving) {
      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: "match.walkin_replacement_needed",
        toUid: owner._id,
        status: "pending",
        recipientRole: "zone_admin",
        dedupeKey: `match.walkin_replacement_needed:${mIdStr}:${leaving}:${String(owner._id)}`,
        dedupePolicy: "upsert_active",
        matchroomId,
        route,
        title: "Walk-in replacement needed",
        body: "A player left close to match time. Please try to accommodate one walk-in player for this matchroom.",
        data: { matchroomId: mIdStr, leavingUid: leaving, href: route },
      });
    }
  }
}

// Leave matchroom
export const leave = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    uid: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new Error("Matchroom not found");
    const actor = await requireVerifiedActor(ctx, args.uid);
    if (String(actor.convexUser._id) !== String(args.uid)) {
      throw new Error("You can only leave as yourself.");
    }

    if (isLeaveLocked(room)) {
      throw new Error(MATCHROOM_LOCKED_MESSAGE);
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

    await syncMatchroomMembers(ctx, args.matchroomId, updatedUids);

    // Only when a player actually left (a seat opened), consider urgent replacement.
    if (updatedPlayers.length < room.players.length) {
      await notifyUrgentReplacementOnLeave(ctx, room, args.matchroomId, args.uid);
    }

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
    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new Error("Matchroom not found");
    await requireRoomActor(ctx, room, args.status === "cancelled" ? ["host", "captain", "zoneOwner"] : ["host", "captain"]);

    if (args.status === "in-progress") {
      const validation = canStartMatchroom(room, Date.now());
      if (!validation.ok) {
        if (shouldExpireForNotFull(room, Date.now())) {
          await expireMatchroomForInvalidLifecycle(ctx, args.matchroomId, room, "scheduled_start_roster_incomplete");
        }
        throw new Error(`Matchroom cannot start: ${validation.reason}`);
      }
      updateData.startTime = room.startTime || room.scheduledStartAt || Date.now();
      updateData.startedAt = Date.now();
      updateData.startedWithFullRoster = true;
      updateData.startedPlayerCount = getConfirmedPlayerCount(room);
      updateData.captainUidA = room.captainUidA || room.hostUid;
    }
    if (args.status === "completed") {
      const validation = canCompleteMatchroom(room, Date.now());
      if (!validation.ok) {
        throw new Error(`Matchroom cannot complete: ${validation.reason}`);
      }
      const captains = room ? resolveResultCaptains(room, room.resultVerification) : { team1Captain: "", team2Captain: "" };
      if (!captains.team1Captain || !captains.team2Captain) {
        throw new Error("Matchroom cannot complete: missing_result_captains");
      }
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
      await captureHeldBookingIntentsForMatchroom(ctx, args.matchroomId);
      await payVenueWalletForCompletedMatchroom(ctx, args.matchroomId, completedRoom);
    }
    if (args.status === "cancelled" || args.status === "expired") {
      await expireBookingIntentsForMatchroom(ctx, args.matchroomId, `matchroom_${args.status}`);
      await expirePendingMatchroomNotifications(ctx, args.matchroomId, `matchroom_${args.status}`);
      await releaseHeldBookingIntentsForMatchroom(ctx, args.matchroomId, `matchroom_${args.status}`);
      await refundCapturedBookingIntentsForMatchroom(ctx, args.matchroomId, `matchroom_${args.status}`);
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
    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new Error("Matchroom not found");
    const actor = await requireVerifiedActor(ctx, args.hostUid);
    if (String(actor.convexUser._id) !== String(args.hostUid)) throw new Error("You can only start as yourself.");
    await requireRoomActor(ctx, room, ["host", "captain"]);
    const validation = canStartMatchroom(room, Date.now());
    if (!validation.ok) {
      if (shouldExpireForNotFull(room, Date.now())) {
        await expireMatchroomForInvalidLifecycle(ctx, args.matchroomId, room, "scheduled_start_roster_incomplete");
      }
      throw new Error(`Matchroom cannot start: ${validation.reason}`);
    }
    const startTime = room.startTime || room.scheduledStartAt || Date.now();
    await ctx.db.patch(args.matchroomId, {
      status: "in-progress",
      startTime,
      startedAt: Date.now(),
      startedWithFullRoster: true,
      startedPlayerCount: getConfirmedPlayerCount(room),
      captainUidA: args.hostUid,
      captainUidB: args.team2Captain,
      updatedAt: Date.now(),
    });
    await captureHeldBookingIntentsForMatchroom(ctx, args.matchroomId);

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
    const actor = await requireVerifiedActor(ctx, args.captainUid);
    if (String(actor.convexUser._id) !== String(args.captainUid)) throw new Error("You can only submit your own captain report.");
    if (room.status !== "completed") throw new Error("Results can only be submitted after match completion");
    const verificationValidation = canEnterResultVerification(room);
    if (!verificationValidation.ok) {
      return await markInvalidResultVerificationForAdminReview(
        ctx,
        args.matchroomId,
        room,
        verificationValidation.reason,
      );
    }

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

    if (nextRv.status === "participant_vote") {
      await notifyResultDisputed(ctx, room, args.matchroomId);
    }

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
    const actor = await requireVerifiedActor(ctx, args.participantUid);
    if (String(actor.convexUser._id) !== String(args.participantUid)) throw new Error("You can only submit your own vote.");
    const verificationValidation = canEnterResultVerification(room);
    if (!verificationValidation.ok) {
      return await markInvalidResultVerificationForAdminReview(
        ctx,
        args.matchroomId,
        room,
        verificationValidation.reason,
      );
    }

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

// Super-admin resolution of a disputed / admin_review result. Routes through the
// single finalize chokepoint with source "admin_resolved" so ELO is applied with
// the reduced admin K-factor (audit A-I6 — previously admin_review was a dead end
// that never finalized or rated). Only a super-admin may call this.
export const resolveMatchroomResultByAdmin = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    winner: v.union(v.literal("team1"), v.literal("team2")),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new Error("Matchroom not found");

    const rv = room.resultVerification || { status: "pending" as const };
    if (rv.status === "resolved") {
      return { ok: true, status: "resolved", winner: rv.finalWinner };
    }

    return await finalizeMatchroomResult(
      ctx,
      args.matchroomId,
      room,
      rv,
      args.winner,
      "admin_resolved",
    );
  },
});

export const getPendingResultForUser = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireCurrentUser(ctx);
    const identity = actor.user;
    const uidCandidates = Array.from(
      new Set([
        String(actor.user._id),
        actor.user.authId,
        actor.identity?.tokenIdentifier,
        actor.identity?.subject,
      ].filter(Boolean).map(String)),
    );

    const completedRooms = await ctx.db
      .query("matchrooms")
      .withIndex("by_status", (q: any) => q.eq("status", "completed"))
      .collect();

    for (const room of completedRooms) {
      const participantUids = getMatchroomPlayerUids(room);
      const isParticipant = participantUids.some((uid) => uidCandidates.includes(String(uid)));
      if (!isParticipant) continue;
      if (!canEnterResultVerification(room).ok) continue;

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
// Shared admin-cancellation logic. Callers MUST authorize the actor before invoking
// this (the public `adminCancel` mutation below and the super-admin-gated report
// moderation wrapper in `admin.ts` both do). Cancels the room, expires/refunds any
// booking intents, and notifies every player.
export async function performAdminCancel(
  ctx: any,
  args: {
    matchroomId: Id<"matchrooms">;
    adminUid: string;
    reason: string;
    note?: string;
  },
) {
  const room = await ctx.db.get(args.matchroomId);
  if (!room) throw new Error("Matchroom not found");

  if (room.status === "cancelled") {
    return { ok: true, message: "Matchroom is already cancelled.", alreadyCancelled: true };
  }

  await ctx.db.patch(args.matchroomId, {
    status: "cancelled",
    isLocked: true,
    cancelledBy: args.adminUid,
    cancelledAt: Date.now(),
    cancelReason: args.reason,
    cancelNote: args.note || "",
    updatedAt: Date.now(),
  });
  await expireBookingIntentsForMatchroom(ctx, args.matchroomId, "admin_cancel");
  await expirePendingMatchroomNotifications(ctx, args.matchroomId, "admin_cancel");
  await releaseHeldBookingIntentsForMatchroom(ctx, args.matchroomId, "admin_cancel");
  await refundCapturedBookingIntentsForMatchroom(ctx, args.matchroomId, "admin_cancel");

  // Create notifications for all players
  for (const uid of room.playerUids) {
    const users = await ctx.db
      .query("users")
      .withIndex("by_authId", (q: any) => q.eq("authId", uid))
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

  return { ok: true, message: "Lobby cancelled and players notified.", alreadyCancelled: false };
}

export const adminCancel = mutation({
  args: {
    matchroomId: v.id("matchrooms"),
    adminUid: v.string(),
    reason: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    return await performAdminCancel(ctx, args);
  },
});

// Delete matchroom
export const remove = mutation({
  args: { matchroomId: v.id("matchrooms") },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.matchroomId);
    if (!room) throw new Error("Matchroom not found");
    await requireRoomActor(ctx, room, ["host"]);
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
    await requireRoomActor(ctx, room, ["host", "captain"]);

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
    await syncMatchroomMembers(ctx, args.matchroomId, playerUids);
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
    const verified = await requireVerifiedActor(ctx, args.fromUid);
    if (String(verified.convexUser._id) !== String(args.fromUid)) throw new Error("You can only invite as yourself.");
    if (isRoomExpired(room)) throw new Error("This matchroom has expired.");
    if (isJoinLocked(room)) throw new Error("This matchroom is locked.");

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

    // Super Admin / hidden accounts are not players and cannot be invited
    // (defense-in-depth: they never surface in discovery/search/invites either).
    const invitee = await ctx.db.get(args.toUid);
    if (!invitee || isUserHiddenFromPublic(invitee)) {
      throw new Error("This user is not available.");
    }

    const entityKey = `match.seat_invite:${args.matchroomId}:${args.toUid}:${args.slotId}`;
    const now = Date.now();
    const expiresAt = getCappedMatchroomExpiryOrThrow(room, INVITE_TTL_MS, "Seat invite", now);

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
      expiresAt,
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

    // Only host/captain/zoneOwner may trigger lifecycle transitions. For any
    // other viewer (participant or public viewer opening a discoverable room)
    // we no-op silently so opening the matchroom does not surface a raw
    // "Not authorized" error. Server sweeps still progress lifecycle for rooms
    // without privileged opens.
    const actor = await requireCurrentUser(ctx);
    const actorId = String(actor.user._id);
    const isHost = String(room.hostUid || "") === actorId;
    const isCaptain =
      isHost ||
      String(room.captainUidA || "") === actorId ||
      String(room.captainUidB || "") === actorId;
    let isZoneOwner = false;
    if (room.zoneId) {
      const zone = await ctx.db.get(room.zoneId as Id<"zones">);
      isZoneOwner = String(zone?.ownerUid || "") === actorId;
    }
    if (!isHost && !isCaptain && !isZoneOwner) {
      return { changed: false, skipped: "unauthorized" as const };
    }
    assertKycAccessAllowed(actor.user, KYC_VERIFICATION_REQUIRED_MESSAGE);

    const now = Date.now();
    const scheduledStartAt = room.scheduledStartAt || room.startTime;
    const durationMinutes = Math.max(1, Number(room.durationMinutes || 60));
    let changed = false;

    if (shouldExpireForNotFull(room, now)) {
      await expireMatchroomForInvalidLifecycle(ctx, args.matchroomId, room, "scheduled_start_roster_incomplete");
      changed = true;
      return { changed, status: "expired" };
    }

    if (shouldExpireInProgressRoom(room, now)) {
      await expireMatchroomForInvalidLifecycle(ctx, args.matchroomId, room, "in_progress_roster_incomplete");
      changed = true;
      return { changed, status: "expired" };
    }

    const startValidation = canStartMatchroom(room, now);
    if (startValidation.ok) {
      await ctx.db.patch(args.matchroomId, {
        status: "in-progress",
        startTime: room.startTime || scheduledStartAt,
        startedAt: now,
        startedWithFullRoster: true,
        startedPlayerCount: getConfirmedPlayerCount(room),
        captainUidA: room.captainUidA || room.hostUid,
        updatedAt: now,
      });
      changed = true;
    }

    const refreshedRoom = changed ? await ctx.db.get(args.matchroomId) : room;
    if (!refreshedRoom) return { changed };

    const effectiveStart = refreshedRoom.startTime || refreshedRoom.scheduledStartAt;
    const completeDue =
      refreshedRoom.status === "in-progress" &&
      effectiveStart &&
      effectiveStart + durationMinutes * 60 * 1000 <= now;
    const completeValidation = canCompleteMatchroom(refreshedRoom, now);
    const shouldComplete = completeValidation.ok;

    if (completeDue && !completeValidation.ok) {
      await expireMatchroomForInvalidLifecycle(
        ctx,
        args.matchroomId,
        refreshedRoom,
        `invalid_in_progress_${completeValidation.reason}`,
      );
      return { changed: true, status: "expired" };
    }

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

      if ((!refreshedRoom.captainUidA && !refreshedRoom.hostUid) || !teamTwoCaptain) {
        await markInvalidResultVerificationForAdminReview(
          ctx,
          args.matchroomId,
          refreshedRoom,
          "missing_result_captains",
        );
        return { changed: true, status: "admin_review" };
      }

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
      await captureHeldBookingIntentsForMatchroom(ctx, args.matchroomId);
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
    if (isJoinLocked(room)) throw new Error("This matchroom is locked.");
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
      const existingData = existingPendingRequest.data as any;
      const existingExpiresAt =
        existingPendingRequest.expiresAt ||
        getCappedMatchroomExpiryOrThrow(room, JOIN_REQUEST_TTL_MS, "Join request", now);
      const pendingIntentId = await createPendingApprovalBookingIntent(ctx, {
        room,
        createdByUid: actor.convexUser._id,
        createdByUsername: args.fromUsername,
        role,
        targetTeam,
        requestedSlotId: args.slotId || existingData?.slotId || null,
        sourceNotificationId: existingPendingRequest._id,
        expiresAt: existingExpiresAt,
      });

      return {
        ok: true,
        alreadyPending: true,
        joined: false,
        notificationIds: [existingPendingRequest._id],
        intentId: pendingIntentId,
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
    const requiresAllCaptainApproval = ratingDiff > SKILL_JOIN_DELTA;

    const captainUids = getAvailableCaptainUids(room);
    if (captainUids.length === 0) {
      throw new Error("No available captains found for this matchroom.");
    }

    const expiresAt = getCappedMatchroomExpiryOrThrow(room, JOIN_REQUEST_TTL_MS, "Join request", now);
    const createdNotificationIds: Id<"notifications">[] = [];
    const approvalCaptainUids = requiresAllCaptainApproval ? captainUids : [captainUids[0]];
    for (const captainUid of approvalCaptainUids) {
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
          approvalRequired: requiresAllCaptainApproval,
          requiredCaptainUids: approvalCaptainUids,
          requesterUid: actorUid,
          requesterRating: requesterSkill.rating,
          requesterSkillTier: requesterSkill.tier || null,
          roomAverageRating: skillStats.avgSkillScoreLive,
          ratingDifference: ratingDiff,
          href: `/matchrooms/${String(args.matchroomId)}`,
        },
        expiresAt,
      });
      createdNotificationIds.push(notificationResult.notificationId);
    }

    if (!createdNotificationIds.length) {
      throw new Error("No available captains found for this matchroom.");
    }

    const pendingIntentId = await createPendingApprovalBookingIntent(ctx, {
      room,
      createdByUid: actor.convexUser._id,
      createdByUsername: args.fromUsername,
      role,
      targetTeam,
      requestedSlotId: args.slotId || null,
      sourceNotificationId: createdNotificationIds[0],
      expiresAt,
    });

    return {
      ok: true,
      approvalRequested: true,
      joined: false,
      message: requiresAllCaptainApproval
        ? "Your rating is outside the allowed range. All available captains must approve this join request."
        : "Your join request has been sent to the captain for approval.",
      notificationIds: createdNotificationIds,
      intentId: pendingIntentId,
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
    if (isJoinLocked(room) || (room.currentPlayers || 0) >= room.maxPlayers) {
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
    const paymentExpiresAt = getCappedMatchroomExpiryOrThrow(room, PAYMENT_INTENT_TTL_MS, "Payment intent", now);
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
      title: "Payment required",
      body: `Your invite to ${room.title} was accepted. Pay now to confirm your slot.`,
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
      expiresAt: paymentExpiresAt,
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
      const paymentExpiresAt = getCappedMatchroomExpiryOrThrow(room, PAYMENT_INTENT_TTL_MS, "Payment intent", now);

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
        title: "Payment required",
        body: `Your request for ${room.title} was accepted. Pay now to confirm your slot.`,
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
        expiresAt: paymentExpiresAt,
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
    const paymentExpiresAt = getCappedMatchroomExpiryOrThrow(room, PAYMENT_INTENT_TTL_MS, "Payment intent", now);

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
      title: "Payment required",
      body: `Your request for ${room.title} was accepted. Pay now to confirm your slot.`,
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
      expiresAt: paymentExpiresAt,
    });
    await ctx.db.patch(intentId, {
      sourceNotificationId: paymentNotificationResult.notificationId,
      updatedAt: now,
    });

    return { ok: true, message: "All captains approved. The player must now pay to confirm the slot." };
  },
});

async function confirmMatchroomSeatIntentForUser(
  ctx: any,
  args: {
    intentId: Id<"bookingIntents">;
    userId: Id<"users">;
    externalPaymentReference?: string;
  },
) {
    const payer = await ctx.db.get(args.userId);
    if (!payer) throw new Error("User profile not found.");
    const payerUid = String(payer._id);
    const intent = await ctx.db.get(args.intentId);
    if (!intent) throw new Error("Booking intent not found");
    if (String(intent.createdByUid) !== payerUid) {
      throw new Error("You can only pay for your own slot.");
    }
    const payerUsername =
      intent.createdByUsername || payer.username || payer.fullName || "Player";
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
        toUid: payer._id,
        fromUid: payer._id,
        fromUsername: payerUsername,
        status: "expired",
        dedupeKey: `match.payment_result:${String(args.intentId)}:expired`,
        dedupePolicy: "replace_active",
        matchroomId: intent.matchroomId,
        route: `/matchrooms/${String(intent.matchroomId)}`,
        title: "Payment expired",
        body: "Your payment window expired before the slot was confirmed. Start a new payment if the slot is still available.",
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
        toUid: payer._id,
        fromUid: payer._id,
        fromUsername: payerUsername,
        status: "expired",
        dedupeKey: `match.payment_result:${String(args.intentId)}:slot_unavailable`,
        dedupePolicy: "replace_active",
        matchroomId: intent.matchroomId,
        route: `/matchrooms/${String(intent.matchroomId)}`,
        title: "Payment expired",
        body: "This slot is no longer available, so the pending payment was closed. Choose another slot to continue.",
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
    if (isJoinLocked(room)) {
      throw new Error("This matchroom is locked.");
    }

    const amount = Number(intent.pricing?.totalCost || room.pricing?.perPlayer || 0);
    const walletBalance = Number(payer.walletBalance || 0);
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
    const holdReference = getBookingHoldReference(args.intentId, args.externalPaymentReference);
    await ctx.runMutation(internal.wallet.holdFunds, {
      userId: payer._id,
      amount,
      reference: holdReference,
      metadata: {
        source: "booking_intent_payment_hold",
        provider: isExternalPayment ? "easypaisa" : "matchhai_wallet",
        externalPaymentReference: args.externalPaymentReference || null,
        matchroomId: String(room._id),
        slotId,
        intentId: String(args.intentId),
      },
    });

    const captureSchedule = await scheduleBookingHoldCapture(ctx, args.intentId, room);
    await ctx.db.patch(intent.matchroomId, rosterPatch.patch);
    await syncMatchroomMembers(
      ctx,
      intent.matchroomId,
      (rosterPatch.patch.playerUids || []) as string[],
    );
    await ctx.db.patch(args.intentId, {
      status: "confirmed",
      paymentStatus: "paid",
      heldStatus: "held",
      heldReference: holdReference,
      heldAmount: amount,
      heldCreatedAt: now,
      captureScheduledAt: captureSchedule.captureScheduledAt,
      captureScheduledFnId: captureSchedule.captureScheduledFnId,
      updatedAt: now,
    });
    if (intent.sourceNotificationId) {
      await ctx.db.patch(intent.sourceNotificationId, {
        status: "accepted",
        updatedAt: now,
      });
    }
    await closePendingJoinRequestsForJoinedUser(ctx, intent.matchroomId, payerUid, now);

    const relatedPaymentNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_toUid", (q: any) => q.eq("toUid", payer._id))
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
      toUid: payer._id,
      fromUid: payer._id,
      fromUsername: payerUsername,
      status: "accepted",
      dedupeKey: `match.payment_result:${String(args.intentId)}:paid`,
      dedupePolicy: "replace_active",
      matchroomId: intent.matchroomId,
      route: `/matchrooms/${String(intent.matchroomId)}`,
      title: "Payment successful",
      body: `Your payment was received. Your slot for ${room.title} is now confirmed.`,
      data: {
        intentId: String(args.intentId),
        matchroomId: String(intent.matchroomId),
        matchroomTitle: room.title,
        orderRefNum: String(args.externalPaymentReference || "").startsWith("easypaisa:")
          ? String(args.externalPaymentReference).replace(/^easypaisa:/, "")
          : null,
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
}

export const payMatchroomSeatIntent = mutation({
  args: {
    intentId: v.id("bookingIntents"),
    userId: v.optional(v.id("users")),
    externalPaymentReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireVerifiedActor(ctx, args.userId ? String(args.userId) : undefined);
    return await confirmMatchroomSeatIntentForUser(ctx, {
      intentId: args.intentId,
      userId: actor.convexUser._id,
      externalPaymentReference: args.externalPaymentReference,
    });
  },
});

export const confirmPaidMatchroomSeatIntentFromProvider = internalMutation({
  args: {
    intentId: v.id("bookingIntents"),
    userId: v.id("users"),
    externalPaymentReference: v.string(),
  },
  handler: async (ctx, args) => {
    return await confirmMatchroomSeatIntentForUser(ctx, args);
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
    const verified = await requireVerifiedActor(ctx, args.callerUid);
    if (String(verified.convexUser._id) !== String(args.callerUid)) throw new Error("You can only act as yourself.");

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
    await syncMatchroomMembers(ctx, args.matchroomId, updatedUids);

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
    const verified = await requireVerifiedActor(ctx, args.callerUid);
    if (String(verified.convexUser._id) !== String(args.callerUid)) throw new Error("You can only act as yourself.");

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
    const actor = await requireCurrentUser(ctx);
    if (String(actor.user._id) !== String(args.userUid)) throw new Error("Not authorized");
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
    if (matchroom && shouldExpireForNotFull(matchroom, Date.now())) {
      return await expireMatchroomForInvalidLifecycle(ctx, args.matchroomId, matchroom, "matchroom_expired");
    }
    return { changed: false, reason: "not_expirable" };
  },
});

export const runLifecycleSweep = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = Math.max(1, Math.min(50, Number(args.batchSize || 25)));
    const now = Date.now();
    let changedRooms = 0;
    let expiredNotifications = 0;
    let inspectedRooms = 0;

    for (const status of ["open", "locked", "in-progress", "completed"]) {
      const rooms = await ctx.db
        .query("matchrooms")
        .withIndex("by_status", (q: any) => q.eq("status", status))
        .take(batchSize);

      for (const room of rooms) {
        inspectedRooms += 1;
        if (shouldExpireForNotFull(room, now)) {
          const result = await expireMatchroomForInvalidLifecycle(
            ctx,
            room._id,
            room,
            "scheduled_start_roster_incomplete",
          );
          if (result.changed) changedRooms += 1;
          continue;
        }

        if (
          room.locationMode === "broadcast" &&
          !room.venueConfirmedAt &&
          !room.confirmedZoneId &&
          !["zone_confirmed", "failed", "expired", "cancelled"].includes(String(room.broadcastRequestStatus || ""))
        ) {
          const lockAt = getRoomLockAtMs(room);
          const isPastLockAt = typeof lockAt === "number" && lockAt <= now;

          if (room.broadcastRequestStatus === "waiting_for_fill" || room.broadcastRequestStatus === "idle") {
            const result = isPastLockAt
              ? await finalizeBroadcastFailure(ctx, room._id, "no_zone_response")
              : await dispatchBroadcastZoneRequestsForMatchroom(ctx, room._id);
            if ((result as any).changed || (result as any).dispatched) changedRooms += 1;
          } else if (
            room.broadcastRequestStatus === "waiting_for_zones" &&
            Number(room.broadcastRequestExpiresAt || 0) > 0 &&
            Number(room.broadcastRequestExpiresAt) <= now
          ) {
            const result = await finalizeBroadcastFailure(ctx, room._id, "no_zone_response");
            if ((result as any).changed) changedRooms += 1;
          }
        }

        if (room.status === "open" || room.status === "locked") {
          await maybeSendMatchroomReminders(ctx, room, now);
        }

        if (room.status === "in-progress") {
          if (shouldExpireInProgressRoom(room, now)) {
            const result = await expireMatchroomForInvalidLifecycle(
              ctx,
              room._id,
              room,
              "in_progress_roster_incomplete",
            );
            if (result.changed) changedRooms += 1;
            continue;
          }
          const durationMinutes = Math.max(1, Number(room.durationMinutes || 60));
          const startMs = getScheduleRoomStartMs(room);
          const completeDue = Boolean(startMs && startMs + durationMinutes * 60 * 1000 <= now);
          const validation = canCompleteMatchroom(room, now);
          if (completeDue && !validation.ok) {
            const result = await expireMatchroomForInvalidLifecycle(
              ctx,
              room._id,
              room,
              `invalid_in_progress_${validation.reason}`,
            );
            if (result.changed) changedRooms += 1;
          }
          continue;
        }

        if (room.status === "completed") {
          const rv: any = room.resultVerification || {};
          const validation = canEnterResultVerification(room);
          if (rv.status !== "resolved" && rv.status !== "admin_review" && !validation.ok) {
            await markInvalidResultVerificationForAdminReview(
              ctx,
              room._id,
              room,
              validation.reason,
            );
            changedRooms += 1;
          } else if (validation.ok && (!rv.status || rv.status === "pending")) {
            // Result verification is open and valid — remind captains to report.
            await maybeSendResultVerificationRequired(ctx, room);
          }
        }
      }
    }

    const pendingNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_status", (q: any) => q.eq("status", "pending"))
      .take(batchSize);
    for (const notification of pendingNotifications) {
      if (!isMatchJoinRequestNotification(notification)) continue;
      if (!notification.expiresAt || notification.expiresAt > now) continue;
      await ctx.db.patch(notification._id, {
        status: "expired",
        updatedAt: now,
        data: {
          ...(notification.data || {}),
          expiredReason: "join_request_ttl_elapsed",
        },
      });
      expiredNotifications += 1;
    }

    return { inspectedRooms, changedRooms, expiredNotifications };
  },
});

export const captureBookingIntentHold = internalMutation({
  args: { intentId: v.id("bookingIntents") },
  handler: async (ctx, args) => {
    const intent = await ctx.db.get(args.intentId);
    if (!intent || intent.heldStatus !== "held" || !intent.heldReference) {
      return { captured: false, reason: "not_held" };
    }

    const room = await ctx.db.get(intent.matchroomId);
    if (!room) {
      return await releaseBookingIntentHold(ctx, intent, "missing_matchroom");
    }
    if (room.status === "cancelled" || room.status === "expired") {
      return await releaseBookingIntentHold(ctx, intent, `matchroom_${room.status}`);
    }

    const amount = Number(intent.heldAmount || intent.pricing?.totalCost || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { captured: false, reason: "invalid_amount" };
    }

    const captureReference = getBookingCaptureReference(args.intentId);
    await ctx.runMutation(internal.wallet.captureHeldFunds, {
      userId: intent.createdByUid,
      amount,
      reference: captureReference,
      originalHoldReference: intent.heldReference,
      metadata: {
        source: "booking_hold_capture",
        intentId: String(args.intentId),
        matchroomId: String(intent.matchroomId),
      },
    });

    const now = Date.now();
    await ctx.db.patch(args.intentId, {
      heldStatus: "captured",
      heldCapturedAt: now,
      updatedAt: now,
    });

    await maybeMarkMerchantCapturedAfterHoldCapture(ctx, intent.matchroomId);
    return { captured: true, reference: captureReference, amount };
  },
});

export const releaseBookingIntentHoldForReason = internalMutation({
  args: {
    intentId: v.id("bookingIntents"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const intent = await ctx.db.get(args.intentId);
    return await releaseBookingIntentHold(ctx, intent, args.reason);
  },
});

export const releaseHoldsForMatchroom = internalMutation({
  args: {
    matchroomId: v.id("matchrooms"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    return await releaseHeldBookingIntentsForMatchroom(ctx, args.matchroomId, args.reason);
  },
});

export const refundCapturedHoldsForMatchroom = internalMutation({
  args: {
    matchroomId: v.id("matchrooms"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    return await refundCapturedBookingIntentsForMatchroom(ctx, args.matchroomId, args.reason);
  },
});
