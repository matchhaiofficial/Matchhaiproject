// Phase 1A — selected game filtering / availability.
import {
  isPhysicalGameDisabled,
  isEnabledGameKey,
  DISABLED_PHYSICAL_GAME_KEYS,
} from "../../constants/gameAvailability";

describe("game availability", () => {
  it("flags disabled physical games (case/space insensitive)", () => {
    for (const key of DISABLED_PHYSICAL_GAME_KEYS) {
      expect(isPhysicalGameDisabled(key)).toBe(true);
      expect(isPhysicalGameDisabled(` ${key.toUpperCase()} `)).toBe(true);
      expect(isEnabledGameKey(key)).toBe(false);
    }
  });

  it("treats esports titles as enabled", () => {
    for (const key of ["cs2", "cs16", "valorant", "fc26", "tekken8"]) {
      expect(isPhysicalGameDisabled(key)).toBe(false);
      expect(isEnabledGameKey(key)).toBe(true);
    }
  });

  it("handles nullish input as enabled (no game key to disable)", () => {
    expect(isPhysicalGameDisabled(null)).toBe(false);
    expect(isPhysicalGameDisabled(undefined)).toBe(false);
  });

  it("filters a selected-games list down to enabled keys", () => {
    const selected = ["valorant", "futsal", "cs2", "padel"];
    expect(selected.filter(isEnabledGameKey)).toEqual(["valorant", "cs2"]);
  });
});
