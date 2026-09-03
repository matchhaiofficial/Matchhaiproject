import {
  FUTURE_MAINTENANCE_DUE_AT,
  STALE_PAYMENT_RECONCILE_AFTER_MS,
  STALE_PAYMENT_RECONCILE_COOLDOWN_MS,
  getBookingRequestLifecycleDueAt,
  getPaymentNextReconcileAt,
  getTeamChallengeLifecycleDueAt,
  withPaymentNextReconcileAt,
} from "../../convex/maintenanceDue";

describe("maintenance due-time helpers", () => {
  const now = new Date("2026-08-25T12:00:00").getTime();

  it("does not schedule terminal booking requests", () => {
    expect(
      getBookingRequestLifecycleDueAt(
        { status: "cancelled", responseExpiresAt: now - 1 },
        null,
        now,
      ),
    ).toBeUndefined();
  });

  it("makes overdue booking requests immediately queryable", () => {
    expect(
      getBookingRequestLifecycleDueAt(
        { status: "open", responseExpiresAt: now - 1 },
        null,
        now,
      ),
    ).toBe(now);
  });

  it("keeps incomplete requests indexed without repeatedly making them due", () => {
    expect(
      getBookingRequestLifecycleDueAt({ status: "open" }, null, now),
    ).toBe(FUTURE_MAINTENANCE_DUE_AT);
  });

  it("schedules active challenges and clears completed challenges", () => {
    const scheduledAt = now + 60_000;
    expect(
      getTeamChallengeLifecycleDueAt(
        { status: "accepted", scheduledAt },
        now,
      ),
    ).toBe(scheduledAt);
    expect(
      getTeamChallengeLifecycleDueAt(
        { status: "completed", scheduledAt },
        now,
      ),
    ).toBeUndefined();
  });

  it("schedules only active payment attempts", () => {
    const createdAt = now - 1_000;
    expect(
      getPaymentNextReconcileAt({ status: "pending", createdAt }, now),
    ).toBe(createdAt + STALE_PAYMENT_RECONCILE_AFTER_MS);
    expect(
      getPaymentNextReconcileAt({ status: "paid", createdAt }, now),
    ).toBeUndefined();
  });

  it("moves payment reconciliation forward after a provider callback", () => {
    const transaction = {
      status: "pending",
      createdAt: now - STALE_PAYMENT_RECONCILE_AFTER_MS,
      lastCallbackAt: now,
      nextReconcileAt: now,
    };
    expect(withPaymentNextReconcileAt(transaction, {}, now)).toEqual({
      nextReconcileAt: now + STALE_PAYMENT_RECONCILE_COOLDOWN_MS,
    });
  });
});
