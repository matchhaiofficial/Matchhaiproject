import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "..", "..");
const zonesSource = fs.readFileSync(path.join(root, "convex/zones.ts"), "utf8");

function exportedHandler(name: string, nextName: string) {
  const start = zonesSource.indexOf(`export const ${name} =`);
  const end = zonesSource.indexOf(`export const ${nextName} =`, start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return zonesSource.slice(start, end);
}

describe("zone authorization boundaries", () => {
  it("authenticates private zone reads and only returns public fields from listActive", () => {
    expect(exportedHandler("getByOwner", "listActive")).toContain("requireCurrentUser(ctx)");
    expect(exportedHandler("listActive", "listPendingReview")).toContain("buildPublicZoneView");
    expect(exportedHandler("listPendingReview", "notifyZoneLiveNearbyPlayersBatch")).toContain(
      "requireSuperAdmin(ctx)",
    );
  });

  it("derives zone creation ownership from the authenticated profile", () => {
    const handler = exportedHandler("create", "update");
    expect(handler).toContain("requireCurrentUser(ctx)");
    expect(handler).toContain("ownerUid: actor.user._id");
    expect(handler).not.toContain("ownerUid: args.ownerUid");
  });

  it.each([
    ["update", "addBranch"],
    ["addBranch", "updateBranch"],
    ["updateBranch", "deleteBranch"],
    ["deleteBranch", "approve"],
    ["createPricingRule", "updatePricingRule"],
    ["updatePricingRule", "deletePricingRule"],
    ["deletePricingRule", "listResources"],
    ["createResource", "updateResourceStatus"],
    ["updateResourceStatus", "deleteResource"],
  ])("checks zone ownership in %s", (name, nextName) => {
    expect(exportedHandler(name, nextName)).toContain("requireZoneOwnerWithKyc(ctx");
  });

  it.each([
    ["approve", "reject"],
    ["reject", "suspend"],
    ["suspend", "listPricingRules"],
  ])("requires super-admin authorization in %s", (name, nextName) => {
    expect(exportedHandler(name, nextName)).toContain("requireSuperAdmin(ctx)");
  });

  it("authorizes resource updates and deletes through their parent zone", () => {
    expect(exportedHandler("updateResourceStatus", "deleteResource")).toContain(
      "resource.zoneId",
    );
    expect(zonesSource.slice(zonesSource.indexOf("export const deleteResource ="))).toContain(
      "resource.zoneId",
    );
  });
});
