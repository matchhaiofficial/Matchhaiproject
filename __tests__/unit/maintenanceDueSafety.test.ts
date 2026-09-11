import {
  FUTURE_MAINTENANCE_DUE_AT,
  getBookingRequestLifecycleDueAt,
  getPaymentNextReconcileAt,
  getTeamChallengeLifecycleDueAt,
  withBookingRequestLifecycleDueAt,
  withTeamChallengeLifecycleDueAt,
} from "../../convex/maintenanceDue";

describe("maintenance deadline invariants", () => {
  const now = new Date("2026-09-11T12:00:00Z").getTime();

  it.each(["expired", "cancelled"])("clears terminal booking request %s deadlines", (status) => {
    expect(getBookingRequestLifecycleDueAt({ status, responseExpiresAt: now - 1 }, null, now)).toBeUndefined();
  });

  it("never returns a booking deadline earlier than the clock", () => {
    const cases = [
      { status: "open", responseExpiresAt: now - 1 },
      { status: "accepted", preferredDate: "2026-09-10", preferredTime: "10:00" },
      { status: "open" },
    ];
    for (const request of cases) {
      const dueAt = getBookingRequestLifecycleDueAt(request, null, now);
      expect(dueAt === undefined || dueAt >= now).toBe(true);
    }
  });

  it.each(["admin_pending", "completed", "rejected", "expired"])("clears terminal challenge %s deadlines", (status) => {
    expect(getTeamChallengeLifecycleDueAt({ status, scheduledAt: now - 1 }, now)).toBeUndefined();
  });

  it("uses a future sentinel for active records with no actionable deadline", () => {
    expect(getTeamChallengeLifecycleDueAt({ status: "accepted" }, now)).toBe(FUTURE_MAINTENANCE_DUE_AT);
    expect(getBookingRequestLifecycleDueAt({ status: "open" }, null, now)).toBe(FUTURE_MAINTENANCE_DUE_AT);
  });

  it("only schedules payment reconciliation in the future", () => {
    const active = getPaymentNextReconcileAt({ status: "pending", createdAt: now - 1_000 }, now);
    const complete = getPaymentNextReconcileAt({ status: "paid", createdAt: now - 1_000 }, now);
    expect(active === undefined || active > now).toBe(true);
    expect(complete).toBeUndefined();
  });

  it("does not rewrite an unchanged deadline during a retry", () => {
    const request = {
      status: "open",
      responseExpiresAt: now + 60_000,
      lifecycleDueAt: now + 60_000,
    };
    expect(withBookingRequestLifecycleDueAt(request, null, {}, now)).toEqual({});

    const challenge = {
      status: "accepted",
      scheduledAt: now + 60_000,
      lifecycleDueAt: now + 60_000,
    };
    expect(withTeamChallengeLifecycleDueAt(challenge, {}, now)).toEqual({});
  });
});
