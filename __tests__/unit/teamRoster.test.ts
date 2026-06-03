// Phase 1D/H (teams) — team main-roster capacity/count display helpers.
import {
  getTeamMainDisplayCapacity,
  getTeamMainDisplayCount,
  getTeamMainDisplayRoster,
} from "../../src/utils/teamRosterDisplay";

describe("getTeamMainDisplayCapacity", () => {
  it("prefers an explicit mainRosterSize when valid", () => {
    expect(getTeamMainDisplayCapacity({ game: "valorant", mainRosterSize: 5 })).toBe(5);
  });
  it("falls back to game-based roster size", () => {
    const cap = getTeamMainDisplayCapacity({ game: "valorant" });
    expect(cap).toBeGreaterThan(0);
  });
  it("returns 0 for null team", () => {
    expect(getTeamMainDisplayCapacity(null)).toBe(0);
  });
});

describe("getTeamMainDisplayCount", () => {
  it("counts members but never exceeds capacity", () => {
    const team = {
      game: "valorant",
      mainRosterSize: 3,
      members: [
        { uid: "a", rosterRole: "main" },
        { uid: "b", rosterRole: "main" },
        { uid: "c", rosterRole: "main" },
        { uid: "d", rosterRole: "main" },
      ],
    };
    expect(getTeamMainDisplayCount(team)).toBe(3);
  });

  it("uses memberUids length when members array is absent", () => {
    expect(getTeamMainDisplayCount({ game: "valorant", mainRosterSize: 5, memberUids: ["a", "b"] })).toBe(2);
  });
});

describe("getTeamMainDisplayRoster", () => {
  it("computes a fill percentage in [0,100]", () => {
    const roster = getTeamMainDisplayRoster({ game: "valorant", mainRosterSize: 4, memberUids: ["a", "b"] });
    expect(roster.currentMembers).toBe(2);
    expect(roster.maxMembers).toBe(4);
    expect(roster.fillPercent).toBe(50);
  });
  it("is 0% for an empty team", () => {
    expect(getTeamMainDisplayRoster({ game: "valorant", mainRosterSize: 5, memberUids: [] }).fillPercent).toBe(0);
  });
});
