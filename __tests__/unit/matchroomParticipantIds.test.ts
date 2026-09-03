import {
  getMatchroomSkillLookupUserIds,
  normalizeMatchroomParticipantIds,
} from "../../src/utils/matchroomParticipantIds";

describe("matchroom participant skill lookup IDs", () => {
  it("does not request skill scores for a public matchroom", () => {
    expect(
      getMatchroomSkillLookupUserIds({
        accessLevel: "public",
        players: [{ uid: "" }, { uid: "redacted-user-id" }],
      }),
    ).toEqual([]);
  });

  it("keeps unique non-empty participant IDs for full-access rooms", () => {
    expect(
      getMatchroomSkillLookupUserIds({
        accessLevel: "full",
        players: [
          { uid: " user-one " },
          { uid: "user-two" },
          { uid: "user-one" },
          { uid: "" },
          { uid: null },
        ],
      }),
    ).toEqual(["user-one", "user-two"]);
  });

  it("sanitizes malformed identifier lists before querying Convex", () => {
    expect(
      normalizeMatchroomParticipantIds([
        "",
        "   ",
        null,
        undefined,
        123,
        "valid-id",
        " valid-id ",
      ]),
    ).toEqual(["valid-id"]);
  });
});
