// Phase 1A/D — game team config & canonicalization (fc25 -> fc26).
import { getGameConfig, getGameFields, GAME_TEAM_CONFIG } from "../../constants/matchConfig";

describe("getGameConfig", () => {
  it("returns the config for known games", () => {
    expect(getGameConfig("valorant").maxTeamSize).toBe(5);
    expect(getGameConfig("cs2").formats).toContain("5v5");
    expect(getGameConfig("tekken8").maxTeamSize).toBe(2);
  });

  it("canonicalizes fc25 to fc26 config", () => {
    expect(getGameConfig("fc25")).toBe(GAME_TEAM_CONFIG.fc26);
    expect(getGameConfig("fc26")).toBe(GAME_TEAM_CONFIG.fc26);
  });

  it("exposes captain/member slot limits used by slot validation", () => {
    const cfg = getGameConfig("valorant");
    expect(cfg.captainMaxSlots).toBe(5);
    expect(cfg.memberMaxSlots).toBe(3);
    expect(cfg.maxTeamSize).toBeGreaterThanOrEqual(cfg.memberMaxSlots);
  });
});

describe("getGameFields", () => {
  it("returns maps/roles per game", () => {
    // getGameFields returns a per-game union; maps only exists on shooter configs.
    expect((getGameFields("valorant") as any).maps).toContain("Ascent");
    expect((getGameFields("cs2") as any).maps).toContain("Mirage");
  });

  it("canonicalizes fc25 fields to fc26", () => {
    expect(getGameFields("fc25")).toBe(getGameFields("fc26"));
  });
});
