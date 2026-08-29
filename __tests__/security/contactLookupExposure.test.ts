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

  it("uses Better Auth phone login without an anonymous Convex contact lookup", () => {
    const authClient = read("src/lib/auth-client.ts");
    const authService = read("src/services/convex/authService.ts");
    const users = read("convex/users.ts");

    expect(authClient).toContain("phoneNumberClient()");
    expect(authService).toContain("authClient.signIn.phoneNumber");
    expect(authService).not.toContain("api.users.getByPhone");
    expect(users).not.toContain("export const getByPhone");
  });

  it("requires Better Auth phone verification before password sign-in", () => {
    const auth = read("convex/auth.ts");
    const phonePlugin = auth.slice(
      auth.indexOf("phoneNumber({"),
      auth.indexOf("signUpOnVerification"),
    );

    expect(phonePlugin).toContain("requireVerification: true");
  });
});
