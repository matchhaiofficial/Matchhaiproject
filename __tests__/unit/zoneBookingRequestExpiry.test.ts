import { isZoneBookingRequestExpired } from "../../app/zone/modules/hooks/useZoneBookingsViewModel";

const makeRequest = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "request-1",
    userId: "user-1",
    userName: "Player",
    title: "1v1 Competitive",
    gameKey: "fc26",
    maxPlayers: 2,
    preferredAreas: [],
    status: "open",
    assetType: "console",
    priorityFlags: [],
    raw: {},
    ...overrides,
  }) as any;

describe("zone booking request expiry", () => {
  const now = new Date("2026-06-06T12:00:00").getTime();

  it("hides requests whose scheduled start has passed", () => {
    expect(
      isZoneBookingRequestExpired(
        makeRequest({ preferredDate: "2026-06-06", preferredTime: "11:59" }),
        now,
      ),
    ).toBe(true);
  });

  it("understands twelve-hour request times", () => {
    expect(
      isZoneBookingRequestExpired(
        makeRequest({ preferredDate: "2026-06-06", preferredTime: "11:59 AM" }),
        now,
      ),
    ).toBe(true);
  });

  it("hides requests whose response window has expired", () => {
    expect(
      isZoneBookingRequestExpired(
        makeRequest({
          preferredDate: "2026-06-07",
          preferredTime: "12:00",
          responseExpiresAt: now - 1,
        }),
        now,
      ),
    ).toBe(true);
  });

  it("keeps future actionable requests visible", () => {
    expect(
      isZoneBookingRequestExpired(
        makeRequest({ preferredDate: "2026-06-07", preferredTime: "12:00" }),
        now,
      ),
    ).toBe(false);
  });
});
