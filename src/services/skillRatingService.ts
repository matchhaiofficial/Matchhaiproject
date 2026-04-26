// src/services/skillRatingService.ts
import { convex } from '../lib/convex';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { SKILL_ASSESSMENT_CONFIG } from '../constants/skillQuestions';
import type { UserProfile } from './convex/userService';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type SkillTier = 'Beginner' | 'Casual' | 'Intermediate' | 'Advanced' | 'Pro' | 'Elite';

export interface GameSkillScore {
    // Current rating (0-100)
    rating: number;
    tier: SkillTier;

    // Stats
    matchesPlayed: number;
    wins: number;
    losses: number;

    // Initial calibration
    initialSource: 'faceit' | 'steam' | 'psn' | 'questionnaire';
    initialRating: number;

    // Timestamps
    lastMatchDate: number | null;
    lastUpdated: number;
}

export type GameKey = 'cs2' | 'cs16' | 'valorant' | 'tekken8' | 'fc26' | 'futsal' | 'indoor_cricket' | 'padel' | 'pickleball' | 'fc25';

function getCanonicalGameKey(gameKey: GameKey | string): GameKey {
    return (gameKey === 'fc25' ? 'fc26' : gameKey) as GameKey;
}

function getStoredSkillScore(profile: Pick<UserProfile, "skillScores"> | null | undefined, gameKey: GameKey) {
    const scores = profile?.skillScores as Record<string, GameSkillScore | undefined> | undefined;
    const canonicalGameKey = getCanonicalGameKey(gameKey);
    if (!scores) return null;
    if (canonicalGameKey === 'fc26') {
        return scores.fc26 || scores.fc25 || null;
    }
    return scores[canonicalGameKey] || null;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

export const SKILL_THRESHOLDS = {
    BEGINNER: 30,    // 0-30
    CASUAL: 50,
    INTERMEDIATE: 70,
    ADVANCED: 85,
    PRO: 95,
};

const DEFAULT_RATING = 45; // Intermediate by default

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

export function getTierFromRating(rating: number): SkillTier {
    if (rating <= SKILL_THRESHOLDS.BEGINNER) return 'Beginner';
    if (rating <= SKILL_THRESHOLDS.CASUAL) return 'Casual';
    if (rating <= SKILL_THRESHOLDS.INTERMEDIATE) return 'Intermediate';
    if (rating <= SKILL_THRESHOLDS.ADVANCED) return 'Advanced';
    if (rating <= SKILL_THRESHOLDS.PRO) return 'Pro';
    return 'Elite';
}

function clamp(num: number, min: number, max: number) {
    return Math.min(Math.max(num, min), max);
}

function clampRating(value: number) {
    return clamp(value, 0, 100);
}

// ═══════════════════════════════════════════════════════════════
// INITIAL RATING CALCULATION (0-100)
// ═══════════════════════════════════════════════════════════════

/**
 * Calculates a 0-100 skill score based on available profile data.
 * Prioritizes external APIs (Faceit, PSN, Steam).
 */
export function calculateInitialRating(
    gameKey: GameKey,
    userProfile: UserProfile
): { rating: number; source: GameSkillScore['initialSource'] } {
    const canonicalGameKey = getCanonicalGameKey(gameKey);
    let rating = DEFAULT_RATING;
    let source: GameSkillScore['initialSource'] = 'questionnaire';

    switch (canonicalGameKey) {
        case 'cs2': {
            // 1. FACEIT Level (1-10)
            if (userProfile.faceitSkillLevel) {
                const lvl = userProfile.faceitSkillLevel;
                // Map Level 1-10 to ~20-95
                if (lvl <= 3) rating = 25;       // Beginner
                else if (lvl <= 6) rating = 50;  // Intermediate
                else if (lvl <= 8) rating = 75;  // Advanced
                else rating = 90;                // Pro

                source = 'faceit';

                // Bonus for legacy users with High ELO but low level? Unlikely.
                // Add Steam hours bonus if available
                if (userProfile.steamCs2Hours) {
                    if (userProfile.steamCs2Hours > 1000) rating += 5;
                    else if (userProfile.steamCs2Hours > 3000) rating += 10;
                }

                return { rating: clamp(rating, 0, 100), source };
            }
            break;
        }

        case 'cs16': {
            break;
        }

        case 'valorant': {
            break;
        }

        case 'fc26': {
            // 1. PSN Hours / Progress
            if (userProfile.psnStats?.fc) {
                // If we have "progress" from trophies (0-100), use it as a base
                if (typeof userProfile.psnStats.fc.progress === 'number') {
                    rating = 20 + (userProfile.psnStats.fc.progress * 0.6); // Scale to 20-80 range
                    source = 'psn';
                }
            }
            // 2. Steam Hours
            if ((userProfile as any).steamFc26Hours) { // Assuming mapped in profile
                if ((userProfile as any).steamFc26Hours > 200) rating = Math.max(rating, 50);
                if ((userProfile as any).steamFc26Hours > 500) rating = Math.max(rating, 70);
                source = 'steam';
            }
            break;
        }

        case 'tekken8': {
            // 1. PSN
            if (userProfile.psnStats?.tekken8) {
                if (typeof userProfile.psnStats.tekken8.progress === 'number') {
                    rating = 20 + (userProfile.psnStats.tekken8.progress * 0.6);
                    source = 'psn';
                }
            }
            // 2. Tekken Rank (if we manually stored it)
            // ...
            break;
        }
    }

    // Default return if no external data found (will require Questions)
    return { rating: clamp(rating, 0, 100), source };
}

// ═══════════════════════════════════════════════════════════════
// QUESTIONNAIRE SCORING
// ═══════════════════════════════════════════════════════════════

export function calculateScoreFromAnswers(
    gameKey: string,
    answers: Record<string, number>
): { rating: number; tier: SkillTier } | null {
    if (gameKey === 'valorant') {
        const q1 = answers.recent_rank;
        const q2 = answers.match_performance;
        const q3 = answers.game_sense;
        if ([q1, q2, q3].some((value) => typeof value !== 'number')) return null;

        const totalScore = q1 + q2 + q3;
        let result: { rating: number; tier: SkillTier };

        if (totalScore <= 5) result = { rating: 20, tier: 'Beginner' };
        else if (totalScore <= 8) result = { rating: 45, tier: 'Casual' };
        else if (totalScore <= 11) result = { rating: 65, tier: 'Intermediate' };
        else if (totalScore <= 13) result = { rating: 82, tier: 'Advanced' };
        else result = { rating: 97, tier: 'Elite' };

        const capTier = (() => {
            let capped: SkillTier | null = null;
            if (q1 === 1) capped = 'Casual';
            else if (q1 === 2) capped = 'Intermediate';
            if (q2 === 1) capped = 'Casual';
            if (q3 === 1) capped = 'Casual';
            return capped;
        })();

        if (capTier) {
            const tierOrder: SkillTier[] = ['Beginner', 'Casual', 'Intermediate', 'Advanced', 'Pro', 'Elite'];
            if (tierOrder.indexOf(result.tier) > tierOrder.indexOf(capTier)) {
                const capRatings: Record<SkillTier, number> = {
                    Beginner: 20,
                    Casual: 45,
                    Intermediate: 65,
                    Advanced: 82,
                    Pro: 90,
                    Elite: 97,
                };
                result = { rating: capRatings[capTier], tier: capTier };
            }
        }

        return result;
    }

    const config = SKILL_ASSESSMENT_CONFIG[gameKey];
    if (!config) return null;

    let totalScore = 0;

    // Sum up values from selected options
    config.questions.forEach(q => {
        const val = answers[q.id];
        if (typeof val === 'number') {
            totalScore += val;
        }
    });

    // Match against thresholds
    // We assume thresholds are sorted by maxScore ascending
    for (const thresh of config.thresholds) {
        if (totalScore <= thresh.maxScore) {
            // The threshold.rating in config is expected to be 0-100 now.
            // If the existing config uses old values, we might need to interpret specifically.
            // As per instruction, we use the config's mapping.
            const normalizedRating = clampRating(thresh.rating);
            return {
                rating: normalizedRating,
                tier: thresh.tier
            };
        }
    }

    // Fallback if score exceeds all (Pro)
    return { rating: 90, tier: 'Pro' };
}

// ═══════════════════════════════════════════════════════════════
// DB OPERATIONS
// ═══════════════════════════════════════════════════════════════

export async function saveSelfAssessment(
    uid: string,
    gameKey: GameKey,
    answers: Record<string, number>
): Promise<{ ok: boolean; rating?: number; tier?: SkillTier }> {
    try {
        const canonicalGameKey = getCanonicalGameKey(gameKey);
        const result = calculateScoreFromAnswers(canonicalGameKey, answers);
        if (!result) return { ok: false };

        const normalizedRating = clampRating(result.rating);
        const normalizedTier = result.tier;

        const skillScore = {
            rating: normalizedRating,
            tier: normalizedTier,
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
            initialSource: 'questionnaire' as const,
            initialRating: normalizedRating,
            lastMatchDate: null as number | null,
            lastUpdated: Date.now(),
        };

        await convex.mutation(api.users.updateSkillScores, {
            userId: uid as Id<"users">,
            game: canonicalGameKey as any,
            skillScore,
        });

        return { ok: true, rating: normalizedRating, tier: normalizedTier };

    } catch (error) {
        console.error('[skillRatingService] saveSelfAssessment error:', error);
        return { ok: false };
    }
}

/**
 * Initializes a player's skill from external data (if possible) or sets a default.
 * Does NOT overwrite existing scores.
 */
export async function initializeSkillIfMissing(
    uid: string,
    gameKey: GameKey,
    userProfile: UserProfile
): Promise<GameSkillScore | null> {
    const canonicalGameKey = getCanonicalGameKey(gameKey);

    // Check if already exists locally in the passed profile to avoid read
    const existingSkill = getStoredSkillScore(userProfile, canonicalGameKey);
    if (existingSkill) {
        return existingSkill;
    }

    // Attempt to calculate from external data
    const { rating, source } = calculateInitialRating(canonicalGameKey, userProfile);
    const normalizedRating = clampRating(rating);

    // If source is 'questionnaire', it means we found no external data.
    // In that case, we DO NOT auto-save a default 45. We return null so the UI prompts the user.
    if (source === 'questionnaire') {
        return null;
    }

    // If we have real external data (FACEIT/Steam), we auto-save it.
    const tier = getTierFromRating(normalizedRating);
    const newScore: GameSkillScore = {
        rating: normalizedRating,
        tier,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        initialSource: source,
        initialRating: normalizedRating,
        lastMatchDate: null,
        lastUpdated: Date.now(),
    };

    try {
        await convex.mutation(api.users.updateSkillScores, {
            userId: uid as Id<"users">,
            game: canonicalGameKey as any,
            skillScore: newScore,
        });
        return newScore;
    } catch (e) {
        console.error("Failed to auto-init skill", e);
        return null; // Should handle gracefully
    }
}

// ═══════════════════════════════════════════════════════════════
// ELO / SKILL UPDATES (MATCH RESULTS)
// ═══════════════════════════════════════════════════════════════

/**
 * Valid types for match result
 */
export type MatchResultOutcome = 'win' | 'loss' | 'draw';

const BASE_K = 4; // Low K because range is small (0-100). Max delta ~4-5 points.
const PROVISIONAL_K = 8;
const PROVISIONAL_LIMIT = 20;

/**
 * Calculates ELO Delta based on expected score.
 * Formula: Expected = 1 / (1 + 10^((RatingB - RatingA)/40))
 * Divider is 40 (not 400) because our scale is 0-100.
 */
export function calculateRatingChange(
    currentRating: number,
    opponentRating: number,
    result: MatchResultOutcome,
    matchesPlayed: number,
    confidence: number = 1.0
): number {
    // 1. Determine K-Factor
    const K = matchesPlayed < PROVISIONAL_LIMIT ? PROVISIONAL_K : BASE_K;

    // Scale K by confidence
    const K_eff = K * confidence;

    // 2. Calculate Expected Score
    // Divisor 40 scales the 0-100 difference to traditional ELO's 0-1000 equivalent behavior
    const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - currentRating) / 40));

    // 3. Determine Actual Score
    let actualScore = 0.5;
    if (result === 'win') actualScore = 1;
    else if (result === 'loss') actualScore = 0;

    // 4. Calculate Delta
    // We round to nearest integer
    const delta = Math.round(K_eff * (actualScore - expectedScore));

    return delta;
}

export const applyMatchResult = async (
    matchId: string,
    gameKey: string,
    winnerSide: 'A' | 'B',
    sideA: string[], // Uids
    sideB: string[], // Uids
    confidence: number = 1.0
) => {
    try {
        const canonicalGameKey = getCanonicalGameKey(gameKey);
        const { getUserProfile } = await import('./convex/userService');

        // Fetch all profiles
        const allUids = [...sideA, ...sideB];
        const profiles: Record<string, UserProfile> = {};

        // We need existing ratings to calculate team averages
        for (const uid of allUids) {
            const res = await getUserProfile(uid as Id<"users">);
            if (res.ok && res.data) {
                profiles[uid] = res.data;
            }
        }

        // Helper to get rating safely
        const getRating = (uid: string): number => {
            const p = profiles[uid];
            if (!p || !p.skillScores) return 45;

            const scores = p.skillScores as any;
            const s = canonicalGameKey === 'fc26' ? (scores.fc26 || scores.fc25) : scores[canonicalGameKey];
            if (typeof s?.rating === 'number') {
                return clampRating(s.rating);
            }
            return 45;
        };

        // Calculate Team Averages
        const ratingA = sideA.reduce((sum, uid) => sum + getRating(uid), 0) / Math.max(1, sideA.length);
        const ratingB = sideB.reduce((sum, uid) => sum + getRating(uid), 0) / Math.max(1, sideB.length);

        // Build batch updates
        const updates = allUids.map(uid => {
            const isSideA = sideA.includes(uid);
            const userRating = getRating(uid);

            const p = profiles[uid];
            // Safe stats access
            let currentStats = { wins: 0, losses: 0, matchesPlayed: 0 };
            if (p && p.skillScores) {
                const scores = p.skillScores as any;
                const rawStats = canonicalGameKey === 'fc26' ? (scores.fc26 || scores.fc25) : scores[canonicalGameKey];
                if (rawStats) {
                    currentStats = {
                        wins: rawStats.wins || 0,
                        losses: rawStats.losses || 0,
                        matchesPlayed: rawStats.matchesPlayed || 0
                    };
                }
            }

            let result: MatchResultOutcome = 'draw';
            if (winnerSide === 'A') result = isSideA ? 'win' : 'loss';
            else if (winnerSide === 'B') result = isSideA ? 'loss' : 'win';

            const opponentRating = isSideA ? ratingB : ratingA;

            const delta = calculateRatingChange(userRating, opponentRating, result, currentStats.matchesPlayed, confidence);
            const newRating = Math.max(0, Math.min(100, userRating + delta)); // Clamp 0-100

            // Stats Update
            const newWins = currentStats.wins + (result === 'win' ? 1 : 0);
            const newLosses = currentStats.losses + (result === 'loss' ? 1 : 0);

            // Get existing initial values if present
            const existingScores = p?.skillScores as any;
            const existingScore = existingScores
                ? (canonicalGameKey === 'fc26' ? (existingScores.fc26 || existingScores.fc25) : existingScores[canonicalGameKey])
                : null;

            return {
                userId: uid as Id<"users">,
                game: canonicalGameKey,
                skillScore: {
                    rating: newRating,
                    tier: getTierFromRating(newRating),
                    wins: newWins,
                    losses: newLosses,
                    matchesPlayed: currentStats.matchesPlayed + 1,
                    initialSource: existingScore?.initialSource,
                    initialRating: existingScore?.initialRating,
                    lastMatchDate: Date.now(),
                    lastUpdated: Date.now(),
                },
            };
        });

        await convex.mutation(api.users.applyMatchSkillUpdates, {
            updates,
            matchroomId: matchId as Id<"matchrooms">,
        });

        return { ok: true };

    } catch (e) {
        console.error("Error applying skills", e);
        return { ok: false };
    }
};
