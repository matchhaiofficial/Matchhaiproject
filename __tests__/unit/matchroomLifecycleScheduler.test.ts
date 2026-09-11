import {
  getFutureLifecycleDueAt,
  getLifecycleDueAt,
  getLifecycleScheduleAt,
  LIFECYCLE_MIN_SCHEDULE_DELAY_MS,
  recomputeLifecycleDueAt,
} from "../../convex/matchroomLifecycle";

const HOUR = 60 * 60 * 1000;

function fullRoom(overrides: Record<string, unknown> = {}): Record<string, any> {
  return {
    status: "locked",
    maxPlayers: 2,
    slotsA: [
      { slotId: "a1", uid: "user-a", status: "confirmed" },
    ],
    slotsB: [
      { slotId: "b1", uid: "user-b", status: "confirmed" },
    ],
    scheduledStartAt: 10 * HOUR,
    locationMode: "zone",
    venueConfirmedAt: 1,
    ...overrides,
  };
}

describe("matchroom lifecycle scheduler safety", () => {
  test("preserves future deadlines and delays due work by a bounded amount", () => {
    const now = 1_000_000;

    expect(getLifecycleScheduleAt(now + 5_000, now)).toBe(now + 5_000);
    expect(getLifecycleScheduleAt(now, now)).toBe(now + LIFECYCLE_MIN_SCHEDULE_DELAY_MS);
    expect(getLifecycleScheduleAt(now - 5_000, now)).toBe(now + LIFECYCLE_MIN_SCHEDULE_DELAY_MS);
    expect(getLifecycleScheduleAt(undefined, now)).toBeUndefined();
  });

  test("advances through the 24-hour, 2-hour, and 30-minute reminder boundaries", () => {
    const start = 100 * HOUR;
    const room = fullRoom({ scheduledStartAt: start });

    expect(getLifecycleDueAt(room, start - 25 * HOUR)).toBe(start - 24 * HOUR);
    expect(getLifecycleDueAt(room, start - 24 * HOUR)).toBe(start - 2 * HOUR);
    expect(getLifecycleDueAt(room, start - 2 * HOUR)).toBe(start - 30 * 60 * 1000);
    expect(getLifecycleDueAt(room, start - 30 * 60 * 1000)).toBe(start);
    expect(getFutureLifecycleDueAt(room, start - 24 * HOUR)).toBe(start - 2 * HOUR);
  });

  test("terminates instead of returning an expired deadline for a no-op full room", () => {
    const now = 10 * HOUR;
    const room = fullRoom({ scheduledStartAt: now, lifecycleDueAt: now });

    // The regular handler may start this room at this boundary. If another
    // invariant prevents a transition, this guard guarantees no immediate
    // self-rescheduling loop remains.
    expect(getLifecycleDueAt(room, now)).toBe(now);
    expect(getFutureLifecycleDueAt(room, now)).toBeUndefined();
  });

  test("migration recomputation ignores stale persisted due-at metadata", () => {
    const now = 100 * HOUR;
    const start = now + 25 * HOUR;
    const room = fullRoom({
      scheduledStartAt: start,
      lifecycleDueAt: now - 10 * HOUR,
    });

    expect(recomputeLifecycleDueAt(room, now)).toBe(start - 24 * HOUR);
  });

  test("broadcast idle/waiting-for-fill is one immediate dispatch, then a future expiry", () => {
    const now = 100 * HOUR;
    const idle = fullRoom({
      locationMode: "broadcast",
      venueConfirmedAt: undefined,
      confirmedZoneId: undefined,
      broadcastRequestStatus: "idle",
    });
    expect(getLifecycleDueAt(idle, now)).toBe(now);
    expect(getFutureLifecycleDueAt(idle, now)).toBeUndefined();

    const waitingForZones = {
      ...idle,
      scheduledStartAt: now + 10 * HOUR,
      broadcastRequestStatus: "waiting_for_zones",
      broadcastRequestExpiresAt: now + 30 * 60 * 1000,
    };
    expect(getFutureLifecycleDueAt(waitingForZones, now)).toBe(now + 30 * 60 * 1000);
  });

  test("completed result verification is a one-shot prompt boundary", () => {
    const now = 10 * HOUR;
    const room = fullRoom({
      status: "completed",
      resultVerification: {
        status: "pending",
        team1Captain: "user-a",
        team2Captain: "user-b",
      },
      lifecycleDueAt: now,
    });

    expect(getLifecycleDueAt(room, now)).toBe(now);
    expect(getFutureLifecycleDueAt(room, now)).toBeUndefined();
    expect(
      getFutureLifecycleDueAt({
        ...room,
        resultVerification: { ...room.resultVerification, lifecyclePromptedAt: now },
      }, now),
    ).toBeUndefined();
  });
});
