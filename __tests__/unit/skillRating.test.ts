// Phase 1G — client-side skill projection helpers (initial rating + questionnaire).
// NOTE: dynamic match-result ELO is SERVER-AUTHORITATIVE (convex/ratingEngine.ts);
// the client only projects it. These tests cover the client calibration math only.
import {
  getTierFromRating,
  calculateScoreFromAnswers,
  calculateInitialRating,
  SKILL_THRESHOLDS,
} from "../../src/services/skillRatingService";

describe("getTierFromRating", () => {
  it("maps ratings to tiers at threshold boundaries", () => {
    expect(getTierFromRating(0)).toBe("Beginner");
    expect(getTierFromRating(SKILL_THRESHOLDS.BEGINNER)).toBe("Beginner"); // 30
    expect(getTierFromRating(SKILL_THRESHOLDS.BEGINNER + 1)).toBe("Casual");
    expect(getTierFromRating(SKILL_THRESHOLDS.CASUAL)).toBe("Casual"); // 50
    expect(getTierFromRating(SKILL_THRESHOLDS.INTERMEDIATE)).toBe("Intermediate"); // 70
    expect(getTierFromRating(SKILL_THRESHOLDS.ADVANCED)).toBe("Advanced"); // 85
    expect(getTierFromRating(SKILL_THRESHOLDS.PRO)).toBe("Pro"); // 95
    expect(getTierFromRating(100)).toBe("Elite");
  });
});

describe("calculateScoreFromAnswers (valorant)", () => {
  it("returns null when a required answer is missing", () => {
    expect(
      calculateScoreFromAnswers("valorant", { recent_rank: 3, match_performance: 3 } as any),
    ).toBeNull();
  });

  it("scores a high total as Advanced/Elite", () => {
    const res = calculateScoreFromAnswers("valorant", {
      recent_rank: 5,
      match_performance: 5,
      game_sense: 5,
    });
    expect(res).not.toBeNull();
    expect(["Advanced", "Elite"]).toContain(res!.tier);
  });

  it("caps an inflated score when recent_rank is the lowest (q1=1 => Casual cap)", () => {
    const res = calculateScoreFromAnswers("valorant", {
      recent_rank: 1,
      match_performance: 5,
      game_sense: 5,
    });
    expect(res!.tier).toBe("Casual");
    expect(res!.rating).toBe(45);
  });
});

describe("calculateInitialRating", () => {
  it("derives cs2 rating from FACEIT level", () => {
    const res = calculateInitialRating("cs2", { faceitSkillLevel: 9 } as any);
    expect(res.source).toBe("faceit");
    expect(res.rating).toBeGreaterThanOrEqual(85); // level 9 -> Pro band
  });

  it("returns the questionnaire default when no external data exists", () => {
    const res = calculateInitialRating("valorant", {} as any);
    expect(res.source).toBe("questionnaire");
    expect(res.rating).toBeGreaterThan(0);
    expect(res.rating).toBeLessThanOrEqual(100);
  });
});
