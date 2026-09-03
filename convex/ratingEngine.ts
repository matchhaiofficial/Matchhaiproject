// convex/ratingEngine.ts
//
// Server-authoritative, FACEIT-style dynamic ELO engine. PURE functions only —
// no Convex ctx, no DB access, no side effects — so the math is deterministic and
// unit-testable. All ELO calculation in the app MUST go through this module on the
// backend. Clients never compute or submit deltas.
//
// Scale: 1000-based internal ELO (classic divisor 400). The existing 0-100
// `rating`/`tier` fields remain the UI projection (see deriveRatingFromElo /
// getTierFromRating in src/services/skillRatingService.ts) for backward
// compatibility; `elo` is the source of truth.

// ───────────────────────────────────────────────────────────────────────────
// SCALE / CONVERSION
// ───────────────────────────────────────────────────────────────────────────

export const ELO_DIVISOR = 400;
export const DEFAULT_ELO = 1000; // == rating 50 under the conversion below
export const ELO_FLOOR = 100;
export const ELO_CEILING = 3000;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/** Seed ELO from a legacy 0-100 rating. rating 0→500, 50→1000, 100→1500. */
export function deriveEloFromRating(rating: number): number {
  const r = clamp(Number(rating), 0, 100);
  return clamp(500 + r * 10, ELO_FLOOR, ELO_CEILING);
}

/** Project an ELO back to the 0-100 display rating (inverse of the seed). */
export function deriveRatingFromElo(elo: number): number {
  const e = clamp(Number(elo), ELO_FLOOR, ELO_CEILING);
  return clamp((e - 500) / 10, 0, 100);
}

/**
 * ELO-based tier mapping (for future leaderboard use). NOTE: the app's visible
 * tier is still derived from the 0-100 `rating` via the existing helper to keep
 * UI behavior unchanged; this is provided for completeness/parity with the spec.
 */
export type EloTier =
  | "Beginner"
  | "Casual"
  | "Intermediate"
  | "Advanced"
  | "Pro"
  | "Elite";

export function tierFromElo(elo: number): EloTier {
  if (elo < 800) return "Beginner";
  if (elo < 1000) return "Casual";
  if (elo < 1200) return "Intermediate";
  if (elo < 1400) return "Advanced";
  if (elo < 1600) return "Pro";
  return "Elite";
}

// ───────────────────────────────────────────────────────────────────────────
// EXPECTED SCORE
// ───────────────────────────────────────────────────────────────────────────

/** Classic ELO expected score for `teamElo` against `opponentElo`. Range (0,1). */
export function expectedScore(teamElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - teamElo) / ELO_DIVISOR));
}

// ───────────────────────────────────────────────────────────────────────────
// MATCH CATEGORY → K-FACTOR + CAP
// ───────────────────────────────────────────────────────────────────────────

export type MatchCategory =
  | "competitive"
  | "normal"
  | "casual"
  | "walkin"
  | "admin"
  | "bot_short";

export type MatchOutcome = "win" | "loss" | "draw";

interface CategoryConfig {
  baseK: number;
  maxAbsDelta: number;
}

// Caps follow the approved spec. `admin` uses the general ±40 cap with a reduced K.
const CATEGORY_CONFIG: Record<MatchCategory, CategoryConfig> = {
  competitive: { baseK: 32, maxAbsDelta: 40 },
  normal: { baseK: 24, maxAbsDelta: 40 },
  casual: { baseK: 16, maxAbsDelta: 20 },
  walkin: { baseK: 12, maxAbsDelta: 20 },
  admin: { baseK: 14, maxAbsDelta: 40 },
  bot_short: { baseK: 10, maxAbsDelta: 12 },
};

export function getCategoryConfig(category: MatchCategory): CategoryConfig {
  return CATEGORY_CONFIG[category] || CATEGORY_CONFIG.normal;
}

/**
 * Resolve the player K-factor: base K for the category, adjusted by experience.
 * New/provisional (<10 matches): +25%. Established (>50 matches): -15%.
 */
export function resolvePlayerKFactor(
  category: MatchCategory,
  matchesPlayed: number,
): number {
  const base = getCategoryConfig(category).baseK;
  let k = base;
  if (matchesPlayed < 10) k = base * 1.25;
  else if (matchesPlayed > 50) k = base * 0.85;
  return k;
}

// ───────────────────────────────────────────────────────────────────────────
// PERSONALIZATION ADJUSTMENTS
// ───────────────────────────────────────────────────────────────────────────

/**
 * Individual adjustment relative to the player's OWN team average.
 * - Lower-than-team-average player winning → slightly MORE gain.
 * - Higher-than-team-average player winning → slightly LESS gain.
 * - Higher-than-team-average player losing → slightly MORE penalty.
 * Clamped to [0.85, 1.15].
 */
export function individualAdjustment(
  playerElo: number,
  teamAverageElo: number,
  outcome: MatchOutcome,
): number {
  if (outcome === "draw") return 1;
  const rel = playerElo - teamAverageElo; // >0 means stronger than own team
  // Scale: 1000 ELO above team → full 0.15 swing before clamping.
  const swing = rel / 1000;
  // win: stronger-than-team gains less (1 - swing); loss: stronger loses more (1 + swing).
  const factor = outcome === "win" ? 1 - swing : 1 + swing;
  return clamp(factor, 0.85, 1.15);
}

/**
 * Matchroom-average stabilizer relative to the whole room.
 * - Far below room average and wins → slight bonus.
 * - Far above room average and wins → slight reduction.
 * - High ELO losing in a low-average room → higher penalty.
 * Clamped to [0.9, 1.1].
 */
export function matchroomAdjustment(
  playerElo: number,
  matchroomAverageElo: number,
  outcome: MatchOutcome,
): number {
  if (outcome === "draw") return 1;
  const rel = playerElo - matchroomAverageElo; // >0 means stronger than room
  const swing = rel / 2000; // gentler than the individual factor
  const factor = outcome === "win" ? 1 - swing : 1 + swing;
  return clamp(factor, 0.9, 1.1);
}

// ───────────────────────────────────────────────────────────────────────────
// DELTA COMPUTATION
// ───────────────────────────────────────────────────────────────────────────

export interface PlayerDeltaInput {
  playerElo: number;
  teamAverageElo: number;
  opponentAverageElo: number;
  matchroomAverageElo: number;
  outcome: MatchOutcome;
  category: MatchCategory;
  matchesPlayed: number;
}

export interface PlayerDeltaResult {
  delta: number;
  expected: number;
  actual: number;
  kFactor: number;
  individualFactor: number;
  matchroomFactor: number;
}

function outcomeToActual(outcome: MatchOutcome): number {
  if (outcome === "win") return 1;
  if (outcome === "loss") return 0;
  return 0.5;
}

/**
 * Compute one player's ELO delta for a finalized match. FACEIT-style:
 * beating stronger teams gains more, losing to weaker teams loses more, etc.
 * Applies experience-weighted K, individual + matchroom personalization, then
 * clamps to the category cap and enforces a minimum meaningful change of ±1.
 */
export function computePlayerEloDelta(input: PlayerDeltaInput): PlayerDeltaResult {
  const expected = expectedScore(input.teamAverageElo, input.opponentAverageElo);
  const actual = outcomeToActual(input.outcome);
  const kFactor = resolvePlayerKFactor(input.category, input.matchesPlayed);
  const individualFactor = individualAdjustment(
    input.playerElo,
    input.teamAverageElo,
    input.outcome,
  );
  const matchroomFactor = matchroomAdjustment(
    input.playerElo,
    input.matchroomAverageElo,
    input.outcome,
  );

  const raw = kFactor * (actual - expected) * individualFactor * matchroomFactor;
  const cap = getCategoryConfig(input.category).maxAbsDelta;
  let delta = clamp(raw, -cap, cap);

  // Minimum meaningful change: a decisive (non-draw) result should move at least
  // ±1, in the direction of the raw delta. Draws can legitimately be 0.
  let rounded = Math.round(delta);
  if (rounded === 0 && input.outcome !== "draw" && raw !== 0) {
    rounded = raw > 0 ? 1 : -1;
  }
  delta = rounded;

  return { delta, expected, actual, kFactor, individualFactor, matchroomFactor };
}

/** Apply a delta to an ELO with global floor/ceiling clamping. */
export function applyEloDelta(currentElo: number, delta: number): number {
  return clamp(Math.round(currentElo + delta), ELO_FLOOR, ELO_CEILING);
}

// ───────────────────────────────────────────────────────────────────────────
// TEAM ELO
// ───────────────────────────────────────────────────────────────────────────

export const TEAM_ELO_K = 20; // within the approved 16-24 band
export const TEAM_ELO_MAX_ABS_DELTA = 30;

export interface TeamDeltaResult {
  delta: number;
  expected: number;
  actual: number;
  kFactor: number;
}

/**
 * Compute a team's ELO delta for a verified team-vs-team result. Smaller and more
 * tightly capped than player ELO to resist roster-churn abuse.
 */
export function computeTeamEloDelta(
  teamElo: number,
  opponentTeamElo: number,
  outcome: MatchOutcome,
): TeamDeltaResult {
  const expected = expectedScore(teamElo, opponentTeamElo);
  const actual = outcomeToActual(outcome);
  const raw = TEAM_ELO_K * (actual - expected);
  let delta = clamp(raw, -TEAM_ELO_MAX_ABS_DELTA, TEAM_ELO_MAX_ABS_DELTA);
  let rounded = Math.round(delta);
  if (rounded === 0 && outcome !== "draw" && raw !== 0) {
    rounded = raw > 0 ? 1 : -1;
  }
  return { delta: rounded, expected, actual, kFactor: TEAM_ELO_K };
}

// ───────────────────────────────────────────────────────────────────────────
// AVERAGES
// ───────────────────────────────────────────────────────────────────────────

export function average(values: number[]): number {
  if (!values.length) return DEFAULT_ELO;
  const sum = values.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0);
  return sum / values.length;
}
