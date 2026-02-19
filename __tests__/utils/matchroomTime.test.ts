import {
  parseScheduledDateTime,
  getMatchroomWindow,
  doWindowsOverlap,
  formatTimeRange,
} from "../../src/utils/matchroomTime";

describe("matchroomTime", () => {
  it("parses ISO date with 12-hour time", () => {
    const dt = parseScheduledDateTime("2026-02-17", "7:30 PM");
    expect(dt).not.toBeNull();
    expect(dt?.getFullYear()).toBe(2026);
    expect(dt?.getMonth()).toBe(1);
    expect(dt?.getDate()).toBe(17);
    expect(dt?.getHours()).toBe(19);
    expect(dt?.getMinutes()).toBe(30);
  });

  it("parses slash date with 24-hour time", () => {
    const dt = parseScheduledDateTime("17/02/2026", "07:30");
    expect(dt).not.toBeNull();
    expect(dt?.getFullYear()).toBe(2026);
    expect(dt?.getMonth()).toBe(1);
    expect(dt?.getDate()).toBe(17);
    expect(dt?.getHours()).toBe(7);
    expect(dt?.getMinutes()).toBe(30);
  });

  it("returns null window for invalid duration", () => {
    const window = getMatchroomWindow({
      scheduledDate: "2026-02-17",
      scheduledTime: "18:00",
      durationMinutes: 0,
    });
    expect(window).toBeNull();
  });

  it("builds a valid window and overlaps correctly", () => {
    const a = getMatchroomWindow({
      scheduledDate: "2026-02-17",
      scheduledTime: "18:00",
      durationMinutes: 60,
    });
    const b = getMatchroomWindow({
      scheduledDate: "2026-02-17",
      scheduledTime: "18:30",
      durationMinutes: 60,
    });

    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(doWindowsOverlap(a!, b!)).toBe(true);
  });

  it("formats a readable time range", () => {
    const window = getMatchroomWindow({
      scheduledDate: "2026-02-17",
      scheduledTime: "18:00",
      durationMinutes: 90,
    });
    const formatted = formatTimeRange(window!);
    expect(formatted).toContain("on");
  });
});
