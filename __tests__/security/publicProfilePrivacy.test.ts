import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "..", "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("public-profile privacy call sites", () => {
  it("projects listPlayers through the public user boundary", () => {
    const source = read("convex/users.ts");
    const start = source.indexOf("export const listPlayers =");
    const end = source.indexOf("// ============================================\n// INTERNAL", start);
    const handler = source.slice(start, end);

    expect(handler).toContain("publicUser(u)");
    expect(handler).not.toContain("({ ...u, id: u._id })");
  });

  it("does not expose hidden areas or platform identifiers in Discover results", () => {
    const source = read("convex/discover.ts");
    const start = source.indexOf("export const listDiscoverPlayers =");
    const end = source.indexOf("export const listDiscoverTeams =", start);
    const handler = source.slice(start, end);

    expect(handler).toContain("publicUser(player)");
    expect(handler).not.toContain("areasPreferred: Array.isArray(player.areasPreferred)");
  });
});
