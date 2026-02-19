const passthrough = (config: any) => config;

jest.mock("../../convex/_generated/server", () => ({
  mutation: (config: any) => passthrough(config),
  query: (config: any) => passthrough(config),
  action: (config: any) => passthrough(config),
  internalMutation: (config: any) => passthrough(config),
}));

const expectHandler = (mod: Record<string, any>, name: string) => {
  const fn = mod[name];
  expect(fn).toBeDefined();
  expect(typeof fn.handler).toBe("function");
};

describe("convex smoke (exports)", () => {
  it("bookings exports handlers", () => {
    const bookings = require("../../convex/bookings");
    [
      "createBookingRequest",
      "listBookingRequestsForUser",
      "listOffersForRequest",
      "listOffersForUser",
      "createZoneOffer",
      "acceptBookingOffer",
      "payBookingIntent",
      "confirmBooking",
      "cancelBookingRequest",
      "expireStaleBookings",
      "expireStaleBookingsInternal",
    ].forEach((name) => expectHandler(bookings, name));
  });

  it("matchrooms exports handlers", () => {
    const matchrooms = require("../../convex/matchrooms");
    [
      "createMatchroom",
      "getMatchroom",
      "joinMatchroom",
      "leaveMatchroom",
      "reserveSlot",
      "inviteToMatchroom",
      "respondToMatchroomInvite",
      "requestJoinMatchroom",
      "respondToMatchJoinRequest",
      "startMatchroom",
      "completeMatchroom",
      "submitMatchResult",
      "voteMatchResult",
    ].forEach((name) => expectHandler(matchrooms, name));
  });

  it("chat exports handlers", () => {
    const chat = require("../../convex/chat");
    [
      "createChatroom",
      "getChatroomByMatchroom",
      "postMessage",
      "listMessages",
      "markChatSeen",
      "deleteMessageForMe",
    ].forEach((name) => expectHandler(chat, name));
  });

  it("integrations exports handlers", () => {
    const integrations = require("../../convex/integrations");
    [
      "updateIntegrationCache",
      "fetchSteamProfileFromUrl",
      "fetchFaceitProfileFromUrl",
      "verifyPsnProfile",
    ].forEach((name) => expectHandler(integrations, name));
  });

  it("super admin exports handlers", () => {
    const superAdmin = require("../../convex/superAdmin");
    ["reviewZoneRegistration", "setUserRole", "listReports", "resolveReport"].forEach((name) =>
      expectHandler(superAdmin, name)
    );
  });
});

describe("convex smoke (cron wiring)", () => {
  it("schedules expire stale bookings", () => {
    jest.resetModules();
    const intervalMock = jest.fn();

    jest.doMock("convex/server", () => ({
      cronJobs: () => ({ interval: intervalMock }),
    }));

    const cron = require("../../convex/cron").default;
    expect(cron).toBeDefined();
    expect(intervalMock).toHaveBeenCalledWith(
      "expire stale bookings",
      { hours: 1 },
      "bookings:expireStaleBookingsInternal",
      {}
    );
  });
});
