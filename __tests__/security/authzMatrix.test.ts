// Phase 5 (8) — critical-mutation negative-auth matrix.
//
// The gates themselves (requireCurrentUser / requireSuperAdmin / requireSelf /
// requireOwnedZone) are unit-tested in backendAuth.test.ts with a fake ctx.
// END-TO-END negative-auth assertions on each mutation (calling the real Convex
// function with a non-privileged identity and asserting it throws) require the
// `convex-test` in-memory harness, which is NOT yet installed (see
// docs/SECURITY_TESTS.md for the rationale and setup steps). Until then these are
// tracked as it.todo() so they appear in every test run as outstanding coverage.

describe("critical mutation negative-auth coverage (needs convex-test harness)", () => {
  it.todo("matchrooms.create — unauthenticated caller is rejected");
  it.todo("matchrooms.requestJoin — unauthenticated caller is rejected");
  it.todo("matchrooms.requestJoin — duplicate active request from same user is rejected/idempotent");
  it.todo("matchrooms.acceptJoinRequest — only host/captain may accept");
  it.todo("matchrooms.acceptJoinRequest — blocked once the room is join-locked");
  it.todo("matchrooms.leave — blocked once leave-locked (venue confirmed)");
  it.todo("bookings.createIntent — only a participant/host may create");
  it.todo("bookings.createIntent — duplicate idempotencyKey returns the same intent");
  it.todo("payments.confirm — non-owner cannot confirm another user's payment");
  it.todo("payments.confirm — late provider success after local expiry is reconciled safely (no double credit)");
  it.todo("matchrooms.submitResult — non-participant cannot submit a result");
  it.todo("matchrooms.submitResult — non-captain cannot captain-submit");
  it.todo("matchrooms.submitResult — wrong winner/team payload is rejected");
  it.todo("matchrooms.finalizeResult — duplicate finalize is idempotent (ELO applied once)");
  it.todo("zoneAdminBooking.accept/reject/counter — only the owning zone admin may act");
  it.todo("zoneWithdrawals.request — only the zone owner may request a withdrawal");
  it.todo("admin.* / superAdminAccess gates — non-super-admin is rejected on every super-admin endpoint");
});
