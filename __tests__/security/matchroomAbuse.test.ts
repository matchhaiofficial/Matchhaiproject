// Phase 5 (2,4,5) — lifecycle-rule abuse: overfill prevention, join/leave/approve
// after lock, expired rooms not joinable. These assert the RULE LAYER that the
// backend mutations rely on (the same helpers gate join/leave/approve). Full
// concurrency (two users booking the same slot at once) is exercised by k6
// (load-tests/scenarios/race.js) and documented in docs/SECURITY_TESTS.md.
import {
  isRoomFull,
  isJoinLocked,
  isLeaveLocked,
  isRoomExpired,
} from "../../src/utils/matchroomLifecycle";
import {
  FIXED_NOW,
  makeMatchroom,
  confirmedSlot,
  fullRoom,
  lockedRoom,
  pastLockUnfilledRoom,
  ONE_DAY,
} from "../fixtures";

const now = FIXED_NOW;

describe("overfill prevention (full room)", () => {
  it("a full room reports full and is join-locked (no extra joins)", () => {
    expect(isRoomFull(fullRoom)).toBe(true);
    expect(isJoinLocked(fullRoom, now)).toBe(true);
  });

  it("adding a confirmed slot beyond maxPlayers still reads as full (cannot overfill)", () => {
    const overfilled = makeMatchroom({
      maxPlayers: 2,
      currentPlayers: 3,
      slotsA: [confirmedSlot("a", { team: "A" }), confirmedSlot("c", { team: "A" })],
      slotsB: [confirmedSlot("b", { team: "B" })],
    });
    expect(isRoomFull(overfilled)).toBe(true);
    expect(isJoinLocked(overfilled, now)).toBe(true);
  });
});

describe("join after lock is blocked", () => {
  it("a full future room is join-locked", () => {
    expect(isJoinLocked(lockedRoom, now)).toBe(true);
  });

  it("an unfilled room past its lock is expired (dead) -> not joinable", () => {
    expect(isRoomExpired(pastLockUnfilledRoom, now)).toBe(true);
  });
});

describe("leave after lock / venue confirmation is blocked", () => {
  it("leave is locked once the zone confirms the venue", () => {
    expect(isLeaveLocked(makeMatchroom({ zoneAdminApproved: true }), now)).toBe(true);
    expect(isLeaveLocked(makeMatchroom({ confirmedZoneId: "zone_main" }), now)).toBe(true);
    expect(isLeaveLocked(makeMatchroom({ venueConfirmedAt: now.toISOString() }), now)).toBe(true);
  });

  it("leave is allowed for a plain open room before lock", () => {
    expect(isLeaveLocked(makeMatchroom(), now)).toBe(false);
  });

  it("leave is locked after the time-based lock passes", () => {
    // A full room one hour before start: lock window has passed.
    const nearStart = makeMatchroom({
      scheduledStartAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      scheduledDate: now.toISOString().slice(0, 10),
      scheduledTime: "13:00",
    });
    expect(isLeaveLocked(nearStart, now)).toBe(true);
  });
});

describe("captain approval after lock", () => {
  it("an approval that would mutate seats is gated by the same join-lock", () => {
    // Approving a join request must respect join-lock: a full/locked room
    // cannot accept new confirmed slots.
    expect(isJoinLocked(fullRoom, now)).toBe(true);
    const lockedCompleted = makeMatchroom({ status: "completed", completedAt: new Date(now.getTime() - ONE_DAY).toISOString() });
    // Completed rooms are terminal; they are not "joinable/approvable" either.
    expect(isRoomExpired(lockedCompleted, now)).toBe(false); // terminal, not expired
    expect(isRoomFull(lockedCompleted)).toBe(false);
  });
});
