import {
  canSubmitComplain,
  getRoomDisplayStatus,
  getRoomExpiresAt,
  getRoomLockAt,
  isRoomExpired,
  isRoomFull,
  isRoomLocked,
  parseScheduledStartAt,
} from "../../src/utils/matchroomLifecycle";

describe("matchroomLifecycle", () => {
  it("parses scheduledStartAt from a millis-like object", () => {
    const room = { scheduledStartAt: { toMillis: () => 1700000000000 } };
    const dt = parseScheduledStartAt(room);
    expect(dt).not.toBeNull();
    expect(dt?.getTime()).toBe(1700000000000);
  });

  it("derives lockAt 24h before scheduled start", () => {
    const room = { scheduledDate: "2026-02-20", scheduledTime: "12:00" };
    const lockAt = getRoomLockAt(room);
    expect(lockAt).not.toBeNull();
    expect(lockAt?.getFullYear()).toBe(2026);
    expect(lockAt?.getMonth()).toBe(1);
    expect(lockAt?.getDate()).toBe(19);
    expect(lockAt?.getHours()).toBe(12);
  });

  it("uses explicit expiresAt when provided", () => {
    const explicit = new Date(2026, 1, 18, 10, 0, 0);
    const room = { expiresAt: explicit };
    const expiresAt = getRoomExpiresAt(room);
    expect(expiresAt?.getTime()).toBe(explicit.getTime());
  });

  it("detects full rooms from confirmed slots", () => {
    const room = {
      slotsA: [{ status: "confirmed" }],
      slotsB: [{ status: "confirmed" }],
    };
    expect(isRoomFull(room)).toBe(true);
  });

  it("falls back to player count when slots missing", () => {
    const room = { maxPlayers: 5, currentPlayers: 5 };
    expect(isRoomFull(room)).toBe(true);
  });

  it("expires rooms when past expiresAt and not full", () => {
    const now = new Date(2026, 1, 17, 12, 0, 0);
    const room = { expiresAt: new Date(2026, 1, 17, 10, 0, 0) };
    expect(isRoomExpired(room, now)).toBe(true);
  });

  it("locks rooms at lockAt when full", () => {
    const now = new Date(2026, 1, 19, 12, 0, 0);
    const room = {
      scheduledDate: "2026-02-20",
      scheduledTime: "12:00",
      slotsA: [{ status: "confirmed" }],
      slotsB: [{ status: "confirmed" }],
    };
    expect(isRoomLocked(room, now)).toBe(true);
  });

  it("returns display status with priority", () => {
    const room = { status: "expired" };
    expect(getRoomDisplayStatus(room)).toBe("expired");
  });

  it("allows complaints for completed rooms within 24h", () => {
    const now = new Date(2026, 1, 18, 10, 0, 0);
    const completedAt = new Date(2026, 1, 17, 12, 0, 0);
    const room = { status: "completed", completedAt };
    expect(canSubmitComplain(room, now)).toBe(true);
  });

  it("blocks complaints after 24h window", () => {
    const now = new Date(2026, 1, 19, 13, 0, 0);
    const completedAt = new Date(2026, 1, 17, 12, 0, 0);
    const room = { status: "completed", completedAt };
    expect(canSubmitComplain(room, now)).toBe(false);
  });
});
