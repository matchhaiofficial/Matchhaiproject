import { combineKarachiDateTime } from "../../src/utils/scheduleTime";

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
