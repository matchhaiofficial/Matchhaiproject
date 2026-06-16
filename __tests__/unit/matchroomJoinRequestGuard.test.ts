import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("matchroom join request regression guards", () => {
  it("hides card requests using the shared availability rule", () => {
    const source = read("app/matchrooms/components/MatchroomCard.tsx");

    expect(source).toContain("getMatchroomJoinAvailability(room)");
    expect(source).toContain("onJoinPress && joinAvailability.available");
  });

  it("blocks stale client requests before calling the backend", () => {
    const source = read("src/hooks/useMatchroomJoinFlow.tsx");

    expect(source).toContain("const joinAvailability = getMatchroomJoinAvailability(args.room)");
    expect(source).toContain("if (!joinAvailability.available)");
    expect(source).toContain("message: joinAvailability.message");
  });

  it("returns specific structured backend failures before creating requests", () => {
    const source = read("convex/matchrooms.ts");
    const start = source.indexOf("export const requestToJoinMatchroom");
    const end = source.indexOf("// Respond to matchroom invite", start);
    const mutation = source.slice(start, end);

    expect(mutation).toContain('matchroomJoinFailure("This matchroom is full.", "MATCHROOM_FULL")');
    expect(mutation).toContain('"MATCHROOM_LOCKED"');
    expect(mutation).toContain('"MATCHROOM_EXPIRED"');
    expect(mutation.indexOf("isRosterFull(room)")).toBeLessThan(mutation.indexOf("isJoinLocked(room)"));
  });

  it("passes structured failures through the client service", () => {
    const source = read("src/services/convex/matchService.ts");

    expect(source).toContain('result.ok === false');
    expect(source).toContain('"code" in result && typeof result.code === "string" ? result.code : undefined');
    expect(source).toContain('message: String(result.message || "Failed to send request")');
  });
});
