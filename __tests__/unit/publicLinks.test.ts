import { resolvePublicAppHref } from "../../src/navigation/publicLinks";
import {
  buildDeepLink,
  buildShareLink,
  formatVenueShare,
} from "../../src/utils/shareContent";

describe("public MatchHai links", () => {
  it("preserves routes already handled directly by Expo Router", () => {
    expect(resolvePublicAppHref("matchhai://matchrooms/room-1")).toBe(
      "/matchrooms/room-1",
    );
    expect(resolvePublicAppHref("https://matchhai.com/teams/team-1/")).toBe(
      "/teams/team-1/",
    );
    expect(resolvePublicAppHref("matchhai://profile/user-1")).toBe(
      "/profile/user-1",
    );
  });

  it("maps website bridge aliases to existing app screens", () => {
    expect(resolvePublicAppHref("matchhai://venues/zone-1")).toBe(
      "/zones/zone-1",
    );
    expect(resolvePublicAppHref("https://matchhai.com/booking/room-1/")).toBe(
      "/matchrooms/book/status/room-1",
    );
  });

  it("routes notifications and wallet according to account type", () => {
    expect(resolvePublicAppHref("matchhai://notifications", "player")).toBe(
      "/inbox",
    );
    expect(resolvePublicAppHref("matchhai://notifications", "zone")).toBe(
      "/zone/modules/notifications",
    );
    expect(
      resolvePublicAppHref("https://matchhai.com/notifications/", "super_admin"),
    ).toBe("/super-admin/notifications");
    expect(resolvePublicAppHref("matchhai://wallet", "zone")).toBe(
      "/zone/wallet",
    );
  });

  it("uses the website bridge venue route in shared copy", () => {
    expect(
      formatVenueShare({ id: "zone-1", name: "Pashas Squad" }),
    ).toContain("https://matchhai.com/venues/zone-1");
    expect(buildShareLink("matchrooms/room-1")).toBe(
      "https://matchhai.com/matchrooms/room-1",
    );
    expect(buildDeepLink("matchrooms/room-1")).toBe(
      "matchhai://matchrooms/room-1",
    );
  });
});
