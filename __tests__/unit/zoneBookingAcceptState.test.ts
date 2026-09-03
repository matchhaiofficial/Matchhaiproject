import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("zone booking accept state regression guards", () => {
  it("removes accepted requests and prepares the matchrooms tab before opening details", () => {
    const source = read("app/zone/modules/bookings.tsx");

    expect(source).toContain("const acceptedRequestId = selectedRequest.id");
    expect(source).toContain("current.filter((item) => String(item.id) !== String(acceptedRequestId))");
    expect(source).toContain('setSegment("matchrooms")');
    expect(source).toContain("void loadQueuePage({ append: false })");
    expect(source).toContain("void loadMatchroomsPage({ append: false })");
    expect(source).toContain("router.push(`/matchrooms/${result.matchroomId}` as any)");
  });
});
