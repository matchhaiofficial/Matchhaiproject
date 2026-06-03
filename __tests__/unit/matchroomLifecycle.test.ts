// Phase 1B/D — matchroom lifecycle: full / locked / expired / completed status,
// seats logic, leave-lock, complaint window.
import {
  isRoomFull,
  isRoomExpired,
  isJoinLocked,
  isLeaveLocked,
  isRoomLocked,
  getRoomDisplayStatus,
  canSubmitComplain,
} from "../../src/utils/matchroomLifecycle";
import {
  FIXED_NOW,
  ONE_HOUR,
  ONE_DAY,
  openRoom,
  fullRoom,
  lockedRoom,
  pastLockUnfilledRoom,
  expiredRoom,
  completedRoom,
} from "../fixtures";

const now = FIXED_NOW;

describe("isRoomFull", () => {
  it("is true when confirmed slots meet maxPlayers", () => {
    expect(isRoomFull(fullRoom)).toBe(true);
  });

  it("is false for an open room with free seats", () => {
    expect(isRoomFull(openRoom)).toBe(false);
  });

  it("falls back to player count when there are no slots", () => {
    expect(isRoomFull({ slotsA: [], slotsB: [], currentPlayers: 10, maxPlayers: 10 })).toBe(true);
    expect(isRoomFull({ slotsA: [], slotsB: [], currentPlayers: 3, maxPlayers: 10 })).toBe(false);
  });
});

describe("isRoomExpired", () => {
  it("open future room is not expired", () => {
    expect(isRoomExpired(openRoom, now)).toBe(false);
  });

  it("explicit expired/cancelled status is expired", () => {
    expect(isRoomExpired({ status: "expired" }, now)).toBe(true);
    expect(isRoomExpired({ status: "cancelled" }, now)).toBe(true);
  });

  it("completed / in-progress rooms are never expired", () => {
    expect(isRoomExpired(completedRoom, now)).toBe(false);
    expect(isRoomExpired({ ...openRoom, status: "in-progress" }, now)).toBe(false);
  });

  it("a full room is not expired even after lock", () => {
    expect(isRoomExpired(lockedRoom, now)).toBe(false);
  });

  it("an unfilled room past its join-lock is expired", () => {
    expect(isRoomExpired(pastLockUnfilledRoom, now)).toBe(true);
    expect(isRoomExpired(expiredRoom, now)).toBe(true);
  });
});

describe("isJoinLocked / isRoomLocked", () => {
  it("open future room is joinable", () => {
    expect(isJoinLocked(openRoom, now)).toBe(false);
  });

  it("full room is join-locked", () => {
    expect(isJoinLocked(fullRoom, now)).toBe(true);
    expect(isRoomLocked(lockedRoom, now)).toBe(true);
  });

  it("expired (unfilled past-lock) room is NOT reported as join-locked", () => {
    // Expired short-circuits join-lock so dead rooms read as expired, not locked.
    expect(isJoinLocked(pastLockUnfilledRoom, now)).toBe(false);
  });
});

describe("isLeaveLocked", () => {
  it("is locked once the venue/zone is confirmed", () => {
    expect(isLeaveLocked({ ...openRoom, zoneAdminApproved: true }, now)).toBe(true);
    expect(isLeaveLocked({ ...openRoom, venueConfirmedAt: now.toISOString() }, now)).toBe(true);
  });

  it("is not locked for a plain open future room", () => {
    expect(isLeaveLocked(openRoom, now)).toBe(false);
  });

  it("is locked for cancelled/expired rooms", () => {
    expect(isLeaveLocked({ status: "cancelled" }, now)).toBe(true);
  });
});

describe("getRoomDisplayStatus (priority)", () => {
  it("expired wins over everything", () => {
    expect(getRoomDisplayStatus(expiredRoom)).toBe("expired");
  });

  it("full/future shows locked", () => {
    expect(getRoomDisplayStatus(lockedRoom)).toBe("locked");
  });

  it("open room shows open", () => {
    expect(getRoomDisplayStatus(openRoom)).toBe("open");
  });
});

describe("canSubmitComplain", () => {
  it("allows in-progress / open / locked rooms", () => {
    expect(canSubmitComplain({ status: "in-progress" }, now)).toBe(true);
    expect(canSubmitComplain({ status: "open" }, now)).toBe(true);
  });

  it("allows completed rooms within 24h of completion", () => {
    expect(canSubmitComplain(completedRoom, now)).toBe(true);
  });

  it("blocks completed rooms older than 24h", () => {
    const old = { status: "completed", completedAt: new Date(now.getTime() - 2 * ONE_DAY).toISOString() };
    expect(canSubmitComplain(old, now)).toBe(false);
  });

  it("blocks unknown/expired status", () => {
    expect(canSubmitComplain({ status: "expired" }, now)).toBe(false);
  });

  it("complaint window edge: just inside 24h passes, just outside fails", () => {
    const insideEdge = { status: "completed", completedAt: new Date(now.getTime() - (ONE_DAY - ONE_HOUR)).toISOString() };
    const outsideEdge = { status: "completed", completedAt: new Date(now.getTime() - (ONE_DAY + ONE_HOUR)).toISOString() };
    expect(canSubmitComplain(insideEdge, now)).toBe(true);
    expect(canSubmitComplain(outsideEdge, now)).toBe(false);
  });
});
