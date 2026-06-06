import { canInviteToMatchroomTeam } from "../../app/matchrooms/utils/matchroomLobbyState";

const identityMatches = (
  candidate: unknown,
  values: Array<string | null | undefined>,
) =>
  candidate != null &&
  values.some((value) => value != null && String(value) === String(candidate));

const makeRoom = (overrides: Record<string, unknown> = {}) =>
  ({
    hostUid: "host",
    captainUidA: "host",
    captainUidB: null,
    playerUids: ["host", "team-a-player"],
    slotsA: [],
    slotsB: [],
    ...overrides,
  }) as any;

describe("matchroom invite permissions", () => {
  it("allows a joined Team A player to invite into Team B while Team B has no captain", () => {
    expect(
      canInviteToMatchroomTeam(
        makeRoom(),
        "B",
        ["team-a-player"],
        identityMatches,
      ),
    ).toBe(true);
  });

  it("does not allow an outsider to invite into a captainless Team B", () => {
    expect(
      canInviteToMatchroomTeam(makeRoom(), "B", ["outsider"], identityMatches),
    ).toBe(false);
  });

  it("returns Team B invite control to its captain once assigned", () => {
    const room = makeRoom({
      captainUidB: "team-b-captain",
      playerUids: ["host", "team-a-player", "team-b-captain"],
    });

    expect(
      canInviteToMatchroomTeam(
        room,
        "B",
        ["team-a-player"],
        identityMatches,
      ),
    ).toBe(false);
    expect(
      canInviteToMatchroomTeam(
        room,
        "B",
        ["team-b-captain"],
        identityMatches,
      ),
    ).toBe(true);
  });

  it("continues allowing the host to invite into either team", () => {
    const room = makeRoom({ captainUidB: "team-b-captain" });

    expect(
      canInviteToMatchroomTeam(room, "A", ["host"], identityMatches),
    ).toBe(true);
    expect(
      canInviteToMatchroomTeam(room, "B", ["host"], identityMatches),
    ).toBe(true);
  });
});
