import {
  assertNewGameEntityCreationAllowed,
  isNewGameEntityCreationAllowed,
} from "../../convex/gameAvailabilityPolicy";

describe("server game availability policy", () => {
  it.each([
    "futsal",
    "indoor_cricket",
    "indoor cricket",
    "indoor-cricket",
    "cricket",
    "padel",
    "pickleball",
    "pickle ball",
    " PADEL ",
  ])(
    "blocks new hidden physical-game entities for %s",
    (game) => expect(isNewGameEntityCreationAllowed(game)).toBe(false),
  );

  it.each(["cs2", "valorant", "fc26", "tekken8"])(
    "allows enabled game %s",
    (game) => expect(isNewGameEntityCreationAllowed(game)).toBe(true),
  );

  it("throws a stable user-facing error for disabled games", () => {
    expect(() => assertNewGameEntityCreationAllowed("futsal")).toThrow(
      "This game is temporarily unavailable for new teams and matchrooms.",
    );
  });
});
