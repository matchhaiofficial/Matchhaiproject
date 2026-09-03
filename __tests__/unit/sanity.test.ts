// Foundation sanity check: pure-logic test, no native/network.
import { getCanonicalGameLabel } from "../../src/utils/gameLabels";

describe("jest foundation (unit)", () => {
  it("runs and imports app source", () => {
    expect(getCanonicalGameLabel("valorant")).toBe("Valorant");
    expect(getCanonicalGameLabel("cs2")).toBe("CS2");
    expect(getCanonicalGameLabel(undefined)).toBe("Game");
  });
});
