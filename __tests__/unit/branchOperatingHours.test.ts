import {
  checkBranchOperatingHours,
  createDefaultBranchOperatingHours,
  validateBranchOperatingHours,
} from "../../constants/branchOperatingHours";

const atKarachi = (value: string) => new Date(`${value}+05:00`).getTime();

describe("branch operating hours", () => {
  it("preserves legacy branches without configured hours", () => {
    expect(checkBranchOperatingHours({
      operatingHours: undefined,
      scheduledStartAt: atKarachi("2026-09-07T02:00:00"),
      durationMinutes: 60,
    })).toMatchObject({ available: true, configured: false });
  });

  it("requires the entire booking to fit in a same-day window", () => {
    const operatingHours = createDefaultBranchOperatingHours();
    expect(checkBranchOperatingHours({ operatingHours, scheduledStartAt: atKarachi("2026-09-07T21:30:00"), durationMinutes: 90 }).available).toBe(true);
    expect(checkBranchOperatingHours({ operatingHours, scheduledStartAt: atKarachi("2026-09-07T22:30:00"), durationMinutes: 60 }).available).toBe(false);
  });

  it("supports overnight and 24-hour operating days", () => {
    const overnight = createDefaultBranchOperatingHours();
    overnight.weekly = overnight.weekly.map((day) => ({ ...day, openTime: "18:00", closeTime: "02:00" }));
    expect(checkBranchOperatingHours({ operatingHours: overnight, scheduledStartAt: atKarachi("2026-09-08T00:30:00"), durationMinutes: 60 }).available).toBe(true);
    expect(checkBranchOperatingHours({ operatingHours: overnight, scheduledStartAt: atKarachi("2026-09-08T02:00:00"), durationMinutes: 30 }).available).toBe(false);

    const alwaysOpen = createDefaultBranchOperatingHours();
    alwaysOpen.weekly = alwaysOpen.weekly.map((day) => ({ ...day, openTime: "00:00", closeTime: "00:00" }));
    expect(checkBranchOperatingHours({ operatingHours: alwaysOpen, scheduledStartAt: atKarachi("2026-09-08T23:30:00"), durationMinutes: 120 }).available).toBe(true);
  });

  it("lets a dated closure override weekly hours", () => {
    const operatingHours = createDefaultBranchOperatingHours();
    operatingHours.exceptions = [{ date: "2026-09-07", isClosed: true, label: "Maintenance" }];
    expect(checkBranchOperatingHours({ operatingHours, scheduledStartAt: atKarachi("2026-09-07T12:00:00"), durationMinutes: 60 }).available).toBe(false);
    expect(checkBranchOperatingHours({ operatingHours, scheduledStartAt: atKarachi("2026-09-08T12:00:00"), durationMinutes: 60 }).available).toBe(true);
  });

  it("does not leak a previous day's overnight hours into an overridden date", () => {
    const operatingHours = createDefaultBranchOperatingHours();
    operatingHours.weekly = operatingHours.weekly.map((day) => ({
      ...day,
      openTime: "18:00",
      closeTime: "02:00",
    }));
    operatingHours.exceptions = [{ date: "2026-09-08", isClosed: true, label: "Maintenance" }];

    expect(checkBranchOperatingHours({
      operatingHours,
      scheduledStartAt: atKarachi("2026-09-08T00:30:00"),
      durationMinutes: 60,
    }).available).toBe(false);
  });

  it("rejects malformed schedules and duplicate exception dates", () => {
    const operatingHours = createDefaultBranchOperatingHours();
    operatingHours.weekly[0].openTime = "9am";
    expect(validateBranchOperatingHours(operatingHours)).toContain("Sunday");
    operatingHours.weekly[0].openTime = "09:00";
    operatingHours.exceptions = [
      { date: "2026-09-07", isClosed: true },
      { date: "2026-09-07", isClosed: true },
    ];
    expect(validateBranchOperatingHours(operatingHours)).toContain("Only one");
  });

  it("rejects calendar dates that JavaScript would otherwise normalize", () => {
    const operatingHours = createDefaultBranchOperatingHours();
    operatingHours.exceptions = [{ date: "2026-02-30", isClosed: true }];
    expect(validateBranchOperatingHours(operatingHours)).toContain("valid YYYY-MM-DD");
  });
});
