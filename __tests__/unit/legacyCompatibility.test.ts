import {
  isLegacyZoneOffer,
  isStandaloneLegacyBookingRequest,
} from "../../convex/legacyCompatibility";

describe("legacy booking compatibility boundaries", () => {
  it("accepts only standalone requests explicitly or implicitly using the legacy workflow", () => {
    expect(isStandaloneLegacyBookingRequest({ status: "open" })).toBe(true);
    expect(isStandaloneLegacyBookingRequest({ status: "open", workflowVersion: "legacy_v1", allocatedResourceIds: [] })).toBe(true);

    for (const request of [
      { status: "open", requestKind: "direct_zone" },
      { status: "open", workflowVersion: "canonical_v2" },
      { status: "open", matchroomId: "room-1" },
      { status: "open", lifecycleStatus: "zone_admin_pending" },
      { status: "open", allocatedBranchId: "branch-1" },
      { status: "open", allocatedResourceIds: ["resource-1"] },
    ]) {
      expect(isStandaloneLegacyBookingRequest(request)).toBe(false);
    }
  });

  it("rejects offers containing any canonical workflow state", () => {
    expect(isLegacyZoneOffer({ status: "pending" })).toBe(true);

    for (const offer of [
      { status: "pending", offerType: "counter_offer" },
      { status: "pending", requestKind: "direct_zone" },
      { status: "pending", resolvedMatchroomId: "room-1" },
      { status: "pending", branchId: "branch-1" },
      { status: "pending", resourceIds: ["resource-1"] },
      { status: "pending", scheduleOptions: [{ date: "2026-09-08", time: "18:00" }] },
    ]) {
      expect(isLegacyZoneOffer(offer)).toBe(false);
    }
  });
});
