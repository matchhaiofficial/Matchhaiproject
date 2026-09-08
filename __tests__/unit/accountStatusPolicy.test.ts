import {
  accountDeletionLocksReactivation,
  isAccountSuspensionActive,
} from "../../convex/accountStatusPolicy";

describe("account suspension policy", () => {
  const now = 2_000;

  it("blocks permanent and unexpired suspensions", () => {
    expect(isAccountSuspensionActive({ accountStatus: "suspended", suspendedUntil: null }, now)).toBe(true);
    expect(isAccountSuspensionActive({ accountStatus: "suspended", suspendedUntil: now + 1 }, now)).toBe(true);
  });

  it("allows expired temporary suspensions and active accounts", () => {
    expect(isAccountSuspensionActive({ accountStatus: "suspended", suspendedUntil: now }, now)).toBe(false);
    expect(isAccountSuspensionActive({ accountStatus: "active" }, now)).toBe(false);
  });

  it("keeps destructive or active deletion jobs locked from reactivation", () => {
    expect(accountDeletionLocksReactivation("queued")).toBe(true);
    expect(accountDeletionLocksReactivation("running")).toBe(true);
    expect(accountDeletionLocksReactivation("failed")).toBe(true);
    expect(accountDeletionLocksReactivation("completed")).toBe(true);
    expect(accountDeletionLocksReactivation("blocked")).toBe(false);
    expect(accountDeletionLocksReactivation(undefined)).toBe(false);
  });
});
