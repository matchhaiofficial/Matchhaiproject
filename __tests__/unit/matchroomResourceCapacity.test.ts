import {
  getMinimumResourceCountForGame,
  getResourceCapacityKey,
  hasMinimumResourceCapacity,
} from "../../app-shared/matchrooms/create/utils/matchroomResourceCapacity";

describe("matchroom resource capacity", () => {
  it("requires ten same-tier PCs for competitive PC games", () => {
    expect(getMinimumResourceCountForGame("cs2")).toBe(10);
    expect(getMinimumResourceCountForGame("cs16")).toBe(10);
    expect(getMinimumResourceCountForGame("valorant")).toBe(10);
    expect(getMinimumResourceCountForGame("fc26")).toBe(1);
  });

  it("uses the tier before surface when matching a capacity bucket", () => {
    expect(getResourceCapacityKey({ assetType: "PC", tier: "Regular", surface: "5v5" }))
      .toBe("pc:regular");
    expect(getResourceCapacityKey({ assetType: "padel", surface: "standard" }))
      .toBe("padel:standard");
  });

  it("hides impossible tiers but retains options while a bounded snapshot is incomplete", () => {
    const snapshot = {
      capacityByKey: { "pc:regular": 10, "pc:premium": 4, "console:ps5": 1 },
      complete: true,
    };

    expect(hasMinimumResourceCapacity(snapshot, "cs2", { assetType: "pc", tier: "regular" })).toBe(true);
    expect(hasMinimumResourceCapacity(snapshot, "cs2", { assetType: "pc", tier: "premium" })).toBe(false);
    expect(hasMinimumResourceCapacity(snapshot, "fc26", { assetType: "console", tier: "ps5" })).toBe(true);
    expect(hasMinimumResourceCapacity(undefined, "cs2", { assetType: "pc", tier: "premium" })).toBe(true);
    expect(hasMinimumResourceCapacity({ ...snapshot, complete: false }, "cs2", { assetType: "pc", tier: "premium" })).toBe(true);
  });
});
