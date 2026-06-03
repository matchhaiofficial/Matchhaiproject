// Phase 1B — scheduled date/time parsing, windows, overlap.
import {
  parseScheduledDateTime,
  getMatchroomWindow,
  doWindowsOverlap,
} from "../../src/utils/matchroomTime";

describe("parseScheduledDateTime", () => {
  it("parses ISO-like yyyy-mm-dd with 24h time", () => {
    const d = parseScheduledDateTime("2026-06-10", "18:30");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(5); // June (0-indexed)
    expect(d!.getDate()).toBe(10);
    expect(d!.getHours()).toBe(18);
    expect(d!.getMinutes()).toBe(30);
  });

  it("parses dd/mm/yyyy with 12h AM/PM time", () => {
    const d = parseScheduledDateTime("10/06/2026", "6:30 PM");
    expect(d!.getDate()).toBe(10);
    expect(d!.getMonth()).toBe(5);
    expect(d!.getHours()).toBe(18);
  });

  it("handles 12 AM (midnight) and 12 PM (noon)", () => {
    expect(parseScheduledDateTime("2026-06-10", "12:00 AM")!.getHours()).toBe(0);
    expect(parseScheduledDateTime("2026-06-10", "12:00 PM")!.getHours()).toBe(12);
  });

  it("returns null on missing/invalid inputs", () => {
    expect(parseScheduledDateTime(undefined, "18:00")).toBeNull();
    expect(parseScheduledDateTime("2026-06-10", undefined)).toBeNull();
    expect(parseScheduledDateTime("not-a-date", "18:00")).toBeNull();
    expect(parseScheduledDateTime("2026-06-10", "notime")).toBeNull();
  });
});

describe("getMatchroomWindow / doWindowsOverlap", () => {
  it("builds a window from start + duration", () => {
    const w = getMatchroomWindow({ scheduledDate: "2026-06-10", scheduledTime: "18:00", durationMinutes: 60 });
    expect(w).not.toBeNull();
    expect(w!.endMs - w!.startMs).toBe(60 * 60 * 1000);
  });

  it("returns null for non-positive / missing duration", () => {
    expect(getMatchroomWindow({ scheduledDate: "2026-06-10", scheduledTime: "18:00", durationMinutes: 0 })).toBeNull();
    expect(getMatchroomWindow({ scheduledDate: "2026-06-10", scheduledTime: "18:00", durationMinutes: null })).toBeNull();
  });

  it("detects overlapping and non-overlapping windows", () => {
    const a = { startMs: 1000, endMs: 5000 };
    const overlapping = { startMs: 4000, endMs: 9000 };
    const adjacent = { startMs: 5000, endMs: 9000 }; // touching edges do not overlap
    const apart = { startMs: 6000, endMs: 9000 };
    expect(doWindowsOverlap(a, overlapping)).toBe(true);
    expect(doWindowsOverlap(a, adjacent)).toBe(false);
    expect(doWindowsOverlap(a, apart)).toBe(false);
  });
});
