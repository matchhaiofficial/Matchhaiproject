import {
  getKarachiDateString,
  normalizeClockTime,
  parseKarachiDateTimeMillis,
} from "../../convex/karachiDateTime";
import { getBookingRequestStartAtForConflict } from "../../convex/bookingConflicts";

describe("Karachi booking date/time normalization", () => {
  it("interprets stored date plus clock time in Karachi, independent of server UTC", () => {
    expect(parseKarachiDateTimeMillis("2026-09-20", "18:00"))
      .toBe(Date.UTC(2026, 8, 20, 13, 0, 0));
    expect(parseKarachiDateTimeMillis("2026-09-20", "6:00 PM"))
      .toBe(Date.UTC(2026, 8, 20, 13, 0, 0));
  });

  it("extracts the Karachi calendar date from numeric picker values", () => {
    const pickerValue = Date.UTC(2026, 8, 19, 19, 0, 0);
    expect(getKarachiDateString(pickerValue)).toBe("2026-09-20");
    expect(getBookingRequestStartAtForConflict({ preferredDate: pickerValue, preferredTime: "18:00" }))
      .toBe(Date.UTC(2026, 8, 20, 13, 0, 0));
  });

  it("rejects invalid dates and clock values", () => {
    expect(getKarachiDateString("2026-02-31")).toBeNull();
    expect(normalizeClockTime("24:00")).toBeNull();
    expect(parseKarachiDateTimeMillis("bad", "18:00")).toBeNull();
  });
});
