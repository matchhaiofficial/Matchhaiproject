// Phase 1A — game key normalization & canonical labels.
import { getCanonicalGameLabel } from "../../src/utils/gameLabels";

describe("getCanonicalGameLabel", () => {
  it("maps known canonical keys (case/space insensitive)", () => {
    expect(getCanonicalGameLabel("cs2")).toBe("CS2");
    expect(getCanonicalGameLabel("CS2")).toBe("CS2");
    expect(getCanonicalGameLabel(" cs16 ")).toBe("CS 1.6");
    expect(getCanonicalGameLabel("valorant")).toBe("Valorant");
    expect(getCanonicalGameLabel("tekken8")).toBe("Tekken 8");
  });

  it("treats fc25 and fc26 as the same canonical FC26 label", () => {
    expect(getCanonicalGameLabel("fc25")).toBe("FC26");
    expect(getCanonicalGameLabel("fc26")).toBe("FC26");
  });

  it("falls back to uppercased key for unknown games", () => {
    expect(getCanonicalGameLabel("dota")).toBe("DOTA");
  });

  it("returns 'Game' for empty/nullish input", () => {
    expect(getCanonicalGameLabel("")).toBe("Game");
    expect(getCanonicalGameLabel(null)).toBe("Game");
    expect(getCanonicalGameLabel(undefined)).toBe("Game");
  });
});
