import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("zone walk-in count regression guards", () => {
  it("keeps walk-in rows, totals, pagination, and loading separate from matchrooms", () => {
    const source = read("app/zone/modules/bookings.tsx");

    expect(source).toContain("const [walkInRooms, setWalkInRooms]");
    expect(source).toContain("const [walkInsTotal, setWalkInsTotal]");
    expect(source).toContain("const [walkInsCursor, setWalkInsCursor]");
    expect(source).toContain("const [walkInsDone, setWalkInsDone]");
    expect(source).toContain("const loadWalkInsPage");
    expect(source).toContain('bookingSource: "walkin"');
  });

  it("renders each tab badge from its authoritative total, including zero", () => {
    const source = read("app/zone/modules/bookings.tsx");

    expect(source).toContain('{ key: "matchrooms", label: "Matchrooms", badge: matchroomsTotal }');
    expect(source).toContain('{ key: "walkins", label: "Walk-ins", badge: walkInsTotal }');
    expect(source).not.toContain("matchroomsTotal ||");
    expect(source).not.toContain("walkInsTotal ||");
  });

  it("uses nullish total fallbacks so zero remains authoritative", () => {
    const screen = read("app/zone/modules/bookings.tsx");
    const service = read("src/services/convex/zoneAdminBookingService.ts");

    expect(screen).toContain("setMatchroomsTotal(result.total ?? result.page.length)");
    expect(screen).toContain("setWalkInsTotal(result.total ?? result.page.length)");
    expect(service).toContain("Number(result?.total ?? page.length)");
    expect(service).not.toContain("Number(result?.total || page.length)");
  });

  it("ignores stale matchroom and walk-in responses", () => {
    const source = read("app/zone/modules/bookings.tsx");

    expect(source).toContain("matchroomsRequestVersionRef");
    expect(source).toContain("walkInsRequestVersionRef");
    expect(source).toContain("requestVersion !== matchroomsRequestVersionRef.current");
    expect(source).toContain("requestVersion !== walkInsRequestVersionRef.current");
  });
});
