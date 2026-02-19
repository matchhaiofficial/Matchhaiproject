import { getRoomStartDate, isInTimeline, matchesTimeline } from "../../src/utils/timeFilters";

describe("timeFilters", () => {
  describe("getRoomStartDate", () => {
    it("parses Firestore-like timestamp seconds", () => {
      const room = { startTime: { seconds: 1700000000 } };
      const date = getRoomStartDate(room);
      expect(date).not.toBeNull();
      expect(date?.getTime()).toBe(1700000000 * 1000);
    });

    it("parses scheduledDate + scheduledTime fallback", () => {
      const room = { scheduledDate: "2026-02-17", scheduledTime: "18:30" };
      const date = getRoomStartDate(room);
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2026);
      expect(date?.getMonth()).toBe(1);
      expect(date?.getDate()).toBe(17);
      expect(date?.getHours()).toBe(18);
      expect(date?.getMinutes()).toBe(30);
    });
  });

  describe("isInTimeline", () => {
    const now = new Date(2026, 1, 17, 10, 0, 0);

    it("matches today", () => {
      const date = new Date(2026, 1, 17, 12, 0, 0);
      expect(isInTimeline(date, "today", now)).toBe(true);
    });

    it("matches next_3_days", () => {
      const date = new Date(2026, 1, 18, 12, 0, 0);
      expect(isInTimeline(date, "next_3_days", now)).toBe(true);
    });

    it("matches next_1_week", () => {
      const date = new Date(2026, 1, 20, 12, 0, 0);
      expect(isInTimeline(date, "next_1_week", now)).toBe(true);
    });
  });

  describe("matchesTimeline", () => {
    it("returns false when no date and filter is not any", () => {
      const room = { title: "No time" };
      expect(matchesTimeline(room, "today")).toBe(false);
    });

    it("returns true for any even without date", () => {
      const room = { title: "No time" };
      expect(matchesTimeline(room, "any")).toBe(true);
    });
  });
});
