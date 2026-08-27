import fs from "fs";
import path from "path";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("public contact lookup exposure", () => {
  it("does not use public email lookup to distinguish invalid credentials", () => {
    const authService = read("src/services/convex/authService.ts");

    expect(authService).not.toContain("api.users.getByEmail");
  });

  it("requires authentication before returning an email lookup result", () => {
    const users = read("convex/users.ts");
    const getByEmail = users.slice(
      users.indexOf("export const getByEmail"),
      users.indexOf("export const getByUsername"),
    );

    expect(getByEmail).toContain("if (!actor.user) return null");
    expect(getByEmail).not.toContain("accountStatus:");
    expect(getByEmail).not.toContain("suspendedAt:");
    expect(getByEmail).not.toContain("suspendedUntil:");
  });

  it("limits the legacy anonymous phone-login lookup to the required email", () => {
    const users = read("convex/users.ts");
    const getByPhone = users.slice(
      users.indexOf("export const getByPhone"),
      users.indexOf("export const getBySteamId"),
    );

    expect(getByPhone).toContain("return { email: existing.email }");
    expect(getByPhone).not.toContain("_id:");
    expect(getByPhone).not.toContain("accountType:");
    expect(getByPhone).not.toContain("accountStatus:");
    expect(getByPhone).not.toContain("suspendedAt:");
    expect(getByPhone).not.toContain("suspendedUntil:");
  });
});
