import {
  closestDateTimeForClock,
  combineKarachiDateTime,
  toLocalDateString,
  toLocalTime24,
} from "../../src/utils/scheduleTime";

describe("persisted Karachi schedule parsing", () => {
  it("produces the same epoch regardless of the device timezone", () => {
    expect(combineKarachiDateTime("2026-09-10", "18:00")).toBe(1_789_045_200_000);
    expect(combineKarachiDateTime("2026-09-10", "6:00 PM")).toBe(1_789_045_200_000);
  });

  it("rejects malformed dates and times", () => {
    expect(combineKarachiDateTime("September 10", "18:00")).toBeNull();
    expect(combineKarachiDateTime("2026-02-30", "18:00")).toBeNull();
    expect(combineKarachiDateTime("2026-09-10", "later")).toBeNull();
    expect(combineKarachiDateTime("2026-09-10", "99:99")).toBeNull();
  });
});

describe("counter-offer midnight rollover", () => {
  it("moves midnight to the following date for an 11 PM original booking", () => {
    const original = new Date(2026, 8, 20, 23, 0, 0, 0).getTime();
    const proposed = closestDateTimeForClock(original, "12:00 AM");
    expect(proposed).not.toBeNull();
    const value = new Date(proposed!);
    expect(toLocalDateString(value)).toBe("2026-09-21");
    expect(toLocalTime24(value)).toBe("00:00");
  });

  it("resolves a nearby late-night time to the previous date after midnight", () => {
    const original = new Date(2026, 8, 21, 0, 30, 0, 0).getTime();
    const proposed = closestDateTimeForClock(original, "11:30 PM");
    const value = new Date(proposed!);
    expect(toLocalDateString(value)).toBe("2026-09-20");
    expect(toLocalTime24(value)).toBe("23:30");
  });
});
