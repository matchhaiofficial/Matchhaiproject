import { TIMELINE_FILTERS, getTimelineLabel } from "../../src/constants/timelineFilters";

describe("timelineFilters", () => {
  it("returns labels for known keys", () => {
    expect(getTimelineLabel("any")).toBe("Any");
    expect(getTimelineLabel("today")).toBe("Today");
  });

  it("has unique keys", () => {
    const keys = TIMELINE_FILTERS.map((f) => f.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });
});
