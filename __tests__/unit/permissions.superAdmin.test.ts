// Phase 1H / Phase 5 — Super Admin access resolution (server source of truth).
// EXPO_PUBLIC_SUPER_ADMIN_EMAIL is set to superadmin@matchhai.com by jest setup,
// so the primary email is allowlisted for these tests.
import {
  isSuperAdminRole,
  isLegacySuperAdminRole,
  isAuthorizedSuperAdmin,
  isSuperAdminAllowlistedEmail,
  resolveSuperAdminAccessSource,
  normalizeSuperAdminEmail,
} from "../../convex/superAdminAccess";

describe("isSuperAdminRole", () => {
  it("accepts canonical and legacy roles", () => {
    expect(isSuperAdminRole("super_admin")).toBe(true);
    expect(isSuperAdminRole("super-admin")).toBe(true);
    expect(isLegacySuperAdminRole("super-admin")).toBe(true);
    expect(isLegacySuperAdminRole("super_admin")).toBe(false);
  });
  it("rejects normal roles", () => {
    expect(isSuperAdminRole("player")).toBe(false);
    expect(isSuperAdminRole("zone_admin")).toBe(false);
    expect(isSuperAdminRole(null)).toBe(false);
  });
});

describe("normalizeSuperAdminEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeSuperAdminEmail("  SuperAdmin@MatchHai.com ")).toBe("superadmin@matchhai.com");
    expect(normalizeSuperAdminEmail(null)).toBe("");
  });
});

describe("isSuperAdminAllowlistedEmail", () => {
  it("allowlists the configured primary email", () => {
    expect(isSuperAdminAllowlistedEmail("superadmin@matchhai.com")).toBe(true);
    expect(isSuperAdminAllowlistedEmail("SUPERADMIN@MATCHHAI.COM")).toBe(true);
  });
  it("rejects arbitrary emails (fail closed)", () => {
    expect(isSuperAdminAllowlistedEmail("attacker@evil.com")).toBe(false);
    expect(isSuperAdminAllowlistedEmail("")).toBe(false);
  });
});

describe("isAuthorizedSuperAdmin (negative-auth focused)", () => {
  it("grants via DB role regardless of email", () => {
    expect(isAuthorizedSuperAdmin({ role: "super_admin" }, "someone@else.com")).toBe(true);
  });
  it("grants via allowlisted email even when role is player", () => {
    expect(isAuthorizedSuperAdmin({ role: "player" }, "superadmin@matchhai.com")).toBe(true);
  });
  it("DENIES a normal user with a non-allowlisted email", () => {
    expect(isAuthorizedSuperAdmin({ role: "player" }, "attacker@evil.com")).toBe(false);
    expect(isAuthorizedSuperAdmin({ role: "zone_admin", email: "zone@x.com" }, null)).toBe(false);
  });
});

describe("resolveSuperAdminAccessSource", () => {
  it("reports the access source", () => {
    expect(resolveSuperAdminAccessSource({ role: "super_admin" }, "superadmin@matchhai.com")).toBe("both");
    expect(resolveSuperAdminAccessSource({ role: "super_admin" }, "x@y.com")).toBe("db_role");
    expect(resolveSuperAdminAccessSource({ role: "player" }, "superadmin@matchhai.com")).toBe("env_allowlist");
    expect(resolveSuperAdminAccessSource({ role: "player" }, "x@y.com")).toBeNull();
  });
});
