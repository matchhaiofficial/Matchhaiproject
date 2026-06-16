import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("zone counter-offer allocation regression guards", () => {
  it("attaches an existing player matchroom to the accepting zone", () => {
    const source = read("convex/zoneAdminBooking.ts");
    const existingRoomBranch = source.slice(
      source.indexOf("if (request.matchroomId)"),
      source.indexOf("const hostUser = await ctx.db.get(request.userId)"),
    );

    expect(existingRoomBranch).toContain('locationMode: "zone"');
    expect(existingRoomBranch).toContain("zoneId: String(acceptedZoneId)");
    expect(existingRoomBranch).toContain('bookingSource: "zone_accepted"');
    expect(existingRoomBranch).toContain("zoneAdminApproved: true");
  });

  it("surfaces accepted rooms created before the metadata repair", () => {
    const source = read("convex/zoneAdminBooking.ts");

    expect(source).toContain("loadAcceptedRequestMatchroomFallbacks");
    expect(source).toContain('q.eq("zoneId", zoneId as any).eq("status", "accepted")');
    expect(source).toContain('request.requestKind !== "broadcast_fanout"');
    expect(source).toContain('bookingSource: "zone_accepted"');
  });

  it("keeps the linked matchroom synchronized during first allocation", () => {
    const source = read("convex/zoneAdminResources.ts");
    const allocateMutation = source.slice(
      source.indexOf("export const allocateResourcesToRequest"),
      source.indexOf("export const reassignResourcesForRequest"),
    );

    expect(allocateMutation).toContain("assertRequestCanBeAllocated(request, args.zoneId)");
    expect(allocateMutation).toContain("await ctx.db.patch(request.matchroomId");
    expect(allocateMutation).toContain("resourceIds: args.resourceIds");
    expect(allocateMutation).toContain("zoneAdminApproved: true");
  });

  it("routes unallocated accepted matchrooms into resource allocation", () => {
    const matchroomsSection = read("app/zone/modules/components/ZoneBookingsMatchroomsSection.tsx");
    const resourcesModule = read("app/zone/modules/resources.tsx");

    expect(matchroomsSection).toContain('item.bookingSource === "zone_accepted"');
    expect(matchroomsSection).toContain('acceptLabel="Allocate"');
    expect(resourcesModule).toContain("const deepMatchroomId");
    expect(resourcesModule).toContain("item.matchroomId === deepMatchroomId");
  });
});
