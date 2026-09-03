import {
  getZoneBranchDisplayName,
  getZoneBranchId,
  getZoneBranchOption,
} from "../../src/utils/zoneBranch";

describe("zone branch helpers", () => {
  it("prefers the persisted branch id over branchId and fallback ids", () => {
    expect(getZoneBranchId({ id: "garden", branchId: "legacy" }, 0)).toBe("garden");
    expect(getZoneBranchId({ branchId: "legacy" }, 1)).toBe("legacy");
    expect(getZoneBranchId({}, 2)).toBe("branch_3");
  });

  it("uses the same display label fallback order across zone wallet and withdrawal UI", () => {
    expect(getZoneBranchDisplayName({ branchDisplayName: "Garden Branch", name: "Garden" })).toBe("Garden Branch");
    expect(getZoneBranchDisplayName({ name: "Garden" })).toBe("Garden");
    expect(getZoneBranchDisplayName({ areaLabel: "Gulberg" })).toBe("Gulberg");
    expect(getZoneBranchDisplayName({}, "Branch 4")).toBe("Branch 4");
  });

  it("builds stable chip options for branches missing explicit ids or names", () => {
    expect(getZoneBranchOption({ areaLabel: "Gulberg" }, 0)).toEqual({
      id: "branch_1",
      label: "Gulberg",
    });
  });
});
