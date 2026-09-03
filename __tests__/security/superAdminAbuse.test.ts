// Phase 5 (7) — privilege-escalation / abuse attempts against the Super Admin
// resolver (the single source of truth used by every server gate).
import {
  isAuthorizedSuperAdmin,
  isSuperAdminRole,
  isSuperAdminAllowlistedEmail,
} from "../../convex/superAdminAccess";

describe("super admin escalation attempts are rejected (fail closed)", () => {
  it("a fabricated role string does not grant access", () => {
    expect(isSuperAdminRole("SUPER_ADMIN")).toBe(false); // wrong case
    expect(isSuperAdminRole("admin")).toBe(false);
    expect(isSuperAdminRole("superadmin")).toBe(false);
    expect(isSuperAdminRole("owner")).toBe(false);
  });

  it("a spoofed email that is not allowlisted is rejected", () => {
    expect(isSuperAdminAllowlistedEmail("superadmin@matchhai.com.evil.com")).toBe(false);
    expect(isSuperAdminAllowlistedEmail("not-the-admin@matchhai.com")).toBe(false);
  });

  it("a normal user cannot self-escalate by claiming a role they do not have in DB", () => {
    // The profile passed to the gate is the SERVER-loaded DB profile; a client
    // claiming role:'super_admin' in a request body never reaches here. With a
    // genuine player profile + non-allowlisted email, access is denied.
    const playerProfile = { role: "player", email: "attacker@evil.com" };
    expect(isAuthorizedSuperAdmin(playerProfile, playerProfile.email)).toBe(false);
    expect(isAuthorizedSuperAdmin(playerProfile, null)).toBe(false);
  });

  it("legacy 'super-admin' role is still honored (no lockout regression)", () => {
    expect(isAuthorizedSuperAdmin({ role: "super-admin" }, "whoever@x.com")).toBe(true);
  });
});
